"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { MapPin, CalendarDays, BookmarkPlus } from "lucide-react";
import { createUserEvent } from "@/api/userEvents";
import { createUserSchedule } from "@/api/userSchedule";
import { getEvent, getEventTimetable } from "@/api/events";
import { TimetableList } from "@/components/events/timetable-list";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { UserEventStatus } from "@/types/api";

const statusActions: { status: UserEventStatus; label: string; className: string }[] = [
  { status: "interested", label: "気になる", className: "bg-[#0f766e]" },
  { status: "planned", label: "行く予定", className: "bg-[var(--primary)]" },
  { status: "attended", label: "参加済み", className: "bg-[#525252]" },
];

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { record } = useRecentlyViewed();
  const event = useQuery({ queryKey: ["event", id], queryFn: () => getEvent(id) });

  useEffect(() => {
    if (event.data) record(event.data);
  }, [event.data, record]);
  const timetable = useQuery({
    queryKey: ["event-timetable", id],
    queryFn: () => getEventTimetable(id),
    retry: false,
  });
  const userEvent = useMutation({
    mutationFn: (status: UserEventStatus) => createUserEvent(id, status),
  });
  const schedule = useMutation({
    mutationFn: () =>
      createUserSchedule({
        schedule_type: "event",
        event_core_id: id,
        title: event.data?.display_name ?? "Event",
      }),
  });

  if (!event.data) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-[var(--muted)]">
        {event.isLoading ? "読み込み中…" : "イベントが見つかりません"}
      </div>
    );
  }

  const ev = event.data;

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <div className="flex items-start gap-3 flex-wrap">
          <Badge>{ev.status}</Badge>
          <span className="flex items-center gap-1 text-sm text-[var(--muted)]">
            <CalendarDays size={14} />
            {ev.event_date}
          </span>
          {ev.venue && (
            <span className="flex items-center gap-1 text-sm text-[var(--muted)]">
              <MapPin size={14} />
              {ev.venue.display_name}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-snug">{ev.display_name}</h1>
      </div>

      {/* 2-column on PC */}
      <div className="lg:grid lg:grid-cols-[1fr_1.6fr] lg:gap-8 space-y-6 lg:space-y-0">
        {/* Left: event info + actions */}
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wide">イベント情報</h2>
            {ev.venue && (
              <div>
                <p className="text-xs text-[var(--muted)]">会場</p>
                <p className="font-semibold">{ev.venue.display_name}</p>
                {ev.venue.address && (
                  <p className="text-xs text-[var(--muted)] mt-0.5">{ev.venue.address}</p>
                )}
              </div>
            )}
            {ev.description && (
              <div>
                <p className="text-xs text-[var(--muted)]">説明</p>
                <p className="text-sm leading-relaxed">{ev.description}</p>
              </div>
            )}
          </Card>

          <Card className="space-y-2 p-4">
            <h2 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wide">アクション</h2>
            <div className="grid grid-cols-3 gap-2">
              {statusActions.map(({ status, label, className }) => (
                <Button
                  key={status}
                  onClick={() => userEvent.mutate(status)}
                  disabled={userEvent.isPending}
                  className={`text-xs ${className}`}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Button
              onClick={() => schedule.mutate()}
              disabled={schedule.isPending}
              className="w-full bg-[#2563eb] gap-2"
            >
              <BookmarkPlus size={16} />
              マイスケに追加
            </Button>
            {(userEvent.isSuccess || schedule.isSuccess) && (
              <p className="text-center text-xs text-[#15803d]">追加しました</p>
            )}
          </Card>
        </div>

        {/* Right: timetable */}
        <div className="space-y-3">
          <h2 className="text-base font-bold">タイムテーブル</h2>
          <TimetableList timetable={timetable.data} />
        </div>
      </div>
    </div>
  );
}
