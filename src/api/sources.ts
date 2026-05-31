import { apiFetch } from "@/api/client";
import type { SourceRead } from "@/types/api";

export function listSources(limit = 50) {
  return apiFetch<SourceRead[]>("/sources", { query: { limit } });
}

export function getSource(id: string) {
  return apiFetch<SourceRead>(`/sources/${id}`);
}
