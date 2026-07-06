import { Play, Square, MapPin, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShiftDetail, VisitDetail } from "@/lib/api/users";

interface DayTimelineProps {
  shift: ShiftDetail | null;
  visits: VisitDetail[];
  className?: string;
  onVisitClick?: (visit: VisitDetail) => void;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

function formatDuration(start: string, end: string | null): string {
  const endDate = end ? new Date(end) : new Date();
  const diffMs = endDate.getTime() - new Date(start).getTime();
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}dk`;
  if (m === 0) return `${h}s`;
  return `${h}s ${m}dk`;
}

export function DayTimeline({ shift, visits, className, onVisitClick }: DayTimelineProps) {
  if (!shift && visits.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-10 text-center", className)}>
        <div className="w-12 h-12 rounded-full bg-[var(--muted)] flex items-center justify-center mb-3">
          <Clock className="w-6 h-6 text-[var(--muted-foreground)]" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-[var(--foreground)]">Bu gün için veri yok</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          Seçili tarihte vardiya kaydı bulunamadı.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Dikey çizgi */}
      <div className="absolute left-[19px] top-6 bottom-6 w-px bg-[var(--border)]" aria-hidden="true" />

      <div className="space-y-1">
        {/* Vardiya başlangıcı */}
        {shift && (
          <TimelineItem
            icon={<Play className="w-3.5 h-3.5" />}
            iconBg="bg-emerald-500"
            time={formatTime(shift.start_time)}
            title="Vardiya Başladı"
            subtitle={
              shift.start_lat && shift.start_lng
                ? `${shift.start_lat.toFixed(5)}, ${shift.start_lng.toFixed(5)}`
                : "Konum bilgisi yok"
            }
            badge={{ label: "Başlangıç", color: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" }}
          />
        )}

        {/* Ziyaretler */}
        {visits.map((visit, index) => (
          <TimelineItem
            key={visit.id}
            icon={
              visit.is_successful
                ? <CheckCircle className="w-3.5 h-3.5" />
                : <XCircle className="w-3.5 h-3.5" />
            }
            iconBg={visit.is_successful ? "bg-blue-500" : "bg-red-400"}
            time={formatTime(visit.timestamp)}
            title={visit.market?.name ?? "Bilinmeyen Market"}
            subtitle={visit.market?.address ?? (
              visit.gps_lat && visit.gps_lng
                ? `${visit.gps_lat.toFixed(5)}, ${visit.gps_lng.toFixed(5)}`
                : "Adres bilgisi yok"
            )}
            badge={{
              label: visit.is_successful ? "Başarılı" : "Başarısız",
              color: visit.is_successful
                ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                : "bg-red-50 text-red-700 ring-red-600/20",
            }}
            note={visit.note ?? undefined}
            index={index + 1}
            onClick={onVisitClick ? () => onVisitClick(visit) : undefined}
          />
        ))}

        {/* Vardiya bitişi */}
        {shift && shift.end_time && (
          <TimelineItem
            icon={<Square className="w-3.5 h-3.5" />}
            iconBg="bg-zinc-500"
            time={formatTime(shift.end_time)}
            title="Vardiya Bitti"
            subtitle={
              shift.end_lat && shift.end_lng
                ? `${shift.end_lat.toFixed(5)}, ${shift.end_lng.toFixed(5)}`
                : "Konum bilgisi yok"
            }
            badge={{ label: formatDuration(shift.start_time, shift.end_time), color: "bg-zinc-50 text-zinc-600 ring-zinc-500/10" }}
          />
        )}

        {/* Aktif vardiya göstergesi */}
        {shift && !shift.end_time && (
          <TimelineItem
            icon={<span className="w-2 h-2 rounded-full bg-white animate-pulse block" />}
            iconBg="bg-emerald-500"
            time="Devam ediyor"
            title="Vardiya Aktif"
            subtitle={`Başlangıçtan bu yana: ${formatDuration(shift.start_time, null)}`}
            badge={{ label: "Aktif", color: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Alt bileşen ─────────────────────────────────────────────────────────────

interface TimelineItemProps {
  icon: React.ReactNode;
  iconBg: string;
  time: string;
  title: string;
  subtitle: string;
  badge: { label: string; color: string };
  note?: string;
  index?: number;
  onClick?: () => void;
}

function TimelineItem({
  icon, iconBg, time, title, subtitle, badge, note, index, onClick,
}: TimelineItemProps) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      className={cn(
        "relative flex items-start gap-3 pl-2 pr-3 py-3 rounded-xl transition-colors w-full text-left",
        onClick && "hover:bg-[var(--muted)] cursor-pointer"
      )}
      onClick={onClick}
    >
      {/* İkon dairesi */}
      <div className={cn(
        "relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white shadow-sm",
        iconBg
      )}>
        {index ? (
          <span className="text-xs font-bold">{index}</span>
        ) : (
          icon
        )}
      </div>

      {/* İçerik */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">{title}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">{subtitle}</p>
            {note && (
              <p className="text-xs text-[var(--muted-foreground)] mt-1 italic truncate">
                &ldquo;{note}&rdquo;
              </p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className="text-xs font-medium text-[var(--muted-foreground)] tabular-nums">
              {time}
            </span>
            <span className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
              badge.color
            )}>
              {badge.label}
            </span>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
