"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, MapPin, Navigation, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Ana Sayfa", href: "/home", icon: Home },
  { label: "Marketler", href: "/markets", icon: Store },
  { label: "Ziyaret", href: "/visit", icon: MapPin },
  { label: "Rotam", href: "/route", icon: Navigation },
  { label: "Profil", href: "/profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)] border-t border-[var(--border)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Ana navigasyon"
    >
      <div className="flex items-center justify-around h-[68px] px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors min-w-0",
                isActive
                  ? "text-[var(--primary)]"
                  : "text-[var(--muted-foreground)]"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn("w-6 h-6 shrink-0", isActive && "stroke-[2.5px]")}
                aria-hidden="true"
              />
              <span className="text-[10px] font-medium truncate leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
