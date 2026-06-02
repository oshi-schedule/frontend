"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ClipboardCopy, RefreshCcw } from "lucide-react";
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

function JsonView({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[520px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-md bg-[#f8fafc] p-3 text-xs leading-6 text-slate-700">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700">
      <ClipboardCopy size={13} />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function statusClass(status: string) {
  if (status === "ground_truth_saved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-white text-slate-500";
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function candidateTitle(candidate: TrainingEventCandidateRead) {
  return asString(candidate.ground_truth_json?.event_name) || asString(candidate.prediction_json.event_name) || "未命名候補";
}

function candidateSubline(candidate: TrainingEventCandidateRead) {
  return [
    asString(candidate.ground_truth_json?.event_date) || asString(candidate.prediction_json.event_date),
    asString(candidate.ground_truth_json?.venue_name) || asString(candidate.prediction_json.venue_name),
  ]
    .filter(Boolean)
    .join(" / ") || "-";
}

const FIELD_LABELS: Record<string, string> = {
  event_name: "event_name",
  event_date: "event_date",
  venue_name: "venue_name",
  open_time: "open_time",
  start_time: "start_time",
  group_candidates: "group_candidates",
  sessions: "sessions",
};

const EMPTY_SOURCE_TYPE_REVIEW_STATS: NonNullable<TrainingDatasetStats["source_type_review_stats"]> = {
  reviewed_count: 0,
  correct_count: 0,
  accuracy: 0,
  predicted_counts: {},
  correct_counts: {},
  confusion_matrix: {},
  mismatches: [],
};

function formatRate(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

export default function EventCandidateReviewsPage() {
  const [candidates, setCandidates] = useState<TrainingEventCandidateRead[]>([]);
  const [stats, setStats] = useState<TrainingDatasetStats | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [nextCandidates, nextStats] = await Promise.all([
        listTrainingDatasetCandidates({ limit: 200 }),
        getTrainingDatasetStats(),
      ]);
      setCandidates(nextCandidates.items);
      setStats(nextStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Training Dataset分析の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const statusCounts = useMemo(() => {
    return candidates.reduce<Record<string, number>>((acc, candidate) => {
      acc[candidate.review_status] = (acc[candidate.review_status] ?? 0) + 1;
      return acc;
    }, {});
  }, [candidates]);

  const sourceTypeReview = stats?.source_type_review_stats ?? EMPTY_SOURCE_TYPE_REVIEW_STATS;
  const sourceTypeMatrix = sourceTypeReview.confusion_matrix ?? {};
  const sourceTypeLabels = useMemo(() => {
    const values = new Set<string>();
    Object.entries(sourceTypeMatrix).forEach(([predicted, correctMap]) => {
      values.add(predicted);
      Object.keys(correctMap).forEach((correct) => values.add(correct));
    });
    return Array.from(values).sort();
  }, [sourceTypeMatrix]);

  function toggle(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training Dataset Analytics"
        subtitle="Event Candidate Labeling Tool の件数・修正率を見て、次に改善すべきExtractorを判断します。"
        backHref="/admin"
      />

      <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        この画面は `training_event_candidates` を集計しています。旧 Candidate Review の `event_candidate_reviews` ではありません。
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats?.total ?? candidates.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Pending</p>
          <p className="mt-1 text-2xl font-bold text-slate-500">{stats?.pending ?? statusCounts.pending ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Ground Truth Saved</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stats?.ground_truth_saved ?? statusCounts.ground_truth_saved ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Rejected</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{stats?.rejected ?? statusCounts.rejected ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Ready</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stats?.ready_for_training ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">ground truth saved</p>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Session Linked</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats?.session_linked_reviews ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Unlinked</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{stats?.unlinked_reviews ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Single</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats?.single_image_sessions ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Multi</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats?.multi_image_sessions ?? 0}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">source_type別</h2>
            <CopyButton text={JSON.stringify(stats?.source_type_counts ?? {}, null, 2)} />
          </div>
          <div className="space-y-2">
            {Object.entries(stats?.source_type_counts ?? {}).map(([sourceType, count]) => (
              <div key={sourceType} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="font-mono">{sourceType}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">mode別</h2>
            <CopyButton text={JSON.stringify(stats?.mode_counts ?? {}, null, 2)} />
          </div>
          <div className="space-y-2">
            {Object.entries(stats?.mode_counts ?? {}).map(([mode, count]) => (
              <div key={mode} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="font-mono">{mode}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Source Type Review</h2>
            <p className="mt-1 text-xs text-slate-500">
              predicted_source_type と ground_truth_json.correct_source_type を比較します。分類器だけの評価で、抽出精度とは分けて見ます。
            </p>
          </div>
          <CopyButton text={JSON.stringify(sourceTypeReview, null, 2)} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Reviewed</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{sourceTypeReview.reviewed_count ?? 0}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Correct</p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">{sourceTypeReview.correct_count ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Accuracy</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatRate(sourceTypeReview.accuracy)}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4">
            <h3 className="font-semibold">Predicted Counts</h3>
            <div className="mt-3 space-y-2">
              {Object.entries(sourceTypeReview.predicted_counts ?? {}).map(([sourceType, count]) => (
                <div key={sourceType} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-mono">{sourceType}</span>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <h3 className="font-semibold">Correct Counts</h3>
            <div className="mt-3 space-y-2">
              {Object.entries(sourceTypeReview.correct_counts ?? {}).map(([sourceType, count]) => (
                <div key={sourceType} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-mono">{sourceType}</span>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-semibold">Confusion Matrix</h3>
          <p className="mt-1 text-xs text-slate-500">行が predicted、列が correct です。</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400">
                  <th className="px-2 py-2">predicted \ correct</th>
                  {sourceTypeLabels.map((label) => (
                    <th key={label} className="px-2 py-2 font-mono">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sourceTypeLabels.map((predicted) => (
                  <tr key={predicted} className="border-b border-slate-100">
                    <th className="px-2 py-2 font-mono text-slate-600">{predicted}</th>
                    {sourceTypeLabels.map((correct) => {
                      const value = sourceTypeMatrix[predicted]?.[correct] ?? 0;
                      return (
                        <td key={correct} className={`px-2 py-2 font-mono ${value ? "font-bold text-slate-900" : "text-slate-300"}`}>
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {sourceTypeLabels.length === 0 ? (
                  <tr>
                    <td className="px-2 py-3 text-slate-500">correct_source_type が保存されたレビューはまだありません。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {(sourceTypeReview.mismatches ?? []).length ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-950">Mismatches</h3>
            <div className="mt-3 space-y-2">
              {(sourceTypeReview.mismatches ?? []).map((item, index) => (
                <div key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs">
                  <span className="font-mono text-amber-900">{String(item.candidate_id ?? "-")}</span>
                  <span>
                    predicted: <span className="font-bold">{String(item.predicted_source_type ?? "-")}</span> / correct:{" "}
                    <span className="font-bold">{String(item.correct_source_type ?? "-")}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Extraction Review</h2>
            <p className="mt-1 text-xs text-slate-500">
              ground_truth_saved を母数にして、prediction_json と ground_truth_json が異なる項目を「修正あり」として集計します。
            </p>
          </div>
          <CopyButton text={JSON.stringify(stats?.field_correction_stats ?? {}, null, 2)} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(FIELD_LABELS).map(([field, label]) => {
            const fieldStat = stats?.field_correction_stats?.[field];
            const rate = fieldStat?.edit_rate ?? 0;
            const tone =
              rate >= 0.5
                ? "border-red-200 bg-red-50 text-red-800"
                : rate >= 0.25
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800";
            return (
              <div key={field} className={`rounded-xl border p-4 ${tone}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-sm font-semibold">{label}</p>
                  <p className="text-2xl font-bold">{formatRate(rate)}</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70">
                  <div className="h-full rounded-full bg-current" style={{ width: `${Math.min(100, Math.round(rate * 100))}%` }} />
                </div>
                <p className="mt-2 text-xs opacity-80">
                  edited {fieldStat?.edited_count ?? 0} / reviewed {fieldStat?.reviewed_count ?? 0}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Training Candidates</h2>
            <p className="mt-1 text-xs text-slate-500">候補を開くと、別画面でGround Truthを編集できます。</p>
          </div>
          <div className="flex gap-2">
            <CopyButton text={JSON.stringify(candidates, null, 2)} />
            <Button onClick={loadData} disabled={isLoading} className="bg-slate-900 text-white">
              <RefreshCcw size={16} className={isLoading ? "animate-spin" : ""} />
              再読込
            </Button>
          </div>
        </div>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="space-y-3">
          {candidates.map((candidate) => {
            const expanded = expandedIds.has(candidate.id);
            return (
              <div key={candidate.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={statusClass(candidate.review_status)}>{candidate.review_status}</Badge>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                        {candidate.single_multi} / predicted: {candidate.predicted_source_type ?? candidate.source_type ?? "-"}
                      </span>
                      {asString(candidate.ground_truth_json?.correct_source_type) ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                          correct: {asString(candidate.ground_truth_json?.correct_source_type)}
                        </span>
                      ) : null}
                    </div>
                    <Link
                      href={`/admin/training-dataset/${candidate.id}`}
                      className="mt-2 block break-words text-base font-bold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
                    >
                      {candidateTitle(candidate)}
                    </Link>
                    <p className="mt-1 break-words text-sm text-slate-600">{candidateSubline(candidate)}</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{candidate.id}</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">{candidate.created_at}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link href={`/admin/training-dataset/${candidate.id}`}>
                      <Button type="button" variant="outline" size="sm">
                        編集
                      </Button>
                    </Link>
                    <button type="button" onClick={() => toggle(candidate.id)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                      {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">prediction_json</p>
                        <CopyButton text={JSON.stringify(candidate.prediction_json, null, 2)} />
                      </div>
                      <JsonView value={candidate.prediction_json} />
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">ground_truth_json</p>
                        <CopyButton text={JSON.stringify(candidate.ground_truth_json, null, 2)} />
                      </div>
                      <JsonView value={candidate.ground_truth_json} />
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">input_payload_json</p>
                        <CopyButton text={JSON.stringify(candidate.input_payload_json, null, 2)} />
                      </div>
                      <JsonView value={candidate.input_payload_json} />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {candidates.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Training Candidateはまだありません。</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
