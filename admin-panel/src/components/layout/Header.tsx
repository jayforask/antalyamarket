"use client";

import { Menu, Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/markets": "Marketler",
  "/visits": "Ziyaretler",
  "/orders": "Siparişler",
  "/reports": "Raporlar",
  "/users": "Kullanıcılar",
};

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();

  const title =
    Object.entries(PAGE_TITLES).find(([key]) =>
      pathname.startsWith(key)
    )?.[1] ?? "Panel";

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center gap-4 px-4 sm:px-6 bg-[var(--card)] border-b border-[var(--border)] shrink-0">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-colors"
        aria-label="Menüyü aç"
      >
        <Menu className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Page title */}
      <h1 className="text-lg font-semibold text-[var(--foreground)] flex-1">
        {title}
      </h1>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <button
          className={cn(
            "relative p-2 rounded-lg",
            "hover:bg-[var(--muted)] text-[var(--muted-foreground)]",
            "transition-colors"
          )}
          aria-label="Bildirimler"
        >
          <Bell className="w-5 h-5" aria-hidden="true" />
          {/* Bildirim badge */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--destructive)] rounded-full" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
