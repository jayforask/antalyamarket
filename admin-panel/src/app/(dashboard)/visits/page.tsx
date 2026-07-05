"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, MapPin, Camera, Search, User, Loader2 } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { apiClient } from "@/lib/api/client";
import type { Visit } from "@/types";

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);

  useEffect(() => {
    apiClient
      .get<Visit[] | { visits: Visit[]; total: number }>("/operations/visits?page_size=100")
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data?.visits ?? []);
        setVisits(list);
      })
      .catch(() => setVisits([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = visits.filter((v) => {
    const matchSearch =
      !search ||
      v.market?.name?.toLowerCase().includes(search.toLowerCase()) ||
      v.user?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "success" && v.is_successful) ||
      (statusFilter === "fail" && !v.is_successful);
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5 max-w-screen-xl">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Ziyaretler</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          {loading ? "Yükleniyor..." : `Toplam ${filtered.length} ziyaret`}
        </p>
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap gap-3 p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" aria-hidden="true" />
          <input
            type="search"
            placeholder="Market veya temsilci ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          aria-label="Durum filtresi"
        >
          <option value="all">Tüm Durumlar</option>
          <option value="success">Başarılı</option>
          <option value="fail">Başarısız</option>
        </select>
      </div>

      {/* Tablo */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MapPin className="w-10 h-10 text-[var(--muted-foreground)] mb-3" />
            <p className="text-sm text-[var(--muted-foreground)]">
              {visits.length === 0 ? "Henüz ziyaret kaydı yok" : "Arama sonucu bulunamadı"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Market</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Temsilci</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Tarih/Saat</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Konum</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Durum</th>
                  <th className="text-right px-4 py-3 font-medium text-[var(--muted-foreground)]">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((visit) => (
                  <tr key={visit.id} className="hover:bg-[var(--muted)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--foreground)]">{visit.market?.name ?? "—"}</div>
                      <div className="text-xs text-[var(--muted-foreground)] truncate max-w-40">{visit.market?.address}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {visit.user?.name?.charAt(0) ?? "?"}
                        </div>
                        <span className="text-[var(--foreground)] truncate">{visit.user?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)] hidden md:table-cell text-xs">
                      {formatDateTime(visit.timestamp)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {visit.gps_coords ? (
                        <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                          <MapPin className="w-3 h-3" aria-hidden="true" />
                          {visit.gps_coords.lat.toFixed(4)}, {visit.gps_coords.lng.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {visit.is_successful ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                          <CheckCircle className="w-4 h-4" aria-hidden="true" />
                          Başarılı
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                          <XCircle className="w-4 h-4" aria-hidden="true" />
                          Başarısız
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedVisit(visit)}
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
        )}
      </div>

      {/* Detay Modal */}
      {selectedVisit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedVisit(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Ziyaret detayı"
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Ziyaret Detayı</h3>
              <button onClick={() => setSelectedVisit(null)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors" aria-label="Kapat">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <DetailRow icon={<User className="w-4 h-4" />} label="Temsilci" value={selectedVisit.user?.name ?? "—"} />
              <DetailRow icon={<MapPin className="w-4 h-4" />} label="Market" value={selectedVisit.market?.name ?? "—"} />
              <DetailRow icon={<MapPin className="w-4 h-4" />} label="Adres" value={selectedVisit.market?.address ?? "—"} />
              <DetailRow icon={<CheckCircle className="w-4 h-4" />} label="Durum" value={selectedVisit.is_successful ? "Başarılı" : "Başarısız"} />
              {selectedVisit.note && <DetailRow icon={<Camera className="w-4 h-4" />} label="Not" value={selectedVisit.note} />}
              {selectedVisit.photo_url && (
                <div className="mt-3 rounded-lg overflow-hidden bg-[var(--muted)] h-32 flex items-center justify-center text-[var(--muted-foreground)] text-xs">
                  <Camera className="w-6 h-6 mr-2" aria-hidden="true" />
                  Ziyaret fotoğrafı
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[var(--muted-foreground)] mt-0.5 shrink-0">{icon}</span>
      <div>
        <span className="text-[var(--muted-foreground)]">{label}: </span>
        <span className="text-[var(--foreground)] font-medium">{value}</span>
      </div>
    </div>
  );
}
