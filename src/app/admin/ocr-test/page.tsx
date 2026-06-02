"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCopy, ImageIcon, Loader2, ScanSearch } from "lucide-react";
import { ApiError } from "@/api/client";
import {
  createEventCandidateReview,
  getOCRReparseJob,
  startOCRReparseJob,
  uploadSourceForOCRTest,
  type EventCandidateReviewRead,
  type OCREvaluationEventAggregateCandidate,
  type OCRTestWorkflowResponse,
} from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
const MAX_UPLOAD_FILES = 4;
const REPARSE_JOB_POLL_INTERVAL_MS = 1500;

type SourceImagePreview = {
  filename: string;
  source_kind: string;
  region_kinds: string[];
  image_data_url?: string;
  image_features: Record<string, unknown> | null;
};

type ProcessingStepKey = "upload" | "ocr" | "aggregation" | "candidate";

const PROCESSING_STEPS: Array<{ key: ProcessingStepKey; label: string; description: string }> = [
  { key: "upload", label: "画像保存", description: "ローカル保存とSource作成" },
  { key: "ocr", label: "OCR実行", description: "NDLOCR / 画像ごとの構造化" },
  { key: "aggregation", label: "Session集約", description: "Upload Session単位の候補集約" },
  { key: "candidate", label: "Review候補準備", description: "Ground Truthレビュー用候補の作成" },
];

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

