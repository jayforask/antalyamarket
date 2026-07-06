"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, MapPin, Phone, Plus, CheckCircle, X, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { searchMarkets, createMarket } from "@/lib/api/markets";
import type { Market, MarketType } from "@/types";

const TYPE_LABELS: Record<MarketType, string> = {
  market: "Market",
  restaurant: "Restoran",
  cafe: "Kafe",
  bakkal: "Bakkal",
  other: "Diğer",
};

const TYPE_OPTIONS: { value: MarketType; label: string }[] = [
  { value: "market", label: "Market" },
  { value: "restaurant", label: "Restoran" },
  { value: "cafe", label: "Kafe" },
  { value: "bakkal", label: "Bakkal" },
  { value: "other", label: "Diğer" },
];

const addSchema = z.object({
  name: z.string().min(2, "En az 2 karakter"),
  type: z.enum(["market", "restaurant", "cafe", "bakkal", "other"]),
  address: z.string().min(5, "En az 5 karakter"),
  phone: z.string().optional(),
  latitude: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= -90 && parseFloat(v) <= 90, "Geçerli enlem girin"),
  longitude: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= -180 && parseFloat(v) <= 180, "Geçerli boylam girin"),
});
type AddFormData = z.infer<typeof addSchema>;

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Arama debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchMarkets({
        q: debouncedSearch || undefined,
        page: 1,
        page_size: 50,
      });
      setMarkets(result.items);
      setTotal(result.total);
    } catch {
      setError("Marketler yüklenemedi. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddFormData>({
    resolver: zodResolver(addSchema),
    defaultValues: {
      type: "market",
      latitude: "36.8841",
      longitude: "30.7056",
    },
  });

  const openModal = () => {
    reset();
    setSubmitError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSubmitError(null);
  };

  const onSubmit = async (data: AddFormData) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createMarket({
        name: data.name,
        type: data.type,
        address: data.address,
        phone: data.phone || undefined,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
      });
      closeModal();
      loadMarkets();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Market eklenemedi. Lütfen tekrar deneyin.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-2 space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--foreground)]">Marketler</h1>
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium active:scale-95 transition-transform"
          aria-label="Yeni market ekle"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Ekle
        </button>
      </div>

      {/* Arama */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Market ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      {/* Sayaç */}
      {!loading && !error && (
        <p className="text-xs text-[var(--muted-foreground)]">{total} market</p>
      )}

      {/* Yükleniyor */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
        </div>
      )}

      {/* Hata */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 text-center">
          {error}
          <button
            onClick={loadMarkets}
            className="block mx-auto mt-2 text-xs underline"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {/* Liste */}
      {!loading && !error && (
        <div className="space-y-2">
          {markets.length === 0 ? (
            <p className="text-center text-sm text-[var(--muted-foreground)] py-8">
              {search ? "Arama sonucu bulunamadı." : "Henüz market yok."}
            </p>
          ) : (
            markets.map((market) => (
              <div
                key={String(market.id)}
                className="p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[var(--foreground)] truncate">
                        {market.name}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)] shrink-0">
                        {TYPE_LABELS[market.type] ?? market.type}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                      {market.address}
                    </p>
                    {market.phone && (
                      <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 shrink-0" aria-hidden="true" />
                        {market.phone}
                      </p>
                    )}
                  </div>
                  {market.is_verified && (
                    <CheckCircle
                      className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5"
                      aria-label="Doğrulandı"
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Market Ekle Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="w-full max-w-md bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl overflow-hidden">
            {/* Modal Başlık */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h2 id="modal-title" className="font-semibold text-[var(--foreground)]">
                Yeni Market Ekle
              </h2>
              <button
                onClick={closeModal}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
              {submitError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              {/* İsim */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Market Adı <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="ör. Migros Konyaaltı"
                  {...register("name")}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border bg-[var(--background)] text-[var(--foreground)] text-sm",
                    "placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
                    errors.name ? "border-red-400" : "border-[var(--border)]"
                  )}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
                )}
              </div>

              {/* Tür */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Tür <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <select
                  {...register("type")}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border bg-[var(--background)] text-[var(--foreground)] text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
                    errors.type ? "border-red-400" : "border-[var(--border)]"
                  )}
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Adres */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Adres <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="ör. Konyaaltı Cad. No:15, Antalya"
                  {...register("address")}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border bg-[var(--background)] text-[var(--foreground)] text-sm",
                    "placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
                    errors.address ? "border-red-400" : "border-[var(--border)]"
                  )}
                />
                {errors.address && (
                  <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>
                )}
              </div>

              {/* Telefon */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Telefon
                </label>
                <input
                  type="tel"
                  placeholder="ör. 0242 123 45 67"
                  {...register("phone")}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>

              {/* Koordinatlar */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    Enlem <span aria-hidden="true" className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="36.8841"
                    {...register("latitude")}
                    className={cn(
                      "w-full px-3 py-3 rounded-xl border bg-[var(--background)] text-[var(--foreground)] text-sm",
                      "placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
                      errors.latitude ? "border-red-400" : "border-[var(--border)]"
                    )}
                  />
                  {errors.latitude && (
                    <p className="mt-1 text-xs text-red-500">{errors.latitude.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    Boylam <span aria-hidden="true" className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="30.7056"
                    {...register("longitude")}
                    className={cn(
                      "w-full px-3 py-3 rounded-xl border bg-[var(--background)] text-[var(--foreground)] text-sm",
                      "placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
                      errors.longitude ? "border-red-400" : "border-[var(--border)]"
                    )}
                  />
                  {errors.longitude && (
                    <p className="mt-1 text-xs text-red-500">{errors.longitude.message}</p>
                  )}
                </div>
              </div>

              {/* Butonlar */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 rounded-xl border border-[var(--border)] text-[var(--foreground)] text-sm font-medium active:scale-95 transition-transform"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    "flex-1 py-3 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold",
                    "flex items-center justify-center gap-2",
                    "active:scale-95 transition-transform",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {submitting && (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  )}
                  {submitting ? "Ekleniyor..." : "Ekle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
