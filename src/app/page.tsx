"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  History,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Table2,
  Users,
} from "lucide-react";
import { getCalendarDay } from "@/api/calendar";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { todayISO, formatTime } from "@/lib/utils";
import type { UserEvent, UserScheduleItem } from "@/types/api";

/* ─── 定数 ─── */

const TODAY = todayISO();
const TODAY_LABEL = new Date().toLocaleDateString("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "short",
});

const QUICK_ACTIONS_MOBILE = [
  { href: "/search", label: "イベントを探す", icon: Search, bg: "bg-[var(--primary)]" },
  { href: "/admin/groups", label: "グループを探す", icon: Users, bg: "bg-[#0f766e]" },
  { href: "/admin/events/new", label: "イベント追加", icon: Plus, bg: "bg-[#2563eb]" },
];

const QUICK_ACTIONS_DESKTOP = [
  { href: "/search", label: "イベント検索", desc: "名前・日付・会場で探す", icon: Search, bg: "bg-[var(--primary)]" },
  { href: "/admin/groups", label: "グループ検索", desc: "グループ名で一覧を確認", icon: Users, bg: "bg-[#0f766e]" },
  { href: "/admin/events/new", label: "イベント追加", desc: "新しいイベントを登録", icon: Plus, bg: "bg-[#2563eb]" },
  { href: "/admin/events", label: "タイムテーブル登録", desc: "イベントを選んで編集", icon: Table2, bg: "bg-[#7c3aed]" },
];

const STATUS_LABEL: Record<string, string> = {
  interested: "気になる",
  planned: "行く予定",
  attended: "参加済み",
};

/* ─── サブコンポーネント ─── */

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} className="text-[var(--muted)]" />
      <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">{title}</h2>
    </div>
  );
}

function UserEventRow({ item }: { item: UserEvent }) {
  const event = item.event;
  return (
    <Link href={event ? `/events/${event.id}` : "#"}>
      <div className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0 hover:bg-gray-50 transition-colors -mx-3 px-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{event?.display_name ?? item.name ?? "イベント"}</p>
          {event?.venue && (
            <p className="flex items-center gap-1 mt-0.5 text-xs text-[var(--muted)]">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{event.venue.display_name}</span>
            </p>
          )}
        </div>
        <Badge className="shrink-0 text-[10px]">{STATUS_LABEL[item.status] ?? item.status}</Badge>
      </div>
    </Link>
  );
}

