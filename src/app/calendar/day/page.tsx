"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { getCalendarDay } from "@/api/calendar";
import { DayTimeline } from "@/components/calendar/day-timeline";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/lib/utils";

export default function DayPage() {
  const [date, setDate] = useState(todayISO());
  const day = useQuery({ queryKey: ["calendar-day", date], queryFn: () => getCalendarDay(date) });

  return (
    <div className="space-y-4">
      <PageHeader title="Day View" subtitle="予定被りをそのまま見える化" />
      <div className="flex gap-2">
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <Link href="/calendar/month">
          <Button className="w-12 px-0" title="Month">
            <CalendarDays size={18} />
          </Button>
        </Link>
      </div>
      <DayTimeline day={day.data} />
    </div>
  );
}
