"use client";

import { Cpu, ImageIcon, Loader2, ScanText } from "lucide-react";
import { useState } from "react";
import { postOCRBackendTest, type OCRBackendSuccess } from "@/api/ocr-backend";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";


const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";


function seconds(value: number | undefined, digits = 3) {
  return typeof value === "number" ? `${value.toFixed(digits)} sec` : "-";
}

function percent(value: number | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "-";
}


export default function OCRTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [result, setResult] = useState<OCRBackendSuccess | null>(null);
  const [upstream, setUpstream] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!file) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await postOCRBackendTest(file);
      setUpstream(response.upstream);
      if (response.payload.status === "error") {
        throw new Error(response.payload.message);
      }
      setResult(response.payload);
      setRawText(response.payload.data.ocr_text);
    } catch (err) {
      setRawText("");
      setResult(null);
      setError(err instanceof Error ? err.message : "OCRの実行に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="OCR Backend Test"
        subtitle="OCR専用VMへ画像をアップロードして、NDLOCR Liteの生結果と処理メトリクスを確認します。"
        backHref="/"
      />

      <Card className="space-y-5">
        <div className="flex items-center gap-2">
          <ImageIcon size={18} className="text-[var(--muted)]" />
          <h2 className="text-base font-semibold">画像アップロード</h2>
        </div>

        <div className="space-y-2">
          <label htmlFor="ocr-file" className="text-sm font-medium">
            対応形式
          </label>
          <p className="text-sm text-[var(--muted)]">jpg / jpeg / png / webp</p>
          <Input
            id="ocr-file"
            type="file"
            accept={ACCEPT}
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setFile(nextFile);
              setError(null);
            }}
          />
        </div>

        <div className="rounded-lg border border-dashed border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
          {file ? (
            <div className="space-y-1">
              <p className="font-medium text-[var(--foreground)]">{file.name}</p>
              <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <p>まずは OCR したい画像を1枚選択してください。</p>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={!file || isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ScanText size={16} />}
          {isSubmitting ? "OCR実行中..." : "OCR専用VMで実行"}
        </Button>

        {error ? (
          <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
            {error}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Cpu size={18} className="text-[var(--muted)]" />
          <h2 className="text-base font-semibold">OCR Backend Metrics</h2>
        </div>
        {result ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[var(--muted)]">Upstream</dt>
              <dd className="break-all font-semibold text-[var(--foreground)]">{upstream}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Request ID</dt>
              <dd className="break-all font-semibold text-[var(--foreground)]">{result.request_id}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Engine</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {result.data.engine}@{result.data.engine_version}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Elapsed</dt>
              <dd className="font-semibold text-[var(--foreground)]">{seconds(result.data.elapsed_seconds, 2)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Queue Wait</dt>
              <dd className="font-semibold text-[var(--foreground)]">{seconds(result.data.queue_wait_seconds ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Active OCR</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {result.data.active_ocr_count ?? "-"} / {result.data.max_concurrent_ocr ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">CPU Avg</dt>
              <dd className="font-semibold text-[var(--foreground)]">{percent(result.data.cpu_percent_avg ?? result.data.cpu_percent)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">CPU Max</dt>
              <dd className="font-semibold text-[var(--foreground)]">{percent(result.data.cpu_percent_max)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Child CPU</dt>
              <dd className="font-semibold text-[var(--foreground)]">{seconds(result.data.child_cpu_seconds)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Child CPU Util</dt>
              <dd className="font-semibold text-[var(--foreground)]">{percent(result.data.child_cpu_utilization_percent)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Memory</dt>
              <dd className="font-semibold text-[var(--foreground)]">{percent(result.data.memory_percent)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-[var(--muted)]">OCR実行後に専用VMのメトリクスが表示されます。</p>
        )}
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Timing Breakdown</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">OCR専用VM内の処理時間を段階別に表示します。</p>
        </div>
        {result ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <dt className="text-[var(--muted)]">File Save</dt>
              <dd className="font-semibold text-[var(--foreground)]">{seconds(result.data.timings?.file_save)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Queue Wait</dt>
              <dd className="font-semibold text-[var(--foreground)]">{seconds(result.data.timings?.queue_wait)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">OCR Subprocess</dt>
              <dd className="font-semibold text-[var(--foreground)]">{seconds(result.data.timings?.ocr_subprocess)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">JSON Parse</dt>
              <dd className="font-semibold text-[var(--foreground)]">{seconds(result.data.timings?.json_parse)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Total</dt>
              <dd className="font-semibold text-[var(--foreground)]">{seconds(result.data.timings?.total)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-[var(--muted)]">OCR実行後に処理時間の内訳が表示されます。</p>
        )}
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">OCR Raw Text</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            後段の整形はせず、OCR専用VMのNDLOCR Liteから取り出したテキストを表示します。
          </p>
        </div>

        <Textarea
          value={rawText}
          readOnly
          placeholder="OCR結果がここに表示されます"
          className="min-h-[320px] font-mono text-xs leading-6"
        />
      </Card>
    </div>
  );
}
