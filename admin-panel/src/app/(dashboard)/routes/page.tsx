"use client";

import { useState, useEffect, useCallback } from "react";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { RoutePolyline } from "@/components/features/maps/RoutePolyline";
import { apiClient } from "@/lib/api/client";
import type { DailyRouteApi } from "@/lib/api/routesApi";
import type { User, Market } from "@/types";
import {
  Plus,
  Trash2,
  MapPin,
  Route as RouteIcon,
  ChevronUp,
  ChevronDown,
  CheckCircle,
  Clock,
  SkipForward,
  Navigation,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const ANTALYA_CENTER = { lat: 36.8969, lng: 30.7133 };

// DailyRouteApi → harita için polyline uyumlu tip dönüşümü
function toRouteForMap(r: DailyRouteApi) {
  return {
    id: r.id,
    user_id: r.user_id,
    user: r.user,
    date: r.date,
    status: r.status as "draft" | "active" | "completed" | "cancelled",
    stops: r.stops.map((s) => ({
      id: s.id,
      market_id: s.market_id,
      market: s.market,
      order_index: s.order_index,
      status: (s.status === "rolled_over" ? "pending" : s.status) as "pending" | "visited" | "skipped",
      distance_from_prev: undefined,
      duration_from_prev: undefined,
    })),
    total_distance: undefined,
    total_duration: undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function formatDistance(meters?: number) {
  if (!meters) return "—";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

function formatDuration(seconds?: number) {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}s ${m % 60}dk` : `${m} dk`;
}

type Tab = "existing" | "new";

export default function RoutesPage() {
  const [tab, setTab] = useState<Tab>("existing");
  const [routes, setRoutes] = useState<DailyRouteApi[]>([]);
  const [fieldReps, setFieldReps] = useState<User[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<DailyRouteApi | null>(null);

  // Yeni rota state
  const [newRepId, setNewRepId] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<DailyRouteApi | null>(null);

  // Temsilcileri ve bugünün rotalarını yükle
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Temsilcileri çek
        const { data: usersData } = await apiClient.get<{ users: User[] }>("/auth/users");
        const reps = (usersData.users ?? []).filter((u: User) => u.role === "field_rep");
        setFieldReps(reps);
        if (reps.length > 0) setNewRepId(reps[0].id);

        // Marketleri çek (yeni rota formu için)
        try {
          const { data: mkts } = await apiClient.get("/markets/search", {
            params: { page: 1, page_size: 100 },
          });
          setMarkets(mkts.items ?? []);
        } catch {
          setMarkets([]);
        }

        // Bugünkü rotaları her temsilci için çek
        const today = new Date().toISOString().split("T")[0];
        const routeResults = await Promise.allSettled(
          reps.map((rep: User) =>
            apiClient
              .get<DailyRouteApi>(`/routes/${rep.id}/${today}`)
              .then((r) => r.data)
          )
        );
        const loaded: DailyRouteApi[] = routeResults
          .filter((r): r is PromiseFulfilledResult<DailyRouteApi> => r.status === "fulfilled")
          .map((r) => r.value);
        setRoutes(loaded);
        if (loaded.length > 0) setSelectedRoute(loaded[0]);
      } catch {
        // hata sessizce geçer
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function toggleMarket(id: string) {
    setSelectedMarkets((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  function moveMarket(id: string, dir: "up" | "down") {
    setSelectedMarkets((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }

  async function handleOptimize() {
    if (selectedMarkets.length < 2 || !newRepId) return;
    setIsOptimizing(true);
    await new Promise((r) => setTimeout(r, 800));

    const rep = fieldReps.find((r) => r.id === newRepId);
    const stops = selectedMarkets.map((mid, i) => {
      const market = markets.find((m) => m.id === mid);
      return {
        id: `new-s${i}`,
        route_id: "new-r",
        market_id: mid,
        order_index: i,
        status: "pending" as const,
        market: market,
      };
    });

    const route: DailyRouteApi = {
      id: "new-r",
      user_id: newRepId,
      user: rep,
      date: newDate,
      status: "planned",
      markets_per_day: stops.length,
      stops,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setOptimizedRoute(route);
    setIsOptimizing(false);
  }

  const displayRoute = tab === "existing" ? selectedRoute : optimizedRoute;
  const displayRouteForMap = displayRoute ? toRouteForMap(displayRoute) : null;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-theme(spacing.16)-theme(spacing.12))]">
      {/* Başlık */}
      <div className="shrink-0">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Rota Planlama</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Temsilciler için günlük ziyaret rotaları oluşturun ve yönetin
        </p>
      </div>

      {/* Tab */}
      <div className="flex gap-1 p-1 bg-[var(--muted)] rounded-lg w-fit shrink-0">
        {(["existing", "new"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === t
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            {t === "existing" ? "Mevcut Rotalar" : "Yeni Rota Oluştur"}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Sol panel */}
        <div className="w-full lg:w-72 shrink-0 overflow-y-auto space-y-3">
          {tab === "existing" ? (
            // Mevcut rotalar listesi
            <>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-[var(--muted-foreground)]">
                  <span className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mr-2" />
                  Yükleniyor...
                </div>
              ) : routes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-[var(--muted-foreground)]">
                  <RouteIcon className="w-8 h-8 opacity-40" />
                  <p className="text-sm">Bugün için rota bulunamadı</p>
                  <p className="text-xs opacity-60">Haftalık Rotalar sayfasından rota oluşturun</p>
                </div>
              ) : (
                routes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    selected={selectedRoute?.id === route.id}
                    onSelect={() => setSelectedRoute(route)}
                  />
                ))
              )}
            </>
          ) : (
            // Yeni rota formu
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Rota Detayları</p>

              {/* Temsilci seç */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">
                  Temsilci
                </label>
                <select
                  value={newRepId}
                  onChange={(e) => setNewRepId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                >
                  {fieldReps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tarih seç */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">Tarih</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>

              {/* Market seçimi */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">
                  Marketler ({selectedMarkets.length} seçili)
                </label>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {markets.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)] text-center py-4">Market yükleniyor...</p>
                  ) : (
                    markets.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => toggleMarket(m.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors flex items-center gap-2",
                          selectedMarkets.includes(m.id)
                            ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)]"
                            : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        )}
                      >
                        <Plus
                          className={cn(
                            "w-3 h-3 shrink-0 transition-transform",
                            selectedMarkets.includes(m.id) && "rotate-45 text-[var(--primary)]"
                          )}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate text-[var(--foreground)]">{m.name}</p>
                          <p className="text-[var(--muted-foreground)] truncate">{m.address}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Seçili market sırası */}
              {selectedMarkets.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--muted-foreground)]">
                    Ziyaret Sırası
                  </label>
                  <div className="space-y-1">
                    {selectedMarkets.map((mid, i) => {
                      const m = markets.find((x) => x.id === mid);
                      return (
                        <div
                          key={mid}
                          className="flex items-center gap-2 px-3 py-2 bg-[var(--muted)] rounded-lg text-xs"
                        >
                          <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            {i + 1}
                          </span>
                          <span className="flex-1 truncate text-[var(--foreground)]">
                            {m?.name}
                          </span>
                          <div className="flex gap-0.5">
                            <button
                              onClick={() => moveMarket(mid, "up")}
                              disabled={i === 0}
                              className="p-0.5 rounded hover:bg-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label="Yukarı taşı"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => moveMarket(mid, "down")}
                              disabled={i === selectedMarkets.length - 1}
                              className="p-0.5 rounded hover:bg-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label="Aşağı taşı"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => toggleMarket(mid)}
                              className="p-0.5 rounded hover:bg-[var(--border)] text-red-500"
                              aria-label="Kaldır"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Optimize et butonu */}
              <button
                onClick={handleOptimize}
                disabled={selectedMarkets.length < 2 || isOptimizing}
                className={cn(
                  "w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2",
                  selectedMarkets.length >= 2 && !isOptimizing
                    ? "bg-[var(--primary)] text-white hover:opacity-90"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed"
                )}
              >
                {isOptimizing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Optimize ediliyor...
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    Rotayı Optimize Et
                  </>
                )}
              </button>

              {selectedMarkets.length < 2 && (
                <p className="text-xs text-[var(--muted-foreground)] text-center">
                  En az 2 market seçin
                </p>
              )}
            </div>
          )}
        </div>

        {/* Harita + rota detay */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Harita */}
          <div className="flex-1 min-h-64 rounded-xl overflow-hidden border border-[var(--border)] shadow-sm">
            {!API_KEY ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--muted)] gap-3">
                <RouteIcon className="w-10 h-10 text-[var(--muted-foreground)]" />
                <div className="text-center">
                  <p className="font-semibold text-[var(--foreground)]">Google Maps API Anahtarı Gerekli</p>
                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                    <code className="bg-[var(--border)] px-1 py-0.5 rounded text-xs">
                      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                    </code>{" "}
                    ortam değişkenini ayarlayın
                  </p>
                </div>
              </div>
            ) : (
              <APIProvider apiKey={API_KEY}>
                <Map
                  defaultCenter={ANTALYA_CENTER}
                  defaultZoom={12}
                  mapId="antalyamarket-routes-map"
                  gestureHandling="greedy"
                  style={{ width: "100%", height: "100%" }}
                >
                  {/* Haritada market pinleri (yeni rota modunda) */}
                  {tab === "new" &&
                    markets.map((m) => (
                      <AdvancedMarker
                        key={m.id}
                        position={{ lat: m.latitude, lng: m.longitude }}
                        onClick={() => toggleMarket(m.id)}
                        title={m.name}
                      >
                        <div
                          className={cn(
                            "w-7 h-7 rounded-lg border-2 border-white shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-110",
                            selectedMarkets.includes(m.id)
                              ? "bg-[var(--primary)]"
                              : "bg-gray-400"
                          )}
                        >
                          <MapPin className="w-3.5 h-3.5 text-white" />
                        </div>
                      </AdvancedMarker>
                    ))}

                  {/* Seçili / mevcut rota çizgisi */}
                  {displayRouteForMap && <RoutePolyline route={displayRouteForMap} />}
                </Map>
              </APIProvider>
            )}
          </div>

          {/* Rota özet kartı */}
          {displayRoute && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {displayRoute.user?.name ?? "Bilinmeyen Temsilci"} — Rota Özeti
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">{displayRoute.date}</p>
                </div>
                <div className="flex gap-4 text-xs text-[var(--muted-foreground)]">
                  <span>
                    <span className="font-semibold text-[var(--foreground)]">
                      {displayRoute.stops.length}
                    </span>{" "}
                    durak
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                      displayRoute.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : displayRoute.status === "completed"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {displayRoute.status === "active" ? "Aktif" : displayRoute.status === "completed" ? "Tamamlandı" : "Planlandı"}
                  </span>
                </div>
              </div>

              {/* Durak listesi */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {displayRoute.stops
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((stop, i) => (
                    <div
                      key={stop.id}
                      className={cn(
                        "shrink-0 flex flex-col gap-1 p-2.5 rounded-lg border text-xs min-w-36",
                        stop.status === "visited"
                          ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800"
                          : stop.status === "skipped"
                          ? "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800"
                          : "border-[var(--border)] bg-[var(--muted)]"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-medium text-[var(--foreground)] truncate">
                          {stop.market?.name ?? "Market"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 pl-6">
                        {stop.status === "visited" && (
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                        )}
                        {stop.status === "pending" && (
                          <Clock className="w-3 h-3 text-gray-400" />
                        )}
                        {stop.status === "skipped" && (
                          <SkipForward className="w-3 h-3 text-red-500" />
                        )}
                        <span
                          className={cn(
                            stop.status === "visited"
                              ? "text-emerald-600"
                              : stop.status === "skipped"
                              ? "text-red-500"
                              : "text-[var(--muted-foreground)]"
                          )}
                        >
                          {stop.status === "visited"
                            ? "Ziyaret edildi"
                            : stop.status === "skipped"
                            ? "Atlandı"
                            : "Bekliyor"}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RouteCard({
  route,
  selected,
  onSelect,
}: {
  route: DailyRouteApi;
  selected: boolean;
  onSelect: () => void;
}) {
  const visited = route.stops.filter((s: { status: string }) => s.status === "visited").length;
  const progress = Math.round((visited / route.stops.length) * 100);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-colors space-y-3",
        selected
          ? "border-[var(--primary)] bg-[var(--primary)]/5"
          : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {route.user?.name ?? "Temsilci"}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">{route.date}</p>
        </div>
        <span
          className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full",
            route.status === "active"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : route.status === "completed"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          )}
        >
          {route.status === "active"
            ? "Aktif"
            : route.status === "completed"
            ? "Tamamlandı"
            : "Taslak"}
        </span>
      </div>

      {/* İlerleme çubuğu */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
          <span>
            {visited}/{route.stops.length} durak
          </span>
          <span>%{progress}</span>
        </div>
        <div className="w-full h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--primary)] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex gap-3 text-xs text-[var(--muted-foreground)]">
        <span>{route.stops.length} durak</span>
        <span>·</span>
        <span>{route.markets_per_day} mkt/gün</span>
      </div>
    </button>
  );
}
