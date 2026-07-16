// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "manager" | "field_rep";
export type UserWorkMode = "hunter" | "farmer" | "hybrid";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  work_mode?: UserWorkMode;
  created_at: string;
  avatar_url?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ─── Market ──────────────────────────────────────────────────────────────────

export type MarketType = "market" | "restaurant" | "cafe" | "bakkal" | "tekel" | "other";
export type MarketSource = "api" | "manual";

export interface Market {
  id: string;
  name: string;
  type: MarketType;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  is_verified: boolean;
  is_corporate: boolean;
  source: MarketSource;
  created_at: string;
}

// ─── Visit ───────────────────────────────────────────────────────────────────

export interface Visit {
  id: string;
  market_id: string;
  market?: Market;
  user_id: string;
  user?: User;
  timestamp: string;
  photo_url?: string;
  note?: string;
  gps_coords: { lat: number; lng: number };
  is_successful: boolean;
}

// ─── Shift ───────────────────────────────────────────────────────────────────

export type ShiftStatus = "active" | "completed" | "cancelled";

export interface Shift {
  id: string;
  user_id: string;
  user?: User;
  start_time: string;
  end_time?: string;
  start_location: { lat: number; lng: number };
  end_location?: { lat: number; lng: number };
  status: ShiftStatus;
}

// ─── Order ───────────────────────────────────────────────────────────────────

export interface OrderProduct {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id: string;
  visit_id: string;
  visit?: Visit;
  product_details: OrderProduct[];
  total_amount: number;
  created_at: string;
}

// ─── Performance ─────────────────────────────────────────────────────────────

export interface PerformanceSummary {
  id: string;
  user_id: string;
  user?: User;
  date: string;
  total_visits: number;
  successful_visits: number;
  total_shift_time: number; // minutes
  efficiency_score: number; // 0-100
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error: string | null;
  status: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ─── Dashboard KPIs ──────────────────────────────────────────────────────────

export interface DashboardStats {
  total_visits_today: number;
  total_visits_change: number; // percentage vs yesterday
  active_reps: number;
  total_orders_today: number;
  total_revenue_today: number;
  avg_efficiency_score: number;
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

// ─── Route Planning ───────────────────────────────────────────────────────────

export type RouteStatus = "draft" | "active" | "completed" | "cancelled";

export interface RouteStop {
  id: string;
  market_id: string;
  market?: Market;
  order_index: number;          // ziyaret sırası
  estimated_arrival?: string;   // ISO string
  actual_arrival?: string;
  status: "pending" | "visited" | "skipped";
  distance_from_prev?: number;  // metre
  duration_from_prev?: number;  // saniye
}

export interface Route {
  id: string;
  user_id: string;
  user?: User;
  date: string;                 // YYYY-MM-DD
  status: RouteStatus;
  stops: RouteStop[];
  total_distance?: number;      // metre
  total_duration?: number;      // saniye
  polyline?: string;            // Google encoded polyline
  created_at: string;
  updated_at: string;
}

export interface RouteOptimizeRequest {
  user_id: string;
  date: string;
  market_ids: string[];
  start_location: { lat: number; lng: number };
}

export interface RepLocation {
  user_id: string;
  user?: User;
  lat: number;
  lng: number;
  timestamp: string;
  accuracy?: number;
}
