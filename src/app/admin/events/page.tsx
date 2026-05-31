"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { listEvents } from "@/api/events";
import { MetricPanel } from "@/components/admin/metric-panel";
import { EventCard } from "@/components/events/event-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DevProfiler } from "@/lib/dev-profiler";
import { useDebounce } from "@/hooks/use-debounce";
import { useUxMetrics } from "@/store/ux-metrics";

export default function AdminEventsPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const start = useUxMetrics((state) => state.start);
  const events = useQuery({
    queryKey: ["admin-events", debouncedQ],
    queryFn: () => listEvents({ q: debouncedQ || undefined, limit: 50 }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">登録・編集・計測</p>
        </div>
        <Link href="/admin/events/new" onClick={() => start("event_create")}>
          <Button className="gap-1.5 bg-[var(--primary)]">
            <Plus size={16} />
            新規
          </Button>
        </Link>
      </div>

      <MetricPanel />

      <label className="relative block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
        <Input
          className="pl-9 h-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="イベント名で検索…"
        />
      </label>

      <DevProfiler id="EventList">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(events.data?.items ?? []).map((event) => (
            <EventCard key={event.id} event={event} admin />
          ))}
        </div>
      </DevProfiler>
    </div>
  );
}
