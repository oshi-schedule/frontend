"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { listGroups } from "@/api/groups";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

export default function GroupsPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const groups = useQuery({
    queryKey: ["admin-groups", debouncedQ],
    queryFn: () => listGroups({ q: debouncedQ || undefined }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Groups</h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">Alias / Merge状態の確認</p>
      </div>

      <label className="relative block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
        <Input className="pl-9 h-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Group名で検索…" />
      </label>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(groups.data ?? []).map((group) => (
          <Card key={group.id} className="flex items-center justify-between p-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-sm">{group.display_name}</p>
              <p className="text-xs text-[var(--muted)] truncate">{group.canonical_name}</p>
            </div>
            <Badge className="ml-2 shrink-0 text-[10px]">{group.status}</Badge>
          </Card>
        ))}
        {groups.isLoading && <p className="text-sm text-[var(--muted)] col-span-full py-4 text-center">読み込み中…</p>}
        {!groups.isLoading && !groups.data?.length && (
          <p className="text-sm text-[var(--muted)] col-span-full py-4 text-center">見つかりませんでした</p>
        )}
      </div>
    </div>
  );
}
