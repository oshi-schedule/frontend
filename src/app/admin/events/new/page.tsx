"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createEvent } from "@/api/events";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/utils";
import { useUxMetrics } from "@/store/ux-metrics";

export default function EventCreatePage() {
  const router = useRouter();
  const start = useUxMetrics((state) => state.start);
  const finish = useUxMetrics((state) => state.finish);
  const [displayName, setDisplayName] = useState("");
  const [eventDate, setEventDate] = useState(todayISO());
  const [venueName, setVenueName] = useState("");
  const [aliases, setAliases] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createEvent({
        display_name: displayName,
        canonical_name: displayName,
        event_date: eventDate,
        venue_name: venueName || null,
        description: description || null,
        aliases: aliases.split(",").map((s) => s.trim()).filter(Boolean),
        group_ids: [],
      }),
    onSuccess: (event) => {
      finish("event_create");
      router.push(`/admin/events/${event.id}/timetable`);
    },
  });

  useEffect(() => { start("event_create"); }, [start]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">新規イベント登録</h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">3分以内に1イベント登録</p>
      </div>

      <div className="max-w-xl">
        <Card className="space-y-3 p-4">
          <div className="space-y-2">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="イベント名 *"
              autoFocus
            />
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
            <Input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="会場名"
            />
            <Input
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="Alias（カンマ区切り）"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="説明 / メモ"
              rows={3}
            />
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={!displayName || create.isPending}
            className="w-full bg-[var(--primary)]"
          >
            {create.isPending ? "作成中…" : "作成してタイテ編集へ"}
          </Button>
          {create.error && (
            <p className="text-sm text-red-500">作成に失敗しました。認証またはAPIを確認してください。</p>
          )}
        </Card>
      </div>
    </div>
  );
}
