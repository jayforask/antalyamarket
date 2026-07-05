import { apiClient } from "@/lib/api/client";
import type { Market, PaginatedResponse } from "@/types";

export interface MarketSearchParams {
  q?: string;
  type?: string;
  is_verified?: boolean;
  is_corporate?: boolean;
  page?: number;
  page_size?: number;
}

export interface CreateMarketPayload {
  name: string;
  type: string;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
}

export async function searchMarketsApi(
  params: MarketSearchParams
): Promise<PaginatedResponse<Market>> {
  const { data } = await apiClient.get<PaginatedResponse<Market>>(
    "/markets/search",
    { params }
  );
  return data;
}

export async function createMarketApi(
  payload: CreateMarketPayload
): Promise<Market> {
  const { data } = await apiClient.post<Market>("/markets/create", payload);
  return data;
}

export async function updateMarketApi(
  id: string,
  payload: Partial<CreateMarketPayload>
): Promise<Market> {
  const { data } = await apiClient.put<Market>(`/markets/update/${id}`, payload);
  return data;
}

export async function verifyMarketApi(id: string): Promise<Market> {
  const { data } = await apiClient.patch<Market>(`/markets/verify/${id}`);
  return data;
}

export async function getMarketByIdApi(id: string): Promise<Market> {
  const { data } = await apiClient.get<Market>(`/markets/${id}`);
  return data;
}
