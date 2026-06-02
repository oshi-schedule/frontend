"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardCopy, Edit3, ImageIcon, Plus, Trash2, XCircle } from "lucide-react";
import {
  createEventCandidateReview,
  type EventCandidateReviewRead,
  type OCREvaluationEventAggregateCandidate,
  type OCREvaluationJobResponse,
  type OCREvaluationResultItem,
} from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const EVENT_CANDIDATE_REVIEW_BUNDLE_KEY = "oshi_sche_event_candidate_review_bundle";
const EVENT_CANDIDATE_REVIEW_RESULTS_KEY = "oshi_sche_event_candidate_review_results";

type ReviewStatus = "pending" | "approved" | "edited" | "rejected";

interface EventCandidateReviewSourceImage {
  filename: string;
  source_kind: string;
  region_kinds: string[];
  image_data_url?: string;
  image_features: OCREvaluationResultItem["image_features"];
}

interface EventCandidateReviewBundleItem {
  id: string;
  filename: string;
  source_id?: string | null;
  upload_session_id?: string | null;
  source_images: EventCandidateReviewSourceImage[];
  event_aggregate_candidate: OCREvaluationEventAggregateCandidate;
  ocr_output?: CandidateReviewEditedValues;
  review_prefill?: CandidateReviewEditedValues;
}

interface EventCandidateReviewBundle {
  created_at: string;
  summary: OCREvaluationJobResponse["summary"];
  items: EventCandidateReviewBundleItem[];
}

interface CandidateReviewEditedValues {
  event_name?: string | null;
  event_date?: string | null;
  venue_name?: string | null;
  open_time?: string | null;
  start_time?: string | null;
  group_candidates?: string[];
}

interface CandidateReviewResult {
  review_status: ReviewStatus;
  approved: boolean;
  edited: boolean;
  rejected: boolean;
  edited_values: CandidateReviewEditedValues;
  ground_truth: CandidateReviewEditedValues | Record<string, unknown>;
  reviewer_note: string;
  reviewed_at: string;
  persisted_review_id?: string;
}

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

function loadJson<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function loadReviewResults(): Record<string, CandidateReviewResult> {
  try {
    const raw = window.localStorage.getItem(EVENT_CANDIDATE_REVIEW_RESULTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CandidateReviewResult>) : {};
  } catch {
    return {};
  }
}

function saveReviewResults(results: Record<string, CandidateReviewResult>) {
  window.localStorage.setItem(EVENT_CANDIDATE_REVIEW_RESULTS_KEY, JSON.stringify(results));
}

function candidateToOcrOutput(candidate: OCREvaluationEventAggregateCandidate): CandidateReviewEditedValues {
  return {
    event_name: candidate.event_name,
    event_date: candidate.event_date,
    venue_name: candidate.venue_name,
    open_time: candidate.open_time,
    start_time: candidate.start_time,
    group_candidates: candidate.group_candidates.map((group) => group.group_name),
  };
}

function parseGroups(names: string[]): string[] {
  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name, index, names) => names.indexOf(name) === index);
}

function formValues(eventName: string, eventDate: string, venueName: string, openTime: string, startTime: string, groupNames: string[]): CandidateReviewEditedValues {
  return {
    event_name: eventName.trim() || null,
    event_date: eventDate.trim() || null,
    venue_name: venueName.trim() || null,
    open_time: openTime.trim() || null,
    start_time: startTime.trim() || null,
    group_candidates: parseGroups(groupNames),
  };
}

function statusBadgeClass(status: ReviewStatus) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "edited") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-white text-slate-500";
}

function statusLabel(status: ReviewStatus) {
  if (status === "approved") return "approved";
  if (status === "edited") return "edited";
  if (status === "rejected") return "rejected";
  return "pending";
}

