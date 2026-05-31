import { apiFetch } from "@/api/client";
import type { GroupDetail, GroupSummary } from "@/types/api";

export function listGroups(params: { q?: string; limit?: number } = {}) {
  return apiFetch<GroupSummary[]>("/groups", { query: { limit: 100, ...params } });
}

export function getGroup(id: string) {
  return apiFetch<GroupDetail>(`/groups/${id}`);
}
