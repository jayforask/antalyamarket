import { apiClient } from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketDetail {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  is_verified: boolean;
  is_corporate: boolean;
  source: string;
  created_at: string;
}

export interface VisitDetail {
  id: string;
  market_id: string;
  user_id: string;
  timestamp: string;
  photo_url: string | null;
  note: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  is_successful: boolean;
  market: MarketDetail | null;
}

export interface ShiftDetail {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  status: string;
}

export interface UserDayStats {
  total_duration_minutes: number;
  visit_count: number;
  successful_count: number;
  success_rate: number;
  estimated_km: number;
}

export interface UserDayDetail {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
  };
  date: string;
  shift: ShiftDetail | null;
  visits: VisitDetail[];
  stats: UserDayStats;
}

export interface ShiftDateItem {
  date: string;
  shift_id: string;
  status: string;
  visit_count: number;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getUserDayDetail(
  userId: string,
  date?: string
): Promise<UserDayDetail> {
  const params: Record<string, string> = {};
  if (date) params.date = date;
  const { data } = await apiClient.get<UserDayDetail>(
    `/shifts/user/${userId}/day`,
    { params }
  );
  return data;
}

export async function getUserShiftDates(
  userId: string,
  limit = 30
): Promise<ShiftDateItem[]> {
  const { data } = await apiClient.get<ShiftDateItem[]>(
    `/shifts/user/${userId}/dates`,
    { params: { limit } }
  );
  return data;
}