export default function EventCandidateReviewPage() {
  const [bundle, setBundle] = useState<EventCandidateReviewBundle | null>(null);
  const [reviewResults, setReviewResults] = useState<Record<string, CandidateReviewResult>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venueName, setVenueName] = useState("");
  const [openTime, setOpenTime] = useState("");
  const [startTime, setStartTime] = useState("");
  const [groupNames, setGroupNames] = useState<string[]>([]);
  const [reviewerNote, setReviewerNote] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [lastSavedReview, setLastSavedReview] = useState<EventCandidateReviewRead | null>(null);

  useEffect(() => {
    const loadedBundle = loadJson<EventCandidateReviewBundle>(EVENT_CANDIDATE_REVIEW_BUNDLE_KEY);
    const loadedResults = loadReviewResults();
    setBundle(loadedBundle);
    setReviewResults(loadedResults);
    setSelectedId(loadedBundle?.items[0]?.id ?? null);
  }, []);

  const selectedItem = useMemo(() => bundle?.items.find((item) => item.id === selectedId) ?? null, [bundle, selectedId]);
  const selectedReview = selectedId ? reviewResults[selectedId] : undefined;
  const selectedStatus = selectedReview?.review_status ?? "pending";

  useEffect(() => {
    if (!selectedItem) return;
    const candidate = selectedItem.event_aggregate_candidate;
    const reviewGroundTruth = selectedReview?.ground_truth as CandidateReviewEditedValues | undefined;
    const values = reviewGroundTruth?.event_name !== undefined ? reviewGroundTruth : selectedItem.review_prefill ?? candidateToOcrOutput(candidate);
    setEventName(values.event_name ?? "");
    setEventDate(values.event_date ?? "");
    setVenueName(values.venue_name ?? "");
    setOpenTime(values.open_time ?? "");
    setStartTime(values.start_time ?? "");
    setGroupNames(values.group_candidates ?? []);
    setReviewerNote(selectedReview?.reviewer_note ?? "");
  }, [selectedItem, selectedReview]);

  const stats = useMemo(() => {
    const items = bundle?.items ?? [];
    return items.reduce(
      (acc, item) => {
        const status = reviewResults[item.id]?.review_status ?? "pending";
        acc[status] += 1;
        return acc;
      },
      { pending: 0, approved: 0, edited: 0, rejected: 0 } as Record<ReviewStatus, number>
    );
  }, [bundle?.items, reviewResults]);

  function makeReviewResult(status: ReviewStatus): CandidateReviewResult {
    if (!selectedItem) {
      throw new Error("候補が選択されていません");
    }
    const originalValues = candidateToOcrOutput(selectedItem.event_aggregate_candidate);
    const editedValues = formValues(eventName, eventDate, venueName, openTime, startTime, groupNames);
    return {
      review_status: status,
      approved: status === "approved",
      edited: status === "edited",
      rejected: status === "rejected",
      edited_values: {},
      ground_truth: status === "rejected" ? {} : status === "approved" ? originalValues : editedValues,
      reviewer_note: reviewerNote.trim(),
      reviewed_at: new Date().toISOString(),
    };
  }

  async function saveReview(status: ReviewStatus) {
    if (!selectedItem) return;
    setSaveError(null);
    setIsSavingReview(true);
    const localReview = makeReviewResult(status);
    const originalJson = candidateToOcrOutput(selectedItem.event_aggregate_candidate);
    const editedJson = formValues(eventName, eventDate, venueName, openTime, startTime, groupNames);
    let persistedReview: EventCandidateReviewRead | null = null;
    try {
      persistedReview = await createEventCandidateReview({
        candidate_type: selectedItem.event_aggregate_candidate.candidate_type || "event_aggregate",
        source_id: selectedItem.source_id ?? null,
        upload_session_id: selectedItem.upload_session_id ?? null,
        candidate_json: selectedItem.event_aggregate_candidate as unknown as Record<string, unknown>,
        original_json: originalJson as unknown as Record<string, unknown>,
        edited_json: editedJson as unknown as Record<string, unknown>,
        review_json: {
          ...localReview,
          source_filename: selectedItem.filename,
          source_images: selectedItem.source_images.map((image) => ({
            filename: image.filename,
            source_kind: image.source_kind,
            region_kinds: image.region_kinds,
            image_features: image.image_features,
          })),
        },
        review_status: status,
        reviewer_note: localReview.reviewer_note || null,
      });
      setLastSavedReview(persistedReview);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "レビュー結果のDB保存に失敗しました");
      setIsSavingReview(false);
      return;
    }
    const next = {
      ...reviewResults,
      [selectedItem.id]: {
        ...localReview,
        edited_values: persistedReview?.edited_values_json as unknown as CandidateReviewEditedValues,
        ground_truth: persistedReview?.ground_truth_json ?? localReview.ground_truth,
        persisted_review_id: persistedReview?.id,
      },
    };
    setReviewResults(next);
    saveReviewResults(next);
    setIsSavingReview(false);
  }

  function updateGroupName(index: number, groupName: string) {
    setGroupNames((current) => current.map((value, currentIndex) => (currentIndex === index ? groupName : value)));
  }

  function addGroupName() {
    setGroupNames((current) => [...current, ""]);
  }

  function removeGroupName(index: number) {
    setGroupNames((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  if (!bundle) {
    return (
      <div className="space-y-6">
        <PageHeader title="Event Candidate Review" subtitle="Upload Session から送られた EventAggregateCandidate をレビューします。" backHref="/admin" />
        <Card className="space-y-3">
          <p className="font-semibold text-slate-900">レビュー対象がありません</p>
          <p className="text-sm text-slate-600">先に OCR Ground Truth でUpload Sessionを作成し、「Event Candidate Reviewへ送る」を押してください。</p>
          <Link href="/admin/ocr-test" className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white">
            OCR Ground Truthへ
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Event Candidate Review" subtitle="OCR Ground Truthで整えた候補を、ここでApprove/Edit/Rejectして教師データとしてDB保存します。Event Core登録はまだ行いません。" backHref="/admin" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Candidates</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{bundle.items.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Pending</p>
          <p className="mt-1 text-2xl font-bold text-slate-500">{stats.pending}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Approved</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.approved}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Edited</p>
          <p className="mt-1 text-2xl font-bold text-sky-700">{stats.edited}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Rejected</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{stats.rejected}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.45fr)]">
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">EventAggregateCandidate一覧</h2>
              <p className="mt-1 text-xs text-slate-500">30秒で採用・修正・却下できる粒度にしています。</p>
            </div>
            <CopyButton text={JSON.stringify(bundle.items, null, 2)} />
          </div>
          <div className="max-h-[720px] space-y-2 overflow-auto pr-1">
            {bundle.items.map((item) => {
              const candidate = item.event_aggregate_candidate;
              const status = reviewResults[item.id]?.review_status ?? "pending";
              const active = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    active ? "border-sky-300 bg-sky-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-semibold text-slate-900">{candidate.event_name || "イベント名未抽出"}</p>
                    <Badge className={statusBadgeClass(status)}>{statusLabel(status)}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span>{candidate.event_date || "date: -"}</span>
                    <span>{candidate.venue_name || "venue: -"}</span>
                    <span>groups: {candidate.group_candidates.length}</span>
                    <span>conf: {candidate.confidence.toFixed(2)}</span>
                  </div>
                  {item.upload_session_id ? (
                    <p className="mt-2 truncate font-mono text-[11px] text-emerald-700">upload_session_id: {item.upload_session_id}</p>
                  ) : (
                    <p className="mt-2 text-[11px] text-amber-600">upload_session_idなし: 訓練用にはセッション導線から作成してください</p>
                  )}
                  <p className="mt-2 truncate text-[11px] text-slate-400">{item.filename}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          {selectedItem ? (
            <>
              <Card className="grid gap-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold">元画像一覧</h2>
                    <Badge className={statusBadgeClass(selectedStatus)}>{statusLabel(selectedStatus)}</Badge>
                  </div>
                  {selectedItem.source_images.map((image, index) => (
                    <div key={`${image.filename}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                      {image.image_data_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image.image_data_url} alt={image.filename} className="max-h-[420px] w-full rounded-lg object-contain bg-slate-100" />
                      ) : (
                        <div className="grid h-48 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                          <div className="text-center">
                            <ImageIcon className="mx-auto" size={28} />
                            <p className="mt-2 text-xs">画像プレビューなし</p>
                          </div>
                        </div>
                      )}
                      <p className="mt-2 truncate text-xs font-semibold text-slate-700">{image.filename}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge>{image.source_kind}</Badge>
                        {image.region_kinds.map((kind) => (
                          <Badge key={kind}>{kind}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <p>
                      upload_session_id: <span className="font-mono text-slate-900">{selectedItem.upload_session_id ?? "-"}</span>
                    </p>
                    <p className="mt-1">
                      source_id: <span className="font-mono text-slate-900">{selectedItem.source_id ?? "-"}</span>
                    </p>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">event_aggregate_candidate</p>
                      <CopyButton text={JSON.stringify(selectedItem.event_aggregate_candidate, null, 2)} />
                    </div>
                    <JsonView value={selectedItem.event_aggregate_candidate} />
                  </div>

                  <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <p className="font-semibold text-slate-900">レビュー編集</p>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">event_name</span>
                      <Input value={eventName} onChange={(event) => setEventName(event.currentTarget.value)} placeholder="イベント名" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">event_date</span>
                      <Input type="date" value={eventDate} onChange={(event) => setEventDate(event.currentTarget.value)} />
                      <span className="text-[11px] text-slate-400">カレンダーから選択できます。</span>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">venue_name</span>
                      <Input value={venueName} onChange={(event) => setVenueName(event.currentTarget.value)} placeholder="会場名" />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">open_time</span>
                        <Input type="time" value={openTime} onChange={(event) => setOpenTime(event.currentTarget.value)} />
                        <span className="text-[11px] text-slate-400">時刻ピッカーで入力できます。</span>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">start_time</span>
                        <Input type="time" value={startTime} onChange={(event) => setStartTime(event.currentTarget.value)} />
                        <span className="text-[11px] text-slate-400">時刻ピッカーで入力できます。</span>
                      </label>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">group_candidates</span>
                        <Button type="button" onClick={addGroupName} className="h-8 bg-white px-3 text-xs text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                          <Plus className="h-3.5 w-3.5" />
                          グループ追加
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {groupNames.length ? (
                          groupNames.map((groupName, index) => (
                            <div key={`review-group-${index}`} className="flex gap-2">
                              <Input
                                value={groupName}
                                onChange={(event) => updateGroupName(index, event.currentTarget.value)}
                                placeholder={`グループ名 ${index + 1}`}
                              />
                              <Button
                                type="button"
                                className="h-10 w-10 shrink-0 bg-white p-0 text-red-600 ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-700"
                                onClick={() => removeGroupName(index)}
                                aria-label={`グループ候補 ${index + 1} を削除`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                            グループ候補は未入力です。「グループ追加」から追加できます。
                          </div>
                        )}
                      </div>
                    </div>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">reviewer_note</span>
                      <Textarea value={reviewerNote} onChange={(event) => setReviewerNote(event.currentTarget.value)} placeholder="判断理由や修正メモ" />
                    </label>
                    {saveError ? <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{saveError}</p> : null}
                    {lastSavedReview?.id === reviewResults[selectedItem.id]?.persisted_review_id ? (
                      <p className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
                        DB保存済み: <span className="font-mono">{lastSavedReview.id}</span>
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => saveReview("approved")} disabled={isSavingReview} className="bg-emerald-700 text-white">
                        <CheckCircle2 size={16} />
                        Approve
                      </Button>
                      <Button onClick={() => saveReview("edited")} disabled={isSavingReview} className="bg-sky-700 text-white">
                        <Edit3 size={16} />
                        Edit保存
                      </Button>
                      <Button onClick={() => saveReview("rejected")} disabled={isSavingReview} className="bg-red-700 text-white">
                        <XCircle size={16} />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-base font-semibold">CandidateReviewResult</h2>
                  <CopyButton text={JSON.stringify(reviewResults[selectedItem.id] ?? null, null, 2)} />
                </div>
                <JsonView value={reviewResults[selectedItem.id] ?? null} />
              </Card>
            </>
          ) : (
            <Card>
              <p className="text-sm text-slate-600">候補を選択してください。</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
