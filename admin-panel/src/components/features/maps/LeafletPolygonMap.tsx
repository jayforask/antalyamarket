"use client";

import { useEffect, useRef, useState, Dispatch, SetStateAction } from "react";
import type { Market } from "@/types";

interface LeafletPolygonMapProps {
  points: { latitude: number; longitude: number }[];
  setPoints: Dispatch<SetStateAction<{ latitude: number; longitude: number }[]>>;
  previewMarkets: Market[];
  fitBoundsTrigger?: number;
}

export default function LeafletPolygonMap({
  points,
  setPoints,
  previewMarkets,
  fitBoundsTrigger,
}: LeafletPolygonMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const vertexMarkersRef = useRef<any[]>([]);
  const marketMarkersRef = useRef<any[]>([]);

  // Leaflet kütüphanesini ve CSS'ini istemci tarafında yükle
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    const loadLeaflet = async () => {
      const leaflet = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      setL(leaflet);
    };
    loadLeaflet();
  }, []);

  // Haritayı başlat
  useEffect(() => {
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

    // Antalya Merkez koordinatları
    const center: [number, number] = [36.8969, 30.7133];

    // Harita örneğini oluştur
    const map = L.map(mapContainerRef.current).setView(center, 12);
    mapInstanceRef.current = map;

    // Ücretsiz OpenStreetMap katmanını ekle
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Tıklama olayını dinle (Poligon köşesi ekleme)
    map.on("click", (e: any) => {
      const { lat, lng } = e.latlng;
      setPoints((prev: any) => [...prev, { latitude: lat, longitude: lng }]);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [L]);

  // Arama sonrası poligon sınırlarına odaklan
  useEffect(() => {
    if (!L || !mapInstanceRef.current || points.length === 0) return;
    const latLngs: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
    const bounds = L.latLngBounds(latLngs);
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
  }, [L, fitBoundsTrigger]);

  // Poligon çizimini ve köşe noktalarını güncelle
  useEffect(() => {
    if (!L || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Eski köşeleri temizle
    vertexMarkersRef.current.forEach((m) => m.remove());
    vertexMarkersRef.current = [];

    // Eski poligonu temizle
    if (polygonRef.current) {
      polygonRef.current.remove();
      polygonRef.current = null;
    }

    if (points.length === 0) return;

    const latLngs: [number, number][] = points.map((p) => [p.latitude, p.longitude]);

    // Poligon çiz
    if (points.length >= 2) {
      polygonRef.current = L.polygon(latLngs, {
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.2,
        weight: 3,
      }).addTo(map);
    }

    // Köşelere küçük daireler ekle (tıklanıp silinebilir yapmak için)
    points.forEach((pt, idx) => {
      const marker = L.circleMarker([pt.latitude, pt.longitude], {
        radius: 6,
        fillColor: "#ef4444",
        color: "#ffffff",
        weight: 2,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip(`Köşe #${idx + 1} (Silmek için tıklayın)`, { permanent: false, direction: "top" });

      // Köşe noktasına tıklandığında o noktayı sil
      marker.on("click", (e: any) => {
        L.DomEvent.stopPropagation(e);
        const newPoints = points.filter((_, i) => i !== idx);
        setPoints(newPoints);
      });

      vertexMarkersRef.current.push(marker);
    });
  }, [L, points, setPoints]);

  // Poligon içinde kalan marketleri haritada göster
  useEffect(() => {
    if (!L || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Eski market pinlerini temizle
    marketMarkersRef.current.forEach((m) => m.remove());
    marketMarkersRef.current = [];

    if (!previewMarkets || previewMarkets.length === 0) return;

    // Seçilen marketleri haritaya küçük mavi noktalar olarak çiz
    previewMarkets.forEach((market) => {
      const marker = L.circleMarker([market.latitude, market.longitude], {
        radius: 5,
        fillColor: "#10b981", // yeşil renk (seçilenler)
        color: "#ffffff",
        weight: 1,
        fillOpacity: 0.9,
      })
        .addTo(map)
        .bindTooltip(`<b>${market.name}</b><br/>${market.address}`, { permanent: false, direction: "top" });

      marketMarkersRef.current.push(marker);
    });
  }, [L, previewMarkets]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-[var(--border)] shadow-inner bg-[var(--muted)]">
      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: "450px" }} />
      <div className="absolute top-2 right-2 z-[1000] bg-white dark:bg-[var(--card)] px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--foreground)] font-medium shadow-md">
        📍 Haritaya tıklayarak poligon köşelerini ekleyin. Köşeleri silmek için üzerlerine tıklayabilirsiniz.
      </div>
    </div>
  );
}
