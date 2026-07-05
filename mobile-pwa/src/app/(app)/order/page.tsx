"use client";

import { useState } from "react";
import { Plus, Minus, ShoppingCart, CheckCircle, Trash2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  unit_price: number;
  category: string;
}

const PRODUCTS: Product[] = [
  { id: "p1", name: "Ürün A — 500ml", unit_price: 12.50, category: "İçecek" },
  { id: "p2", name: "Ürün B — 1L", unit_price: 18.90, category: "İçecek" },
  { id: "p3", name: "Ürün C — 250g", unit_price: 8.75, category: "Atıştırmalık" },
  { id: "p4", name: "Ürün D — Paket", unit_price: 45.00, category: "Paket" },
  { id: "p5", name: "Ürün E — Kutu", unit_price: 32.50, category: "Paket" },
  { id: "p6", name: "Ürün F — 2L", unit_price: 24.90, category: "İçecek" },
];

type CartItem = { product: Product; quantity: number };

export default function OrderPage() {
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [submitted, setSubmitted] = useState(false);

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

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-4">
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-[var(--foreground)]">Sipariş Kaydedildi!</h2>
        <p className="text-sm text-[var(--muted-foreground)]">Toplam: {formatCurrency(total)}</p>
        <button
          onClick={() => { setCart(new Map()); setSubmitted(false); }}
          className="mt-2 px-6 py-3 rounded-xl bg-[var(--primary)] text-white font-semibold"
        >
          Yeni Sipariş
        </button>
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
      </div>

      <div className="flex-1 px-4 py-4 space-y-5">
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
                            {qty === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
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
        <div className="sticky bottom-[68px] bg-[var(--card)] border-t border-[var(--border)] px-4 py-3 space-y-3">
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
          <button
            onClick={() => setSubmitted(true)}
            className="w-full py-3.5 rounded-xl bg-[var(--primary)] text-white font-semibold active:scale-[0.98] transition-transform"
          >
            Siparişi Onayla
          </button>
        </div>
      )}
    </div>
  );
}
