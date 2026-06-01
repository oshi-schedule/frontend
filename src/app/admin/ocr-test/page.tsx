"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ClipboardCopy, Copy as CopyIcon, ImageIcon, Loader2, Plus, ScanSearch, Trash2 } from "lucide-react";
import { ApiError } from "@/api/client";
import {
  confirmOCRUploadSessionEventCore,
  runOCRVisionEvaluation,
  saveOCRUploadSessionTimetableReview,
  saveOCRUploadSessionReview,
  updateOCRVisionEvaluationHumanScore,
  reparseSourceForOCRTest,
  saveOCRTestGroundTruth,
  uploadSourceForOCRTest,
  type OCRTestSourceType,
  type OCRTestWorkflowResponse,
  type OCRUploadSessionConfirmEventCorePayload,
  type OCRTimetableScheduleItem,
  type SourceTypeAudit,
} from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

const SOURCE_TYPE_OPTIONS: Array<{ value: OCRTestSourceType; label: string }> = [
  { value: "flyer", label: "flyer" },
  { value: "timetable", label: "timetable" },
  { value: "meet_and_greet", label: "meet_and_greet" },
  { value: "x_post", label: "x_post" },
  { value: "other", label: "other" },
];

const VISION_EVALUATION_MODELS = ["gpt-4o", "gpt-5-mini", "gpt-5"] as const;

interface GroundTruthFormState {
  event_name: string;
  event_date: string;
  venue_name: string;
}

interface ReviewFormState {
  event_name: string;
  event_date: string;
  venue_name: string;
}

type TimetableEditItem = OCRTimetableScheduleItem & { client_id: string };

function createEmptyGroundTruthForm(): GroundTruthFormState {
  return {
    event_name: "",
    event_date: "",
    venue_name: "",
  };
}

function createEmptyTimetableItem(itemKind: "live" | "meet_and_greet"): TimetableEditItem {
  return {
    client_id: crypto.randomUUID(),
    item_kind: itemKind,
    title: "",
    performer_name: "",
    stage_name: "",
    booth_name: "",
    start_time: "",
    end_time: "",
    confidence: null,
  };
}

function createEmptyReviewForm(): ReviewFormState {
  return {
    event_name: "",
    event_date: "",
    venue_name: "",
  };
}

function normalizeSourceType(value: string | null | undefined): OCRTestSourceType | "" {
  if (!value) return "";
  if (value === "flyer" || value === "schedule_document" || value === "timetable" || value === "meet_and_greet" || value === "x_post" || value === "other") return value;
  return "";
}

function displaySourceType(value: string | null | undefined): string {
  return normalizeSourceType(value) || value || "-";
}

function normalizeEditableSourceType(value: string | null | undefined): OCRTestSourceType | "" {
  if (value === "schedule_document") return "timetable";
  return normalizeSourceType(value);
}

function buildGroundTruthForm(result: OCRTestWorkflowResponse | null): GroundTruthFormState {
  const groundTruth = result?.result.ground_truth;
  const llmExtraction = result?.result.parsed.llm_extraction;
  const extracted = result?.result.parsed.event;
  return {
    event_name: groundTruth?.event_name ?? llmExtraction?.event_name ?? extracted?.display_name ?? "",
    event_date: groundTruth?.event_date ?? llmExtraction?.event_date ?? extracted?.event_date ?? "",
    venue_name: groundTruth?.venue_name ?? llmExtraction?.venue_name ?? extracted?.venue_name ?? "",
  };
}

function buildReviewForm(result: OCRTestWorkflowResponse | null): ReviewFormState {
  const revision = result?.result.session?.latest_revision;
  const canonical = result?.result.session?.canonical_event_candidate ?? result?.result.parsed.session?.canonical_event_candidate ?? null;
  const source = revision?.human_reviewed_result ?? canonical;
  return {
    event_name: source?.event_name ?? "",
    event_date: source?.event_date ?? "",
    venue_name: source?.venue_name ?? "",
  };
}

function toEditItems(items: OCRTimetableScheduleItem[] | undefined, itemKind: "live" | "meet_and_greet"): TimetableEditItem[] {
  return (items ?? []).map((item) => ({
    ...item,
    item_kind: itemKind,
    client_id: item.id ?? item.source_schedule_item_id ?? crypto.randomUUID(),
    title: item.title ?? "",
    performer_name: item.performer_name ?? "",
    stage_name: item.stage_name ?? "",
    booth_name: item.booth_name ?? "",
    start_time: item.start_time ?? "",
    end_time: item.end_time ?? "",
  }));
}

function buildTimetableReviewState(result: OCRTestWorkflowResponse | null): {
  live_sessions: TimetableEditItem[];
  meet_and_greet_sessions: TimetableEditItem[];
} {
  const latest = result?.result.session?.timetable_review?.latest_revision;
  if (latest) {
    const reviewed = latest.human_reviewed_result.live_sessions.length || latest.human_reviewed_result.meet_and_greet_sessions.length
      ? latest.human_reviewed_result
      : latest.final_result;
    return {
      live_sessions: toEditItems(reviewed.live_sessions, "live"),
      meet_and_greet_sessions: toEditItems(reviewed.meet_and_greet_sessions, "meet_and_greet"),
    };
  }
  const extractions = result?.result.session?.vision_structure_extractions ?? [];
  return {
    live_sessions: toEditItems(extractions.flatMap((extraction) => extraction.live_sessions), "live"),
    meet_and_greet_sessions: toEditItems(extractions.flatMap((extraction) => extraction.meet_and_greet_sessions), "meet_and_greet"),
  };
}

function toReviewPayload(items: TimetableEditItem[]): OCRTimetableScheduleItem[] {
  return items.map(({ client_id: _clientId, ...item }) => ({
    ...item,
    title: item.title?.trim() || null,
    performer_name: item.performer_name?.trim() || null,
    stage_name: item.stage_name?.trim() || null,
    booth_name: item.booth_name?.trim() || null,
    start_time: item.start_time || null,
    end_time: item.end_time || null,
  }));
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title="コピー"
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
    >
      {copied ? (
        <>
          <Check size={13} className="text-emerald-500" />
          <span className="text-emerald-500">Copied</span>
        </>
      ) : (
        <ClipboardCopy size={13} />
      )}
    </button>
  );
}

