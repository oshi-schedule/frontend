"use client";

import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { formatTime, minutesBetween } from "@/lib/utils";
import { useRenderCount } from "@/lib/dev-profiler";
import type { CalendarDayResponse, UserScheduleItem } from "@/types/api";

const HOURS = Array.from({ length: 19 }, (_, i) => i + 6);

function calcPosition(item: UserScheduleItem) {
  const [hour, minute] = item.start_time.split(":").map(Number);
  const top = ((hour - 6) * 60 + minute) * 1.1;
  const height = minutesBetween(item.start_time, item.end_time) * 1.1;
  return { top: Math.max(0, top), height };
}

function DayTimelineInner({ day }: { day?: CalendarDayResponse }) {
  useRenderCount("DayTimeline");
  const items = day?.user_schedule_items ?? [];
  const positioned = useMemo(
    () => items.map((item, index) => ({ item, index, ...calcPosition(item) })),
    [items],
  );

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative min-h-[1254px]">
        {HOURS.map((hour) => (
          <div key={hour} className="grid h-[66px] grid-cols-[48px_1fr] border-b border-[var(--border)]">
            <div className="p-2 text-xs text-[var(--muted)]">{String(hour).padStart(2, "0")}:00</div>
            <div />
          </div>
        ))}
        {positioned.map(({ item, index, top, height }) => (
          <div
            key={item.id}
            className="absolute left-[56px] right-3 rounded-md border border-[#b8d9d5] bg-[#e2f4f1] px-3 py-2 text-sm shadow-sm"
            style={{ top, height: Math.max(44, height), marginLeft: `${(index % 3) * 16}px` }}
          >
            <p className="font-semibold">{item.title}</p>
            <p className="text-xs text-[var(--muted)]">
              {formatTime(item.start_time)}-{formatTime(item.end_time)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export const DayTimeline = memo(DayTimelineInner);
