"use client";

import { useState } from "react";
import { APIProvider, Map } from "@vis.gl/react-google-maps";
import { RepMarker } from "@/components/features/maps/RepMarker";
import { VisitMarker } from "@/components/features/maps/VisitMarker";
import { RoutePolyline } from "@/components/features/maps/RoutePolyline";
import { MOCK_REPS, MOCK_ROUTES } from "@/lib/api/routes";
import type { Visit } from "@/types";
import { MapPin, Route, Users, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// Antalya merkezli mock ziyaret verileri
const MOCK_VISITS: Visit[] = [
  { id: "1", market_id: "1", user_id: "u1", timestamp: "2024-07-03T09:15:00Z", gps_coords: { lat: 36.884, lng: 30.695 }, is_successful: true, note: "Sipariş alındı", market: { id: "1", name: "Migros Konyaaltı", type: "market", address: "Konyaaltı Cad. No:15", latitude: 36.884, longitude: 30.695, is_verified: true, is_corporate: false, source: "api", created_at: "" }, user: { id: "u1", name: "Ahmet Yılmaz", email: "", role: "field_rep", created_at: "" } },
  { id: "2", market_id: "2", user_id: "u2", timestamp: "2024-07-03T10:30:00Z", gps_coords: { lat: 36.862, lng: 30.731 }, is_successful: false, note: "Müşteri yoktu", market: { id: "2", name: "ŞokMarket Lara", type: "market", address: "Lara Cad. No:42", latitude: 36.862, longitude: 30.731, is_verified: true, is_corporate: false, source: "api", created_at: "" }, user: { id: "u2", name: "Fatma Kaya", email: "", role: "field_rep", created_at: "" } },
  { id: "3", market_id: "3", user_id: "u1", timestamp: "2024-07-03T11:45:00Z", gps_coords: { lat: 36.879, lng: 30.712 }, is_successful: true, market: { id: "3", name: "BİM Muratpaşa", type: "market", address: "Muratpaşa Mah. No:5", latitude: 36.879, longitude: 30.712, is_verified: true, is_corporate: false, source: "api", created_at: "" }, user: { id: "u1", name: "Ahmet Yılmaz", email: "", role: "field_rep", created_at: "" } },
  { id: "4", market_id: "4", user_id: "u3", timestamp: "2024-07-03T13:00:00Z", gps_coords: { lat: 36.872, lng: 30.699 }, is_successful: true, market: { id: "4", name: "A101 Kepez", type: "market", address: "Kepez Mah. No:12", latitude: 36.872, longitude: 30.699, is_verified: true, is_corporate: false, source: "api", created_at: "" }, user: { id: "u3", name: "Mehmet Demir", email: "", role: "field_rep", created_at: "" } },
];

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

// Antalya merkezi
const ANTALYA_CENTER = { lat: 36.8969, lng: 30.7133 };

export default function MapsPage() {
  const [showReps, setShowReps] = useState(true);
  const [showVisits, setShowVisits] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [selectedRep, setSelectedRep] = useState<string | null>(null);

  const filteredVisits = selectedRep
    ? MOCK_VISITS.filter((v) => v.user_id === selectedRep)
    : MOCK_VISITS;

  const filteredRoutes = selectedRep
    ? MOCK_ROUTES.filter((r) => r.user_id === selectedRep)
    : MOCK_ROUTES;

  const filteredReps = selectedRep
    ? MOCK_REPS.filter((r) => r.user_id === selectedRep)
    : MOCK_REPS;

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
            {MOCK_REPS.map((rep) => (
              <button
                key={rep.user_id}
                onClick={() => setSelectedRep(rep.user_id === selectedRep ? null : rep.user_id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                  selectedRep === rep.user_id
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
              <StatChip label="Aktif" value={filteredReps.length} />
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
            <APIProvider apiKey={API_KEY}>
              <Map
                defaultCenter={ANTALYA_CENTER}
                defaultZoom={12}
                mapId="antalyamarket-map"
                gestureHandling="greedy"
                disableDefaultUI={false}
                style={{ width: "100%", height: "100%" }}
              >
                {/* Temsilci konumları */}
                {showReps &&
                  filteredReps.map((rep) => (
                    <RepMarker key={rep.user_id} rep={rep} />
                  ))}

                {/* Ziyaret noktaları */}
                {showVisits &&
                  filteredVisits.map((visit) => (
                    <VisitMarker key={visit.id} visit={visit} />
                  ))}

                {/* Rotalar */}
                {showRoutes &&
                  filteredRoutes.map((route) => (
                    <RoutePolyline key={route.id} route={route} />
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
