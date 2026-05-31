"use client";

import { useQuery } from "@tanstack/react-query";
import { listSources } from "@/api/sources";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function SourcesPage() {
  const sources = useQuery({ queryKey: ["admin-sources"], queryFn: () => listSources() });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Sources</h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">OCR投入待ち・処理済みのSource一覧</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {(sources.data ?? []).map((source) => (
          <Card key={source.id} className="p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm">{source.source_type}</p>
              <Badge className="text-[10px]">{source.status}</Badge>
            </div>
            {source.source_url && (
              <p className="truncate text-xs text-[var(--muted)]">{source.source_url}</p>
            )}
            <p className="text-xs text-[var(--muted)]">
              assets: {source.assets.length} &nbsp;·&nbsp;
              {new Date(source.created_at).toLocaleDateString("ja-JP")}
            </p>
          </Card>
        ))}
        {sources.isLoading && (
          <p className="text-sm text-[var(--muted)] col-span-full py-4 text-center">読み込み中…</p>
        )}
        {!sources.isLoading && !sources.data?.length && (
          <Card className="col-span-full text-sm text-[var(--muted)]">Sourceがありません</Card>
        )}
      </div>
    </div>
  );
}
