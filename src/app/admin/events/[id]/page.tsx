"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Table2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getEvent, updateEvent } from "@/api/events";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function EventEditPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const event = useQuery({ queryKey: ["admin-event", id], queryFn: () => getEvent(id) });

  const [displayName, setDisplayName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (event.data) {
      setDisplayName(event.data.display_name);
      setEventDate(event.data.event_date);
      setDescription(event.data.description ?? "");
    }
  }, [event.data]);

  const save = useMutation({
    mutationFn: () =>
      updateEvent(id, {
        display_name: displayName || undefined,
        event_date: eventDate || undefined,
        description: description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-event", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Event Edit</h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{event.data?.display_name ?? "読み込み中…"}</p>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-4 lg:space-y-0">
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wide">基本情報</h2>
          <div className="space-y-2">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="イベント名"
            />
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
            <Input
              value={event.data?.venue?.display_name ?? ""}
              readOnly
              placeholder="会場（変更不可）"
              className="bg-gray-50"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="説明"
              rows={4}
            />
          </div>
          <Button
            className="w-full bg-[var(--primary)]"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? "保存中…" : "保存"}
          </Button>
          {save.isSuccess && (
            <p className="text-center text-sm text-green-600">保存しました</p>
          )}
          {save.isError && (
            <p className="text-center text-sm text-red-500">保存に失敗しました</p>
          )}
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <h2 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wide mb-3">タイムテーブル</h2>
            <Link href={`/admin/events/${id}/timetable`}>
              <Button className="w-full bg-[#0f766e] gap-2">
                <Table2 size={16} />
                タイテ編集画面へ
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
