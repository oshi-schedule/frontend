"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, DatabaseZap, FileImage, Loader2, Save, UploadCloud } from "lucide-react";
import { ApiError, apiUrl } from "@/api/client";
import {
  createTrainingDatasetJob,
  getTrainingDatasetJob,
  listTrainingDatasetCandidates,
  saveTrainingDatasetGroundTruth,
  type TrainingDatasetJobRead,
  type TrainingDatasetMode,
  type TrainingEventCandidateRead,
} from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
const POLL_INTERVAL_MS = 1500;

type GroundTruthForm = {
  event_name: string;
  event_date: string;
  venue_name: string;
  open_time: string;
  start_time: string;
  group_candidates_json: string;
  sessions_json: string;
};

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getValue(source: Record<string, unknown>, key: string): unknown {
  return source[key];
}

function getSourceAssetId(asset: unknown): string | null {
  if (!asset || typeof asset !== "object") return null;
  const value = (asset as Record<string, unknown>).source_asset_id;
  return typeof value === "string" && value ? value : null;
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function parseJsonField(raw: string, fallback: unknown): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  return JSON.parse(trimmed);
}

function buildForm(candidate: TrainingEventCandidateRead | null): GroundTruthForm {
  const source: Record<string, unknown> = candidate?.ground_truth_json ?? candidate?.prediction_json ?? {};
  return {
    event_name: toText(getValue(source, "event_name")),
    event_date: toText(getValue(source, "event_date")),
    venue_name: toText(getValue(source, "venue_name")),
    open_time: toText(getValue(source, "open_time")),
    start_time: toText(getValue(source, "start_time")),
    group_candidates_json: prettyJson(getValue(source, "group_candidates") ?? []),
    sessions_json: prettyJson(getValue(source, "sessions") ?? []),
  };
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
      {prettyJson(value)}
    </pre>
  );
}

