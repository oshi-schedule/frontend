"use client";

import { memo } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRenderCount } from "@/lib/dev-profiler";
import type { EventCore } from "@/types/api";

function EventCardInner({ event, admin = false }: { event: EventCore; admin?: boolean }) {
  useRenderCount(`EventCard(${event.id.slice(0, 8)})`)
  return (
    <Link href={admin ? `/admin/events/${event.id}` : `/events/${event.id}`}>
      <Card className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--primary)]">{event.event_date}</p>
            <h2 className="mt-1 text-base font-bold leading-snug">{event.display_name}</h2>
          </div>
          <Badge>{event.status}</Badge>
        </div>
        <p className="flex items-center gap-1 text-sm text-[var(--muted)]">
          <MapPin size={15} />
          {event.venue?.display_name ?? "Venue未設定"}
        </p>
      </Card>
    </Link>
  );
}

export const EventCard = memo(EventCardInner);
