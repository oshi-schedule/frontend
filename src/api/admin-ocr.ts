import { apiFetch } from "@/api/client";
import type { SourceRead } from "@/types/api";

export type OCRTestSourceType = "flyer" | "schedule_document" | "x_post" | "other" | "timetable" | "meet_and_greet";
export type OCRUploadSessionItemSourceType = OCRTestSourceType;

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
    event_candidates?: OCRImageEventCandidate[];
    live_sessions?: Array<Record<string, unknown>>;
    meet_and_greet_sessions?: Array<Record<string, unknown>>;
    session?: OCRUploadSession | null;
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
    source_asset_id?: string;
    raw_input_id: string | null;
    phash: string;
    reused_existing_raw_input: boolean;
    ignore_cache: boolean;
    dry_run: boolean;
    image_path: string;
    image_features?: {
      width?: number;
      height?: number;
      aspect_ratio?: number;
    };
    ocr_text?: string;
    ocr_tokens?: Array<Record<string, unknown>>;
    document_structure?: Record<string, unknown> | null;
    source_kind?: Record<string, unknown> | null;
    confidence?: number;
    source_type?: OCRTestSourceType;
    canonical_document?: any;
    parsed?: any;
    structured_data?: Record<string, unknown> | null;
    event_candidates?: OCRImageEventCandidate[];
    live_sessions?: Array<Record<string, unknown>>;
    meet_and_greet_sessions?: Array<Record<string, unknown>>;
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
  image_candidates: OCRImageEventCandidate[];
  event_candidates: OCRCanonicalEventCandidate[];
  canonical_event_candidate: OCRCanonicalEventCandidate | null;
  event_name_candidates: string[];
  date_candidates: string[];
  venue_candidates: string[];
  source_type_candidates: OCRUploadSessionItemSourceType[];
}

export interface OCRImageEventCandidate {
  event_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  source_type: OCRUploadSessionItemSourceType;
  confidence: number;
  notes?: string[];
}

export interface OCRCanonicalEventCandidate {
  event_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  source_type: OCRUploadSessionItemSourceType;
  source_count: number;
  confidence: number;
  reasons: string[];
  selected_item_id?: string | null;
  selected_item_source_type?: OCRUploadSessionItemSourceType | null;
  live_sessions: Array<Record<string, unknown>>;
  meet_and_greet_sessions: Array<Record<string, unknown>>;
  source_asset_ids: string[];
  parsing_result_ids: string[];
}

export interface OCRUploadSessionStructuredResult {
  event_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  event_core_id: string | null;
}

