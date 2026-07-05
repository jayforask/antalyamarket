import { apiClient } from "./client";
import type { User, Market } from "@/types";

export interface RouteStopApi {
  id: string;
  route_id: string;
  market_id: string;
  order_index: number;
  status: "pending" | "visited" | "skipped" | "rolled_over";
  rolled_from_date?: string;
  visited_at?: string;
  market?: Market;
}

export interface DailyRouteApi {
  id: string;
  user_id: string;
  date: string;
  status: "planned" | "active" | "completed";
  markets_per_day: number;
  created_at: string;
  updated_at: string;
  stops: RouteStopApi[];
  user?: User;
}

export interface WeeklyRoutesApi {
  user: User;
  week_start: string;
  routes: DailyRouteApi[];
  total_markets: number;
  total_days: number;
}

export async function generateWeeklyRoutes(
  userId: string,
  weekStart: string,
  marketsPerDay: number = 20
): Promise<WeeklyRoutesApi> {
  const { data } = await apiClient.post<WeeklyRoutesApi>("/routes/generate-weekly", {
    user_id: userId,
    week_start: weekStart,
    markets_per_day: marketsPerDay,
  });
  return data;
}

export async function getWeeklyRoutes(
  userId: string,
  weekStart: string
): Promise<WeeklyRoutesApi> {
  const { data } = await apiClient.get<WeeklyRoutesApi>(`/routes/weekly/${userId}`, {
    params: { week_start: weekStart },
  });
  return data;
}

export async function getDailyRoute(
  userId: string,
  routeDate: string
): Promise<DailyRouteApi> {
  const { data } = await apiClient.get<DailyRouteApi>(`/routes/${userId}/${routeDate}`);
  return data;
}

/** Yerel tarihi YYYY-MM-DD formatında döndür (UTC değil) */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Haftanın Pazartesi tarihini döndür (YYYY-MM-DD, yerel saat) */
export function getMondayOfWeek(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay(); // 0=Pazar, 1=Pazartesi, ...
  const diff = day === 0 ? -6 : 1 - day; // Pazar=0 özel durum
  date.setDate(date.getDate() + diff);
  return toLocalDateStr(date);
}

export function getWeekDates(mondayStr: string): string[] {
  // mondayStr → yerel tarih olarak parse et (UTC yorumlamasını önle)
  const [y, m, dayNum] = mondayStr.split("-").map(Number);
  const monday = new Date(y, m - 1, dayNum);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return toLocalDateStr(d);
  });
}
