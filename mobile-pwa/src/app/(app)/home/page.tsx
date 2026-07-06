"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Play, StopCircle, ChevronRight, CheckCircle, Loader2 } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { startShift, endShift, getActiveShift, updateShiftLocation, type ShiftOut } from "@/lib/api/shifts";
import { apiClient } from "@/lib/api/client";
import type { VisitOut } from "@/lib/api/visits";

export default function HomePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const now = new Date();

  const [shift, setShift] = useState<ShiftOut | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);

  const [visits, setVisits] = useState<VisitOut[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);

  // Geçen süreyi her saniye yeniden hesaplamak için tick state'i
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationPingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Aktif vardiyayı yükle
  useEffect(() => {
    getActiveShift().then(setShift).catch(() => setShift(null));
  }, []);

  // Shift aktifken timer'ı ve konum ping'ini başlat, bitince durdur
  useEffect(() => {
    if (shift?.status === "active") {
      // Saniye sayacı
      timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);

      // 30 saniyede bir anlık konumu backend'e gönder
      const sendLocation = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            updateShiftLocation({
              current_lat: pos.coords.latitude,
              current_lng: pos.coords.longitude,
            }).catch(() => {
              // Sessiz hata — kullanıcıyı rahatsız etme
            });
          },
          () => {
            // Konum izni yoksa / zaman aşımı — sessiz geç
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 20000 }
        );
      };

      // Sayfa açılır açılmaz bir kez gönder, sonra 30sn'de bir
      sendLocation();
      locationPingRef.current = setInterval(sendLocation, 30_000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (locationPingRef.current) {
        clearInterval(locationPingRef.current);
        locationPingRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (locationPingRef.current) {
        clearInterval(locationPingRef.current);
        locationPingRef.current = null;
      }
    };
  }, [shift?.status]);

  const loadVisits = useCallback(async () => {
    setVisitsLoading(true);
    try {
      const { data } = await apiClient.get<VisitOut[]>("/operations/visits", {
        params: { page: 1, page_size: 10 },
      });
      // Bugünün ziyaretlerini filtrele
      const today = new Date().toDateString();
      setVisits(data.filter((v) => new Date(v.timestamp).toDateString() === today));
    } catch {
      setVisits([]);
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  // tick değişince yeniden hesaplanır — gerçek zamanlı sayaç
  const getElapsed = () => {
    if (!shift?.start_time) return "00:00:00";
    const raw = shift.start_time.endsWith("Z") || shift.start_time.includes("+")
      ? shift.start_time
      : shift.start_time + "Z";
    const startMs = new Date(raw).getTime();
    if (isNaN(startMs)) return "00:00:00";
    // tick bağımlılığı — her saniye yeniden render
    void tick;
    const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    const h = Math.floor(diff / 3600).toString().padStart(2, "0");
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, "0");
    const s = (diff % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const handleShiftToggle = async () => {
    setShiftLoading(true);
    setShiftError(null);
    try {
      if (shift) {
        // Vardiyayı bitir — konum al
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const result = await endShift({
                end_lat: pos.coords.latitude,
                end_lng: pos.coords.longitude,
              });
              setShift(result.status === "completed" ? null : result);
              setShiftLoading(false);
            },
            async () => {
              // Konum alınamazsa varsayılan koordinat
              const result = await endShift({ end_lat: 0, end_lng: 0 });
              setShift(result.status === "completed" ? null : result);
              setShiftLoading(false);
            }
          );
        } else {
          const result = await endShift({ end_lat: 0, end_lng: 0 });
          setShift(result.status === "completed" ? null : result);
          setShiftLoading(false);
        }
      } else {
        // Vardiyayı başlat — konum al
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const result = await startShift({
                start_lat: pos.coords.latitude,
                start_lng: pos.coords.longitude,
              });
              setShift(result);
              setShiftLoading(false);
            },
            async () => {
              const result = await startShift({ start_lat: 0, start_lng: 0 });
              setShift(result);
              setShiftLoading(false);
            }
          );
        } else {
          const result = await startShift({ start_lat: 0, start_lng: 0 });
          setShift(result);
          setShiftLoading(false);
        }
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Vardiya işlemi başarısız oldu.";
      setShiftError(msg);
      setShiftLoading(false);
    }
  };

  const isActive = !!shift;

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      {/* Karşılama */}
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          {new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(now)}
        </p>
        <h1 className="text-xl font-bold text-[var(--foreground)] mt-0.5">
          Merhaba, {user?.name?.split(" ")[0] ?? "Temsilci"} 👋
        </h1>
      </div>

      {/* Vardiya Kartı */}
      <div className={cn(
        "rounded-2xl p-5 border transition-colors",
        isActive
          ? "bg-[var(--primary)] text-white border-blue-400"
          : "bg-[var(--card)] border-[var(--border)]"
      )}>
        <div className="flex items-start justify-between">
          <div>
            <p className={cn("text-sm font-medium", isActive ? "text-blue-100" : "text-[var(--muted-foreground)]")}>
              Vardiya
            </p>
            <p className={cn("text-2xl font-bold mt-1 tabular-nums", isActive ? "text-white" : "text-[var(--foreground)]")}>
              {isActive ? getElapsed() : "—"}
            </p>
            {shift?.start_time && (
              <p className="text-xs text-blue-100 mt-0.5">
                Başlangıç: {formatTime(new Date(shift.start_time))}
              </p>
            )}
            {shiftError && (
              <p className="text-xs text-red-200 mt-1">{shiftError}</p>
            )}
          </div>
          <button
            onClick={handleShiftToggle}
            disabled={shiftLoading}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              isActive
                ? "bg-white text-[var(--primary)]"
                : "bg-[var(--primary)] text-white"
            )}
            aria-label={isActive ? "Vardiyayı bitir" : "Vardiyayı başlat"}
          >
            {shiftLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : isActive ? (
              <><StopCircle className="w-4 h-4" aria-hidden="true" /> Bitir</>
            ) : (
              <><Play className="w-4 h-4" aria-hidden="true" /> Başlat</>
            )}
          </button>
        </div>
      </div>

      {/* Hızlı aksiyonlar */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push("/visit")}
          className="flex flex-col items-start gap-2 p-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-600" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold text-[var(--foreground)]">Ziyaret Başlat</span>
        </button>
        <button
          onClick={() => router.push("/order")}
          className="flex flex-col items-start gap-2 p-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Clock className="w-5 h-5 text-emerald-600" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold text-[var(--foreground)]">Sipariş Al</span>
        </button>
      </div>

      {/* Bugünkü ziyaretler */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Bugünkü Ziyaretler</h2>
          {!visitsLoading && (
            <span className="text-xs text-[var(--muted-foreground)]">{visits.length} ziyaret</span>
          )}
        </div>

        {visitsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
          </div>
        ) : visits.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
            Bugün henüz ziyaret yok.
          </p>
        ) : (
          <div className="space-y-2">
            {visits.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 p-3.5 bg-[var(--card)] border border-[var(--border)] rounded-xl"
              >
                <span className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  v.is_successful ? "bg-emerald-50" : "bg-red-50"
                )}>
                  <CheckCircle className={cn("w-4 h-4", v.is_successful ? "text-emerald-500" : "text-red-400")} aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">
                    {v.market?.name ?? v.market_id.slice(0, 8) + "…"}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {new Date(v.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" aria-hidden="true" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
