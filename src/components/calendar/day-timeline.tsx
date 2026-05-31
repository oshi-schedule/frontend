"use client";

import { memo, useMemo, useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatTime, minutesBetween } from "@/lib/utils";
import { useRenderCount } from "@/lib/dev-profiler";
import { updateUserSchedule, deleteUserSchedule } from "@/api/userSchedule";
import type { CalendarDayResponse, UserScheduleItem, ScheduleType } from "@/types/api";

const HOURS = Array.from({ length: 19 }, (_, i) => i + 6);

const SCHEDULE_TYPES: { value: ScheduleType; label: string }[] = [
  { value: "event", label: "イベント" },
  { value: "hotel", label: "ホテル" },
  { value: "train", label: "移動" },
  { value: "flight", label: "フライト" },
  { value: "custom", label: "カスタム" },
];

function calcPosition(item: UserScheduleItem) {
  const [hour, minute] = item.start_time.split(":").map(Number);
  const top = ((hour - 6) * 60 + minute) * 1.1;
  const height = minutesBetween(item.start_time, item.end_time) * 1.1;
  return { top: Math.max(0, top), height };
}

function EditModal({
  item,
  date,
  onClose,
  onDone,
}: {
  item: UserScheduleItem;
  date: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [startTime, setStartTime] = useState(item.start_time.slice(0, 5));
  const [endTime, setEndTime] = useState(item.end_time.slice(0, 5));
  const [scheduleType, setScheduleType] = useState<ScheduleType>(item.schedule_type);

  useEffect(() => {
    setTitle(item.title);
    setStartTime(item.start_time.slice(0, 5));
    setEndTime(item.end_time.slice(0, 5));
    setScheduleType(item.schedule_type);
  }, [item]);

  const buildDatetime = (time: string) => `${date}T${time}:00`;

  const saveMut = useMutation({
    mutationFn: () =>
      updateUserSchedule(item.id, {
        title,
        schedule_type: scheduleType,
        start_at: buildDatetime(startTime),
        end_at: buildDatetime(endTime),
      }),
    onSuccess: onDone,
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteUserSchedule(item.id),
    onSuccess: onDone,
  });

  const busy = saveMut.isPending || deleteMut.isPending;

  return (
    /* backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      {/* card — stop propagation so clicks inside don't close */}
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">予定を編集</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* title */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              タイトル
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="予定名"
            />
          </div>

          {/* time */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                開始
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                終了
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* schedule type */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              種別
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SCHEDULE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setScheduleType(t.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    scheduleType === t.value
                      ? "border-(--foreground) bg-(--foreground) text-white"
                      : "border-gray-200 text-gray-500 hover:border-gray-400"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {(saveMut.isError || deleteMut.isError) && (
            <p className="text-xs text-red-500">操作に失敗しました</p>
          )}

          {/* actions */}
          <div className="flex gap-2 pt-1">
            <button
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-100 disabled:opacity-50"
              onClick={() => deleteMut.mutate()}
              disabled={busy}
            >
              <Trash2 size={14} />
              削除
            </button>
            <button
              className="flex-1 rounded-lg bg-(--foreground) py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              onClick={() => saveMut.mutate()}
              disabled={busy}
            >
              {busy ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DayTimelineInner({ day }: { day?: CalendarDayResponse }) {
  useRenderCount("DayTimeline");
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const items = day?.user_schedule_items ?? [];
  const positioned = useMemo(
    () => items.map((item, index) => ({ item, index, ...calcPosition(item) })),
    [items],
  );

  const editingItem = items.find((i) => i.id === editingId) ?? null;

  const handleDone = useCallback(() => {
    setEditingId(null);
    queryClient.invalidateQueries({ queryKey: ["calendar-day"] });
  }, [queryClient]);

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="relative min-h-313.5">
          {HOURS.map((hour) => (
            <div key={hour} className="grid h-16.5 grid-cols-[48px_1fr] border-b border-(--border)">
              <div className="p-2 text-xs text-(--muted)">{String(hour).padStart(2, "0")}:00</div>
              <div />
            </div>
          ))}
          {positioned.map(({ item, index, top, height }) => (
            <button
              key={item.id}
              onClick={() => setEditingId(item.id)}
              className="absolute left-14 right-3 rounded-md border border-[#b8d9d5] bg-[#e2f4f1] px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-teal-400 hover:brightness-95"
              style={{ top, height: Math.max(44, height), marginLeft: `${(index % 3) * 16}px` }}
            >
              <p className="font-semibold">{item.title}</p>
              <p className="flex items-center gap-1 text-xs text-(--muted)">
                {formatTime(item.start_time)}–{formatTime(item.end_time)}
                <Pencil size={10} />
              </p>
            </button>
          ))}
        </div>
      </Card>

      {editingItem && day && (
        <EditModal
          item={editingItem}
          date={day.date}
          onClose={() => setEditingId(null)}
          onDone={handleDone}
        />
      )}
    </>
  );
}

export const DayTimeline = memo(DayTimelineInner);
