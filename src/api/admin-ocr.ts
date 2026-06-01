import { apiFetch } from "@/api/client";
import type { SourceRead } from "@/types/api";

export type OCRTestSourceType = "flyer" | "timetable" | "x_post" | "meet_and_greet";
export type OCRUploadSessionItemSourceType = OCRTestSourceType | "other";

export interface SourceTypeTopCandidate {
  source_type: string;
  score: number;
}

export interface SourceTypeAudit {
  llm_source_type: string;
  rule_source_type: string;
  rule_confidence: number;
  conflict: boolean;
  score_gap: number;
  signals: Record<string, number>;
  top_candidates: SourceTypeTopCandidate[];
}

export interface OCRTestReparseResult {
  source_id: string;
  event_id: string | null;
  ocr_result_ids: string[];
  raw_input_ids: Array<string | null>;
  parsing_result_id: string | null;
  parsing_result_ids: string[];
  session_id: string | null;
  dry_run: boolean;
  processing_time_ms: number;
  ground_truth?: OCRTestGroundTruth | null;
  parsed: {
    raw_text: string;
    lines: string[];
    llm_extraction: {
      event_name: string;
      event_date: string;
      venue_name: string;
      source_type: OCRTestSourceType;
    };
    event: {
      display_name: string | null;
      event_date: string | null;
      venue_name: string | null;
      venue_id: string | null;
      source_type?: OCRTestSourceType | null;
    };
    confidence: number;
    source_type_audit: SourceTypeAudit | null;
    ground_truth: OCRTestGroundTruth | null;
    canonical_document?: unknown;
    session?: OCRUploadSessionAggregationDecision;
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
    ocr_result_id?: string;
    parsing_result_id?: string;
    raw_input_id: string | null;
    phash: string;
    reused_existing_raw_input: boolean;
    ignore_cache: boolean;
    dry_run: boolean;
    image_path: string;
    ocr_text?: string;
    confidence?: number;
    source_type?: OCRTestSourceType;
    canonical_document?: any;
    parsed?: any;
    structured_data?: Record<string, unknown> | null;
    ndlocr_output: Array<{
      file: string;
      payload: unknown;
    }>;
  }>;
  session?: OCRUploadSession;
}

export interface OCRTestWorkflowResponse {
  source: SourceRead;
  result: OCRTestReparseResult;
}

export interface OCRTestGroundTruth {
  id: string;
  event_parsing_result_id: string;
  event_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  source_type: OCRTestSourceType | null;
  created_at: string;
  updated_at: string;
}

export interface OCRUploadSessionAggregation {
  event_name_candidates: string[];
  date_candidates: string[];
  venue_candidates: string[];
  source_type_candidates: OCRUploadSessionItemSourceType[];
}

export interface OCRUploadSessionAggregationDecision {
  event_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  source_type: OCRUploadSessionItemSourceType;
  confidence: number;
  reasons: string[];
  selected_item_id: string | null;
  selected_item_source_type: OCRUploadSessionItemSourceType | null;
}

export interface OCRUploadSessionItem {
  id: string;
  session_id: string;
  parsing_result_id: string;
  source_type: OCRUploadSessionItemSourceType;
  event_name: string | null;
  event_date_str: string | null;
  venue_name: string | null;
  confidence: number | null;
  ocr_text: string | null;
  structured_data: Record<string, unknown> | null;
}

export interface OCRUploadSession {
  id: string;
  created_at: string;
  event_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  event_core_id: string | null;
  items: OCRUploadSessionItem[];
  aggregation: OCRUploadSessionAggregation;
  decision: OCRUploadSessionAggregationDecision | null;
}

export interface OCRUploadSessionCreatePayload {
  event_name?: string | null;
  event_date?: string | null;
  venue_name?: string | null;
  event_core_id?: string | null;
}

export interface OCRUploadSessionUpdatePayload {
  event_name?: string | null;
  event_date?: string | null;
  venue_name?: string | null;
  event_core_id?: string | null;
}

export interface OCRUploadSessionItemCreatePayload {
  parsing_result_id: string;
  source_type: OCRUploadSessionItemSourceType;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}

export async function uploadSourceForOCRTest(files: File[], options?: { ignoreCache?: boolean; dryRun?: boolean }) {
  if (files.length === 0) {
    throw new Error("少なくとも1枚の画像を選択してください");
  }
  if (files.length > 4) {
    throw new Error("画像は最大4枚までです");
  }
  const dataUrls = await Promise.all(files.map((file) => readFileAsDataUrl(file)));
  return apiFetch<SourceRead>("/sources/upload", {
    method: "POST",
    body: JSON.stringify({
      source_type: "flyer",
      source_url: null,
      original_filename: files.map((file) => file.name).join(", "),
      assets: dataUrls.map((dataUrl) => ({
        asset_type: "image",
        storage_url: dataUrl,
        checksum: null,
      })),
    }),
  });
}

export function reparseSourceForOCRTest(sourceId: string) {
  return apiFetch<OCRTestWorkflowResponse>(`/sources/${sourceId}/reparse`, {
    method: "POST",
  });
}

export function saveOCRTestGroundTruth(
  parsingResultId: string,
  payload: {
    event_name: string | null;
    event_date: string | null;
    venue_name: string | null;
    source_type: OCRTestSourceType | null;
  },
) {
  return apiFetch<OCRTestGroundTruth>(`/admin/ocr-test/${parsingResultId}/ground-truth`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function listOCRUploadSessions(limit = 50) {
  return apiFetch<OCRUploadSession[]>("/admin/ocr-upload-sessions", {
    query: { limit },
  });
}

export function createOCRUploadSession(payload: OCRUploadSessionCreatePayload) {
  return apiFetch<OCRUploadSession>("/admin/ocr-upload-sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getOCRUploadSession(sessionId: string) {
  return apiFetch<OCRUploadSession>(`/admin/ocr-upload-sessions/${sessionId}`);
}

export function updateOCRUploadSession(sessionId: string, payload: OCRUploadSessionUpdatePayload) {
  return apiFetch<OCRUploadSession>(`/admin/ocr-upload-sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function addOCRUploadSessionItem(sessionId: string, payload: OCRUploadSessionItemCreatePayload) {
  return apiFetch<OCRUploadSessionItem>(`/admin/ocr-upload-sessions/${sessionId}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
