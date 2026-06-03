"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { apiUrl } from "@/api/client";
import {
  getGptExtractionBenchmarkStats,
  listGptExtractionBenchmarkCandidates,
  runAllPendingGptExtractionBenchmarks,
  runGptExtractionBenchmark,
  type TrainingCandidateBenchmarkCandidateItem,
  type TrainingCandidateBenchmarkStats,
} from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const statusOptions = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "ground_truth_saved", label: "Ground Truth" },
  { value: "rejected", label: "Rejected" },
];

function sourceAssetImageUrl(assetId: string) {
  return apiUrl(`/admin/source-assets/${assetId}/image`);
}

function statusClassName(status: string | null | undefined) {
  const value = status || "not_run";
  if (value === "completed") return "bg-emerald-100 text-emerald-700";
  if (value === "running") return "bg-sky-100 text-sky-700";
  if (value === "pending") return "bg-amber-100 text-amber-700";
  if (value === "failed") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

function percent(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  return `${Math.round(value * 1000) / 10}%`;
}

function shortId(value: string) {
  return value.slice(0, 8);
}

export default function GptExtractionBenchmarkPage() {
  const [items, setItems] = useState<TrainingCandidateBenchmarkCandidateItem[]>([]);
  const [stats, setStats] = useState<TrainingCandidateBenchmarkStats | null>(null);
  const [reviewStatus, setReviewStatus] = useState("pending");
  const [model, setModel] = useState("gpt-5.4");
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [runningCandidateId, setRunningCandidateId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasActiveRuns = useMemo(
    () => items.some((item) => ["pending", "running"].includes(item.latest_benchmark?.status ?? "")),
    [items],
  );

  async function load() {
    setError(null);
    const benchmarkModel = model.trim() || null;
    const [nextItems, nextStats] = await Promise.all([
      listGptExtractionBenchmarkCandidates({
        limit,
        reviewStatus: reviewStatus || null,
        benchmarkModel,
      }),
      getGptExtractionBenchmarkStats({ benchmarkModel }),
    ]);
    setItems(nextItems.items);
    setStats(nextStats);
  }

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!hasActiveRuns) return;
    const id = window.setInterval(() => {
      load().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(id);
  }, [hasActiveRuns, model, reviewStatus, limit]);

  async function handleReload() {
    setLoading(true);
    setMessage(null);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "再読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleRun(candidateId: string) {
    setRunningCandidateId(candidateId);
    setMessage(null);
    setError(null);
    try {
      await runGptExtractionBenchmark(candidateId, { benchmark_model: model.trim() || null });
      setMessage(`${shortId(candidateId)} をRQへ投入しました`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run GPTに失敗しました");
    } finally {
      setRunningCandidateId(null);
    }
  }

  async function handleRunAllPending() {
    setRunningAll(true);
    setMessage(null);
    setError(null);
    try {
      const result = await runAllPendingGptExtractionBenchmarks({
        benchmark_model: model.trim() || null,
        review_status: reviewStatus || "pending",
        limit,
      });
      setMessage(`${result.created_count}件をRQへ投入しました / skipped ${result.skipped_candidate_ids.length}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run All Pendingに失敗しました");
    } finally {
      setRunningAll(false);
    }
  }

  const comparisonRows = Object.entries(stats?.comparison ?? {});

  return (
    <div className="space-y-5">
      <PageHeader
        title="GPT Extraction Benchmark"
        subtitle="Training Candidateごとの image_direct 評価"
        backHref="/admin"
      />

      <Card className="space-y-4 p-5">
        <div className="grid gap-3 lg:grid-cols-[160px_180px_1fr_auto] lg:items-end">
          <label>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Review Status</span>
            <select
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Limit</span>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value) || 50)}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            />
          </label>
          <label>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Benchmark Model</span>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 font-mono text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleReload} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reload
            </Button>
            <Button type="button" onClick={handleRunAllPending} disabled={runningAll}>
              {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run All Pending
            </Button>
          </div>
        </div>
        {message ? <p className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Pending", stats?.pending],
          ["Running", stats?.running],
          ["Completed", stats?.completed],
          ["Failed", stats?.failed],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{String(value ?? "-")}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-bold">Current Pipeline vs GPT-5.4</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Field</th>
                <th className="px-4 py-3">GT Count</th>
                <th className="px-4 py-3">Current</th>
                <th className="px-4 py-3">GPT</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(([field, metric]) => (
                <tr key={field} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono font-semibold">{field}</td>
                  <td className="px-4 py-3">{metric.total ?? 0}</td>
                  <td className="px-4 py-3">{percent(metric.current_accuracy)}</td>
                  <td className="px-4 py-3">{percent(metric.gpt_accuracy)}</td>
                </tr>
              ))}
              {comparisonRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-slate-500">
                    集計対象はまだありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-bold">Candidates</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Image</th>
                <th className="px-4 py-3">Candidate ID</th>
                <th className="px-4 py-3">Source Type</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">Benchmark</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const candidate = item.candidate;
                const latest = item.latest_benchmark;
                const firstAssetId = item.image_asset_ids[0];
                return (
                  <tr key={candidate.id} className="border-t border-slate-100 align-middle">
                    <td className="px-4 py-3">
                      {firstAssetId ? (
                        <img
                          src={sourceAssetImageUrl(firstAssetId)}
                          alt=""
                          className="h-14 w-14 rounded-md border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-md bg-slate-100" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/labs/gpt-extraction-benchmark/${candidate.id}`} className="font-mono font-bold text-slate-950 underline">
                        {candidate.id}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">{candidate.single_multi} / {candidate.processing_route ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{candidate.predicted_source_type ?? candidate.source_type ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{candidate.review_status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClassName(latest?.status)}`}>
                        {latest?.status ?? "not_run"}
                      </span>
                      {latest ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {latest.benchmark_model} / {latest.latency_ms ?? "-"}ms / {latest.total_tokens ?? "-"} tok
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Button type="button" size="sm" onClick={() => handleRun(candidate.id)} disabled={runningCandidateId === candidate.id}>
                        {runningCandidateId === candidate.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Run GPT-5.4
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-slate-500">
                    候補はありません。
                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-slate-500">
                    読み込み中です。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
