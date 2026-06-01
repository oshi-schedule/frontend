import { apiFetch } from "@/api/client";
import type { SourceRead } from "@/types/api";

export interface OCRTestReparseResult {
  source_id: string;
  event_id: string | null;
  ocr_result_ids: string[];
  raw_input_ids: Array<string | null>;
  parsing_result_id: string | null;
  dry_run: boolean;
  processing_time_ms: number;
  parsed: {
    raw_text: string;
    lines: string[];
    llm_extraction: {
      event_name: string;
      event_date: string;
      venue_name: string;
      source_type: "flyer" | "timetable" | "x_post" | "meet_and_greet";
    };
    event: {
      display_name: string | null;
      event_date: string | null;
      venue_name: string | null;
      venue_id: string | null;
      source_type?: "flyer" | "timetable" | "x_post" | "meet_and_greet" | null;
    };
    confidence: number;
  };
  resolution: {
    action: "matched_existing" | "created_event" | "candidate";
    event_id: string | null;
    persisted?: boolean;
    dry_run?: boolean;
    would_create_event?: boolean;
    duplicate_candidates: Array<{
      id: string;
      display_name: string;
      event_date: string;
      venue_id: string | null;
      score: number;
      reason: string;
    }>;
    reason: string;
  };
  assets: Array<{
    asset_id: string;
    raw_input_id: string;
    phash: string;
    reused_existing_raw_input: boolean;
    ignore_cache: boolean;
    dry_run: boolean;
    image_path: string;
    ndlocr_output: Array<{
      file: string;
      payload: unknown;
    }>;
  }>;
}

export interface OCRTestWorkflowResponse {
  source: SourceRead;
  result: OCRTestReparseResult;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}

export async function uploadSourceForOCRTest(file: File, options?: { ignoreCache?: boolean; dryRun?: boolean }) {
  const dataUrl = await readFileAsDataUrl(file);
  return apiFetch<SourceRead>("/sources/upload", {
    method: "POST",
    body: JSON.stringify({
      source_type: "flyer",
      source_url: null,
      metadata_json: {
        filename: file.name,
        content_type: file.type,
        size: file.size,
        ignore_cache: options?.ignoreCache ?? false,
        dry_run: options?.dryRun ?? false,
      },
      assets: [
        {
          asset_type: "image",
          storage_url: dataUrl,
          checksum: null,
        },
      ],
    }),
  });
}

export function reparseSourceForOCRTest(sourceId: string) {
  return apiFetch<OCRTestWorkflowResponse>(`/sources/${sourceId}/reparse`, {
    method: "POST",
  });
}
