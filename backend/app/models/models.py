import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, Float,
    ForeignKey, Integer, JSON, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ─── User ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role = Column(
        Enum("admin", "manager", "field_rep", name="user_role"),
        nullable=False,
        default="field_rep",
    )
    name = Column(String(128), nullable=False)
    email = Column(String(256), unique=True, nullable=False, index=True)
    hashed_password = Column(String(256), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    work_mode = Column(String(32), default="hybrid", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    visits = relationship("Visit", back_populates="user", lazy="dynamic")
    shifts = relationship("Shift", back_populates="user", lazy="dynamic")
    performance = relationship("PerformanceSummary", back_populates="user", lazy="dynamic")


# ─── Market ──────────────────────────────────────────────────────────────────

class Market(Base):
    __tablename__ = "markets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(256), nullable=False, index=True)
    type = Column(
        Enum("market", "restaurant", "cafe", "bakkal", "tekel", "other", name="market_type"),
        nullable=False,
        default="other",
    )
    # PostGIS geometry point (SRID 4326 = WGS84 lat/lng)
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=True)
    address = Column(Text, nullable=False)
    phone = Column(String(32), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_corporate = Column(Boolean, default=False, nullable=False)
    source = Column(
        Enum("api", "manual", name="market_source"),
        nullable=False,
        default="manual",
    )
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    visits = relationship("Visit", back_populates="market", lazy="dynamic")


# ─── Visit ───────────────────────────────────────────────────────────────────

class Visit(Base):
    __tablename__ = "visits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    market_id = Column(UUID(as_uuid=True), ForeignKey("markets.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    photo_url = Column(String(512), nullable=True)
    note = Column(Text, nullable=True)
    # GPS koordinatları JSON olarak sakla — geofencing zaten backend'de yapıldı
    gps_lat = Column(Float, nullable=True)
    gps_lng = Column(Float, nullable=True)
    is_successful = Column(Boolean, default=True, nullable=False)

    market = relationship("Market", back_populates="visits")
    user = relationship("User", back_populates="visits")
    orders = relationship("Order", back_populates="visit", lazy="dynamic")


# ─── Shift ───────────────────────────────────────────────────────────────────

class Shift(Base):
    __tablename__ = "shifts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    start_time = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    start_lat = Column(Float, nullable=True)
    start_lng = Column(Float, nullable=True)
    end_lat = Column(Float, nullable=True)
    end_lng = Column(Float, nullable=True)
    # Anlık GPS konumu — mobil uygulama periyodik olarak günceller
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    location_updated_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(
        Enum("active", "completed", "cancelled", name="shift_status"),
        nullable=False,
        default="active",
    )

    user = relationship("User", back_populates="shifts")


# ─── Order ───────────────────────────────────────────────────────────────────

class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=False)
    # Ürün detayları JSON array: [{product_id, name, quantity, unit_price}]
    product_details = Column(JSON, nullable=False, default=list)
    total_amount = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    visit = relationship("Visit", back_populates="orders")


# ─── Performance Summary ─────────────────────────────────────────────────────

class PerformanceSummary(Base):
    __tablename__ = "performance_summary"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    total_visits = Column(Integer, default=0, nullable=False)
    successful_visits = Column(Integer, default=0, nullable=False)
    total_shift_time = Column(Integer, default=0, nullable=False)  # minutes
    efficiency_score = Column(Float, default=0.0, nullable=False)

    user = relationship("User", back_populates="performance")


# ─── Market Assignment (Portföy) ─────────────────────────────────────────────

class MarketAssignment(Base):
    """Temsilciye atanmış marketler — portföy tanımı."""
    __tablename__ = "market_assignments"
    __table_args__ = (
        UniqueConstraint("user_id", "market_id", name="uq_user_market"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    market_id = Column(UUID(as_uuid=True), ForeignKey("markets.id"), nullable=False, index=True)
    assigned_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    user = relationship("User", foreign_keys=[user_id], backref="assignments")
    market = relationship("Market", backref="assignments")
    assigner = relationship("User", foreign_keys=[assigned_by])


# ─── Daily Route ─────────────────────────────────────────────────────────────

class DailyRoute(Base):
    """Temsilcinin belirli bir güne ait rota başlığı."""
    __tablename__ = "daily_routes"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_date_route"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    status = Column(
        Enum("planned", "active", "completed", name="route_status"),
        nullable=False,
        default="planned",
    )
    markets_per_day = Column(Integer, default=20, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    stops = relationship(
        "RouteStop",
        back_populates="route",
        order_by="RouteStop.order_index",
        cascade="all, delete-orphan",
    )


# ─── Route Stop ──────────────────────────────────────────────────────────────

class RouteStop(Base):
    """Rota içindeki tek bir market durağı."""
    __tablename__ = "route_stops"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id = Column(UUID(as_uuid=True), ForeignKey("daily_routes.id", ondelete="CASCADE"), nullable=False, index=True)
    market_id = Column(UUID(as_uuid=True), ForeignKey("markets.id"), nullable=False)
    order_index = Column(Integer, nullable=False)
    status = Column(
        Enum("pending", "visited", "skipped", "rolled_over", name="stop_status"),
        nullable=False,
        default="pending",
    )
    rolled_from_date = Column(Date, nullable=True)   # hangi günden kaydığı
    visited_at = Column(DateTime(timezone=True), nullable=True)
    rollover_count = Column(Integer, default=0, nullable=False)

    route = relationship("DailyRoute", back_populates="stops")
    market = relationship("Market")