export default function TrainingDatasetPage() {
  const [mode, setMode] = useState<TrainingDatasetMode>("single");
  const [sourceType, setSourceType] = useState("training_dataset");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [job, setJob] = useState<TrainingDatasetJobRead | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<TrainingEventCandidateRead | null>(null);
  const [recentCandidates, setRecentCandidates] = useState<TrainingEventCandidateRead[]>([]);
  const [form, setForm] = useState<GroundTruthForm>(() => buildForm(null));
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  useEffect(() => {
    void refreshRecentCandidates();
  }, []);

  useEffect(() => {
    setForm(buildForm(selectedCandidate));
    setJsonError(null);
    setSaveMessage(null);
  }, [selectedCandidate]);

  const rawTexts = useMemo(() => {
    const values = selectedCandidate?.input_payload_json?.ocr_raw_texts;
    return Array.isArray(values) ? values : [];
  }, [selectedCandidate]);

  const imageAssets = useMemo(() => {
    const values = selectedCandidate?.input_payload_json?.assets;
    return Array.isArray(values) ? values : [];
  }, [selectedCandidate]);

  function handleFileChange(selectedFiles: FileList | null) {
    const nextFiles = Array.from(selectedFiles ?? []);
    setErrorMessage(null);
    setJob(null);
    setSaveMessage(null);
    if (nextFiles.length > 4) {
      setFiles([]);
      setErrorMessage("Training Datasetでは画像は最大4枚までです。");
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
      const response = await listTrainingDatasetCandidates({ limit: 50 });
      setRecentCandidates(response.items);
    } catch {
      // 一覧取得に失敗しても、アップロード・保存の主導線は止めない。
    }
  }

  async function handleRunJob() {
    setErrorMessage(null);
    setSaveMessage(null);
    setJsonError(null);
    setIsRunning(true);
    try {
      const started = await createTrainingDatasetJob(files, { mode, sourceType });
      setJob(started);
      let currentJob = started;
      while (currentJob.status === "queued" || currentJob.status === "running") {
        await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
        currentJob = await getTrainingDatasetJob(currentJob.job_id);
        setJob(currentJob);
      }
      if (currentJob.status === "failed") {
        throw new Error(currentJob.error || currentJob.message || "Training Datasetジョブに失敗しました。");
      }
      if (currentJob.candidate) {
        setSelectedCandidate(currentJob.candidate);
        setSaveMessage("Event Candidateを作成しました。右側のフォームで正解データを保存できます。");
        await refreshRecentCandidates();
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "処理に失敗しました。";
      setErrorMessage(message);
    } finally {
      setIsRunning(false);
    }
  }

  function buildGroundTruthPayload(): Record<string, unknown> {
    const groupCandidates = parseJsonField(form.group_candidates_json, []);
    const sessions = parseJsonField(form.sessions_json, []);
    if (!Array.isArray(groupCandidates)) {
      throw new Error("group_candidates はJSON配列で入力してください。");
    }
    if (!Array.isArray(sessions)) {
      throw new Error("sessions はJSON配列で入力してください。");
    }
    return {
      event_name: form.event_name.trim() || null,
      event_date: form.event_date || null,
      venue_name: form.venue_name.trim() || null,
      open_time: form.open_time || null,
      start_time: form.start_time || null,
      group_candidates: groupCandidates,
      sessions,
    };
  }

  async function handleSaveGroundTruth() {
    if (!selectedCandidate) return;
    setIsSaving(true);
    setJsonError(null);
    setSaveMessage(null);
    try {
      const groundTruth = buildGroundTruthPayload();
      const saved = await saveTrainingDatasetGroundTruth(selectedCandidate.id, {
        ground_truth_json: groundTruth,
        reviewer: "admin",
      });
      setSelectedCandidate(saved);
      setSaveMessage("Ground Truthを保存しました。Event Coreには登録していません。");
      await refreshRecentCandidates();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ground Truth保存に失敗しました。";
      setJsonError(message);
    } finally {
      setIsSaving(false);
    }
  }

  const canRun = files.length > 0 && !isRunning;
  const isCompleted = job?.status === "completed";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Candidate Labeling Tool"
        description="Source → EventCandidate → Human Correct Answer を蓄積します。Event Core登録は行いません。"
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-[var(--primary)]" />
              <h2 className="font-bold">1. Source Upload</h2>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(["single", "multi"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setMode(item);
                    setFiles([]);
                    setErrorMessage(null);
                  }}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                    mode === item ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {item === "single" ? "Single" : "Multi"}
                </button>
              ))}
            </div>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">source_type hint</span>
              <select
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="training_dataset">auto / training_dataset</option>
                <option value="event_info">event_info</option>
                <option value="x_screenshot">x_screenshot</option>
                <option value="normal_timetable">normal_timetable</option>
                <option value="timetable">timetable</option>
                <option value="flyer">flyer</option>
              </select>
            </label>

            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-slate-500">
              <FileImage className="mb-2 h-8 w-8 text-slate-400" />
              <span className="text-sm font-bold">画像を選択</span>
              <span className="mt-1 text-xs text-slate-500">{mode === "single" ? "1枚のみ" : "2〜4枚まで"}</span>
              <input
                className="hidden"
                type="file"
                accept={ACCEPT}
                multiple={mode === "multi"}
                onChange={(event) => handleFileChange(event.target.files)}
              />
            </label>

            {previewUrls.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {previewUrls.map((url, index) => (
                  <img key={url} src={url} alt={files[index]?.name ?? "preview"} className="aspect-square rounded-xl object-cover" />
                ))}
              </div>
            ) : null}

            <Button onClick={handleRunJob} disabled={!canRun} className="w-full">
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
                {isCompleted ? (
                  <p className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Candidate saved
                  </p>
                ) : null}
              </div>
            ) : null}

            {errorMessage ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p> : null}
          </Card>

          <Card className="p-5">
            <h2 className="font-bold">Recent Candidates</h2>
            <div className="mt-3 max-h-[420px] space-y-2 overflow-auto">
              {recentCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setSelectedCandidate(candidate)}
                  className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                    selectedCandidate?.id === candidate.id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{toText(candidate.ground_truth_json?.event_name) || toText(candidate.prediction_json.event_name) || "未命名候補"}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{candidate.review_status}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {candidate.single_multi} / {candidate.source_type ?? "-"} / {candidate.created_at}
                  </p>
                </button>
              ))}
              {recentCandidates.length === 0 ? <p className="text-sm text-slate-500">まだ候補がありません。</p> : null}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">2. Candidate Review</h2>
                <p className="mt-1 text-sm text-slate-500">prediction_jsonを初期値にして、人間の正解を保存します。</p>
              </div>
              {selectedCandidate ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {selectedCandidate.single_multi} / {selectedCandidate.review_status}
                </span>
              ) : null}
            </div>

            {!selectedCandidate ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
                解析ジョブを実行するか、Recent Candidatesから候補を選択してください。
              </div>
            ) : (
              <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.2fr]">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold">Source Images</h3>
                    {imageAssets.length ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {imageAssets.map((asset, index) => {
                          const assetId = getSourceAssetId(asset);
                          return assetId ? (
                            <img
                              key={assetId}
                              src={apiUrl(`/admin/source-assets/${assetId}/image`)}
                              alt={`source ${index + 1}`}
                              className="aspect-square rounded-xl border border-slate-200 object-cover"
                            />
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">画像参照はありません。</p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">OCR Raw Text</h3>
                    <div className="mt-2 max-h-[360px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed">
                      {rawTexts.length ? (
                        rawTexts.map((item, index) => (
                          <div key={index} className="mb-4">
                            <p className="mb-1 font-mono text-[10px] text-slate-500">
                              {(item as Record<string, unknown>).source_asset_id as string | undefined}
                            </p>
                            <pre className="whitespace-pre-wrap">{String((item as Record<string, unknown>).raw_text ?? "")}</pre>
                          </div>
                        ))
                      ) : (
                        <p>OCR Raw Textはありません。</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Source Assets</h3>
                    <JsonBlock value={imageAssets} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">event_name</span>
                      <input
                        value={form.event_name}
                        onChange={(event) => setForm((current) => ({ ...current, event_name: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">event_date</span>
                      <input
                        type="date"
                        value={form.event_date}
                        onChange={(event) => setForm((current) => ({ ...current, event_date: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">venue_name</span>
                      <input
                        value={form.venue_name}
                        onChange={(event) => setForm((current) => ({ ...current, venue_name: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">open_time</span>
                      <input
                        type="time"
                        value={form.open_time}
                        onChange={(event) => setForm((current) => ({ ...current, open_time: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">start_time</span>
                      <input
                        type="time"
                        value={form.start_time}
                        onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">group_candidates JSON</span>
                    <textarea
                      value={form.group_candidates_json}
                      onChange={(event) => setForm((current) => ({ ...current, group_candidates_json: event.target.value }))}
                      className="mt-2 h-36 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">sessions JSON</span>
                    <textarea
                      value={form.sessions_json}
                      onChange={(event) => setForm((current) => ({ ...current, sessions_json: event.target.value }))}
                      className="mt-2 h-48 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
                    />
                  </label>

                  {jsonError ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{jsonError}</p> : null}
                  {saveMessage ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{saveMessage}</p> : null}

                  <Button onClick={handleSaveGroundTruth} disabled={isSaving} className="w-full">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Ground Truth
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {selectedCandidate ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-3 font-bold">prediction_json</h3>
                <JsonBlock value={selectedCandidate.prediction_json} />
              </Card>
              <Card className="p-5">
                <h3 className="mb-3 font-bold">ground_truth_json</h3>
                <JsonBlock value={selectedCandidate.ground_truth_json} />
              </Card>
              <Card className="p-5 lg:col-span-2">
                <h3 className="mb-3 font-bold">input_payload_json</h3>
                <JsonBlock value={selectedCandidate.input_payload_json} />
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
