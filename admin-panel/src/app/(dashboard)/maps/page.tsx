"use client";

import { useState, useEffect } from "react";
import { APIProvider, Map } from "@vis.gl/react-google-maps";
import { RepMarker } from "@/components/features/maps/RepMarker";
import type { RepLocationFull } from "@/components/features/maps/RepMarker";
import { VisitMarker } from "@/components/features/maps/VisitMarker";
import type { VisitForMarker } from "@/components/features/maps/VisitMarker";
import { RoutePolyline } from "@/components/features/maps/RoutePolyline";
import { apiClient } from "@/lib/api/client";
import type { DailyRouteApi } from "@/lib/api/routesApi";
import type { User } from "@/types";
import { MapPin, Route, Users, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// VisitForMarker'ı yeniden kullan — aynı şema
type VisitItem = VisitForMarker;

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const ANTALYA_CENTER = { lat: 36.8969, lng: 30.7133 };

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
    polyline: (r as any).polyline,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// RepMarker için uyumlu rep şekli — aktif vardiya koordinatından al
function toRepLocation(user: User, shift: { start_lat: number | null; start_lng: number | null; start_time: string } | null) {
  return {
    user_id: user.id,
    name: user.name,
    lat: shift?.start_lat ?? ANTALYA_CENTER.lat,
    lng: shift?.start_lng ?? ANTALYA_CENTER.lng,
    timestamp: shift?.start_time ?? new Date().toISOString(),
  };
}

// Aktif vardiya tipi (all-active endpoint'inden gelen) — current_lat/lng öncelikli
interface ActiveShift {
  id: string;
  user_id: string;
  start_time: string;
  start_lat: number | null;
  start_lng: number | null;
  current_lat?: number | null;
  current_lng?: number | null;
  location_updated_at?: string | null;
  status: string;
}

export default function MapsPage() {
  const [showReps, setShowReps] = useState(true);
  const [showVisits, setShowVisits] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [selectedRep, setSelectedRep] = useState<string | null>(null);

  const [fieldReps, setFieldReps] = useState<User[]>([]);
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [routes, setRoutes] = useState<DailyRouteApi[]>([]);
  // user_id → aktif vardiya koordinatı
  const [activeShifts, setActiveShifts] = useState<Record<string, ActiveShift>>({});

  useEffect(() => {
    async function load() {
      try {
        // Temsilcileri çek
        const { data: usersData } = await apiClient.get<{ users: User[] }>("/auth/users");
        const reps = (usersData.users ?? []).filter((u: User) => u.role === "field_rep");
        setFieldReps(reps);

        // Tüm aktif vardiyaları çek (gerçek koordinatlar için)
        try {
          const { data: shiftsData } = await apiClient.get<ActiveShift[]>("/shifts/all-active");
          console.debug("[maps] all-active response:", shiftsData);
          const shiftMap: Record<string, ActiveShift> = {};
          for (const s of shiftsData) {
            console.debug("[maps] shift entry:", s.user_id, "lat:", s.start_lat, "lng:", s.start_lng);
            shiftMap[s.user_id] = s;
          }
          setActiveShifts(shiftMap);
        } catch (err) {
          console.error("[maps] all-active fetch failed:", err);
          setActiveShifts({});
        }

        // Bugünkü ziyaretleri çek
        try {
          const { data: visitsData } = await apiClient.get<VisitItem[]>(
            "/operations/visits",
            { params: { page_size: 200 } }
          );
          setVisits(Array.isArray(visitsData) ? visitsData : []);
        } catch {
          setVisits([]);
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
      } catch {
        // sessizce geç
      }
    }
    load();
  }, []);

  // Her temsilci için en iyi mevcut koordinat (öncelik sırası):
  // 1. Anlık konum (current_lat/lng) — mobil 30sn'de bir günceller
  // 2. Vardiya başlangıç konumu (start_lat/lng)
  // 3. Bugünkü en son ziyaretin GPS koordinatı
  function getBestLocation(repId: string): { lat: number; lng: number; timestamp: string; isLive: boolean } | null {
    const shift = activeShifts[repId];

    // 1. Anlık konum — en güncel
    if (shift?.current_lat && shift?.current_lng) {
      return {
        lat: shift.current_lat,
        lng: shift.current_lng,
        timestamp: shift.location_updated_at ?? shift.start_time,
        isLive: true,
      };
    }

    // 2. Vardiya başlangıç konumu
    if (shift?.start_lat && shift?.start_lng) {
      return {
        lat: shift.start_lat,
        lng: shift.start_lng,
        timestamp: shift.start_time,
        isLive: false,
      };
    }

    // 3. Bugünkü en son ziyaretin GPS koordinatı
    const repVisits = visits
      .filter((v) => v.user_id === repId && v.gps_lat && v.gps_lng)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (repVisits.length > 0) {
      const last = repVisits[0];
      return {
        lat: last.gps_lat!,
        lng: last.gps_lng!,
        timestamp: last.timestamp,
        isLive: false,
      };
    }

    return null;
  }

  const filteredVisits = selectedRep
    ? visits.filter((v) => v.user_id === selectedRep)
    : visits;

  const filteredRoutes = selectedRep
    ? routes.filter((r) => r.user_id === selectedRep)
    : routes;

  const filteredReps = selectedRep
    ? fieldReps.filter((r) => r.id === selectedRep)
    : fieldReps;

  // Konumu olan temsilciler (null olanları haritada gösterme)
  const repsWithLocation = filteredReps
    .map((rep) => ({ rep, loc: getBestLocation(rep.id) }))
    .filter(
      (x): x is { rep: User; loc: NonNullable<ReturnType<typeof getBestLocation>> } =>
        x.loc !== null
    );

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] gap-4">
      {/* Başlık */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Harita Takibi</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Saha temsilcilerini ve rotalarını canlı izleyin
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Canlı
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Sol panel — filtreler */}
        <div className="w-full lg:w-64 shrink-0 space-y-3">
          {/* Katman kontrolleri */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
              Katmanlar
            </p>
            <LayerToggle
              icon={<Users className="w-3.5 h-3.5" />}
              label="Temsilciler"
              active={showReps}
              color="bg-indigo-500"
              onToggle={() => setShowReps((v) => !v)}
            />
            <LayerToggle
              icon={<MapPin className="w-3.5 h-3.5" />}
              label="Ziyaretler"
              active={showVisits}
              color="bg-emerald-500"
              onToggle={() => setShowVisits((v) => !v)}
            />
            <LayerToggle
              icon={<Route className="w-3.5 h-3.5" />}
              label="Rotalar"
              active={showRoutes}
              color="bg-amber-500"
              onToggle={() => setShowRoutes((v) => !v)}
            />
          </div>

          {/* Temsilci filtresi */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
              Temsilci Filtresi
            </p>
            <button
              onClick={() => setSelectedRep(null)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                selectedRep === null
                  ? "bg-[var(--primary)] text-white"
                  : "hover:bg-[var(--muted)] text-[var(--foreground)]"
              )}
            >
              Tümü
            </button>
            {fieldReps.map((rep) => (
              <button
                key={rep.id}
                onClick={() => setSelectedRep(rep.id === selectedRep ? null : rep.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                  selectedRep === rep.id
                    ? "bg-[var(--primary)] text-white"
                    : "hover:bg-[var(--muted)] text-[var(--foreground)]"
                )}
              >
                <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {rep.name.charAt(0)}
                </span>
                <span className="truncate">{rep.name}</span>
              </button>
            ))}
          </div>

          {/* Özet istatistikler */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
              Bugün
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StatChip label="Ziyaret" value={filteredVisits.length} />
              <StatChip
                label="Başarılı"
                value={filteredVisits.filter((v) => v.is_successful).length}
                color="text-emerald-600"
              />
              <StatChip label="Aktif" value={repsWithLocation.length} />
              <StatChip label="Rota" value={filteredRoutes.length} />
            </div>
          </div>
        </div>

        {/* Harita */}
        <div className="flex-1 min-h-64 rounded-xl overflow-hidden border border-[var(--border)] shadow-sm">
          {!API_KEY ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--muted)] gap-3">
              <MapPin className="w-10 h-10 text-[var(--muted-foreground)]" />
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
            // key="static" — APIProvider'ın state değişimlerinde yeniden mount edilmesini önler
            // Bu olmadan filtreleme/toggle yaptıkça harita merkezi Antalya'ya sıfırlanıyordu
            <APIProvider key="maps-provider" apiKey={API_KEY}>
              <Map
                defaultCenter={ANTALYA_CENTER}
                defaultZoom={12}
                mapId="antalyamarket-map"
                gestureHandling="greedy"
                disableDefaultUI={false}
                style={{ width: "100%", height: "100%" }}
              >
                {/* Temsilci konumları — anlık veya vardiya başlangıç konumu */}
                {showReps &&
                  repsWithLocation.map(({ rep, loc }) => {
                    const repLoc: RepLocationFull = {
                      user_id: rep.id,
                      name: rep.name,
                      lat: loc.lat,
                      lng: loc.lng,
                      timestamp: loc.timestamp,
                      isLive: loc.isLive,
                    };
                    return (
                      <RepMarker
                        key={rep.id}
                        rep={repLoc}
                        shift={activeShifts[rep.id] ?? null}
                      />
                    );
                  })}

                {/* Ziyaret noktaları */}
                {showVisits &&
                  filteredVisits.map((visit) => (
                    <VisitMarker key={visit.id} visit={visit} />
                  ))}

                {/* Rotalar */}
                {showRoutes &&
                  filteredRoutes.map((route) => (
                    <RoutePolyline key={route.id} route={toRouteForMap(route)} />
                  ))}
              </Map>
            </APIProvider>
          )}
        </div>
      </div>
    </div>
  );
}

function LayerToggle({
  icon,
  label,
  active,
  color,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  color: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2.5 w-full text-sm text-[var(--foreground)] hover:text-[var(--foreground)] transition-colors"
      aria-pressed={active}
    >
      <span className={cn("w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0 transition-opacity", color, !active && "opacity-30")}>
        {icon}
      </span>
      <span className={cn("flex-1 text-left", !active && "text-[var(--muted-foreground)]")}>{label}</span>
      {active ? (
        <Eye className="w-3.5 h-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
      ) : (
        <EyeOff className="w-3.5 h-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
      )}
    </button>
  );
}

function StatChip({
  label,
  value,
  color = "text-[var(--foreground)]",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-[var(--muted)] rounded-lg px-2.5 py-2 text-center">
      <p className={cn("text-lg font-bold", color)}>{value}</p>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}
