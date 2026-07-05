import { apiClient } from "./client";
import type { Market, User } from "@/types";

export interface PortfolioOut {
  user: User;
  markets: Market[];
  total: number;
}

export interface MarketAssignmentOut {
  id: string;
  user_id: string;
  market_id: string;
  assigned_at: string;
  assigned_by?: string;
  market?: Market;
}

export async function getPortfolio(userId: string): Promise<PortfolioOut> {
  const { data } = await apiClient.get<PortfolioOut>(`/portfolio/${userId}`);
  return data;
}

export async function assignMarkets(
  userId: string,
  marketIds: string[]
): Promise<MarketAssignmentOut[]> {
  const { data } = await apiClient.post<MarketAssignmentOut[]>("/portfolio/assign", {
    user_id: userId,
    market_ids: marketIds,
  });
  return data;
}

export async function removeMarket(userId: string, marketId: string): Promise<void> {
  await apiClient.delete(`/portfolio/remove/${userId}/${marketId}`);
}

export async function clearPortfolio(userId: string): Promise<void> {
  await apiClient.delete(`/portfolio/clear/${userId}`);
}
