"""
Rota yönetimi — haftalık rota üretimi, günlük rota listeleme, GPS tabanlı yeniden sıralama.
"""
import math
from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import (
    DailyRoute, Market, MarketAssignment, RouteStop, User,
)
from app.routers.auth import get_current_user
from app.schemas.schemas import (
    DailyRouteOut,
    GenerateWeeklyRoutesRequest,
    ReorderRouteRequest,
    RouteStopOut,
    UserOut,
    WeeklyRoutesOut,
)

router = APIRouter(prefix="/routes", tags=["routes"])


# ─── Nearest Neighbor algoritması ────────────────────────────────────────────

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """İki koordinat arasındaki mesafeyi metre cinsinden hesapla."""
    R = 6371000.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nearest_neighbor_sort(
    markets: list[tuple[UUID, float, float]],  # (market_id, lat, lng)
    start_lat: float,
    start_lng: float,
) -> list[tuple[UUID, float, float]]:
    """
    Nearest Neighbor TSP heuristic.
    Başlangıç noktasından en yakın marketi seçerek devam eder.
    Küçük-orta büyüklükte listeler (<=50) için yeterince hızlı.
    """
    if not markets:
        return []

    remaining = list(markets)
    ordered: list[tuple[UUID, float, float]] = []
    cur_lat, cur_lng = start_lat, start_lng

    while remaining:
        # Mevcut konuma en yakın marketi bul
        nearest_idx = min(
            range(len(remaining)),
            key=lambda i: _haversine(cur_lat, cur_lng, remaining[i][1], remaining[i][2]),
        )
        nearest = remaining.pop(nearest_idx)
        ordered.append(nearest)
        cur_lat, cur_lng = nearest[1], nearest[2]

    return ordered


def _cluster_by_geography(
    markets: list[tuple[UUID, float, float]],
    days: int,
    start_lat: float,
    start_lng: float,
) -> list[list[tuple[UUID, float, float]]]:
    """
    Marketleri coğrafi bölgelere göre 'days' gruba böl.
    Grid tabanlı basit kümeleme: Antalya'yı lat/lng ızgarasına böler,
    her hücreye bir renk atar, renkleri gruplara dağıtır.
    Sonra her grubu kendi içinde Nearest Neighbor ile sıralar ve
    grupları birbirine yakınlığa göre günlere atar.
    """
    if not markets:
        return [[] for _ in range(days)]

    # Adım 1: Marketleri lat/lng ızgarasına göre hücrelere koy
    lats = [m[1] for m in markets]
    lngs = [m[2] for m in markets]
    lat_min, lat_max = min(lats), max(lats)
    lng_min, lng_max = min(lngs), max(lngs)

    # Izgara çözünürlüğü: her eksen için kare kök(days) hücre
    grid_size = max(2, math.ceil(math.sqrt(days)))
    lat_step = (lat_max - lat_min) / grid_size or 0.001
    lng_step = (lng_max - lng_min) / grid_size or 0.001

    # Her marketi ızgara hücresine ata
    cell_map: dict[tuple[int, int], list[tuple[UUID, float, float]]] = {}
    for m in markets:
        row = min(int((m[1] - lat_min) / lat_step), grid_size - 1)
        col = min(int((m[2] - lng_min) / lng_step), grid_size - 1)
        cell_map.setdefault((row, col), []).append(m)

    # Adım 2: Hücreleri başlangıç noktasına yakınlığa göre sırala
    def cell_center(row: int, col: int) -> tuple[float, float]:
        return lat_min + (row + 0.5) * lat_step, lng_min + (col + 0.5) * lng_step

    sorted_cells = sorted(
        cell_map.keys(),
        key=lambda rc: _haversine(start_lat, start_lng, *cell_center(*rc)),
    )

    # Adım 3: Hücreleri round-robin şekilde 'days' gruba dağıt
    groups: list[list[tuple[UUID, float, float]]] = [[] for _ in range(days)]
    for i, cell in enumerate(sorted_cells):
        groups[i % days].extend(cell_map[cell])

    # Adım 4: Her grubu kendi içinde Nearest Neighbor ile sırala
    for i in range(days):
        if groups[i]:
            groups[i] = _nearest_neighbor_sort(groups[i], start_lat, start_lng)

    return groups


# ─── Haftalık rota üretimi ────────────────────────────────────────────────────

