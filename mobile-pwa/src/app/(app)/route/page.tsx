"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Map as MapIcon,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api/client";
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

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
  rollover_count?: number;
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

// ─── Harita bileşeni ─────────────────────────────────────────────────────────

const ANTALYA_CENTER = { lat: 36.8969, lng: 30.7133 };
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function RouteMapInner({ stops }: { stops: RouteStopApi[] }) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (!map || !mapsLib) return;

    const sorted = [...stops]
      .filter((s) => s.market?.latitude && s.market?.longitude)
      .sort((a, b) => a.order_index - b.order_index);

    const path = sorted.map((s) => ({
      lat: s.market!.latitude,
      lng: s.market!.longitude,
    }));

    // Rota çizgisi
    if (path.length >= 2) {
      polylineRef.current = new mapsLib.Polyline({
        path,
        map,
        strokeColor: "#6366f1",
        strokeOpacity: 0.85,
        strokeWeight: 4,
        geodesic: true,
      });
    }

    // Numaralı pinler
    markersRef.current = sorted.map((stop, i) => {
      const statusColor =
        stop.status === "visited"
          ? "#10b981"
          : stop.status === "skipped"
          ? "#f59e0b"
          : stop.status === "rolled_over"
          ? "#f97316"
          : "#6366f1";

      return new google.maps.Marker({
        position: { lat: stop.market!.latitude, lng: stop.market!.longitude },
        map,
        label: { text: String(i + 1), color: "#fff", fontWeight: "bold", fontSize: "11px" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 13,
          fillColor: statusColor,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        title: stop.market?.name,
        zIndex: 10,
      });
    });

    // Haritayı rota'ya fit et
    if (path.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }

    return () => {
      polylineRef.current?.setMap(null);
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [map, mapsLib, stops]);

  return null;
}

function RouteMap({ stops }: { stops: RouteStopApi[] }) {
  if (!API_KEY) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--muted)] gap-2 rounded-xl">
        <MapPin className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs text-[var(--muted-foreground)] text-center px-4">
          Google Maps API anahtarı gerekli
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        defaultCenter={ANTALYA_CENTER}
        defaultZoom={12}
        mapId="antalyamarket-route-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: "100%", height: "100%" }}
      >
        <RouteMapInner stops={stops} />
      </Map>
    </APIProvider>
  );
}

// ─── Ana sayfa ────────────────────────────────────────────────────────────────

export default function RoutePage() {
  const [route, setRoute] = useState<DailyRouteApi | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReordering, setIsReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("map");

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
          <div className="flex items-center gap-2">
            {/* Harita / Liste geçiş */}
            <div className="flex rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
              <button
                onClick={() => setView("map")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === "map"
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--muted-foreground)]"
                )}
                aria-label="Harita görünümü"
                aria-pressed={view === "map"}
              >
                <MapIcon className="w-3.5 h-3.5" />
                Harita
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === "list"
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--muted-foreground)]"
                )}
                aria-label="Liste görünümü"
                aria-pressed={view === "list"}
              >
                <List className="w-3.5 h-3.5" />
                Liste
              </button>
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
              Sırala
            </button>
          </div>
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

      {/* Harita görünümü */}
      {view === "map" && (
        <div className="mx-4 mt-4 rounded-2xl overflow-hidden border border-[var(--border)] shadow-sm" style={{ height: 320 }}>
          <RouteMap stops={sorted} />
        </div>
      )}

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

      {/* Durak listesi — harita modunda da göster, liste modunda da */}
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
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium",
                stop.rollover_count && stop.rollover_count > 1
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold animate-pulse"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
              )}>
                {stop.rollover_count && stop.rollover_count > 1
                  ? `🚨 Gecikmiş (${stop.rollover_count} Gün)`
                  : "Kayan"}
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
