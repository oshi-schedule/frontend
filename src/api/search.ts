import { apiFetch } from "@/api/client";
import type { SearchResponse } from "@/types/api";

export function searchEntities(q: string, limit = 20) {
  return apiFetch<SearchResponse>("/search", { query: { q, limit } });
}
