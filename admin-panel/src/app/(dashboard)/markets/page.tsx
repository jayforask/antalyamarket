"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  CheckCircle,
  XCircle,
  MapPin,
  Phone,
  Filter,
  Building2,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { searchMarketsApi, verifyMarketApi } from "@/lib/api/markets";
import type { Market, MarketType } from "@/types";

const TYPE_LABELS: Record<MarketType, string> = {
  market: "Market",
  restaurant: "Restoran",
  cafe: "Kafe",
  bakkal: "Bakkal",
  tekel: "Tekel Bayi",
  other: "Diğer",
};

const TYPE_COLORS: Record<MarketType, string> = {
  market: "bg-blue-50 text-blue-700",
  restaurant: "bg-orange-50 text-orange-700",
  cafe: "bg-amber-50 text-amber-700",
  bakkal: "bg-green-50 text-green-700",
  tekel: "bg-purple-50 text-purple-700",
  other: "bg-zinc-50 text-zinc-600",
};

const PAGE_SIZE = 50;

export default function MarketsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [verifiedFilter, setVerifiedFilter] = useState<string>("all");
  const [corporateFilter, setCorporateFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["markets", search, typeFilter, verifiedFilter, corporateFilter, page],
    queryFn: () =>
      searchMarketsApi({
        q: search || undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        is_verified:
          verifiedFilter === "verified"
            ? true
            : verifiedFilter === "unverified"
            ? false
            : undefined,
        is_corporate:
          corporateFilter === "corporate"
            ? true
            : corporateFilter === "independent"
            ? false
            : undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    staleTime: 30_000,
  });

  const verifyMutation = useMutation({
    mutationFn: verifyMarketApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["markets"] }),
  });

  const markets = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;

  // Sayfa değişince scroll'u yukarı al
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Filtre değişince sayfayı sıfırla
  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <div className="space-y-5 max-w-screen-xl">
      {/* Başlık + Ekle butonu */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Marketler</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {isLoading ? "Yükleniyor..." : `Toplam ${total} market`}
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" aria-hidden="true" />
          Yeni Market Ekle
        </button>
      </div>

      {/* Filtre Çubuğu */}
      <div className="flex flex-wrap gap-3 p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl">
        {/* Arama */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" aria-hidden="true" />
          <input
            type="search"
            placeholder="Market ara..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        {/* Tür filtresi */}
        <select
          value={typeFilter}
          onChange={handleFilterChange(setTypeFilter)}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          aria-label="Tür filtresi"
        >
          <option value="all">Tüm Türler</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Kurumsal filtresi */}
        <select
          value={corporateFilter}
          onChange={handleFilterChange(setCorporateFilter)}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          aria-label="Kurumsal filtresi"
        >
          <option value="all">Tüm İşletmeler</option>
          <option value="independent">Bağımsız Esnaf</option>
          <option value="corporate">Kurumsal Zincir</option>
        </select>

        {/* Doğrulama filtresi */}
        <select
          value={verifiedFilter}
          onChange={handleFilterChange(setVerifiedFilter)}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          aria-label="Doğrulama durumu filtresi"
        >
          <option value="all">Tüm Durumlar</option>
          <option value="verified">Doğrulanmış</option>
          <option value="unverified">Doğrulanmamış</option>
        </select>
      </div>

      {/* Tablo */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Market</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Tür</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Adres</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Telefon</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Kayıt Tarihi</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Durum</th>
                <th className="text-right px-4 py-3 font-medium text-[var(--muted-foreground)]">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[var(--muted-foreground)]">
                    <div className="animate-spin w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full mx-auto mb-2" />
                    <p>Marketler yükleniyor...</p>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-red-500">
                    <XCircle className="w-8 h-8 mx-auto mb-2 opacity-60" aria-hidden="true" />
                    <p>Veriler yüklenemedi. Lütfen tekrar deneyin.</p>
                  </td>
                </tr>
              ) : markets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[var(--muted-foreground)]">
                    <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
                    <p>Sonuç bulunamadı</p>
                  </td>
                </tr>
              ) : (
                markets.map((market) => (
                  <MarketRow
                    key={market.id}
                    market={market}
                    onVerify={() => verifyMutation.mutate(market.id)}
                    isVerifying={verifyMutation.isPending}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Sayfalama */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <p className="text-sm text-[var(--muted-foreground)]">
              Sayfa {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Önceki
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MarketRow({
  market,
  onVerify,
  isVerifying,
}: {
  market: Market;
  onVerify: () => void;
  isVerifying: boolean;
}) {
  return (
    <tr className="hover:bg-[var(--muted)] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-[var(--foreground)]">{market.name}</span>
          {market.is_corporate && (
            <span title="Kurumsal zincir">
              <Building2 className="w-3.5 h-3.5 text-zinc-400" aria-label="Kurumsal" />
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3" aria-hidden="true" />
          {market.latitude.toFixed(4)}, {market.longitude.toFixed(4)}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn("px-2 py-0.5 rounded-md text-xs font-medium", TYPE_COLORS[market.type] ?? "bg-zinc-50 text-zinc-600")}>
          {TYPE_LABELS[market.type] ?? market.type}
        </span>
      </td>
      <td className="px-4 py-3 text-[var(--muted-foreground)] hidden md:table-cell max-w-48 truncate">
        {market.address}
      </td>
      <td className="px-4 py-3 text-[var(--muted-foreground)] hidden lg:table-cell">
        {market.phone ? (
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" aria-hidden="true" />
            {market.phone}
          </span>
        ) : (
          <span className="text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--muted-foreground)] hidden lg:table-cell text-xs">
        {formatDate(market.created_at)}
      </td>
      <td className="px-4 py-3">
        {market.is_verified ? (
          <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
            <CheckCircle className="w-4 h-4" aria-hidden="true" />
            Doğrulandı
          </span>
        ) : (
          <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
            <XCircle className="w-4 h-4" aria-hidden="true" />
            Bekliyor
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {!market.is_verified && (
          <button
            onClick={onVerify}
            disabled={isVerifying}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            Doğrula
          </button>
        )}
      </td>
    </tr>
  );
}
