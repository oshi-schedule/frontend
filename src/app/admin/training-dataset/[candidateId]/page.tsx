"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCopy, Download, ExternalLink, Loader2, Maximize2, Plus, Save, Trash2, X } from "lucide-react";
import { ApiError, apiUrl } from "@/api/client";
import {
  createTrainingDatasetBenchmarkJob,
  getTrainingDatasetCandidate,
  getTrainingDatasetBenchmarkJob,
  getTrainingDatasetGptReview,
  listTrainingDatasetCandidates,
  listTrainingDatasetBenchmarkRuns,
  runTrainingDatasetGptReview,
  saveTrainingDatasetGroundTruth,
  type TrainingBenchmarkJobRead,
  type TrainingCandidateBenchmarkRunRead,
  type TrainingCandidateGptReviewRead,
  type TrainingEventCandidateRead,
} from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type GroupCandidateDraft = {
  group_name: string;
  score?: number | null;
  match_method?: string | null;
};

type SessionDraft = {
  session_type: string;
  group_name: string;
  title: string;
  container_id: string;
  venue_name: string;
  stage_name: string;
  start_time: string;
  end_time: string;
  note: string;
};

type VenueDraft = {
  venue_name: string;
  open_time: string;
  start_time: string;
  note: string;
};

type ItemSourceTypeDraft = {
  source_asset_id: string;
  filename: string;
  predicted_source_type: string;
  correct_source_type: string;
};

type GroundTruthForm = {
  correct_source_type: string;
  correct_item_source_types: ItemSourceTypeDraft[];
  event_name: string;
  event_date: string;
  venues: VenueDraft[];
  group_candidates: GroupCandidateDraft[];
  sessions: SessionDraft[];
};

const SOURCE_TYPE_OPTIONS = [
  "schedule_document",
  "flyer",
  "x_post",
  "other",
];

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function getSourceAssetId(asset: unknown): string | null {
  if (!asset || typeof asset !== "object") return null;
  const value = (asset as Record<string, unknown>).source_asset_id;
  return typeof value === "string" && value ? value : null;
}

function getStringField(value: unknown, field: string): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return typeof record[field] === "string" ? record[field] : "";
}

function sourceAssetImageUrl(assetId: string, download = false): string {
  return apiUrl(`/admin/source-assets/${assetId}/image`, download ? { download: 1 } : undefined);
}

function sourceAssetClipboardImageUrl(assetId: string): string {
  return apiUrl(`/admin/source-assets/${assetId}/image/clipboard`);
}

function getAssetFilename(asset: unknown, index: number): string {
  return getStringField(asset, "filename") || `source_image_${index + 1}.jpg`;
}

function normalizeImageSourceTypeLabel(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["schedule_document", "timetable", "normal_timetable", "meet_and_greet", "meet_and_greet_table"].includes(normalized)) {
    return "schedule_document";
  }
  if (["flyer", "event_info"].includes(normalized)) {
    return "flyer";
  }
  if (["x_post", "x_screenshot"].includes(normalized)) {
    return "x_post";
  }
  return normalized || "";
}

function sourceTypeHintInitialCorrect(candidate: TrainingEventCandidateRead | null): string {
  const hint = normalizeImageSourceTypeLabel(candidate?.source_type_hint ?? candidate?.input_payload_json?.source_type_hint);
  if (!hint || hint === "auto" || hint === "training_dataset") return "";
  return SOURCE_TYPE_OPTIONS.includes(hint) ? hint : "";
}

function normalizeGroupCandidates(value: unknown): GroupCandidateDraft[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") {
      return { group_name: item, score: null, match_method: null };
    }
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      return {
        group_name: toText(record.group_name) || toText(record.name) || toText(record.raw_name),
        score: typeof record.score === "number" ? record.score : null,
        match_method: toText(record.match_method) || null,
      };
    }
    return { group_name: "", score: null, match_method: null };
  });
}

function normalizeSessions(value: unknown): SessionDraft[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const sessionType = toText(record.session_type) || "performance";
    const originalTitle = toText(record.title);
    const originalGroupName = toText(record.group_name) || toText(record.performer_name);
    const groupName =
      sessionType === "performance" && !originalGroupName && originalTitle
        ? originalTitle
        : originalGroupName;
    const title =
      sessionType === "performance" && !originalGroupName && originalTitle
        ? ""
        : originalTitle;
    return {
      session_type: sessionType,
      group_name: groupName,
      title,
      container_id: toText(record.container_id),
      venue_name: toText(record.venue_name),
      stage_name: toText(record.stage_name) || toText(record.booth_name),
      start_time: toText(record.start_time),
      end_time: toText(record.end_time),
      note: toText(record.note) || toText(record.notes),
    };
  });
}

function normalizeVenues(value: unknown, fallback?: { venue_name?: unknown; open_time?: unknown; start_time?: unknown }): VenueDraft[] {
  const items = Array.isArray(value) ? value : [];
  const normalized = items
    .map((item) => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        venue_name: toText(record.venue_name) || toText(record.name),
        open_time: toText(record.open_time),
        start_time: toText(record.start_time),
        note: toText(record.note),
      };
    })
    .filter((venue) => venue.venue_name || venue.open_time || venue.start_time || venue.note);
  if (normalized.length) return normalized;
  const fallbackVenueName = toText(fallback?.venue_name);
  const fallbackOpenTime = toText(fallback?.open_time);
  const fallbackStartTime = toText(fallback?.start_time);
  if (fallbackVenueName || fallbackOpenTime || fallbackStartTime) {
    return [{ venue_name: fallbackVenueName, open_time: fallbackOpenTime, start_time: fallbackStartTime, note: "" }];
  }
  return [];
}

function buildItemSourceTypeDrafts(candidate: TrainingEventCandidateRead | null): ItemSourceTypeDraft[] {
  const assets = Array.isArray(candidate?.input_payload_json?.assets) ? candidate.input_payload_json.assets : [];
  const itemSourceTypes = Array.isArray(candidate?.input_payload_json?.item_source_types)
    ? candidate.input_payload_json.item_source_types.map((item) => String(item ?? ""))
    : [];
  const initialCorrectSourceType = sourceTypeHintInitialCorrect(candidate);
  const existing = Array.isArray(candidate?.ground_truth_json?.correct_item_source_types)
    ? candidate.ground_truth_json.correct_item_source_types
    : [];
  const existingByAssetId = new Map<string, string>();
  existing.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const assetId = typeof record.source_asset_id === "string" ? record.source_asset_id : "";
    const correct = normalizeImageSourceTypeLabel(record.correct_source_type);
    if (assetId && correct) existingByAssetId.set(assetId, correct);
  });

  return assets.map((asset, index) => {
    const sourceAssetId = getSourceAssetId(asset) ?? "";
    const predicted = getStringField(asset, "source_type") || itemSourceTypes[index] || "";
    return {
      source_asset_id: sourceAssetId,
      filename: getStringField(asset, "filename") || `image_${index + 1}`,
      predicted_source_type: predicted,
      correct_source_type: existingByAssetId.get(sourceAssetId) || initialCorrectSourceType || normalizeImageSourceTypeLabel(predicted),
    };
  });
}

function buildForm(candidate: TrainingEventCandidateRead | null): GroundTruthForm {
  const source: Record<string, unknown> = candidate?.ground_truth_json ?? candidate?.prediction_json ?? {};
  const groundTruth = candidate?.ground_truth_json ?? {};
  const correctSourceType =
    toText((groundTruth as Record<string, unknown>).correct_source_type) ||
    candidate?.predicted_source_type ||
    candidate?.source_type ||
    "";
  const legacyVenue = {
    venue_name: toText(source.venue_name),
    open_time: toText(source.open_time),
    start_time: toText(source.start_time),
  };
  return {
    correct_source_type: correctSourceType,
    correct_item_source_types: buildItemSourceTypeDrafts(candidate),
    event_name: toText(source.event_name),
    event_date: toText(source.event_date),
    venues: normalizeVenues(source.venues, legacyVenue),
    group_candidates: normalizeGroupCandidates(source.group_candidates),
    sessions: normalizeSessions(source.sessions),
  };
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[520px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
      {prettyJson(value)}
    </pre>
  );
}

function CopyButton({ text, label = "Copy", copiedLabel = "Copied" }: { text: string; label?: string; copiedLabel?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-900">
      <ClipboardCopy className="h-3.5 w-3.5" />
      {copied ? copiedLabel : label}
    </button>
  );
}

