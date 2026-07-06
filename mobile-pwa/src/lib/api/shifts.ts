import { apiClient } from "./client";

export interface ShiftOut {
  id: string;
  user_id: string;
  start_time: string;
  end_time?: string | null;
  start_lat?: number | null;
  start_lng?: number | null;
  current_lat?: number | null;
  current_lng?: number | null;
  location_updated_at?: string | null;
  status: "active" | "completed";
}

export async function startShift(payload: {
  start_lat: number;
  start_lng: number;
}): Promise<ShiftOut> {
  const { data } = await apiClient.post<ShiftOut>("/shifts/start", payload);
  return data;
}

export async function endShift(payload: {
  end_lat: number;
  end_lng: number;
}): Promise<ShiftOut> {
  const { data } = await apiClient.post<ShiftOut>("/shifts/end", payload);
  return data;
}

export async function getActiveShift(): Promise<ShiftOut | null> {
  try {
    const { data } = await apiClient.get<ShiftOut>("/shifts/active");
    return data;
  } catch {
    return null;
  }
}

export async function updateShiftLocation(payload: {
  current_lat: number;
  current_lng: number;
}): Promise<void> {
  await apiClient.patch("/shifts/location", payload);
}
