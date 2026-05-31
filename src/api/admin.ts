import { apiFetch } from "@/api/client";

export interface AdminStats {
  events: number;
  groups: number;
  venues: number;
  pending_sources: number;
}

export interface MergeResult {
  entity_type: string;
  source_id: string;
  target_id: string;
  status: string;
}

export function getAdminStats() {
  return apiFetch<AdminStats>("/admin/stats");
}

export function mergeEntity(
  entityType: "group" | "venue" | "event",
  sourceId: string,
  targetId: string,
) {
  return apiFetch<MergeResult>(`/admin/${entityType}s/${sourceId}/merge`, {
    method: "POST",
    body: JSON.stringify({ target_id: targetId }),
  });
}
