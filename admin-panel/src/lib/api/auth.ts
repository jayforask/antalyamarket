import { apiClient } from "@/lib/api/client";
import type { AuthTokens, LoginCredentials, User } from "@/types";

export async function loginApi(credentials: LoginCredentials): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>("/auth/login", credentials);
  return data;
}

export async function logoutApi(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function getMeApi(): Promise<User> {
  const { data } = await apiClient.get<User>("/auth/me");
  return data;
}

export async function refreshTokenApi(refreshToken: string): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>("/auth/refresh-token", {
    refresh_token: refreshToken,
  });
  return data;
}
