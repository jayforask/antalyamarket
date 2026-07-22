from datetime import datetime, timedelta, timezone, date
from math import floor

from celery import Celery
from celery.schedules import crontab
from sqlalchemy import create_engine, select, func, and_
from sqlalchemy.orm import Session

from app.core.config import settings

# Celery uygulaması — sync engine kullanır (Celery async desteklemez)
celery_app = Celery(
    "sfa_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Istanbul",
    enable_utc=True,
)

# Periyodik görev planlaması
celery_app.conf.beat_schedule = {
    "calculate-daily-kpi": {
        "task": "app.tasks.celery_tasks.calculate_daily_kpi",
        "schedule": crontab(hour=23, minute=55),  # Her gece 23:55'te çalışır
    },
    "rollover-unvisited-stops": {
        "task": "app.tasks.celery_tasks.rollover_unvisited_stops",
        "schedule": crontab(hour=23, minute=50),  # Her gece 23:50'de çalışır
    },
}

# Sync engine (Celery için)
sync_engine = create_engine(
    settings.DATABASE_URL.replace("+asyncpg", "+psycopg2"),
    pool_pre_ping=True,
)


@celery_app.task(name="app.tasks.celery_tasks.calculate_daily_kpi", bind=True, max_retries=3)
def calculate_daily_kpi(self, target_date_str: str = None):
    """
    Her temsilci için günlük KPI metriklerini hesapla ve performance_summary tablosuna yaz.
    Varsayılan: bugünün tarihi. Geçmiş tarihler için parametre gönderilebilir.
    """
    # Modelleri burada import et — circular import önlemek için
    from app.models.models import Visit, Shift, PerformanceSummary, User

    try:
        target = (
            datetime.fromisoformat(target_date_str)
            if target_date_str
            else datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        )
        day_end = target.replace(hour=23, minute=59, second=59)

        with Session(sync_engine) as db:
            # Bugün ziyaret yapan tüm field_rep'leri bul
            reps_result = db.execute(
                select(func.distinct(Visit.user_id)).where(
                    and_(Visit.timestamp >= target, Visit.timestamp <= day_end)
                )
            )
            rep_ids = [r[0] for r in reps_result]

            for user_id in rep_ids:
                # Toplam ve başarılı ziyaret sayısı
                total_visits = db.execute(
                    select(func.count(Visit.id)).where(
                        and_(
                            Visit.user_id == user_id,
                            Visit.timestamp >= target,
                            Visit.timestamp <= day_end,
                        )
                    )
                ).scalar_one()

                successful_visits = db.execute(
                    select(func.count(Visit.id)).where(
                        and_(
                            Visit.user_id == user_id,
                            Visit.timestamp >= target,
                            Visit.timestamp <= day_end,
                            Visit.is_successful == True,  # noqa: E712
                        )
                    )
                ).scalar_one()

                # Toplam mesai süresi (dakika)
                shift_result = db.execute(
                    select(Shift).where(
                        and_(
                            Shift.user_id == user_id,
                            Shift.start_time >= target,
                            Shift.start_time <= day_end,
                            Shift.status == "completed",
                        )
                    )
                )
                shifts = shift_result.scalars().all()
                total_shift_minutes = sum(
                    floor((s.end_time - s.start_time).total_seconds() / 60)
                    for s in shifts
                    if s.end_time
                )

                # Verimlilik skoru:
                # %60 başarı oranı + %25 ziyaret yoğunluğu (hedef 20/gün) + %15 mesai
                success_rate = (successful_visits / total_visits) if total_visits > 0 else 0
                visit_intensity = min(total_visits / 20.0, 1.0)  # 20 ziyaret = tam puan
                shift_score = min(total_shift_minutes / 480.0, 1.0)  # 8 saat = tam puan
                efficiency = round(
                    (success_rate * 0.60 + visit_intensity * 0.25 + shift_score * 0.15) * 100, 1
                )

                # Mevcut kaydı güncelle veya yeni oluştur
                existing = db.execute(
                    select(PerformanceSummary).where(
                        and_(
                            PerformanceSummary.user_id == user_id,
                            PerformanceSummary.date >= target,
                            PerformanceSummary.date <= day_end,
                        )
                    )
                ).scalar_one_or_none()

                if existing:
                    existing.total_visits = total_visits
                    existing.successful_visits = successful_visits
                    existing.total_shift_time = total_shift_minutes
                    existing.efficiency_score = efficiency
                else:
                    perf = PerformanceSummary(
                        user_id=user_id,
                        date=target,
                        total_visits=total_visits,
                        successful_visits=successful_visits,
                        total_shift_time=total_shift_minutes,
                        efficiency_score=efficiency,
                    )
                    db.add(perf)

            db.commit()

        return {"status": "ok", "date": target.date().isoformat(), "reps_processed": len(rep_ids)}

    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)  # 5 dakika sonra tekrar dene


