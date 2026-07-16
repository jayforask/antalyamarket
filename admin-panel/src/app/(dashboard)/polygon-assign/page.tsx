"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { UserCheck, Trash2, Loader2, MapPin, CheckCircle, AlertTriangle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api/client";
import type { User, Market } from "@/types";

// Leaflet harita bileşenini Server-Side Rendering (SSR) olmadan yükle
const LeafletPolygonMap = dynamic(
  () => import("@/components/features/maps/LeafletPolygonMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[450px] flex flex-col items-center justify-center bg-[var(--muted)] gap-2 rounded-2xl border border-[var(--border)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
        <p className="text-xs text-[var(--muted-foreground)]">Harita yükleniyor...</p>
      </div>
    ),
  }
);

export default function PolygonAssignPage() {
  const [fieldReps, setFieldReps] = useState<User[]>([]);
  const [repsLoading, setRepsLoading] = useState(true);
  const [selectedRep, setSelectedRep] = useState<User | null>(null);

  // Poligon köşe koordinatları [{latitude, longitude}]
  const [points, setPoints] = useState<{ latitude: number; longitude: number }[]>([]);

  // Poligon içindeki marketler
  const [previewMarkets, setPreviewMarkets] = useState<Market[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Arama durumları
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [fitBoundsTrigger, setFitBoundsTrigger] = useState(0);

  // Temsilcileri yükle
  useEffect(() => {
    apiClient
      .get<{ users: User[]; total: number }>("/auth/users")
      .then(({ data }) => {
        const reps = (data.users ?? []).filter((u) => u.role === "field_rep");
        setFieldReps(reps);
        if (reps.length > 0) setSelectedRep(reps[0]);
      })
      .catch(() => setFieldReps([]))
      .finally(() => setRepsLoading(false));
  }, []);

  // Poligon köşeleri değiştikçe önizleme marketlerini çek (en az 3 köşe olmalı)
  useEffect(() => {
    if (points.length < 3) {
      setPreviewMarkets([]);
      return;
    }

    const fetchPreview = async () => {
      setIsPreviewLoading(true);
      try {
        const { data } = await apiClient.post<Market[]>("/portfolio/preview-polygon", {
          user_id: selectedRep?.id, // mock endpoint validation compatibility
          polygon_coords: points,
        });
        setPreviewMarkets(data);
      } catch {
        setPreviewMarkets([]);
      } finally {
        setIsPreviewLoading(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      fetchPreview();
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [points, selectedRep]);

  // Toast göster
  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // Seçilen alanın tamamını temsilciye ata
  const handleAssign = async () => {
    if (!selectedRep || previewMarkets.length === 0) return;
    setIsSaving(true);
    try {
      await apiClient.post("/portfolio/assign-by-polygon", {
        user_id: selectedRep.id,
        polygon_coords: points,
      });

      showToast(
        "success",
        `${previewMarkets.length} market başarıyla ${selectedRep.name} temsilcisine atandı.`
      );
      // Temizle
      setPoints([]);
      setPreviewMarkets([]);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Toplu atama yapılırken bir hata oluştu.";
      showToast("error", msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Bölge arama ve haritada poligon çizme
  const handleSearchRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const query = `${searchQuery}, Antalya, Turkey`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const place = data[0];
        const bbox = place.boundingbox; // [latMin, latMax, lngMin, lngMax]
        
        if (bbox && bbox.length === 4) {
          const latMin = parseFloat(bbox[0]);
          const latMax = parseFloat(bbox[1]);
          const lngMin = parseFloat(bbox[2]);
          const lngMax = parseFloat(bbox[3]);
          
          // 4 köşeyi saat yönünde oluştur
          const newPoints = [
            { latitude: latMax, longitude: lngMin }, // Sol üst
            { latitude: latMax, longitude: lngMax }, // Sağ üst
            { latitude: latMin, longitude: lngMax }, // Sağ alt
            { latitude: latMin, longitude: lngMin }, // Sol alt
          ];
          
          setPoints(newPoints);
          setFitBoundsTrigger((prev) => prev + 1);
          showToast("success", `"${searchQuery}" bölgesi başarıyla bulundu ve işaretlendi.`);
        } else {
          showToast("error", "Bölge sınırları tespit edilemedi.");
        }
      } else {
        showToast("error", "Bölge bulunamadı. Lütfen Antalya sınırlarında bir arama yapın.");
      }
    } catch (error) {
      console.error(error);
      showToast("error", "Bölge aranırken bir bağlantı hatası oluştu.");
    } finally {
      setIsSearching(false);
    }
  };

  // Çizimi sıfırla
  const handleReset = () => {
    setPoints([]);
    setPreviewMarkets([]);
    setSearchQuery("");
  };

  return (
    <div className="space-y-5 max-w-screen-xl">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed top-4 right-4 z-[9999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm animate-in fade-in slide-in-from-top-4 duration-300",
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Başlık */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Haritadan Poligon ile Atama</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Haritada serbest alanlar çizerek, içeride kalan marketleri temsilcilere toplu atayın.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol Sütun: Harita (2 Kolon Genişliğinde) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-4">
            {/* Bölge Arama Barı */}
            <form onSubmit={handleSearchRegion} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Bölge/Mahalle Ara (Örn: Kepez, Muratpaşa, Liman Mh.)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-[var(--primary)] font-medium"
                />
                <Search className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="flex items-center gap-1.5 bg-[var(--primary)] text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Aranıyor...
                  </>
                ) : (
                  "Bölgeyi Bul"
                )}
              </button>
            </form>

            <div className="h-[480px]">
              <LeafletPolygonMap
                points={points}
                setPoints={setPoints}
                previewMarkets={previewMarkets}
                fitBoundsTrigger={fitBoundsTrigger}
              />
            </div>
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-[var(--muted-foreground)]">
                Köşe Sayısı: <b className="text-[var(--foreground)]">{points.length}</b>
              </span>
              {points.length > 0 && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Çizimi Temizle
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sağ Sütun: Temsilci & Seçilen Noktalar */}
        <div className="space-y-4">
          {/* Temsilci Kartı */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-sm text-[var(--foreground)]">1. Temsilciyi Seçin</h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Atanacak saha personelini belirleyin</p>
            </div>

            {repsLoading ? (
              <div className="space-y-2">
                <div className="h-9 w-full bg-[var(--muted)] rounded-lg animate-pulse" />
              </div>
            ) : fieldReps.length === 0 ? (
              <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 text-xs rounded-xl">
                Sistemde atanabilir saha temsilcisi bulunamadı.
              </div>
            ) : (
              <select
                value={selectedRep?.id ?? ""}
                onChange={(e) => {
                  const rep = fieldReps.find((r) => r.id === e.target.value);
                  setSelectedRep(rep ?? null);
                }}
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-xl px-3 py-2.5 outline-none focus:border-[var(--primary)]"
              >
                {fieldReps.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Önizleme & Sonuç Kartı */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-4 flex flex-col min-h-[300px]">
            <div>
              <h3 className="font-bold text-sm text-[var(--foreground)]">2. Bölge Önizlemesi</h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Seçtiğiniz alanda kalan marketler</p>
            </div>

            <div className="flex-1 flex flex-col justify-between">
              {points.length < 3 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center gap-2">
                  <MapPin className="w-8 h-8 text-[var(--muted-foreground)] opacity-50" />
                  <p className="text-xs text-[var(--muted-foreground)] max-w-[200px]">
                    Önizleme için harita üzerine en az **3 köşe noktası** eklemelisiniz.
                  </p>
                </div>
              ) : isPreviewLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                  <p className="text-xs text-[var(--muted-foreground)] mt-2">Marketler hesaplanıyor...</p>
                </div>
              ) : previewMarkets.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center gap-2">
                  <AlertTriangle className="w-8 h-8 text-amber-500 opacity-80" />
                  <p className="text-xs text-[var(--muted-foreground)] max-w-[200px]">
                    Seçtiğiniz alanın içinde market bulunamadı.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 flex-1">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-xs rounded-xl flex items-center justify-between">
                    <span className="text-emerald-800 dark:text-emerald-400 font-medium">Bulunan Market Sayısı:</span>
                    <b className="text-emerald-900 dark:text-emerald-300 text-sm font-extrabold">
                      {previewMarkets.length}
                    </b>
                  </div>

                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {previewMarkets.slice(0, 10).map((market) => (
                      <div
                        key={market.id}
                        className="p-2 border border-[var(--border)] rounded-lg text-xs truncate bg-[var(--background)]"
                      >
                        <p className="font-semibold text-[var(--foreground)] truncate">{market.name}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)] truncate mt-0.5">
                          {market.address}
                        </p>
                      </div>
                    ))}
                    {previewMarkets.length > 10 && (
                      <p className="text-[10px] text-center text-[var(--muted-foreground)] font-medium pt-1">
                        ...ve diğer {previewMarkets.length - 10} market
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Atama Butonu */}
              {previewMarkets.length > 0 && selectedRep && (
                <button
                  onClick={handleAssign}
                  disabled={isSaving}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-[var(--primary)] text-white font-semibold py-3 px-4 rounded-xl text-sm active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Atanıyor...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      Portföye Ekle
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
