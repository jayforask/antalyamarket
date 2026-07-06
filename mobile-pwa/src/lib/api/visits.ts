import { apiClient } from "./client";

export interface VisitOut {
  id: string;
  market_id: string;
  user_id: string;
  timestamp: string;
  photo_url?: string | null;
  note?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  is_successful: boolean;
}

export async function startVisit(payload: {
  market_id: string;
  gps_lat: number;
  gps_lng: number;
}): Promise<VisitOut> {
  const { data } = await apiClient.post<VisitOut>("/visits/start", payload);
  return data;
}

export async function submitVisit(payload: {
  visit_id: string;
  is_successful: boolean;
  note?: string;
  photo_url?: string;
}): Promise<VisitOut> {
  const { data } = await apiClient.post<VisitOut>("/visits/submit", payload);
  return data;
}

export async function getPresignedUrl(filename: string): Promise<{ upload_url: string; file_url: string }> {
  const { data } = await apiClient.post<{ upload_url: string; file_url: string }>(
    `/uploads/presigned?filename=${encodeURIComponent(filename)}`
  );
  return data;
}
