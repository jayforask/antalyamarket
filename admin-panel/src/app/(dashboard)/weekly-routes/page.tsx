"use client";

import { useState, useCallback } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Navigation,
  Loader2,
  CheckCircle,
  Clock,
  SkipForward,
  RefreshCw,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  generateWeeklyRoutes,
  getWeeklyRoutes,
  getMondayOfWeek,
  getWeekDates,
  type DailyRouteApi,
  type WeeklyRoutesApi,
} from "@/lib/api/routesApi";
import type { User } from "@/types";

// ─── Mock temsilciler (gerçek entegrasyonda /users endpoint'inden gelir) ──────
const MOCK_FIELD_REPS: User[] = [
  { id: "u1", name: "Ahmet Yılmaz", email: "ahmet@firma.com", role: "field_rep", created_at: "" },
  { id: "u2", name: "Fatma Kaya", email: "fatma@firma.com", role: "field_rep", created_at: "" },
  { id: "u3", name: "Mehmet Demir", email: "mehmet@firma.com", role: "field_rep", created_at: "" },
  { id: "u4", name: "Ayşe Çelik", email: "ayse@firma.com", role: "field_rep", created_at: "" },
  { id: "u5", name: "Hasan Arslan", email: "hasan@firma.com", role: "field_rep", created_at: "" },
];

const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

