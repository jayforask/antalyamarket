"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Briefcase, X, CheckCircle, Loader2, Trash2, UserCheck, CheckSquare, Square, RotateCcw, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchMarketsApi } from "@/lib/api/markets";
import { getPortfolio, assignMarkets, removeMarket, clearPortfolio } from "@/lib/api/portfolio";
import { apiClient } from "@/lib/api/client";
import type { Market, User } from "@/types";

type Tab = "assign" | "portfolio";

export default function PortfolioPage() {
  const [tab, setTab] = useState<Tab>("assign");
  const [fieldReps, setFieldReps] = useState<User[]>([]);
  const [repsLoading, setRepsLoading] = useState(true);
  const [selectedRep, setSelectedRep] = useState<User | null>(null);

  // Temsilcileri API'den yükle
  useEffect(() => {
    apiClient
      .get<{ users: User[]; total: number }>("/auth/users")
      .then(({ data }) => {
        const reps = data.users.filter((u) => u.role === "field_rep");
        setFieldReps(reps);
        if (reps.length > 0) setSelectedRep(reps[0]);
      })
      .catch(() => setFieldReps([]))
      .finally(() => setRepsLoading(false));
  }, []);

  // Market arama state
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [searchResults, setSearchResults] = useState<Market[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);
  const [pageSize, setPageSize] = useState(1000); // 594 marketin hepsini tek ekranda göstermek için varsayılan 1000

  // Portföy state
  const [portfolio, setPortfolio] = useState<Market[]>([]);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Portföy içi filtreleme ve toplu çıkarma state
  const [portfolioSearch, setPortfolioSearch] = useState("");
  const [portfolioTypeFilter, setPortfolioTypeFilter] = useState("");
  const [pendingRemove, setPendingRemove] = useState<Set<string>>(new Set());
  const [isRemoving, setIsRemoving] = useState(false);

  // ─── Portföyü yükle ──────────────────────────────────────────────────────────
  const loadPortfolio = useCallback(async () => {
    if (!selectedRep) return;
    setIsLoadingPortfolio(true);
    try {
      const data = await getPortfolio(selectedRep.id);
      setPortfolio(data.markets);
    } catch {
      setPortfolio([]);
    } finally {
      setIsLoadingPortfolio(false);
    }
  }, [selectedRep]);

  useEffect(() => {
    loadPortfolio();
    setPendingAdd(new Set());
    setPendingRemove(new Set());
    setPortfolioSearch("");
    setPortfolioTypeFilter("");
  }, [loadPortfolio]);

  // ─── Market ara ──────────────────────────────────────────────────────────────
  const doSearch = useCallback(
    async (q: string, type: string, page: number, size: number) => {
      setIsSearching(true);
      try {
        const result = await searchMarketsApi({
          q: q || undefined,
          type: type || undefined,
          page,
          page_size: size,
        });
        setSearchResults(result.items);
        setSearchTotal(result.total);
      } catch {
        setSearchResults([]);
        setSearchTotal(0);
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  useEffect(() => {
    const t = setTimeout(() => {
      doSearch(search, typeFilter, searchPage, pageSize);
    }, 300);
    return () => clearTimeout(t);
  }, [search, typeFilter, searchPage, pageSize, doSearch]);

  // ─── Market seç/kaldır (pending) ────────────────────────────────────────────
  const portfolioIds = new Set(portfolio.map((m) => m.id));

  function togglePending(marketId: string) {
    setPendingAdd((prev) => {
      const next = new Set(prev);
      if (next.has(marketId)) next.delete(marketId);
      else next.add(marketId);
      return next;
    });
  }

  // Sayfadaki portföyde olmayan marketler
  const availableOnPage = searchResults.filter((m) => !portfolioIds.has(m.id));
  const isAllPageSelected =
    availableOnPage.length > 0 && availableOnPage.every((m) => pendingAdd.has(m.id));

  function toggleSelectAllPage() {
    setPendingAdd((prev) => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        availableOnPage.forEach((m) => next.delete(m.id));
      } else {
        availableOnPage.forEach((m) => next.add(m.id));
      }
      return next;
    });
  }

  // ─── Portföye ekle (kaydet) ──────────────────────────────────────────────────
  async function handleSaveAssign() {
    if (pendingAdd.size === 0 || !selectedRep) return;
    setIsSaving(true);
    try {
      await assignMarkets(selectedRep.id, Array.from(pendingAdd));
      showToast("success", `${pendingAdd.size} market portföye eklendi`);
      setPendingAdd(new Set());
      await loadPortfolio();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      const status = axiosErr?.response?.status;
      const detail = axiosErr?.response?.data?.detail;
      const msg = detail
        ? `Hata ${status}: ${detail}`
        : `Atama sırasında hata oluştu (${status ?? "?"})`;
      showToast("error", msg);
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Portföyden çıkar (tekli) ────────────────────────────────────────────────
  async function handleRemove(marketId: string) {
    if (!selectedRep) return;
    try {
      await removeMarket(selectedRep.id, marketId);
      setPortfolio((prev) => prev.filter((m) => m.id !== marketId));
      setPendingRemove((prev) => {
        const next = new Set(prev);
        next.delete(marketId);
        return next;
      });
      showToast("success", "Market portföyden çıkarıldı");
    } catch {
      showToast("error", "Çıkarma sırasında hata oluştu");
    }
  }

  // ─── Portföyden seçili olanları topluca çıkar ──────────────────────────────
  function togglePendingRemove(marketId: string) {
    setPendingRemove((prev) => {
      const next = new Set(prev);
      if (next.has(marketId)) next.delete(marketId);
      else next.add(marketId);
      return next;
    });
  }

  const filteredPortfolio = portfolio.filter((m) => {
    const matchesSearch =
      !portfolioSearch ||
      m.name.toLowerCase().includes(portfolioSearch.toLowerCase()) ||
      m.address.toLowerCase().includes(portfolioSearch.toLowerCase());
    const matchesType = !portfolioTypeFilter || m.type === portfolioTypeFilter;
    return matchesSearch && matchesType;
  });

  const isAllPortfolioSelected =
    filteredPortfolio.length > 0 &&
    filteredPortfolio.every((m) => pendingRemove.has(m.id));

  function toggleSelectAllPortfolio() {
    setPendingRemove((prev) => {
      const next = new Set(prev);
      if (isAllPortfolioSelected) {
        filteredPortfolio.forEach((m) => next.delete(m.id));
      } else {
        filteredPortfolio.forEach((m) => next.add(m.id));
      }
      return next;
    });
  }

  async function handleBulkRemove() {
    if (pendingRemove.size === 0 || !selectedRep) return;
    setIsRemoving(true);
    try {
      await Promise.all(Array.from(pendingRemove).map((mid) => removeMarket(selectedRep.id, mid)));
      showToast("success", `${pendingRemove.size} market portföyden çıkarıldı`);
      setPortfolio((prev) => prev.filter((m) => !pendingRemove.has(m.id)));
      setPendingRemove(new Set());
    } catch {
      showToast("error", "Toplu çıkarma sırasında hata oluştu");
    } finally {
      setIsRemoving(false);
    }
  }

  // ─── Portföyü temizle ────────────────────────────────────────────────────────
  async function handleClear() {
    if (!selectedRep) return;
    if (!confirm(`${selectedRep.name} temsilcisinin tüm portföyü silinecek. Onaylıyor musunuz?`)) return;
    try {
      await clearPortfolio(selectedRep.id);
      setPortfolio([]);
      setPendingRemove(new Set());
      showToast("success", "Portföy temizlendi");
    } catch {
      showToast("error", "Temizleme sırasında hata oluştu");
    }
  }

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  const MARKET_TYPE_LABELS: Record<string, string> = {
    market: "Market",
    restaurant: "Restoran",
    cafe: "Kafe",
    bakkal: "Bakkal",
    tekel: "Tekel",
    other: "Diğer",
  };

  return (
    <div className="space-y-5 max-w-screen-xl">
      {/* Başlık */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Portföy Yönetimi</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Saha temsilcilerine market atayın ve portföylerini yönetin
        </p>
      </div>

      {/* Temsilci seç */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
        <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Temsilci Seç</p>
        {repsLoading ? (
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-32 bg-[var(--muted)] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : fieldReps.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Henüz saha temsilcisi yok. Kullanıcı sayfasından ekleyin.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {fieldReps.map((rep) => (
              <button
                key={rep.id}
                onClick={() => setSelectedRep(rep)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
                  selectedRep?.id === rep.id
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)] font-medium"
                    : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                )}
              >
                <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center font-bold shrink-0">
                  {rep.name.charAt(0)}
                </span>
                {rep.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sekme */}
      <div className="flex gap-1 p-1 bg-[var(--muted)] rounded-lg w-fit">
        {(["assign", "portfolio"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === t
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            {t === "assign" ? (
              <span className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                Market Ekle
                {pendingAdd.size > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[var(--primary)] text-white text-[10px] flex items-center justify-center font-bold">
                    {pendingAdd.size}
                  </span>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                Portföy
                <span className="text-[var(--muted-foreground)]">({portfolio.length})</span>
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* ─── Sol: içerik ─── */}
        <div className="flex-1 min-w-0">
          {tab === "assign" ? (
            // ─── Market arama paneli ─────────────────────────────────────────
            <div className="space-y-3">
              {/* Filtreler */}
              <div className="flex flex-wrap gap-3 p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                  <input
                    type="search"
                    placeholder="Market adı veya adres ara..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSearchPage(1); }}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    aria-label="Market ara"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setSearchPage(1); }}
                  className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  aria-label="Tür filtresi"
                >
                  <option value="">Tüm Türler</option>
                  {Object.entries(MARKET_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setSearchPage(1); }}
                  className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] font-medium"
                  aria-label="Sayfa boyutu"
                >
                  <option value={1000}>Tümünü Göster ({searchTotal > 0 ? `${searchTotal} Market` : "Hepsi"})</option>
                  <option value={500}>500 Göster</option>
                  <option value={100}>100 Göster</option>
                  <option value={50}>50 Göster</option>
                  <option value={15}>15 Göster</option>
                </select>
              </div>

              {/* Toplu İşlem & Aksiyon Barı */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-xs">
                {/* Sol: Toplu Seçim Butonları */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={toggleSelectAllPage}
                    disabled={availableOnPage.length === 0}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40",
                      isAllPageSelected
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] text-[var(--foreground)]"
                    )}
                  >
                    {isAllPageSelected ? (
                      <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                    ) : (
                      <Square className="w-4 h-4 text-[var(--muted-foreground)]" />
                    )}
                    {isAllPageSelected 
                      ? "Tüm Seçimleri Kaldır" 
                      : (pageSize >= 1000 ? `Tümünü Seç (${availableOnPage.length} Market)` : "Sayfadakilerin Tümünü Seç")}
                  </button>

                  {pendingAdd.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setPendingAdd(new Set())}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[var(--muted-foreground)] hover:text-red-500 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Seçimi Temizle
                    </button>
                  )}
                </div>

                {/* Sağ: Seçilenleri Ekle Butonu & Sayfalama */}
                <div className="flex items-center gap-3 ml-auto">
                  {pendingAdd.size > 0 && (
                    <button
                      type="button"
                      onClick={handleSaveAssign}
                      disabled={isSaving || !selectedRep}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold shadow-sm hover:opacity-90 disabled:opacity-60 transition-opacity"
                    >
                      {isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                      <span>Seçilenleri Portföye Ekle ({pendingAdd.size})</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <span>
                      {isSearching ? "Aranıyor..." : `${searchTotal} market bulundu`}
                    </span>
                    {searchTotal > pageSize && (
                      <div className="flex items-center gap-1 border-l border-[var(--border)] pl-2">
                        <button
                          type="button"
                          onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
                          disabled={searchPage === 1}
                          className="px-2 py-0.5 rounded border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--muted)]"
                        >
                          ‹
                        </button>
                        <span className="px-1.5 py-0.5 font-medium">{searchPage}</span>
                        <button
                          type="button"
                          onClick={() => setSearchPage((p) => p + 1)}
                          disabled={searchPage * pageSize >= searchTotal}
                          className="px-2 py-0.5 rounded border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--muted)]"
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Market listesi */}
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {searchResults.map((market) => {
                    const inPortfolio = portfolioIds.has(market.id);
                    const isPending = pendingAdd.has(market.id);
                    return (
                      <button
                        key={market.id}
                        onClick={() => !inPortfolio && togglePending(market.id)}
                        disabled={inPortfolio}
                        className={cn(
                          "text-left p-3 rounded-xl border transition-colors",
                          inPortfolio
                            ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 cursor-default"
                            : isPending
                            ? "border-[var(--primary)] bg-[var(--primary)]/10"
                            : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] cursor-pointer"
                        )}
                        aria-pressed={isPending}
                        aria-label={`${market.name} ${inPortfolio ? "(portföyde)" : isPending ? "(seçili)" : "(seç)"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[var(--foreground)] truncate">
                              {market.name}
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">
                              {market.address}
                            </p>
                            <div className="flex gap-1.5 mt-1.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                                {MARKET_TYPE_LABELS[market.type] ?? market.type}
                              </span>
                              {market.is_verified && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  Doğrulandı
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 mt-0.5">
                            {inPortfolio ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                            ) : isPending ? (
                              <div className="w-4 h-4 rounded-full bg-[var(--primary)] flex items-center justify-center">
                                <X className="w-2.5 h-2.5 text-white" aria-hidden="true" />
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-[var(--border)]" aria-hidden="true" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            // ─── Portföy paneli ──────────────────────────────────────────────
            <div className="space-y-3">
              {/* Filtreler */}
              <div className="flex flex-wrap gap-3 p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                  <input
                    type="search"
                    placeholder="Portföyde market veya adres ara..."
                    value={portfolioSearch}
                    onChange={(e) => setPortfolioSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    aria-label="Portföyde ara"
                  />
                </div>
                <select
                  value={portfolioTypeFilter}
                  onChange={(e) => setPortfolioTypeFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  aria-label="Tür filtresi"
                >
                  <option value="">Tüm Türler</option>
                  {Object.entries(MARKET_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Toplu İşlem & Aksiyon Barı */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-xs">
                {/* Sol: Toplu Seçim Butonları */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={toggleSelectAllPortfolio}
                    disabled={filteredPortfolio.length === 0}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40",
                      isAllPortfolioSelected
                        ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-950/20"
                        : "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] text-[var(--foreground)]"
                    )}
                  >
                    {isAllPortfolioSelected ? (
                      <CheckSquare className="w-4 h-4 text-red-600" />
                    ) : (
                      <Square className="w-4 h-4 text-[var(--muted-foreground)]" />
                    )}
                    {isAllPortfolioSelected 
                      ? "Tüm Seçimleri Kaldır" 
                      : `Tümünü Seç (${filteredPortfolio.length} Market)`}
                  </button>

                  {pendingRemove.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setPendingRemove(new Set())}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Seçimi Temizle
                    </button>
                  )}
                </div>

                {/* Sağ: Seçilenleri Çıkar & Tümünü Temizle */}
                <div className="flex items-center gap-2 ml-auto">
                  {pendingRemove.size > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkRemove}
                      disabled={isRemoving}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold shadow-sm hover:bg-red-700 disabled:opacity-60 transition-colors"
                    >
                      {isRemoving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Seçilenleri Çıkar ({pendingRemove.size})</span>
                    </button>
                  )}

                  {portfolio.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Tümünü Temizle
                    </button>
                  )}
                </div>
              </div>

              {isLoadingPortfolio ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
                </div>
              ) : filteredPortfolio.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Briefcase className="w-10 h-10 text-[var(--muted-foreground)] mb-3" />
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {portfolio.length === 0 ? "Portföy boş" : "Aranan kriterlere uygun market bulunamadı"}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {portfolio.length === 0 ? '"Market Ekle" sekmesinden market seçin' : "Arama filtrenizi değiştirmeyi deneyin"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {filteredPortfolio.map((market) => {
                    const isPendingDel = pendingRemove.has(market.id);
                    return (
                      <div
                        key={market.id}
                        onClick={() => togglePendingRemove(market.id)}
                        className={cn(
                          "flex items-start justify-between gap-3 p-3 rounded-xl border transition-colors cursor-pointer",
                          isPendingDel
                            ? "border-red-500 bg-red-50/60 dark:bg-red-950/20"
                            : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--foreground)] truncate">
                            {market.name}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">
                            {market.address}
                          </p>
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)] mt-1">
                            {MARKET_TYPE_LABELS[market.type] ?? market.type}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          {isPendingDel ? (
                            <div className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center">
                              <X className="w-2.5 h-2.5 text-white" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-[var(--border)]" />
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(market.id);
                            }}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-[var(--muted-foreground)] hover:text-red-500 transition-colors"
                            aria-label={`${market.name} portföyden çıkar`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Sağ: özet panel ─── */}
        <div className="w-full lg:w-64 shrink-0 space-y-3">
          {/* Seçili temsilci */}
          {selectedRep && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-bold">
                {selectedRep.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{selectedRep.name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Saha Temsilcisi</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>{portfolio.length} market portföyde</span>
            </div>
          </div>
          )}

          {/* Bekleyen ekleme */}
          {pendingAdd.size > 0 && (
            <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {pendingAdd.size} market eklenecek
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {Array.from(pendingAdd).map((mid) => {
                  const m = searchResults.find((r) => r.id === mid);
                  return (
                    <div key={mid} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-[var(--foreground)]">{m?.name ?? mid}</span>
                      <button
                        onClick={() => togglePending(mid)}
                        className="shrink-0 text-[var(--muted-foreground)] hover:text-red-500"
                        aria-label="Seçimi kaldır"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={handleSaveAssign}
                disabled={isSaving}
                className="w-full py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {isSaving ? "Kaydediliyor..." : "Portföye Ekle"}
              </button>
              <button
                onClick={() => setPendingAdd(new Set())}
                className="w-full py-1.5 rounded-lg text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                Seçimi Temizle
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast bildirimi */}
      {toast && (
        <div
          role="alert"
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all",
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <X className="w-4 h-4 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
