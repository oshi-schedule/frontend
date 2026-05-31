"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { createUserSchedule } from "@/api/userSchedule";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ScheduleType } from "@/types/api";

const types: ScheduleType[] = ["hotel", "train", "flight", "custom"];

export default function AddPage() {
  const [scheduleType, setScheduleType] = useState<ScheduleType>("hotel");
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const create = useMutation({
    mutationFn: () => createUserSchedule({ schedule_type: scheduleType, title, start_at: startAt, end_at: endAt })
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Add Schedule" subtitle="Hotel / Train / Flight / Custom" />
      <div className="grid grid-cols-4 gap-2">
        {types.map((type) => (
          <Button key={type} onClick={() => setScheduleType(type)} className={scheduleType === type ? "bg-[var(--primary)] px-2" : "bg-white px-2 text-[var(--foreground)]"}>
            {type}
          </Button>
        ))}
      </div>
      <Card className="space-y-3">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="タイトル" />
        <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
        <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
        <Button onClick={() => create.mutate()} disabled={!title || !startAt || !endAt} className="w-full bg-[var(--primary)]">
          追加
        </Button>
        {create.isSuccess ? <p className="text-sm text-[#0f766e]">追加しました</p> : null}
      </Card>
    </div>
  );
}
