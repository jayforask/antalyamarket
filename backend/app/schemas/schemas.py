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

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "field_rep"  # admin | manager | field_rep
    work_mode: str = "hybrid"  # hunter | farmer | hybrid


class UserOut(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    role: str
    is_active: bool
    work_mode: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    work_mode: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserListOut(BaseModel):
    users: List["UserOut"]
    total: int


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
    market: Optional["MarketOut"] = None

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


class ShiftLocationUpdate(BaseModel):
    current_lat: float
    current_lng: float


class ShiftOut(BaseModel):
    id: UUID
    user_id: UUID
    start_time: datetime
    end_time: Optional[datetime] = None
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    location_updated_at: Optional[datetime] = None
    status: str

    model_config = {"from_attributes": True}


# ─── User Day Detail ─────────────────────────────────────────────────────────

class UserDayStats(BaseModel):
    total_duration_minutes: int
    visit_count: int
    successful_count: int
    success_rate: float
    estimated_km: float


class UserDayDetailOut(BaseModel):
    user: "UserOut"
    date: date
    shift: Optional[ShiftOut] = None
    visits: List["VisitOut"] = []
    stats: UserDayStats

    model_config = {"from_attributes": True}


class ShiftDateItem(BaseModel):
    date: date
    shift_id: UUID
    status: str
    visit_count: int


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
    rollover_count: int = 0
    market: Optional[MarketOut] = None
    distance_from_prev: Optional[float] = None
    duration_from_prev: Optional[float] = None

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
    total_distance: Optional[float] = None
    total_duration: Optional[float] = None
    polyline: Optional[str] = None

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


class CoordinatePair(BaseModel):
    latitude: float
    longitude: float


class MarketAssignmentPolygonCreate(BaseModel):
    user_id: UUID
    polygon_coords: List[CoordinatePair]
