"use client";

import { useState } from "react";
import { Search, ShoppingCart, Package } from "lucide-react";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import type { Order } from "@/types";

const MOCK_ORDERS: Order[] = [
  {
    id: "o1", visit_id: "1", created_at: "2024-07-03T09:20:00Z",
    total_amount: 1250.50,
    product_details: [
      { product_id: "p1", name: "Ürün A", quantity: 5, unit_price: 150 },
      { product_id: "p2", name: "Ürün B", quantity: 10, unit_price: 62.5 },
      { product_id: "p3", name: "Ürün C", quantity: 3, unit_price: 58.33 },
    ],
    visit: { id: "1", market_id: "1", user_id: "u1", timestamp: "2024-07-03T09:15:00Z", gps_coords: { lat: 36.884, lng: 30.695 }, is_successful: true, market: { id: "1", name: "Migros Konyaaltı", type: "market", address: "Konyaaltı Cad.", latitude: 36.884, longitude: 30.695, is_verified: true, is_corporate: false, source: "api", created_at: "" }, user: { id: "u1", name: "Ahmet Yılmaz", email: "", role: "field_rep", created_at: "" } },
  },
  {
    id: "o2", visit_id: "3", created_at: "2024-07-03T11:50:00Z",
    total_amount: 875.00,
    product_details: [
      { product_id: "p1", name: "Ürün A", quantity: 3, unit_price: 150 },
      { product_id: "p4", name: "Ürün D", quantity: 7, unit_price: 53.57 },
    ],
    visit: { id: "3", market_id: "3", user_id: "u1", timestamp: "2024-07-03T11:45:00Z", gps_coords: { lat: 36.879, lng: 30.712 }, is_successful: true, market: { id: "3", name: "BİM Muratpaşa", type: "market", address: "Muratpaşa Mah.", latitude: 36.879, longitude: 30.712, is_verified: true, is_corporate: false, source: "api", created_at: "" }, user: { id: "u1", name: "Ahmet Yılmaz", email: "", role: "field_rep", created_at: "" } },
  },
  {
    id: "o3", visit_id: "4", created_at: "2024-07-03T13:10:00Z",
    total_amount: 2100.00,
    product_details: [
      { product_id: "p2", name: "Ürün B", quantity: 20, unit_price: 62.5 },
      { product_id: "p3", name: "Ürün C", quantity: 15, unit_price: 50 },
      { product_id: "p5", name: "Ürün E", quantity: 8, unit_price: 37.5 },
    ],
    visit: { id: "4", market_id: "4", user_id: "u3", timestamp: "2024-07-03T13:00:00Z", gps_coords: { lat: 36.872, lng: 30.699 }, is_successful: true, market: { id: "4", name: "A101 Kepez", type: "market", address: "Kepez Mah.", latitude: 36.872, longitude: 30.699, is_verified: true, is_corporate: false, source: "api", created_at: "" }, user: { id: "u3", name: "Mehmet Demir", email: "", role: "field_rep", created_at: "" } },
  },
];

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filtered = MOCK_ORDERS.filter((o) =>
    !search ||
    o.visit?.market?.name.toLowerCase().includes(search.toLowerCase()) ||
    o.visit?.user?.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = filtered.reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div className="space-y-5 max-w-screen-xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Siparişler</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {filtered.length} sipariş · Toplam {formatCurrency(totalRevenue)}
          </p>
        </div>
      </div>

      {/* Arama */}
      <div className="flex gap-3 p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" aria-hidden="true" />
          <input
            type="search"
            placeholder="Market veya temsilci ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Market</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Temsilci</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Tarih</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Ürün Sayısı</th>
                <th className="text-right px-4 py-3 font-medium text-[var(--muted-foreground)]">Tutar</th>
                <th className="text-right px-4 py-3 font-medium text-[var(--muted-foreground)]">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-[var(--muted)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" aria-hidden="true" />
                      <span className="font-medium text-[var(--foreground)]">
                        {order.visit?.market?.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">
                    {order.visit?.user?.name}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)] hidden md:table-cell text-xs">
                    {formatDateTime(order.created_at)}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)] hidden lg:table-cell">
                    {order.product_details.length} ürün
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--foreground)]">
                    {formatCurrency(order.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
                    >
                      Görüntüle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detay Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedOrder(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Sipariş detayı"
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Sipariş Detayı</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]" aria-label="Kapat">✕</button>
            </div>
            <div className="text-sm space-y-1 mb-4">
              <p><span className="text-[var(--muted-foreground)]">Market: </span><span className="font-medium">{selectedOrder.visit?.market?.name}</span></p>
              <p><span className="text-[var(--muted-foreground)]">Temsilci: </span><span className="font-medium">{selectedOrder.visit?.user?.name}</span></p>
              <p><span className="text-[var(--muted-foreground)]">Tarih: </span><span className="font-medium">{formatDateTime(selectedOrder.created_at)}</span></p>
            </div>
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)]">Ürün</th>
                    <th className="text-center px-3 py-2 font-medium text-[var(--muted-foreground)]">Adet</th>
                    <th className="text-right px-3 py-2 font-medium text-[var(--muted-foreground)]">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {selectedOrder.product_details.map((p) => (
                    <tr key={p.product_id}>
                      <td className="px-3 py-2 flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
                        {p.name}
                      </td>
                      <td className="px-3 py-2 text-center text-[var(--muted-foreground)]">{p.quantity}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(p.quantity * p.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--border)] bg-[var(--muted)]">
                    <td colSpan={2} className="px-3 py-2 font-semibold">Toplam</td>
                    <td className="px-3 py-2 text-right font-bold text-[var(--primary)]">{formatCurrency(selectedOrder.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
