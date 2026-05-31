import { apiFetch } from "@/api/client";
import type { EventCore, EventCreatePayload, EventListResponse, EventUpdatePayload, Timetable, TimetableBulkPayload, TimetablePayload } from "@/types/api";

export function listEvents(params: { q?: string; limit?: number; offset?: number } = {}) {
  return apiFetch<EventListResponse>("/events", { query: { limit: 50, offset: 0, ...params } });
}

export function getEvent(id: string) {
  return apiFetch<EventCore>(`/events/${id}`);
}

export function getEventTimetable(id: string) {
  return apiFetch<Timetable>(`/events/${id}/timetable`);
}

export function createEvent(payload: EventCreatePayload) {
  return apiFetch<EventCore>("/admin/events", { method: "POST", body: JSON.stringify(payload) });
}

export function updateEvent(id: string, payload: EventUpdatePayload) {
  return apiFetch<EventCore>(`/admin/events/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function bulkTimetableItems(eventId: string, payload: TimetableBulkPayload) {
  return apiFetch<Timetable>(`/admin/events/${eventId}/timetable/bulk`, { method: "POST", body: JSON.stringify(payload) });
}

export function createTimetable(eventId: string, payload: TimetablePayload) {
  return apiFetch<Timetable>(`/admin/events/${eventId}/timetable`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createTimetableVersion(eventId: string, payload: TimetablePayload) {
  return apiFetch<Timetable>(`/admin/events/${eventId}/timetable/version`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
