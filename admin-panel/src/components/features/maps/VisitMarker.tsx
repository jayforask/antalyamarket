"use client";

import { AdvancedMarker, InfoWindow, useAdvancedMarkerRef } from "@vis.gl/react-google-maps";
import { useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

// Backend VisitOut şemasıyla uyumlu — gps_lat/gps_lng
export interface VisitForMarker {
  id: string;
  market_id: string;
  user_id: string;
  timestamp: string;
  is_successful: boolean;
  gps_lat?: number | null;
  gps_lng?: number | null;
  note?: string | null;
  market?: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null;
  user?: {
    id: string;
    name: string;
  } | null;
}

interface VisitMarkerProps {
  visit: VisitForMarker;
}

export function VisitMarker({ visit }: VisitMarkerProps) {
  const [open, setOpen] = useState(false);
  const [markerRef, marker] = useAdvancedMarkerRef();

  // GPS koordinatı yoksa market koordinatını kullan, o da yoksa render etme
  const lat = visit.gps_lat ?? visit.market?.latitude;
  const lng = visit.gps_lng ?? visit.market?.longitude;

  if (!lat || !lng) return null;

  const isSuccess = visit.is_successful;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat, lng }}
        onClick={() => setOpen(true)}
        title={visit.market?.name}
      >
        {/* Ziyaret pin'i — yeşil/kırmızı küçük kare */}
        <div
          className={[
            "flex items-center justify-center w-7 h-7 rounded-lg border-2 border-white shadow-md cursor-pointer",
            isSuccess ? "bg-emerald-500" : "bg-red-500",
          ].join(" ")}
          aria-label={`Ziyaret: ${visit.market?.name ?? "Market"}`}
        >
          {isSuccess ? (
            <CheckCircle className="w-3.5 h-3.5 text-white" aria-hidden="true" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-white" aria-hidden="true" />
          )}
        </div>
      </AdvancedMarker>

      {open && marker && (
        <InfoWindow
          anchor={marker}
          onCloseClick={() => setOpen(false)}
          headerContent={
            <p className="font-semibold text-sm">{visit.market?.name ?? "Market"}</p>
          }
        >
          <div className="text-xs space-y-1 py-1 min-w-40">
            <p className="text-gray-600">{visit.market?.address}</p>
            {visit.user?.name && (
              <p className="text-gray-500">
                Temsilci:{" "}
                <span className="font-medium text-gray-700">{visit.user.name}</span>
              </p>
            )}
            <p className="text-gray-500">{formatDateTime(visit.timestamp)}</p>
            {visit.note && (
              <p className="text-gray-500 italic">&quot;{visit.note}&quot;</p>
            )}
            <p
              className={
                isSuccess ? "text-emerald-600 font-medium" : "text-red-600 font-medium"
              }
            >
              {isSuccess ? "✓ Başarılı" : "✗ Başarısız"}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}
