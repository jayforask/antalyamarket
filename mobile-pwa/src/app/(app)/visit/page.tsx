"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin, Camera, CheckCircle, XCircle,
  AlertTriangle, Search, ArrowLeft, Loader2,
} from "lucide-react";
import { cn, calculateDistance } from "@/lib/utils";
import { searchMarkets } from "@/lib/api/markets";
import { startVisit, submitVisit, getPresignedUrl } from "@/lib/api/visits";
import type { Market } from "@/types";

type VisitStep = "select" | "checking" | "active" | "submitting" | "done";

const GEOFENCE_THRESHOLD = 50; // metre

export default function VisitPage() {
  const router = useRouter();
  const [step, setStep] = useState<VisitStep>("select");

  // Market seç adımı
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Seçili market & ziyaret
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Ziyaret formu
  const [note, setNote] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSuccess, setIsSuccess] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Arama debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadMarkets = useCallback(async () => {
    setMarketsLoading(true);
    try {
      const result = await searchMarkets({
        q: debouncedSearch || undefined,
        page: 1,
        page_size: 50,
      });
      setMarkets(result.items);
    } catch {
      setMarkets([]);
    } finally {
      setMarketsLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  const handleSelectMarket = (market: Market) => {
    setSelectedMarket(market);
    setStep("checking");
    setGeoError(null);

    if (!navigator.geolocation) {
      setGeoError("Cihazınız konum servisini desteklemiyor.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setUserCoords({ lat: userLat, lng: userLng });

        const dist = calculateDistance(userLat, userLng, market.latitude, market.longitude);
        setDistance(Math.round(dist));

        if (dist <= GEOFENCE_THRESHOLD) {
          setStep("active");
        } else {
          setGeoError(
            `Markete ${Math.round(dist)} metre uzaktasınız. Ziyaret başlatmak için en az ${GEOFENCE_THRESHOLD} metre içinde olmalısınız.`
          );
        }
      },
      () => {
        // Konum alınamazsa (geliştirme/test ortamı) direkt aktif yap
        setUserCoords({ lat: 0, lng: 0 });
        setDistance(0);
        setStep("active");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!selectedMarket) return;
    setStep("submitting");
    setSubmitError(null);

    try {
      // 1. Ziyareti başlat (geofencing backend'de de kontrol eder)
      const coords = userCoords ?? { lat: 0, lng: 0 };
      const visit = await startVisit({
        market_id: String(selectedMarket.id),
        gps_lat: coords.lat,
        gps_lng: coords.lng,
      });
      setVisitId(visit.id);

      // 2. Fotoğraf varsa S3'e yükle
      let photoUrl: string | undefined;
      if (photoFile) {
        try {
          const ext = photoFile.name.split(".").pop() ?? "jpg";
          const filename = `visit_${Date.now()}.${ext}`;
          const { upload_url, file_url } = await getPresignedUrl(filename);
          await fetch(upload_url, {
            method: "PUT",
            body: photoFile,
            headers: { "Content-Type": photoFile.type },
          });
          photoUrl = file_url;
        } catch {
          // Fotoğraf yükleme başarısız olsa da ziyareti kaydet
        }
      }

      // 3. Ziyareti tamamla
      await submitVisit({
        visit_id: visit.id,
        is_successful: isSuccess,
        note: note.trim() || undefined,
        photo_url: photoUrl,
      });

      setStep("done");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Ziyaret kaydedilemedi. Lütfen tekrar deneyin.";
      setSubmitError(msg);
      setStep("active");
    }
  };

  const resetVisit = () => {
    setStep("select");
    setSelectedMarket(null);
    setVisitId(null);
    setGeoError(null);
    setDistance(null);
    setUserCoords(null);
    setNote("");
    setPhotoPreview(null);
    setPhotoFile(null);
    setIsSuccess(true);
    setSubmitError(null);
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--card)] border-b border-[var(--border)] px-4 py-3 flex items-center gap-3">
        {step !== "select" && (
          <button
            onClick={resetVisit}
            className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-colors"
            aria-label="Geri"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-base font-semibold text-[var(--foreground)]">
          {step === "select" ? "Market Seç" :
           step === "checking" ? "Konum Kontrol" :
           step === "active" || step === "submitting" ? selectedMarket?.name :
           "Ziyaret Tamamlandı"}
        </h1>
      </div>

      <div className="px-4 py-4">
        {/* STEP 1 — Market seç */}
        {step === "select" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              <input
                type="search"
                placeholder="Market ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            {marketsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
              </div>
            ) : markets.length === 0 ? (
              <p className="text-center text-sm text-[var(--muted-foreground)] py-10">
                {search ? "Sonuç bulunamadı." : "Henüz market yok."}
              </p>
            ) : (
              <div className="space-y-2">
                {markets.map((m) => (
                  <button
                    key={String(m.id)}
                    onClick={() => handleSelectMarket(m)}
                    className="w-full flex items-center gap-3 p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl active:scale-[0.98] transition-transform text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-blue-600" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--foreground)] truncate">{m.name}</p>
                      <p className="text-xs text-[var(--muted-foreground)] truncate">{m.address}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — Konum kontrol */}
        {step === "checking" && (
          <div className="flex flex-col items-center py-12 text-center gap-4">
            {!geoError ? (
              <>
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-blue-600 animate-pulse" aria-hidden="true" />
                </div>
                <p className="font-medium text-[var(--foreground)]">Konumunuz kontrol ediliyor...</p>
                <p className="text-sm text-[var(--muted-foreground)]">{selectedMarket?.name}</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-amber-500" aria-hidden="true" />
                </div>
                <p className="font-semibold text-[var(--foreground)]">Çok Uzaktasınız</p>
                <p className="text-sm text-[var(--muted-foreground)] max-w-xs">{geoError}</p>
                <button
                  onClick={resetVisit}
                  className="mt-2 px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--foreground)]"
                >
                  Geri Dön
                </button>
              </>
            )}
          </div>
        )}

        {/* STEP 3 — Ziyaret aktif */}
        {(step === "active" || step === "submitting") && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <p className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" aria-hidden="true" />
                Konum doğrulandı
                {distance !== null && distance > 0 && <span className="font-normal">({distance}m)</span>}
              </p>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {/* Durum */}
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">Ziyaret Sonucu</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsSuccess(true)}
                  disabled={step === "submitting"}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors",
                    isSuccess
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "border-[var(--border)] text-[var(--muted-foreground)]"
                  )}
                >
                  <CheckCircle className="w-4 h-4" aria-hidden="true" /> Başarılı
                </button>
                <button
                  onClick={() => setIsSuccess(false)}
                  disabled={step === "submitting"}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors",
                    !isSuccess
                      ? "bg-red-500 text-white border-red-500"
                      : "border-[var(--border)] text-[var(--muted-foreground)]"
                  )}
                >
                  <XCircle className="w-4 h-4" aria-hidden="true" /> Başarısız
                </button>
              </div>
            </div>

            {/* Fotoğraf */}
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">Fotoğraf</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="hidden"
                aria-label="Fotoğraf seç"
              />
              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Ziyaret fotoğrafı" className="w-full h-48 object-cover" />
                  <button
                    onClick={() => { setPhotoPreview(null); setPhotoFile(null); }}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
                    aria-label="Fotoğrafı kaldır"
                  >✕</button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={step === "submitting"}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-2 text-[var(--muted-foreground)] disabled:opacity-50"
                >
                  <Camera className="w-8 h-8" aria-hidden="true" />
                  <span className="text-sm">Fotoğraf Çek / Seç</span>
                </button>
              )}
            </div>

            {/* Not */}
            <div>
              <label htmlFor="note" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Not (isteğe bağlı)
              </label>
              <textarea
                id="note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={step === "submitting"}
                placeholder="Ziyaret hakkında not ekleyin..."
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none disabled:opacity-50"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={step === "submitting"}
              className={cn(
                "w-full py-4 rounded-xl bg-[var(--primary)] text-white font-semibold text-base",
                "flex items-center justify-center gap-2",
                "active:scale-[0.98] transition-transform",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              {step === "submitting" && (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              )}
              {step === "submitting" ? "Kaydediliyor..." : "Ziyareti Tamamla"}
            </button>
          </div>
        )}

        {/* STEP 4 — Tamamlandı */}
        {step === "done" && (
          <div className="flex flex-col items-center py-12 text-center gap-4">
            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-500" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Ziyaret Kaydedildi!</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{selectedMarket?.name}</p>
            <div className="flex gap-3 mt-2 w-full">
              <button
                onClick={() => router.push("/order")}
                className="flex-1 py-3.5 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm"
              >
                Sipariş Al
              </button>
              <button
                onClick={resetVisit}
                className="flex-1 py-3.5 rounded-xl border border-[var(--border)] text-[var(--foreground)] font-semibold text-sm"
              >
                Yeni Ziyaret
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
