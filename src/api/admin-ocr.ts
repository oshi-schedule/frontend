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
    session_event_candidate?: OCREvaluationEventAggregateCandidate | null;
    fallback_aggregation_candidate?: OCREvaluationEventAggregateCandidate | null;
    candidate_generation_method?: string | null;
    candidate_model?: string | null;
    candidate_version?: string | null;
    candidate_generation_error?: string | null;
    ocr_raw_texts?: Array<{
      source_asset_id?: string | null;
      parsing_result_id?: string | null;
      source_type?: OCRTestSourceType | string | null;
      raw_text: string;
      layout_graph?: Record<string, unknown> | null;
    }>;
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

export interface OCRReparseJobResponse {
  job_id: string;
  source_id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  message: string;
  current_step: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  result: OCRTestWorkflowResponse | null;
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
  candidate_generation_method?: string | null;
  candidate_model?: string | null;
  candidate_version?: string | null;
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

export interface VisionEventStructureTestRequest {
  image_data_url: string;
  source_asset_id?: string | null;
  source_type?: string | null;
  model_name?: string | null;
}

export interface VisionEventStructureTestResponse {
  success: boolean;
  candidate_id: string;
  created_at: string;
  model_name: string;
  prompt_version: string;
  candidate: {
    event?: Record<string, unknown>;
    containers?: Array<Record<string, unknown>>;
    sessions?: Array<Record<string, unknown>>;
    warnings?: string[];
    [key: string]: unknown;
  };
  raw_model_output: Record<string, unknown>;
  execution_metadata: Record<string, unknown>;
  image_hash: string;
  error: string | null;
}

export type TrainingDatasetMode = "single" | "multi";
export type TrainingDatasetJobStatus = "queued" | "running" | "completed" | "failed";

export interface TrainingEventCandidateRead {
  id: string;
  job_id: string;
  source_id: string | null;
  upload_session_id: string | null;
  contributor_id?: string | null;
  contributor_name?: string | null;
  contributor_role?: string | null;
  source_type: string | null;
  source_type_hint?: string | null;
  predicted_source_type?: string | null;
  processing_route?: string | null;
  extraction_plan?: Record<string, unknown> | null;
  single_multi: TrainingDatasetMode | string;
  input_payload_json: Record<string, unknown>;
  prediction_json: Record<string, unknown>;
  ground_truth_json: Record<string, unknown> | null;
  review_status: string;
  reviewer: string | null;
  reviewed_at: string | null;
  review_revisions?: TrainingEventCandidateReviewRevisionRead[];
  gpt_reviews?: TrainingCandidateGptReviewRead[];
  created_at: string;
  updated_at: string;
}

export interface TrainingEventCandidateReviewRevisionRead {
  id: string;
  training_candidate_id: string;
  revision: number;
  review_status: string;
  reviewer: string | null;
  ground_truth_before_json: Record<string, unknown> | null;
  ground_truth_after_json: Record<string, unknown>;
  change_set_json: Array<Record<string, unknown>>;
  model_eval_metadata_json: Record<string, unknown> | null;
  review_metadata_json: Record<string, unknown> | null;
  review_seconds: number | null;
  note: string | null;
  created_at: string;
}

export interface TrainingCandidateGptReviewRead {
  id: string;
  training_candidate_id: string;
  review_model: string;
  review_prompt_version: string;
  review_result_json: Record<string, unknown>;
  input_payload_json: Record<string, unknown>;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  latency_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface TrainingCandidateGptFixChange {
  section: "venues" | "group_candidates" | "sessions" | string;
  operation: "add" | "remove" | "replace" | string;
  index: number | null;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  confidence: number | null;
}

export interface TrainingCandidateGptFixResponse {
  model: string;
  prompt_version: string;
  changes: TrainingCandidateGptFixChange[];
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  latency_ms: number | null;
  raw_result_json: Record<string, unknown>;
}

export interface TrainingDatasetJobRead {
  job_id: string;
  status: TrainingDatasetJobStatus | string;
  progress: number;
  message: string;
  current_step: string | null;
  mode: TrainingDatasetMode | string;
  total_files: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  candidate_id: string | null;
  candidate: TrainingEventCandidateRead | null;
}

export interface TrainingCandidateBenchmarkRunRead {
  id: string;
  training_candidate_id: string;
  route_name: string;
  route_version: string;
  model_name: string;
  input_payload_json: Record<string, unknown>;
  prediction_json: Record<string, unknown>;
  ground_truth_json: Record<string, unknown> | null;
  metrics_json: Record<string, unknown> | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface TrainingBenchmarkJobRead {
  job_id: string;
  candidate_id: string;
  status: TrainingDatasetJobStatus | string;
  progress: number;
  message: string;
  current_step: string | null;
  routes: string[];
  models: string[];
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  runs: TrainingCandidateBenchmarkRunRead[];
}

export interface TrainingCandidateBenchmarkRunListResponse {
  items: TrainingCandidateBenchmarkRunRead[];
}

export interface TrainingCandidateBenchmarkRead {
  id: string;
  candidate_id: string;
  benchmark_type: string;
  benchmark_model: string;
  benchmark_version: string;
  status: "pending" | "running" | "completed" | "failed" | string;
  rq_job_id: string | null;
  input_payload_json: Record<string, unknown>;
  current_prediction_json: Record<string, unknown>;
  prediction_json: Record<string, unknown>;
  ground_truth_json: Record<string, unknown> | null;
  metrics_json: Record<string, unknown> | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  estimated_cost_usd: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingCandidateBenchmarkCandidateItem {
  candidate: TrainingEventCandidateRead;
  image_asset_ids: string[];
  latest_benchmark: TrainingCandidateBenchmarkRead | null;
}

export interface TrainingCandidateBenchmarkCandidateListResponse {
  items: TrainingCandidateBenchmarkCandidateItem[];
}

export interface TrainingCandidateBenchmarkCandidateDetailResponse extends TrainingCandidateBenchmarkCandidateItem {
  benchmarks: TrainingCandidateBenchmarkRead[];
}

export interface TrainingCandidateBenchmarkRunAllResponse {
  created: TrainingCandidateBenchmarkRead[];
  created_count: number;
  skipped_candidate_ids: string[];
}

export interface TrainingCandidateBenchmarkStats {
  benchmark_type: string;
  benchmark_model: string | null;
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  comparison: Record<string, {
    total?: number;
    current_correct?: number;
    gpt_correct?: number;
    current_accuracy?: number | null;
    gpt_accuracy?: number | null;
  }>;
}

export interface TrainingDatasetCandidateListResponse {
  items: TrainingEventCandidateRead[];
}

export interface ContributorTokenRead {
  id: string;
  contributor_name: string;
  role: string;
  is_active: boolean;
  upload_count: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface ContributorTokenCreateResponse {
  contributor: ContributorTokenRead;
  token: string;
}

export interface ContributorTokenListResponse {
  items: ContributorTokenRead[];
}

export interface TrainingDatasetStats {
  total: number;
  pending: number;
  ground_truth_saved: number;
  rejected: number;
  ready_for_training: number;
  field_correction_stats: Record<string, {
    reviewed_count: number;
    edited_count: number;
    edit_rate: number;
  }>;
  source_type_review_stats: {
    reviewed_count?: number;
    correct_count?: number;
    accuracy?: number;
    predicted_counts?: Record<string, number>;
    correct_counts?: Record<string, number>;
    confusion_matrix?: Record<string, Record<string, number>>;
    mismatches?: Array<Record<string, unknown>>;
  };
  item_source_type_review_stats: {
    reviewed_count?: number;
    correct_count?: number;
    accuracy?: number;
    predicted_counts?: Record<string, number>;
    correct_counts?: Record<string, number>;
    confusion_matrix?: Record<string, Record<string, number>>;
    mismatches?: Array<Record<string, unknown>>;
  };
  session_linked_reviews: number;
  unlinked_reviews: number;
  single_image_sessions: number;
  multi_image_sessions: number;
  source_type_counts: Record<string, number>;
  processing_route_counts: Record<string, number>;
  mode_counts: Record<string, number>;
  contributor_counts: Record<string, number>;
  reviewer_counts: Record<string, number>;
  route_quality_stats: Record<string, unknown>;
  model_quality_stats: Record<string, unknown>;
  review_time_stats: Record<string, unknown>;
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

export interface OCREvaluationGroupCandidate {
  group_name: string;
  score: number;
  match_method: string;
}

export interface OCREvaluationPerformerAssociation {
  candidate_type: string;
  source_region_id: string;
  source_node_ids: string[];
  raw_name: string;
  group_candidates: OCREvaluationGroupCandidate[];
  confidence: number;
}

export interface OCREvaluationEventAggregateCandidate {
  candidate_type: string;
  event_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  open_time: string | null;
  start_time: string | null;
  group_candidates: OCREvaluationGroupCandidate[];
  source_event_info_candidate_ids: string[];
  source_performer_association_ids: string[];
  source_region_ids: string[];
  source_node_ids: string[];
  confidence: number;
  reasons: string[];
  source_asset_ids?: string[];
  parsing_result_ids?: string[];
  source_type?: OCRTestSourceType | string | null;
  candidate_generation_method?: string | null;
  candidate_model?: string | null;
  candidate_version?: string | null;
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
  performer_list_candidates: OCREvaluationExtractedCandidate[];
  performer_associations: OCREvaluationPerformerAssociation[];
  event_aggregate_candidates: OCREvaluationEventAggregateCandidate[];
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
    performer_association_summary?: {
      count: number;
      top1_score_distribution: Record<string, number>;
      match_method_counts: Record<string, number>;
      exact_count: number;
      normalized_count: number;
      rapidfuzz_count: number;
      difflib_count: number;
      samples: Array<Record<string, unknown>>;
    };
    event_aggregate_summary?: {
      count: number;
      confidence_distribution: Record<string, number>;
    };
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

export type EventCandidateReviewStatus = "pending" | "approved" | "edited" | "rejected";
export type EventCandidateReviewFinalStatus = Exclude<EventCandidateReviewStatus, "pending">;

export interface EventCandidateReviewCreate {
  candidate_type: string;
  source_id?: string | null;
  upload_session_id?: string | null;
  candidate_json: Record<string, unknown>;
  original_json?: Record<string, unknown> | null;
  edited_json?: Record<string, unknown> | null;
  review_json: Record<string, unknown>;
  review_status: EventCandidateReviewStatus;
  reviewer_note?: string | null;
}

export interface EventCandidateReviewUpdate {
  edited_json?: Record<string, unknown> | null;
  review_json: Record<string, unknown>;
  review_status: EventCandidateReviewFinalStatus;
  reviewer_note?: string | null;
}

export interface EventCandidateReviewRead {
  id: string;
  candidate_type: string;
  source_id: string | null;
  upload_session_id: string | null;
  candidate_json: Record<string, unknown>;
  review_json: Record<string, unknown>;
  ocr_output_json: Record<string, unknown>;
  edited_values_json: Record<string, unknown>;
  ground_truth_json: Record<string, unknown>;
  review_status: EventCandidateReviewStatus | string;
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface GroundTruthStats {
  total: number;
  pending: number;
  approved: number;
  edited: number;
  rejected: number;
  ready_for_training: number;
  field_correction_stats: Record<string, {
    reviewed_count: number;
    edited_count: number;
    edit_rate: number;
  }>;
  session_linked_reviews: number;
  unlinked_reviews: number;
  single_image_sessions: number;
  multi_image_sessions: number;
}

export async function createEventCandidateReview(payload: EventCandidateReviewCreate): Promise<EventCandidateReviewRead> {
  return apiFetch<EventCandidateReviewRead>("/admin/event-candidate-reviews", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEventCandidateReview(reviewId: string, payload: EventCandidateReviewUpdate): Promise<EventCandidateReviewRead> {
  return apiFetch<EventCandidateReviewRead>(`/admin/event-candidate-reviews/${reviewId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function listEventCandidateReviews(options: { limit?: number; review_status?: string | null } = {}): Promise<EventCandidateReviewRead[]> {
  return apiFetch<EventCandidateReviewRead[]>("/admin/event-candidate-reviews", {
    query: {
      limit: options.limit ?? 100,
      review_status: options.review_status,
    },
  });
}

export async function getGroundTruthStats(): Promise<GroundTruthStats> {
  return apiFetch<GroundTruthStats>("/admin/ground-truth/stats");
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

export function startOCRReparseJob(sourceId: string) {
  return apiFetch<OCRReparseJobResponse>(`/sources/${sourceId}/reparse-jobs`, {
    method: "POST",
  });
}

export function getOCRReparseJob(jobId: string) {
  return apiFetch<OCRReparseJobResponse>(`/sources/reparse-jobs/${jobId}`);
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

export function runVisionEventStructureTest(payload: VisionEventStructureTestRequest) {
  return apiFetch<VisionEventStructureTestResponse>("/admin/vision-structure-test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createTrainingDatasetJob(files: File[], options: { mode: TrainingDatasetMode; sourceType?: string }) {
  if (files.length === 0) {
    throw new Error("少なくとも1枚の画像を選択してください");
  }
  if (files.length > 4) {
    throw new Error("Training Datasetでは画像は最大4枚までです");
  }
  if (options.mode === "single" && files.length !== 1) {
    throw new Error("Single modeでは画像を1枚だけ選択してください");
  }
  if (options.mode === "multi" && files.length < 2) {
    throw new Error("Multi modeでは画像を2枚以上選択してください");
  }
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  formData.append("mode", options.mode);
  formData.append("source_type", options.sourceType ?? "auto");
  return apiFetch<TrainingDatasetJobRead>("/admin/training-dataset/jobs", {
    method: "POST",
    body: formData,
  });
}

export function getTrainingDatasetJob(jobId: string) {
  if (!jobId.trim()) {
    throw new Error("Training DatasetジョブIDが空です。アップロードAPIのレスポンスを確認してください。");
  }
  return apiFetch<TrainingDatasetJobRead>(`/admin/training-dataset/jobs/${jobId}`);
}

export function listTrainingDatasetCandidates(options: { limit?: number; review_status?: string | null } = {}) {
  return apiFetch<TrainingDatasetCandidateListResponse>("/admin/training-dataset", {
    query: {
      limit: options.limit ?? 50,
      review_status: options.review_status,
    },
  });
}

export function getTrainingDatasetStats() {
  return apiFetch<TrainingDatasetStats>("/admin/training-dataset/stats");
}

export function listContributorTokens() {
  return apiFetch<ContributorTokenListResponse>("/admin/contributor-tokens");
}

export function createContributorToken(payload: { contributor_name: string; role?: string }) {
  return apiFetch<ContributorTokenCreateResponse>("/admin/contributor-tokens", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateContributorToken(contributorId: string, payload: { is_active: boolean }) {
  return apiFetch<ContributorTokenRead>(`/admin/contributor-tokens/${contributorId}`, {
    method: "PATCH",
    query: { is_active: payload.is_active ? 1 : 0 },
  });
}

export function getTrainingDatasetCandidate(candidateId: string) {
  return apiFetch<TrainingEventCandidateRead>(`/admin/training-dataset/${candidateId}`);
}

export function saveTrainingDatasetGroundTruth(
  candidateId: string,
  payload: {
    ground_truth_json: Record<string, unknown>;
    reviewer?: string | null;
    review_status?: string;
    review_seconds?: number | null;
    gpt_metrics?: Record<string, unknown> | null;
    note?: string | null;
  },
) {
  return apiFetch<TrainingEventCandidateRead>(`/admin/training-dataset/${candidateId}/ground-truth`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createTrainingDatasetBenchmarkJob(
  candidateId: string,
  payload: { routes: string[]; models: string[] },
) {
  return apiFetch<TrainingBenchmarkJobRead>(`/admin/training-dataset/${candidateId}/benchmark-runs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getTrainingDatasetBenchmarkJob(jobId: string) {
  return apiFetch<TrainingBenchmarkJobRead>(`/admin/training-dataset/benchmark-jobs/${jobId}`);
}

export function listTrainingDatasetBenchmarkRuns(candidateId: string) {
  return apiFetch<TrainingCandidateBenchmarkRunListResponse>(`/admin/training-dataset/${candidateId}/benchmark-runs`);
}

export function getGptExtractionBenchmarkStats(options: { benchmarkModel?: string | null } = {}) {
  return apiFetch<TrainingCandidateBenchmarkStats>("/admin/labs/gpt-extraction-benchmark/stats", {
    query: {
      benchmark_type: "image_direct",
      benchmark_model: options.benchmarkModel,
    },
  });
}

export function listGptExtractionBenchmarkCandidates(options: {
  limit?: number;
  reviewStatus?: string | null;
  benchmarkStatus?: string | null;
  benchmarkModel?: string | null;
} = {}) {
  return apiFetch<TrainingCandidateBenchmarkCandidateListResponse>("/admin/labs/gpt-extraction-benchmark/candidates", {
    query: {
      limit: options.limit ?? 50,
      review_status: options.reviewStatus,
      benchmark_status: options.benchmarkStatus,
      benchmark_type: "image_direct",
      benchmark_model: options.benchmarkModel,
    },
  });
}

export function getGptExtractionBenchmarkCandidate(candidateId: string, options: { benchmarkModel?: string | null } = {}) {
  return apiFetch<TrainingCandidateBenchmarkCandidateDetailResponse>(`/admin/labs/gpt-extraction-benchmark/candidates/${candidateId}`, {
    query: {
      benchmark_type: "image_direct",
      benchmark_model: options.benchmarkModel,
    },
  });
}

export function runGptExtractionBenchmark(candidateId: string, payload: { benchmark_model?: string | null } = {}) {
  return apiFetch<TrainingCandidateBenchmarkRead>(`/admin/labs/gpt-extraction-benchmark/candidates/${candidateId}/runs`, {
    method: "POST",
    body: JSON.stringify({
      benchmark_type: "image_direct",
      benchmark_model: payload.benchmark_model ?? null,
    }),
  });
}

export function runAllPendingGptExtractionBenchmarks(payload: {
  benchmark_model?: string | null;
  review_status?: string | null;
  benchmark_status?: string | null;
  limit?: number;
} = {}) {
  return apiFetch<TrainingCandidateBenchmarkRunAllResponse>("/admin/labs/gpt-extraction-benchmark/run-all-pending", {
    method: "POST",
    body: JSON.stringify({
      benchmark_type: "image_direct",
      benchmark_model: payload.benchmark_model ?? null,
      review_status: payload.review_status ?? "pending",
      benchmark_status: payload.benchmark_status ?? "not_run",
      limit: payload.limit ?? 50,
    }),
  });
}

export function getGptExtractionBenchmarkRun(benchmarkId: string) {
  return apiFetch<TrainingCandidateBenchmarkRead>(`/admin/labs/gpt-extraction-benchmark/runs/${benchmarkId}`);
}

export function runTrainingDatasetGptReview(candidateId: string) {
  return apiFetch<TrainingCandidateGptReviewRead>(`/admin/training-dataset/candidates/${candidateId}/gpt-review`, {
    method: "POST",
  });
}

export function getTrainingDatasetGptReview(reviewId: string) {
  return apiFetch<TrainingCandidateGptReviewRead>(`/admin/training-dataset/candidates/gpt-reviews/${reviewId}`);
}

export function runTrainingDatasetGptFix(candidateId: string, payload: { review_result_json: Record<string, unknown> }) {
  return apiFetch<TrainingCandidateGptFixResponse>(`/admin/training-dataset/candidates/${candidateId}/gpt-fix`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
