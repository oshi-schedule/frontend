"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getCalendarMonth } from "@/api/calendar";
import { MonthGrid } from "@/components/calendar/month-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";

export default function MonthPage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const calendar = useQuery({ queryKey: ["calendar-month", year, month], queryFn: () => getCalendarMonth(year, month) });

  return (
    <div className="space-y-4">
      <PageHeader title="Month View" subtitle="ドットと件数で月間の詰まりを確認" />
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
        <Input type="number" min={1} max={12} value={month} onChange={(event) => setMonth(Number(event.target.value))} />
      </div>
      <MonthGrid month={calendar.data} />
    </div>
  );
}
