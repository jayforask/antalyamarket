"use client";

import { useState } from "react";
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
import type { PerformanceSummary } from "@/types";

const MOCK_PERFORMANCE: PerformanceSummary[] = [
  { id: "1", user_id: "u1", date: "2024-07-03", total_visits: 24, successful_visits: 22, total_shift_time: 480, efficiency_score: 94, user: { id: "u1", name: "Ahmet Yılmaz", email: "ahmet@firma.com", role: "field_rep", created_at: "" } },
  { id: "2", user_id: "u2", date: "2024-07-03", total_visits: 21, successful_visits: 18, total_shift_time: 450, efficiency_score: 88, user: { id: "u2", name: "Fatma Kaya", email: "fatma@firma.com", role: "field_rep", created_at: "" } },
  { id: "3", user_id: "u3", date: "2024-07-03", total_visits: 19, successful_visits: 15, total_shift_time: 420, efficiency_score: 82, user: { id: "u3", name: "Mehmet Demir", email: "mehmet@firma.com", role: "field_rep", created_at: "" } },
  { id: "4", user_id: "u4", date: "2024-07-03", total_visits: 17, successful_visits: 13, total_shift_time: 400, efficiency_score: 76, user: { id: "u4", name: "Ayşe Çelik", email: "ayse@firma.com", role: "field_rep", created_at: "" } },
  { id: "5", user_id: "u5", date: "2024-07-03", total_visits: 15, successful_visits: 10, total_shift_time: 360, efficiency_score: 70, user: { id: "u5", name: "Hasan Arslan", email: "hasan@firma.com", role: "field_rep", created_at: "" } },
];

const WEEKLY_DATA = [
  { gun: "Pzt", ziyaret: 98, basarili: 88 },
  { gun: "Sal", ziyaret: 115, basarili: 102 },
  { gun: "Çar", ziyaret: 107, basarili: 95 },
  { gun: "Per", ziyaret: 132, basarili: 118 },
  { gun: "Cum", ziyaret: 142, basarili: 127 },
  { gun: "Cmt", ziyaret: 64, basarili: 58 },
  { gun: "Paz", ziyaret: 12, basarili: 11 },
];

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

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"daily" | "performance">("daily");

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
          {/* Haftalık ziyaret grafiği */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Bu Hafta — Ziyaret Grafiği</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={WEEKLY_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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

          {/* Haftalık trend */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Başarı Trendi</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={WEEKLY_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
        </div>
      )}

      {activeTab === "performance" && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
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
                {MOCK_PERFORMANCE.map((p, i) => {
                  const successRate = Math.round((p.successful_visits / p.total_visits) * 100);
                  return (
                    <tr key={p.id} className="hover:bg-[var(--muted)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs text-[var(--muted-foreground)] w-4">{i + 1}.</span>
                          <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {p.user?.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-[var(--foreground)]">{p.user?.name}</p>
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
        </div>
      )}
    </div>
  );
}
