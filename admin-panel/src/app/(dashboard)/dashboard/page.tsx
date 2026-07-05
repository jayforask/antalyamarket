import { TrendingUp, TrendingDown, Users, Store, MapPin, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "amber" | "purple";
}

const colorMap = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  purple: "bg-purple-50 text-purple-600",
};

export function StatCard({ title, value, change, icon, color }: StatCardProps) {
  const isPositive = change >= 0;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn("p-3 rounded-xl shrink-0", colorMap[color])}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--muted-foreground)] font-medium truncate">
          {title}
        </p>
        <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5 leading-tight">
          {value}
        </p>
        <div className="flex items-center gap-1 mt-1">
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              isPositive ? "text-emerald-600" : "text-red-600"
            )}
          >
            {isPositive ? "+" : ""}
            {change}% dünden
          </span>
        </div>
      </div>
    </div>
  );
}

// Mock stats — gerçekte API'den gelecek
const MOCK_STATS = [
  {
    title: "Bugünkü Ziyaretler",
    value: "142",
    change: 12,
    icon: <MapPin className="w-5 h-5" />,
    color: "blue" as const,
  },
  {
    title: "Aktif Temsilciler",
    value: "8",
    change: 0,
    icon: <Users className="w-5 h-5" />,
    color: "green" as const,
  },
  {
    title: "Bugünkü Siparişler",
    value: "67",
    change: -5,
    icon: <ShoppingCart className="w-5 h-5" />,
    color: "amber" as const,
  },
  {
    title: "Toplam Marketler",
    value: "1.240",
    change: 3,
    icon: <Store className="w-5 h-5" />,
    color: "purple" as const,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* KPI Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {MOCK_STATS.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Alt satır — Hızlı özet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bugünkü en aktif temsilciler */}
        <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">
            Bugünkü Performans
          </h2>
          <div className="space-y-3">
            {[
              { name: "Ahmet Yılmaz", visits: 24, score: 94 },
              { name: "Fatma Kaya", visits: 21, score: 88 },
              { name: "Mehmet Demir", visits: 19, score: 82 },
              { name: "Ayşe Çelik", visits: 17, score: 76 },
              { name: "Hasan Arslan", visits: 15, score: 70 },
            ].map((rep, i) => (
              <div key={rep.name} className="flex items-center gap-3">
                <span className="text-xs text-[var(--muted-foreground)] w-4 shrink-0">
                  {i + 1}.
                </span>
                <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {rep.name.charAt(0)}
                </div>
                <span className="flex-1 text-sm text-[var(--foreground)] truncate">
                  {rep.name}
                </span>
                <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                  {rep.visits} ziyaret
                </span>
                <div className="w-16 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full bg-[var(--primary)] rounded-full"
                    style={{ width: `${rep.score}%` }}
                    role="progressbar"
                    aria-valuenow={rep.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${rep.name} verimlilik skoru`}
                  />
                </div>
                <span className="text-xs font-medium text-[var(--foreground)] w-8 text-right shrink-0">
                  {rep.score}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Son ziyaretler */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">
            Son Ziyaretler
          </h2>
          <div className="space-y-3">
            {[
              { market: "Migros Konyaaltı", time: "14:32", ok: true },
              { market: "ŞokMarket Lara", time: "14:18", ok: true },
              { market: "BİM Muratpaşa", time: "13:55", ok: false },
              { market: "A101 Kepez", time: "13:40", ok: true },
              { market: "CarrefourSA", time: "13:22", ok: true },
            ].map((v) => (
              <div key={v.time} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    v.ok ? "bg-emerald-500" : "bg-red-500"
                  )}
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm text-[var(--foreground)] truncate">
                  {v.market}
                </span>
                <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                  {v.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
