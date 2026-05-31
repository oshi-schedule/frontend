import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function minutesBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return 60;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(15, eh * 60 + em - (sh * 60 + sm));
}

export function formatTime(value?: string | null) {
  return value ? value.slice(0, 5) : "--:--";
}
