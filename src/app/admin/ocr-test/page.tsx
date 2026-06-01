"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCopy, ImageIcon, Loader2, ScanSearch } from "lucide-react";
import { ApiError } from "@/api/client";
import {
  confirmOCRUploadSessionEventCore,
  saveOCRUploadSessionReview,
  reparseSourceForOCRTest,
  saveOCRTestGroundTruth,
  uploadSourceForOCRTest,
  type OCRTestSourceType,
  type OCRTestWorkflowResponse,
  type OCRUploadSessionConfirmEventCorePayload,
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
  { value: "schedule_document", label: "schedule_document" },
  { value: "x_post", label: "x_post" },
  { value: "other", label: "other" },
];

interface GroundTruthFormState {
  event_name: string;
  event_date: string;
  venue_name: string;
  source_type: OCRTestSourceType | "";
}

interface ReviewFormState {
  event_name: string;
  event_date: string;
  venue_name: string;
}

function createEmptyGroundTruthForm(): GroundTruthFormState {
  return {
    event_name: "",
    event_date: "",
    venue_name: "",
    source_type: "",
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
  if (value === "timetable" || value === "meet_and_greet") return "schedule_document";
  if (value === "flyer" || value === "schedule_document" || value === "x_post" || value === "other") return value;
  return "";
}

function displaySourceType(value: string | null | undefined): string {
  return normalizeSourceType(value) || value || "-";
}

function buildGroundTruthForm(result: OCRTestWorkflowResponse | null): GroundTruthFormState {
  const groundTruth = result?.result.ground_truth;
  const llmExtraction = result?.result.parsed.llm_extraction;
  const extracted = result?.result.parsed.event;
  return {
    event_name: groundTruth?.event_name ?? llmExtraction?.event_name ?? extracted?.display_name ?? "",
    event_date: groundTruth?.event_date ?? llmExtraction?.event_date ?? extracted?.event_date ?? "",
    venue_name: groundTruth?.venue_name ?? llmExtraction?.venue_name ?? extracted?.venue_name ?? "",
    source_type: normalizeSourceType(groundTruth?.source_type ?? llmExtraction?.source_type ?? extracted?.source_type),
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

export default function AdminOCRTestPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<OCRTestWorkflowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ignoreCache, setIgnoreCache] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [groundTruthForm, setGroundTruthForm] = useState<GroundTruthFormState>(createEmptyGroundTruthForm());
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(createEmptyReviewForm());
  const [selectedEventCoreCandidateId, setSelectedEventCoreCandidateId] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<"create_new" | "link_existing">("create_new");
  const [isSavingGroundTruth, setIsSavingGroundTruth] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isConfirmingEventCore, setIsConfirmingEventCore] = useState(false);
  const [groundTruthMessage, setGroundTruthMessage] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const primaryFile = selectedFiles[0] ?? null;
  const primaryAsset = result?.result.assets[0] ?? null;
  const session = result?.result.session ?? null;
  const sessionDecision = session?.decision ?? session?.canonical_event_candidate ?? result?.result.parsed.session?.canonical_event_candidate ?? null;
  const eventCoreResolution = session?.event_core_resolution ?? result?.result.parsed.session?.event_core_resolution ?? null;
  const canonicalEventCandidate = eventCoreResolution?.canonical_event_candidate ?? sessionDecision ?? null;
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
    setReviewForm(result ? buildReviewForm(result) : createEmptyReviewForm());
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
    setGroundTruthMessage(null);
  }

  async function handleSubmit() {
    if (selectedFiles.length === 0) return;

    setIsSubmitting(true);
    setError(null);
    setResult(null);
    setGroundTruthMessage(null);
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
      const saved = await saveOCRTestGroundTruth(parsingResultId, {
        event_name: groundTruthForm.event_name.trim() || null,
        event_date: groundTruthForm.event_date || null,
        venue_name: groundTruthForm.venue_name.trim() || null,
        source_type: groundTruthForm.source_type || null,
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
          <h2 className="text-base font-semibold">1. アップロード画像</h2>
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
            title="2. pHash / 処理時間"
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
          <CardHeader title="3. OCR結果" copyText={result?.result.parsed.raw_text ?? ""} />
          <Textarea readOnly value={result?.result.parsed.raw_text ?? ""} placeholder="raw_text がここに表示されます" className="min-h-[260px] font-mono text-xs leading-6" />
        </Card>

        <Card className="space-y-3">
          <CardHeader title="3-1. OCR行一覧" copyText={JSON.stringify(lines, null, 2)} />
          <JsonView value={lines} />
        </Card>

        <Card className="space-y-3">
          <CardHeader
            title="4. LLM抽出結果"
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

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">4-1. 正解入力</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">LLM抽出結果を修正して保存します。保存先は正規化テーブルです。</p>
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
            <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">source_type</span>
              <select
                value={groundTruthForm.source_type}
                onChange={(event) =>
                  setGroundTruthForm((current) => ({
                    ...current,
                    source_type: event.target.value as OCRTestSourceType | "",
                  }))
                }
                className="h-11 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none ring-[var(--ring)] focus:ring-2"
              >
                <option value="">未設定</option>
                {SOURCE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSaveGroundTruth} disabled={!selectedGroundTruthParsingResultId || isSavingGroundTruth} className="w-full sm:w-auto">
              {isSavingGroundTruth ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {isSavingGroundTruth ? "保存中..." : "正解を保存"}
            </Button>
            {groundTruthMessage ? <p className="text-sm text-emerald-700">{groundTruthMessage}</p> : null}
          </div>
        </Card>

        <Card className={`space-y-3 lg:col-span-2 ${primaryAsset?.parsed?.source_type_audit?.conflict ? "ring-2 ring-red-300" : ""}`}>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">4.5. source_type 判定比較</h2>
            {primaryAsset?.parsed?.source_type_audit?.conflict && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">LLM ≠ Rule</span>}
          </div>
          <SourceTypeAuditView value={primaryAsset?.parsed?.source_type_audit} />
        </Card>

        <Card className="space-y-3 lg:col-span-2">
          <CardHeader title="5. 画像ごとの OCR / event candidates" copyText={JSON.stringify(result?.result.assets ?? [], null, 2)} />
          <div className="space-y-4">
            {result?.result.assets?.length ? (
              result.result.assets.map((item, index) => (
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
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">まだ結果がありません。</p>
            )}
          </div>
        </Card>

        <Card className="space-y-3">
          <CardHeader title="6. セッション集約候補" copyText={JSON.stringify(session?.aggregation ?? result?.result.parsed.session ?? null, null, 2)} />
          <JsonView value={session?.aggregation ?? result?.result.parsed.session ?? null} />
        </Card>

        <Card className="space-y-3">
          <CardHeader title="7. Canonical Event Candidate" copyText={JSON.stringify(canonicalEventCandidate ?? null, null, 2)} />
          <JsonView value={canonicalEventCandidate ?? null} />
        </Card>

        <Card className="space-y-3 lg:col-span-2">
          <CardHeader
            title="8. Event Core候補一覧"
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
              <h2 className="text-base font-semibold">9. Human Review</h2>
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
            title="11. Event Core検索結果"
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
          <CardHeader title="12. 作成結果" copyText={JSON.stringify(creationResult, null, 2)} />
          <JsonView value={creationResult} />
        </Card>

        <Card className="space-y-3">
          <CardHeader
            title="補足"
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
