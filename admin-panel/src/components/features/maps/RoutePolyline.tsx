"use client";

import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";
import type { Route } from "@/types";

interface RoutePolylineProps {
  route: Route;
  color?: string;
  opacity?: number;
  weight?: number;
  /** Stop marker'larını göster */
  showStopNumbers?: boolean;
}

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

export function RoutePolyline({
  route,
  color,
  opacity = 0.85,
  weight = 4,
  showStopNumbers = true,
}: RoutePolylineProps) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const geometryLib = useMapsLibrary("geometry");
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const lineColor =
    color ?? COLORS[parseInt(route.user_id.replace(/\D/g, ""), 10) % COLORS.length];

  useEffect(() => {
    if (!map || !mapsLib) return;

    // OSRM polylines varsa decode et, yoksa düz çizgi çiz
    let path: google.maps.LatLng[] | { lat: number; lng: number }[] = [];

    if (route.polyline && geometryLib) {
      try {
        path = geometryLib.encoding.decodePath(route.polyline);
      } catch (e) {
        console.error("Error decoding route polyline:", e);
      }
    }

    // Fallback: polyline yoksa veya hata oluştuysa düz çizgi çiz
    if (path.length === 0) {
      path = route.stops
        .filter((s) => s.market?.latitude && s.market?.longitude)
        .sort((a, b) => a.order_index - b.order_index)
        .map((s) => ({
          lat: s.market!.latitude,
          lng: s.market!.longitude,
        }));
    }

    if (path.length < 2) return;

    // Polyline çiz
    polylineRef.current = new mapsLib.Polyline({
      path,
      map,
      strokeColor: lineColor,
      strokeOpacity: opacity,
      strokeWeight: weight,
      geodesic: true,
    });

    // Durak numarası marker'ları
    if (showStopNumbers) {
      markersRef.current = route.stops
        .filter((s) => s.market?.latitude && s.market?.longitude)
        .sort((a, b) => a.order_index - b.order_index)
        .map((stop, i) => {
          const statusColor =
            stop.status === "visited"
              ? "#10b981"
              : stop.status === "skipped"
              ? "#ef4444"
              : "#6b7280";

          return new google.maps.Marker({
            position: {
              lat: stop.market!.latitude,
              lng: stop.market!.longitude,
            },
            map,
            label: {
              text: String(i + 1),
              color: "#fff",
              fontWeight: "bold",
              fontSize: "11px",
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: statusColor,
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
            title: stop.market?.name,
            zIndex: 10,
          });
        });
    }

    return () => {
      polylineRef.current?.setMap(null);
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [map, mapsLib, route, lineColor, opacity, weight, showStopNumbers]);

  return null; // Render edilecek JSX yok, Google Maps API doğrudan kullanılıyor
}
