from datetime import date, datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.core.database import get_db
from app.models.models import Market, PerformanceSummary, User, Visit, Order
from app.routers.auth import get_current_user
from app.schemas.schemas import PerformanceOut

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily")
async def daily_report(
    report_date: Optional[date] = Query(None, description="Tarih (varsayılan: bugün)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Belirli bir gün için özet istatistikler."""
    target = report_date or date.today()
    day_start = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
    day_end = datetime(target.year, target.month, target.day, 23, 59, 59, tzinfo=timezone.utc)

    # Toplam ziyaret
    total_visits = (
        await db.execute(
            select(func.count(Visit.id)).where(
                and_(Visit.timestamp >= day_start, Visit.timestamp <= day_end)
            )
        )
    ).scalar_one()

    # Başarılı ziyaret
    successful_visits = (
        await db.execute(
            select(func.count(Visit.id)).where(
                and_(
                    Visit.timestamp >= day_start,
                    Visit.timestamp <= day_end,
                    Visit.is_successful == True,  # noqa: E712
                )
            )
        )
    ).scalar_one()

    # Toplam sipariş tutarı
    total_revenue = (
        await db.execute(
            select(func.coalesce(func.sum(Order.total_amount), 0)).join(
                Visit, Order.visit_id == Visit.id
            ).where(
                and_(Visit.timestamp >= day_start, Visit.timestamp <= day_end)
            )
        )
    ).scalar_one()

    # Aktif temsilci sayısı
    active_reps = (
        await db.execute(
            select(func.count(func.distinct(Visit.user_id))).where(
                and_(Visit.timestamp >= day_start, Visit.timestamp <= day_end)
            )
        )
    ).scalar_one()

    # Toplam market sayısı (kurumsal dahil)
    total_markets = (
        await db.execute(select(func.count(Market.id)))
    ).scalar_one()

    # Toplam temsilci sayısı
    total_reps = (
        await db.execute(
            select(func.count(User.id)).where(User.role == "field_rep", User.is_active == True)  # noqa: E712
        )
    ).scalar_one()

    # Toplam sipariş sayısı bugün
    total_orders = (
        await db.execute(
            select(func.count(Order.id)).join(
                Visit, Order.visit_id == Visit.id
            ).where(
                and_(Visit.timestamp >= day_start, Visit.timestamp <= day_end)
            )
        )
    ).scalar_one()

    return {
        "date": target.isoformat(),
        "total_visits": total_visits,
        "successful_visits": successful_visits,
        "success_rate": round(successful_visits / total_visits * 100, 1) if total_visits > 0 else 0,
        "total_revenue": float(total_revenue),
        "active_reps": active_reps,
        "total_markets": total_markets,
        "total_reps": total_reps,
        "total_orders": total_orders,
    }


@router.get("/performance", response_model=List[PerformanceOut])
async def performance_report(
    report_date: Optional[date] = Query(None),
    user_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Temsilci performans özetleri (nightly cron tarafından doldurulan tablo)."""
    query = select(PerformanceSummary)

    if report_date:
        day_start = datetime(report_date.year, report_date.month, report_date.day, tzinfo=timezone.utc)
        query = query.where(PerformanceSummary.date >= day_start)

    if user_id:
        query = query.where(PerformanceSummary.user_id == user_id)

    if current_user.role == "field_rep":
        query = query.where(PerformanceSummary.user_id == current_user.id)

    offset = (page - 1) * page_size
    query = query.order_by(PerformanceSummary.efficiency_score.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/heatmap")
async def heatmap_data(
    days: int = Query(7, ge=1, le=90, description="Son kaç günün verisi"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Harita heatmap için ziyaret koordinatları."""
    from datetime import timedelta
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(Visit.gps_lat, Visit.gps_lng, Visit.is_successful).where(
            and_(
                Visit.timestamp >= since,
                Visit.gps_lat.isnot(None),
                Visit.gps_lng.isnot(None),
            )
        )
    )
    rows = result.all()

    return {
        "points": [
            {"lat": r.gps_lat, "lng": r.gps_lng, "weight": 1.5 if r.is_successful else 0.5}
            for r in rows
        ]
    }