const STATUS_CONFIG = {
  planned: { label: "Planlandı", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  active: { label: "Aktif", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  completed: { label: "Tamamlandı", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function getWeekLabel(mondayStr: string): string {
  const monday = new Date(mondayStr + "T00:00:00");
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  return `${monday.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} – ${friday.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}`;
}

function prevMonday(current: string): string {
  const d = new Date(current + "T00:00:00");
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

function nextMonday(current: string): string {
  const d = new Date(current + "T00:00:00");
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}

export default function WeeklyRoutesPage() {
  const [selectedRep, setSelectedRep] = useState<User>(MOCK_FIELD_REPS[0]);
  const [weekStart, setWeekStart] = useState<string>(getMondayOfWeek());
  const [marketsPerDay, setMarketsPerDay] = useState(20);
  const [weekData, setWeekData] = useState<WeeklyRoutesApi | null>(null);
  const [selectedDay, setSelectedDay] = useState<DailyRouteApi | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Haftanın rotalarını yükle
  const loadWeek = useCallback(async (userId: string, week: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getWeeklyRoutes(userId, week);
      setWeekData(data);
      setSelectedDay(data.routes[0] ?? null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Rotalar yüklenemedi");
      setWeekData(null);
      setSelectedDay(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Haftalık rota üret
  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const data = await generateWeeklyRoutes(selectedRep.id, weekStart, marketsPerDay);
      setWeekData(data);
      setSelectedDay(data.routes[0] ?? null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Rota oluşturma başarısız");
    } finally {
      setIsGenerating(false);
    }
  }

  // Hafta değiştiğinde yükle
  function changeWeek(newWeek: string) {
    setWeekStart(newWeek);
    setWeekData(null);
    setSelectedDay(null);
    setError(null);
  }

  // Temsilci değiştiğinde sıfırla
  function changeRep(rep: User) {
    setSelectedRep(rep);
    setWeekData(null);
    setSelectedDay(null);
    setError(null);
  }

  const weekDates = getWeekDates(weekStart);

  // Tarihe göre rota bul
  const routeByDate: Record<string, DailyRouteApi> = {};
  weekData?.routes.forEach((r) => { routeByDate[r.date] = r; });

  return (
    <div className="space-y-5 max-w-screen-xl">
      {/* Başlık */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Haftalık Rotalar</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Temsilcilerin portföylerinden haftalık ziyaret rotaları oluşturun
        </p>
      </div>

      {/* Kontrol paneli */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-4">
        {/* Temsilci seç */}
        <div>
          <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Temsilci</p>
          <div className="flex flex-wrap gap-2">
            {MOCK_FIELD_REPS.map((rep) => (
              <button
                key={rep.id}
                onClick={() => changeRep(rep)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
                  selectedRep.id === rep.id
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)] font-medium"
                    : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                )}
              >
                <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-[10px] flex items-center justify-center font-bold shrink-0">
                  {rep.name.charAt(0)}
                </span>
                {rep.name}
              </button>
            ))}
          </div>
        </div>

        {/* Hafta seç + ayarlar */}
        <div className="flex flex-wrap items-end gap-4">
          {/* Hafta navigasyon */}
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Hafta</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeWeek(prevMonday(weekStart))}
                className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                aria-label="Önceki hafta"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm min-w-56 justify-center">
                <CalendarDays className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
                <span className="text-[var(--foreground)] font-medium">{getWeekLabel(weekStart)}</span>
              </div>
              <button
                onClick={() => changeWeek(nextMonday(weekStart))}
                className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                aria-label="Sonraki hafta"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Günlük limit */}
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] block mb-2">
              Günlük Market Limiti
            </label>
            <input
              type="number"
              min={5}
              max={50}
              value={marketsPerDay}
              onChange={(e) => setMarketsPerDay(Number(e.target.value))}
              className="w-24 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              aria-label="Günlük market limiti"
            />
          </div>

          {/* Eylem butonları */}
          <div className="flex gap-2 ml-auto">
            {weekData && (
              <button
                onClick={() => loadWeek(selectedRep.id, weekStart)}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                Yenile
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || isLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              {isGenerating ? "Oluşturuluyor..." : weekData ? "Yeniden Oluştur" : "Haftalık Rota Oluştur"}
            </button>
          </div>
        </div>
      </div>

      {/* Hata mesajı */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Hafta özet ve günlük detay */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
        </div>
      )}

      {!isLoading && weekData && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Sol: Haftalık takvim grid */}
          <div className="w-full lg:w-72 shrink-0 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] px-1">
              <span className="font-medium">{weekData.total_days} gün · {weekData.total_markets} market</span>
            </div>

            {weekDates.map((dateStr, idx) => {
              const route = routeByDate[dateStr];
              const dayName = DAY_NAMES[idx];
              const visited = route?.stops.filter((s) => s.status === "visited").length ?? 0;
              const total = route?.stops.length ?? 0;
              const rolledOver = route?.stops.filter((s) => s.status === "rolled_over").length ?? 0;
              const progress = total > 0 ? Math.round((visited / total) * 100) : 0;

              return (
                <button
                  key={dateStr}
                  onClick={() => route && setSelectedDay(route)}
                  disabled={!route}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition-colors",
                    !route
                      ? "border-dashed border-[var(--border)] bg-[var(--muted)]/50 opacity-50 cursor-default"
                      : selectedDay?.id === route.id
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]"
                  )}
                  aria-label={`${dayName} rotası ${route ? `${total} market` : "yok"}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{dayName}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{formatDate(dateStr)}</p>
                    </div>
                    {route ? (
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", STATUS_CONFIG[route.status].color)}>
                        {STATUS_CONFIG[route.status].label}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--muted-foreground)]">Rota yok</span>
                    )}
                  </div>

                  {route && (
                    <>
                      <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
                        <span>{total} market</span>
                        {rolledOver > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">+{rolledOver} kayan</span>
                        )}
                      </div>
                      <div className="w-full h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--primary)] rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sağ: Seçili günün durak listesi */}
          <div className="flex-1 min-w-0">
            {selectedDay ? (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                {/* Başlık */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">
                      {DAY_NAMES[new Date(selectedDay.date + "T00:00:00").getDay() - 1] ?? selectedDay.date} — Durak Listesi
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      {selectedDay.stops.length} market · {formatDate(selectedDay.date)}
                    </p>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {selectedDay.stops.filter((s) => s.status === "visited").length} ziyaret
                    </span>
                    <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                      <Clock className="w-3.5 h-3.5" />
                      {selectedDay.stops.filter((s) => s.status === "pending").length} bekliyor
                    </span>
                    {selectedDay.stops.some((s) => s.status === "rolled_over") && (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <RefreshCw className="w-3.5 h-3.5" />
                        {selectedDay.stops.filter((s) => s.status === "rolled_over").length} kayan
                      </span>
                    )}
                  </div>
                </div>

                {/* Durak listesi */}
                <div className="divide-y divide-[var(--border)] max-h-[calc(100vh-380px)] overflow-y-auto">
                  {selectedDay.stops.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <MapPin className="w-8 h-8 text-[var(--muted-foreground)] mb-2" />
                      <p className="text-sm text-[var(--muted-foreground)]">Bu gün için durak yok</p>
                    </div>
                  ) : (
                    selectedDay.stops.map((stop, idx) => (
                      <div
                        key={stop.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3",
                          stop.status === "visited" && "bg-emerald-50/50 dark:bg-emerald-950/10",
                          stop.status === "skipped" && "bg-red-50/50 dark:bg-red-950/10",
                          stop.status === "rolled_over" && "bg-amber-50/50 dark:bg-amber-950/10",
                        )}
                      >
                        {/* Sıra numarası */}
                        <span className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5",
                          stop.status === "visited"
                            ? "bg-emerald-500 text-white"
                            : stop.status === "skipped"
                            ? "bg-red-400 text-white"
                            : stop.status === "rolled_over"
                            ? "bg-amber-400 text-white"
                            : "bg-[var(--primary)] text-white"
                        )}>
                          {idx + 1}
                        </span>

                        {/* Market bilgisi */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-[var(--foreground)] truncate">
                              {stop.market?.name ?? `Market #${stop.market_id.slice(0, 8)}`}
                            </p>
                            {stop.status === "rolled_over" && stop.rolled_from_date && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                                {stop.rolled_from_date} tarihinden kayan
                              </span>
                            )}
                          </div>
                          {stop.market?.address && (
                            <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">
                              {stop.market.address}
                            </p>
                          )}
                        </div>

                        {/* Durum ikonu */}
                        <div className="shrink-0">
                          {stop.status === "visited" && <CheckCircle className="w-4 h-4 text-emerald-500" aria-label="Ziyaret edildi" />}
                          {stop.status === "pending" && <Clock className="w-4 h-4 text-[var(--muted-foreground)]" aria-label="Bekliyor" />}
                          {stop.status === "skipped" && <SkipForward className="w-4 h-4 text-red-400" aria-label="Atlandı" />}
                          {stop.status === "rolled_over" && <RefreshCw className="w-4 h-4 text-amber-500" aria-label="Kayan durak" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-[var(--border)] text-center">
                <CalendarDays className="w-10 h-10 text-[var(--muted-foreground)] mb-3" />
                <p className="text-sm font-medium text-[var(--foreground)]">Gün seçin</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Sol panelden bir gün seçerek durakları görün
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Boş durum */}
      {!isLoading && !weekData && !error && (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-[var(--border)] text-center">
          <Navigation className="w-12 h-12 text-[var(--muted-foreground)] mb-4" />
          <p className="text-base font-semibold text-[var(--foreground)]">Haftalık rota bulunamadı</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-sm">
            Temsilciyi ve haftayı seçtikten sonra "Haftalık Rota Oluştur" butonuna tıklayın.
            Önce temsilciye portföy ataması yapılmış olması gerekir.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="mt-6 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            {isGenerating ? "Oluşturuluyor..." : "Rota Oluştur"}
          </button>
        </div>
      )}
    </div>
  );
}
