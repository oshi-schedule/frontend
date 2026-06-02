"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { ApiError } from "@/api/client";
import { runVisionEventStructureTest, type VisionEventStructureTestResponse } from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

function JsonView({ value }: { value: unknown }) {
  return <pre className="max-h-[520px] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100">{JSON.stringify(value, null, 2)}</pre>;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}

function textValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function numberValue(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "-";
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (typeof error.detail === "string") return error.detail;
    return JSON.stringify(error.detail);
  }
  return error instanceof Error ? error.message : String(error);
}

export default function VisionStructureTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [modelName, setModelName] = useState("gpt-5");
  const [sourceType, setSourceType] = useState("timetable");
  const [result, setResult] = useState<VisionEventStructureTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const containers = useMemo(() => result?.candidate.containers ?? [], [result]);
  const sessions = useMemo(() => result?.candidate.sessions ?? [], [result]);

  async function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setResult(null);
    setError(null);
    if (!nextFile) {
      setImageDataUrl(null);
      return;
    }
    setImageDataUrl(await readFileAsDataUrl(nextFile));
  }

  async function handleRun() {
    if (!imageDataUrl) {
      setError("画像を選択してください。");
      return;
    }
    setIsRunning(true);
    setError(null);
    try {
      const response = await runVisionEventStructureTest({
        image_data_url: imageDataUrl,
        source_type: sourceType || null,
        model_name: modelName || null,
      });
      setResult(response);
      if (!response.success && response.error) {
        setError(response.error);
      }
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vision Structure Test"
        subtitle="GPT Visionがタイムテーブル画像をどのcontainer treeとして読んだかを観測し、候補をDB保存します。"
        backHref="/admin"
      />

      <Card className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-600 hover:border-slate-500">
            <UploadCloud size={20} />
            <span>{file ? file.name : "画像を選択"}</span>
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
          <Input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="gpt-5" />
          <Input value={sourceType} onChange={(event) => setSourceType(event.target.value)} placeholder="timetable" />
          <Button type="button" onClick={handleRun} disabled={!imageDataUrl || isRunning}>
            {isRunning ? <Loader2 size={16} className="animate-spin" /> : null}
            Vision実行
          </Button>
        </div>

        <p className="text-xs leading-5 text-slate-500">
          EventLocation / EventStage / EventSession への正規化はまだ行いません。ここでは VisionEventStructureCandidate の原本を保存して観測します。
        </p>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Preview</h2>
          {imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageDataUrl} alt="vision structure input" className="mt-3 max-h-[720px] w-full rounded-lg object-contain" />
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">画像未選択</div>
          )}
        </Card>

        <div className="space-y-4">
          {result ? (
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {result.success ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-amber-600" />}
                <h2 className="text-base font-bold">Saved Candidate</h2>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{result.success ? "success" : "saved error log"}</span>
              </div>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">candidate_id</p>
                  <p className="break-all font-mono text-xs text-slate-700">{result.candidate_id}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">created_at</p>
                  <p>{result.created_at}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">model</p>
                  <p>{result.model_name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">prompt_version</p>
                  <p>{result.prompt_version}</p>
                </div>
              </div>
            </Card>
          ) : null}

          {result ? (
            <Card>
              <h2 className="text-base font-bold">Event</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">name</p>
                  <p className="font-semibold">{textValue(result.candidate.event?.name)}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">date</p>
                  <p className="font-semibold">{textValue(result.candidate.event?.date)}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">venue_text</p>
                  <p className="font-semibold">{textValue(result.candidate.event?.venue_text)}</p>
                </div>
              </div>
            </Card>
          ) : null}

          {result ? (
            <Card>
              <h2 className="text-base font-bold">Containers</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="border-b p-2">id</th>
                      <th className="border-b p-2">name</th>
                      <th className="border-b p-2">type</th>
                      <th className="border-b p-2">parent</th>
                      <th className="border-b p-2">confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {containers.length ? containers.map((container, index) => (
                      <tr key={`${textValue(container.id)}-${index}`}>
                        <td className="border-b p-2 font-mono text-xs">{textValue(container.id)}</td>
                        <td className="border-b p-2 font-semibold">{textValue(container.name)}</td>
                        <td className="border-b p-2">{textValue(container.container_type_hint)}</td>
                        <td className="border-b p-2 font-mono text-xs">{textValue(container.parent_id)}</td>
                        <td className="border-b p-2">{numberValue(container.confidence)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td className="p-3 text-slate-500" colSpan={5}>containers はありません。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {result ? (
            <Card>
              <h2 className="text-base font-bold">Sessions</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[840px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="border-b p-2">type</th>
                      <th className="border-b p-2">group</th>
                      <th className="border-b p-2">container</th>
                      <th className="border-b p-2">start</th>
                      <th className="border-b p-2">end</th>
                      <th className="border-b p-2">confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.length ? sessions.map((session, index) => (
                      <tr key={`${textValue(session.id)}-${index}`}>
                        <td className="border-b p-2">{textValue(session.session_type)}</td>
                        <td className="border-b p-2 font-semibold">{textValue(session.group_name || session.title)}</td>
                        <td className="border-b p-2 font-mono text-xs">{textValue(session.container_id)}</td>
                        <td className="border-b p-2">{textValue(session.start_time)}</td>
                        <td className="border-b p-2">{textValue(session.end_time)}</td>
                        <td className="border-b p-2">{numberValue(session.confidence)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td className="p-3 text-slate-500" colSpan={6}>sessions はありません。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {result ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-base font-bold">candidate JSON</h2>
            <JsonView value={result.candidate} />
          </Card>
          <Card>
            <h2 className="mb-3 text-base font-bold">raw / metadata JSON</h2>
            <JsonView value={{ raw_model_output: result.raw_model_output, execution_metadata: result.execution_metadata }} />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
