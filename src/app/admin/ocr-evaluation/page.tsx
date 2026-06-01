"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ClipboardCopy, ImageIcon, Loader2, UploadCloud } from "lucide-react";
import { ApiError } from "@/api/client";
import {
  evaluateOCRImages,
  getOCREvaluationJob,
  type OCREvaluationJobResponse,
  type OCREvaluationResultItem,
} from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

interface BBoxCandidate {
  bbox: {
    x_min: number;
    y_min: number;
    x_max: number;
    y_max: number;
  };
  confidence?: number;
  reasons?: string[];
}

function JsonView({ value }: { value: unknown }) {
  return <pre className="max-h-[420px] overflow-auto rounded-md bg-[#f8fafc] p-3 text-xs leading-6 text-slate-700">{JSON.stringify(value, null, 2)}</pre>;
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

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sourceKindName(value: Record<string, unknown> | null): string {
  const sourceKind = value?.source_kind;
  return typeof sourceKind === "string" ? sourceKind : "-";
}

function getAttachedImageCandidates(sourceKind: Record<string, unknown> | null | undefined): BBoxCandidate[] {
  const candidates = sourceKind?.attached_image_candidates;
  if (!Array.isArray(candidates)) return [];
  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Record<string, unknown>;
    const bbox = item.bbox;
    if (!bbox || typeof bbox !== "object") return [];
    const bboxItem = bbox as Record<string, unknown>;
    const xMin = asNumber(bboxItem.x_min);
    const yMin = asNumber(bboxItem.y_min);
    const xMax = asNumber(bboxItem.x_max);
    const yMax = asNumber(bboxItem.y_max);
    if (xMin === null || yMin === null || xMax === null || yMax === null) return [];
    return [
      {
        bbox: { x_min: xMin, y_min: yMin, x_max: xMax, y_max: yMax },
        confidence: asNumber(item.confidence) ?? undefined,
        reasons: Array.isArray(item.reasons) ? item.reasons.filter((reason): reason is string => typeof reason === "string") : [],
      },
    ];
  });
}

function AttachedImageCandidateOverlay({
  imageUrl,
  imageWidth,
  imageHeight,
  candidates,
}: {
  imageUrl: string | undefined;
  imageWidth: number | undefined;
  imageHeight: number | undefined;
  candidates: BBoxCandidate[];
}) {
  if (!imageUrl || !imageWidth || !imageHeight) {
    return <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">プレビュー画像がありません。</p>;
  }
  if (!candidates.length) {
    return <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">attached_image_candidate はありません。</p>;
  }
  return (
    <div className="space-y-2">
      <div className="relative inline-block max-w-full overflow-hidden rounded-lg border border-sky-200 bg-slate-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="attached image candidate overlay" className="max-h-[520px] max-w-full object-contain opacity-90" />
        {candidates.map((candidate, index) => {
          const left = (candidate.bbox.x_min / imageWidth) * 100;
          const top = (candidate.bbox.y_min / imageHeight) * 100;
          const width = ((candidate.bbox.x_max - candidate.bbox.x_min) / imageWidth) * 100;
          const height = ((candidate.bbox.y_max - candidate.bbox.y_min) / imageHeight) * 100;
          return (
            <div
              key={`${candidate.bbox.x_min}-${candidate.bbox.y_min}-${index}`}
              className="absolute border-2 border-sky-400 bg-sky-400/20 shadow-[0_0_0_9999px_rgba(15,23,42,0.25)]"
              style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
            >
              <span className="absolute left-1 top-1 rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                #{index + 1} {candidate.confidence !== undefined ? candidate.confidence.toFixed(2) : ""}
              </span>
            </div>
          );
        })}
      </div>
      <JsonView value={candidates} />
    </div>
  );
}