async function copyImageToClipboard(imageUrl: string, fallbackUrl: string, fallbackLabel: string): Promise<{ ok: boolean; message: string }> {
  if (!("clipboard" in navigator)) {
    return { ok: false, message: "このブラウザはクリップボードAPIをサポートしていません。" };
  }
  try {
    const response = await fetch(imageUrl, { credentials: "same-origin" });
    if (!response.ok) {
      return { ok: false, message: "画像の取得に失敗しました。" };
    }
    const blob = await response.blob();
    if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function" && blob.size > 0) {
      const payload = new ClipboardItem({ [blob.type || "image/png"]: blob });
      await navigator.clipboard.write([payload]);
      return { ok: true, message: "画像をコピーしました。" };
    }
    await navigator.clipboard.writeText(fallbackUrl);
    return { ok: true, message: `${fallbackLabel} をコピーしました。` };
  } catch {
    return { ok: false, message: "画像コピーに失敗しました。" };
  }
}

function CopyImageButton({ imageUrl, fallbackUrl, label, fallbackLabel }: { imageUrl: string; fallbackUrl: string; label: string; fallbackLabel: string }) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleCopy() {
    if (state === "copying") return;
    setState("copying");
    setMessage(null);
    const result = await copyImageToClipboard(imageUrl, fallbackUrl, fallbackLabel);
    if (result.ok) {
      setState("copied");
      setTimeout(() => setState("idle"), 1200);
      return;
    }
    setState("error");
    setMessage(result.message);
    setTimeout(() => {
      setState("idle");
      setMessage(null);
    }, 1800);
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-900">
        <ClipboardCopy className="h-3.5 w-3.5" />
        {state === "copying" ? "コピー中" : state === "copied" ? "コピー済み" : state === "error" ? "失敗" : label}
      </button>
      {message ? <span className="text-[10px] text-red-600">{message}</span> : null}
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function approvedText(value: unknown): string {
  return value === true ? "修正不要" : "修正提案あり";
}

function getGptSection(review: TrainingCandidateGptReviewRead | null, key: string): Record<string, unknown> {
  return asRecord(asRecord(review?.review_result_json)[key]);
}

function getGptCorrectedExtraction(review: TrainingCandidateGptReviewRead | null): Record<string, unknown> {
  return asRecord(getGptSection(review, "extraction_review").corrected_json);
}

function getGptSuggestedField(review: TrainingCandidateGptReviewRead | null, field: string): unknown {
  const corrected = getGptCorrectedExtraction(review);
  if (field in corrected) return corrected[field];
  const suggestions = asArray(getGptSection(review, "extraction_review").suggestions).map(asRecord);
  return suggestions.find((item) => item.field === field)?.suggested;
}

function getGptSuggestedVenues(review: TrainingCandidateGptReviewRead | null): VenueDraft[] | null {
  const venuesReview = getGptSection(review, "venues_review");
  if (Array.isArray(venuesReview.corrected_json)) {
    const venues = normalizeVenues(venuesReview.corrected_json);
    if (venues.length) return venues;
  }
  const extractionVenues = getGptCorrectedExtraction(review).venues;
  if (Array.isArray(extractionVenues)) {
    const venues = normalizeVenues(extractionVenues);
    if (venues.length) return venues;
  }
  return null;
}

function getGptSuggestedGroups(review: TrainingCandidateGptReviewRead | null): GroupCandidateDraft[] | null {
  const groupsReview = getGptSection(review, "group_candidates_review");
  if (!Array.isArray(groupsReview.corrected_json)) return null;
  const groups = normalizeGroupCandidates(groupsReview.corrected_json);
  return groups.length ? groups : null;
}

function getGptSuggestedSessions(review: TrainingCandidateGptReviewRead | null): SessionDraft[] | null {
  const sessionsReview = getGptSection(review, "sessions_review");
  if (!Array.isArray(sessionsReview.corrected_json)) return null;
  const sessions = normalizeSessions(sessionsReview.corrected_json);
  return sessions.length ? sessions : null;
}

function InlineCompare({ label, prediction, gpt }: { label: string; prediction: unknown; gpt: unknown }) {
  return (
    <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
      <div className="rounded-lg bg-slate-50 p-2">
        <p className="font-bold uppercase tracking-[0.12em] text-slate-400">Prediction</p>
        <p className="mt-1 break-words font-mono">{String(prediction ?? "-")}</p>
      </div>
      <div className="rounded-lg bg-amber-50 p-2">
        <p className="font-bold uppercase tracking-[0.12em] text-amber-600">GPT提案</p>
        <p className="mt-1 break-words font-mono">{gpt === undefined ? `${label} の提案なし` : String(gpt ?? "null")}</p>
      </div>
    </div>
  );
}

function ReviewCommentBlock({ title, countComment, contentComment }: { title: string; countComment: unknown; contentComment: unknown }) {
  return (
    <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{title} count</p>
        <p className="mt-1">{String(countComment || "件数コメントはありません。")}</p>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{title} content</p>
        <p className="mt-1">{String(contentComment || "内容コメントはありません。")}</p>
      </div>
    </div>
  );
}

function GptIssuesList({ issues, approved }: { issues: unknown; approved: unknown }) {
  const items = asArray(issues).map(asRecord);
  if (!items.length && approved === true) {
    return <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">差分なし</p>;
  }
  if (!items.length) {
    return <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">issues はありません。</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-slate-900">GPT Issues ({items.length})</p>
      {items.map((issue, index) => {
        const expected = issue.expected ?? issue.suggested;
        return (
          <div key={index} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2 py-1 font-mono text-xs font-bold text-amber-700">{String(issue.field ?? "-")}</span>
              {issue.index !== null && issue.index !== undefined ? <span className="font-mono text-xs text-slate-500">index {String(issue.index)}</span> : null}
              {issue.group_name ? <span className="text-xs font-semibold text-slate-600">{String(issue.group_name)}</span> : null}
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <p className="rounded-lg bg-white p-2 text-slate-600">current: {String(issue.current ?? "null")}</p>
              <p className="rounded-lg bg-white p-2 font-semibold text-slate-900">expected: {String(expected ?? "null")}</p>
            </div>
            <p className="mt-2 text-xs text-slate-600">{String(issue.reason ?? "")}</p>
          </div>
        );
      })}
    </div>
  );
}

function GptReviewerResult({ review, onApply }: { review: TrainingCandidateGptReviewRead; onApply: () => void }) {
  const result = asRecord(review.review_result_json);
  const extraction = asRecord(result.extraction_review);
  const venues = asRecord(result.venues_review);
  const groups = asRecord(result.group_candidates_review);
  const sessions = asRecord(result.sessions_review);
  const approved = result.approved === true;
  const isWorking = review.status === "queued" || review.status === "running";
  const groupCorrectedCount = asArray(groups.corrected_json).length;
  const sessionCorrectedCount = asArray(sessions.corrected_json).length;
  const hasReviewPayload =
    asArray(extraction.suggestions).length > 0 ||
    asArray(venues.corrected_json).length > 0 ||
    asArray(groups.issues).length > 0 ||
    asArray(sessions.issues).length > 0 ||
    groupCorrectedCount > 0 ||
    sessionCorrectedCount > 0 ||
    Boolean(groups.count_comment || groups.content_comment || sessions.count_comment || sessions.content_comment);
  return (
    <Card className={`min-w-0 space-y-4 p-5 ${approved ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">GPT Reviewer</p>
          <h2 className="mt-1 font-bold text-slate-950">{approved ? "修正不要" : "GPT修正レビュー結果"}</h2>
          <p className="mt-1 text-sm text-slate-700">{String(result.summary ?? "-")}</p>
          <p className="mt-2 font-mono text-xs text-slate-500">
            {review.status} / {review.review_model} / {review.review_prompt_version} / {review.latency_ms ?? "-"}ms / {review.total_tokens ?? "-"} tokens
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isWorking ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              レビュー実行中
            </span>
          ) : null}
          {review.status === "completed" ? (
            <Button type="button" variant="outline" onClick={onApply}>
              GPT提案をフォームへ反映
            </Button>
          ) : null}
          <CopyButton text={prettyJson(review.review_result_json)} label="結果コピー" copiedLabel="コピー済み" />
        </div>
      </div>
      {review.status === "failed" ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{review.error_message ?? "GPT Reviewerに失敗しました。"}</p>
      ) : null}
      {review.status === "completed" && !hasReviewPayload ? (
        <p className="rounded-xl border border-amber-200 bg-white p-3 text-sm font-semibold text-amber-700">
          GPTの実行は完了していますが、修正提案・コメント・corrected_json が空です。画像入力またはプロンプト結果を確認した方がよさそうです。
        </p>
      ) : null}
      <div className="grid gap-3 text-xs text-slate-600 md:grid-cols-4">
        <p className="rounded-xl bg-white p-3">Event suggestions {asArray(extraction.suggestions).length}</p>
        <p className="rounded-xl bg-white p-3">Venues corrected {asArray(venues.corrected_json).length}</p>
        <p className="rounded-xl bg-white p-3">Group issues {asArray(groups.issues).length}</p>
        <p className="rounded-xl bg-white p-3">Session issues {asArray(sessions.issues).length}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/70 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-bold">Event Info</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${extraction.approved === true ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {approvedText(extraction.approved)}
            </span>
          </div>
          {asArray(extraction.suggestions).length ? (
            <div className="space-y-2">
              {asArray(extraction.suggestions).map((item, index) => {
                const suggestion = asRecord(item);
                return (
                  <div key={index} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <p className="font-mono text-xs font-bold text-slate-500">{String(suggestion.field ?? "-")}</p>
                    <p className="mt-2 text-slate-600">current: {String(suggestion.current ?? "null")}</p>
                    <p className="font-semibold text-slate-950">suggested: {String(suggestion.suggested ?? "null")}</p>
                    <p className="mt-1 text-xs text-slate-500">{String(suggestion.reason ?? "")}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">修正提案はありません。</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/70 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-bold">Venues</h3>
            <CopyButton text={prettyJson(venues.corrected_json ?? [])} label="corrected_json" copiedLabel="コピー済み" />
          </div>
          <p className={`mb-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${venues.approved === true ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {approvedText(venues.approved)}
          </p>
          <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">issues {asArray(venues.issues).length}</p>
          <JsonBlock value={{ issues: venues.issues ?? [], corrected_json: venues.corrected_json ?? [] }} />
        </div>

        <div className="rounded-2xl border border-white/70 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-bold">Group Candidates</h3>
            <CopyButton text={prettyJson(groups.corrected_json ?? [])} label="corrected_json" copiedLabel="コピー済み" />
          </div>
          <p className={`mb-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${groups.approved === true ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {approvedText(groups.approved)}
          </p>
          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
            <p className="rounded-lg bg-slate-50 p-2">add {asArray(groups.add).length}</p>
            <p className="rounded-lg bg-slate-50 p-2">remove {asArray(groups.remove).length}</p>
            <p className="rounded-lg bg-slate-50 p-2">replace {asArray(groups.replace).length}</p>
          </div>
          <div className="mt-3">
            <ReviewCommentBlock title="groups" countComment={groups.count_comment} contentComment={groups.content_comment} />
          </div>
          <div className="mt-3">
            <GptIssuesList issues={groups.issues} approved={groups.approved} />
          </div>
          <div className="mt-3">
            <JsonBlock value={{ count_comment: groups.count_comment ?? "", content_comment: groups.content_comment ?? "", issues: groups.issues ?? [], add: groups.add ?? [], remove: groups.remove ?? [], replace: groups.replace ?? [], corrected_json: groups.corrected_json ?? [] }} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-bold">Sessions</h3>
            <CopyButton text={prettyJson(sessions.corrected_json ?? [])} label="corrected_json" copiedLabel="コピー済み" />
          </div>
          <p className={`mb-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${sessions.approved === true ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {approvedText(sessions.approved)}
          </p>
          <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">issues {asArray(sessions.issues).length}</p>
          <ReviewCommentBlock title="sessions" countComment={sessions.count_comment} contentComment={sessions.content_comment} />
          <div className="mt-3">
            <GptIssuesList issues={sessions.issues} approved={sessions.approved} />
          </div>
          <div className="mt-3">
            <JsonBlock value={{ count_comment: sessions.count_comment ?? "", content_comment: sessions.content_comment ?? "", issues: sessions.issues ?? [], corrected_json: sessions.corrected_json ?? [] }} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function benchmarkSummary(run: TrainingCandidateBenchmarkRunRead): string {
  const prediction = run.prediction_json ?? {};
  const sessions = Array.isArray(prediction.sessions) ? prediction.sessions.length : 0;
  const groups = Array.isArray(prediction.group_candidates) ? prediction.group_candidates.length : 0;
  return [
    toText(prediction.event_name) || "event_nameなし",
    toText(prediction.venue_name) || "venueなし",
    `groups ${groups}`,
    `sessions ${sessions}`,
  ].join(" / ");
}

function buildGroundTruthPayload(form: GroundTruthForm): Record<string, unknown> {
  const venues = form.venues
    .map((venue) => ({
      venue_name: venue.venue_name.trim() || null,
      open_time: venue.open_time || null,
      start_time: venue.start_time || null,
      note: venue.note.trim() || null,
    }))
    .filter((venue) => venue.venue_name || venue.open_time || venue.start_time || venue.note);
  const primaryVenue = venues[0] ?? null;
  return {
    correct_item_source_types: form.correct_item_source_types.map((item) => ({
      source_asset_id: item.source_asset_id || null,
      filename: item.filename || null,
      predicted_source_type: item.predicted_source_type || null,
      correct_source_type: normalizeImageSourceTypeLabel(item.correct_source_type) || null,
    })),
    event_name: form.event_name.trim() || null,
    event_date: form.event_date || null,
    venue_name: primaryVenue?.venue_name || null,
    open_time: primaryVenue?.open_time || null,
    start_time: primaryVenue?.start_time || null,
    venues,
    group_candidates: form.group_candidates
      .map((candidate) => ({
        group_name: candidate.group_name.trim(),
        score: candidate.score ?? null,
        match_method: candidate.match_method || null,
      }))
      .filter((candidate) => candidate.group_name),
    sessions: form.sessions
      .map((session) => ({
        session_type: session.session_type || "performance",
        group_name: session.group_name.trim() || null,
        title: session.title.trim() || null,
        container_id: session.container_id.trim() || null,
        venue_name: session.venue_name.trim() || null,
        stage_name: session.stage_name.trim() || null,
        start_time: session.start_time || null,
        end_time: session.end_time || null,
        note: session.note.trim() || null,
      }))
      .filter((session) => session.group_name || session.title || session.start_time || session.end_time),
  };
}

function parseJsonArrayOrFallback(jsonText: string, fallback: unknown[]): unknown[] {
  try {
    const parsed = JSON.parse(jsonText || "[]");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function buildExtractionReviewCopyPayload(
  candidate: TrainingEventCandidateRead,
  form: GroundTruthForm,
  groupJson: string,
  sessionJson: string,
): Record<string, unknown> {
  const groundTruthJson = buildGroundTruthPayload(form);
  return {
    candidate_id: candidate.id,
    processing_route: candidate.processing_route ?? candidate.input_payload_json?.processing_route ?? candidate.input_payload_json?.selected_route ?? null,
    extraction_review_json: candidate.extraction_plan ?? candidate.input_payload_json?.extraction_plan ?? {},
    event_candidate_prediction_json: candidate.prediction_json,
    ground_truth_json: groundTruthJson,
    venues: groundTruthJson.venues ?? [],
    group_candidates: parseJsonArrayOrFallback(groupJson, form.group_candidates),
    sessions: parseJsonArrayOrFallback(sessionJson, form.sessions),
  };
}

export default function TrainingDatasetReviewPage() {
  const params = useParams<{ candidateId: string }>();
  const router = useRouter();
  const candidateId = params.candidateId;
  const [candidate, setCandidate] = useState<TrainingEventCandidateRead | null>(null);
  const [form, setForm] = useState<GroundTruthForm>(() => buildForm(null));
  const [groupJson, setGroupJson] = useState("[]");
  const [sessionJson, setSessionJson] = useState("[]");
  const [pendingQueue, setPendingQueue] = useState<TrainingEventCandidateRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewStartedAt, setReviewStartedAt] = useState(() => Date.now());
  const [imageModalIndex, setImageModalIndex] = useState<number | null>(null);
  const shortcutPrefixRef = useRef<string | null>(null);
  const shortcutTimerRef = useRef<number | null>(null);
  const [benchmarkRuns, setBenchmarkRuns] = useState<TrainingCandidateBenchmarkRunRead[]>([]);
  const [benchmarkJob, setBenchmarkJob] = useState<TrainingBenchmarkJobRead | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [benchmarkModels, setBenchmarkModels] = useState("gpt-5-mini");
  const [benchmarkRoutes, setBenchmarkRoutes] = useState<string[]>(["text", "vision", "layout"]);
  const [gptReview, setGptReview] = useState<TrainingCandidateGptReviewRead | null>(null);
  const [isGptReviewing, setIsGptReviewing] = useState(false);
  const [gptReviewError, setGptReviewError] = useState<string | null>(null);

  useEffect(() => {
    void loadCandidate();
    setReviewStartedAt(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  useEffect(() => {
    const nextForm = buildForm(candidate);
    setForm(nextForm);
    setGroupJson(prettyJson(nextForm.group_candidates));
    setSessionJson(prettyJson(nextForm.sessions));
    setJsonError(null);
    setSaveMessage(null);
    setReviewNote("");
    setGptReview(candidate?.gpt_reviews?.[0] ?? null);
    setGptReviewError(null);
  }, [candidate]);

  useEffect(() => {
    if (!gptReview || (gptReview.status !== "queued" && gptReview.status !== "running")) return;
    setIsGptReviewing(true);
    void pollGptReview(gptReview.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gptReview?.id]);

  const rawTexts = useMemo(() => {
    const values = candidate?.input_payload_json?.ocr_raw_texts;
    return Array.isArray(values) ? values : [];
  }, [candidate]);

  const imageAssets = useMemo(() => {
    const values = candidate?.input_payload_json?.assets;
    return Array.isArray(values) ? values : [];
  }, [candidate]);

  const itemSourceTypes = useMemo(() => {
    const values = candidate?.input_payload_json?.item_source_types;
    return Array.isArray(values) ? values.map((item) => String(item ?? "")) : [];
  }, [candidate]);

  async function loadCandidate() {
    setIsLoading(true);
    setError(null);
    try {
      const [nextCandidate, runs, pending] = await Promise.all([
        getTrainingDatasetCandidate(candidateId),
        listTrainingDatasetBenchmarkRuns(candidateId),
        listTrainingDatasetCandidates({ limit: 200, review_status: "pending" }),
      ]);
      setCandidate(nextCandidate);
      setBenchmarkRuns(runs.items);
      setPendingQueue(pending.items);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "候補の取得に失敗しました。";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function updateGroupCandidate(index: number, patch: Partial<GroupCandidateDraft>) {
    setForm((current) => ({
      ...current,
      group_candidates: current.group_candidates.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function updateVenue(index: number, patch: Partial<VenueDraft>) {
    setForm((current) => ({
      ...current,
      venues: current.venues.map((venue, currentIndex) => (currentIndex === index ? { ...venue, ...patch } : venue)),
    }));
  }

  function addVenue() {
    setForm((current) => ({
      ...current,
      venues: [...current.venues, { venue_name: "", open_time: "", start_time: "", note: "" }],
    }));
  }

  function removeVenue(index: number) {
    setForm((current) => ({
      ...current,
      venues: current.venues.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  function addGroupCandidate() {
    setForm((current) => ({
      ...current,
      group_candidates: [...current.group_candidates, { group_name: "", score: null, match_method: "manual" }],
    }));
  }

  function removeGroupCandidate(index: number) {
    setForm((current) => ({
      ...current,
      group_candidates: current.group_candidates.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  function updateItemSourceType(index: number, correctSourceType: string) {
    setForm((current) => ({
      ...current,
      correct_item_source_types: current.correct_item_source_types.map((item, currentIndex) =>
        currentIndex === index ? { ...item, correct_source_type: correctSourceType } : item,
      ),
    }));
  }

  function syncGroupFormToJson() {
    setGroupJson(prettyJson(form.group_candidates));
    setJsonError(null);
  }

  function applyGroupJsonToForm() {
    try {
      const parsed = JSON.parse(groupJson || "[]");
      if (!Array.isArray(parsed)) {
        throw new Error("group_candidatesは配列で入力してください。");
      }
      setForm((current) => ({ ...current, group_candidates: normalizeGroupCandidates(parsed) }));
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "group_candidates JSONの形式が不正です。");
    }
  }

  function syncSessionFormToJson() {
    setSessionJson(prettyJson(form.sessions));
    setJsonError(null);
  }

  function applySessionJsonToForm() {
    try {
      const parsed = JSON.parse(sessionJson || "[]");
      if (!Array.isArray(parsed)) {
        throw new Error("sessionsは配列で入力してください。");
      }
      setForm((current) => ({ ...current, sessions: normalizeSessions(parsed) }));
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "sessions JSONの形式が不正です。");
    }
  }

  function updateSession(index: number, patch: Partial<SessionDraft>) {
    setForm((current) => ({
      ...current,
      sessions: current.sessions.map((session, currentIndex) => (currentIndex === index ? { ...session, ...patch } : session)),
    }));
  }

  function addSession() {
    setForm((current) => ({
      ...current,
      sessions: [
        ...current.sessions,
        {
          session_type: "performance",
          group_name: "",
          title: "",
          container_id: "",
          venue_name: "",
          stage_name: "",
          start_time: "",
          end_time: "",
          note: "",
        },
      ],
    }));
  }

  function removeSession(index: number) {
    setForm((current) => ({
      ...current,
      sessions: current.sessions.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  function nextPendingCandidateId(): string | null {
    const next = pendingQueue.find((item) => item.id !== candidateId);
    return next?.id ?? null;
  }

  function goToNextPending() {
    const nextId = nextPendingCandidateId();
    if (nextId) {
      router.push(`/admin/training-dataset/${nextId}`);
    } else {
      setSaveMessage("未レビューの次候補はありません。");
    }
  }

  async function handleSaveGroundTruth(action: "stay" | "next" = "stay", status = "ground_truth_saved") {
    if (!candidate) return;
    setIsSaving(true);
    setSaveMessage(null);
    setJsonError(null);
    try {
      const saved = await saveTrainingDatasetGroundTruth(candidate.id, {
        ground_truth_json: buildGroundTruthPayload(form),
        reviewer: "admin",
        review_status: status,
        review_seconds: Math.max(0, Math.round((Date.now() - reviewStartedAt) / 1000)),
        note: reviewNote.trim() || null,
      });
      setCandidate(saved);
      setSaveMessage("Ground Truthを保存しました。Event Coreには登録していません。");
      if (action === "next") {
        const pending = await listTrainingDatasetCandidates({ limit: 200, review_status: "pending" });
        const next = pending.items.find((item) => item.id !== candidate.id);
        if (next) {
          router.push(`/admin/training-dataset/${next.id}`);
        } else {
          setPendingQueue([]);
          setSaveMessage("Ground Truthを保存しました。未レビューの次候補はありません。");
        }
      }
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Ground Truth保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    function clearShortcutPrefix() {
      shortcutPrefixRef.current = null;
      if (shortcutTimerRef.current !== null) {
        window.clearTimeout(shortcutTimerRef.current);
        shortcutTimerRef.current = null;
      }
    }

    function setShortcutPrefix(prefix: string) {
      clearShortcutPrefix();
      shortcutPrefixRef.current = prefix;
      shortcutTimerRef.current = window.setTimeout(clearShortcutPrefix, 1200);
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isEditing =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        Boolean(target?.isContentEditable);
      if (isEditing) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        clearShortcutPrefix();
        void handleSaveGroundTruth("stay");
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      const prefix = shortcutPrefixRef.current;
      if (!prefix && (key === "g" || key === "a")) {
        event.preventDefault();
        setShortcutPrefix(key);
        return;
      }
      if (prefix === "g" && key === "n") {
        event.preventDefault();
        clearShortcutPrefix();
        goToNextPending();
        return;
      }
      if (prefix === "a" && key === "p") {
        event.preventDefault();
        clearShortcutPrefix();
        void handleSaveGroundTruth("next");
        return;
      }
      if (prefix) clearShortcutPrefix();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearShortcutPrefix();
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate, form, pendingQueue, reviewNote, reviewStartedAt]);

  function toggleBenchmarkRoute(route: string) {
    setBenchmarkRoutes((current) =>
      current.includes(route) ? current.filter((item) => item !== route) : [...current, route],
    );
  }

  async function handleRunBenchmark() {
    setBenchmarkError(null);
    setIsBenchmarking(true);
    try {
      const models = benchmarkModels
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (benchmarkRoutes.length === 0) {
        throw new Error("少なくとも1つのrouteを選択してください。");
      }
      if (models.length === 0) {
        throw new Error("少なくとも1つのmodelを入力してください。");
      }
      let currentJob = await createTrainingDatasetBenchmarkJob(candidateId, {
        routes: benchmarkRoutes,
        models,
      });
      setBenchmarkJob(currentJob);
      while (currentJob.status === "queued" || currentJob.status === "running") {
        await new Promise((resolve) => setTimeout(resolve, 1800));
        currentJob = await getTrainingDatasetBenchmarkJob(currentJob.job_id);
        setBenchmarkJob(currentJob);
      }
      const runs = await listTrainingDatasetBenchmarkRuns(candidateId);
      setBenchmarkRuns(runs.items);
      if (currentJob.status === "failed") {
        throw new Error(currentJob.error ?? "Benchmark Runに失敗しました。");
      }
    } catch (err) {
      setBenchmarkError(err instanceof Error ? err.message : "Benchmark Runに失敗しました。");
    } finally {
      setIsBenchmarking(false);
    }
  }

  async function handleRunGptReview() {
    if (!candidate) return;
    setIsGptReviewing(true);
    setGptReviewError(null);
    try {
      const review = await runTrainingDatasetGptReview(candidate.id);
      setGptReview(review);
      setCandidate((current) =>
        current
          ? {
              ...current,
              gpt_reviews: [review, ...(current.gpt_reviews ?? [])],
            }
          : current,
      );
    } catch (err) {
      setGptReviewError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "GPT修正レビューに失敗しました。");
      setIsGptReviewing(false);
    }
  }

  async function pollGptReview(reviewId: string) {
    try {
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const review = await getTrainingDatasetGptReview(reviewId);
        setGptReview(review);
        setCandidate((current) =>
          current
            ? {
                ...current,
                gpt_reviews: [review, ...(current.gpt_reviews ?? []).filter((item) => item.id !== review.id)],
              }
            : current,
        );
        if (review.status !== "queued" && review.status !== "running") {
          setIsGptReviewing(false);
          return;
        }
      }
      setGptReviewError("GPT修正レビューの完了待ちがタイムアウトしました。再読込すると最新状態を確認できます。");
    } catch (err) {
      setGptReviewError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "GPT修正レビュー状態の取得に失敗しました。");
    } finally {
      setIsGptReviewing(false);
    }
  }

  function applyGptReviewToForm() {
    if (!gptReview || gptReview.status !== "completed") return;
    const result = asRecord(gptReview.review_result_json);
    const extraction = asRecord(result.extraction_review);
    const correctedExtraction = asRecord(extraction.corrected_json);
    const suggestions = asArray(extraction.suggestions).map(asRecord);
    const nextVenues = getGptSuggestedVenues(gptReview);
    const nextGroups = getGptSuggestedGroups(gptReview);
    const nextSessions = getGptSuggestedSessions(gptReview);
    setForm((current) => {
      const patch: Partial<GroundTruthForm> = {};
      for (const field of ["event_name", "event_date"] as const) {
        const fromCorrected = correctedExtraction[field];
        const fromSuggestion = suggestions.find((item) => item.field === field)?.suggested;
        const nextValue = fromCorrected ?? fromSuggestion;
        if (typeof nextValue === "string") {
          patch[field] = nextValue;
        } else if (nextValue === null) {
          patch[field] = "";
        }
      }
      if (nextVenues) {
        patch.venues = nextVenues;
      }
      if (nextGroups) {
        patch.group_candidates = nextGroups;
      }
      if (nextSessions) {
        patch.sessions = nextSessions;
      }
      return { ...current, ...patch };
    });
    if (nextGroups) setGroupJson(prettyJson(nextGroups));
    if (nextSessions) setSessionJson(prettyJson(nextSessions));
    setSaveMessage("GPT提案をフォームへ反映しました。内容を確認して保存してください。");
  }

  function applyGptVenuesToForm() {
    const nextVenues = getGptSuggestedVenues(gptReview);
    if (!nextVenues) return;
    setForm((current) => ({ ...current, venues: nextVenues }));
    setSaveMessage("GPTのvenues提案をフォームへ反映しました。");
  }

  function applyGptGroupsToForm() {
    const nextGroups = getGptSuggestedGroups(gptReview);
    if (!nextGroups) return;
    setForm((current) => ({ ...current, group_candidates: nextGroups }));
    setGroupJson(prettyJson(nextGroups));
    setSaveMessage("GPTのgroup_candidates提案をフォームへ反映しました。");
  }

  function applyGptSessionsToForm() {
    const nextSessions = getGptSuggestedSessions(gptReview);
    if (!nextSessions) return;
    setForm((current) => ({ ...current, sessions: nextSessions }));
    setSessionJson(prettyJson(nextSessions));
    setSaveMessage("GPTのsessions提案をフォームへ反映しました。");
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Ground Truth Review" subtitle="Event Candidate Labeling Tool のレビュー編集画面です。" backHref="/admin/training-dataset" />
        <Card className="flex items-center gap-2 p-6 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          候補を読み込んでいます。
        </Card>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="space-y-6">
        <PageHeader title="Ground Truth Review" subtitle="Event Candidate Labeling Tool のレビュー編集画面です。" backHref="/admin/training-dataset" />
        <Card className="p-6">
          <p className="text-red-700">{error ?? "候補が見つかりません。"}</p>
          <Link href="/admin/training-dataset" className="mt-4 inline-flex text-sm font-bold text-slate-900 underline">
            Labeling Uploadへ戻る
          </Link>
        </Card>
      </div>
    );
  }

  const currentImageAsset = imageModalIndex !== null ? imageAssets[imageModalIndex] : null;
  const currentImageAssetId = getSourceAssetId(currentImageAsset);
  const currentImageUrl = currentImageAssetId ? sourceAssetImageUrl(currentImageAssetId) : "";
  const currentImageDownloadUrl = currentImageAssetId ? sourceAssetImageUrl(currentImageAssetId, true) : "";
  const currentImageFilename = imageModalIndex !== null ? getAssetFilename(currentImageAsset, imageModalIndex) : "source_image.jpg";
  const extractionReviewCopyPayload = buildExtractionReviewCopyPayload(candidate, form, groupJson, sessionJson);
  const predictionVenues = normalizeVenues(candidate.prediction_json.venues, {
    venue_name: candidate.prediction_json.venue_name,
    open_time: candidate.prediction_json.open_time,
    start_time: candidate.prediction_json.start_time,
  });
  const gptSuggestedVenues = getGptSuggestedVenues(gptReview);
  const gptSuggestedGroups = getGptSuggestedGroups(gptReview);
  const gptSuggestedSessions = getGptSuggestedSessions(gptReview);
  const gptGroupsReview = getGptSection(gptReview, "group_candidates_review");
  const gptSessionsReview = getGptSection(gptReview, "sessions_review");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ground Truth Review"
        subtitle="Predictionを初期値にして、Source → EventCandidate の正解データを保存します。Event Core登録は行いません。"
        backHref="/admin/training-dataset"
      />

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <Card className="min-w-0 border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">This Page</p>
          <h2 className="mt-1 font-bold text-emerald-950">教師データを作るレビュー画面</h2>
          <p className="mt-2 text-sm text-emerald-900">
            `training_event_candidates` の prediction_json を人間が修正し、ground_truth_json として保存します。
          </p>
        </Card>
        <Card className="min-w-0 border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Candidate Reviewとの違い</p>
          <h2 className="mt-1 font-bold text-slate-900">Event Core登録前の運用レビューではありません</h2>
          <p className="mt-2 text-sm text-slate-600">
            Candidate ReviewはOCR DraftのApprove/Edit/Reject運用ログです。この画面はモデル改善用の正解JSON作成に限定します。
          </p>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 overflow-hidden p-4">
        <div>
          <p className="break-all font-mono text-xs text-slate-500">{candidate.id}</p>
          <p className="mt-1 text-sm text-slate-600">
            {candidate.single_multi} / route: {candidate.processing_route ?? String(candidate.input_payload_json?.processing_route ?? candidate.input_payload_json?.selected_route ?? "-")} / hint:{" "}
            {candidate.source_type_hint ?? "-"} / {candidate.review_status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={loadCandidate}>
            再読込
          </Button>
          <Link href="/admin/training-dataset">
            <Button type="button" variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Upload / 一覧へ
            </Button>
          </Link>
        </div>
      </Card>

      <Card className="sticky top-3 z-20 border-sky-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-end">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">review note</span>
            <input
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="判断理由や未確定メモ。任意"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => handleSaveGroundTruth("stay")} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存
            </Button>
            <Button type="button" onClick={() => handleSaveGroundTruth("next")} disabled={isSaving} className="bg-sky-700 text-white">
              保存して次へ
            </Button>
            <Button type="button" onClick={() => handleSaveGroundTruth("next")} disabled={isSaving} className="bg-emerald-700 text-white">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              承認して次へ
            </Button>
            <Button type="button" variant="outline" onClick={goToNextPending}>
              次候補
            </Button>
            <Button type="button" variant="outline" onClick={handleRunGptReview} disabled={isGptReviewing}>
              {isGptReviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              GPT修正レビュー開始
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">ショートカット: Ctrl/Cmd+S 保存 / g n 次候補 / a p 承認して次へ。入力中は無効です。</p>
        {gptReviewError ? <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{gptReviewError}</p> : null}
      </Card>

      {gptReview ? <GptReviewerResult review={gptReview} onApply={applyGptReviewToForm} /> : null}

      <div className="space-y-5">
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
          <Card className="min-w-0 p-5">
            <h2 className="font-bold">Source Images</h2>
            <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <p>
                <span className="font-bold">Processing Route:</span>{" "}
                {candidate.processing_route ?? String(candidate.input_payload_json?.processing_route ?? candidate.input_payload_json?.selected_route ?? "-")}
              </p>
              <p>
                <span className="font-bold">Source Type Hint:</span> {candidate.source_type_hint ?? "-"}
              </p>
              {itemSourceTypes.length ? (
                <p className="mt-1 break-words">
                  <span className="font-bold">Image Types:</span> {itemSourceTypes.join(" / ")}
                </p>
              ) : null}
            </div>
            {imageAssets.length ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {imageAssets.map((asset, index) => {
                  const assetId = getSourceAssetId(asset);
                  const assetRecord = asset && typeof asset === "object" ? (asset as Record<string, unknown>) : {};
                  const imageUrl = assetId ? sourceAssetImageUrl(assetId) : "";
                  const clipboardImageUrl = assetId ? sourceAssetClipboardImageUrl(assetId) : "";
                  const downloadUrl = assetId ? sourceAssetImageUrl(assetId, true) : "";
                  const filename = getAssetFilename(asset, index);
                  return assetId ? (
                    <div key={assetId} className="min-w-0">
                      <button type="button" onClick={() => setImageModalIndex(index)} className="group relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <img
                          src={imageUrl}
                          alt={`source ${index + 1}`}
                          className="aspect-square w-full object-cover transition group-hover:scale-[1.02]"
                        />
                        <span className="absolute right-2 top-2 rounded-full bg-slate-950/75 p-1.5 text-white opacity-90">
                          <Maximize2 className="h-3.5 w-3.5" />
                        </span>
                      </button>
                      <p className="mt-1 truncate text-[11px] font-bold text-slate-700">
                        #{index + 1} predicted: {String(assetRecord.source_type ?? itemSourceTypes[index] ?? "-")}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-emerald-700">
                        correct: {form.correct_item_source_types[index]?.correct_source_type || "-"}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] font-bold">
                        <CopyImageButton
                          imageUrl={clipboardImageUrl}
                          fallbackUrl={imageUrl}
                          label="画像コピー"
                          fallbackLabel={`${filename} URLコピー`}
                        />
                        <a
                          href={imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:text-slate-950"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          開く
                        </a>
                        <a
                          href={downloadUrl}
                          download={filename}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:text-slate-950"
                        >
                          <Download className="h-3.5 w-3.5" />
                          DL
                        </a>
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">画像参照はありません。</p>
            )}
          </Card>

          <Card className="min-w-0 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">OCR Raw Text</h2>
              <CopyButton text={rawTexts.map((item) => String((item as Record<string, unknown>).raw_text ?? "")).join("\n\n---\n\n")} />
            </div>
            <div className="mt-3 max-h-[540px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed">
              {rawTexts.length ? (
                rawTexts.map((item, index) => (
                  <div key={index} className="mb-5">
                    <p className="mb-1 break-all font-mono text-[10px] text-slate-500">
                      {(item as Record<string, unknown>).source_asset_id as string | undefined}
                    </p>
                    <pre className="whitespace-pre-wrap break-words">{String((item as Record<string, unknown>).raw_text ?? "")}</pre>
                  </div>
                ))
              ) : (
                <p>OCR Raw Textはありません。</p>
              )}
            </div>
          </Card>

          <Card className="min-w-0 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">Prediction / Ground Truth</h2>
              <CopyButton text={JSON.stringify({ prediction_json: candidate.prediction_json, ground_truth_json: buildGroundTruthPayload(form) }, null, 2)} />
            </div>
            <div className="mt-3 grid gap-3">
              {["event_name", "event_date"].map((field) => {
                const predictionValue = candidate.prediction_json[field];
                const groundTruthValue = (buildGroundTruthPayload(form) as Record<string, unknown>)[field];
                const changed = predictionValue !== groundTruthValue;
                return (
                  <div key={field} className={`rounded-xl border p-3 text-sm ${changed ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                    <p className="font-mono text-xs font-bold text-slate-500">{field}</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <p className="break-words rounded-lg bg-white px-3 py-2 text-slate-600">P: {String(predictionValue ?? "-")}</p>
                      <p className="break-words rounded-lg bg-white px-3 py-2 font-semibold text-slate-900">GT: {String(groundTruthValue ?? "-")}</p>
                    </div>
                  </div>
                );
              })}
              {(() => {
                const predictionVenues = normalizeVenues(candidate.prediction_json.venues, {
                  venue_name: candidate.prediction_json.venue_name,
                  open_time: candidate.prediction_json.open_time,
                  start_time: candidate.prediction_json.start_time,
                });
                const changed = prettyJson(predictionVenues) !== prettyJson(form.venues);
                return (
                  <div className={`rounded-xl border p-3 text-sm ${changed ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                    <p className="font-mono text-xs font-bold text-slate-500">venues</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
                        P: {prettyJson(predictionVenues)}
                      </pre>
                      <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-900">
                        GT: {prettyJson(form.venues)}
                      </pre>
                    </div>
                  </div>
                );
              })()}
              <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                <p className="rounded-lg bg-slate-50 p-3">Prediction groups: {Array.isArray(candidate.prediction_json.group_candidates) ? candidate.prediction_json.group_candidates.length : 0}</p>
                <p className="rounded-lg bg-slate-50 p-3">GT groups: {form.group_candidates.length}</p>
                <p className="rounded-lg bg-slate-50 p-3">Prediction sessions: {Array.isArray(candidate.prediction_json.sessions) ? candidate.prediction_json.sessions.length : 0}</p>
                <p className="rounded-lg bg-slate-50 p-3">GT sessions: {form.sessions.length}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="min-w-0 space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">Extraction Plan</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Session全体は source_type ではなく、画像ごとの分類結果から選ばれた処理戦略として扱います。
                </p>
              </div>
              <CopyButton text={prettyJson(extractionReviewCopyPayload)} label="一括コピー" copiedLabel="一括コピー済み" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">processing_route</p>
                <p className="mt-1 font-mono text-sm font-bold text-slate-900">
                  {candidate.processing_route ?? String(candidate.input_payload_json?.processing_route ?? candidate.input_payload_json?.selected_route ?? "-")}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">legacy predicted_source_type</p>
                <p className="mt-1 font-mono text-sm text-slate-600">{candidate.predicted_source_type ?? candidate.source_type ?? "-"}</p>
              </div>
            </div>
            <pre className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">
              {JSON.stringify(candidate.extraction_plan ?? candidate.input_payload_json?.extraction_plan ?? {}, null, 2)}
            </pre>
          </Card>

          <Card className="min-w-0 space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">Image Source Type Review</h2>
                <p className="mt-1 text-sm text-slate-500">
                  画像ごとの分類器教師データです。Session全体の処理戦略とは分けて保存します。
                </p>
              </div>
              <Button onClick={() => handleSaveGroundTruth("stay")} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Ground Truth
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="font-bold">Image Source Type Labels</h3>
              <p className="mt-1 text-sm text-slate-500">
                multi画像では、画像分類器の教師データとして schedule_document / flyer / x_post / other のcorrectを保存します。
              </p>
              <div className="mt-3 space-y-3">
                {form.correct_item_source_types.map((item, index) => (
                  <div key={`${item.source_asset_id}-${index}`} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
                    <p className="font-mono text-xs font-bold text-slate-500">#{index + 1}</p>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">asset</p>
                      <p className="truncate font-mono text-xs text-slate-600">{item.source_asset_id || item.filename || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">predicted</p>
                      <p className="mt-1 rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-700">{item.predicted_source_type || "-"}</p>
                    </div>
                    <label>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">correct</span>
                      <select
                        value={item.correct_source_type}
                        onChange={(event) => updateItemSourceType(index, event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">未設定</option>
                        {SOURCE_TYPE_OPTIONS.map((sourceType) => (
                          <option key={sourceType} value={sourceType}>
                            {sourceType}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
                {form.correct_item_source_types.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">画像ごとのsource type情報はありません。</p>
                ) : null}
              </div>
            </div>

            {jsonError ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{jsonError}</p> : null}
            {saveMessage ? (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {saveMessage}
              </p>
            ) : null}
          </Card>

          <Card className="min-w-0 space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">Extraction Review</h2>
                <p className="mt-1 text-sm text-slate-500">
                  抽出器の教師データです。Prediction と GPT提案を見ながら、人間が正解JSONとして修正します。
                </p>
              </div>
              <Button onClick={() => handleSaveGroundTruth("stay")} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Extraction Reviewを保存
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">event_name</span>
                  <input
                    value={form.event_name}
                    onChange={(event) => setForm((current) => ({ ...current, event_name: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-semibold"
                  />
                </label>
                <InlineCompare label="event_name" prediction={candidate.prediction_json.event_name} gpt={getGptSuggestedField(gptReview, "event_name")} />
              </div>
              <div className="space-y-2">
                <label>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">event_date</span>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(event) => setForm((current) => ({ ...current, event_date: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
                  />
                </label>
                <InlineCompare label="event_date" prediction={candidate.prediction_json.event_date} gpt={getGptSuggestedField(gptReview, "event_date")} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">venues</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    会場情報の正解データです。保存時のみ、互換用の venue_name / open_time / start_time は先頭venueから自動生成します。
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={addVenue}>
                  <Plus className="mr-2 h-4 w-4" />
                  会場追加
                </Button>
              </div>
              <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-3">
                  {form.venues.map((venue, index) => (
                    <div key={index} className="grid gap-3 rounded-xl bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_150px_150px_minmax(0,1fr)_44px] lg:items-end">
                      <label>
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">venue #{index + 1}</span>
                        <input
                          value={venue.venue_name}
                          onChange={(event) => updateVenue(index, { venue_name: event.target.value })}
                          placeholder="会場名"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <label>
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">open</span>
                        <input
                          type="time"
                          value={venue.open_time}
                          onChange={(event) => updateVenue(index, { open_time: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <label>
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">start</span>
                        <input
                          type="time"
                          value={venue.start_time}
                          onChange={(event) => updateVenue(index, { start_time: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <label>
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">note</span>
                        <input
                          value={venue.note}
                          onChange={(event) => updateVenue(index, { note: event.target.value })}
                          placeholder="例: ライブ会場 / 特典会会場"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeVenue(index)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="remove venue"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {form.venues.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">複数会場情報はありません。必要なら会場追加してください。</p>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Prediction venues</p>
                    <JsonBlock value={predictionVenues} />
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-600">GPT venues proposal</p>
                      <Button type="button" variant="outline" size="sm" onClick={applyGptVenuesToForm} disabled={!gptSuggestedVenues}>
                        反映
                      </Button>
                    </div>
                    <JsonBlock value={gptSuggestedVenues ?? []} />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="min-w-0 space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">group_candidates</h2>
                <p className="mt-1 text-sm text-slate-500">Ground Truthではグループ名を編集します。score / match_method は予測メタ情報として表示のみです。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={applyGptGroupsToForm} disabled={!gptSuggestedGroups}>
                  GPT JSONをフォームへ反映
                </Button>
                <Button type="button" variant="outline" onClick={addGroupCandidate}>
                  <Plus className="mr-2 h-4 w-4" />
                  グループ追加
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Prediction / Current / GPT count</p>
                <div className="mt-2 grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-3">
                  <p className="rounded-lg bg-white p-2">P {Array.isArray(candidate.prediction_json.group_candidates) ? candidate.prediction_json.group_candidates.length : 0}</p>
                  <p className="rounded-lg bg-white p-2">GT {form.group_candidates.length}</p>
                  <p className="rounded-lg bg-white p-2">GPT {gptSuggestedGroups?.length ?? 0}</p>
                </div>
              </div>
              <ReviewCommentBlock title="groups" countComment={gptGroupsReview.count_comment} contentComment={gptGroupsReview.content_comment} />
            </div>

            <GptIssuesList issues={gptGroupsReview.issues} approved={gptGroupsReview.approved} />

            <div className="grid gap-3 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-bold">Prediction JSON</h3>
                  <CopyButton text={prettyJson(candidate.prediction_json.group_candidates ?? [])} />
                </div>
                <JsonBlock value={candidate.prediction_json.group_candidates ?? []} />
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-bold">GPT corrected_json</h3>
                  <CopyButton text={prettyJson(gptSuggestedGroups ?? [])} />
                </div>
                <JsonBlock value={gptSuggestedGroups ?? []} />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="hidden bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400 md:grid md:grid-cols-[minmax(0,1fr)_90px_140px_44px] md:gap-3">
                <span>group_name</span>
                <span>score</span>
                <span>match_method</span>
                <span />
              </div>
              {form.group_candidates.map((item, index) => (
                <div key={index} className="border-t border-slate-200 p-3 first:border-t-0 md:grid md:grid-cols-[minmax(0,1fr)_90px_140px_44px] md:items-center md:gap-3">
                  <label>
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400 md:hidden">group #{index + 1}</span>
                    <input
                      value={item.group_name}
                      onChange={(event) => updateGroupCandidate(index, { group_name: event.target.value })}
                      placeholder="グループ名"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base md:mt-0"
                    />
                  </label>
                  <div className="mt-2 md:mt-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 md:hidden">score</p>
                    <span className="inline-flex min-h-10 w-full items-center rounded-lg bg-slate-50 px-3 font-mono text-xs text-slate-500">
                      {item.score ?? "-"}
                    </span>
                  </div>
                  <div className="mt-2 md:mt-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 md:hidden">match_method</p>
                    <span className="inline-flex min-h-10 w-full items-center rounded-lg bg-slate-50 px-3 text-xs text-slate-500">
                      {item.match_method || "-"}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-end md:mt-0">
                    <button
                      type="button"
                      onClick={() => removeGroupCandidate(index)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="remove group"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {form.group_candidates.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">グループ候補はありません。必要なら追加してください。</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">JSON編集</h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={groupJson} />
                  <Button type="button" variant="outline" size="sm" onClick={syncGroupFormToJson}>
                    フォームをJSONへ
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={applyGroupJsonToForm}>
                    JSONをフォームへ反映
                  </Button>
                </div>
              </div>
              <textarea
                value={groupJson}
                onChange={(event) => setGroupJson(event.target.value)}
                className="mt-3 min-h-64 w-full rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100"
              />
            </div>
          </Card>

          <Card className="min-w-0 space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">sessions</h2>
                <p className="mt-1 text-sm text-slate-500">時間枠は「時刻 / 種別 / 出演者またはタイトル / 場所」で確認できるようにしています。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={applyGptSessionsToForm} disabled={!gptSuggestedSessions}>
                  GPT JSONをフォームへ反映
                </Button>
                <Button type="button" variant="outline" onClick={addSession}>
                  <Plus className="mr-2 h-4 w-4" />
                  Session追加
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Prediction / Current / GPT count</p>
                <div className="mt-2 grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-3">
                  <p className="rounded-lg bg-white p-2">P {Array.isArray(candidate.prediction_json.sessions) ? candidate.prediction_json.sessions.length : 0}</p>
                  <p className="rounded-lg bg-white p-2">GT {form.sessions.length}</p>
                  <p className="rounded-lg bg-white p-2">GPT {gptSuggestedSessions?.length ?? 0}</p>
                </div>
              </div>
              <ReviewCommentBlock title="sessions" countComment={gptSessionsReview.count_comment} contentComment={gptSessionsReview.content_comment} />
            </div>

            <GptIssuesList issues={gptSessionsReview.issues} approved={gptSessionsReview.approved} />

            <div className="grid gap-3 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-bold">Prediction JSON</h3>
                  <CopyButton text={prettyJson(candidate.prediction_json.sessions ?? [])} />
                </div>
                <JsonBlock value={candidate.prediction_json.sessions ?? []} />
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-bold">GPT corrected_json</h3>
                  <CopyButton text={prettyJson(gptSuggestedSessions ?? [])} />
                </div>
                <JsonBlock value={gptSuggestedSessions ?? []} />
              </div>
            </div>

            <div className="space-y-3">
              {form.sessions.map((session, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="grid min-w-0 gap-3 lg:grid-cols-[150px_150px_minmax(0,1.4fr)_minmax(0,1fr)_44px]">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">session #{index + 1}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-1">
                        <input
                          type="time"
                          value={session.start_time}
                          onChange={(event) => updateSession(index, { start_time: event.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          aria-label={`session ${index + 1} start_time`}
                        />
                        <input
                          type="time"
                          value={session.end_time}
                          onChange={(event) => updateSession(index, { end_time: event.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          aria-label={`session ${index + 1} end_time`}
                        />
                      </div>
                    </div>

                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">type</span>
                      <select
                        suppressHydrationWarning
                        value={session.session_type}
                        onChange={(event) => updateSession(index, { session_type: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="performance">performance</option>
                        <option value="meet_and_greet">meet_and_greet</option>
                        <option value="booth">booth</option>
                        <option value="talk">talk</option>
                        <option value="photo_session">photo_session</option>
                        <option value="signing">signing</option>
                        <option value="other">other</option>
                      </select>
                    </label>

                    <div className="grid min-w-0 gap-2">
                      <label>
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">group_name</span>
                        <input
                          value={session.group_name}
                          onChange={(event) => updateSession(index, { group_name: event.target.value })}
                          placeholder="group_name"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <label>
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">title</span>
                        <input
                          value={session.title}
                          onChange={(event) => updateSession(index, { title: event.target.value })}
                          placeholder="title / memo"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                    </div>

                    <div className="grid min-w-0 gap-2">
                      <label>
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">venue_name</span>
                        <input
                          value={session.venue_name}
                          onChange={(event) => updateSession(index, { venue_name: event.target.value })}
                          placeholder="session venue"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <label>
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">stage / lane</span>
                        <input
                          value={session.stage_name}
                          onChange={(event) => updateSession(index, { stage_name: event.target.value })}
                          placeholder="stage / lane"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <label>
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">note</span>
                        <input
                          value={session.note}
                          onChange={(event) => updateSession(index, { note: event.target.value })}
                          placeholder="note"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <label>
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">container_id</span>
                        <input
                          value={session.container_id}
                          onChange={(event) => updateSession(index, { container_id: event.target.value })}
                          placeholder="container_id"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                    </div>

                    <div className="flex justify-end lg:items-start">
                      <button
                        type="button"
                        onClick={() => removeSession(index)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="remove session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {form.sessions.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">sessionsはありません。必要なら追加してください。</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">JSON編集</h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={sessionJson} />
                  <Button type="button" variant="outline" size="sm" onClick={syncSessionFormToJson}>
                    フォームをJSONへ
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={applySessionJsonToForm}>
                    JSONをフォームへ反映
                  </Button>
                </div>
              </div>
              <textarea
                value={sessionJson}
                onChange={(event) => setSessionJson(event.target.value)}
                className="mt-3 min-h-80 w-full rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100"
              />
            </div>
          </Card>
        </div>

      </div>

      <Card className="min-w-0 space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">Route × Model Benchmark</h2>
            <p className="mt-1 text-sm text-slate-500">
              同じ教師データ候補に対して Text / Vision / Layout を再実行し、入力表現とモデルの差を比較します。
            </p>
          </div>
          <Button type="button" onClick={handleRunBenchmark} disabled={isBenchmarking}>
            {isBenchmarking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Benchmark Run
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Routes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["text", "vision", "layout"].map((route) => (
                <button
                  key={route}
                  type="button"
                  onClick={() => toggleBenchmarkRoute(route)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold ${
                    benchmarkRoutes.includes(route)
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {route}
                </button>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Models comma separated</span>
              <input
                value={benchmarkModels}
                onChange={(event) => setBenchmarkModels(event.target.value)}
                placeholder="gpt-5-mini, gpt-5"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm"
              />
            </label>
            {benchmarkJob ? (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                <p className="font-bold">{benchmarkJob.status}</p>
                <p className="mt-1 text-slate-600">{benchmarkJob.message}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{benchmarkJob.current_step ?? "-"}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(0, benchmarkJob.progress)}%` }} />
                </div>
              </div>
            ) : null}
            {benchmarkError ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{benchmarkError}</p> : null}
          </div>

          <div className="space-y-3">
            {benchmarkRuns.length ? (
              benchmarkRuns.map((run) => (
                <details key={run.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold">
                          {run.route_name} × {run.model_name}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{benchmarkSummary(run)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-mono">{run.status}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-mono">{run.latency_ms ?? "-"}ms</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-mono">{run.total_tokens ?? "-"} tok</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-mono">
                          {run.estimated_cost_usd != null ? `$${run.estimated_cost_usd}` : "$-"}
                        </span>
                      </div>
                    </div>
                  </summary>
                  {run.error_message ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{run.error_message}</p> : null}
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">prediction_json</p>
                      <JsonBlock value={run.prediction_json} />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">metrics_json</p>
                      <JsonBlock value={run.metrics_json} />
                    </div>
                  </div>
                </details>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                まだBenchmark Runはありません。まずは gpt-5-mini 固定で Text / Vision / Layout を比較するのがおすすめです。
              </p>
            )}
          </div>
        </div>
      </Card>

      <details className="rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer list-none font-bold text-slate-900">
          Raw JSON / Review Revision
        </summary>
        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-bold">一括コピー用JSON: extraction_review_bundle</h3>
            <CopyButton text={prettyJson(extractionReviewCopyPayload)} label="一括コピー" copiedLabel="一括コピー済み" />
          </div>
          <JsonBlock value={extractionReviewCopyPayload} />
        </Card>
        <Card className="min-w-0 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-bold">prediction_json</h3>
            <CopyButton text={prettyJson(candidate.prediction_json)} />
          </div>
          <JsonBlock value={candidate.prediction_json} />
        </Card>
        <Card className="min-w-0 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-bold">ground_truth_json</h3>
            <CopyButton text={prettyJson(buildGroundTruthPayload(form))} />
          </div>
          <JsonBlock value={buildGroundTruthPayload(form)} />
        </Card>
        <Card className="min-w-0 p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-bold">review_revisions</h3>
            <CopyButton text={prettyJson(candidate.review_revisions ?? [])} />
          </div>
          <div className="space-y-3">
            {(candidate.review_revisions ?? []).length ? (
              (candidate.review_revisions ?? []).map((revision) => (
                <details key={revision.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-bold">Review #{revision.revision}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-slate-100 px-3 py-1">{revision.review_status}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">{revision.reviewer ?? "unknown"}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">{revision.review_seconds ?? "-"} sec</span>
                        <span className="font-mono">{revision.created_at}</span>
                      </div>
                    </div>
                  </summary>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">change_set_json</p>
                        <CopyButton text={prettyJson(revision.change_set_json)} />
                      </div>
                      <JsonBlock value={revision.change_set_json} />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">model_eval_metadata_json</p>
                        <CopyButton text={prettyJson(revision.model_eval_metadata_json)} />
                      </div>
                      <JsonBlock value={revision.model_eval_metadata_json} />
                    </div>
                  </div>
                </details>
              ))
            ) : (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">まだReview Revisionはありません。</p>
            )}
          </div>
        </Card>
        <Card className="min-w-0 p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-bold">input_payload_json</h3>
            <CopyButton text={prettyJson(candidate.input_payload_json)} />
          </div>
          <JsonBlock value={candidate.input_payload_json} />
        </Card>
        </div>
      </details>

      {imageModalIndex !== null ? (
        <div className="fixed inset-0 z-50 bg-slate-950/90 p-3 text-white">
          <div className="mx-auto flex h-full max-w-7xl flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-sm">
                image {imageModalIndex + 1} / {imageAssets.length}
              </p>
                <div className="flex items-center gap-2">
                  <CopyImageButton
                    imageUrl={currentImageAssetId ? sourceAssetClipboardImageUrl(currentImageAssetId) : currentImageUrl}
                    fallbackUrl={currentImageUrl}
                    label="画像コピー"
                    fallbackLabel={`${currentImageFilename} URLコピー`}
                  />
                  {currentImageAssetId ? (
                    <>
                    <a
                      href={currentImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      開く
                    </a>
                    <a
                      href={currentImageDownloadUrl}
                      download={currentImageFilename}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                    >
                      <Download className="h-4 w-4" />
                      DL
                    </a>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setImageModalIndex((current) => (current === null ? null : Math.max(0, current - 1)))}
                  disabled={imageModalIndex <= 0}
                  className="bg-white text-slate-900"
                >
                  <ChevronLeft className="h-4 w-4" />
                  前へ
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setImageModalIndex((current) => (current === null ? null : Math.min(imageAssets.length - 1, current + 1)))}
                  disabled={imageModalIndex >= imageAssets.length - 1}
                  className="bg-white text-slate-900"
                >
                  次へ
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <button type="button" onClick={() => setImageModalIndex(null)} className="grid h-10 w-10 place-items-center rounded-lg bg-white text-slate-900">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-2xl bg-slate-900 p-3">
              {(() => {
                const asset = imageAssets[imageModalIndex];
                const assetId = getSourceAssetId(asset);
                return assetId ? (
                  <img
                    src={sourceAssetImageUrl(assetId)}
                    alt={`source ${imageModalIndex + 1}`}
                    className="mx-auto max-h-none max-w-full object-contain"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-slate-300">画像参照はありません。</div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
