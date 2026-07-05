"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { formatDate, formatDuration, cn } from "@/lib/utils";
import { apiClient } from "@/lib/api/client";
import { Loader2 } from "lucide-react";
import type { PerformanceSummary } from "@/types";

interface DailyReport {
  date: string;
  total_visits: number;
  successful_visits: number;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90 ? "bg-emerald-50 text-emerald-700" :
    score >= 75 ? "bg-blue-50 text-blue-700" :
    score >= 60 ? "bg-amber-50 text-amber-700" :
    "bg-red-50 text-red-700";
  return (
    <span className={cn("px-2 py-0.5 rounded-md text-xs font-semibold", color)}>
      {score}
    </span>
  );
}

function getLastNDates(n: number): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

const DAY_ABBR: Record<number, string> = { 0: "Paz", 1: "Pzt", 2: "Sal", 3: "Çar", 4: "Per", 5: "Cum", 6: "Cmt" };

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"daily" | "performance">("daily");
  const [weeklyData, setWeeklyData] = useState<{ gun: string; ziyaret: number; basarili: number }[]>([]);
  const [performance, setPerformance] = useState<PerformanceSummary[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingPerf, setLoadingPerf] = useState(true);

  // Son 7 günün verilerini çek
  useEffect(() => {
    const dates = getLastNDates(7);
    Promise.allSettled(
      dates.map((d) =>
        apiClient.get<DailyReport>(`/reports/daily?report_date=${d}`).then((r) => r.data)
      )
    ).then((results) => {
      const data = results.map((r, i) => {
        const date = new Date(dates[i] + "T00:00:00");
        const dayAbbr = DAY_ABBR[date.getDay()] ?? dates[i];
        if (r.status === "fulfilled") {
          return {
            gun: dayAbbr,
            ziyaret: r.value.total_visits,
            basarili: r.value.successful_visits,
          };
        }
        return { gun: dayAbbr, ziyaret: 0, basarili: 0 };
      });
      setWeeklyData(data);
    }).finally(() => setLoadingDaily(false));
  }, []);

  // Performans tablosunu çek
  useEffect(() => {
    apiClient
      .get<PerformanceSummary[]>("/reports/performance?page_size=20")
      .then(({ data }) => {
        setPerformance(Array.isArray(data) ? data : []);
      })
      .catch(() => setPerformance([]))
      .finally(() => setLoadingPerf(false));
  }, []);

  return (
    <div className="space-y-5 max-w-screen-xl">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Raporlar</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Günlük ve haftalık performans analizi</p>
      </div>

      {/* Tab */}
      <div className="flex gap-1 p-1 bg-[var(--muted)] rounded-lg w-fit">
        {(["daily", "performance"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            {tab === "daily" ? "Günlük Özet" : "Performans"}
          </button>
        ))}
      </div>

      {activeTab === "daily" && (
        <div className="space-y-4">
          {loadingDaily ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : (
            <>
              {/* Haftalık ziyaret grafiği */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Son 7 Gün — Ziyaret Grafiği</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="gun" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="ziyaret" name="Toplam" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="basarili" name="Başarılı" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Başarı trendi */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Başarı Trendi</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="gun" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Line type="monotone" dataKey="basarili" name="Başarılı Ziyaret" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "performance" && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
          {loadingPerf ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : performance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">
                Henüz performans verisi yok. Temsilciler ziyaret kaydetti mi kontrol edin.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                    <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Temsilci</th>
                    <th className="text-center px-4 py-3 font-medium text-[var(--muted-foreground)]">Toplam Ziyaret</th>
                    <th className="text-center px-4 py-3 font-medium text-[var(--muted-foreground)]">Başarılı</th>
                    <th className="text-center px-4 py-3 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Başarı %</th>
                    <th className="text-center px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Mesai</th>
                    <th className="text-center px-4 py-3 font-medium text-[var(--muted-foreground)]">Skor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {performance.map((p, i) => {
                    const successRate = p.total_visits > 0
                      ? Math.round((p.successful_visits / p.total_visits) * 100)
                      : 0;
                    return (
                      <tr key={p.id} className="hover:bg-[var(--muted)] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs text-[var(--muted-foreground)] w-4">{i + 1}.</span>
                            <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {p.user?.name?.charAt(0) ?? "?"}
                            </div>
                            <div>
                              <p className="font-medium text-[var(--foreground)]">{p.user?.name ?? "—"}</p>
                              <p className="text-xs text-[var(--muted-foreground)]">{formatDate(p.date)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-[var(--foreground)]">{p.total_visits}</td>
                        <td className="px-4 py-3 text-center text-emerald-600 font-medium">{p.successful_visits}</td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[var(--primary)] rounded-full"
                                style={{ width: `${successRate}%` }}
                                role="progressbar"
                                aria-valuenow={successRate}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              />
                            </div>
                            <span className="text-xs text-[var(--muted-foreground)]">%{successRate}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-[var(--muted-foreground)] text-xs hidden lg:table-cell">
                          {formatDuration(p.total_shift_time)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ScoreBadge score={p.efficiency_score} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
