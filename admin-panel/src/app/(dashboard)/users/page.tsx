"use client";

import { useState } from "react";
import { Search, Plus, Shield, User, BarChart2 } from "lucide-react";
import { cn, formatDate, formatDuration } from "@/lib/utils";
import type { User as UserType, UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Yönetici",
  manager: "Müdür",
  field_rep: "Saha Temsilcisi",
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-purple-50 text-purple-700",
  manager: "bg-blue-50 text-blue-700",
  field_rep: "bg-emerald-50 text-emerald-700",
};

interface UserWithStats extends UserType {
  total_visits_today: number;
  efficiency_score: number;
  shift_duration: number; // minutes
  is_active: boolean;
}

const MOCK_USERS: UserWithStats[] = [
  { id: "u1", name: "Ahmet Yılmaz", email: "ahmet@firma.com", role: "field_rep", created_at: "2024-01-15T00:00:00Z", total_visits_today: 24, efficiency_score: 94, shift_duration: 480, is_active: true },
  { id: "u2", name: "Fatma Kaya", email: "fatma@firma.com", role: "field_rep", created_at: "2024-02-01T00:00:00Z", total_visits_today: 21, efficiency_score: 88, shift_duration: 450, is_active: true },
  { id: "u3", name: "Mehmet Demir", email: "mehmet@firma.com", role: "field_rep", created_at: "2024-02-15T00:00:00Z", total_visits_today: 19, efficiency_score: 82, shift_duration: 420, is_active: true },
  { id: "u4", name: "Ayşe Çelik", email: "ayse@firma.com", role: "field_rep", created_at: "2024-03-01T00:00:00Z", total_visits_today: 0, efficiency_score: 76, shift_duration: 0, is_active: false },
  { id: "u5", name: "Hasan Arslan", email: "hasan@firma.com", role: "field_rep", created_at: "2024-03-10T00:00:00Z", total_visits_today: 15, efficiency_score: 70, shift_duration: 360, is_active: true },
  { id: "u6", name: "Admin Kullanıcı", email: "admin@firma.com", role: "admin", created_at: "2023-12-01T00:00:00Z", total_visits_today: 0, efficiency_score: 0, shift_duration: 0, is_active: true },
];

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);

  const filtered = MOCK_USERS.filter((u) => {
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const activeCount = MOCK_USERS.filter((u) => u.is_active && u.role === "field_rep").length;

  return (
    <div className="space-y-5 max-w-screen-xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Kullanıcılar</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {filtered.length} kullanıcı · {activeCount} aktif saha temsilcisi
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" aria-hidden="true" />
          Yeni Kullanıcı
        </button>
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap gap-3 p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" aria-hidden="true" />
          <input
            type="search"
            placeholder="İsim veya e-posta ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          aria-label="Rol filtresi"
        >
          <option value="all">Tüm Roller</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Kullanıcı kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((user) => (
          <div
            key={user.id}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedUser(user)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setSelectedUser(user)}
            aria-label={`${user.name} kullanıcı kartı`}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-bold">
                  {user.name.charAt(0)}
                </div>
                {user.role === "field_rep" && (
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--card)]",
                      user.is_active ? "bg-emerald-500" : "bg-zinc-400"
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-[var(--foreground)] truncate">{user.name}</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium shrink-0", ROLE_COLORS[user.role])}>
                    {ROLE_LABELS[user.role]}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">{user.email}</p>
              </div>
            </div>

            {user.role === "field_rep" && (
              <div className="mt-3 pt-3 border-t border-[var(--border)] grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-[var(--foreground)]">{user.total_visits_today}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Ziyaret</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--foreground)]">{user.efficiency_score}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Skor</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--foreground)]">{formatDuration(user.shift_duration)}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Mesai</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Detay Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedUser(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Kullanıcı detayı"
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-lg font-bold">
                  {selectedUser.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">{selectedUser.name}</h3>
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium", ROLE_COLORS[selectedUser.role])}>
                    {ROLE_LABELS[selectedUser.role]}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]" aria-label="Kapat">✕</button>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                <User className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{selectedUser.email}</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                <Shield className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Kayıt: {formatDate(selectedUser.created_at)}</span>
              </div>
              {selectedUser.role === "field_rep" && (
                <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                  <BarChart2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Bugün {selectedUser.total_visits_today} ziyaret · Skor: {selectedUser.efficiency_score}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
