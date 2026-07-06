"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, User, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserDayDetail, getUserShiftDates } from "@/lib/api/users";
import type { UserDayDetail, ShiftDateItem } from "@/lib/api/users";
import { ShiftStats } from "@/components/features/users/ShiftStats";
import { DayTimeline } from "@/components/features/users/DayTimeline";
import { DayMap } from "@/components/features/users/DayMap";

const ROLE_LABELS: Record<string, string> = {
  admin: "Yönetici",
  manager: "Müdür",
  field_rep: "Saha Temsilcisi",
};

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("tr-TR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [detail, setDetail] = useState<UserDayDetail | null>(null);
  const [shiftDates, setShiftDates] = useState<ShiftDateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Vardiya geçmişi tarihleri (tarih seçicideki highlights için)
  useEffect(() => {
    if (!id) return;
    getUserShiftDates(id, 60).then(setShiftDates).catch(() => {});
  }, [id]);

  const loadDetail = useCallback(
    async (date: string) => {
      if (!id) return;
      try {
        setLoading(true);
        setError("");
        const data = await getUserDayDetail(id, date);
        setDetail(data);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(msg ?? "Veri yüklenemedi.");
        setDetail(null);
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    loadDetail(selectedDate);
  }, [loadDetail, selectedDate]);

  // Tarihin vardiyası var mı?
  const hasShiftOnDate = (d: string) =>
    shiftDates.some((s) => s.date === d);

  return (
    <div className="flex flex-col h-full gap-4 max-w-screen-2xl">
      {/* ── Başlık ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            aria-label="Geri dön"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          {detail ? (
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-bold text-sm">
                  {detail.user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--foreground)] leading-tight">
                    {detail.user.name}
                  </h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {ROLE_LABELS[detail.user.role] ?? detail.user.role} · {detail.user.email}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-[var(--muted)] flex items-center justify-center">
                <User className="w-4 h-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              </div>
              <div>
                <div className="h-4 w-32 bg-[var(--muted)] rounded animate-pulse" />
                <div className="h-3 w-24 bg-[var(--muted)] rounded animate-pulse mt-1" />
              </div>
            </div>
          )}
        </div>

        {/* Tarih seçici */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--muted-foreground)]" aria-hidden="true" />
          <input
            type="date"
            value={selectedDate}
            max={todayStr()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            aria-label="Tarih seç"
          />
          {hasShiftOnDate(selectedDate) && (
            <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-600/20">
              Vardiya var
            </span>
          )}
        </div>
      </div>

      {/* Seçili tarih başlığı */}
      <p className="text-sm text-[var(--muted-foreground)] -mt-2 shrink-0">
        {formatDisplayDate(selectedDate)}
      </p>

      {/* ── Hata durumu ── */}
      {error && !loading && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* ── İçerik ── */}
      {loading ? (
        <LoadingSkeleton />
      ) : detail ? (
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          {/* Sol kolon — istatistik + zaman çizelgesi */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4 lg:overflow-y-auto">
            {/* İstatistikler */}
            <ShiftStats stats={detail.stats} />

            {/* Vardiya durumu badge */}
            {detail.shift && (
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border",
                detail.shift.status === "active"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-zinc-50 border-zinc-200 text-zinc-600"
              )}>
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  detail.shift.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                )} aria-hidden="true" />
                Vardiya {detail.shift.status === "active" ? "Devam Ediyor" : "Tamamlandı"}
              </div>
            )}

            {/* Zaman çizelgesi */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex-1">
              <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
                Gün Aktivitesi
              </p>
              <DayTimeline shift={detail.shift} visits={detail.visits} />
            </div>
          </div>

          {/* Sağ — harita */}
          <div className="flex-1 min-h-[400px] lg:min-h-0 rounded-xl overflow-hidden border border-[var(--border)] shadow-sm">
            <DayMap shift={detail.shift} visits={detail.visits} />
          </div>
        </div>
      ) : !error ? (
        <EmptyState date={selectedDate} />
      ) : null}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
      <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex-1 animate-pulse" />
      </div>
      <div className="flex-1 min-h-[400px] lg:min-h-0 rounded-xl bg-[var(--muted)] animate-pulse" />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ date }: { date: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--muted)] flex items-center justify-center mb-4">
        <Calendar className="w-7 h-7 text-[var(--muted-foreground)]" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-[var(--foreground)]">Bu güne ait kayıt yok</h3>
      <p className="mt-1.5 text-sm text-[var(--muted-foreground)] max-w-xs">
        {formatDisplayDate(date)} tarihinde vardiya başlatılmamış veya ziyaret kaydedilmemiş.
      </p>
    </div>
  );
}
