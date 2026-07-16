"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  MapPin,
  ShoppingCart,
  BarChart2,
  Users,
  LogOut,
  BarChart3,
  X,
  Map,
  Route,
  Briefcase,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Marketler", href: "/markets", icon: Store },
  { label: "Ziyaretler", href: "/visits", icon: MapPin },
  { label: "Siparişler", href: "/orders", icon: ShoppingCart },
  { label: "Raporlar", href: "/reports", icon: BarChart2 },
  { label: "Kullanıcılar", href: "/users", icon: Users },
  { label: "Harita Takibi", href: "/maps", icon: Map },
  { label: "Rota Planlama", href: "/routes", icon: Route },
  { label: "Portföy Yönetimi", href: "/portfolio", icon: Briefcase },
  { label: "Haritadan Atama", href: "/polygon-assign", icon: MapPin },
  { label: "Haftalık Rotalar", href: "/weekly-routes", icon: CalendarDays },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full flex flex-col",
          "w-[260px] bg-[var(--card)] border-r border-[var(--border)]",
          "transition-transform duration-300 ease-in-out",
          "lg:translate-x-0 lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="font-bold text-[var(--foreground)] text-sm leading-tight">
              SFA Admin
            </span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-colors"
            aria-label="Menüyü kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="px-3 py-4 border-t border-[var(--border)] shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.name?.charAt(0).toUpperCase() ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {user?.name ?? "Admin"}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] truncate">
                {user?.email ?? ""}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--destructive)] transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            Çıkış Yap
          </button>
        </div>
      </aside>
    </>
  );
}
