"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CalendarRange, Home, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/calendar/day", label: "Day", icon: CalendarDays },
  { href: "/calendar/month", label: "Month", icon: CalendarRange },
];

function NavLink({ href, label, icon: Icon, active, vertical = false }: {
  href: string; label: string; icon: React.ElementType; active: boolean; vertical?: boolean;
}) {
  if (vertical) {
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          active
            ? "bg-[#fceae5] text-[var(--primary)]"
            : "text-[var(--muted)] hover:bg-gray-100 hover:text-[var(--foreground)]"
        )}
      >
        <Icon size={18} />
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors",
        active ? "text-[var(--primary)]" : "text-[var(--muted)]"
      )}
    >
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  );
}

export function UserShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen">
      {/* PC sidebar (≥ 1024px) */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 border-r border-[var(--border)] bg-white z-30">
        <div className="px-5 py-6 border-b border-[var(--border)]">
          <Link href="/">
            <h1 className="text-lg font-bold text-[var(--primary)]">推しスケ</h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">ライブ遠征管理</p>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(item.href)} vertical />
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-[var(--border)]">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <Settings size={13} />
            Admin
          </Link>
        </div>
      </aside>

      {/* Tablet top nav (768–1023px) */}
      <header className="hidden md:flex lg:hidden sticky top-0 z-20 bg-white border-b border-[var(--border)] px-4 items-center gap-1 h-14">
        <Link href="/" className="mr-4 text-sm font-bold text-[var(--primary)]">推しスケ</Link>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-[#fceae5] text-[var(--primary)]"
                  : "text-[var(--muted)] hover:bg-gray-100"
              )}
            >
              <Icon size={15} />
              {item.label}
            </Link>
          );
        })}
        <Link href="/admin" className="ml-auto text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
          Admin
        </Link>
      </header>

      {/* Main content */}
      <main className="lg:ml-60 min-h-screen">
        <div className="mx-auto max-w-5xl px-4 pt-4 pb-24 md:pt-6 lg:py-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav (< 768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-[var(--border)] bg-white/95 backdrop-blur-sm px-2 py-1">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>
    </div>
  );
}
