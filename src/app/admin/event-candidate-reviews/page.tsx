"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ClipboardCopy, RefreshCcw } from "lucide-react";
import { getGroundTruthStats, listEventCandidateReviews, type EventCandidateReviewRead, type GroundTruthStats } from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function JsonView({ value }: { value: unknown }) {
  return <pre className="max-h-[520px] overflow-auto rounded-md bg-[#f8fafc] p-3 text-xs leading-6 text-slate-700">{JSON.stringify(value, null, 2)}</pre>;
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
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "edited") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-white text-slate-500";
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function candidateTitle(review: EventCandidateReviewRead) {
  const candidate = review.candidate_json;
  return asString(candidate.event_name) || asString(candidate.raw_name) || review.candidate_type;
}

function candidateSubline(review: EventCandidateReviewRead) {
  const candidate = review.candidate_json;
  return [asString(candidate.event_date), asString(candidate.venue_name)].filter(Boolean).join(" / ") || "-";
}

export default function EventCandidateReviewsPage() {
  const [reviews, setReviews] = useState<EventCandidateReviewRead[]>([]);
  const [groundTruthStats, setGroundTruthStats] = useState<GroundTruthStats | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReviews() {
    setIsLoading(true);
    setError(null);
    try {
      const [nextReviews, nextStats] = await Promise.all([
        listEventCandidateReviews({ limit: 200 }),
        getGroundTruthStats(),
      ]);
      setReviews(nextReviews);
      setGroundTruthStats(nextStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "レビュー履歴の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, []);

  const counts = useMemo(() => {
    return reviews.reduce<Record<string, number>>((acc, review) => {
      acc[review.review_status] = (acc[review.review_status] ?? 0) + 1;
      return acc;
    }, {});
  }, [reviews]);

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
      <PageHeader title="Event Candidate Reviews" subtitle="OCRイベント候補のレビュー履歴です。Extractor改善の失敗事例分析に使います。" backHref="/admin" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{groundTruthStats?.total ?? reviews.length}</p>
        </Card>
        {["approved", "edited", "rejected"].map((status) => (
          <Card key={status} className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{status}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{groundTruthStats?.[status as "approved" | "edited" | "rejected"] ?? counts[status] ?? 0}</p>
          </Card>
        ))}
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Ready</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{groundTruthStats?.ready_for_training ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">session linked training / evaluation</p>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Session Linked</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{groundTruthStats?.session_linked_reviews ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Unlinked</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{groundTruthStats?.unlinked_reviews ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Single Image Sessions</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{groundTruthStats?.single_image_sessions ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Multi Image Sessions</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{groundTruthStats?.multi_image_sessions ?? 0}</p>
        </Card>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">レビュー履歴</h2>
            <p className="mt-1 text-xs text-slate-500">`edited` を集めると、誤抽出パターンをCodexへ渡しやすくなります。</p>
          </div>
          <div className="flex gap-2">
            <CopyButton text={JSON.stringify(reviews, null, 2)} />
            <Button onClick={loadReviews} disabled={isLoading} className="bg-slate-900 text-white">
              <RefreshCcw size={16} className={isLoading ? "animate-spin" : ""} />
              再読込
            </Button>
          </div>
        </div>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">詳細</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Candidate</th>
                <th className="px-3 py-2">Date / Venue</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2">Reviewed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {reviews.map((review) => {
                const expanded = expandedIds.has(review.id);
                return (
                  <tr key={review.id} className="align-top">
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => toggle(review.id)} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={statusClass(review.review_status)}>{review.review_status}</Badge>
                    </td>
                    <td className="max-w-[300px] truncate px-3 py-2 font-semibold text-slate-900">{candidateTitle(review)}</td>
                    <td className="max-w-[320px] truncate px-3 py-2 text-xs text-slate-600">{candidateSubline(review)}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-xs text-slate-600">{review.reviewer_note || "-"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{review.reviewed_at ?? review.created_at}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {reviews.map((review) =>
          expandedIds.has(review.id) ? (
            <div key={`${review.id}-detail`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">candidate_json</p>
                  <CopyButton text={JSON.stringify(review.candidate_json, null, 2)} />
                </div>
                <JsonView value={review.candidate_json} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">ocr_output / edited_values / ground_truth</p>
                  <CopyButton text={JSON.stringify(review.review_json, null, 2)} />
                </div>
                <JsonView
                  value={{
                    ocr_output_json: review.ocr_output_json,
                    edited_values_json: review.edited_values_json,
                    ground_truth_json: review.ground_truth_json,
                    review_json: review.review_json,
                  }}
                />
              </div>
            </div>
          ) : null
        )}
      </Card>
    </div>
  );
}
