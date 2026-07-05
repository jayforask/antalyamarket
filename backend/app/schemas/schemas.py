from datetime import date, datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, EmailStr


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ─── User ────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Market ──────────────────────────────────────────────────────────────────

class MarketCreate(BaseModel):
    name: str
    type: str
    address: str
    phone: Optional[str] = None
    latitude: float
    longitude: float
    is_corporate: bool = False


class MarketUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_corporate: Optional[bool] = None


class MarketOut(BaseModel):
    id: UUID
    name: str
    type: str
    address: str
    phone: Optional[str] = None
    latitude: float
    longitude: float
    is_verified: bool
    is_corporate: bool
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedMarkets(BaseModel):
    items: List[MarketOut]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── Visit ───────────────────────────────────────────────────────────────────

class VisitStart(BaseModel):
    market_id: UUID
    gps_lat: float
    gps_lng: float


class VisitSubmit(BaseModel):
    visit_id: UUID
    is_successful: bool
    note: Optional[str] = None
    photo_url: Optional[str] = None


class VisitOut(BaseModel):
    id: UUID
    market_id: UUID
    user_id: UUID
    timestamp: datetime
    photo_url: Optional[str] = None
    note: Optional[str] = None
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    is_successful: bool

    model_config = {"from_attributes": True}


# ─── Order ───────────────────────────────────────────────────────────────────

class OrderProduct(BaseModel):
    product_id: str
    name: str
    quantity: int
    unit_price: float


class OrderCreate(BaseModel):
    visit_id: UUID
    product_details: List[OrderProduct]


class OrderOut(BaseModel):
    id: UUID
    visit_id: UUID
    product_details: List[OrderProduct]
    total_amount: float
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Shift ───────────────────────────────────────────────────────────────────

class ShiftStart(BaseModel):
    start_lat: float
    start_lng: float


class ShiftEnd(BaseModel):
    end_lat: float
    end_lng: float


class ShiftOut(BaseModel):
    id: UUID
    user_id: UUID
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str

    model_config = {"from_attributes": True}


# ─── Reports ─────────────────────────────────────────────────────────────────

class PerformanceOut(BaseModel):
    id: UUID
    user_id: UUID
    date: datetime
    total_visits: int
    successful_visits: int
    total_shift_time: int
    efficiency_score: float
    user: Optional[UserOut] = None

    model_config = {"from_attributes": True}


# ─── S3 Upload ───────────────────────────────────────────────────────────────

class PresignedUrlResponse(BaseModel):
    upload_url: str
    file_url: str


# ─── Market Assignment (Portföy) ─────────────────────────────────────────────

class MarketAssignmentCreate(BaseModel):
    user_id: UUID
    market_id: UUID


class MarketAssignmentBulkCreate(BaseModel):
    user_id: UUID
    market_ids: List[UUID]


class MarketAssignmentOut(BaseModel):
    id: UUID
    user_id: UUID
    market_id: UUID
    assigned_at: datetime
    assigned_by: Optional[UUID] = None
    market: Optional[MarketOut] = None

    model_config = {"from_attributes": True}


class PortfolioOut(BaseModel):
    user: UserOut
    markets: List[MarketOut]
    total: int


# ─── Daily Route ─────────────────────────────────────────────────────────────

class RouteStopOut(BaseModel):
    id: UUID
    route_id: UUID
    market_id: UUID
    order_index: int
    status: str
    rolled_from_date: Optional[date] = None
    visited_at: Optional[datetime] = None
    market: Optional[MarketOut] = None

    model_config = {"from_attributes": True}


class DailyRouteOut(BaseModel):
    id: UUID
    user_id: UUID
    date: date
    status: str
    markets_per_day: int
    created_at: datetime
    updated_at: datetime
    stops: List[RouteStopOut] = []
    user: Optional[UserOut] = None

    model_config = {"from_attributes": True}


class GenerateWeeklyRoutesRequest(BaseModel):
    user_id: UUID
    week_start: date          # Pazartesi tarihi (YYYY-MM-DD)
    markets_per_day: int = 20


class ReorderRouteRequest(BaseModel):
    current_lat: float
    current_lng: float


class WeeklyRoutesOut(BaseModel):
    user: UserOut
    week_start: date
    routes: List[DailyRouteOut]
    total_markets: int
    total_days: int