function ScheduleItem({ item, compact = false }: { item: UserScheduleItem; compact?: boolean }) {
  const venue = item.event?.venue?.display_name;
  return (
    <div className="flex gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
      <div className="shrink-0 w-[52px] text-right">
        <span className="text-sm font-bold">{formatTime(item.start_time)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm leading-snug truncate">{item.title}</p>
        {!compact && venue && (
          <p className="flex items-center gap-1 mt-0.5 text-xs text-[var(--muted)]">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{venue}</span>
          </p>
        )}
      </div>
      {!compact && (
        <span className="shrink-0 text-[10px] text-[var(--muted)] pt-0.5">
          {formatTime(item.end_time)}
        </span>
      )}
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <p className="text-sm text-[var(--muted)]">{message}</p>
      {action}
    </div>
  );
}

/* ─── セクション: 今日の予定 ─── */

function TodaySection({ compact = false }: { compact?: boolean }) {
  const day = useQuery({
    queryKey: ["calendar-day", TODAY],
    queryFn: () => getCalendarDay(TODAY),
  });
  const userEvents = day.data?.user_events ?? [];
  const scheduleItems = day.data?.user_schedule_items ?? [];
  const hasAny = userEvents.length > 0 || scheduleItems.length > 0;

  return (
    <div>
      <SectionHeader icon={Clock} title="今日の予定" />

      {day.isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((n) => (
            <div key={n} className="h-10 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : hasAny ? (
        <>
          <div className="rounded-xl border border-[var(--border)] bg-white overflow-hidden px-3">
            {userEvents.map((item) => (
              <UserEventRow key={item.id} item={item} />
            ))}
            {scheduleItems.map((item) => (
              <ScheduleItem key={item.id} item={item} compact={compact} />
            ))}
          </div>
          <Link href={`/calendar/day?date=${TODAY}`}>
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-white py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-gray-50 transition-colors"
            >
              <CalendarDays size={15} />
              今日の予定を見る
              <ArrowRight size={13} className="ml-0.5" />
            </button>
          </Link>
        </>
      ) : (
        <EmptyState
          message="今日の予定はまだありません"
          action={
            <Link href="/search">
              <button
                type="button"
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                イベントを探す
              </button>
            </Link>
          }
        />
      )}
    </div>
  );
}

/* ─── セクション: 最近見たイベント ─── */

function RecentSection() {
  const { events, ready } = useRecentlyViewed();

  return (
    <div>
      <SectionHeader icon={History} title="最近見たイベント" />

      {!ready ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : events.length > 0 ? (
        <div className="space-y-2">
          {events.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card className="flex items-start gap-3 p-3 hover:shadow-md transition-shadow cursor-pointer">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm leading-snug line-clamp-2">{event.display_name}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
                    <CalendarDays size={11} className="shrink-0" />
                    {event.event_date}
                    {event.venue && (
                      <>
                        <span className="mx-1">·</span>
                        <MapPin size={11} className="shrink-0" />
                        <span className="truncate">{event.venue.display_name}</span>
                      </>
                    )}
                  </p>
                </div>
                <Badge className="shrink-0 text-[10px] mt-0.5">{event.status}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          message="まだイベントを見ていません"
          action={
            <Link href="/search">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Search size={14} />
                イベントを検索する
              </button>
            </Link>
          }
        />
      )}
    </div>
  );
}

/* ─── セクション: クイックアクション ─── */

function QuickActionsDesktop() {
  return (
    <div>
      <SectionHeader icon={Sparkles} title="クイックアクション" />
      <div className="space-y-2.5">
        {QUICK_ACTIONS_DESKTOP.map(({ href, label, desc, icon: Icon, bg }) => (
          <Link key={href + label} href={href}>
            <div className={`flex items-center gap-4 rounded-xl p-4 text-white transition-opacity hover:opacity-90 cursor-pointer ${bg}`}>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/20">
                <Icon size={20} />
              </div>
              <div>
                <p className="font-bold text-sm">{label}</p>
                <p className="text-xs text-white/75 mt-0.5">{desc}</p>
              </div>
              <ArrowRight size={16} className="ml-auto shrink-0 text-white/60" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function QuickActionsMobile() {
  return (
    <div>
      <SectionHeader icon={Sparkles} title="クイックアクション" />
      <div className="grid grid-cols-3 gap-2.5">
        {QUICK_ACTIONS_MOBILE.map(({ href, label, icon: Icon, bg }) => (
          <Link key={href + label} href={href}>
            <div className={`flex flex-col items-center gap-2 rounded-xl px-2 py-4 text-white transition-opacity hover:opacity-90 cursor-pointer ${bg}`}>
              <Icon size={22} />
              <span className="text-center text-[11px] font-semibold leading-tight">{label}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── ページ本体 ─── */

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">{TODAY_LABEL}</p>
          <h1 className="mt-0.5 text-2xl font-bold">おはようございます</h1>
        </div>
        <Link href={`/calendar/day?date=${TODAY}`}>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            <CalendarDays size={14} />
            Day View
          </button>
        </Link>
      </div>

      {/* ─── モバイル (< 768px): 縦積み ─── */}
      <div className="md:hidden space-y-6">
        <TodaySection compact />
        <RecentSection />
        <QuickActionsMobile />
      </div>

      {/* ─── タブレット・PC (≥ 768px): グリッド ─── */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 今日の予定 */}
        <div className="md:col-span-1">
          <TodaySection />
        </div>

        {/* 最近見たイベント */}
        <div className="md:col-span-1">
          <RecentSection />
        </div>

        {/* クイックアクション: タブレットでは2列目いっぱい、PCでは3列目 */}
        <div className="md:col-span-2 lg:col-span-1">
          <QuickActionsDesktop />
        </div>
      </div>
    </div>
  );
}
