"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ClipboardCopy, ExternalLink, Loader2, Play, Plus, RefreshCw, Save, Trash2, Wand2 } from "lucide-react";
import { apiUrl } from "@/api/client";
import {
  getGptExtractionBenchmarkCandidate,
  runGptExtractionBenchmark,
  saveTrainingDatasetGroundTruth,
  type TrainingCandidateBenchmarkCandidateDetailResponse,
  type TrainingCandidateBenchmarkRead,
} from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type JsonRecord = Record<string, unknown>;

const eventFields = ["event_name", "event_date", "venue_name", "open_time", "start_time", "source_type"];

function sourceAssetImageUrl(assetId: string) {
  return apiUrl(`/admin/source-assets/${assetId}/image`);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function textValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function statusClassName(status: string | null | undefined) {
  const value = status || "not_run";
  if (value === "completed") return "bg-emerald-100 text-emerald-700";
  if (value === "running") return "bg-sky-100 text-sky-700";
  if (value === "pending") return "bg-amber-100 text-amber-700";
  if (value === "failed") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

function groupNames(value: unknown): string[] {
  const names: string[] = [];
  asArray(value).forEach((item) => {
    const record = asRecord(item);
    const name = typeof item === "string" ? item : String(record.group_name ?? record.name ?? record.raw_name ?? "");
    const trimmed = name.trim();
    if (trimmed && !names.some((existing) => normalizeText(existing) === normalizeText(trimmed))) {
      names.push(trimmed);
    }
  });
  return names;
}

function sessionRows(value: unknown) {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);
      const type = String(record.session_type ?? "performance");
      const name = String(record.group_name ?? record.performer_name ?? record.title ?? "");
      const venue = String(record.venue_name ?? record.stage_name ?? record.booth_name ?? "");
      const start = String(record.start_time ?? "");
      const end = String(record.end_time ?? "");
      return { type, name, venue, time: [start, end].filter(Boolean).join(" - ") };
    })
    .filter((item) => item.type || item.name || item.venue || item.time);
}

function sessionCounts(value: unknown) {
  const rows = sessionRows(value);
  return {
    performance: rows.filter((item) => item.type === "performance").length,
    meetAndGreet: rows.filter((item) => item.type === "meet_and_greet").length,
    total: rows.length,
  };
}

function cloneRecord(value: unknown): JsonRecord {
  try {
    return JSON.parse(JSON.stringify(asRecord(value)));
  } catch {
    return { ...asRecord(value) };
  }
}

function editableGroupRows(value: unknown): JsonRecord[] {
  return asArray(value).map((item) => {
    if (typeof item === "string") return { group_name: item, score: null, match_method: null };
    const record = cloneRecord(item);
    const groupName = record.group_name ?? record.name ?? record.raw_name ?? "";
    return {
      ...record,
      group_name: String(groupName),
      score: record.score ?? null,
      match_method: record.match_method ?? null,
    };
  });
}

function editableSessionRows(value: unknown): JsonRecord[] {
  return asArray(value).map((item) => {
    const record = cloneRecord(item);
    return {
      ...record,
      session_type: String(record.session_type ?? "performance"),
        group_name: String(record.group_name ?? record.performer_name ?? ""),
        title: String(record.title ?? ""),
        venue_name: String(record.venue_name ?? ""),
        stage_name: String(record.stage_name ?? record.venue_name ?? record.booth_name ?? ""),
      start_time: String(record.start_time ?? ""),
      end_time: String(record.end_time ?? ""),
      note: String(record.note ?? ""),
    };
  });
}