@router.post("/generate-weekly", response_model=WeeklyRoutesOut, status_code=status.HTTP_201_CREATED)
async def generate_weekly_routes(
    payload: GenerateWeeklyRoutesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Temsilcinin portföyündeki tüm marketler için haftalık rota üret.
    - week_start: Pazartesi tarihi
    - Mevcut rotalar varsa önce silinir, yeniden üretilir
    - Nearest Neighbor + coğrafi kümeleme kullanır
    - Başlangıç noktası: Antalya merkez (varsayılan); vardiya başlayınca GPS'e göre yeniden sıralanır
    """
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkiniz yok")

    # Kullanıcıyı doğrula
    user_result = await db.execute(select(User).where(User.id == payload.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    # Pazartesi kontrolü
    week_start = payload.week_start
    if week_start.weekday() != 0:  # 0 = Pazartesi
        raise HTTPException(status_code=400, detail="week_start Pazartesi günü olmalıdır")

    # Portföydeki marketleri çek
    assignment_result = await db.execute(
        select(MarketAssignment).where(MarketAssignment.user_id == payload.user_id)
    )
    assignments = assignment_result.scalars().all()
    if not assignments:
        raise HTTPException(status_code=400, detail="Temsilcinin portföyünde market yok")

    market_ids = [a.market_id for a in assignments]
    mkt_result = await db.execute(
        select(Market).where(Market.id.in_(market_ids))
    )
    all_markets = mkt_result.scalars().all()

    # Koordinatsız marketleri filtrele — ST_X/ST_Y ile koordinat çek
    from geoalchemy2.functions import ST_X, ST_Y
    mkt_coords_result = await db.execute(
        select(
            Market,
            ST_Y(Market.location).label("lat"),
            ST_X(Market.location).label("lng"),
        ).where(Market.id.in_(market_ids))
    )
    markets_with_coords: list[tuple[UUID, float, float]] = []
    for row in mkt_coords_result.all():
        m, lat, lng = row[0], row[1], row[2]
        if lat is not None and lng is not None:
            markets_with_coords.append((m.id, lat, lng))

    if not markets_with_coords:
        raise HTTPException(status_code=400, detail="Portföydeki marketlerin koordinat bilgisi yok")

    # İş günü sayısı (Pazartesi-Cuma = 5)
    work_days = 5
    days_needed = math.ceil(len(markets_with_coords) / payload.markets_per_day)
    total_days = min(max(days_needed, 1), work_days)

    # Coğrafi kümeleme + Nearest Neighbor sıralama
    # Başlangıç noktası: Antalya merkez (vardiya başlayınca güncellenir)
    ANTALYA_LAT, ANTALYA_LNG = 36.8969, 30.7133
    daily_groups = _cluster_by_geography(
        markets_with_coords,
        days=total_days,
        start_lat=ANTALYA_LAT,
        start_lng=ANTALYA_LNG,
    )

    # Haftanın mevcut daily_route kayıtlarını sil (yeniden üret)
    week_dates = [week_start + timedelta(days=i) for i in range(work_days)]
    await db.execute(
        delete(DailyRoute).where(
            DailyRoute.user_id == payload.user_id,
            DailyRoute.date.in_(week_dates),
        )
    )

    # Her gün için DailyRoute + RouteStop oluştur
    created_routes: list[DailyRoute] = []
    for day_idx, group in enumerate(daily_groups):
        if not group:
            continue
        route_date = week_start + timedelta(days=day_idx)
        route = DailyRoute(
            user_id=payload.user_id,
            date=route_date,
            status="planned",
            markets_per_day=payload.markets_per_day,
        )
        db.add(route)
        await db.flush()  # id almak için

        for order_idx, (market_id, _, _) in enumerate(group):
            stop = RouteStop(
                route_id=route.id,
                market_id=market_id,
                order_index=order_idx,
                status="pending",
            )
            db.add(stop)

        await db.flush()
        created_routes.append(route)

    await db.flush()

    # Tam veriyle döndür
    route_outs = []
    for route in created_routes:
        route_out = await _build_route_out(route.id, db)
        route_outs.append(route_out)

    return WeeklyRoutesOut(
        user=UserOut.model_validate(user),
        week_start=week_start,
        routes=route_outs,
        total_markets=len(markets_with_coords),
        total_days=len(route_outs),
    )


# ─── Haftanın rotalarını listele ──────────────────────────────────────────────

@router.get("/weekly/{user_id}", response_model=WeeklyRoutesOut)
async def get_weekly_routes(
    user_id: UUID,
    week_start: date = Query(..., description="Pazartesi tarihi (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Temsilcinin belirli haftasındaki tüm rotaları döndür."""
    if current_user.role == "field_rep" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Yetkiniz yok")

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    week_dates = [week_start + timedelta(days=i) for i in range(5)]
    result = await db.execute(
        select(DailyRoute)
        .where(DailyRoute.user_id == user_id, DailyRoute.date.in_(week_dates))
        .order_by(DailyRoute.date)
    )
    routes = result.scalars().all()

    route_outs = []
    for route in routes:
        route_out = await _build_route_out(route.id, db)
        route_outs.append(route_out)

    total_markets = sum(len(r.stops) for r in route_outs)

    return WeeklyRoutesOut(
        user=UserOut.model_validate(user),
        week_start=week_start,
        routes=route_outs,
        total_markets=total_markets,
        total_days=len(route_outs),
    )


# ─── Bugünün rotası (mobil) ───────────────────────────────────────────────────

@router.get("/today", response_model=DailyRouteOut)
async def get_today_route(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Temsilcinin bugünkü rotasını döndür."""
    today = date.today()
    result = await db.execute(
        select(DailyRoute).where(
            DailyRoute.user_id == current_user.id,
            DailyRoute.date == today,
        )
    )
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Bugün için rota bulunamadı")

    return await _build_route_out(route.id, db)


# ─── GPS'e göre yeniden sırala ───────────────────────────────────────────────

@router.post("/today/reorder", response_model=DailyRouteOut)
async def reorder_today_route(
    payload: ReorderRouteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Temsilcinin anlık GPS konumuna göre bugünkü rotayı yeniden sırala.
    Sadece 'pending' ve 'rolled_over' duraklar sıralanır.
    'visited' ve 'skipped' duraklar başa eklenir (değişmez).
    """
    today = date.today()
    result = await db.execute(
        select(DailyRoute).where(
            DailyRoute.user_id == current_user.id,
            DailyRoute.date == today,
        )
    )
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Bugün için rota bulunamadı")

    # Durakları ve market koordinatlarını çek
    stops_result = await db.execute(
        select(RouteStop).where(RouteStop.route_id == route.id)
    )
    all_stops = stops_result.scalars().all()

    # Tamamlanan duraklar sabit kalır (sıraları korunur)
    done_stops = sorted(
        [s for s in all_stops if s.status in ("visited", "skipped")],
        key=lambda s: s.order_index,
    )
    pending_stops = [s for s in all_stops if s.status in ("pending", "rolled_over")]

    if not pending_stops:
        return await _build_route_out(route.id, db)

    # Bekleyen durakların market koordinatlarını çek
    pending_market_ids = [s.market_id for s in pending_stops]

    # Koordinatlı durakları hazırla — ST_X/ST_Y ile koordinat çek
    from geoalchemy2.functions import ST_X, ST_Y
    coords_result = await db.execute(
        select(
            Market,
            ST_Y(Market.location).label("lat"),
            ST_X(Market.location).label("lng"),
        ).where(Market.id.in_(pending_market_ids))
    )
    coord_map: dict[UUID, tuple[float, float]] = {
        row[0].id: (row[1] or 0.0, row[2] or 0.0)
        for row in coords_result.all()
    }

    pending_with_coords: list[tuple[RouteStop, float, float]] = []
    for stop in pending_stops:
        lat, lng = coord_map.get(stop.market_id, (0.0, 0.0))
        pending_with_coords.append((stop, lat, lng))

    # Nearest Neighbor ile sırala
    coords_only = [(s.market_id, lat, lng) for s, lat, lng in pending_with_coords]
    sorted_coords = _nearest_neighbor_sort(coords_only, payload.current_lat, payload.current_lng)
    sorted_market_ids = [c[0] for c in sorted_coords]

    # Yeni order_index ata
    base_idx = len(done_stops)
    stop_by_market: dict[UUID, RouteStop] = {s.market_id: s for s, _, _ in pending_with_coords}

    for new_idx, market_id in enumerate(sorted_market_ids):
        stop = stop_by_market.get(market_id)
        if stop:
            stop.order_index = base_idx + new_idx

    # Rota durumunu aktif yap
    if route.status == "planned":
        route.status = "active"

    await db.flush()
    return await _build_route_out(route.id, db)


# ─── Durağı atla ─────────────────────────────────────────────────────────────

@router.post("/stops/{stop_id}/skip", response_model=RouteStopOut)
async def skip_stop(
    stop_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bir durağı atla (skipped yap)."""
    result = await db.execute(select(RouteStop).where(RouteStop.id == stop_id))
    stop = result.scalar_one_or_none()
    if not stop:
        raise HTTPException(status_code=404, detail="Durak bulunamadı")

    # Güvenlik: bu durak gerçekten bu kullanıcıya mı ait?
    route_result = await db.execute(
        select(DailyRoute).where(
            DailyRoute.id == stop.route_id,
            DailyRoute.user_id == current_user.id,
        )
    )
    if not route_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bu durağa erişim yetkiniz yok")

    stop.status = "skipped"
    await db.flush()
    await db.refresh(stop)

    # Market bilgisini koordinatlarıyla birlikte çek
    from geoalchemy2.functions import ST_X, ST_Y
    from app.routers.markets import _market_to_out_coords
    mkt_result = await db.execute(
        select(
            Market,
            ST_Y(Market.location).label("lat"),
            ST_X(Market.location).label("lng"),
        ).where(Market.id == stop.market_id)
    )
    mkt_row = mkt_result.one_or_none()
    market_out = None
    if mkt_row:
        market_out = _market_to_out_coords(mkt_row[0], mkt_row[1] or 0.0, mkt_row[2] or 0.0)

    return RouteStopOut(
        id=stop.id,
        route_id=stop.route_id,
        market_id=stop.market_id,
        order_index=stop.order_index,
        status=stop.status,
        rolled_from_date=stop.rolled_from_date,
        visited_at=stop.visited_at,
        market=market_out,
    )


# ─── Tek günün rotasını getir ─────────────────────────────────────────────────

@router.get("/{user_id}/{route_date}", response_model=DailyRouteOut)
async def get_daily_route(
    user_id: UUID,
    route_date: date,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Belirli bir güne ait rotayı döndür."""
    if current_user.role == "field_rep" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Yetkiniz yok")

    result = await db.execute(
        select(DailyRoute).where(
            DailyRoute.user_id == user_id,
            DailyRoute.date == route_date,
        )
    )
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Rota bulunamadı")

    return await _build_route_out(route.id, db)


# ─── Yardımcı: tam rota objesi oluştur ───────────────────────────────────────

async def _build_route_out(route_id: UUID, db: AsyncSession) -> DailyRouteOut:
    """DailyRoute + RouteStop + Market bilgilerini birleştirip DailyRouteOut döndür."""
    from geoalchemy2.functions import ST_X, ST_Y
    from app.routers.markets import _market_to_out_coords

    # Rota + user
    route_result = await db.execute(
        select(DailyRoute)
        .options(selectinload(DailyRoute.user))
        .options(selectinload(DailyRoute.stops))
        .where(DailyRoute.id == route_id)
    )
    route = route_result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Rota bulunamadı")

    # Durağa ait market ID'lerini topla
    stop_map = {s.market_id: s for s in route.stops}
    market_ids = [s.market_id for s in route.stops]

    # Market koordinatlarını SQL'den çek
    market_out_map = {}
    if market_ids:
        mkt_result = await db.execute(
            select(
                Market,
                ST_Y(Market.location).label("lat"),
                ST_X(Market.location).label("lng"),
            ).where(Market.id.in_(market_ids))
        )
        for row in mkt_result.all():
            market_out_map[row[0].id] = _market_to_out_coords(
                row[0], row[1] or 0.0, row[2] or 0.0
            )

    stops_out = []
    for stop in sorted(route.stops, key=lambda s: s.order_index):
        stops_out.append(
            RouteStopOut(
                id=stop.id,
                route_id=stop.route_id,
                market_id=stop.market_id,
                order_index=stop.order_index,
                status=stop.status,
                rolled_from_date=stop.rolled_from_date,
                visited_at=stop.visited_at,
                market=market_out_map.get(stop.market_id),
            )
        )

    user_out = UserOut.model_validate(route.user) if route.user else None

    return DailyRouteOut(
        id=route.id,
        user_id=route.user_id,
        date=route.date,
        status=route.status,
        markets_per_day=route.markets_per_day,
        created_at=route.created_at,
        updated_at=route.updated_at,
        stops=stops_out,
        user=user_out,
    )