function formatMs(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString()} ms`;
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[520px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function pickCanonicalCandidate(result: OCRTestWorkflowResponse | null) {
  const session = result?.result.session ?? result?.result.parsed.session ?? null;
  return (
    result?.result.parsed.session_event_candidate ??
    session?.event_core_resolution?.canonical_event_candidate ??
    session?.canonical_event_candidate ??
    session?.decision ??
    session?.aggregation?.canonical_event_candidate ??
    null
  );
}

function buildEventAggregateCandidate(result: OCRTestWorkflowResponse | null): OCREvaluationEventAggregateCandidate | null {
  if (!result) return null;
  const canonical = pickCanonicalCandidate(result);
  if (canonical) {
    return {
      candidate_type: "event_aggregate",
      event_name: canonical.event_name,
      event_date: canonical.event_date,
      venue_name: canonical.venue_name,
      open_time: null,
      start_time: null,
      group_candidates: [],
      source_event_info_candidate_ids: [],
      source_performer_association_ids: [],
      source_region_ids: canonical.source_asset_ids ?? [],
      source_node_ids: canonical.parsing_result_ids ?? [],
      confidence: canonical.confidence ?? 0,
      reasons: canonical.reasons ?? [],
      source_asset_ids: canonical.source_asset_ids ?? [],
      parsing_result_ids: canonical.parsing_result_ids ?? [],
      source_type: canonical.source_type ?? null,
      candidate_generation_method: canonical.candidate_generation_method ?? null,
      candidate_model: canonical.candidate_model ?? null,
      candidate_version: canonical.candidate_version ?? null,
    };
  }

  const session = getSession(result);
  const parsedEvent = result.result.parsed.event;
  const llmExtraction = result.result.parsed.llm_extraction;

  return {
    candidate_type: "event_aggregate",
    event_name: session?.event_name ?? parsedEvent?.display_name ?? llmExtraction?.event_name ?? null,
    event_date: session?.event_date ?? parsedEvent?.event_date ?? llmExtraction?.event_date ?? null,
    venue_name: session?.venue_name ?? parsedEvent?.venue_name ?? llmExtraction?.venue_name ?? null,
    open_time: null,
    start_time: null,
    group_candidates: [],
    source_event_info_candidate_ids: [],
    source_performer_association_ids: [],
    source_region_ids: result.result.assets
      .map((asset) => asset.source_asset_id ?? asset.asset_id)
      .filter((id): id is string => Boolean(id)),
    source_node_ids: result.result.parsing_result_ids ?? [],
    confidence: 0,
    reasons: [
      "canonical_event_candidate_not_generated",
      "manual_ground_truth_review_required",
    ],
  };
}

function buildOcrOutput(candidate: OCREvaluationEventAggregateCandidate | null): Record<string, unknown> {
  return {
    event_name: candidate?.event_name ?? null,
    event_date: candidate?.event_date ?? null,
    venue_name: candidate?.venue_name ?? null,
    open_time: candidate?.open_time ?? null,
    start_time: candidate?.start_time ?? null,
    group_candidates: candidate?.group_candidates ?? [],
  };
}

function buildReviewPrefill(candidate: OCREvaluationEventAggregateCandidate | null) {
  return {
    event_name: candidate?.event_name ?? null,
    event_date: candidate?.event_date ?? null,
    venue_name: candidate?.venue_name ?? null,
    open_time: candidate?.open_time ?? null,
    start_time: candidate?.start_time ?? null,
    group_candidates: candidate?.group_candidates ?? [],
  };
}

function getSession(result: OCRTestWorkflowResponse | null) {
  return result?.result.session ?? result?.result.parsed.session ?? null;
}

export default function AdminOCRTestPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [ignoreCache, setIgnoreCache] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<OCRTestWorkflowResponse | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [currentStep, setCurrentStep] = useState<ProcessingStepKey | "idle" | "done" | "failed">("idle");
  const [completedSteps, setCompletedSteps] = useState<ProcessingStepKey[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");
  const [draftReview, setDraftReview] = useState<EventCandidateReviewRead | null>(null);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  useEffect(() => {
    if (!isProcessing || !startedAt) return;
    const timerId = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 500);
    return () => window.clearInterval(timerId);
  }, [isProcessing, startedAt]);

  const session = getSession(result);
  const canonicalCandidate = pickCanonicalCandidate(result);
  const reviewCandidate = useMemo(() => buildEventAggregateCandidate(result), [result]);
  const isManualReviewCandidate = reviewCandidate?.reasons.includes("manual_ground_truth_review_required") ?? false;
  const ocrOutput = useMemo(() => buildOcrOutput(reviewCandidate), [reviewCandidate]);

  const sourceImages = useMemo<SourceImagePreview[]>(() => {
    const assets = result?.result.assets ?? [];
    return files.map((file, index) => ({
      filename: file.name,
      source_kind: "upload_session_image",
      region_kinds: assets[index]?.source_type ? [assets[index].source_type] : [],
      image_data_url: undefined,
      image_features: assets[index]?.image_features ?? null,
    }));
  }, [files, result]);

  const rawText = useMemo(() => {
    const assetTexts = result?.result.assets?.map((asset) => asset.ocr_text).filter(Boolean) ?? [];
    if (assetTexts.length) return assetTexts.join("\n\n---\n\n");
    return result?.result.parsed.raw_text ?? "";
  }, [result]);

  function handleFileChange(selectedFiles: FileList | null) {
    const nextFiles = Array.from(selectedFiles ?? []);
    setResult(null);
    setErrorMessage(null);
    setStatusMessage("");
    setCurrentStep("idle");
    setCompletedSteps([]);
    setStartedAt(null);
    setElapsedMs(0);
    setJobProgress(5);
    setJobMessage("");
    setDraftReview(null);

    if (nextFiles.length > MAX_UPLOAD_FILES) {
      setFiles([]);
      setErrorMessage(`OCR Ground Truthでは画像は最大${MAX_UPLOAD_FILES}枚までです。5枚以上はOCR Evaluation Labで評価してください。`);
      return;
    }

    setFiles(nextFiles);
  }

  async function handleSubmit() {
    if (!files.length) {
      setErrorMessage("画像を1枚以上選択してください。");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setCompletedSteps([]);
    const runStartedAt = Date.now();
    setStartedAt(runStartedAt);
    setElapsedMs(0);
    setJobProgress(0);
    setJobMessage("");
    setCurrentStep("upload");
    setStatusMessage("画像を保存しています...");
    try {
      const source = await uploadSourceForOCRTest(files, { ignoreCache, dryRun: false });
      setCompletedSteps(["upload"]);
      setCurrentStep("ocr");
      setStatusMessage("OCRジョブを開始しています...");
      const startedJob = await startOCRReparseJob(source.id);
      setJobProgress(startedJob.progress);
      setJobMessage(startedJob.message);
      setStatusMessage(startedJob.message || "OCRとUpload Session集約を実行しています...");

      let parsed: OCRTestWorkflowResponse | null = null;
      let currentJobId = startedJob.job_id;
      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, REPARSE_JOB_POLL_INTERVAL_MS));
        const job = await getOCRReparseJob(currentJobId);
        setJobProgress(job.progress);
        setJobMessage(job.message);
        setStatusMessage(job.message);

        if (job.status === "completed") {
          parsed = job.result;
          break;
        }
        if (job.status === "failed") {
          throw new Error(job.error || job.message || "OCRジョブに失敗しました。");
        }
        currentJobId = job.job_id;
      }
      if (!parsed) {
        throw new Error("OCRジョブの結果を取得できませんでした。");
      }
      setCompletedSteps(["upload", "ocr", "aggregation"]);
      setCurrentStep("candidate");
      setResult(parsed);
      const createdDraft = await createPendingReviewDraft(parsed);
      setDraftReview(createdDraft);
      setCompletedSteps(["upload", "ocr", "aggregation", "candidate"]);
      setCurrentStep("done");
      setStatusMessage("OCRが完了し、Review DraftをDBに保存しました。PCからEvent Candidate Reviewで編集できます。");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "OCR処理に失敗しました。";
      setErrorMessage(message);
      setStatusMessage("");
      setCurrentStep("failed");
    } finally {
      setElapsedMs(Date.now() - runStartedAt);
      setIsProcessing(false);
    }
  }

  function handleCopyDebugJson() {
    if (!result) return;
    const payload = {
      source: result.source,
      session,
      canonical_event_candidate: canonicalCandidate,
      original_event_aggregate_candidate: reviewCandidate,
      draft_review: draftReview,
      ocr_output: ocrOutput,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    });
  }

  async function createPendingReviewDraft(parsed: OCRTestWorkflowResponse): Promise<EventCandidateReviewRead> {
    const candidate = buildEventAggregateCandidate(parsed);
    if (!candidate) {
      throw new Error("Review Draftに必要なEvent Candidateを作成できませんでした。");
    }
    const originalOcrOutput = buildOcrOutput(candidate);
    const reviewPrefill = buildReviewPrefill(candidate);
    const parsedSession = getSession(parsed);
    const assets = parsed.result.assets ?? [];
    const reviewSourceImages = files.map((file, index) => ({
      filename: file.name,
      source_kind: "upload_session_image",
      region_kinds: assets[index]?.source_type ? [assets[index].source_type] : [],
      image_features: assets[index]?.image_features ?? null,
    }));

    return createEventCandidateReview({
      candidate_type: candidate.candidate_type || "event_aggregate",
      source_id: parsed.source.id,
      upload_session_id: parsedSession?.id ?? parsed.result.session_id ?? null,
      candidate_json: candidate as unknown as Record<string, unknown>,
      original_json: originalOcrOutput,
      edited_json: null,
      review_json: {
        origin: "ocr_ground_truth",
        candidate_generation_method: candidate.candidate_generation_method ?? parsed.result.parsed.candidate_generation_method ?? null,
        candidate_model: candidate.candidate_model ?? parsed.result.parsed.candidate_model ?? null,
        candidate_version: candidate.candidate_version ?? parsed.result.parsed.candidate_version ?? null,
        candidate_generation_error: parsed.result.parsed.candidate_generation_error ?? null,
        fallback_aggregation_candidate: parsed.result.parsed.fallback_aggregation_candidate ?? null,
        ocr_raw_texts: parsed.result.parsed.ocr_raw_texts ?? [],
        review_prefill: reviewPrefill,
        source_filename: files.map((file) => file.name).join(", ") || parsed.source.id,
        source_images: reviewSourceImages,
      },
      review_status: "pending",
      reviewer_note: null,
    });
  }

  function handleOpenReview() {
    window.location.href = "/admin/event-candidate-review";
  }

  const sessionItems = session?.items ?? [];
  const aggregation = session?.aggregation ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="OCR Ground Truth"
        subtitle="最大4枚を1つのUpload SessionとしてOCRし、イベント候補を人間レビューへ送ります。教師データは画像単位ではなくUpload Session単位で作成します。"
      />

      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step 1</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Upload Sessionを作成</h2>
            <p className="mt-2 text-sm text-slate-600">
              Ground Truth収集用の正規入口です。Xスクショ、フライヤー、タイテ、特殊画像などを最大4枚までまとめて投入できます。
            </p>
          </div>
          <a className="text-sm font-semibold text-sky-700 underline-offset-4 hover:underline" href="/admin/ocr-evaluation">
            100枚評価はOCR Evaluation Labへ
          </a>
        </div>

        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-sky-400 hover:bg-sky-50">
          <ImageIcon className="h-10 w-10 text-slate-400" />
          <span className="mt-3 text-base font-semibold text-slate-900">画像を選択</span>
          <span className="mt-1 text-sm text-slate-500">JPG / PNG / WebP、最大4枚</span>
          <input
            className="sr-only"
            type="file"
            accept={ACCEPT}
            multiple
            suppressHydrationWarning
            onChange={(event) => handleFileChange(event.target.files)}
          />
        </label>

        {files.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {files.map((file, index) => (
              <div key={`${file.name}-${file.lastModified}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {previewUrls[index] ? (
                  <img src={previewUrls[index]} alt={file.name} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-slate-100 text-sm text-slate-500">preview unavailable</div>
                )}
                <div className="space-y-1 p-3">
                  <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">{Math.round(file.size / 1024).toLocaleString()} KB</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handleSubmit} disabled={isProcessing || files.length === 0}>
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
            OCRを実行
          </Button>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={ignoreCache}
              suppressHydrationWarning
              onChange={(event) => setIgnoreCache(event.target.checked)}
            />
            キャッシュを使わず再OCR
          </label>
          {statusMessage && <span className="text-sm text-slate-600">{statusMessage}</span>}
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        {(isProcessing || currentStep !== "idle") && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">実行状況</p>
                <p className="mt-1 text-xs text-slate-500">
                  経過時間: {formatMs(elapsedMs)}
                  {currentStep === "done" ? " / 完了" : currentStep === "failed" ? " / 失敗" : ""}
                </p>
                {jobMessage && <p className="mt-1 text-xs font-medium text-sky-700">{jobMessage}</p>}
              </div>
              {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-sky-700" />}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${currentStep === "failed" ? "bg-red-500" : "bg-sky-600"}`}
                style={{ width: `${Math.max(0, Math.min(100, jobProgress || (currentStep === "done" ? 100 : 0)))}%` }}
              />
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-4">
              {PROCESSING_STEPS.map((step) => {
                const done = completedSteps.includes(step.key);
                const active = currentStep === step.key;
                const failed = currentStep === "failed" && active;
                return (
                  <div
                    key={step.key}
                    className={`rounded-xl border p-3 ${
                      done
                        ? "border-emerald-200 bg-emerald-50"
                        : active
                          ? "border-sky-200 bg-sky-50"
                          : failed
                            ? "border-red-200 bg-red-50"
                            : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                          done
                            ? "bg-emerald-600 text-white"
                            : active
                              ? "bg-sky-700 text-white"
                              : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {done ? "✓" : PROCESSING_STEPS.indexOf(step) + 1}
                      </span>
                      <p className="text-sm font-bold text-slate-900">{step.label}</p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{step.description}</p>
                  </div>
                );
              })}
            </div>
            {currentStep === "ocr" && (
              <p className="mt-3 text-xs text-slate-500">
                OCR処理はbackend側で同期実行中です。完了後にSession集約と候補準備へ進みます。
              </p>
            )}
          </div>
        )}
      </Card>

      {result && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step 2</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">OCR / Upload Session Result</h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">完了</span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">source_id</p>
                <p className="mt-1 break-all text-sm font-semibold text-slate-900">{result.source.id}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">upload_session_id</p>
                <p className="mt-1 break-all text-sm font-semibold text-slate-900">{session?.id ?? result.result.session_id ?? "-"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">画像数</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{files.length}枚</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">処理時間</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatMs(result.result.processing_time_ms)}</p>
              </div>
            </div>

            {sessionItems.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">画像ごとの判定</h3>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">source_type</th>
                        <th className="px-3 py-2">event_name</th>
                        <th className="px-3 py-2">confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sessionItems.map((item, index) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{item.source_type}</td>
                          <td className="px-3 py-2 text-slate-700">{item.event_name ?? "-"}</td>
                          <td className="px-3 py-2 text-slate-700">{formatPercent(item.confidence)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <details className="rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-900">OCR raw text</summary>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-slate-200 p-4 text-sm leading-relaxed text-slate-700">
                {rawText || "raw_text がありません"}
              </pre>
            </details>
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step 3</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Event Candidate</h2>
              <p className="mt-2 text-sm text-slate-600">
                OCRで作られた候補はDBにReview Draftとして保存されます。編集・Approve/Edit/RejectはPCのEvent Candidate Reviewで行います。
              </p>
            </div>

            {reviewCandidate ? (
              <div className="space-y-3">
                {isManualReviewCandidate && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Canonical Event Candidate は生成されませんでした。OCR出力を初期値にした手動レビュー候補として送信できます。
                  </div>
                )}

                <div className={`rounded-2xl border p-4 ${isManualReviewCandidate ? "border-amber-100 bg-amber-50" : "border-sky-100 bg-sky-50"}`}>
                  <p className={`text-xs font-bold uppercase tracking-[0.18em] ${isManualReviewCandidate ? "text-amber-700" : "text-sky-700"}`}>
                    {isManualReviewCandidate ? "manual ground truth candidate" : "canonical event candidate"}
                  </p>
                  <div className="mt-3 grid gap-3 text-sm">
                    <div className="grid gap-2 rounded-lg bg-white/70 p-3">
                      <p><span className="font-semibold text-slate-500">event_name:</span> {reviewCandidate.event_name ?? "-"}</p>
                      <p><span className="font-semibold text-slate-500">event_date:</span> {reviewCandidate.event_date ?? "-"}</p>
                      <p><span className="font-semibold text-slate-500">venue_name:</span> {reviewCandidate.venue_name ?? "-"}</p>
                      <p><span className="font-semibold text-slate-500">open/start:</span> {[reviewCandidate.open_time, reviewCandidate.start_time].filter(Boolean).join(" / ") || "-"}</p>
                      <p><span className="font-semibold text-slate-500">groups:</span> {reviewCandidate.group_candidates.length}</p>
                    </div>
                    <div className="rounded-lg bg-white/70 p-3 text-xs text-slate-600">
                      confidence: <span className="font-semibold text-slate-900">{formatPercent(reviewCandidate.confidence)}</span>
                    </div>
                    {draftReview ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                        Review Draft保存済み: <span className="font-mono">{draftReview.id}</span>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-white/70 p-3 text-xs text-slate-600">
                        OCR完了後にReview Draftを自動保存します。
                      </div>
                    )}
                  </div>
                </div>

                {reviewCandidate.reasons.length > 0 && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">reasons</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-700">
                      {reviewCandidate.reasons.map((reason, index) => (
                        <li key={`${reason}-${index}`}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button type="button" onClick={handleOpenReview} className="w-full bg-sky-700 hover:bg-sky-800">
                  <Check className="h-4 w-4" />
                  Event Candidate Reviewを開く
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                セッション単位のイベント候補が生成されていません。OCR raw textを確認し、候補生成ロジックの改善対象として扱ってください。
              </div>
            )}
          </Card>
        </div>
      )}

      {result && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Debug</p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">必要最小限のJSON</h2>
              <p className="mt-1 text-sm text-slate-600">Extractor改善に渡すための確認用です。通常のGround Truth入力では触りません。</p>
            </div>
            <Button type="button" onClick={handleCopyDebugJson} className="bg-slate-800">
              <ClipboardCopy className="h-4 w-4" />
              {copyState === "copied" ? "コピー済み" : "JSONをコピー"}
            </Button>
          </div>
          <details className="rounded-xl border border-slate-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-900">debug jsonを表示</summary>
            <div className="border-t border-slate-200 p-4">
              <JsonBlock
                value={{
                  source: result.source,
                  session,
                  aggregation,
                  canonical_event_candidate: canonicalCandidate,
                  original_event_aggregate_candidate: reviewCandidate,
                  draft_review: draftReview,
                  ocr_output: ocrOutput,
                }}
              />
            </div>
          </details>
        </Card>
      )}
    </div>
  );
}
