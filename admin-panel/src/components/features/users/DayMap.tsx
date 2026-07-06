"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";
import type { ShiftDetail, VisitDetail } from "@/lib/api/users";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const ANTALYA_CENTER = { lat: 36.8969, lng: 30.7133 };

export interface DayMapPoint {
  lat: number;
  lng: number;
  type: "start" | "visit" | "end";
  label: string;
  visit?: VisitDetail;
}

interface DayMapProps {
  shift: ShiftDetail | null;
  visits: VisitDetail[];
}

// ─── Outer shell: API provider + empty-state guard ───────────────────────────

export function DayMap({ shift, visits }: DayMapProps) {
  const points = useMemo<DayMapPoint[]>(() => {
    const result: DayMapPoint[] = [];

    if (shift?.start_lat && shift?.start_lng) {
      result.push({ lat: shift.start_lat, lng: shift.start_lng, type: "start", label: "Vardiya Başlangıcı" });
    }

    visits.forEach((v, i) => {
      const lat = v.gps_lat ?? v.market?.latitude;
      const lng = v.gps_lng ?? v.market?.longitude;
      if (lat && lng) {
        result.push({ lat, lng, type: "visit", label: v.market?.name ?? `Ziyaret ${i + 1}`, visit: v });
      }
    });

    if (shift?.end_lat && shift?.end_lng) {
      result.push({ lat: shift.end_lat, lng: shift.end_lng, type: "end", label: "Vardiya Bitişi" });
    }

    return result;
  }, [shift, visits]);

  const center = useMemo(() => {
    if (points.length === 0) return ANTALYA_CENTER;
    const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return { lat: avgLat, lng: avgLng };
  }, [points]);

  if (!API_KEY) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--muted)] gap-3 rounded-xl">
        <MapPin className="w-10 h-10 text-[var(--muted-foreground)]" />
        <div className="text-center px-4">
          <p className="font-semibold text-[var(--foreground)]">Google Maps API Anahtarı Gerekli</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            <code className="bg-[var(--border)] px-1 py-0.5 rounded text-xs">
              NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
            </code>{" "}
            ortam değişkenini ayarlayın
          </p>
        </div>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--muted)] gap-3 rounded-xl">
        <MapPin className="w-10 h-10 text-[var(--muted-foreground)]" />
        <p className="text-sm text-[var(--muted-foreground)]">Bu gün için konum verisi yok</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        center={center}
        zoom={13}
        mapId="user-day-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: "100%", height: "100%" }}
      >
        <DayMapOverlays points={points} />
      </Map>
    </APIProvider>
  );
}

// ─── Inner overlays: polyline + markers via native Maps API ──────────────────

function DayMapOverlays({ points }: { points: DayMapPoint[] }) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const [activePoint, setActivePoint] = useState<DayMapPoint | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;

    // Temizle
    polylineRef.current?.setMap(null);
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    infoWindowRef.current?.close();

    const path = points.map((p) => ({ lat: p.lat, lng: p.lng }));

    // Rota çizgisi
    if (path.length > 1) {
      polylineRef.current = new mapsLib.Polyline({
        path,
        map,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.75,
        strokeWeight: 3,
        geodesic: true,
      });
    }

    // Info window (tek, paylaşımlı)
    infoWindowRef.current = new google.maps.InfoWindow();

    let visitIndex = 0;

    // Marker'lar
    points.forEach((point) => {
      let icon: google.maps.Symbol | google.maps.Icon;
      let zIndex = 5;

      if (point.type === "start") {
        icon = {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#10b981",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 3,
        };
        zIndex = 20;
      } else if (point.type === "end") {
        icon = {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#71717a",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 3,
        };
        zIndex = 20;
      } else {
        visitIndex++;
        icon = {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 13,
          fillColor: point.visit?.is_successful ? "#3b82f6" : "#ef4444",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        };
        zIndex = 10;
      }

      const marker = new google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        map,
        icon,
        zIndex,
        label:
          point.type === "visit"
            ? { text: String(visitIndex), color: "#fff", fontWeight: "bold", fontSize: "11px" }
            : point.type === "start"
            ? { text: "▶", color: "#fff", fontSize: "10px" }
            : { text: "■", color: "#fff", fontSize: "10px" },
        title: point.label,
      });

      marker.addListener("click", () => {
        const v = point.visit;
        const timeStr = v
          ? new Date(v.timestamp).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Istanbul",
            })
          : "";

        const successHtml = v
          ? `<p style="margin:4px 0 0;font-size:12px;color:${v.is_successful ? "#059669" : "#dc2626"};font-weight:600;">
               ${v.is_successful ? "✓ Başarılı" : "✗ Başarısız"}
             </p>`
          : "";

        const addressHtml =
          v?.market?.address
            ? `<p style="margin:2px 0 0;font-size:11px;color:#6b7280;max-width:220px;">${v.market.address}</p>`
            : "";

        const noteHtml =
          v?.note
            ? `<p style="margin:4px 0 0;font-size:11px;color:#9ca3af;font-style:italic;max-width:220px;">"${v.note}"</p>`
            : "";

        infoWindowRef.current!.setContent(`
          <div style="padding:4px 2px;font-family:system-ui,sans-serif;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#111827;">${point.label}</p>
            ${timeStr ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${timeStr}</p>` : ""}
            ${successHtml}${addressHtml}${noteHtml}
          </div>
        `);
        infoWindowRef.current!.open({ anchor: marker, map });
      });

      markersRef.current.push(marker);
    });

    return () => {
      polylineRef.current?.setMap(null);
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      infoWindowRef.current?.close();
    };
  }, [map, mapsLib, points]);

  // suppress unused warning
  void activePoint;
  void setActivePoint;

  return null;
}
