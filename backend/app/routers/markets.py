import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, text
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID, ST_X, ST_Y

from app.core.database import get_db
from app.models.models import Market, User
from app.routers.auth import get_current_user
from app.schemas.schemas import (
    MarketCreate, MarketOut, MarketUpdate, PaginatedMarkets,
)

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("/search", response_model=PaginatedMarkets)
async def search_markets(
    q: Optional[str] = Query(None, description="İsim veya adres ara"),
    type: Optional[str] = Query(None),
    is_verified: Optional[bool] = Query(None),
    is_corporate: Optional[bool] = Query(None, description="Kurumsal filtresi"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Koordinatları SQL'de çözdürüyoruz — Python'da geoalchemy2 parse hatası yok
    base_query = select(
        Market,
        ST_Y(Market.location).label("lat"),
        ST_X(Market.location).label("lng"),
    )

    if q:
        base_query = base_query.where(
            or_(
                Market.name.ilike(f"%{q}%"),
                Market.address.ilike(f"%{q}%"),
            )
        )
    if type:
        base_query = base_query.where(Market.type == type)
    if is_verified is not None:
        base_query = base_query.where(Market.is_verified == is_verified)
    if is_corporate is not None:
        base_query = base_query.where(Market.is_corporate == is_corporate)

    # Toplam sayı
    count_query = select(func.count()).select_from(base_query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Sayfalama
    offset = (page - 1) * page_size
    result = await db.execute(base_query.offset(offset).limit(page_size))
    rows = result.all()

    items = []
    for row in rows:
        m = row[0]
        lat = row[1] if row[1] is not None else 0.0
        lng = row[2] if row[2] is not None else 0.0
        items.append(_market_to_out_coords(m, lat, lng))

    return PaginatedMarkets(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.post("/create", response_model=MarketOut, status_code=status.HTTP_201_CREATED)
async def create_market(
    payload: MarketCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    market = Market(
        name=payload.name,
        type=payload.type,
        address=payload.address,
        phone=payload.phone,
        location=ST_SetSRID(ST_MakePoint(payload.longitude, payload.latitude), 4326),
        source="manual",
        is_verified=False,
        is_corporate=payload.is_corporate,
    )
    db.add(market)
    await db.flush()
    return await _fetch_market_out(market.id, db)


@router.put("/update/{market_id}", response_model=MarketOut)
async def update_market(
    market_id: UUID,
    payload: MarketUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Market bulunamadı")

    if payload.name is not None:
        market.name = payload.name
    if payload.type is not None:
        market.type = payload.type
    if payload.address is not None:
        market.address = payload.address
    if payload.phone is not None:
        market.phone = payload.phone
    if payload.is_corporate is not None:
        market.is_corporate = payload.is_corporate
    if payload.latitude is not None and payload.longitude is not None:
        market.location = ST_SetSRID(
            ST_MakePoint(payload.longitude, payload.latitude), 4326
        )

    await db.flush()
    return await _fetch_market_out(market_id, db)


@router.patch("/verify/{market_id}", response_model=MarketOut)
async def verify_market(
    market_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkiniz yok")

    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Market bulunamadı")

    market.is_verified = True
    await db.flush()
    return await _fetch_market_out(market_id, db)


@router.get("/{market_id}", response_model=MarketOut)
async def get_market(
    market_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _fetch_market_out(market_id, db)


async def _fetch_market_out(market_id: UUID, db: AsyncSession) -> MarketOut:
    """ID'ye göre marketi koordinatlarıyla birlikte çek."""
    result = await db.execute(
        select(
            Market,
            ST_Y(Market.location).label("lat"),
            ST_X(Market.location).label("lng"),
        ).where(Market.id == market_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Market bulunamadı")
    m, lat, lng = row
    return _market_to_out_coords(m, lat or 0.0, lng or 0.0)


def _market_to_out_coords(market: Market, lat: float, lng: float) -> MarketOut:
    """Market modeli + koordinatları MarketOut schema'ya çevirir."""
    return MarketOut(
        id=market.id,
        name=market.name,
        type=market.type,
        address=market.address,
        phone=market.phone,
        latitude=lat,
        longitude=lng,
        is_verified=market.is_verified,
        is_corporate=market.is_corporate if market.is_corporate is not None else False,
        source=market.source,
        created_at=market.created_at,
    )


def _market_to_out(market: Market) -> MarketOut:
    """Geriye dönük uyumluluk — koordinat parse'ı try/except ile güvenli."""
    lat, lng = 0.0, 0.0
    if market.location is not None:
        try:
            from geoalchemy2.shape import to_shape
            point = to_shape(market.location)
            lat = point.y
            lng = point.x
        except Exception:
            pass
    return _market_to_out_coords(market, lat, lng)