function normalizeGroundTruthDraft(value: unknown): JsonRecord {
  const source = cloneRecord(value);
  return {
    ...source,
    event_name: source.event_name ?? null,
    event_date: source.event_date ?? null,
    venue_name: source.venue_name ?? null,
    open_time: source.open_time ?? null,
    start_time: source.start_time ?? null,
    source_type: source.source_type ?? null,
    group_candidates: editableGroupRows(source.group_candidates),
    sessions: editableSessionRows(source.sessions),
  };
}

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function buildGroundTruthPayloadFromDraft(draft: JsonRecord): JsonRecord {
  const eventName = cleanText(draft.event_name);
  const eventDate = cleanText(draft.event_date);
  const venueName = cleanText(draft.venue_name);
  const openTime = cleanText(draft.open_time);
  const startTime = cleanText(draft.start_time);
  const sourceType = cleanText(draft.source_type);
  const groupCandidates = editableGroupRows(draft.group_candidates)
    .map((group) => ({
      ...group,
      group_name: cleanText(group.group_name),
      score: group.score === "" ? null : group.score ?? null,
      match_method: cleanText(group.match_method),
    }))
    .filter((group) => group.group_name);
  const sessions = editableSessionRows(draft.sessions)
    .map((session) => ({
      ...session,
      session_type: cleanText(session.session_type) ?? "performance",
      group_name: cleanText(session.group_name),
      title: cleanText(session.title),
      venue_name: cleanText(session.venue_name),
      stage_name: cleanText(session.stage_name),
      start_time: cleanText(session.start_time),
      end_time: cleanText(session.end_time),
      note: cleanText(session.note),
    }))
    .filter((session) => session.group_name || session.title || session.start_time || session.end_time);

  return {
    ...draft,
    event_name: eventName,
    event_date: eventDate,
    venue_name: venueName,
    open_time: openTime,
    start_time: startTime,
    source_type: sourceType,
    venues: venueName || openTime || startTime ? [{ venue_name: venueName, open_time: openTime, start_time: startTime, note: null }] : [],
    group_candidates: groupCandidates,
    sessions,
  };
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
      {prettyJson(value)}
    </pre>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-950"
    >
      <ClipboardCopy className="h-3.5 w-3.5" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function EventDiffTable({ current, gpt, groundTruth }: { current: JsonRecord; gpt: JsonRecord; groundTruth: JsonRecord }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-bold">event_candidate</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Field</th>
              <th className="px-4 py-3">Current</th>
              <th className="px-4 py-3">GPT-5.4</th>
              <th className="px-4 py-3">Ground Truth</th>
            </tr>
          </thead>
          <tbody>
            {eventFields.map((field) => {
              const gt = groundTruth[field];
              const hasGt = normalizeText(gt) !== "";
              const currentOk = hasGt && normalizeText(current[field]) === normalizeText(gt);
              const gptOk = hasGt && normalizeText(gpt[field]) === normalizeText(gt);
              return (
                <tr key={field} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 font-mono font-semibold">{field}</td>
                  <td className={`px-4 py-3 ${currentOk ? "bg-emerald-50 text-emerald-800" : ""}`}>{textValue(current[field])}</td>
                  <td className={`px-4 py-3 ${gptOk ? "bg-emerald-50 text-emerald-800" : ""}`}>{textValue(gpt[field])}</td>
                  <td className="px-4 py-3 font-semibold text-slate-950">{textValue(gt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function GroupDiff({ label, groups, groundTruthGroups }: { label: string; groups: string[]; groundTruthGroups: string[] }) {
  const gtSet = new Set(groundTruthGroups.map(normalizeText));
  const groupSet = new Set(groups.map(normalizeText));
  const missing = groundTruthGroups.filter((name) => !groupSet.has(normalizeText(name)));
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">{label}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{groups.length}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {groups.map((name) => {
          const ok = gtSet.has(normalizeText(name));
          return (
            <span key={name} className={`rounded-full px-2 py-1 text-xs font-semibold ${ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {ok ? "+ " : "- "}
              {name}
            </span>
          );
        })}
        {groups.length === 0 ? <span className="text-sm text-slate-500">なし</span> : null}
      </div>
      {missing.length ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Missing GT</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map((name) => (
              <span key={name} className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SessionTable({ label, value }: { label: string; value: unknown }) {
  const rows = sessionRows(value);
  const counts = sessionCounts(value);
  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">{label}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{counts.total}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Performance {counts.performance} / Meet&Greet {counts.meetAndGreet}</p>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 uppercase tracking-[0.1em] text-slate-500">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Place</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.type}-${row.name}-${row.time}-${index}`} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono">{row.type}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.time || "-"}</td>
                <td className="px-3 py-2">{row.name || "-"}</td>
                <td className="px-3 py-2">{row.venue || "-"}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-5 text-slate-500">
                  なし
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroundTruthEditor({
  draft,
  setDraft,
  onDirty,
  onCopyGpt,
  onCopyCurrent,
  onSave,
  saving,
  dirty,
  hasGpt,
}: {
  draft: JsonRecord;
  setDraft: Dispatch<SetStateAction<JsonRecord>>;
  onDirty: () => void;
  onCopyGpt: () => void;
  onCopyCurrent: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  hasGpt: boolean;
}) {
  const groups = editableGroupRows(draft.group_candidates);
  const sessions = editableSessionRows(draft.sessions);

  function updateField(field: string, value: string) {
    onDirty();
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function updateGroup(index: number, field: string, value: string) {
    onDirty();
    setDraft((prev) => {
      const nextGroups = editableGroupRows(prev.group_candidates);
      nextGroups[index] = { ...nextGroups[index], [field]: value };
      return { ...prev, group_candidates: nextGroups };
    });
  }

  function addGroup() {
    onDirty();
    setDraft((prev) => ({ ...prev, group_candidates: [...editableGroupRows(prev.group_candidates), { group_name: "", score: null, match_method: "manual" }] }));
  }

  function removeGroup(index: number) {
    onDirty();
    setDraft((prev) => ({ ...prev, group_candidates: editableGroupRows(prev.group_candidates).filter((_, itemIndex) => itemIndex !== index) }));
  }

  function updateSession(index: number, field: string, value: string) {
    onDirty();
    setDraft((prev) => {
      const nextSessions = editableSessionRows(prev.sessions);
      nextSessions[index] = { ...nextSessions[index], [field]: value };
      return { ...prev, sessions: nextSessions };
    });
  }

  function addSession() {
    onDirty();
    setDraft((prev) => ({
      ...prev,
      sessions: [
        ...editableSessionRows(prev.sessions),
        { session_type: "performance", group_name: "", title: "", venue_name: "", stage_name: "", start_time: "", end_time: "", note: "" },
      ],
    }));
  }

  function removeSession(index: number) {
    onDirty();
    setDraft((prev) => ({ ...prev, sessions: editableSessionRows(prev.sessions).filter((_, itemIndex) => itemIndex !== index) }));
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Ground Truth Editor</h2>
          <p className="mt-1 text-xs text-slate-500">GPT-5.4の結果をコピーして、保存前に表で修正できます。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onCopyCurrent}>
            <ClipboardCopy className="h-4 w-4" />
            Copy Current
          </Button>
          <Button type="button" variant="outline" onClick={onCopyGpt} disabled={!hasGpt}>
            <Wand2 className="h-4 w-4" />
            Copy GPT-5.4
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving" : dirty ? "Save Ground Truth" : "Save Ground Truth"}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Ground Truth</th>
            </tr>
          </thead>
          <tbody>
            {eventFields.map((field) => (
              <tr key={field} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono font-semibold">{field}</td>
                <td className="px-3 py-2">
                  <input
                    value={String(draft[field] ?? "")}
                    onChange={(event) => updateField(field, event.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">group_candidates</h3>
          <Button type="button" variant="outline" onClick={addGroup}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Method</th>
                <th className="w-12 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, index) => (
                <tr key={`${index}-${group.group_name}`} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <input
                      value={String(group.group_name ?? "")}
                      onChange={(event) => updateGroup(index, "group_name", event.target.value)}
                      className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={String(group.score ?? "")}
                      onChange={(event) => updateGroup(index, "score", event.target.value)}
                      className="h-9 w-28 rounded-md border border-slate-200 px-3 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={String(group.match_method ?? "")}
                      onChange={(event) => updateGroup(index, "match_method", event.target.value)}
                      className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => removeGroup(index)} className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-5 text-slate-500">
                    なし
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">sessions</h3>
          <Button type="button" variant="outline" onClick={addSession}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Start</th>
                <th className="px-3 py-2">End</th>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Place</th>
                <th className="px-3 py-2">Note</th>
                <th className="w-12 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session, index) => (
                <tr key={`${index}-${session.group_name}-${session.start_time}`} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <select
                      value={String(session.session_type ?? "performance")}
                      onChange={(event) => updateSession(index, "session_type", event.target.value)}
                      className="h-9 w-40 rounded-md border border-slate-200 bg-white px-2 text-sm"
                    >
                      <option value="performance">performance</option>
                      <option value="meet_and_greet">meet_and_greet</option>
                    </select>
                  </td>
                  {(["start_time", "end_time", "group_name", "title", "stage_name", "note"] as const).map((field) => (
                    <td key={field} className="px-3 py-2">
                      <input
                        value={String(session[field] ?? "")}
                        onChange={(event) => updateSession(index, field, event.target.value)}
                        className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => removeSession(index)} className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-5 text-slate-500">
                    なし
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

export default function GptExtractionBenchmarkDetailPage() {
  const params = useParams<{ candidateId: string }>();
  const candidateId = params.candidateId;
  const [detail, setDetail] = useState<TrainingCandidateBenchmarkCandidateDetailResponse | null>(null);
  const [model, setModel] = useState("gpt-5.4");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [groundTruthDraft, setGroundTruthDraft] = useState<JsonRecord>({});
  const [groundTruthDirty, setGroundTruthDirty] = useState(false);
  const [savingGroundTruth, setSavingGroundTruth] = useState(false);

  const latest: TrainingCandidateBenchmarkRead | null = detail?.latest_benchmark ?? detail?.benchmarks[0] ?? null;
  const currentPrediction = useMemo(
    () => asRecord(latest?.current_prediction_json ?? detail?.candidate.prediction_json),
    [latest, detail],
  );
  const gptPrediction = useMemo(() => asRecord(latest?.prediction_json), [latest]);
  const persistedGroundTruth = useMemo(
    () => asRecord(detail?.candidate.ground_truth_json ?? latest?.ground_truth_json),
    [detail, latest],
  );
  const groundTruth = groundTruthDraft;
  const activeRun = ["pending", "running"].includes(latest?.status ?? "");

  async function load() {
    const next = await getGptExtractionBenchmarkCandidate(candidateId, { benchmarkModel: model.trim() || null });
    setDetail(next);
  }

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, [candidateId]);

  useEffect(() => {
    if (!activeRun) return;
    const id = window.setInterval(() => {
      load().catch(() => undefined);
    }, 3500);
    return () => window.clearInterval(id);
  }, [activeRun, candidateId, model]);

  useEffect(() => {
    if (!detail || groundTruthDirty) return;
    const source = Object.keys(persistedGroundTruth).length ? persistedGroundTruth : currentPrediction;
    setGroundTruthDraft(normalizeGroundTruthDraft(source));
  }, [detail, persistedGroundTruth, currentPrediction, groundTruthDirty]);

  async function handleReload() {
    setLoading(true);
    setError(null);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "再読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleRun() {
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      await runGptExtractionBenchmark(candidateId, { benchmark_model: model.trim() || null });
      setMessage("RQへ投入しました");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run GPTに失敗しました");
    } finally {
      setRunning(false);
    }
  }

  function markGroundTruthDirty() {
    setGroundTruthDirty(true);
  }

  function replaceGroundTruthDraft(source: JsonRecord, label: string) {
    setError(null);
    setMessage(`${label}をGround Truth下書きにコピーしました`);
    setGroundTruthDirty(true);
    setGroundTruthDraft(
      normalizeGroundTruthDraft({
        ...source,
        correct_item_source_types:
          groundTruthDraft.correct_item_source_types ?? persistedGroundTruth.correct_item_source_types ?? currentPrediction.correct_item_source_types,
      }),
    );
  }

  async function handleSaveGroundTruth() {
    if (!detail) return;
    setSavingGroundTruth(true);
    setError(null);
    setMessage(null);
    try {
      const payload = buildGroundTruthPayloadFromDraft(groundTruthDraft);
      const saved = await saveTrainingDatasetGroundTruth(detail.candidate.id, {
        ground_truth_json: payload,
        reviewer: "gpt-extraction-benchmark",
        review_status: "ground_truth_saved",
        gpt_metrics: latest
          ? {
              benchmark_id: latest.id,
              benchmark_model: latest.benchmark_model,
              benchmark_type: latest.benchmark_type,
              benchmark_status: latest.status,
              input_tokens: latest.input_tokens,
              output_tokens: latest.output_tokens,
              total_tokens: latest.total_tokens,
              latency_ms: latest.latency_ms,
            }
          : null,
        note: "Saved from GPT Extraction Benchmark",
      });
      setDetail((prev) => (prev ? { ...prev, candidate: { ...prev.candidate, ...saved } } : prev));
      setGroundTruthDraft(normalizeGroundTruthDraft(saved.ground_truth_json ?? payload));
      setGroundTruthDirty(false);
      setMessage("Ground Truthを保存しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ground Truthの保存に失敗しました");
    } finally {
      setSavingGroundTruth(false);
    }
  }

  if (loading && !detail) {
    return (
      <div className="space-y-5">
        <PageHeader title="GPT Extraction Benchmark" backHref="/admin/labs/gpt-extraction-benchmark" />
        <Card className="flex items-center gap-2 p-6 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          読み込み中です。
        </Card>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-5">
        <PageHeader title="GPT Extraction Benchmark" backHref="/admin/labs/gpt-extraction-benchmark" />
        <Card className="p-6 text-red-700">{error ?? "候補が見つかりません。"}</Card>
      </div>
    );
  }

  const candidate = detail.candidate;
  const currentGroups = groupNames(currentPrediction.group_candidates);
  const gptGroups = groupNames(gptPrediction.group_candidates);
  const gtGroups = groupNames(groundTruth.group_candidates);

  return (
    <div className="space-y-5">
      <PageHeader
        title="GPT Extraction Benchmark"
        subtitle={candidate.id}
        backHref="/admin/labs/gpt-extraction-benchmark"
      />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="break-all font-mono text-xs text-slate-500">{candidate.id}</p>
          <p className="mt-1 text-sm text-slate-600">
            {candidate.single_multi} / {candidate.predicted_source_type ?? candidate.source_type ?? "-"} / {candidate.review_status}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClassName(latest?.status)}`}>
            {latest?.status ?? "not_run"}
          </span>
          <input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="h-10 w-40 rounded-md border border-slate-200 px-3 font-mono text-sm"
            aria-label="benchmark model"
          />
          <Button type="button" variant="outline" onClick={handleReload} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reload
          </Button>
          <Button type="button" onClick={handleRun} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run GPT-5.4
          </Button>
        </div>
      </Card>

      {message ? <p className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {latest?.error_message ? <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{latest.error_message}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="min-w-0 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">Images</h2>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{detail.image_asset_ids.length}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-1">
            {detail.image_asset_ids.map((assetId, index) => (
              <div key={assetId} className="min-w-0">
                <img
                  src={sourceAssetImageUrl(assetId)}
                  alt=""
                  className="max-h-[420px] w-full rounded-md border border-slate-200 object-contain"
                />
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-slate-500">image_{index + 1}</span>
                  <a
                    href={sourceAssetImageUrl(assetId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-slate-700 underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    open
                  </a>
                </div>
              </div>
            ))}
            {detail.image_asset_ids.length === 0 ? <p className="text-sm text-slate-500">画像参照はありません。</p> : null}
          </div>
        </Card>

        <Card className="min-w-0 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-bold">Current Prediction</h2>
            <CopyButton text={prettyJson(currentPrediction)} />
          </div>
          <JsonBlock value={currentPrediction} />
        </Card>

        <Card className="min-w-0 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-bold">GPT-5.4 Result</h2>
            <CopyButton text={prettyJson(gptPrediction)} />
          </div>
          <JsonBlock value={gptPrediction} />
        </Card>
      </div>

      <GroundTruthEditor
        draft={groundTruthDraft}
        setDraft={setGroundTruthDraft}
        onDirty={markGroundTruthDirty}
        onCopyCurrent={() => replaceGroundTruthDraft(currentPrediction, "Current Prediction")}
        onCopyGpt={() => replaceGroundTruthDraft(gptPrediction, "GPT-5.4 Result")}
        onSave={handleSaveGroundTruth}
        saving={savingGroundTruth}
        dirty={groundTruthDirty}
        hasGpt={Object.keys(gptPrediction).length > 0}
      />

      <EventDiffTable current={currentPrediction} gpt={gptPrediction} groundTruth={groundTruth} />

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">group_candidates</h2>
          <CopyButton text={prettyJson({ current: currentGroups, gpt: gptGroups, ground_truth: gtGroups })} />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <GroupDiff label="Current" groups={currentGroups} groundTruthGroups={gtGroups} />
          <GroupDiff label="GPT-5.4" groups={gptGroups} groundTruthGroups={gtGroups} />
          <GroupDiff label="Ground Truth" groups={gtGroups} groundTruthGroups={gtGroups} />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">sessions</h2>
          <CopyButton text={prettyJson({ current: currentPrediction.sessions, gpt: gptPrediction.sessions, ground_truth: groundTruth.sessions })} />
        </div>
        <div className="grid gap-3 xl:grid-cols-3">
          <SessionTable label="Current" value={currentPrediction.sessions} />
          <SessionTable label="GPT-5.4" value={gptPrediction.sessions} />
          <SessionTable label="Ground Truth" value={groundTruth.sessions} />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-bold">Benchmark Runs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Latency</th>
                <th className="px-4 py-3">Tokens</th>
                <th className="px-4 py-3">RQ</th>
              </tr>
            </thead>
            <tbody>
              {detail.benchmarks.map((run) => (
                <tr key={run.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">{new Date(run.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{run.benchmark_model}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClassName(run.status)}`}>{run.status}</span>
                  </td>
                  <td className="px-4 py-3">{run.latency_ms ?? "-"}ms</td>
                  <td className="px-4 py-3">{run.total_tokens ?? "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{run.rq_job_id ?? "-"}</td>
                </tr>
              ))}
              {detail.benchmarks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-slate-500">
                    Run はまだありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-between gap-2">
        <Link href={`/admin/training-dataset/${candidate.id}`} className="text-sm font-bold text-slate-700 underline">
          Ground Truth Reviewを開く
        </Link>
        <Link href="/admin/labs/gpt-extraction-benchmark" className="text-sm font-bold text-slate-700 underline">
          一覧へ戻る
        </Link>
      </div>
    </div>
  );
}
