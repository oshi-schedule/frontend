"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Loader2, ScanSearch } from "lucide-react";
import { ApiError } from "@/api/client";
import { reparseSourceForOCRTest, uploadSourceForOCRTest, type OCRTestWorkflowResponse } from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

function JsonView({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-[#f8fafc] p-3 text-xs leading-6 text-slate-700">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function AdminOCRTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<OCRTestWorkflowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ignoreCache, setIgnoreCache] = useState(false);
  const [dryRun, setDryRun] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const asset = result?.result.assets[0] ?? null;
  const extracted = result?.result.parsed.event ?? null;
  const llmExtraction = result?.result.parsed.llm_extraction ?? null;
  const resolution = result?.result.resolution ?? null;
  const lines = result?.result.parsed.lines ?? [];

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

  async function handleSubmit() {
    if (!file) return;

    setIsSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const source = await uploadSourceForOCRTest(file, { ignoreCache, dryRun });
      const reparsed = await reparseSourceForOCRTest(source.id);
      setResult(reparsed);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = typeof err.detail === "string"
          ? err.detail
          : JSON.stringify(err.detail, null, 2);
        setError(detail || err.message);
      } else {
        setError(err instanceof Error ? err.message : "OCR検証の実行に失敗しました");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin OCR Test"
        subtitle="NDLOCR → gpt-4o-mini → Event Core解決の精度を管理画面で確認します。"
        backHref="/admin"
      />

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon size={18} className="text-[var(--muted)]" />
          <h2 className="text-base font-semibold">画像アップロード</h2>
        </div>
        <Input
          type="file"
          accept={ACCEPT}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
            setError(null);
          }}
        />
        <div className="rounded-md border border-dashed border-[var(--border)] bg-white p-3 text-sm text-[var(--muted)]">
          {file ? `${file.name} / ${(file.size / 1024 / 1024).toFixed(2)} MB` : "画像を1枚選択してください"}
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
        <Button onClick={handleSubmit} disabled={!file || isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}
          {isSubmitting ? "検証実行中..." : "OCR検証を実行"}
        </Button>
        {error ? (
          <div className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
            {error}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-base font-semibold">1. アップロード画像</h2>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="OCR test upload preview" className="max-h-[420px] w-full rounded-md border object-contain" />
          ) : (
            <div className="rounded-md border border-dashed border-[var(--border)] p-8 text-sm text-[var(--muted)]">
              プレビューはここに表示されます
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold">2. pHash / 処理時間</h2>
          <JsonView
            value={{
              phash: asset?.phash ?? null,
              reused_existing_raw_input: asset?.reused_existing_raw_input ?? null,
              ignore_cache: asset?.ignore_cache ?? ignoreCache,
              dry_run: result?.result.dry_run ?? dryRun,
              processing_time_ms: result?.result.processing_time_ms ?? null,
            }}
          />
        </Card>

        <Card className="space-y-3 lg:col-span-2">
          <h2 className="text-base font-semibold">3. OCR結果</h2>
          <Textarea
            readOnly
            value={result?.result.parsed.raw_text ?? ""}
            placeholder="raw_text がここに表示されます"
            className="min-h-[260px] font-mono text-xs leading-6"
          />
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold">3-1. OCR行一覧</h2>
          <JsonView value={lines} />
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold">4. LLM抽出結果</h2>
          <JsonView
            value={{
              event_name: llmExtraction?.event_name ?? extracted?.display_name ?? null,
              event_date: llmExtraction?.event_date ?? extracted?.event_date ?? null,
              venue_name: llmExtraction?.venue_name ?? extracted?.venue_name ?? null,
              source_type: llmExtraction?.source_type ?? extracted?.source_type ?? null,
            }}
          />
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold">5. Event Core検索結果</h2>
          <JsonView value={eventCoreSearchResult} />
          {resolution?.duplicate_candidates?.length ? (
            <JsonView value={resolution.duplicate_candidates} />
          ) : null}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold">6. 作成結果</h2>
          <JsonView value={creationResult} />
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold">補足</h2>
          <JsonView
            value={{
              source_id: result?.source.id ?? null,
              event_id: result?.result.event_id ?? null,
              raw_input_ids: result?.result.raw_input_ids ?? [],
              parsing_result_id: result?.result.parsing_result_id ?? null,
              dry_run: result?.result.dry_run ?? false,
            }}
          />
        </Card>

        <Card className="space-y-3 lg:col-span-2">
          <h2 className="text-base font-semibold">NDLOCR JSON</h2>
          <p className="text-sm text-[var(--muted)]">
            `true` が OCR本文なのか JSON の補助情報なのかを確認するための生出力です。
          </p>
          <JsonView value={asset?.ndlocr_output ?? []} />
        </Card>
      </div>
    </div>
  );
}
