"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createTimetable, createTimetableVersion, getEvent, getEventTimetable } from "@/api/events";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUxMetrics } from "@/store/ux-metrics";
import type { TimetableItemPayload } from "@/types/api";

function blankRow(type = "live"): TimetableItemPayload {
  return { title: "", stage_name: "", start_time: "18:00", end_time: "18:20", item_type: type, notes: "", member_ids: [] };
}

export default function TimetableEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const start = useUxMetrics((state) => state.start);
  const finish = useUxMetrics((state) => state.finish);
  const event = useQuery({ queryKey: ["event", id], queryFn: () => getEvent(id) });
  const existing = useQuery({ queryKey: ["event-timetable", id], queryFn: () => getEventTimetable(id), retry: false });
  const [title, setTitle] = useState("Manual timetable");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<TimetableItemPayload[]>([blankRow()]);
  const hasExisting = Boolean(existing.data?.id);

  useEffect(() => { start("timetable_create"); }, [start]);

  useEffect(() => {
    if (existing.data?.items.length) {
      setTitle(existing.data.title ?? "Manual timetable");
      setNote(existing.data.note ?? "");
      setRows(existing.data.items.map((item) => ({
        title: item.title,
        group_id: item.group_id,
        stage_name: item.stage_name,
        start_time: item.start_time,
        end_time: item.end_time,
        item_type: item.item_type,
        notes: item.notes,
        member_ids: [],
      })));
    }
  }, [existing.data]);

  const payload = useMemo(
    () => ({ title, note, source: "manual_web", base_version: existing.data?.version, items: rows }),
    [title, note, rows, existing.data?.version],
  );

  const save = useMutation({
    mutationFn: () => (hasExisting ? createTimetableVersion(id, payload) : createTimetable(id, payload)),
    onSuccess: () => { finish("timetable_create"); router.push(`/events/${id}`); },
  });

  function update(index: number, patch: Partial<TimetableItemPayload>) {
    setRows((cur) => cur.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function move(index: number, delta: number) {
    setRows((cur) => {
      const next = [...cur];
      const target = index + delta;
      if (target < 0 || target >= next.length) return cur;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function remove(index: number) {
    setRows((cur) => cur.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Timetable Editor</h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{event.data?.display_name ?? "読み込み中…"}</p>
      </div>

      <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6 space-y-4 lg:space-y-0">
        {/* Left: meta + controls */}
        <div className="space-y-3">
          <Card className="space-y-3 p-4">
            <h2 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">タイテ設定</h2>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" />
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="版メモ" rows={2} />
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setRows((cur) => [...cur, blankRow("live")])} className="bg-[#0f766e] gap-1">
              <Plus size={15} /> ライブ
            </Button>
            <Button onClick={() => setRows((cur) => [...cur, blankRow("benefit")])} className="bg-[#2563eb] gap-1">
              <Sparkles size={15} /> 特典会
            </Button>
          </div>

          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || rows.some((row) => !row.title)}
            className="w-full bg-[var(--primary)] gap-2"
          >
            <Save size={16} />
            {save.isPending ? "保存中…" : hasExisting ? "新バージョン保存" : "タイテ作成"}
          </Button>
          {save.error && (
            <p className="text-xs text-red-500">保存に失敗しました。認証またはAPIを確認してください。</p>
          )}
        </div>

        {/* Right: rows */}
        <div className="space-y-2">
          {rows.map((row, index) => (
            <Card key={index} className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-center text-xs font-bold text-[var(--muted)]">{index + 1}</span>
                <Input
                  value={row.title}
                  onChange={(e) => update(index, { title: e.target.value })}
                  placeholder="出演者 / 枠名"
                  className="h-8 text-sm"
                />
                <select
                  value={row.item_type}
                  onChange={(e) => update(index, { item_type: e.target.value })}
                  className="h-8 shrink-0 rounded-md border border-[var(--border)] bg-white px-2 text-xs"
                >
                  <option value="live">live</option>
                  <option value="benefit">benefit</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 pl-8">
                <Input
                  type="time"
                  value={row.start_time.slice(0, 5)}
                  onChange={(e) => update(index, { start_time: `${e.target.value}:00` })}
                  className="h-8 text-sm"
                />
                <Input
                  type="time"
                  value={row.end_time.slice(0, 5)}
                  onChange={(e) => update(index, { end_time: `${e.target.value}:00` })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 pl-8">
                <Input
                  value={row.stage_name ?? ""}
                  onChange={(e) => update(index, { stage_name: e.target.value })}
                  placeholder="ステージ"
                  className="h-8 text-sm"
                />
                <Input
                  value={row.notes ?? ""}
                  onChange={(e) => update(index, { notes: e.target.value })}
                  placeholder="メモ"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex gap-1.5 pl-8">
                <Button onClick={() => move(index, -1)} className="h-7 w-7 bg-white p-0 text-[var(--foreground)]" title="上へ"><ArrowUp size={14} /></Button>
                <Button onClick={() => move(index, 1)} className="h-7 w-7 bg-white p-0 text-[var(--foreground)]" title="下へ"><ArrowDown size={14} /></Button>
                <Button onClick={() => remove(index)} className="h-7 w-7 bg-white p-0 text-red-400 hover:text-red-600" title="削除"><Trash2 size={14} /></Button>
              </div>
            </Card>
          ))}
          {rows.length === 0 && (
            <Card className="py-8 text-center text-sm text-[var(--muted)]">
              行を追加してください
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
