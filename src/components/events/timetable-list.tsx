import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatTime } from "@/lib/utils";
import type { Timetable } from "@/types/api";

export function TimetableList({ timetable }: { timetable?: Timetable }) {
  if (!timetable) {
    return <Card className="text-sm text-[var(--muted)]">タイムテーブル未登録</Card>;
  }

  return (
    <div className="space-y-2">
      {timetable.items.map((item) => (
        <Card key={item.id} className="grid grid-cols-[68px_1fr] gap-3 p-3">
          <div className="text-sm font-bold">
            <p>{formatTime(item.start_time)}</p>
            <p className="text-[var(--muted)]">{formatTime(item.end_time)}</p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{item.title}</h3>
              <Badge>{item.session_type}</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{item.stage_name ?? "ステージ未設定"}</p>
            {item.notes ? <p className="mt-1 text-sm">{item.notes}</p> : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
