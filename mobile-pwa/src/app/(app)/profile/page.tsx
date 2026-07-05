"use client";

import { useRouter } from "next/navigation";
import { LogOut, User, Mail, Shield, BarChart2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const ROLE_LABELS = {
  admin: "Yönetici",
  manager: "Müdür",
  field_rep: "Saha Temsilcisi",
};

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      {/* Avatar + isim */}
      <div className="flex flex-col items-center text-center gap-3 pb-4">
        <div className="w-20 h-20 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-3xl font-bold shadow-lg">
          {user?.name?.charAt(0) ?? "T"}
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">{user?.name ?? "Temsilci"}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
            {user?.role ? ROLE_LABELS[user.role] : "Saha Temsilcisi"}
          </span>
        </div>
      </div>

      {/* Bilgiler */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <User className="w-5 h-5 text-[var(--muted-foreground)] shrink-0" aria-hidden="true" />
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Ad Soyad</p>
            <p className="text-sm font-medium text-[var(--foreground)]">{user?.name ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Mail className="w-5 h-5 text-[var(--muted-foreground)] shrink-0" aria-hidden="true" />
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">E-posta</p>
            <p className="text-sm font-medium text-[var(--foreground)]">{user?.email ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Shield className="w-5 h-5 text-[var(--muted-foreground)] shrink-0" aria-hidden="true" />
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Rol</p>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {user?.role ? ROLE_LABELS[user.role] : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Bugünkü özet */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-4 h-4 text-[var(--muted-foreground)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Bugünkü Özet</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold text-[var(--foreground)]">12</p>
            <p className="text-xs text-[var(--muted-foreground)]">Ziyaret</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--foreground)]">10</p>
            <p className="text-xs text-[var(--muted-foreground)]">Başarılı</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--primary)]">83%</p>
            <p className="text-xs text-[var(--muted-foreground)]">Skor</p>
          </div>
        </div>
      </div>

      {/* Çıkış */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-200 bg-red-50 text-red-600 font-semibold text-sm active:scale-[0.98] transition-transform"
      >
        <LogOut className="w-4 h-4" aria-hidden="true" />
        Çıkış Yap
      </button>
    </div>
  );
}
