import math
from uuid import UUID

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from geoalchemy2.functions import ST_X, ST_Y

from app.core.config import settings
from app.core.database import get_db
from app.models.models import Market, Order, Visit, User
from app.routers.auth import get_current_user
from app.schemas.schemas import (
    MarketOut, OrderCreate, OrderOut, PresignedUrlResponse,
    VisitOut, VisitStart, VisitSubmit,
)

router = APIRouter(tags=["operations"])


# ─── Visits ──────────────────────────────────────────────────────────────────

@router.post("/visits/start", response_model=VisitOut, status_code=status.HTTP_201_CREATED)
async def start_visit(
    payload: VisitStart,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ziyaret başlat — geofencing kontrolü yap."""
    # Market'i getir
    result = await db.execute(select(Market).where(Market.id == payload.market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market bulunamadı")

    # Geofencing: koordinatlar sıfır değilse mesafe kontrolü yap
    # (0,0 = test/geliştirme ortamı bypass)
    if market.location is not None and (payload.gps_lat != 0.0 or payload.gps_lng != 0.0):
        coords_result = await db.execute(
            select(
                ST_Y(Market.location).label("lat"),
                ST_X(Market.location).label("lng"),
            ).where(Market.id == payload.market_id)
        )
        coords_row = coords_result.one_or_none()
        if coords_row and coords_row[0] is not None and coords_row[1] is not None:
            dist = _haversine(
                payload.gps_lat, payload.gps_lng,
                coords_row[0], coords_row[1],
            )
            if dist > settings.GEOFENCE_THRESHOLD_METERS:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Markete çok uzaktasınız ({dist:.0f}m). En az {settings.GEOFENCE_THRESHOLD_METERS}m içinde olmalısınız.",
                )

    visit = Visit(
        market_id=payload.market_id,
        user_id=current_user.id,
        gps_lat=payload.gps_lat,
        gps_lng=payload.gps_lng,
        is_successful=False,  # submit'te güncellenecek
    )
    db.add(visit)
    await db.flush()
    await db.refresh(visit)

    # market ilişkisini yükle ve MarketOut olarak oluştur
    mkt_out = await _build_market_out(visit.market_id, db)
    return VisitOut(
        id=visit.id,
        market_id=visit.market_id,
        user_id=visit.user_id,
        timestamp=visit.timestamp,
        photo_url=visit.photo_url,
        note=visit.note,
        gps_lat=visit.gps_lat,
        gps_lng=visit.gps_lng,
        is_successful=visit.is_successful,
        market=mkt_out,
    )


@router.post("/visits/submit", response_model=VisitOut)
async def submit_visit(
    payload: VisitSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ziyareti tamamla — sonuç, not ve fotoğraf URL'sini kaydet."""
    result = await db.execute(
        select(Visit).where(Visit.id == payload.visit_id, Visit.user_id == current_user.id)
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Ziyaret bulunamadı")

    visit.is_successful = payload.is_successful
    visit.note = payload.note
    visit.photo_url = payload.photo_url

    await db.flush()
    await db.refresh(visit)

    mkt_out = await _build_market_out(visit.market_id, db)
    return VisitOut(
        id=visit.id,
        market_id=visit.market_id,
        user_id=visit.user_id,
        timestamp=visit.timestamp,
        photo_url=visit.photo_url,
        note=visit.note,
        gps_lat=visit.gps_lat,
        gps_lng=visit.gps_lng,
        is_successful=visit.is_successful,
        market=mkt_out,
    )


@router.get("/visits", response_model=list[VisitOut])
async def list_visits(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ziyaretleri listele — market bilgisiyle birlikte döner."""
    offset = (page - 1) * page_size
    query = (
        select(Visit)
        .options(selectinload(Visit.market))
        .order_by(Visit.timestamp.desc())
        .offset(offset)
        .limit(page_size)
    )

    # Admin/manager tüm ziyaretleri görür, field_rep sadece kendinkini
    if current_user.role == "field_rep":
        query = query.where(Visit.user_id == current_user.id)

    result = await db.execute(query)
    visits = result.scalars().all()

    # PostGIS koordinatlarını manuel olarak çek
    out = []
    for v in visits:
        mkt_out = await _build_market_out(v.market_id, db) if v.market_id else None
        out.append(VisitOut(
            id=v.id,
            market_id=v.market_id,
            user_id=v.user_id,
            timestamp=v.timestamp,
            photo_url=v.photo_url,
            note=v.note,
            gps_lat=v.gps_lat,
            gps_lng=v.gps_lng,
            is_successful=v.is_successful,
            market=mkt_out,
        ))
    return out


# ─── Orders ──────────────────────────────────────────────────────────────────

@router.post("/orders/add", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def add_order(
    payload: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Visit'in varlığını ve sahipliğini kontrol et
    result = await db.execute(select(Visit).where(Visit.id == payload.visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Ziyaret bulunamadı")
    if current_user.role == "field_rep" and visit.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu ziyarete erişim yetkiniz yok")

    total = sum(p.quantity * p.unit_price for p in payload.product_details)
    order = Order(
        visit_id=payload.visit_id,
        product_details=[p.model_dump() for p in payload.product_details],
        total_amount=total,
    )
    db.add(order)
    await db.flush()
    await db.refresh(order)
    return order


@router.get("/orders", response_model=list[OrderOut])
async def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Siparişleri listele."""
    offset = (page - 1) * page_size
    query = (
        select(Order)
        .order_by(Order.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    return result.scalars().all()


# ─── S3 Presigned Upload URL ──────────────────────────────────────────────────

@router.post("/uploads/presigned", response_model=PresignedUrlResponse)
async def get_presigned_url(
    filename: str = Query(..., description="Yüklenecek dosya adı"),
    current_user: User = Depends(get_current_user),
):
    """Fotoğraf yükleme için imzalı S3 URL oluştur."""
    s3_key = f"visits/{current_user.id}/{filename}"

    try:
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": settings.AWS_S3_BUCKET, "Key": s3_key, "ContentType": "image/jpeg"},
            ExpiresIn=300,  # 5 dakika
        )
        file_url = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"
        return PresignedUrlResponse(upload_url=upload_url, file_url=file_url)
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"S3 hatası: {str(e)}")


# ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

async def _build_market_out(market_id: UUID, db: AsyncSession) -> "MarketOut | None":
    """Market kaydını PostGIS koordinatlarıyla birlikte MarketOut olarak döndür."""
    from uuid import UUID as _UUID
    result = await db.execute(
        select(
            Market,
            ST_Y(Market.location).label("lat"),
            ST_X(Market.location).label("lng"),
        ).where(Market.id == market_id)
    )
    row = result.one_or_none()
    if not row:
        return None
    mkt, lat, lng = row
    return MarketOut(
        id=mkt.id,
        name=mkt.name,
        type=mkt.type,
        address=mkt.address,
        phone=mkt.phone,
        latitude=lat or 0.0,
        longitude=lng or 0.0,
        is_verified=mkt.is_verified,
        is_corporate=mkt.is_corporate,
        source=mkt.source,
        created_at=mkt.created_at,
    )


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """İki koordinat arasındaki mesafeyi metre cinsinden hesapla."""
    R = 6371000
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
