"""
Vardiya yönetimi — başlatma, bitirme.
Vardiya başlatıldığında bugünkü rota GPS konumuna göre otomatik yeniden sıralanır.
"""
import math
from datetime import date, datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from geoalchemy2.functions import ST_X, ST_Y

from app.core.database import get_db
from app.models.models import DailyRoute, Market, RouteStop, Shift, User, Visit
from app.routers.auth import get_current_user
from app.routers.routes import _nearest_neighbor_sort, _build_route_out
from app.schemas.schemas import (
    DailyRouteOut, ShiftEnd, ShiftLocationUpdate, ShiftOut, ShiftStart,
    UserDayDetailOut, UserDayStats, ShiftDateItem,
)

router = APIRouter(prefix="/shifts", tags=["shifts"])


@router.post("/start", response_model=ShiftOut, status_code=status.HTTP_201_CREATED)
async def start_shift(
    payload: ShiftStart,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Vardiyayı başlat.
    - Aktif vardiya varsa hata döner
    - Bugünkü rotayı temsilcinin GPS konumuna göre otomatik yeniden sıralar
    """
    # Zaten aktif vardiya var mı?
    existing = await db.execute(
        select(Shift).where(
            Shift.user_id == current_user.id,
            Shift.status == "active",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Zaten aktif bir vardiya var")

    # Yeni vardiya oluştur
    shift = Shift(
        user_id=current_user.id,
        start_lat=payload.start_lat,
        start_lng=payload.start_lng,
        status="active",
    )
    db.add(shift)
    await db.flush()
    await db.refresh(shift)

    # Bugünkü rotayı GPS konumuna göre yeniden sırala
    await _reorder_route_by_gps(
        user_id=current_user.id,
        current_lat=payload.start_lat,
        current_lng=payload.start_lng,
        db=db,
    )

    return shift


@router.post("/end", response_model=ShiftOut)
async def end_shift(
    payload: ShiftEnd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aktif vardiyayı sonlandır."""
    result = await db.execute(
        select(Shift).where(
            Shift.user_id == current_user.id,
            Shift.status == "active",
        )
    )
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Aktif vardiya bulunamadı")

    from datetime import timezone
    from app.models.models import utcnow

    shift.end_lat = payload.end_lat
    shift.end_lng = payload.end_lng
    shift.status = "completed"
    shift.end_time = utcnow()

    # Bugünkü rotayı completed yap
    today = date.today()
    route_result = await db.execute(
        select(DailyRoute).where(
            DailyRoute.user_id == current_user.id,
            DailyRoute.date == today,
            DailyRoute.status == "active",
        )
    )
    route = route_result.scalar_one_or_none()
    if route:
        route.status = "completed"

    await db.flush()
    await db.refresh(shift)
    return shift


@router.patch("/location", response_model=ShiftOut)
async def update_shift_location(
    payload: ShiftLocationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Temsilcinin aktif vardiyasındaki anlık GPS konumunu güncelle.
    Mobil uygulama periyodik olarak (her 30 saniyede bir) çağırır.
    Admin panel haritasında temsilcinin gerçek zamanlı konumu gösterilir.
    """
    result = await db.execute(
        select(Shift).where(
            Shift.user_id == current_user.id,
            Shift.status == "active",
        )
    )
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Aktif vardiya bulunamadı")

    from app.models.models import utcnow
    shift.current_lat = payload.current_lat
    shift.current_lng = payload.current_lng
    shift.location_updated_at = utcnow()

    await db.flush()
    await db.refresh(shift)
    return shift


@router.get("/active", response_model=ShiftOut)
async def get_active_shift(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mevcut aktif vardiyayı döndür."""
    result = await db.execute(
        select(Shift).where(
            Shift.user_id == current_user.id,
            Shift.status == "active",
        )
    )
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Aktif vardiya yok")
    return shift


@router.get("/all-active", response_model=List[ShiftOut])
async def get_all_active_shifts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin/manager için tüm temsilcilerin aktif vardiyalarını döndür.
    current_lat/lng — mobil uygulama tarafından periyodik olarak güncellenen gerçek konum.
    start_lat/lng  — vardiya başlangıç konumu (fallback).
    """
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")

    result = await db.execute(
        select(Shift).where(Shift.status == "active")
    )
    return result.scalars().all()


# ─── Admin: Kullanıcı gün detayı ─────────────────────────────────────────────

@router.get("/user/{user_id}/day", response_model=UserDayDetailOut)
async def get_user_day_detail(
    user_id: UUID,
    date_str: str = Query(default=None, alias="date", description="YYYY-MM-DD formatında tarih, boşsa bugün"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin/manager için: belirli bir kullanıcının belirli gündeki
    vardiya bilgisi, tüm ziyaretleri (market detayıyla) ve hesaplanan istatistikler.
    """
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")

    # Kullanıcıyı doğrula
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    # Tarihi parse et
    if date_str:
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Geçersiz tarih formatı. YYYY-MM-DD kullanın.")
    else:
        target_date = date.today()

    # O güne ait vardiyayı bul (en son başlayan)
    shift_result = await db.execute(
        select(Shift)
        .where(
            Shift.user_id == user_id,
            func.date(Shift.start_time.op("AT TIME ZONE")("UTC")) == target_date,
        )
        .order_by(Shift.start_time.desc())
        .limit(1)
    )
    shift = shift_result.scalar_one_or_none()

    # O güne ait ziyaretleri market bilgisiyle birlikte çek
    from sqlalchemy.orm import selectinload
    visits_result = await db.execute(
        select(Visit)
        .options(selectinload(Visit.market))
        .where(
            Visit.user_id == user_id,
            func.date(Visit.timestamp.op("AT TIME ZONE")("UTC")) == target_date,
        )
        .order_by(Visit.timestamp.asc())
    )
    visits = visits_result.scalars().all()

    # Market koordinatlarını VisitOut'a göm
    visits_out = []
    for v in visits:
        mkt = v.market
        mkt_out = None
        if mkt:
            # PostGIS geometry'den lat/lng çek
            coord_result = await db.execute(
                select(
                    ST_Y(Market.location).label("lat"),
                    ST_X(Market.location).label("lng"),
                ).where(Market.id == mkt.id)
            )
            coord = coord_result.one_or_none()
            lat = coord[0] if coord and coord[0] else None
            lng = coord[1] if coord and coord[1] else None

            from app.schemas.schemas import MarketOut
            mkt_out = MarketOut(
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

        from app.schemas.schemas import VisitOut as VisitOutSchema
        visits_out.append(VisitOutSchema(
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

    # İstatistikleri hesapla
    visit_count = len(visits_out)
    successful_count = sum(1 for v in visits_out if v.is_successful)
    success_rate = round(successful_count / visit_count * 100, 1) if visit_count > 0 else 0.0

    # Vardiya süresi (dakika)
    total_duration_minutes = 0
    if shift:
        end = shift.end_time or datetime.now(timezone.utc)
        total_duration_minutes = int((end - shift.start_time).total_seconds() / 60)

    # Tahmini kat edilen km — GPS noktaları arasındaki haversine mesafesi
    estimated_km = 0.0
    points: list[tuple[float, float]] = []
    if shift and shift.start_lat and shift.start_lng:
        points.append((shift.start_lat, shift.start_lng))
    for v in visits_out:
        if v.gps_lat and v.gps_lng:
            points.append((v.gps_lat, v.gps_lng))
    if shift and shift.end_lat and shift.end_lng:
        points.append((shift.end_lat, shift.end_lng))
    for i in range(len(points) - 1):
        estimated_km += _haversine_km(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])

    from app.schemas.schemas import UserOut
    return UserDayDetailOut(
        user=UserOut(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
        ),
        date=target_date,
        shift=shift,
        visits=visits_out,
        stats=UserDayStats(
            total_duration_minutes=total_duration_minutes,
            visit_count=visit_count,
            successful_count=successful_count,
            success_rate=success_rate,
            estimated_km=round(estimated_km, 2),
        ),
    )


@router.get("/user/{user_id}/dates", response_model=List[ShiftDateItem])
async def get_user_shift_dates(
    user_id: UUID,
    limit: int = Query(default=30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin/manager için: bir kullanıcının son N gündeki vardiya tarihlerini döner.
    Tarih seçici için kullanılır.
    """
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")

    shifts_result = await db.execute(
        select(Shift)
        .where(Shift.user_id == user_id)
        .order_by(Shift.start_time.desc())
        .limit(limit)
    )
    shifts = shifts_result.scalars().all()

    items = []
    for s in shifts:
        shift_date = s.start_time.date() if s.start_time else date.today()
        # O gündeki ziyaret sayısını çek
        count_result = await db.execute(
            select(func.count(Visit.id)).where(
                Visit.user_id == user_id,
                func.date(Visit.timestamp.op("AT TIME ZONE")("UTC")) == shift_date,
            )
        )
        visit_count = count_result.scalar() or 0
        items.append(ShiftDateItem(
            date=shift_date,
            shift_id=s.id,
            status=s.status,
            visit_count=visit_count,
        ))

    return items


# ─── Yardımcı: iki nokta arası km ────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── Yardımcı: GPS'e göre bugünkü rotayı yeniden sırala ─────────────────────

async def _reorder_route_by_gps(
    user_id,
    current_lat: float,
    current_lng: float,
    db: AsyncSession,
) -> None:
    """
    Bugünkü rotadaki pending/rolled_over durakları GPS konumuna göre sırala.
    Vardiya başlatılırken çağrılır — kullanıcıya rota optimize edilmiş olarak gösterilir.
    """
    today = date.today()
    result = await db.execute(
        select(DailyRoute).where(
            DailyRoute.user_id == user_id,
            DailyRoute.date == today,
        )
    )
    route = result.scalar_one_or_none()
    if not route:
        return  # Bugün rota yoksa sessizce geç

    # Durakları çek
    stops_result = await db.execute(
        select(RouteStop).where(RouteStop.route_id == route.id)
    )
    all_stops = stops_result.scalars().all()

    # Tamamlananlar sabit kalır
    done_stops = sorted(
        [s for s in all_stops if s.status in ("visited", "skipped")],
        key=lambda s: s.order_index,
    )
    pending_stops = [s for s in all_stops if s.status in ("pending", "rolled_over")]

    if not pending_stops:
        return

    # Market koordinatlarını ST_X/ST_Y ile çek
    pending_market_ids = [s.market_id for s in pending_stops]
    from geoalchemy2.functions import ST_X, ST_Y
    mkt_result = await db.execute(
        select(
            Market,
            ST_Y(Market.location).label("lat"),
            ST_X(Market.location).label("lng"),
        ).where(Market.id.in_(pending_market_ids))
    )
    coord_map: dict = {
        row[0].id: (row[1] or current_lat, row[2] or current_lng)
        for row in mkt_result.all()
    }

    # Koordinatlı stop listesi oluştur
    coords: list[tuple] = []
    for stop in pending_stops:
        lat, lng = coord_map.get(stop.market_id, (current_lat, current_lng))
        coords.append((stop.market_id, lat, lng))

    sorted_coords = _nearest_neighbor_sort(coords, current_lat, current_lng)
    sorted_market_ids = [c[0] for c in sorted_coords]

    # order_index güncelle
    base_idx = len(done_stops)
    stop_by_market = {s.market_id: s for s in pending_stops}
    for new_idx, market_id in enumerate(sorted_market_ids):
        stop = stop_by_market.get(market_id)
        if stop:
            stop.order_index = base_idx + new_idx

    # Rota aktif hale getir
    route.status = "active"
    await db.flush()
