import { apiClient } from "./client";
import type { Market, MarketType } from "@/types";

export interface MarketCreatePayload {
  name: string;
  type: MarketType;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  is_corporate?: boolean;
}

export interface PaginatedMarkets {
  items: Market[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function searchMarkets(params?: {
  q?: string;
  type?: MarketType;
  page?: number;
  page_size?: number;
}): Promise<PaginatedMarkets> {
  const { data } = await apiClient.get<PaginatedMarkets>("/markets/search", {
    params: {
      q: params?.q || undefined,
      type: params?.type || undefined,
      page: params?.page ?? 1,
      page_size: params?.page_size ?? 50,
    },
  });
  return data;
}

export async function createMarket(payload: MarketCreatePayload): Promise<Market> {
  const { data } = await apiClient.post<Market>("/markets/create", payload);
  return data;
}
