"use client";

import { AdvancedMarker, InfoWindow, useAdvancedMarkerRef } from "@vis.gl/react-google-maps";
import { useState } from "react";
import type { RepLocation } from "@/types";

interface RepMarkerProps {
  rep: RepLocation & { name: string };
  color?: string;
}

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

export function RepMarker({ rep, color }: RepMarkerProps) {
  const [open, setOpen] = useState(false);
  const [markerRef, marker] = useAdvancedMarkerRef();

  const bg = color ?? COLORS[parseInt(rep.user_id.replace(/\D/g, ""), 10) % COLORS.length];

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: rep.lat, lng: rep.lng }}
        onClick={() => setOpen(true)}
        title={rep.name}
      >
        {/* Temsilci pin'i — renkli daire + baş harf */}
        <div
          className="flex items-center justify-center w-9 h-9 rounded-full border-2 border-white shadow-lg text-white text-sm font-bold cursor-pointer select-none"
          style={{ backgroundColor: bg }}
          aria-label={`Temsilci: ${rep.name}`}
        >
          {rep.name.charAt(0).toUpperCase()}
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
          <div className="text-xs space-y-1 py-1">
            <p className="text-gray-500">
              {rep.lat.toFixed(5)}, {rep.lng.toFixed(5)}
            </p>
            <p className="text-gray-500">
              Son güncelleme:{" "}
              {new Date(rep.timestamp).toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}
