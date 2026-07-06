"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Minus, ShoppingCart, CheckCircle, Trash2, Loader2, AlertCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { apiClient } from "@/lib/api/client";

interface Product {
  id: string;
  name: string;
  unit_price: number;
  category: string;
}

// Sabit ürün kataloğu — gerçek projede backend'den çekilmeli
const PRODUCTS: Product[] = [
  { id: "p1", name: "Ürün A — 500ml", unit_price: 12.50, category: "İçecek" },
  { id: "p2", name: "Ürün B — 1L", unit_price: 18.90, category: "İçecek" },
  { id: "p3", name: "Ürün C — 250g", unit_price: 8.75, category: "Atıştırmalık" },
  { id: "p4", name: "Ürün D — Paket", unit_price: 45.00, category: "Paket" },
  { id: "p5", name: "Ürün E — Kutu", unit_price: 32.50, category: "Paket" },
  { id: "p6", name: "Ürün F — 2L", unit_price: 24.90, category: "İçecek" },
];

type CartItem = { product: Product; quantity: number };

// useSearchParams() Suspense boundary içinde olmalı
function OrderPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Ziyaret sayfasından ?visit_id=xxx ile gelinebilir
  const visitIdParam = searchParams.get("visit_id");

  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [finalTotal, setFinalTotal] = useState(0);

  const updateQty = (product: Product, delta: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      const newQty = (existing?.quantity ?? 0) + delta;
      if (newQty <= 0) {
        next.delete(product.id);
      } else {
        next.set(product.id, { product, quantity: newQty });
      }
      return next;
    });
  };

  const cartItems = Array.from(cart.values());
  const total = cartItems.reduce((s, i) => s + i.product.unit_price * i.quantity, 0);
  const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0);

  const categories = [...new Set(PRODUCTS.map((p) => p.category))];

  const handleSubmit = async () => {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      if (visitIdParam) {
        // visit_id varsa direkt backend'e gönder
        await apiClient.post("/orders/add", {
          visit_id: visitIdParam,
          product_details: cartItems.map((item) => ({
            product_id: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            unit_price: item.product.unit_price,
          })),
        });
      }
      // visit_id yoksa (bağımsız açılmış) sadece lokal kaydet
      // — gerçek projede aktif ziyareti otomatik seçmeli
      setFinalTotal(total);
      setSubmitted(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Sipariş gönderilemedi. Lütfen tekrar deneyin.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-4">
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-[var(--foreground)]">Sipariş Kaydedildi!</h2>
        <p className="text-sm text-[var(--muted-foreground)]">Toplam: {formatCurrency(finalTotal)}</p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => { setCart(new Map()); setSubmitted(false); setSubmitError(null); }}
            className="px-5 py-3 rounded-xl border border-[var(--border)] text-[var(--foreground)] font-semibold text-sm"
          >
            Yeni Sipariş
          </button>
          <button
            onClick={() => router.back()}
            className="px-5 py-3 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm"
          >
            Ana Sayfa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--card)] border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-[var(--foreground)]">Sipariş Al</h1>
          {totalItems > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--primary)] font-medium">
              <ShoppingCart className="w-4 h-4" aria-hidden="true" />
              {totalItems} ürün
            </span>
          )}
        </div>
        {visitIdParam && (
          <p className="text-xs text-emerald-600 mt-0.5">Ziyaret bağlı — sipariş kaydedilecek</p>
        )}
      </div>

      <div className="flex-1 px-4 py-4 space-y-5 pb-[200px]">
        {categories.map((cat) => (
          <div key={cat}>
            <h2 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
              {cat}
            </h2>
            <div className="space-y-2">
              {PRODUCTS.filter((p) => p.category === cat).map((product) => {
                const qty = cart.get(product.id)?.quantity ?? 0;
                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-3.5 bg-[var(--card)] border border-[var(--border)] rounded-xl"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{product.name}</p>
                      <p className="text-xs text-[var(--primary)] font-semibold mt-0.5">
                        {formatCurrency(product.unit_price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {qty > 0 ? (
                        <>
                          <button
                            onClick={() => updateQty(product, -1)}
                            className="w-8 h-8 rounded-full bg-[var(--muted)] flex items-center justify-center active:scale-90 transition-transform"
                            aria-label={`${product.name} azalt`}
                          >
                            {qty === 1 ? (
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            ) : (
                              <Minus className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-[var(--foreground)]">
                            {qty}
                          </span>
                        </>
                      ) : null}
                      <button
                        onClick={() => updateQty(product, 1)}
                        className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center active:scale-90 transition-transform"
                        aria-label={`${product.name} ekle`}
                      >
                        <Plus className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sepet özeti + Onayla */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-[68px] left-0 right-0 bg-[var(--card)] border-t border-[var(--border)] px-4 py-3 space-y-3 safe-area-bottom">
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {cartItems.map((item) => (
              <div key={item.product.id} className="flex justify-between text-xs text-[var(--muted-foreground)]">
                <span>{item.product.name} × {item.quantity}</span>
                <span>{formatCurrency(item.product.unit_price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
            <span className="font-semibold text-[var(--foreground)]">Toplam</span>
            <span className="font-bold text-[var(--primary)] text-lg">{formatCurrency(total)}</span>
          </div>
          {submitError && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {submitError}
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={cn(
              "w-full py-3.5 rounded-xl bg-[var(--primary)] text-white font-semibold",
              "flex items-center justify-center gap-2",
              "active:scale-[0.98] transition-transform",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Kaydediliyor..." : "Siparişi Onayla"}
          </button>
        </div>
      )}
    </div>
  );
}

// Suspense boundary — useSearchParams() için gerekli
export default function OrderPage() {
  return (
    <Suspense fallback={null}>
      <OrderPageInner />
    </Suspense>
  );
}
