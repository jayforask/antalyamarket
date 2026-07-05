"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Play, StopCircle, ChevronRight, CheckCircle } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

// Vardiya store — basit state (gerçekte Zustand store olacak)
function useShift() {
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);

  const start = () => {
    setIsActive(true);
    setStartTime(new Date());
  };
  const end = () => {
    setIsActive(false);
    setStartTime(null);
  };

  return { isActive, startTime, start, end };
}

const TODAY_VISITS = [
  { id: "1", market: "Migros Konyaaltı", time: "09:15", ok: true },
  { id: "2", market: "ŞokMarket Lara", time: "10:30", ok: false },
  { id: "3", market: "BİM Muratpaşa", time: "11:45", ok: true },
];

export default function HomePage() {
  const { user } = useAuthStore();
  const { isActive, startTime, start, end } = useShift();
  const router = useRouter();
  const now = new Date();

  const getElapsed = () => {
    if (!startTime) return "00:00";
    const diff = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const h = Math.floor(diff / 3600).toString().padStart(2, "0");
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  };

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
            {startTime && (
              <p className="text-xs text-blue-100 mt-0.5">
                Başlangıç: {formatTime(startTime)}
              </p>
            )}
          </div>
          <button
            onClick={isActive ? end : start}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95",
              isActive
                ? "bg-white text-[var(--primary)]"
                : "bg-[var(--primary)] text-white"
            )}
            aria-label={isActive ? "Vardiyayı bitir" : "Vardiyayı başlat"}
          >
            {isActive ? (
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
          <span className="text-xs text-[var(--muted-foreground)]">{TODAY_VISITS.length} ziyaret</span>
        </div>
        <div className="space-y-2">
          {TODAY_VISITS.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-3 p-3.5 bg-[var(--card)] border border-[var(--border)] rounded-xl"
            >
              <span className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                v.ok ? "bg-emerald-50" : "bg-red-50"
              )}>
                <CheckCircle className={cn("w-4 h-4", v.ok ? "text-emerald-500" : "text-red-400")} aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{v.market}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{v.time}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
