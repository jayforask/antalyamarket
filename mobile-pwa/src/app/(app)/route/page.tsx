"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Navigation,
  CheckCircle,
  Clock,
  MapPin,
  ChevronRight,
  Phone,
  ExternalLink,
  SkipForward,
  RefreshCw,
  Loader2,
  AlertCircle,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api/client";

// ─── Tipler ───────────────────────────────────────────────────────────────────

type StopStatus = "pending" | "visited" | "skipped" | "rolled_over";

interface MarketInfo {
  id: string;
  name: string;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  type: string;
}

interface RouteStopApi {
  id: string;
  route_id: string;
  market_id: string;
  order_index: number;
  status: StopStatus;
  rolled_from_date?: string;
  visited_at?: string;
  market?: MarketInfo;
}

interface DailyRouteApi {
  id: string;
  user_id: string;
  date: string;
  status: "planned" | "active" | "completed";
  markets_per_day: number;
  stops: RouteStopApi[];
}

// ─── API fonksiyonları ────────────────────────────────────────────────────────

async function fetchTodayRoute(): Promise<DailyRouteApi> {
  const { data } = await apiClient.get<DailyRouteApi>("/routes/today");
  return data;
}

async function reorderRoute(lat: number, lng: number): Promise<DailyRouteApi> {
  const { data } = await apiClient.post<DailyRouteApi>("/routes/today/reorder", {
    current_lat: lat,
    current_lng: lng,
  });
  return data;
}

async function skipStop(stopId: string): Promise<void> {
  await apiClient.post(`/routes/stops/${stopId}/skip`);
}

// Ziyareti backend'e kaydet (operations router üzerinden)
async function markVisitedApi(marketId: string, lat: number, lng: number): Promise<void> {
  // Önce ziyaret başlat
  const { data: visit } = await apiClient.post("/visits/start", {
    market_id: marketId,
    gps_lat: lat,
    gps_lng: lng,
  });
  // Hemen başarılı olarak kapat
  await apiClient.post("/visits/submit", {
    visit_id: visit.id,
    is_successful: true,
  });
}

