"use client";

import { AdvancedMarker, InfoWindow, useAdvancedMarkerRef } from "@vis.gl/react-google-maps";
import { useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import type { Visit } from "@/types";
import { formatDateTime } from "@/lib/utils";

interface VisitMarkerProps {
  visit: Visit;
}

export function VisitMarker({ visit }: VisitMarkerProps) {
  const [open, setOpen] = useState(false);
  const [markerRef, marker] = useAdvancedMarkerRef();

  const isSuccess = visit.is_successful;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: visit.gps_coords.lat, lng: visit.gps_coords.lng }}
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
            <p className="text-gray-500">
              Temsilci: <span className="font-medium text-gray-700">{visit.user?.name}</span>
            </p>
            <p className="text-gray-500">{formatDateTime(visit.timestamp)}</p>
            {visit.note && (
              <p className="text-gray-500 italic">&quot;{visit.note}&quot;</p>
            )}
            <p className={isSuccess ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
              {isSuccess ? "✓ Başarılı" : "✗ Başarısız"}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}
