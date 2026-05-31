import { apiFetch } from "@/api/client";
import type { VenueSummary } from "@/types/api";

export function listVenues(params: { q?: string; limit?: number } = {}) {
  return apiFetch<VenueSummary[]>("/venues", { query: { limit: 100, ...params } });
}

export function getVenue(id: string) {
  return apiFetch<VenueSummary>(`/venues/${id}`);
}
