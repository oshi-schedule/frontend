"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { ApiError, apiUrl } from "@/api/client";
import {
  createTrainingDatasetBenchmarkJob,
  getTrainingDatasetCandidate,
  getTrainingDatasetBenchmarkJob,
  listTrainingDatasetBenchmarkRuns,
  saveTrainingDatasetGroundTruth,
  type TrainingBenchmarkJobRead,
  type TrainingCandidateBenchmarkRunRead,
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
  stage_name: string;
  start_time: string;
  end_time: string;
  note: string;
};

type GroundTruthForm = {
  event_name: string;
  event_date: string;
  venue_name: string;
  open_time: string;
  start_time: string;
  group_candidates: GroupCandidateDraft[];
  sessions: SessionDraft[];
};

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
      stage_name: toText(record.stage_name) || toText(record.booth_name),
      start_time: toText(record.start_time),
      end_time: toText(record.end_time),
      note: toText(record.note) || toText(record.notes),
    };
  });
}

function buildForm(candidate: TrainingEventCandidateRead | null): GroundTruthForm {
  const source: Record<string, unknown> = candidate?.ground_truth_json ?? candidate?.prediction_json ?? {};
  return {
    event_name: toText(source.event_name),
    event_date: toText(source.event_date),
    venue_name: toText(source.venue_name),
    open_time: toText(source.open_time),
    start_time: toText(source.start_time),
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
  return {
    event_name: form.event_name.trim() || null,
    event_date: form.event_date || null,
    venue_name: form.venue_name.trim() || null,
    open_time: form.open_time || null,
    start_time: form.start_time || null,
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
        stage_name: session.stage_name.trim() || null,
        start_time: session.start_time || null,
        end_time: session.end_time || null,
        note: session.note.trim() || null,
      }))
      .filter((session) => session.group_name || session.title || session.start_time || session.end_time),
  };
}

export default function TrainingDatasetReviewPage() {
  const params = useParams<{ candidateId: string }>();
  const candidateId = params.candidateId;
  const [candidate, setCandidate] = useState<TrainingEventCandidateRead | null>(null);
  const [form, setForm] = useState<GroundTruthForm>(() => buildForm(null));
  const [groupJson, setGroupJson] = useState("[]");
  const [sessionJson, setSessionJson] = useState("[]");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [benchmarkRuns, setBenchmarkRuns] = useState<TrainingCandidateBenchmarkRunRead[]>([]);
  const [benchmarkJob, setBenchmarkJob] = useState<TrainingBenchmarkJobRead | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [benchmarkModels, setBenchmarkModels] = useState("gpt-5-mini");
  const [benchmarkRoutes, setBenchmarkRoutes] = useState<string[]>(["text", "vision", "layout"]);

  useEffect(() => {
    void loadCandidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  useEffect(() => {
    const nextForm = buildForm(candidate);
    setForm(nextForm);
    setGroupJson(prettyJson(nextForm.group_candidates));
    setSessionJson(prettyJson(nextForm.sessions));
    setJsonError(null);
    setSaveMessage(null);
  }, [candidate]);

  const rawTexts = useMemo(() => {
    const values = candidate?.input_payload_json?.ocr_raw_texts;
    return Array.isArray(values) ? values : [];
  }, [candidate]);

  const imageAssets = useMemo(() => {
    const values = candidate?.input_payload_json?.assets;
    return Array.isArray(values) ? values : [];
  }, [candidate]);

  async function loadCandidate() {
    setIsLoading(true);
    setError(null);
    try {
      const nextCandidate = await getTrainingDatasetCandidate(candidateId);
      setCandidate(nextCandidate);
      const runs = await listTrainingDatasetBenchmarkRuns(candidateId);
      setBenchmarkRuns(runs.items);
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

  async function handleSaveGroundTruth() {
    if (!candidate) return;
    setIsSaving(true);
    setSaveMessage(null);
    setJsonError(null);
    try {
      const saved = await saveTrainingDatasetGroundTruth(candidate.id, {
        ground_truth_json: buildGroundTruthPayload(form),
        reviewer: "admin",
      });
      setCandidate(saved);
      setSaveMessage("Ground Truthを保存しました。Event Coreには登録していません。");
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Ground Truth保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

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
            {candidate.single_multi} / {candidate.source_type ?? "-"} / {candidate.review_status}
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

      <div className="space-y-5">
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <Card className="min-w-0 p-5">
            <h2 className="font-bold">Source Images</h2>
            {imageAssets.length ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
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
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">画像参照はありません。</p>
            )}
          </Card>

          <Card className="min-w-0 p-5">
            <h2 className="font-bold">OCR Raw Text</h2>
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
        </div>

        <div className="space-y-4">
          <Card className="min-w-0 space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">Event Candidate</h2>
                <p className="mt-1 text-sm text-slate-500">値が見えるように、この画面ではフォームを広く取りました。</p>
              </div>
              <Button onClick={handleSaveGroundTruth} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Ground Truth
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="lg:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">event_name</span>
                <input
                  value={form.event_name}
                  onChange={(event) => setForm((current) => ({ ...current, event_name: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-semibold"
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">event_date</span>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={(event) => setForm((current) => ({ ...current, event_date: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">venue_name</span>
                <input
                  value={form.venue_name}
                  onChange={(event) => setForm((current) => ({ ...current, venue_name: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">open_time</span>
                <input
                  type="time"
                  value={form.open_time}
                  onChange={(event) => setForm((current) => ({ ...current, open_time: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">start_time</span>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
                />
              </label>
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
                <h2 className="font-bold">group_candidates</h2>
                <p className="mt-1 text-sm text-slate-500">Ground Truthではグループ名を編集します。score / match_method は予測メタ情報として表示のみです。</p>
              </div>
              <Button type="button" variant="outline" onClick={addGroupCandidate}>
                <Plus className="mr-2 h-4 w-4" />
                グループ追加
              </Button>
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
              <Button type="button" variant="outline" onClick={addSession}>
                <Plus className="mr-2 h-4 w-4" />
                Session追加
              </Button>
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

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-5">
          <h3 className="mb-3 font-bold">prediction_json</h3>
          <JsonBlock value={candidate.prediction_json} />
        </Card>
        <Card className="min-w-0 p-5">
          <h3 className="mb-3 font-bold">ground_truth_json</h3>
          <JsonBlock value={candidate.ground_truth_json} />
        </Card>
        <Card className="min-w-0 p-5 lg:col-span-2">
          <h3 className="mb-3 font-bold">input_payload_json</h3>
          <JsonBlock value={candidate.input_payload_json} />
        </Card>
      </div>
    </div>
  );
}
