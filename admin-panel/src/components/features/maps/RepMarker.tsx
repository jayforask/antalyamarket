"use client";

import { AdvancedMarker, InfoWindow, useAdvancedMarkerRef } from "@vis.gl/react-google-maps";
import { useState } from "react";

interface ShiftInfo {
  start_time: string;
  status: string;
}

// RepLocation + isLive flag — maps/page.tsx tarafından sağlanır
export interface RepLocationFull {
  user_id: string;
  name: string;
  lat: number;
  lng: number;
  timestamp: string;
  isLive?: boolean; // true = current_lat/lng, false = start veya ziyaret konumu
}

interface RepMarkerProps {
  rep: RepLocationFull;
  color?: string;
  shift?: ShiftInfo | null;
}

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

function formatDuration(startIso: string): string {
  const diffMs = Date.now() - new Date(startIso).getTime();
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}dk`;
  if (m === 0) return `${h}s`;
  return `${h}s ${m}dk`;
}

export function RepMarker({ rep, color, shift }: RepMarkerProps) {
  const [open, setOpen] = useState(false);
  const [markerRef, marker] = useAdvancedMarkerRef();

  const bg = color ?? COLORS[parseInt(rep.user_id.replace(/\D/g, ""), 10) % COLORS.length];
  const isActive = shift?.status === "active";

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: rep.lat, lng: rep.lng }}
        onClick={() => setOpen(true)}
        title={rep.name}
      >
        {/* Temsilci pin'i — renkli daire + baş harf + aktif pulse */}
        <div className="relative cursor-pointer select-none">
          {isActive && (
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-40"
              style={{ backgroundColor: bg }}
              aria-hidden="true"
            />
          )}
          <div
            className="relative flex items-center justify-center w-9 h-9 rounded-full border-2 border-white shadow-lg text-white text-sm font-bold"
            style={{ backgroundColor: bg }}
            aria-label={`Temsilci: ${rep.name}`}
          >
            {rep.name.charAt(0).toUpperCase()}
          </div>
          {/* Anlık konum göstergesi — yeşil nokta */}
          {rep.isLive && (
            <span
              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white"
              aria-label="Anlık konum"
            />
          )}
        </div>
      </AdvancedMarker>

      {open && marker && (
        <InfoWindow
          anchor={marker}
          onCloseClick={() => setOpen(false)}
          headerContent={
            <p className="font-semibold text-sm">{rep.name}</p>
          }
        >
          <div className="text-xs space-y-1.5 py-1 min-w-[160px]">
            {shift ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-emerald-500" : "bg-zinc-400"}`}
                  />
                  <span className="font-medium text-gray-700">
                    Vardiya {isActive ? "Aktif" : "Tamamlandı"}
                  </span>
                </div>
                <p className="text-gray-500">
                  Başlangıç:{" "}
                  <span className="font-medium text-gray-700">
                    {formatTime(shift.start_time)}
                  </span>
                </p>
                {isActive && (
                  <p className="text-gray-500">
                    Süre:{" "}
                    <span className="font-medium text-gray-700">
                      {formatDuration(shift.start_time)}
                    </span>
                  </p>
                )}
                <p className="text-gray-500">
                  Konum:{" "}
                  <span className={`font-medium ${rep.isLive ? "text-emerald-600" : "text-gray-700"}`}>
                    {rep.isLive ? "🟢 Anlık" : "📍 Başlangıç"}
                  </span>
                </p>
                {rep.isLive && (
                  <p className="text-gray-400">
                    Güncellendi: {formatTime(rep.timestamp)}
                  </p>
                )}
                <p className="text-gray-400">
                  {rep.lat.toFixed(5)}, {rep.lng.toFixed(5)}
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
                  Aktif vardiya yok
                </p>
                <p className="text-gray-400">
                  {rep.lat.toFixed(5)}, {rep.lng.toFixed(5)}
                </p>
              </>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}
