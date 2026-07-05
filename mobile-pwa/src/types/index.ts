export type UserRole = "admin" | "manager" | "field_rep";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export type ShiftStatus = "active" | "completed";

export interface Shift {
  id: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  start_location: { lat: number; lng: number };
  end_location?: { lat: number; lng: number };
  status: ShiftStatus;
}

export type MarketType = "market" | "restaurant" | "cafe" | "bakkal" | "other";

export interface Market {
  id: string;
  name: string;
  type: MarketType;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  is_verified: boolean;
}

export interface Visit {
  id: string;
  market_id: string;
  market?: Market;
  timestamp: string;
  photo_url?: string;
  note?: string;
  gps_coords: { lat: number; lng: number };
  is_successful: boolean;
}

export interface OrderProduct {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy?: number;
}
