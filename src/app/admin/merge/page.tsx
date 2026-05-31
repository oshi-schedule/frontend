"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, GitMerge, Search } from "lucide-react";
import { mergeEntity } from "@/api/admin";
import { searchEntities } from "@/api/search";
import { useDebounce } from "@/hooks/use-debounce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SearchResult } from "@/types/api";

type EntityType = "group" | "venue" | "event";

const entityLabels: Record<EntityType, string> = {
  group: "Group",
  venue: "Venue",
  event: "Event",
};

function EntityPicker({
  label,
  entityType,
  selected,
  onSelect,
}: {
  label: string;
  entityType: EntityType;
  selected: SearchResult | null;
  onSelect: (item: SearchResult) => void;
}) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const search = useQuery({
    queryKey: ["merge-search", entityType, debouncedQ],
    queryFn: () => searchEntities(debouncedQ, 20),
    enabled: debouncedQ.length > 1,
  });
  const candidates = (search.data?.items ?? []).filter(
    (item) => item.entity_type === entityType,
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wide">{label}</h3>

      {selected ? (
        <Card className="flex items-center justify-between p-3 border-2 border-[var(--primary)]">
          <div>
            <p className="font-semibold">{selected.display_name}</p>
            <p className="text-xs text-[var(--muted)]">{selected.id}</p>
          </div>
          <button
            type="button"
            onClick={() => { onSelect(null as unknown as SearchResult); setQ(""); }}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] px-2 py-1 rounded border border-[var(--border)]"
          >
            変更
          </button>
        </Card>
      ) : (
        <div className="space-y-2">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={15} />
            <Input
              className="pl-9 h-9 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`${entityLabels[entityType]}名を検索…`}
            />
          </label>
          {candidates.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { onSelect(item); setQ(""); }}
              className="w-full text-left"
            >
              <Card className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors cursor-pointer">
                <div>
                  <p className="font-semibold text-sm">{item.display_name}</p>
                  <p className="text-xs text-[var(--muted)]">{item.matched_by}</p>
                </div>
                <Badge className="text-[10px]">{item.status}</Badge>
              </Card>
            </button>
          ))}
          {debouncedQ.length > 1 && candidates.length === 0 && !search.isLoading && (
            <p className="text-xs text-[var(--muted)] text-center py-2">見つかりません</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MergePage() {
  const [entityType, setEntityType] = useState<EntityType>("group");
  const [source, setSource] = useState<SearchResult | null>(null);
  const [target, setTarget] = useState<SearchResult | null>(null);

  const merge = useMutation({
    mutationFn: () => mergeEntity(entityType, source!.id, target!.id),
    onSuccess: () => {
      setSource(null);
      setTarget(null);
    },
  });

  function handleTypeChange(type: EntityType) {
    setEntityType(type);
    setSource(null);
    setTarget(null);
    merge.reset();
  }

  const canMerge = source && target && source.id !== target.id && !merge.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Merge</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          重複エンティティを統合します。Source は Target に吸収されます。
        </p>
      </div>

      {/* Entity type selector */}
      <div className="flex gap-2">
        {(["group", "venue", "event"] as EntityType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleTypeChange(type)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              entityType === type
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : "bg-white text-[var(--muted)] border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
            }`}
          >
            {entityLabels[type]}
          </button>
        ))}
      </div>

      {/* Picker area */}
      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start">
        <EntityPicker
          label="Source（統合元）"
          entityType={entityType}
          selected={source}
          onSelect={setSource}
        />

        <div className="hidden md:flex items-center justify-center pt-8">
          <ArrowRight size={28} className="text-[var(--muted)]" />
        </div>

        <EntityPicker
          label="Target（統合先・正規）"
          entityType={entityType}
          selected={target}
          onSelect={setTarget}
        />
      </div>

      {/* Preview */}
      {source && target && source.id !== target.id && (
        <Card className="space-y-3 border-2 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-800">確認</p>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="font-semibold text-red-700 line-through">{source.display_name}</span>
            <ArrowRight size={16} className="text-[var(--muted)] shrink-0" />
            <span className="font-semibold text-[#0f766e]">{target.display_name}</span>
          </div>
          <p className="text-xs text-amber-700">
            「{source.display_name}」を「{target.display_name}」に統合します。この操作は元に戻せません。
          </p>
        </Card>
      )}

      {source?.id === target?.id && source && (
        <Card className="border-2 border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">Source と Target に同じエンティティは指定できません。</p>
        </Card>
      )}

      <Button
        onClick={() => merge.mutate()}
        disabled={!canMerge}
        className="w-full gap-2 bg-[var(--primary)]"
      >
        <GitMerge size={18} />
        {merge.isPending ? "統合中…" : "Merge を実行"}
      </Button>

      {merge.isSuccess && (
        <Card className="border-2 border-green-200 bg-green-50 p-3 text-sm text-green-700">
          統合が完了しました。Source は merged 状態になりました。
        </Card>
      )}
      {merge.isError && (
        <Card className="border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700">
          統合に失敗しました。ログを確認してください。
        </Card>
      )}
    </div>
  );
}
