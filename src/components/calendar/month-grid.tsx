"use client";

import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { useRenderCount } from "@/lib/dev-profiler";
import type { CalendarMonthResponse } from "@/types/api";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function MonthGridInner({ month }: { month?: CalendarMonthResponse }) {
  useRenderCount("MonthGrid");
  const days = month?.days ?? [];
  const enriched = useMemo(
    () =>
      days.map((day) => ({
        ...day,
        dateObj: new Date(`${day.date}T00:00:00`),
        count: day.user_event_count + day.user_schedule_count,
      })),
    [days],
  );

  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAYS.map((day) => (
        <div key={day} className="py-2 text-center text-xs font-semibold text-[var(--muted)]">
          {day}
        </div>
      ))}
      {enriched.map(({ date, dateObj, count }) => (
        <Card key={date} className="aspect-square p-1 text-center">
          <p className="text-xs font-semibold">{dateObj.getDate()}</p>
          <div className="mt-1 flex justify-center gap-1">
            {Array.from({ length: Math.min(3, count) }).map((_, index) => (
              <span key={index} className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
            ))}
          </div>
          {count > 0 ? <p className="mt-1 text-[10px] text-[var(--muted)]">{count}件</p> : null}
        </Card>
      ))}
    </div>
  );
}

export const MonthGrid = memo(MonthGridInner);