function regionKindSummary(item: OCREvaluationResultItem): string {
  const kinds = item.region_semantics.map((region) => region.semantic?.kind || "unknown");
  if (!kinds.length) return "-";
  const counts = kinds.reduce<Record<string, number>>((acc, kind) => {
    acc[kind] = (acc[kind] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([kind, count]) => `${kind}:${count}`)
    .join(", ");
}

function eventInfoSummary(item: OCREvaluationResultItem): string {
  if (!item.event_info_candidates?.length) return "-";
  return item.event_info_candidates
    .slice(0, 2)
    .map((candidate) => {
      const eventName = typeof candidate.values.event_name === "string" ? candidate.values.event_name : "event_info";
      const eventDate = typeof candidate.values.event_date === "string" ? candidate.values.event_date : "";
      const venueName = typeof candidate.values.venue_name === "string" ? candidate.values.venue_name : "";
      return [eventName, eventDate, venueName].filter(Boolean).join(" / ");
    })
    .join(" | ");
}

function performerListSummary(item: OCREvaluationResultItem): string {
  const names = item.performer_list_candidates?.flatMap((candidate) => {
    const value = candidate.values.performer_name_candidates;
    return Array.isArray(value) ? value.filter((name): name is string => typeof name === "string") : [];
  }) ?? [];
  if (!names.length) return "-";
  const preview = names.slice(0, 4).join(", ");
  return names.length > 4 ? `${preview} +${names.length - 4}` : preview;
}

function performerAssociationSummary(item: OCREvaluationResultItem): string {
  const associations = item.performer_associations ?? [];
  if (!associations.length) return "-";
  return associations
    .slice(0, 3)
    .map((association) => {
      const top = association.group_candidates?.[0];
      if (!top) return association.raw_name;
      return `${association.raw_name} → ${top.group_name} (${top.score.toFixed(2)})`;
    })
    .join(" | ");
}

function eventAggregateSummary(item: OCREvaluationResultItem): string {
  const aggregate = item.event_aggregate_candidates?.[0];
  if (!aggregate) return "-";
  const groups = aggregate.group_candidates.slice(0, 3).map((group) => group.group_name).join(", ");
  const headline = [aggregate.event_name, aggregate.event_date, aggregate.venue_name].filter(Boolean).join(" / ");
  return [headline || "event_aggregate", groups ? `groups:${groups}` : null, `conf:${aggregate.confidence.toFixed(2)}`].filter(Boolean).join(" | ");
}

export default function AdminOCREvaluationPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [result, setResult] = useState<OCREvaluationJobResponse | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFiles.length) {
      setPreviewUrls([]);
      return;
    }
    const objectUrls = selectedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(objectUrls);
    return () => objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [selectedFiles]);

  const fileSummary = useMemo(() => {
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    return `${selectedFiles.length} files / ${(totalSize / 1024 / 1024).toFixed(2)} MB`;
  }, [selectedFiles]);

  const isJobActive = result?.status === "queued" || result?.status === "running";
  const progressPercent = result?.total ? Math.round((result.completed / result.total) * 100) : 0;

  useEffect(() => {
    if (!result?.job_id || !isJobActive) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await getOCREvaluationJob(result.job_id);
        setResult(next);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail, null, 2));
        } else {
          setError(err instanceof Error ? err.message : "OCR評価ジョブの取得に失敗しました");
        }
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [isJobActive, result?.job_id]);

  function setFiles(files: File[]) {
    setSelectedFiles(files.slice(0, 100));
    setResult(null);
    setError(null);
    setExpandedRows(new Set());
  }

  function handleFileInput(fileList: FileList | null) {
    setFiles(fileList ? Array.from(fileList) : []);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    setFiles(Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/")));
  }

  async function handleEvaluate() {
    if (!selectedFiles.length) return;
    setIsSubmitting(true);
    setError(null);
    setResult(null);
    setExpandedRows(new Set());
    try {
      const response = await evaluateOCRImages(selectedFiles);
      setResult(response);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail, null, 2));
      } else {
        setError(err instanceof Error ? err.message : "OCR評価に失敗しました");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleRow(index: number) {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="OCR Evaluation" subtitle="SourceKind / LayoutGraph / RegionFeatures / RegionSemantic を一括評価します。" backHref="/admin" />

      <Card className="space-y-4">
        <div
          onDrop={handleDrop}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
            isDragging ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white"
          }`}
        >
          <UploadCloud className="mx-auto mb-3 text-slate-400" size={32} />
          <p className="font-semibold text-slate-900">画像をドラッグ＆ドロップ</p>
          <p className="mt-1 text-sm text-slate-500">最大100枚まで一括評価できます。</p>
          <Input type="file" accept={ACCEPT} multiple onChange={(event) => handleFileInput(event.currentTarget.files)} className="mx-auto mt-4 max-w-xl" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{fileSummary}</span>
            {selectedFiles.length > 100 ? <span className="ml-2 text-red-600">100枚に切り詰めます</span> : null}
          </div>
          <Button onClick={handleEvaluate} disabled={!selectedFiles.length || isSubmitting || isJobActive} className="bg-slate-900 text-white">
            {isSubmitting || isJobActive ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
            {isSubmitting ? "ジョブ作成中..." : isJobActive ? "評価実行中..." : "評価開始"}
          </Button>
        </div>

        {result ? (
          <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Job: <span className="font-mono">{result.job_id}</span>
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  status: <span className="font-mono">{result.status}</span>
                  {result.current_filename ? <> / processing: <span className="font-mono">{result.current_filename}</span></> : null}
                </p>
              </div>
              <p className="font-mono text-sm font-semibold text-sky-800">
                {result.completed} / {result.total} files
              </p>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            {result.error ? <p className="mt-2 text-sm text-red-700">{result.error}</p> : null}
          </div>
        ) : null}

        {selectedFiles.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {selectedFiles.slice(0, 12).map((file, index) => (
              <div key={`${file.name}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrls[index]} alt={file.name} className="h-28 w-full rounded object-cover" />
                <p className="mt-2 truncate text-xs font-medium text-slate-700">{file.name}</p>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      </Card>

      {result ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Total</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{result.summary.total}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Success</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{result.summary.success}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Failed</p>
              <p className="mt-1 text-2xl font-bold text-red-700">{result.summary.failed}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-slate-400">Summary JSON</p>
                <CopyButton text={JSON.stringify(result.summary, null, 2)} />
              </div>
              <JsonView value={result.summary} />
            </Card>
          </div>

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Results</h2>
              <CopyButton text={JSON.stringify(result, null, 2)} />
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">詳細</th>
                    <th className="px-3 py-2">ファイル名</th>
                    <th className="px-3 py-2">SourceKind</th>
                    <th className="px-3 py-2">Region数</th>
                    <th className="px-3 py-2">RegionKind一覧</th>
                    <th className="px-3 py-2">EventInfo候補</th>
                    <th className="px-3 py-2">Performer候補</th>
                    <th className="px-3 py-2">Performer Association</th>
                    <th className="px-3 py-2">Event Aggregate</th>
                    <th className="px-3 py-2">処理時間</th>
                    <th className="px-3 py-2">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {result.results.map((item, index) => {
                    const expanded = expandedRows.has(index);
                    const candidates = getAttachedImageCandidates(item.source_kind);
                    return (
                      <Fragment key={`${item.filename}-${index}`}>
                        <tr className={item.error ? "bg-red-50" : ""}>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => toggleRow(index)} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </td>
                          <td className="max-w-[260px] truncate px-3 py-2 font-medium text-slate-900">{item.filename}</td>
                          <td className="px-3 py-2 font-mono text-xs">{sourceKindName(item.source_kind)}</td>
                          <td className="px-3 py-2">{item.region_semantics.length}</td>
                          <td className="px-3 py-2 font-mono text-xs">{regionKindSummary(item)}</td>
                          <td className="max-w-[320px] truncate px-3 py-2 text-xs text-slate-700">{eventInfoSummary(item)}</td>
                          <td className="max-w-[320px] truncate px-3 py-2 text-xs text-slate-700">{performerListSummary(item)}</td>
                          <td className="max-w-[360px] truncate px-3 py-2 text-xs text-slate-700">{performerAssociationSummary(item)}</td>
                          <td className="max-w-[420px] truncate px-3 py-2 text-xs text-slate-700">{eventAggregateSummary(item)}</td>
                          <td className="px-3 py-2">{item.processing_time_ms.toFixed(1)} ms</td>
                          <td className="px-3 py-2">
                            {item.error ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">FAILED</span>
                            ) : (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">OK</span>
                            )}
                          </td>
                        </tr>
                        {expanded ? (
                          <tr>
                            <td colSpan={11} className="bg-slate-50 px-4 py-4">
                              <div className="grid gap-4 lg:grid-cols-2">
                                <div className="space-y-4">
                                  <div>
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">attached_image_candidates overlay</p>
                                    <AttachedImageCandidateOverlay
                                      imageUrl={previewUrls[index]}
                                      imageWidth={item.image_features?.width}
                                      imageHeight={item.image_features?.height}
                                      candidates={candidates}
                                    />
                                  </div>
                                  <div>
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">source_kind</p>
                                    <JsonView value={item.source_kind} />
                                  </div>
                                  <div>
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">document_structure.stats</p>
                                    <JsonView value={item.document_structure_stats} />
                                  </div>
                                  <div>
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">event_info_candidates</p>
                                    <JsonView value={item.event_info_candidates} />
                                  </div>
                                  <div>
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">performer_list_candidates</p>
                                    <JsonView value={item.performer_list_candidates} />
                                  </div>
                                  <div>
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">performer_associations</p>
                                    <JsonView value={item.performer_associations} />
                                  </div>
                                  <div>
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">event_aggregate_candidates</p>
                                    <JsonView value={item.event_aggregate_candidates} />
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">region_features / region_semantics</p>
                                    <JsonView value={item.region_semantics} />
                                  </div>
                                  <div>
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">raw result</p>
                                    <JsonView value={item} />
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
