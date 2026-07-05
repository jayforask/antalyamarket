"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Users, Store, MapPin, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api/client";

interface StatCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "amber" | "purple";
  loading?: boolean;
}

const colorMap = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  purple: "bg-purple-50 text-purple-600",
};

function StatCard({ title, value, change, icon, color, loading }: StatCardProps) {
  const isPositive = change >= 0;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn("p-3 rounded-xl shrink-0", colorMap[color])}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--muted-foreground)] font-medium truncate">
          {title}
        </p>
        {loading ? (
          <div className="h-8 w-20 bg-[var(--muted)] rounded animate-pulse mt-0.5" />
        ) : (
          <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5 leading-tight">
            {value}
          </p>
        )}
        <div className="flex items-center gap-1 mt-1">
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              isPositive ? "text-emerald-600" : "text-red-600"
            )}
          >
            {isPositive ? "+" : ""}
            {change}% dünden
          </span>
        </div>
      </div>
    </div>
  );
}

interface DailyReport {
  date: string;
  total_visits: number;
  successful_visits: number;
  success_rate: number;
  total_revenue: number;
  active_reps: number;
  total_markets: number;
  total_reps: number;
  total_orders: number;
}

interface TopRep {
  user_id: string;
  user_name: string;
  visits: number;
  efficiency_score: number;
}

interface RecentVisit {
  market_name: string;
  timestamp: string;
  is_successful: boolean;
}

export default function DashboardPage() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [topReps, setTopReps] = useState<TopRep[]>([]);
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [dailyRes, perfRes, visitsRes] = await Promise.allSettled([
          apiClient.get<DailyReport>("/reports/daily"),
          apiClient.get<TopRep[]>("/reports/performance?page_size=5"),
          apiClient.get<{ visits: RecentVisit[] }>("/operations/visits?page_size=5"),
        ]);

        if (dailyRes.status === "fulfilled") {
          setReport(dailyRes.value.data);
        }
        if (perfRes.status === "fulfilled") {
          const data = perfRes.value.data;
          setTopReps(Array.isArray(data) ? data : []);
        }
        if (visitsRes.status === "fulfilled") {
          const data = visitsRes.value.data;
          setRecentVisits(Array.isArray(data) ? data : (data?.visits ?? []));
        }
      } catch {
        // sessiz hata — veriler yüklenemedi
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stats = [
    {
      title: "Bugünkü Ziyaretler",
      value: report ? String(report.total_visits) : "0",
      change: 0,
      icon: <MapPin className="w-5 h-5" />,
      color: "blue" as const,
    },
    {
      title: "Aktif Temsilciler",
      value: report ? String(report.total_reps) : "0",
      change: 0,
      icon: <Users className="w-5 h-5" />,
      color: "green" as const,
    },
    {
      title: "Bugünkü Siparişler",
      value: report ? String(report.total_orders) : "0",
      change: 0,
      icon: <ShoppingCart className="w-5 h-5" />,
      color: "amber" as const,
    },
    {
      title: "Toplam Marketler",
      value: report ? report.total_markets.toLocaleString("tr-TR") : "0",
      change: 0,
      icon: <Store className="w-5 h-5" />,
      color: "purple" as const,
    },
  ];

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* KPI Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} loading={loading} />
        ))}
      </div>

      {/* Alt satır */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bugünkü en aktif temsilciler */}
        <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">
            Bugünkü Performans
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-6 bg-[var(--muted)] rounded animate-pulse" />
              ))}
            </div>
          ) : topReps.length > 0 ? (
            <div className="space-y-3">
              {topReps.map((rep, i) => (
                <div key={rep.user_id} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--muted-foreground)] w-4 shrink-0">
                    {i + 1}.
                  </span>
                  <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {rep.user_name?.charAt(0) ?? "?"}
                  </div>
                  <span className="flex-1 text-sm text-[var(--foreground)] truncate">
                    {rep.user_name}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                    {rep.visits} ziyaret
                  </span>
                  <div className="w-16 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full bg-[var(--primary)] rounded-full"
                      style={{ width: `${Math.min(rep.efficiency_score, 100)}%` }}
                      role="progressbar"
                      aria-valuenow={rep.efficiency_score}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${rep.user_name} verimlilik skoru`}
                    />
                  </div>
                  <span className="text-xs font-medium text-[var(--foreground)] w-8 text-right shrink-0">
                    {rep.efficiency_score}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
              Bugün henüz performans verisi yok
            </p>
          )}
        </div>

        {/* Son ziyaretler */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">
            Son Ziyaretler
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-5 bg-[var(--muted)] rounded animate-pulse" />
              ))}
            </div>
          ) : recentVisits.length > 0 ? (
            <div className="space-y-3">
              {recentVisits.map((v, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      v.is_successful ? "bg-emerald-500" : "bg-red-500"
                    )}
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-sm text-[var(--foreground)] truncate">
                    {v.market_name}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                    {new Date(v.timestamp).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
              Bugün henüz ziyaret yok
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
