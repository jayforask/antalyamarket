import { Clock, MapPin, CheckCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserDayStats } from "@/lib/api/users";

interface ShiftStatsProps {
  stats: UserDayStats;
  className?: string;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0s";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}dk`;
  if (m === 0) return `${h}s`;
  return `${h}s ${m}dk`;
}

const statCards = (stats: UserDayStats) => [
  {
    label: "Vardiya Süresi",
    value: formatDuration(stats.total_duration_minutes),
    icon: Clock,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    label: "Toplam Ziyaret",
    value: String(stats.visit_count),
    icon: MapPin,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  {
    label: "Başarı Oranı",
    value: `%${stats.success_rate}`,
    icon: CheckCircle,
    color: stats.success_rate >= 80 ? "text-emerald-600" : stats.success_rate >= 50 ? "text-amber-600" : "text-red-600",
    bg: stats.success_rate >= 80 ? "bg-emerald-50" : stats.success_rate >= 50 ? "bg-amber-50" : "bg-red-50",
  },
  {
    label: "Tahmini Yol",
    value: `${stats.estimated_km} km`,
    icon: TrendingUp,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
];

export function ShiftStats({ stats, className }: ShiftStatsProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {statCards(stats).map(({ label, value, icon: Icon, color, bg }) => (
        <div
          key={label}
          className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-start gap-3"
        >
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
            <Icon className={cn("w-4 h-4", color)} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className={cn("text-xl font-bold leading-tight", color)}>{value}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5 leading-tight">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
