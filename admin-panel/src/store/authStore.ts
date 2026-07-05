import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import { loginApi, logoutApi, getMeApi } from "@/lib/api/auth";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });

        // ─── Demo / geliştirme girişi ─────────────────────────────────────
        if (email === "admin@admin.com" && password === "123456") {
          const adminUser: User = {
            id: "admin-1",
            name: "Admin",
            email: "admin@admin.com",
            role: "admin",
            created_at: new Date().toISOString(),
          };
          const token = "demo-token";
          localStorage.setItem("access_token", token);
          localStorage.setItem("refresh_token", "demo-refresh");
          // Middleware cookie üzerinden kontrol ediyor — cookie'ye de yaz
          document.cookie = `access_token=${token}; path=/; max-age=86400; SameSite=Lax`;
          set({ user: adminUser, isAuthenticated: true, isLoading: false });
          return true;
        }
        // ─────────────────────────────────────────────────────────────────

        try {
          const tokens = await loginApi({ email, password });
          localStorage.setItem("access_token", tokens.access_token);
          localStorage.setItem("refresh_token", tokens.refresh_token);
          document.cookie = `access_token=${tokens.access_token}; path=/; max-age=86400; SameSite=Lax`;

          const user = await getMeApi();
          set({ user, isAuthenticated: true, isLoading: false });
          return true;
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Giriş başarısız";
          set({ error: message, isLoading: false });
          return false;
        }
      },

      logout: async () => {
        try {
          await logoutApi();
        } catch {
          // token geçersiz olsa bile yerel temizlik yap
        } finally {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          // Cookie'yi de temizle
          document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
          set({ user: null, isAuthenticated: false, error: null });
        }
      },

      fetchMe: async () => {
        set({ isLoading: true });
        try {
          const user = await getMeApi();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-store",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
