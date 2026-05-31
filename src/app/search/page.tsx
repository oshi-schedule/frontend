"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Calendar, Mic2, Search, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { searchEntities } from "@/api/search";
import { DevProfiler } from "@/lib/dev-profiler";
import { useDebounce } from "@/hooks/use-debounce";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const icons = { event: Calendar, group: Users, member: Mic2, venue: Building2 };
const typeColors: Record<string, string> = {
  event: "bg-[#fceae5] text-[var(--primary)]",
  group: "bg-[#e0f2fe] text-[#0369a1]",
  member: "bg-[#f0fdf4] text-[#15803d]",
  venue: "bg-[#faf5ff] text-[#7c3aed]",
};

export default function SearchPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const result = useQuery({
    queryKey: ["search", debouncedQ],
    queryFn: () => searchEntities(debouncedQ),
    enabled: debouncedQ.length > 0,
  });

  const items = result.data?.items ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Event / Group / Member / Venue</p>
      </div>

      <label className="relative block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
        <Input
          className="pl-10 h-11"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="イベント名、会場、グループ…"
          autoFocus
        />
      </label>

      <DevProfiler id="SearchResults">
        {items.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const Icon = icons[item.entity_type as keyof typeof icons] ?? Search;
              const href = item.entity_type === "event" ? `/events/${item.id}` : `/groups/${item.id}`;
              const colorClass = typeColors[item.entity_type] ?? "bg-gray-100 text-gray-600";
              return (
                <Link key={`${item.entity_type}-${item.id}`} href={href}>
                  <Card className="flex items-center gap-3 p-3 hover:shadow-md transition-shadow h-full">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${colorClass}`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-sm">{item.display_name}</p>
                      <p className="text-xs text-[var(--muted)]">{item.matched_by}</p>
                    </div>
                    <Badge className="shrink-0 text-[10px]">{item.entity_type}</Badge>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : debouncedQ && !result.isLoading ? (
          <Card className="text-sm text-[var(--muted)]">「{debouncedQ}」は見つかりませんでした</Card>
        ) : !debouncedQ ? (
          <div className="text-center py-12 text-[var(--muted)]">
            <Search size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">キーワードを入力してください</p>
          </div>
        ) : null}
      </DevProfiler>
    </div>
  );
}
