"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  DatabaseZap,
  FileText,
  FlaskConical,
  GitMerge,
  LayoutDashboard,
  ScanSearch,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminNavSections = [
  {
    label: "Core",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/events", label: "Events", icon: Calendar },
      { href: "/admin/groups", label: "Groups", icon: Users },
      { href: "/admin/venues", label: "Venues", icon: Building2 },
      { href: "/admin/merge", label: "Merge", icon: GitMerge },
      { href: "/admin/sources", label: "Sources", icon: FileText },
    ],
  },
  {
    label: "Labeling",
    items: [
      { href: "/admin/training-dataset", label: "Labeling Upload", icon: DatabaseZap },
      { href: "/admin/candidate-queue", label: "Candidate Queue", icon: ClipboardList, exact: true },
      { href: "/admin/event-candidate-reviews", label: "Labeling Analytics", icon: BarChart3, exact: true },
      { href: "/admin/event-candidate-review", label: "Draft Review", icon: ClipboardCheck, exact: true },
      { href: "/admin/ocr-test", label: "OCR Draft Upload", icon: ScanSearch, exact: true },
    ],
  },
  {
    label: "Labs",
    items: [
      { href: "/admin/ocr-evaluation", label: "OCR Evaluation", icon: FlaskConical, exact: true },
      { href: "/admin/vision-structure-test", label: "Vision Structure", icon: FlaskConical, exact: true },
    ],
  },
];

const mobileNavItems = adminNavSections.flatMap((section) => section.items);

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* PC/Tablet sidebar */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-60 bg-[#1e293b] text-slate-200 z-30">
        <div className="px-4 py-5 border-b border-slate-700">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">推しスケ</p>
          <h2 className="text-sm font-bold mt-1 text-white">Admin Panel</h2>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
          {adminNavSections.map((section) => (
            <div key={section.label}>
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(({ href, label, icon: Icon, exact }) => {
                  const active = isActive(href, exact);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        active
                          ? "bg-[var(--primary)] text-white"
                          : "text-slate-400 hover:bg-slate-700 hover:text-white"
                      )}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-slate-700">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowLeft size={12} />
            利用者画面
          </Link>
        </div>
      </aside>

      {/* Mobile: horizontal scroll top nav */}
      <header className="md:hidden sticky top-0 z-20 bg-[#1e293b] text-slate-200 border-b border-slate-700">
        <div className="flex items-center gap-1 px-3 h-12 overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold text-white mr-2 shrink-0">Admin</span>
          {mobileNavItems.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap shrink-0 transition-colors",
                  active ? "bg-[var(--primary)] text-white" : "text-slate-400 hover:text-white"
                )}
              >
                <Icon size={13} />
                {label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 md:ml-60 min-h-screen bg-[var(--background)]">
        <div className="mx-auto max-w-5xl px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