@celery_app.task(name="app.tasks.celery_tasks.rollover_unvisited_stops", bind=True, max_retries=3)
def rollover_unvisited_stops(self, target_date_str: str = None):
    """
    Her gece çalışır:
    1. O günün tamamlanmamış (pending/skipped) duraklarını tespit et
    2. Bir sonraki iş gününün rotasına ekle
    3. Rota başına maksimum limit (DAILY_CAP = 25) uygula, aşanları sonraki günlere kaydır
    4. Rotaları coğrafi olarak yeniden sırala (re-optimize)
    5. Sarkma sayacını (rollover_count) artır
    """
    from app.models.models import DailyRoute, RouteStop, Market
    from geoalchemy2.functions import ST_X, ST_Y
    from app.routers.routes import _nearest_neighbor_sort, _osrm_sort_route

    def get_next_workday(current_date):
        next_day = current_date + timedelta(days=1)
        while next_day.weekday() >= 5:  # 5 = Cumartesi, 6 = Pazar
            next_day += timedelta(days=1)
        return next_day

    def get_or_create_route(db_session, u_id, r_date):
        route_res = db_session.execute(
            select(DailyRoute).where(
                DailyRoute.user_id == u_id,
                DailyRoute.date == r_date,
            )
        )
        r = route_res.scalar_one_or_none()
        if not r:
            r = DailyRoute(
                user_id=u_id,
                date=r_date,
                status="planned",
                markets_per_day=20,
            )
            db_session.add(r)
            db_session.flush()
        return r

    try:
        today = (
            datetime.strptime(target_date_str, "%Y-%m-%d").date()
            if target_date_str
            else datetime.now(timezone.utc).date()
        )

        next_day = get_next_workday(today)

        with Session(sync_engine) as db:
            # Bugün tamamlanmamış tüm durakları bul
            unvisited_result = db.execute(
                select(RouteStop)
                .join(DailyRoute, RouteStop.route_id == DailyRoute.id)
                .where(
                    DailyRoute.date == today,
                    RouteStop.status.in_(["pending", "skipped"]),
                )
                .order_by(DailyRoute.user_id, RouteStop.order_index)
            )
            unvisited_stops = unvisited_result.scalars().all()

            if not unvisited_stops:
                return {"status": "ok", "date": str(today), "rolled_over": 0}

            # Kullanıcı bazlı grupla
            stops_by_user = {}
            for stop in unvisited_stops:
                route_result = db.execute(
                    select(DailyRoute).where(DailyRoute.id == stop.route_id)
                )
                route = route_result.scalar_one_or_none()
                if not route:
                    continue
                stops_by_user.setdefault(route.user_id, []).append(stop)

            total_rolled = 0
            DAILY_CAP = 25

            for user_id, user_leftovers in stops_by_user.items():
                # 1. Yarının rotasını al veya oluştur
                next_route = get_or_create_route(db, user_id, next_day)

                # 2. Yarının mevcut duraklarını (pending/rolled_over) çek
                existing_stops_result = db.execute(
                    select(RouteStop).where(
                        RouteStop.route_id == next_route.id,
                        RouteStop.status.in_(["pending", "rolled_over"]),
                    )
                )
                existing_stops = existing_stops_result.scalars().all()

                # 3. Bugünün sarkan duraklarını yeni nesne olarak hazırla (mükerrer olmasın)
                new_stops = []
                existing_market_ids = {s.market_id for s in existing_stops}
                for stop in user_leftovers:
                    stop.status = "rolled_over"  # Bugününkini güncelliyoruz
                    
                    # Eğer yarının rotasında bu market zaten varsa, mükerrer durak ekleme!
                    # Bunun yerine yarındaki mevcut durağın rollover sayacını güncelleyebiliriz.
                    if stop.market_id in existing_market_ids:
                        for es in existing_stops:
                            if es.market_id == stop.market_id:
                                es.status = "rolled_over"
                                es.rolled_from_date = today
                                es.rollover_count = max(es.rollover_count or 0, (stop.rollover_count or 0) + 1)
                                break
                    else:
                        new_stop = RouteStop(
                            route_id=next_route.id,
                            market_id=stop.market_id,
                            status="rolled_over",
                            rolled_from_date=today,
                            rollover_count=(stop.rollover_count or 0) + 1,
                        )
                        new_stops.append(new_stop)
                        existing_market_ids.add(stop.market_id)

                # Tüm adayları birleştir (öncelik sarkanlarda)
                all_candidates = new_stops + existing_stops

                stops_to_keep = all_candidates[:DAILY_CAP]
                stops_to_push = all_candidates[DAILY_CAP:]

                # 4. Limiti aşan durakları bir sonraki güne (next_day + 1 iş günü) ötele
                if stops_to_push:
                    day_after = get_next_workday(next_day)
                    day_after_route = get_or_create_route(db, user_id, day_after)

                    for s in stops_to_push:
                        # Eğer veritabanında zaten kayıtlı bir durak ise sadece route_id'sini ve rollover değerini güncelle
                        if s.id is not None:
                            s.route_id = day_after_route.id
                            s.status = "rolled_over"
                            s.rolled_from_date = today
                            s.rollover_count = (s.rollover_count or 0) + 1
                        else:
                            # Sarkanlar arasından buraya sarkan varsa yeni nesneyi ekle
                            s.route_id = day_after_route.id
                            db.add(s)

                # 5. Yarın için tutulacak durakları ekle ve coğrafi sırala
                for s in stops_to_keep:
                    if s.id is None:
                        db.add(s)

                # Coğrafi sıralama
                market_ids = [s.market_id for s in stops_to_keep]
                if market_ids:
                    mkt_coords = db.execute(
                        select(
                            Market,
                            ST_Y(Market.location).label("lat"),
                            ST_X(Market.location).label("lng"),
                        ).where(Market.id.in_(market_ids))
                    ).all()

                    coords_map = {}
                    for row in mkt_coords:
                        m, lat, lng = row[0], row[1], row[2]
                        if lat is not None and lng is not None:
                            coords_map[m.id] = (lat, lng)

                    sort_input = []
                    for s in stops_to_keep:
                        lat, lng = coords_map.get(s.market_id, (36.8969, 30.7133))
                        sort_input.append((s.market_id, lat, lng))

                    ANTALYA_LAT, ANTALYA_LNG = 36.8969, 30.7133
                    sorted_tuples = _osrm_sort_route(sort_input, ANTALYA_LAT, ANTALYA_LNG)
                    sorted_ids = [t[0] for t in sorted_tuples]

                    for s in stops_to_keep:
                        if s.market_id in sorted_ids:
                            s.order_index = sorted_ids.index(s.market_id)
                        else:
                            s.order_index = 999

                total_rolled += len(new_stops)

            db.commit()

        return {
            "status": "ok",
            "date": str(today),
            "next_day": str(next_day),
            "rolled_over": total_rolled,
        }

    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)
