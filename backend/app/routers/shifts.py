"""
Vardiya yönetimi — başlatma, bitirme.
Vardiya başlatıldığında bugünkü rota GPS konumuna göre otomatik yeniden sıralanır.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.models import DailyRoute, Market, RouteStop, Shift, User
from app.routers.auth import get_current_user
from app.routers.routes import _nearest_neighbor_sort, _build_route_out
from app.schemas.schemas import DailyRouteOut, ShiftEnd, ShiftOut, ShiftStart

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
