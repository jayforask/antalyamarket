"""
Portföy yönetimi — temsilcilere market atama/çıkarma/listeleme.
Sadece admin ve manager kullanabilir (atama için).
Field rep kendi portföyünü görebilir.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.database import get_db
from app.models.models import Market, MarketAssignment, User
from app.routers.auth import get_current_user
from app.routers.markets import _market_to_out
from app.schemas.schemas import (
    MarketAssignmentBulkCreate,
    MarketAssignmentOut,
    MarketOut,
    PortfolioOut,
    UserOut,
)

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


def _require_manager(current_user: User) -> None:
    """Admin veya manager değilse 403 fırlat."""
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkiniz yok")


# ─── Portföy görüntüleme ──────────────────────────────────────────────────────

@router.get("/{user_id}", response_model=PortfolioOut)
async def get_portfolio(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Temsilcinin portföyündeki tüm marketleri döndür."""
    # Field rep sadece kendi portföyünü görebilir
    if current_user.role == "field_rep" and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkiniz yok")

    # Kullanıcıyı doğrula
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    # Portföydeki marketleri çek
    result = await db.execute(
        select(MarketAssignment).where(MarketAssignment.user_id == user_id)
    )
    assignments = result.scalars().all()

    # Market detaylarını çek
    market_ids = [a.market_id for a in assignments]
    markets: list[MarketOut] = []
    if market_ids:
        mkt_result = await db.execute(
            select(Market).where(Market.id.in_(market_ids))
        )
        markets = [_market_to_out(m) for m in mkt_result.scalars().all()]

    return PortfolioOut(
        user=UserOut.model_validate(user),
        markets=markets,
        total=len(markets),
    )


# ─── Toplu market atama ───────────────────────────────────────────────────────

@router.post("/assign", response_model=list[MarketAssignmentOut], status_code=status.HTTP_201_CREATED)
async def assign_markets(
    payload: MarketAssignmentBulkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Birden fazla marketi temsilciye ata (mevcut olanları atlar)."""
    _require_manager(current_user)

    # Hedef kullanıcıyı doğrula
    user_result = await db.execute(select(User).where(User.id == payload.user_id))
    if not user_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    # Zaten atanmış olanları bul
    existing_result = await db.execute(
        select(MarketAssignment.market_id).where(
            MarketAssignment.user_id == payload.user_id,
            MarketAssignment.market_id.in_(payload.market_ids),
        )
    )
    existing_ids = {row[0] for row in existing_result.all()}

    # Yeni atamaları ekle
    new_assignments: list[MarketAssignment] = []
    for market_id in payload.market_ids:
        if market_id not in existing_ids:
            assignment = MarketAssignment(
                user_id=payload.user_id,
                market_id=market_id,
                assigned_by=current_user.id,
            )
            db.add(assignment)
            new_assignments.append(assignment)

    await db.flush()
    for a in new_assignments:
        await db.refresh(a)

    return new_assignments


# ─── Tekil market ata ────────────────────────────────────────────────────────

@router.post("/assign/{user_id}/{market_id}", response_model=MarketAssignmentOut, status_code=status.HTTP_201_CREATED)
async def assign_single_market(
    user_id: UUID,
    market_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tek bir marketi temsilciye ata."""
    _require_manager(current_user)

    # Zaten atanmış mı?
    existing = await db.execute(
        select(MarketAssignment).where(
            MarketAssignment.user_id == user_id,
            MarketAssignment.market_id == market_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Bu market zaten bu temsilciye atanmış")

    assignment = MarketAssignment(
        user_id=user_id,
        market_id=market_id,
        assigned_by=current_user.id,
    )
    db.add(assignment)
    await db.flush()
    await db.refresh(assignment)
    return assignment


# ─── Market portföyden çıkar ─────────────────────────────────────────────────

@router.delete("/remove/{user_id}/{market_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_market(
    user_id: UUID,
    market_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marketi temsilcinin portföyünden çıkar."""
    _require_manager(current_user)

    result = await db.execute(
        delete(MarketAssignment).where(
            MarketAssignment.user_id == user_id,
            MarketAssignment.market_id == market_id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Atama bulunamadı")


# ─── Portföyü temizle ────────────────────────────────────────────────────────

@router.delete("/clear/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def clear_portfolio(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Temsilcinin tüm portföyünü sil."""
    _require_manager(current_user)

    await db.execute(
        delete(MarketAssignment).where(MarketAssignment.user_id == user_id)
    )
