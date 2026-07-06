"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User, Mail, Shield, BarChart2, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/lib/api/client";
import type { VisitOut } from "@/lib/api/visits";

const ROLE_LABELS: Record<string, string> = {
  admin: "Yönetici",
  manager: "Müdür",
  field_rep: "Saha Temsilcisi",
};

interface DaySummary {
  visitCount: number;
  successCount: number;
  successRate: number;
}

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Bugünkü ziyaret özetini çek
  useEffect(() => {
    async function load() {
      setSummaryLoading(true);
      try {
        const { data } = await apiClient.get<VisitOut[]>("/operations/visits", {
          params: { page: 1, page_size: 100 },
        });
        const visits = Array.isArray(data) ? data : [];
        const today = new Date().toDateString();
        const todayVisits = visits.filter(
          (v) => new Date(v.timestamp).toDateString() === today
        );
        const successCount = todayVisits.filter((v) => v.is_successful).length;
        const visitCount = todayVisits.length;
        setSummary({
          visitCount,
          successCount,
          successRate:
            visitCount > 0 ? Math.round((successCount / visitCount) * 100) : 0,
        });
      } catch {
        setSummary({ visitCount: 0, successCount: 0, successRate: 0 });
      } finally {
        setSummaryLoading(false);
      }
    }
    load();
  }, []);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      {/* Avatar + isim */}
      <div className="flex flex-col items-center text-center gap-3 pb-2">
        <div
          className="w-20 h-20 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-3xl font-bold shadow-lg"
          aria-hidden="true"
        >
          {user?.name?.charAt(0)?.toUpperCase() ?? "T"}
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            {user?.name ?? "Temsilci"}
          </h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
            {user?.role ? ROLE_LABELS[user.role] ?? user.role : "Saha Temsilcisi"}
          </span>
        </div>
      </div>

      {/* Hesap bilgileri */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <User
            className="w-5 h-5 text-[var(--muted-foreground)] shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Ad Soyad</p>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {user?.name ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Mail
            className="w-5 h-5 text-[var(--muted-foreground)] shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">E-posta</p>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {user?.email ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Shield
            className="w-5 h-5 text-[var(--muted-foreground)] shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Rol</p>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {user?.role ? ROLE_LABELS[user.role] ?? user.role : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Bugünkü özet */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2
            className="w-4 h-4 text-[var(--muted-foreground)]"
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Bugünkü Özet
          </h2>
        </div>

        {summaryLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {summary?.visitCount ?? 0}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">Ziyaret</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {summary?.successCount ?? 0}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">Başarılı</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--primary)]">
                %{summary?.successRate ?? 0}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">Skor</p>
            </div>
          </div>
        )}
      </div>

      {/* Çıkış */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-200 bg-red-50 text-red-600 font-semibold text-sm active:scale-[0.98] transition-transform"
      >
        <LogOut className="w-4 h-4" aria-hidden="true" />
        Çıkış Yap
      </button>
    </div>
  );
}
