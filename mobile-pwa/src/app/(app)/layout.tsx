"use client";

import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      <main
        className="flex-1 overflow-y-auto scroll-container"
        style={{ paddingBottom: "calc(68px + env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
