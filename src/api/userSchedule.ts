import { apiFetch } from "@/api/client";
import type { ScheduleType, UserScheduleItem } from "@/types/api";

export function createUserSchedule(payload: {
  schedule_type: ScheduleType;
  event_core_id?: string | null;
  timetable_item_id?: string | null;
  title?: string | null;
  start_at?: string | null;
  end_at?: string | null;
}) {
  return apiFetch<UserScheduleItem>("/user-schedule", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