function openNavigation(lat: number, lng: number, label: string) {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const encodedLabel = encodeURIComponent(label);
  if (isIOS) {
    window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&q=${encodedLabel}`);
  } else {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
    );
  }
}

function formatVisitedAt(isoStr?: string): string {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Ana sayfa ────────────────────────────────────────────────────────────────

export default function RoutePage() {
  const [route, setRoute] = useState<DailyRouteApi | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReordering, setIsReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Rotayı yükle
  const loadRoute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTodayRoute();
      setRoute(data);
      // İlk pending durağı otomatik aç
      const firstPending = data.stops.find((s) => s.status === "pending" || s.status === "rolled_over");
      if (firstPending) setExpandedId(firstPending.id);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if ((e as { response?: { status?: number } })?.response?.status === 404) {
        setError("Bugün için planlanmış rota bulunamadı.");
      } else {
        setError(msg ?? "Rota yüklenemedi. Lütfen tekrar deneyin.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoute();
  }, [loadRoute]);

  // GPS'e göre yeniden sırala
  async function handleReorder() {
    setIsReordering(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      );
      const data = await reorderRoute(pos.coords.latitude, pos.coords.longitude);
      setRoute(data);
    } catch {
      // Konum alınamazsa sessizce geç
    } finally {
      setIsReordering(false);
    }
  }

  // Durağı atla
  async function handleSkip(stopId: string) {
    setActioningId(stopId);
    try {
      await skipStop(stopId);
      setRoute((prev) =>
        prev
          ? {
              ...prev,
              stops: prev.stops.map((s) => (s.id === stopId ? { ...s, status: "skipped" } : s)),
            }
          : prev
      );
    } catch {
      // sessiz hata
    } finally {
      setActioningId(null);
    }
  }

  // Ziyaret et
  async function handleVisit(stop: RouteStopApi) {
    setActioningId(stop.id);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      ).catch(() => null);

      const lat = pos?.coords.latitude ?? 0;
      const lng = pos?.coords.longitude ?? 0;

      if (stop.market?.id) {
        await markVisitedApi(stop.market.id, lat, lng);
      }

      // Yerel state'i güncelle
      const now = new Date().toISOString();
      setRoute((prev) =>
        prev
          ? {
              ...prev,
              stops: prev.stops.map((s) =>
                s.id === stop.id ? { ...s, status: "visited", visited_at: now } : s
              ),
            }
          : prev
      );
      setExpandedId(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(msg ?? "Ziyaret kaydedilemedi");
    } finally {
      setActioningId(null);
    }
  }

  // Özet hesapla
  const stops = route?.stops ?? [];
  const sorted = [...stops].sort((a, b) => a.order_index - b.order_index);
  const visited = stops.filter((s) => s.status === "visited").length;
  const pending = stops.filter((s) => s.status === "pending" || s.status === "rolled_over").length;
  const skipped = stops.filter((s) => s.status === "skipped").length;
  const rolledOver = stops.filter((s) => s.status === "rolled_over").length;
  const progress = stops.length > 0 ? Math.round((visited / stops.length) * 100) : 0;
  const nextStop = sorted.find((s) => s.status === "pending" || s.status === "rolled_over");

  // ─── Yükleniyor ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--background)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
        <p className="text-sm text-[var(--muted-foreground)]">Rotanız yükleniyor...</p>
      </div>
    );
  }

  // ─── Hata / rota yok ─────────────────────────────────────────────────────────
  if (error || !route) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-[var(--background)] pb-[calc(68px+env(safe-area-inset-bottom))]">
        <CalendarCheck className="w-14 h-14 text-[var(--muted-foreground)]" />
        <div>
          <p className="font-semibold text-[var(--foreground)] text-base">
            {error ?? "Bugün için rota yok"}
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Yöneticiniz sizin için bir rota oluşturmamış olabilir.
          </p>
        </div>
        <button
          onClick={loadRoute}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-medium active:scale-95 transition-transform"
        >
          <RefreshCw className="w-4 h-4" />
          Tekrar Dene
        </button>
      </div>
    );
  }

  // ─── Ana içerik ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--background)] pb-[calc(68px+env(safe-area-inset-bottom))]">
      {/* Başlık */}
      <div className="px-4 pt-6 pb-4 bg-[var(--card)] border-b border-[var(--border)]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)]">Bugünkü Rotam</h1>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              {new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <button
            onClick={handleReorder}
            disabled={isReordering}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--muted-foreground)] active:scale-95 transition-transform disabled:opacity-50"
            aria-label="GPS konumuna göre rotayı yeniden sırala"
          >
            {isReordering ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Yeniden Sırala
          </button>
        </div>

        {/* İlerleme */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
            <span>{visited} / {stops.length} durak tamamlandı</span>
            <span>%{progress}</span>
          </div>
          <div className="w-full h-2 bg-[var(--muted)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-3 h-3" aria-hidden="true" /> {visited} tamamlandı
            </span>
            <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
              <Clock className="w-3 h-3" aria-hidden="true" /> {pending} bekliyor
            </span>
            {skipped > 0 && (
              <span className="flex items-center gap-1 text-amber-500">
                <SkipForward className="w-3 h-3" aria-hidden="true" /> {skipped} atlandı
              </span>
            )}
            {rolledOver > 0 && (
              <span className="flex items-center gap-1 text-orange-500">
                <AlertCircle className="w-3 h-3" aria-hidden="true" /> {rolledOver} kayan
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sıradaki durak banner */}
      {nextStop && (
        <div className="mx-4 mt-4 p-4 bg-[var(--primary)] rounded-2xl text-white">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium opacity-80 mb-1">
                {nextStop.status === "rolled_over" ? "⚠️ Kayan Durak" : "Sıradaki Durak"}
              </p>
              <p className="font-bold text-base truncate">
                {nextStop.market?.name ?? "Market"}
              </p>
              <p className="text-xs opacity-80 mt-0.5 truncate">{nextStop.market?.address}</p>
            </div>
          </div>
          {nextStop.market && (
            <button
              onClick={() =>
                openNavigation(
                  nextStop.market!.latitude,
                  nextStop.market!.longitude,
                  nextStop.market!.name
                )
              }
              className="mt-3 flex items-center gap-2 bg-white/20 hover:bg-white/30 active:bg-white/10 transition-colors px-3 py-2 rounded-xl text-sm font-semibold w-full justify-center"
            >
              <Navigation className="w-4 h-4" aria-hidden="true" />
              Navigasyonu Başlat
            </button>
          )}
        </div>
      )}

      {/* Tamamlandı banner */}
      {pending === 0 && stops.length > 0 && (
        <div className="mx-4 mt-4 p-4 bg-emerald-500 rounded-2xl text-white text-center">
          <CheckCircle className="w-8 h-8 mx-auto mb-2" aria-hidden="true" />
          <p className="font-bold">Günlük rota tamamlandı!</p>
          <p className="text-xs opacity-80 mt-1">{visited} market ziyaret edildi</p>
        </div>
      )}

      {/* Durak listesi */}
      <div className="px-4 mt-4 space-y-2">
        <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
          Tüm Duraklar ({stops.length})
        </p>

        {sorted.map((stop, idx) => (
          <StopCard
            key={stop.id}
            stop={stop}
            displayIndex={idx + 1}
            expanded={expandedId === stop.id}
            isActioning={actioningId === stop.id}
            onToggle={() => setExpandedId(expandedId === stop.id ? null : stop.id)}
            onMarkVisited={() => handleVisit(stop)}
            onMarkSkipped={() => handleSkip(stop.id)}
            onNavigate={() =>
              stop.market &&
              openNavigation(stop.market.latitude, stop.market.longitude, stop.market.name)
            }
          />
        ))}
      </div>
    </div>
  );
}

// ─── Stop Card ────────────────────────────────────────────────────────────────

function StopCard({
  stop,
  displayIndex,
  expanded,
  isActioning,
  onToggle,
  onMarkVisited,
  onMarkSkipped,
  onNavigate,
}: {
  stop: RouteStopApi;
  displayIndex: number;
  expanded: boolean;
  isActioning: boolean;
  onToggle: () => void;
  onMarkVisited: () => void;
  onMarkSkipped: () => void;
  onNavigate: () => void;
}) {
  const isRolledOver = stop.status === "rolled_over";

  const statusColor =
    stop.status === "visited"
      ? "bg-emerald-500"
      : stop.status === "skipped"
      ? "bg-amber-400"
      : isRolledOver
      ? "bg-orange-400"
      : "bg-[var(--primary)]";

  const cardBg =
    stop.status === "visited"
      ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900"
      : stop.status === "skipped"
      ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900 opacity-60"
      : isRolledOver
      ? "border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-900"
      : "border-[var(--border)] bg-[var(--card)]";

  return (
    <div className={cn("rounded-2xl border transition-all", cardBg)}>
      {/* Başlık satırı */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left"
        aria-expanded={expanded}
        aria-label={`${stop.market?.name ?? "Market"} durağı, ${stop.status}`}
      >
        {/* Sıra / durum ikonu */}
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0", statusColor)}>
          {stop.status === "visited" ? (
            <CheckCircle className="w-4 h-4" aria-hidden="true" />
          ) : stop.status === "skipped" ? (
            <SkipForward className="w-4 h-4" aria-hidden="true" />
          ) : (
            displayIndex
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={cn(
              "font-semibold text-sm truncate",
              stop.status === "visited"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-[var(--foreground)]"
            )}>
              {stop.market?.name ?? `Market #${stop.market_id.slice(0, 8)}`}
            </p>
            {isRolledOver && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 shrink-0">
                Kayan
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--muted-foreground)] truncate">
            {stop.market?.address ?? ""}
          </p>
          {stop.status === "visited" && stop.visited_at && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatVisitedAt(stop.visited_at)}&apos;de ziyaret edildi
            </p>
          )}
          {isRolledOver && stop.rolled_from_date && (
            <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-0.5">
              {stop.rolled_from_date} tarihinden kaldı
            </p>
          )}
        </div>

        <ChevronRight
          className={cn(
            "w-4 h-4 text-[var(--muted-foreground)] shrink-0 transition-transform",
            expanded && "rotate-90"
          )}
          aria-hidden="true"
        />
      </button>

      {/* Genişletilmiş içerik */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)]/50 pt-3">
          {/* Adres */}
          <div className="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{stop.market?.address ?? "Adres bilgisi yok"}</span>
          </div>

          {/* Telefon */}
          {stop.market?.phone && (
            <a
              href={`tel:${stop.market.phone}`}
              className="flex items-center gap-2 text-xs text-[var(--primary)]"
            >
              <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {stop.market.phone}
            </a>
          )}

          {/* Aksiyon butonları */}
          {(stop.status === "pending" || stop.status === "rolled_over") && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={onNavigate}
                disabled={isActioning}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--muted)] text-[var(--foreground)] text-xs font-medium flex-1 justify-center active:scale-95 transition-transform disabled:opacity-50"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                Haritada Aç
              </button>
              <button
                onClick={onMarkSkipped}
                disabled={isActioning}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium flex-1 justify-center active:scale-95 transition-transform disabled:opacity-50"
              >
                {isActioning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                Atla
              </button>
              <button
                onClick={onMarkVisited}
                disabled={isActioning}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold flex-1 justify-center active:scale-95 transition-transform disabled:opacity-60"
              >
                {isActioning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                Ziyaret Et
              </button>
            </div>
          )}

          {stop.status === "visited" && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
              {stop.visited_at
                ? `${formatVisitedAt(stop.visited_at)}'de ziyaret edildi`
                : "Ziyaret tamamlandı"}
            </div>
          )}

          {stop.status === "skipped" && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <SkipForward className="w-4 h-4" aria-hidden="true" />
              Bu durak atlandı
            </div>
          )}
        </div>
      )}
    </div>
  );
}
