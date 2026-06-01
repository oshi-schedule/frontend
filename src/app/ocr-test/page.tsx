"use client";

import { ImageIcon, Loader2, ScanText } from "lucide-react";
import { useState } from "react";
import { postOCRTest } from "@/api/ocr";
import { ApiError } from "@/api/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";


const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";


export default function OCRTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!file) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await postOCRTest(file);
      setRawText(result.raw_text);
    } catch (err) {
      setRawText("");
      if (err instanceof ApiError) {
        const detail = typeof err.detail === "string" ? err.detail : null;
        setError(detail ?? err.message);
      } else {
        setError(err instanceof Error ? err.message : "OCRの実行に失敗しました");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="OCR Test"
        subtitle="イベントビラやタイムテーブル画像をアップロードして、生のOCR結果をそのまま確認します。"
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
          {isSubmitting ? "OCR実行中..." : "OCRを実行"}
        </Button>

        {error ? (
          <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
            {error}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">OCR Raw Text</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            後段の整形はせず、PaddleOCR から取り出したテキストを改行結合して表示します。
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
