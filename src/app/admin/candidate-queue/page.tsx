"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Loader2, RefreshCcw, Search, XCircle } from "lucide-react";
import {
  getTrainingDatasetStats,
  listTrainingDatasetCandidates,
  type TrainingDatasetStats,
  type TrainingEventCandidateRead,
} from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type QueueFilter = "pending" | "ground_truth_saved" | "rejected" | "all";

const FILTERS: Array<{ value: QueueFilter; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "ground_truth_saved", label: "Saved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function candidateTitle(candidate: TrainingEventCandidateRead): string {
  return (
    asString(candidate.ground_truth_json?.event_name) ||
    asString(candidate.prediction_json.event_name) ||
    asString(candidate.prediction_json.venue_name) ||
    "未命名候補"
  );
}

function candidateSubline(candidate: TrainingEventCandidateRead): string {
  return [
    asString(candidate.ground_truth_json?.event_date) || asString(candidate.prediction_json.event_date),
    asString(candidate.ground_truth_json?.venue_name) || asString(candidate.prediction_json.venue_name),
  ]
    .filter(Boolean)
    .join(" / ");
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusBadgeClass(status: string): string {
  if (status === "ground_truth_saved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function queueCount(stats: TrainingDatasetStats | null, filter: QueueFilter): number | null {
  if (!stats) return null;
  if (filter === "all") return stats.total;
  if (filter === "pending") return stats.pending;
  if (filter === "ground_truth_saved") return stats.ground_truth_saved;
  return stats.rejected;
}

function CandidateRow({ candidate }: { candidate: TrainingEventCandidateRead }) {
  const input = candidate.input_payload_json ?? {};
  const prediction = candidate.prediction_json ?? {};
  const fileCount = asNumber(input.file_count) ?? (countArray(input.assets) || countArray(input.filenames));
  const contributor = candidate.contributor_name || asString(input.contributor_name) || "unknown";
  const route = candidate.processing_route || asString(input.processing_route) || asString(input.selected_route) || "-";
  const sourceHint = candidate.source_type_hint || asString(input.source_type_hint) || "-";
  const predicted = candidate.predicted_source_type || candidate.source_type || asString(input.predicted_source_type) || "-";
  const groups = countArray(prediction.group_candidates);
  const sessions = countArray(prediction.sessions);
  const confidence = asNumber(prediction.confidence);

  return (
    <Link
      href={`/admin/training-dataset/${candidate.id}`}
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.9fr)_auto]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={statusBadgeClass(candidate.review_status)}>{candidate.review_status}</Badge>
          <span className="text-xs font-semibold text-slate-400">{candidate.single_multi}</span>
          <span className="text-xs text-slate-400">files {fileCount || "-"}</span>
        </div>
        <h2 className="mt-2 truncate text-base font-bold text-slate-950">{candidateTitle(candidate)}</h2>
        <p className="mt-1 truncate text-sm text-slate-500">{candidateSubline(candidate) || "-"}</p>
        <p className="mt-2 truncate font-mono text-[11px] text-slate-400">{candidate.id}</p>
      </div>

      <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-1">
        <p className="rounded-md bg-slate-50 px-3 py-2">
          <span className="font-bold text-slate-400">route</span> {route}
        </p>
        <p className="rounded-md bg-slate-50 px-3 py-2">
          <span className="font-bold text-slate-400">source</span> hint {sourceHint} / pred {predicted}
        </p>
        <p className="rounded-md bg-slate-50 px-3 py-2">
          <span className="font-bold text-slate-400">content</span> groups {groups} / sessions {sessions}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 lg:min-w-40 lg:flex-col lg:items-end">
        <div className="text-right text-xs text-slate-500">
          <p>created {formatDateTime(candidate.created_at)}</p>
          <p className="mt-1">by {contributor}</p>
          {confidence !== null ? <p className="mt-1">conf {confidence.toFixed(2)}</p> : null}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900">
          Review
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

export default function CandidateQueuePage() {
  const [filter, setFilter] = useState<QueueFilter>("pending");
  const [candidates, setCandidates] = useState<TrainingEventCandidateRead[]>([]);
  const [stats, setStats] = useState<TrainingDatasetStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function loadQueue(nextFilter = filter) {
    setIsLoading(true);
    setError(null);
    try {
      const [candidateResponse, statsResponse] = await Promise.all([
        listTrainingDatasetCandidates({
          limit: 200,
          review_status: nextFilter === "all" ? null : nextFilter,
        }),
        getTrainingDatasetStats(),
      ]);
      setCandidates(candidateResponse.items);
      setStats(statsResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Candidate Queueの取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const filteredCandidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return candidates;
    return candidates.filter((candidate) => {
      const haystack = [
        candidate.id,
        candidateTitle(candidate),
        candidateSubline(candidate),
        candidate.review_status,
        candidate.single_multi,
        candidate.source_type,
        candidate.source_type_hint,
        candidate.predicted_source_type,
        candidate.contributor_name,
        asString(candidate.input_payload_json?.contributor_name),
        asString(candidate.input_payload_json?.processing_route),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [candidates, query]);

  const nextPending = filter === "pending" ? filteredCandidates[0] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Queue"
        subtitle="Training Dataset の未レビュー候補を一覧し、連続レビューへ進むためのキューです。"
        backHref="/admin/training-dataset"
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            <Clock3 className="h-4 w-4" />
            Pending
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{stats?.pending ?? "-"}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{stats?.ground_truth_saved ?? "-"}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            <XCircle className="h-4 w-4" />
            Rejected
          </p>
          <p className="mt-2 text-2xl font-bold text-red-700">{stats?.rejected ?? "-"}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            <CalendarDays className="h-4 w-4" />
            Total
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats?.total ?? "-"}</p>
        </Card>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => {
              const active = filter === item.value;
              const count = queueCount(stats, item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`rounded-md border px-3 py-2 text-sm font-bold transition ${
                    active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                  <span className={`ml-2 font-mono text-xs ${active ? "text-slate-200" : "text-slate-400"}`}>{count ?? "-"}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="イベント名・会場・投稿者で検索"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400"
              />
            </label>
            <Button type="button" variant="outline" onClick={() => loadQueue(filter)} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              更新
            </Button>
            {nextPending ? (
              <Link
                href={`/admin/training-dataset/${nextPending.id}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition active:scale-[0.98]"
              >
                次をレビュー
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>

        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            showing {filteredCandidates.length} / loaded {candidates.length}
          </span>
          <span>API上限は直近200件です。</span>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-5 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Candidate Queueを読み込んでいます。
            </div>
          ) : filteredCandidates.length ? (
            filteredCandidates.map((candidate) => <CandidateRow key={candidate.id} candidate={candidate} />)
          ) : (
            <div className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">表示できる候補はありません。</div>
          )}
        </div>
      </Card>
    </div>
  );
}
