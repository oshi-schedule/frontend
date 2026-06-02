"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, DatabaseZap, FileImage, Loader2, UploadCloud } from "lucide-react";
import { ApiError } from "@/api/client";
import {
  createTrainingDatasetJob,
  getTrainingDatasetJob,
  listTrainingDatasetCandidates,
  type TrainingDatasetJobRead,
  type TrainingDatasetMode,
  type TrainingEventCandidateRead,
} from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
const POLL_INTERVAL_MS = 1500;

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function candidateTitle(candidate: TrainingEventCandidateRead): string {
  return (
    toText(candidate.ground_truth_json?.event_name) ||
    toText(candidate.prediction_json.event_name) ||
    toText(candidate.prediction_json.venue_name) ||
    "未命名候補"
  );
}

function candidateSubline(candidate: TrainingEventCandidateRead): string {
  return [
    toText(candidate.ground_truth_json?.event_date) || toText(candidate.prediction_json.event_date),
    toText(candidate.ground_truth_json?.venue_name) || toText(candidate.prediction_json.venue_name),
  ]
    .filter(Boolean)
    .join(" / ");
}

export default function TrainingDatasetPage() {
  const [mode, setMode] = useState<TrainingDatasetMode>("single");
  const [sourceType, setSourceType] = useState("auto");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [job, setJob] = useState<TrainingDatasetJobRead | null>(null);
  const [recentCandidates, setRecentCandidates] = useState<TrainingEventCandidateRead[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  useEffect(() => {
    void refreshRecentCandidates();
  }, []);

  function handleFileChange(selectedFiles: FileList | null) {
    const nextFiles = Array.from(selectedFiles ?? []);
    setErrorMessage(null);
    setStatusMessage(null);
    setJob(null);
    if (nextFiles.length > 4) {
      setFiles([]);
      setErrorMessage("Event Candidate Labelingでは画像は最大4枚までです。");
      return;
    }
    if (mode === "single" && nextFiles.length > 1) {
      setFiles([]);
      setErrorMessage("Single modeでは画像を1枚だけ選択してください。");
      return;
    }
    setFiles(nextFiles);
  }

  async function refreshRecentCandidates() {
    try {
      const response = await listTrainingDatasetCandidates({ limit: 100 });
      setRecentCandidates(response.items);
    } catch {
      // 一覧取得に失敗しても、アップロードの主導線は止めない。
    }
  }

  async function handleRunJob() {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsRunning(true);
    try {
      const started = await createTrainingDatasetJob(files, { mode, sourceType });
      if (!started.job_id?.trim()) {
        throw new Error("アップロードAPIからジョブIDが返りませんでした。Backendのレスポンスを確認してください。");
      }
      setJob(started);
      let currentJob = started;
      while (currentJob.status === "queued" || currentJob.status === "running") {
        await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
        currentJob = await getTrainingDatasetJob(currentJob.job_id);
        setJob(currentJob);
      }
      if (currentJob.status === "failed") {
        throw new Error(currentJob.error || currentJob.message || "Event Candidate生成ジョブに失敗しました。");
      }
      await refreshRecentCandidates();
      setStatusMessage("Event Candidateを作成しました。PCで候補一覧からレビュー編集できます。");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "処理に失敗しました。";
      setErrorMessage(message);
    } finally {
      setIsRunning(false);
    }
  }

  const canRun = files.length > 0 && !isRunning;
  const isCompleted = job?.status === "completed";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Candidate Labeling"
        subtitle="Sourceをアップロードして EventCandidate を作成します。編集レビューは候補詳細ページで行います。"
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Step 1</p>
          <h2 className="mt-1 font-bold text-emerald-950">Source Upload</h2>
          <p className="mt-2 text-sm text-emerald-900">
            スマホからはここで画像を投入します。ジョブ完了後、候補一覧からPCでGround Truth Reviewへ進みます。
          </p>
        </Card>
        <Card className="border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Step 2</p>
          <h2 className="mt-1 font-bold text-slate-900">Ground Truth Review</h2>
          <p className="mt-2 text-sm text-slate-600">
            編集フォームは別ページに分離しました。Event Core登録ではなく、モデル改善用の正解JSONを保存します。
          </p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="space-y-5 p-5">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="font-bold">Source Upload</h2>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:max-w-md">
            {(["single", "multi"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setFiles([]);
                  setErrorMessage(null);
                  setStatusMessage(null);
                }}
                className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                  mode === item ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {item === "single" ? "Single" : "Multi"}
              </button>
            ))}
          </div>

          <label className="block max-w-md">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">source_type hint</span>
            <select
              suppressHydrationWarning
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="auto">auto（画像ごとに推定）</option>
              <option value="event_info">event_info</option>
              <option value="x_screenshot">x_screenshot</option>
              <option value="normal_timetable">normal_timetable</option>
              <option value="timetable">timetable</option>
              <option value="flyer">flyer</option>
            </select>
            <span className="mt-2 block text-xs leading-relaxed text-slate-500">
              autoではBackendが画像ごとにsource typeを推定します。手動選択した場合は、現状アップロード全体へのhintとして扱われます。
            </span>
          </label>

          <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-slate-500">
            <FileImage className="mb-2 h-10 w-10 text-slate-400" />
            <span className="text-base font-bold">画像を選択</span>
            <span className="mt-1 text-sm text-slate-500">{mode === "single" ? "1枚のみ" : "2〜4枚まで"}</span>
            <input className="hidden" type="file" accept={ACCEPT} multiple={mode === "multi"} onChange={(event) => handleFileChange(event.target.files)} />
          </label>

          {previewUrls.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {previewUrls.map((url, index) => (
                <img key={url} src={url} alt={files[index]?.name ?? "preview"} className="aspect-square rounded-xl object-cover" />
              ))}
            </div>
          ) : null}

          <Button onClick={handleRunJob} disabled={!canRun} className="w-full sm:w-auto">
            {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
            解析ジョブ開始
          </Button>

          {job ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold">{job.status}</span>
                <span className="font-mono">{job.progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-slate-900 transition-all" style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-600">{job.message}</p>
              {isCompleted && job.candidate_id ? (
                <Link href={`/admin/training-dataset/${job.candidate_id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 underline">
                  <CheckCircle2 className="h-4 w-4" />
                  作成した候補をレビューする
                </Link>
              ) : null}
            </div>
          ) : null}

          {errorMessage ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p> : null}
          {statusMessage ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{statusMessage}</p> : null}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Candidate Queue</h2>
              <p className="mt-1 text-xs text-slate-500">ここから別画面でレビュー編集します。</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={refreshRecentCandidates}>
              更新
            </Button>
          </div>
          <div className="mt-4 max-h-[620px] space-y-2 overflow-auto">
            {recentCandidates.map((candidate) => (
              <Link
                key={candidate.id}
                href={`/admin/training-dataset/${candidate.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-3 text-left text-sm transition hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">{candidateTitle(candidate)}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{candidate.review_status}</span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{candidateSubline(candidate) || "-"}</p>
                <p className="mt-1 truncate text-xs text-slate-400">
                  {candidate.single_multi} / predicted: {candidate.predicted_source_type ?? candidate.source_type ?? "-"} / hint:{" "}
                  {candidate.source_type_hint ?? "-"}
                </p>
              </Link>
            ))}
            {recentCandidates.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">まだ候補がありません。</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
