"use client";

import { useState } from "react";
import { Search, MapPin, Phone, Plus, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Market, MarketType } from "@/types";

const TYPE_LABELS: Record<MarketType, string> = {
  market: "Market", restaurant: "Restoran", cafe: "Kafe", bakkal: "Bakkal", other: "Diğer",
};

const MOCK_MARKETS: Market[] = [
  { id: "1", name: "Migros Konyaaltı", type: "market", address: "Konyaaltı Cad. No:15, Antalya", phone: "0242 123 45 67", latitude: 36.884, longitude: 30.695, is_verified: true },
  { id: "2", name: "ŞokMarket Lara", type: "market", address: "Lara Cad. No:42, Antalya", latitude: 36.862, longitude: 30.731, is_verified: true },
  { id: "3", name: "Cafe Mola", type: "cafe", address: "Atatürk Blv. No:8, Antalya", latitude: 36.890, longitude: 30.704, is_verified: false },
  { id: "4", name: "BİM Muratpaşa", type: "market", address: "Muratpaşa Mah. No:5", phone: "0242 345 67 89", latitude: 36.879, longitude: 30.712, is_verified: true },
  { id: "5", name: "Ahmet Bakkalı", type: "bakkal", address: "Yıldız Sok. No:3, Antalya", latitude: 36.872, longitude: 30.699, is_verified: false },
];

export default function MarketsPage() {
  const [search, setSearch] = useState("");

  const filtered = MOCK_MARKETS.filter(
    (m) =>
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-4 pt-4 pb-2 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--foreground)]">Marketler</h1>
        <button
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium active:scale-95 transition-transform"
          aria-label="Yeni market ekle"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Ekle
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" aria-hidden="true" />
        <input
          type="search"
          placeholder="Market ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      <p className="text-xs text-[var(--muted-foreground)]">{filtered.length} market</p>

      <div className="space-y-2">
        {filtered.map((market) => (
          <div
            key={market.id}
            className="p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[var(--foreground)] truncate">{market.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)] shrink-0">
                    {TYPE_LABELS[market.type]}
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
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" aria-label="Doğrulandı" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
