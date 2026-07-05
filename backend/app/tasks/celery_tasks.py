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
    2. Bir sonraki iş gününün rotasına başına ekle
    3. Eğer ertesi gün rotası yoksa oluştur (rolled_over durakları içerecek şekilde)
    4. Limit aşılırsa fazla duraklar ertesi ertesi güne aktarılır
    """
    from app.models.models import DailyRoute, RouteStop

    try:
        today = (
            datetime.strptime(target_date_str, "%Y-%m-%d").date()
            if target_date_str
            else datetime.now(timezone.utc).date()
        )

        # Bir sonraki iş günü (Cumartesi → Pazartesi, Pazar → Pazartesi)
        next_day = today + timedelta(days=1)
        while next_day.weekday() >= 5:  # 5=Cumartesi, 6=Pazar
            next_day += timedelta(days=1)

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
            stops_by_user: dict = {}
            for stop in unvisited_stops:
                # Rotanın kullanıcısını bul
                route_result = db.execute(
                    select(DailyRoute).where(DailyRoute.id == stop.route_id)
                )
                route = route_result.scalar_one_or_none()
                if not route:
                    continue
                stops_by_user.setdefault(route.user_id, []).append(stop)

            total_rolled = 0

            for user_id, stops in stops_by_user.items():
                # Ertesi günün rotasını bul veya oluştur
                next_route_result = db.execute(
                    select(DailyRoute).where(
                        DailyRoute.user_id == user_id,
                        DailyRoute.date == next_day,
                    )
                )
                next_route = next_route_result.scalar_one_or_none()

                if not next_route:
                    # Ertesi gün rotası yoksa oluştur
                    next_route = DailyRoute(
                        user_id=user_id,
                        date=next_day,
                        status="planned",
                        markets_per_day=20,
                    )
                    db.add(next_route)
                    db.flush()

                # Ertesi günün mevcut durak sayısını al
                existing_count_result = db.execute(
                    select(func.count(RouteStop.id)).where(
                        RouteStop.route_id == next_route.id
                    )
                )
                existing_count = existing_count_result.scalar_one()

                # Mevcut durakların order_index'ini kaydır (yeni duraklar başa gelecek)
                existing_stops_result = db.execute(
                    select(RouteStop).where(
                        RouteStop.route_id == next_route.id,
                        RouteStop.status.in_(["pending", "rolled_over"]),
                    )
                )
                existing_stops = existing_stops_result.scalars().all()

                rolled_count = len(stops)

                # Mevcut pending durakları kaydır
                for es in existing_stops:
                    es.order_index += rolled_count

                # Kaydırılan durakları ertesi güne taşı (yeni RouteStop olarak)
                for idx, stop in enumerate(stops):
                    new_stop = RouteStop(
                        route_id=next_route.id,
                        market_id=stop.market_id,
                        order_index=idx,
                        status="rolled_over",
                        rolled_from_date=today,
                    )
                    db.add(new_stop)
                    # Eski durağı rolled_over olarak işaretle
                    stop.status = "rolled_over"

                total_rolled += rolled_count

            db.commit()

        return {
            "status": "ok",
            "date": str(today),
            "next_day": str(next_day),
            "rolled_over": total_rolled,
        }

    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)
