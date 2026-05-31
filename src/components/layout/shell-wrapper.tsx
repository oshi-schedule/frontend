"use client";

import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { UserShell } from "@/components/layout/user-shell";

export function ShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) {
    return <AdminShell>{children}</AdminShell>;
  }
  return <UserShell>{children}</UserShell>;
}
