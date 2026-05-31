"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Plus, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/calendar/day", label: "Day", icon: CalendarDays },
  { href: "/add", label: "Add", icon: Plus },
  { href: "/admin/events", label: "Admin", icon: Settings }
];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mobile-shell">
      <main className="min-h-screen px-4 pb-24 pt-4">{children}</main>
      <nav className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-[480px] -translate-x-1/2 grid-cols-5 border-t border-[var(--border)] bg-white/95 px-2 py-2 backdrop-blur">
        {tabs.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-md text-xs text-[var(--muted)]",
                active && "bg-[#fceae5] text-[var(--primary)]"
              )}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
