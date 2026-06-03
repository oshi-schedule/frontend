"use client";

import { ChangeEvent, ElementType, FormEvent, useMemo, useState } from "react";
import { Clock3, FileImage, Loader2, Server, Sparkles } from "lucide-react";
import { runEventCandidateBenchmark, type EventCandidateBenchmarkResult } from "@/api/ndlocr-qwen-benchmark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

const candidateFields: Array<{
  key: keyof EventCandidateBenchmarkResult["event_candidate"];
  label: string;
}> = [
  { key: "event_name", label: "event_name" },
  { key: "venue_name", label: "venue_name" },
  { key: "event_date", label: "event_date" },
  { key: "open_time", label: "open_time" },
  { key: "start_time", label: "start_time" },
];

function formatMs(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString()} ms`;
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: ElementType }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-700">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      </div>
    </Card>
  );
}

export default function NdlocrQwenBenchmarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<EventCandidateBenchmarkResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileLabel = useMemo(() => {
    if (!file) return "画像を選択してください";
    return `${file.name} (${Math.round(file.size / 1024).toLocaleString()} KB)`;
  }, [file]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.currentTarget.files?.[0] ?? null;
    setFile(nextFile);
    setResult(null);
    setErrorMessage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setIsSubmitting(true);
    setResult(null);
    setErrorMessage(null);

    try {
      const data = await runEventCandidateBenchmark(file);
      setResult(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Benchmark failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">PoC Benchmark</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">NDLOCR + Qwen Event Candidate</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Vast.ai上のNDLOCR ver2とOllama qwen3:4bで、OCR時間・LLM時間・単発抽出品質を確認します。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">入力</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">画像1枚をアップロードして単発実行します。</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <FileImage size={16} />
                {fileLabel}
              </span>
              <Input className="mt-3" type="file" accept={ACCEPT} onChange={handleFileChange} />
            </label>

            {previewUrl ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="upload preview" className="max-h-[360px] w-full object-contain" />
              </div>
            ) : null}

            <Button type="submit" disabled={!file || isSubmitting} className="w-full bg-teal-700 text-white hover:bg-teal-800">
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isSubmitting ? "実行中..." : "Benchmark実行"}
            </Button>
          </form>

          {errorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="OCR Time" value={formatMs(result?.metrics.ocr_ms)} icon={Clock3} />
            <MetricCard label="LLM Time" value={formatMs(result?.metrics.llm_ms)} icon={Server} />
            <MetricCard label="Total Time" value={formatMs(result?.metrics.total_ms)} icon={Clock3} />
          </div>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Event Candidate</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">Qwen3-4BがOCRテキストから抽出したJSONです。</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {candidateFields.map((field) => (
                <div key={field.key} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold text-slate-500">{field.label}</p>
                  <p className="mt-1 min-h-6 break-words text-sm font-bold text-slate-900">
                    {result?.event_candidate[field.key] || "-"}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-slate-900">OCR結果</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">NDLOCRから返ったテキストです。品質確認用にそのまま表示します。</p>
            </div>
            <Textarea readOnly value={result?.ocr_text ?? ""} className="min-h-[360px] font-mono text-xs leading-relaxed" />
          </Card>
        </div>
      </div>
    </div>
  );
}
