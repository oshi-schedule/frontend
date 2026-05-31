import { apiFetch } from "@/api/client";
import type { CalendarDayResponse, CalendarMonthResponse } from "@/types/api";

export function getCalendarDay(date?: string) {
  return apiFetch<CalendarDayResponse>("/calendar/day", { query: { date } });
}

export function getCalendarMonth(year?: number, month?: number) {
  return apiFetch<CalendarMonthResponse>("/calendar/month", { query: { year, month } });
}
