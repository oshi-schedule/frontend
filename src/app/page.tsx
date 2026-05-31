"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Calendar, Clock, MapPin } from "lucide-react";
import { getCalendarDay } from "@/api/calendar";
import { listEvents } from "@/api/events";
import { EventCard } from "@/components/events/event-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { todayISO } from "@/lib/utils";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-[var(--foreground)] mb-3">{children}</h2>;
}

export default function HomePage() {
  const today = todayISO();
  const events = useQuery({ queryKey: ["events"], queryFn: () => listEvents({ limit: 30 }) });
  const day = useQuery({ queryKey: ["calendar-day", today], queryFn: () => getCalendarDay(today) });

  const todaysEvents = events.data?.items.filter((e) => e.event_date === today) ?? [];
  const upcoming = events.data?.items.filter((e) => e.event_date > today).slice(0, 9) ?? [];
  const scheduleItems = day.data?.user_schedule_items ?? [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">推しスケ</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
          </p>
        </div>
        <Link href="/calendar/month">
          <button type="button" className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
            <Calendar size={15} />
            カレンダー
          </button>
        </Link>
      </div>

      {/* 2-column on PC */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-8 space-y-6 lg:space-y-0">
        {/* Left: today */}
        <div className="space-y-6">
          <section>
            <SectionTitle>今日のイベント</SectionTitle>
            {todaysEvents.length ? (
              <div className="space-y-2">
                {todaysEvents.map((event) => <EventCard key={event.id} event={event} />)}
              </div>
            ) : (
              <Card className="text-sm text-[var(--muted)]">今日のイベントはありません</Card>
            )}
          </section>

          <section>
            <SectionTitle>今日のマイスケ</SectionTitle>
            {scheduleItems.length ? (
              <div className="space-y-2">
                {scheduleItems.map((item) => (
                  <Card key={item.id} className="flex items-center gap-3 p-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#fceae5] text-[var(--primary)]">
                      <Clock size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-sm">{item.title}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-sm text-[var(--muted)]">マイスケはまだ空です</Card>
            )}
          </section>
        </div>

        {/* Right: upcoming / recommended */}
        <div className="space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <SectionTitle>今後のイベント</SectionTitle>
              <Link href="/search" className="text-xs text-[var(--primary)] font-medium hover:underline">
                すべて見る
              </Link>
            </div>
            {upcoming.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {upcoming.map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`}>
                    <Card className="h-full p-3 hover:shadow-md transition-shadow">
                      <p className="text-xs font-semibold text-[var(--primary)]">{event.event_date}</p>
                      <p className="mt-1 text-sm font-bold leading-snug line-clamp-2">{event.display_name}</p>
                      {event.venue && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--muted)]">
                          <MapPin size={11} />
                          {event.venue.display_name}
                        </p>
                      )}
                      <Badge className="mt-2 text-[10px]">{event.status}</Badge>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card className="text-sm text-[var(--muted)]">今後のイベントはありません</Card>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
