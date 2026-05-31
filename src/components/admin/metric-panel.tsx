"use client";

import { Card } from "@/components/ui/card";
import { useUxMetrics } from "@/store/ux-metrics";

function seconds(ms?: number) {
  return ms ? `${Math.round(ms / 1000)}秒` : "未完了";
}

export function MetricPanel() {
  const metrics = useUxMetrics((state) => state.metrics);
  return (
    <Card className="space-y-2 bg-[#fff8ed]">
      <p className="text-sm font-bold">UX計測</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[var(--muted)]">イベント作成</p>
          <p className="font-semibold">{seconds(metrics.find((item) => item.kind === "event_create")?.durationMs)}</p>
        </div>
        <div>
          <p className="text-[var(--muted)]">タイテ作成</p>
          <p className="font-semibold">{seconds(metrics.find((item) => item.kind === "timetable_create")?.durationMs)}</p>
        </div>
      </div>
    </Card>
  );
}
