"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { listVenues } from "@/api/venues";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

export default function VenuesPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const venues = useQuery({
    queryKey: ["admin-venues", debouncedQ],
    queryFn: () => listVenues({ q: debouncedQ || undefined }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Venues</h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">Venue一覧 / Alias確認</p>
      </div>

      <label className="relative block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
        <Input className="pl-9 h-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Venue名で検索…" />
      </label>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(venues.data ?? []).map((venue) => (
          <Card key={venue.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm truncate">{venue.display_name}</p>
              <Badge className="shrink-0 text-[10px]">{venue.status}</Badge>
            </div>
            {venue.address && (
              <p className="mt-1 text-xs text-[var(--muted)] truncate">{venue.address}</p>
            )}
          </Card>
        ))}
        {venues.isLoading && <p className="text-sm text-[var(--muted)] col-span-full py-4 text-center">読み込み中…</p>}
        {!venues.isLoading && !venues.data?.length && (
          <p className="text-sm text-[var(--muted)] col-span-full py-4 text-center">見つかりませんでした</p>
        )}
      </div>
    </div>
  );
}