export interface OCRUploadSessionRevision {
  id: string;
  session_id: string;
  revision: number;
  ai_extracted_result: OCRUploadSessionStructuredResult;
  human_reviewed_result: OCRUploadSessionStructuredResult;
  final_result: OCRUploadSessionStructuredResult;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OCRUploadSessionEventCoreCandidate {
  event_core_id: string;
  event_name: string;
  event_date: string;
  venue_name: string | null;
  match_score: number;
  match_reasons: string[];
}

export interface OCRUploadSessionEventCoreResolution {
  canonical_event_candidate: OCRCanonicalEventCandidate | null;
  event_core_candidates: OCRUploadSessionEventCoreCandidate[];
  selected_event_core_candidate: OCRUploadSessionEventCoreCandidate | null;
}

export interface OCRTimetableScheduleItem {
  id?: string | null;
  item_kind: "live" | "meet_and_greet";
  title: string | null;
  performer_name: string | null;
  stage_name: string | null;
  booth_name: string | null;
  start_time: string | null;
  end_time: string | null;
  confidence?: number | null;
  source_extraction_id?: string | null;
  source_schedule_item_id?: string | null;
}

export interface OCRTimetableReviewResult {
  live_sessions: OCRTimetableScheduleItem[];
  meet_and_greet_sessions: OCRTimetableScheduleItem[];
}

export interface OCRVisionStructureExtraction {
  id: string;
  session_id: string;
  session_item_id: string | null;
  parsing_result_id: string | null;
  model_name: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  inference_time_ms: number | null;
  estimated_cost_usd: number | null;
  status: string;
  error_message: string | null;
  live_sessions: OCRTimetableScheduleItem[];
  meet_and_greet_sessions: OCRTimetableScheduleItem[];
  created_at: string;
}

export interface OCRVisionEvaluationRun {
  id: string;
  session_id: string;
  session_item_id: string | null;
  image_id: string | null;
  parsing_result_id: string | null;
  model_name: "gpt-4o" | "gpt-5-mini" | "gpt-5" | string;
  source_type: OCRUploadSessionItemSourceType | null;
  vision_called: boolean;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  live_session_count: number;
  meet_and_greet_count: number;
  human_score: number | null;
  status: string;
  error_message: string | null;
  live_sessions: OCRTimetableScheduleItem[];
  meet_and_greet_sessions: OCRTimetableScheduleItem[];
  output: OCRTimetableReviewResult;
  created_at: string;
  updated_at: string;
}

export interface OCRTimetableReviewRevision {
  id: string;
  session_id: string;
  revision: number;
  ai_extracted_result: OCRTimetableReviewResult;
  human_reviewed_result: OCRTimetableReviewResult;
  final_result: OCRTimetableReviewResult;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OCRTimetableReviewState {
  revisions: OCRTimetableReviewRevision[];
  latest_revision: OCRTimetableReviewRevision | null;
}

export interface OCRUploadSessionItem {
  id: string;
  session_id: string;
  parsing_result_id: string;
  image_id: string | null;
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
  decision: OCRCanonicalEventCandidate | null;
  canonical_event_candidate: OCRCanonicalEventCandidate | null;
  revisions: OCRUploadSessionRevision[];
  latest_revision: OCRUploadSessionRevision | null;
  event_core_resolution: OCRUploadSessionEventCoreResolution;
  vision_structure_extractions: OCRVisionStructureExtraction[];
  vision_evaluation_runs: OCRVisionEvaluationRun[];
  timetable_review: OCRTimetableReviewState;
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

export interface OCRUploadSessionReviewUpsertPayload {
  event_name?: string | null;
  event_date?: string | null;
  venue_name?: string | null;
}

export interface OCRUploadSessionConfirmEventCorePayload {
  mode: "create_new" | "link_existing";
  event_core_id?: string | null;
  event_name?: string | null;
  event_date?: string | null;
  venue_name?: string | null;
}

export interface OCRTimetableReviewUpsertPayload {
  live_sessions: OCRTimetableScheduleItem[];
  meet_and_greet_sessions: OCRTimetableScheduleItem[];
}

export interface OCRVisionEvaluationRunCreatePayload {
  session_item_id: string;
  model_name: "gpt-4o" | "gpt-5-mini" | "gpt-5";
}

export interface OCREvaluationRegionSemantic {
  region_id: string | null;
  label: string | null;
  bbox: Record<string, number> | null;
  features: Record<string, unknown>;
  semantic: {
    kind?: string;
    confidence?: number;
    reasons?: string[];
    source_features?: Record<string, unknown>;
    classifier?: string;
  };
  row_indexes: number[];
  column_indexes: number[];
  detection_method: string | null;
  heuristics: string[];
}

export interface OCREvaluationExtractedCandidate {
  candidate_type: string;
  source_region_id: string;
  values: Record<string, unknown>;
  confidence: number;
  reasons: string[];
  raw_text: string;
  source_node_ids: string[];
}

export interface OCREvaluationResultItem {
  filename: string;
  source_kind: Record<string, unknown> | null;
  image_features: {
    width?: number;
    height?: number;
    aspect_ratio?: number;
  } | null;
  document_structure_stats: Record<string, number>;
  region_semantics: OCREvaluationRegionSemantic[];
  event_info_candidates: OCREvaluationExtractedCandidate[];
  extracted_candidates: OCREvaluationExtractedCandidate[];
  document_structure: Record<string, unknown> | null;
  ocr_tokens: Array<Record<string, unknown>>;
  raw_text: string | null;
  processing_time_ms: number;
  error: string | null;
}

export interface OCREvaluationJobResponse {
  job_id: string;
  status: "queued" | "running" | "completed" | "failed";
  total: number;
  completed: number;
  current_filename: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  summary: {
    total: number;
    success: number;
    failed: number;
    source_kind_counts: Record<string, number>;
    region_kind_counts: Record<string, number>;
    unknown_region_analysis?: {
      count: number;
      labels: Record<string, number>;
      row_count_distribution: Record<string, number>;
      column_count_distribution: Record<string, number>;
      contains_time_ratio_distribution: Record<string, number>;
      samples: Array<Record<string, unknown>>;
    };
  };
  results: OCREvaluationResultItem[];
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

export function evaluateOCRImages(files: File[]) {
  if (files.length === 0) {
    throw new Error("少なくとも1枚の画像を選択してください");
  }
  if (files.length > 100) {
    throw new Error("画像は最大100枚までです");
  }
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  return apiFetch<OCREvaluationJobResponse>("/admin/ocr/evaluate", {
    method: "POST",
    body: formData,
  });
}

export function getOCREvaluationJob(jobId: string) {
  return apiFetch<OCREvaluationJobResponse>(`/admin/ocr/evaluate/${jobId}`);
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

export function saveOCRUploadSessionReview(sessionId: string, payload: OCRUploadSessionReviewUpsertPayload) {
  return apiFetch<OCRUploadSession>(`/admin/ocr-upload-sessions/${sessionId}/review`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function confirmOCRUploadSessionEventCore(sessionId: string, payload: OCRUploadSessionConfirmEventCorePayload) {
  return apiFetch<OCRUploadSession>(`/admin/ocr-upload-sessions/${sessionId}/confirm-event-core`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveOCRUploadSessionTimetableReview(sessionId: string, payload: OCRTimetableReviewUpsertPayload) {
  return apiFetch<OCRUploadSession>(`/admin/ocr-upload-sessions/${sessionId}/timetable-review`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function runOCRVisionEvaluation(sessionId: string, payload: OCRVisionEvaluationRunCreatePayload) {
  return apiFetch<OCRUploadSession>(`/admin/ocr-upload-sessions/${sessionId}/vision-evaluation-runs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateOCRVisionEvaluationHumanScore(runId: string, humanScore: number | null) {
  return apiFetch<OCRVisionEvaluationRun>(`/admin/ocr-vision-evaluation-runs/${runId}/human-score`, {
    method: "PATCH",
    body: JSON.stringify({ human_score: humanScore }),
  });
}
