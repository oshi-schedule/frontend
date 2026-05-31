import { apiFetch } from "@/api/client";
import type { UserEvent, UserEventStatus } from "@/types/api";

export function createUserEvent(eventId: string, status: UserEventStatus) {
  return apiFetch<UserEvent>("/user-events", {
    method: "POST",
    body: JSON.stringify({ event_id: eventId, status })
  });
}
