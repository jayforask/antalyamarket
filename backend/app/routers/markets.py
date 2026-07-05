import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID

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
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Market)

    if q:
        query = query.where(
            or_(
                Market.name.ilike(f"%{q}%"),
                Market.address.ilike(f"%{q}%"),
            )
        )
    if type:
        query = query.where(Market.type == type)
    if is_verified is not None:
        query = query.where(Market.is_verified == is_verified)
    if is_corporate is not None:
        query = query.where(Market.is_corporate == is_corporate)

    # Toplam sayı
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Sayfalama
    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    markets = result.scalars().all()

    # location geometry'den lat/lng çek
    items = []
    for m in markets:
        items.append(_market_to_out(m))

    return PaginatedMarkets(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size),
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
    await db.refresh(market)
    return _market_to_out(market)


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
    await db.refresh(market)
    return _market_to_out(market)


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
    await db.refresh(market)
    return _market_to_out(market)


@router.get("/{market_id}", response_model=MarketOut)
async def get_market(
    market_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Market bulunamadı")
    return _market_to_out(market)


def _market_to_out(market: Market) -> MarketOut:
    """Market modelini MarketOut schema'ya çevir — location geometry'yi lat/lng'e dönüştür."""
    # location None ise koordinat 0 olarak döner, migration sonrası düzelir
    lat, lng = 0.0, 0.0
    if market.location is not None:
        from geoalchemy2.shape import to_shape
        point = to_shape(market.location)
        lat = point.y
        lng = point.x

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