function JsonView({ value }: { value: unknown }) {
  return <pre className="overflow-x-auto rounded-md bg-[#f8fafc] p-3 text-xs leading-6 text-slate-700">{JSON.stringify(value, null, 2)}</pre>;
}

function CardHeader({ title, copyText }: { title: string; copyText?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      {copyText !== undefined && copyText !== "" && <CopyButton text={copyText} />}
    </div>
  );
}

function SourceTypeAuditView({ value }: { value: SourceTypeAudit | null | undefined }) {
  if (!value) {
    return <p className="text-sm text-slate-500">source_type_audit はまだありません。</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-[var(--border)] bg-white px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">LLM 判定</p>
          <p className="mt-1 font-mono text-sm font-semibold text-indigo-700">{displaySourceType(value.llm_source_type)}</p>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-white px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Rule 判定</p>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{displaySourceType(value.rule_source_type)}</p>
          <p className="text-xs text-slate-500">confidence: {value.rule_confidence.toFixed(3)}</p>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-white px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            判定一致{" "}
            {value.conflict ? (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">CONFLICT</span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">OK</span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">score_gap: {value.score_gap.toFixed(3)}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Top Candidates</p>
        <div className="overflow-x-auto rounded-md border border-[var(--border)]">
          <table className="min-w-full divide-y divide-[var(--border)] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">source_type</th>
                <th className="px-3 py-2">score</th>
                <th className="px-3 py-2">bar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-white">
              {value.top_candidates.map((c) => (
                <tr
                  key={c.source_type}
                  className={normalizeSourceType(c.source_type) === normalizeSourceType(value.llm_source_type) ? "bg-indigo-50" : ""}
                >
                  <td className="px-3 py-2 font-mono font-medium text-slate-900">
                    {displaySourceType(c.source_type)}
                    {normalizeSourceType(c.source_type) === normalizeSourceType(value.llm_source_type) && (
                      <span className="ml-1 text-xs text-indigo-500">← LLM</span>
                    )}
                    {normalizeSourceType(c.source_type) === normalizeSourceType(value.rule_source_type) &&
                      normalizeSourceType(c.source_type) !== normalizeSourceType(value.llm_source_type) && (
                      <span className="ml-1 text-xs text-amber-600">← Rule</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{c.score.toFixed(3)}</td>
                  <td className="px-3 py-2">
                    <div className="h-2 w-32 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-indigo-400" style={{ width: `${Math.round(c.score * 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Signals</p>
        {Object.keys(value.signals).length === 0 ? (
          <p className="text-sm text-slate-500">シグナルなし</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(value.signals).map(([key, score]) => (
              <span
                key={key}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs ${
                  score < 0 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"
                }`}
              >
                {key}
                <span className="font-semibold">{score > 0 ? `+${score}` : score}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimetableReviewEditor({
  title,
  itemKind,
  items,
  onChange,
}: {
  title: string;
  itemKind: "live" | "meet_and_greet";
  items: TimetableEditItem[];
  onChange: (items: TimetableEditItem[]) => void;
}) {
  function updateItem(clientId: string, patch: Partial<TimetableEditItem>) {
    onChange(items.map((item) => (item.client_id === clientId ? { ...item, ...patch } : item)));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    onChange(next);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{items.length} rows</p>
        </div>
        <Button onClick={() => onChange([...items, createEmptyTimetableItem(itemKind)])} className="bg-slate-900 text-white">
          <Plus size={15} />
          追加
        </Button>
      </div>
      <div className="space-y-3">
        {items.length ? (
          items.map((item, index) => (
            <div key={item.client_id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-white px-2 py-0.5 font-mono text-xs text-slate-500">#{index + 1}</span>
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => moveItem(index, -1)} className="rounded bg-white p-1 text-slate-500 hover:text-slate-900" title="上へ">
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" onClick={() => moveItem(index, 1)} className="rounded bg-white p-1 text-slate-500 hover:text-slate-900" title="下へ">
                    <ArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange([...items.slice(0, index + 1), { ...item, id: null, client_id: crypto.randomUUID() }, ...items.slice(index + 1)])}
                    className="rounded bg-white p-1 text-slate-500 hover:text-slate-900"
                    title="複製"
                  >
                    <CopyIcon size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(items.filter((current) => current.client_id !== item.client_id))}
                    className="rounded bg-white p-1 text-red-500 hover:text-red-700"
                    title="削除"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <Input
                  value={item.start_time ?? ""}
                  onChange={(event) => updateItem(item.client_id, { start_time: event.target.value })}
                  placeholder="start"
                  className="font-mono text-xs"
                />
                <Input
                  value={item.end_time ?? ""}
                  onChange={(event) => updateItem(item.client_id, { end_time: event.target.value })}
                  placeholder="end"
                  className="font-mono text-xs"
                />
                <Input
                  value={item.title ?? ""}
                  onChange={(event) => updateItem(item.client_id, { title: event.target.value })}
                  placeholder="title"
                  className="lg:col-span-2"
                />
                {itemKind === "live" ? (
                  <>
                    <Input value={item.performer_name ?? ""} onChange={(event) => updateItem(item.client_id, { performer_name: event.target.value })} placeholder="performer" />
                    <Input value={item.stage_name ?? ""} onChange={(event) => updateItem(item.client_id, { stage_name: event.target.value })} placeholder="stage" />
                  </>
                ) : (
                  <>
                    <Input value={item.performer_name ?? ""} onChange={(event) => updateItem(item.client_id, { performer_name: event.target.value })} placeholder="performer" />
                    <Input value={item.booth_name ?? ""} onChange={(event) => updateItem(item.client_id, { booth_name: event.target.value })} placeholder="booth" />
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            まだ行がありません。AI抽出が空の場合はここから追加できます。
          </p>
        )}
      </div>
    </div>
  );
}

export default function AdminOCRTestPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<OCRTestWorkflowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ignoreCache, setIgnoreCache] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [groundTruthForm, setGroundTruthForm] = useState<GroundTruthFormState>(createEmptyGroundTruthForm());
  const [sourceTypeGroundTruthByParsingId, setSourceTypeGroundTruthByParsingId] = useState<Record<string, OCRTestSourceType | "">>({});
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(createEmptyReviewForm());
  const [liveSessionRows, setLiveSessionRows] = useState<TimetableEditItem[]>([]);
  const [meetAndGreetRows, setMeetAndGreetRows] = useState<TimetableEditItem[]>([]);
  const [selectedEventCoreCandidateId, setSelectedEventCoreCandidateId] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<"create_new" | "link_existing">("create_new");
  const [isSavingGroundTruth, setIsSavingGroundTruth] = useState(false);
  const [savingSourceTypeGroundTruthId, setSavingSourceTypeGroundTruthId] = useState<string | null>(null);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isSavingTimetableReview, setIsSavingTimetableReview] = useState(false);
  const [runningVisionEvaluationKey, setRunningVisionEvaluationKey] = useState<string | null>(null);
  const [savingVisionScoreRunId, setSavingVisionScoreRunId] = useState<string | null>(null);
  const [isConfirmingEventCore, setIsConfirmingEventCore] = useState(false);
  const [groundTruthMessage, setGroundTruthMessage] = useState<string | null>(null);
  const [sourceTypeGroundTruthMessage, setSourceTypeGroundTruthMessage] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [timetableReviewMessage, setTimetableReviewMessage] = useState<string | null>(null);
  const [visionEvaluationMessage, setVisionEvaluationMessage] = useState<string | null>(null);

  const primaryFile = selectedFiles[0] ?? null;
  const primaryAsset = result?.result.assets[0] ?? null;
  const session = result?.result.session ?? null;
  const sessionDecision = session?.decision ?? session?.canonical_event_candidate ?? result?.result.parsed.session?.canonical_event_candidate ?? null;
  const eventCoreResolution = session?.event_core_resolution ?? result?.result.parsed.session?.event_core_resolution ?? null;
  const canonicalEventCandidate = eventCoreResolution?.canonical_event_candidate ?? sessionDecision ?? null;
  const sessionAggregation = session?.aggregation ?? result?.result.parsed.session?.aggregation ?? null;
  const aggregatedEventCandidates = sessionAggregation?.event_candidates ?? [];
  const extracted = result?.result.parsed.event ?? null;
  const llmExtraction = result?.result.parsed.llm_extraction ?? null;
  const resolution = result?.result.resolution ?? null;
  const lines = result?.result.parsed.lines ?? [];
  const selectedGroundTruthParsingResultId =
    sessionDecision?.selected_item_id ?? result?.result.parsing_result_id ?? result?.result.parsing_result_ids?.[0] ?? null;
  const selectedEventCoreCandidate = eventCoreResolution?.selected_event_core_candidate ?? null;

  useEffect(() => {
    if (!primaryFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(primaryFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [primaryFile]);

  useEffect(() => {
    setGroundTruthForm(result ? buildGroundTruthForm(result) : createEmptyGroundTruthForm());
  }, [result]);

  useEffect(() => {
    const groundTruth = result?.result.ground_truth;
    if (!groundTruth?.event_parsing_result_id) {
      setSourceTypeGroundTruthByParsingId({});
      return;
    }
    setSourceTypeGroundTruthByParsingId({
      [groundTruth.event_parsing_result_id]: normalizeEditableSourceType(groundTruth.source_type),
    });
  }, [result]);

  useEffect(() => {
    setReviewForm(result ? buildReviewForm(result) : createEmptyReviewForm());
    const timetableState = buildTimetableReviewState(result);
    setLiveSessionRows(timetableState.live_sessions);
    setMeetAndGreetRows(timetableState.meet_and_greet_sessions);
    setSelectedEventCoreCandidateId(result?.result.session?.event_core_resolution?.selected_event_core_candidate?.event_core_id ?? null);
    setConfirmMode(result?.result.session?.event_core_resolution?.selected_event_core_candidate ? "link_existing" : "create_new");
  }, [result]);

  const eventCoreSearchResult = useMemo(() => {
    if (!resolution) return null;
    if (resolution.action === "matched_existing") {
      const matched = resolution.duplicate_candidates[0];
      return {
        matched: true,
        event_id: matched?.id ?? resolution.event_id,
        event_name: matched?.display_name ?? null,
        dry_run: result?.result.dry_run ?? false,
      };
    }
    return { matched: false, dry_run: result?.result.dry_run ?? false };
  }, [resolution, result?.result.dry_run]);

  const creationResult = useMemo(() => {
    if (!resolution) return null;
    if (resolution.action === "created_event") {
      return {
        created: Boolean(resolution.persisted),
        would_create: Boolean(resolution.would_create_event),
        event_id: resolution.event_id,
        dry_run: result?.result.dry_run ?? false,
      };
    }
    return {
      created: false,
      would_create: false,
      dry_run: result?.result.dry_run ?? false,
    };
  }, [resolution, result?.result.dry_run]);

  function handleFilesSelected(fileList: FileList | null) {
    const nextFiles = fileList ? Array.from(fileList).slice(0, 4) : [];
    setSelectedFiles(nextFiles);
    setResult(null);
    setError(null);
    setGroundTruthForm(createEmptyGroundTruthForm());
    setSourceTypeGroundTruthByParsingId({});
    setLiveSessionRows([]);
    setMeetAndGreetRows([]);
    setGroundTruthMessage(null);
    setSourceTypeGroundTruthMessage(null);
    setTimetableReviewMessage(null);
    setVisionEvaluationMessage(null);
  }

  async function handleSubmit() {
    if (selectedFiles.length === 0) return;

    setIsSubmitting(true);
    setError(null);
    setResult(null);
    setGroundTruthMessage(null);
    setSourceTypeGroundTruthMessage(null);
    try {
      const source = await uploadSourceForOCRTest(selectedFiles, { ignoreCache, dryRun });
      const reparsed = await reparseSourceForOCRTest(source.id);
      setResult(reparsed);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail, null, 2);
        setError(detail || err.message);
      } else {
        setError(err instanceof Error ? err.message : "OCR検証の実行に失敗しました");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveGroundTruth() {
    const parsingResultId = selectedGroundTruthParsingResultId;
    if (!parsingResultId) return;

    setIsSavingGroundTruth(true);
    setError(null);
    setGroundTruthMessage(null);
    try {
      const sourceTypeGroundTruth =
        sourceTypeGroundTruthByParsingId[parsingResultId] ||
        (result?.result.ground_truth?.event_parsing_result_id === parsingResultId ? normalizeEditableSourceType(result.result.ground_truth.source_type) : "");
      const saved = await saveOCRTestGroundTruth(parsingResultId, {
        event_name: groundTruthForm.event_name.trim() || null,
        event_date: groundTruthForm.event_date || null,
        venue_name: groundTruthForm.venue_name.trim() || null,
        source_type: sourceTypeGroundTruth || null,
      });
      setResult((current) =>
        current
          ? {
              ...current,
              result: {
                ...current.result,
                ground_truth: saved,
                parsed: {
                  ...current.result.parsed,
                  ground_truth: saved,
                },
              },
            }
          : current
      );
      setGroundTruthMessage("正解を保存しました");
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail, null, 2);
        setError(detail || err.message);
      } else {
        setError(err instanceof Error ? err.message : "正解の保存に失敗しました");
      }
    } finally {
      setIsSavingGroundTruth(false);
    }
  }

  async function handleSaveSourceTypeGroundTruth(parsingResultId: string) {
    if (!parsingResultId) return;

    setSavingSourceTypeGroundTruthId(parsingResultId);
    setError(null);
    setSourceTypeGroundTruthMessage(null);
    try {
      const saved = await saveOCRTestGroundTruth(parsingResultId, {
        event_name: groundTruthForm.event_name.trim() || null,
        event_date: groundTruthForm.event_date || null,
        venue_name: groundTruthForm.venue_name.trim() || null,
        source_type: sourceTypeGroundTruthByParsingId[parsingResultId] || null,
      });
      setResult((current) =>
        current
          ? {
              ...current,
              result: {
                ...current.result,
                ground_truth: saved,
                parsed: {
                  ...current.result.parsed,
                  ground_truth: saved,
                },
              },
            }
          : current
      );
      setSourceTypeGroundTruthMessage("画像の source_type Ground Truth を保存しました");
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail, null, 2);
        setError(detail || err.message);
      } else {
        setError(err instanceof Error ? err.message : "source_type Ground Truth の保存に失敗しました");
      }
    } finally {
      setSavingSourceTypeGroundTruthId(null);
    }
  }

  async function handleSaveReview() {
    const sessionId = session?.id;
    if (!sessionId) return;

    setIsSavingReview(true);
    setError(null);
    setReviewMessage(null);
    try {
      const savedSession = await saveOCRUploadSessionReview(sessionId, {
        event_name: reviewForm.event_name.trim() || null,
        event_date: reviewForm.event_date || null,
        venue_name: reviewForm.venue_name.trim() || null,
      });
      setResult((current) =>
        current
          ? {
              ...current,
              result: {
                ...current.result,
                session: savedSession,
              },
            }
          : current
      );
      setReviewMessage("レビューを保存しました");
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail, null, 2);
        setError(detail || err.message);
      } else {
        setError(err instanceof Error ? err.message : "レビューの保存に失敗しました");
      }
    } finally {
      setIsSavingReview(false);
    }
  }

  async function handleSaveTimetableReview() {
    const sessionId = session?.id;
    if (!sessionId) return;

    setIsSavingTimetableReview(true);
    setError(null);
    setTimetableReviewMessage(null);
    try {
      const savedSession = await saveOCRUploadSessionTimetableReview(sessionId, {
        live_sessions: toReviewPayload(liveSessionRows),
        meet_and_greet_sessions: toReviewPayload(meetAndGreetRows),
      });
      setResult((current) =>
        current
          ? {
              ...current,
              result: {
                ...current.result,
                session: savedSession,
              },
            }
          : current
      );
      setTimetableReviewMessage("Timetableレビューを保存しました");
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail, null, 2);
        setError(detail || err.message);
      } else {
        setError(err instanceof Error ? err.message : "Timetableレビューの保存に失敗しました");
      }
    } finally {
      setIsSavingTimetableReview(false);
    }
  }

  async function handleRunVisionEvaluation(sessionItemId: string, modelName: "gpt-4o" | "gpt-5-mini" | "gpt-5") {
    const sessionId = session?.id;
    if (!sessionId) return;

    const key = `${sessionItemId}:${modelName}`;
    setRunningVisionEvaluationKey(key);
    setError(null);
    setVisionEvaluationMessage(null);
    try {
      const savedSession = await runOCRVisionEvaluation(sessionId, {
        session_item_id: sessionItemId,
        model_name: modelName,
      });
      setResult((current) =>
        current
          ? {
              ...current,
              result: {
                ...current.result,
                session: savedSession,
              },
            }
          : current
      );
      setVisionEvaluationMessage(`${modelName} のVision評価を保存しました`);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail, null, 2);
        setError(detail || err.message);
      } else {
        setError(err instanceof Error ? err.message : "Vision評価の実行に失敗しました");
      }
    } finally {
      setRunningVisionEvaluationKey(null);
    }
  }

  async function handleUpdateVisionScore(runId: string, value: string) {
    const humanScore = value ? Number(value) : null;
    setSavingVisionScoreRunId(runId);
    setError(null);
    try {
      const updated = await updateOCRVisionEvaluationHumanScore(runId, humanScore);
      setResult((current) => {
        if (!current?.result.session) return current;
        return {
          ...current,
          result: {
            ...current.result,
            session: {
              ...current.result.session,
              vision_evaluation_runs: current.result.session.vision_evaluation_runs.map((run) =>
                run.id === updated.id ? updated : run
              ),
            },
          },
        };
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail, null, 2);
        setError(detail || err.message);
      } else {
        setError(err instanceof Error ? err.message : "Human Score の保存に失敗しました");
      }
    } finally {
      setSavingVisionScoreRunId(null);
    }
  }

  async function handleConfirmEventCore() {
    const sessionId = session?.id;
    if (!sessionId) return;

    setIsConfirmingEventCore(true);
    setError(null);
    setReviewMessage(null);
    try {
      const payload: OCRUploadSessionConfirmEventCorePayload =
        confirmMode === "link_existing"
          ? {
              mode: "link_existing",
              event_core_id: selectedEventCoreCandidateId ?? undefined,
            }
          : {
              mode: "create_new",
              event_name: reviewForm.event_name.trim() || null,
              event_date: reviewForm.event_date || null,
              venue_name: reviewForm.venue_name.trim() || null,
            };
      const savedSession = await confirmOCRUploadSessionEventCore(sessionId, payload);
      setResult((current) =>
        current
          ? {
              ...current,
              result: {
                ...current.result,
                session: savedSession,
                event_id: savedSession.event_core_id,
              },
            }
          : current
      );
      setReviewMessage(confirmMode === "link_existing" ? "既存 Event Core に紐付けました" : "新規 Event Core を作成しました");
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail, null, 2);
        setError(detail || err.message);
      } else {
        setError(err instanceof Error ? err.message : "Event Core 確定に失敗しました");
      }
    } finally {
      setIsConfirmingEventCore(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Admin OCR Test" subtitle="NDLOCR → session 集約 → Event Core 解決の精度を管理画面で確認します。" backHref="/admin" />

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon size={18} className="text-[var(--muted)]" />
          <h2 className="text-base font-semibold">画像アップロード</h2>
        </div>
        <Input type="file" accept={ACCEPT} multiple onChange={(event) => handleFilesSelected(event.currentTarget.files)} />
        <div className="rounded-md border border-dashed border-[var(--border)] bg-white p-3 text-sm text-[var(--muted)]">
          {selectedFiles.length
            ? `${selectedFiles.length}枚選択中 / ${selectedFiles.map((file) => `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`).join(" / ")}`
            : "画像を最大4枚まで選択してください"}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={ignoreCache}
            onChange={(event) => setIgnoreCache(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Ignore Cache
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(event) => setDryRun(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Dry Run
        </label>
        <Button onClick={handleSubmit} disabled={selectedFiles.length === 0 || isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}
          {isSubmitting ? "検証実行中..." : "OCR検証を実行"}
        </Button>
        {error ? (
          <div className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">{error}</div>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-base font-semibold">1. Upload Images</h2>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="OCR test upload preview" className="max-h-[420px] w-full rounded-md border object-contain" />
          ) : (
            <div className="rounded-md border border-dashed border-[var(--border)] p-8 text-sm text-[var(--muted)]">プレビューはここに表示されます</div>
          )}
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900">
                    {index + 1}. {file.name}
                  </span>
                  <span className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3">
          <CardHeader
            title="Supplemental: Processing Metadata"
            copyText={JSON.stringify(
              {
                phash: primaryAsset?.phash ?? null,
                reused_existing_raw_input: primaryAsset?.reused_existing_raw_input ?? null,
                ignore_cache: primaryAsset?.ignore_cache ?? ignoreCache,
                dry_run: result?.result.dry_run ?? dryRun,
                processing_time_ms: result?.result.processing_time_ms ?? null,
              },
              null,
              2
            )}
          />
          <JsonView
            value={{
              phash: primaryAsset?.phash ?? null,
              reused_existing_raw_input: primaryAsset?.reused_existing_raw_input ?? null,
              ignore_cache: primaryAsset?.ignore_cache ?? ignoreCache,
              dry_run: result?.result.dry_run ?? dryRun,
              processing_time_ms: result?.result.processing_time_ms ?? null,
            }}
          />
        </Card>

        <Card className="space-y-3 lg:col-span-2">
          <CardHeader title="2. OCR Result" copyText={result?.result.parsed.raw_text ?? ""} />
          <Textarea readOnly value={result?.result.parsed.raw_text ?? ""} placeholder="raw_text がここに表示されます" className="min-h-[260px] font-mono text-xs leading-6" />
        </Card>

        <Card className="space-y-3">
          <CardHeader title="2-2. OCR Lines" copyText={JSON.stringify(lines, null, 2)} />
          <JsonView value={lines} />
        </Card>

        <Card className="space-y-3">
          <CardHeader
            title="2-3. Structured OCR Result"
            copyText={JSON.stringify(
              {
                event_name: llmExtraction?.event_name ?? extracted?.display_name ?? null,
                event_date: llmExtraction?.event_date ?? extracted?.event_date ?? null,
                venue_name: llmExtraction?.venue_name ?? extracted?.venue_name ?? null,
                source_type: displaySourceType(llmExtraction?.source_type ?? extracted?.source_type ?? null),
              },
              null,
              2
            )}
          />
          <JsonView
            value={{
              event_name: llmExtraction?.event_name ?? extracted?.display_name ?? null,
              event_date: llmExtraction?.event_date ?? extracted?.event_date ?? null,
              venue_name: llmExtraction?.venue_name ?? extracted?.venue_name ?? null,
              source_type: displaySourceType(llmExtraction?.source_type ?? extracted?.source_type ?? null),
            }}
          />
        </Card>

        <Card className="space-y-3 lg:col-span-2">
          <CardHeader title="3. Image Candidates" copyText={JSON.stringify(result?.result.assets ?? [], null, 2)} />
          <div className="space-y-4">
            {result?.result.assets?.length ? (
              result.result.assets.map((item, index) => {
                const sourceTypeAudit = item.parsed?.source_type_audit as SourceTypeAudit | null | undefined;
                const parsingResultId = item.parsing_result_id ?? "";
                const sourceTypeGroundTruth = parsingResultId ? sourceTypeGroundTruthByParsingId[parsingResultId] ?? "" : "";
                return (
                <div key={item.asset_id} className="rounded-lg border border-[var(--border)] bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">画像 {index + 1}</p>
                      <p className="text-xs text-slate-500">{item.image_path}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>
                        source_type: <span className="font-mono text-slate-800">{displaySourceType(item.source_type)}</span>
                      </div>
                      <div>
                        confidence: <span className="font-mono text-slate-800">{item.confidence ?? "-"}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`mb-4 rounded-lg border bg-slate-50 p-3 ${sourceTypeAudit?.conflict ? "border-red-200 ring-2 ring-red-100" : "border-[var(--border)]"}`}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">source_type Ground Truth</p>
                        <p className="text-xs text-slate-500">source_type は画像単位です。Event Ground Truth とは分けて確認します。</p>
                      </div>
                      {sourceTypeAudit?.conflict ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">LLM ≠ Rule</span> : null}
                    </div>
                    <div className="grid gap-3 lg:grid-cols-4">
                      <div className="rounded-md border border-[var(--border)] bg-white px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">LLM source_type</p>
                        <p className="mt-1 font-mono text-sm font-semibold text-indigo-700">{displaySourceType(sourceTypeAudit?.llm_source_type ?? item.parsed?.llm_extraction?.source_type ?? item.source_type)}</p>
                      </div>
                      <div className="rounded-md border border-[var(--border)] bg-white px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Rule source_type</p>
                        <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{displaySourceType(sourceTypeAudit?.rule_source_type)}</p>
                        {sourceTypeAudit ? <p className="text-xs text-slate-500">confidence: {sourceTypeAudit.rule_confidence.toFixed(3)}</p> : null}
                      </div>
                      <label className="space-y-1 text-sm text-slate-700 lg:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ground Truth source_type</span>
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={sourceTypeGroundTruth}
                            disabled={!parsingResultId}
                            onChange={(event) =>
                              setSourceTypeGroundTruthByParsingId((current) => ({
                                ...current,
                                [parsingResultId]: event.target.value as OCRTestSourceType | "",
                              }))
                            }
                            className="h-11 min-w-[220px] flex-1 rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none ring-[var(--ring)] focus:ring-2 disabled:bg-slate-100"
                          >
                            <option value="">未設定</option>
                            {SOURCE_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            onClick={() => handleSaveSourceTypeGroundTruth(parsingResultId)}
                            disabled={!parsingResultId || savingSourceTypeGroundTruthId === parsingResultId}
                            className="bg-slate-900 text-white"
                          >
                            {savingSourceTypeGroundTruthId === parsingResultId ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                            保存
                          </Button>
                        </div>
                      </label>
                    </div>
                    <div className="mt-3">
                      <SourceTypeAuditView value={sourceTypeAudit} />
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">OCR</p>
                      <Textarea readOnly value={item.ocr_text ?? ""} className="min-h-[180px] font-mono text-xs leading-6" />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">structured_data</p>
                        <JsonView value={item.structured_data ?? {}} />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">event_candidates</p>
                        <JsonView value={item.event_candidates ?? []} />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">live_sessions</p>
                        <JsonView value={item.live_sessions ?? []} />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">meet_and_greet_sessions</p>
                        <JsonView value={item.meet_and_greet_sessions ?? []} />
                      </div>
                    </div>
                  </div>
                </div>
                );
              })
            ) : (
              <p className="text-sm text-[var(--muted)]">まだ結果がありません。</p>
            )}
          </div>
          {sourceTypeGroundTruthMessage ? <p className="text-sm text-emerald-700">{sourceTypeGroundTruthMessage}</p> : null}
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">4. Vision Evaluation</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                同じ画像に対して GPT-4o / GPT-5-mini / GPT-5 を再実行し、精度・速度・トークン数・コストを比較します。
              </p>
            </div>
            {visionEvaluationMessage ? <p className="text-sm text-emerald-700">{visionEvaluationMessage}</p> : null}
          </div>

          <div className="space-y-3">
            {session?.items?.length ? (
              session.items.map((item, index) => (
                <div key={item.id} className="rounded-lg border border-[var(--border)] bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">画像 {index + 1}</p>
                      <p className="font-mono text-xs text-slate-500">session_item_id: {item.id}</p>
                      <p className="font-mono text-xs text-slate-500">image_id: {item.image_id ?? "-"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {VISION_EVALUATION_MODELS.map((modelName) => {
                        const key = `${item.id}:${modelName}`;
                        return (
                          <Button
                            key={modelName}
                            onClick={() => handleRunVisionEvaluation(item.id, modelName)}
                            disabled={runningVisionEvaluationKey !== null}
                            className="bg-slate-900 text-white"
                          >
                            {runningVisionEvaluationKey === key ? <Loader2 size={15} className="animate-spin" /> : <ScanSearch size={15} />}
                            Run {modelName}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">評価対象のUpload Session Itemがまだありません。</p>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-white">
            <table className="min-w-full divide-y divide-[var(--border)] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">model</th>
                  <th className="px-3 py-2">image</th>
                  <th className="px-3 py-2">latency</th>
                  <th className="px-3 py-2">tokens</th>
                  <th className="px-3 py-2">cost</th>
                  <th className="px-3 py-2">live</th>
                  <th className="px-3 py-2">meet</th>
                  <th className="px-3 py-2">called</th>
                  <th className="px-3 py-2">human_score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {session?.vision_evaluation_runs?.length ? (
                  session.vision_evaluation_runs.map((run) => (
                    <tr key={run.id}>
                      <td className="px-3 py-2 font-mono font-semibold text-slate-900">{run.model_name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{run.image_id ?? run.session_item_id ?? "-"}</td>
                      <td className="px-3 py-2">{run.latency_ms ?? "-"} ms</td>
                      <td className="px-3 py-2">{run.total_tokens ?? "-"}</td>
                      <td className="px-3 py-2">{run.estimated_cost != null ? `$${run.estimated_cost.toFixed(6)}` : "-"}</td>
                      <td className="px-3 py-2">{run.live_session_count}</td>
                      <td className="px-3 py-2">{run.meet_and_greet_count}</td>
                      <td className="px-3 py-2">{run.vision_called ? "yes" : "no"}</td>
                      <td className="px-3 py-2">
                        <select
                          value={run.human_score ?? ""}
                          disabled={savingVisionScoreRunId === run.id}
                          onChange={(event) => handleUpdateVisionScore(run.id, event.target.value)}
                          className="h-9 rounded-md border border-[var(--border)] bg-white px-2 text-sm outline-none ring-[var(--ring)] focus:ring-2"
                        >
                          <option value="">未評価</option>
                          {[1, 2, 3, 4, 5].map((score) => (
                            <option key={score} value={score}>
                              {score}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-sm text-[var(--muted)]">
                      Vision評価runはまだありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-[var(--border)] bg-slate-50 p-4">
              <CardHeader title="Vision Evaluation Output JSON" copyText={JSON.stringify(session?.vision_evaluation_runs ?? [], null, 2)} />
              <JsonView value={session?.vision_evaluation_runs ?? []} />
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-slate-50 p-4">
              <CardHeader
                title="Vision Routing Logs"
                copyText={JSON.stringify(
                  (session?.vision_evaluation_runs ?? []).map((run) => ({
                    model_name: run.model_name,
                    vision_called: run.vision_called,
                    vision_live_session_count: run.live_session_count,
                    vision_meet_and_greet_count: run.meet_and_greet_count,
                  })),
                  null,
                  2
                )}
              />
              <JsonView
                value={(session?.vision_evaluation_runs ?? []).map((run) => ({
                  model_name: run.model_name,
                  vision_called: run.vision_called,
                  vision_live_session_count: run.live_session_count,
                  vision_meet_and_greet_count: run.meet_and_greet_count,
                }))}
              />
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <CardHeader title="5. Session Aggregation" copyText={JSON.stringify(sessionAggregation, null, 2)} />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">event_candidates</p>
            {aggregatedEventCandidates.length ? (
              <div className="space-y-2">
                {aggregatedEventCandidates.map((candidate, index) => (
                  <div key={`${candidate.event_name ?? "candidate"}-${index}`} className="rounded-md border border-[var(--border)] bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{candidate.event_name ?? "-"}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">#{index + 1}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {candidate.event_date ?? "-"} / {candidate.venue_name ?? "-"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      source_type: {displaySourceType(candidate.source_type)} / confidence: {candidate.confidence}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-[var(--border)] bg-white p-3 text-sm text-[var(--muted)]">event_candidates はまだありません。</p>
            )}
          </div>
          <JsonView value={sessionAggregation} />
        </Card>

        <Card className="space-y-3">
          <CardHeader title="5-1. Canonical Event Candidate" copyText={JSON.stringify(canonicalEventCandidate ?? null, null, 2)} />
          <JsonView value={canonicalEventCandidate ?? null} />
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">6. Event Ground Truth</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">イベント単位の正解です。source_type は画像単位のため Image Candidates 側で管理します。</p>
            </div>
            {result?.result.ground_truth ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">保存済み</span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">未保存</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">event_name</span>
              <Input value={groundTruthForm.event_name} onChange={(event) => setGroundTruthForm((current) => ({ ...current, event_name: event.target.value }))} placeholder="実際のイベント名" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">event_date</span>
              <Input type="date" value={groundTruthForm.event_date} onChange={(event) => setGroundTruthForm((current) => ({ ...current, event_date: event.target.value }))} />
            </label>
            <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">venue_name</span>
              <Input value={groundTruthForm.venue_name} onChange={(event) => setGroundTruthForm((current) => ({ ...current, venue_name: event.target.value }))} placeholder="実際の会場名" />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSaveGroundTruth} disabled={!selectedGroundTruthParsingResultId || isSavingGroundTruth} className="w-full sm:w-auto">
              {isSavingGroundTruth ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {isSavingGroundTruth ? "保存中..." : "Event Ground Truth を保存"}
            </Button>
            {groundTruthMessage ? <p className="text-sm text-emerald-700">{groundTruthMessage}</p> : null}
          </div>
        </Card>

        <Card className="space-y-3 lg:col-span-2">
          <CardHeader
            title="7. Event Core Resolver"
            copyText={JSON.stringify(
              {
                canonical_event_candidate: canonicalEventCandidate ?? null,
                event_core_candidates: eventCoreResolution?.event_core_candidates ?? [],
                selected_event_core_candidate: selectedEventCoreCandidate ?? null,
              },
              null,
              2
            )}
          />
          <div className="space-y-3">
            {eventCoreResolution?.event_core_candidates?.length ? (
              eventCoreResolution.event_core_candidates.map((candidate) => {
                const isSelected = candidate.event_core_id === selectedEventCoreCandidateId;
                return (
                  <div key={candidate.event_core_id} className={`rounded-lg border bg-white p-4 ${isSelected ? "border-indigo-400 ring-2 ring-indigo-100" : "border-[var(--border)]"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{candidate.event_name}</p>
                          {isSelected ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">選択中</span> : null}
                        </div>
                        <p className="text-sm text-slate-600">
                          {candidate.event_date} / {candidate.venue_name ?? "-"}
                        </p>
                        <p className="text-xs text-slate-500">score: {candidate.match_score.toFixed(3)}</p>
                        <p className="text-xs text-slate-500">{candidate.match_reasons.join(", ") || "理由なし"}</p>
                      </div>
                      <Button
                        className={isSelected ? "bg-indigo-600 text-white" : "bg-[var(--foreground)] text-white"}
                        onClick={() => {
                          setSelectedEventCoreCandidateId(candidate.event_core_id);
                          setConfirmMode("link_existing");
                        }}
                      >
                        {isSelected ? "選択済み" : "この候補を使う"}
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-[var(--muted)]">Event Core 候補はまだありません。新規作成で進められます。</p>
            )}
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">選択中のEvent Core候補</p>
            <JsonView value={selectedEventCoreCandidate ?? null} />
          </div>
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">8. Human Review</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">AI抽出結果を直接上書きせず、修正履歴を revision として残します。</p>
            </div>
            {session?.revisions?.length ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">revision {session.revisions[session.revisions.length - 1]?.revision ?? 0}</span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">revision なし</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">event_name</span>
              <Input value={reviewForm.event_name} onChange={(event) => setReviewForm((current) => ({ ...current, event_name: event.target.value }))} placeholder="修正後のイベント名" />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">event_date</span>
              <Input type="date" value={reviewForm.event_date} onChange={(event) => setReviewForm((current) => ({ ...current, event_date: event.target.value }))} />
            </label>
            <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">venue_name</span>
              <Input value={reviewForm.venue_name} onChange={(event) => setReviewForm((current) => ({ ...current, venue_name: event.target.value }))} placeholder="修正後の会場名" />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSaveReview} disabled={!session?.id || isSavingReview} className="w-full sm:w-auto">
              {isSavingReview ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {isSavingReview ? "保存中..." : "修正内容を保存"}
            </Button>
            {reviewMessage ? <p className="text-sm text-emerald-700">{reviewMessage}</p> : null}
          </div>
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">9. Timetable Human Review</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Vision Structure Extraction の結果を確認し、live_sessions / meet_and_greet_sessions を追加・編集・削除・複製・並び替えできます。
              </p>
            </div>
            {session?.timetable_review?.latest_revision ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                revision {session.timetable_review.latest_revision.revision}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">未レビュー</span>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <TimetableReviewEditor title="live_sessions" itemKind="live" items={liveSessionRows} onChange={setLiveSessionRows} />
            <TimetableReviewEditor title="meet_and_greet_sessions" itemKind="meet_and_greet" items={meetAndGreetRows} onChange={setMeetAndGreetRows} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-[var(--border)] bg-slate-50 p-4">
              <CardHeader title="Vision Structure Extraction" copyText={JSON.stringify(session?.vision_structure_extractions ?? [], null, 2)} />
              <JsonView value={session?.vision_structure_extractions ?? []} />
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-slate-50 p-4">
              <CardHeader title="Timetable Revision history" copyText={JSON.stringify(session?.timetable_review?.revisions ?? [], null, 2)} />
              <JsonView value={session?.timetable_review?.revisions ?? []} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSaveTimetableReview} disabled={!session?.id || isSavingTimetableReview} className="w-full sm:w-auto">
              {isSavingTimetableReview ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {isSavingTimetableReview ? "保存中..." : "Timetableレビューを保存"}
            </Button>
            {timetableReviewMessage ? <p className="text-sm text-emerald-700">{timetableReviewMessage}</p> : null}
          </div>
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">10. Event Core確定</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">既存の Event Core に紐付けるか、新規作成して確定します。</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setConfirmMode("create_new")}
                className={`rounded-full px-3 py-1 ${confirmMode === "create_new" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                新規 Event Core作成
              </button>
              <button
                type="button"
                onClick={() => setConfirmMode("link_existing")}
                className={`rounded-full px-3 py-1 ${confirmMode === "link_existing" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                既存 Event Coreに紐付け
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">確定対象</p>
            <JsonView value={canonicalEventCandidate ?? null} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleConfirmEventCore}
              disabled={
                isConfirmingEventCore ||
                (confirmMode === "link_existing" && !selectedEventCoreCandidateId) ||
                (confirmMode === "create_new" && (!reviewForm.event_name || !reviewForm.event_date || !reviewForm.venue_name))
              }
              className="w-full sm:w-auto"
            >
              {isConfirmingEventCore ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {isConfirmingEventCore ? "確定中..." : "Event Core を確定"}
            </Button>
            <p className="text-sm text-[var(--muted)]">AI結果は保持され、修正と確定の履歴が revision として積み上がります。</p>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Revision history</p>
            <JsonView value={session?.revisions ?? []} />
          </div>
        </Card>

        <Card className="space-y-3">
          <CardHeader
            title="Supplemental: Legacy Event Core Search Result"
            copyText={JSON.stringify(
              resolution?.duplicate_candidates?.length ? { ...eventCoreSearchResult, duplicate_candidates: resolution.duplicate_candidates } : eventCoreSearchResult,
              null,
              2
            )}
          />
          <JsonView value={eventCoreSearchResult} />
          {resolution?.duplicate_candidates?.length ? <JsonView value={resolution.duplicate_candidates} /> : null}
        </Card>

        <Card className="space-y-3">
          <CardHeader title="Supplemental: Legacy Creation Result" copyText={JSON.stringify(creationResult, null, 2)} />
          <JsonView value={creationResult} />
        </Card>

        <Card className="space-y-3">
          <CardHeader
            title="Supplemental: Debug Info"
            copyText={JSON.stringify(
              {
                source_id: result?.source.id ?? null,
                event_id: result?.result.event_id ?? null,
                session_id: result?.result.session_id ?? null,
                raw_input_ids: result?.result.raw_input_ids ?? [],
                parsing_result_id: result?.result.parsing_result_id ?? null,
                parsing_result_ids: result?.result.parsing_result_ids ?? [],
                dry_run: result?.result.dry_run ?? false,
              },
              null,
              2
            )}
          />
          <JsonView
            value={{
              source_id: result?.source.id ?? null,
              event_id: result?.result.event_id ?? null,
              session_id: result?.result.session_id ?? null,
              raw_input_ids: result?.result.raw_input_ids ?? [],
              parsing_result_id: result?.result.parsing_result_id ?? null,
              parsing_result_ids: result?.result.parsing_result_ids ?? [],
              dry_run: result?.result.dry_run ?? false,
            }}
          />
        </Card>

        <Card className="space-y-3 lg:col-span-2">
          <CardHeader title="NDLOCR JSON" copyText={JSON.stringify(primaryAsset?.parsed?.canonical_document ?? primaryAsset?.parsed ?? [], null, 2)} />
          <p className="text-sm text-[var(--muted)]">`true` が OCR本文なのか JSON の補助情報なのかを確認するための生出力です。</p>
          <JsonView value={primaryAsset?.parsed?.canonical_document ?? primaryAsset?.parsed ?? []} />
        </Card>
      </div>
    </div>
  );
}
