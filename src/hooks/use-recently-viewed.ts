import { useCallback, useEffect, useState } from "react";
import type { EventCore } from "@/types/api";

const STORAGE_KEY = "oshi-recently-viewed";
const MAX_ITEMS = 5;

export function useRecentlyViewed() {
  const [events, setEvents] = useState<EventCore[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEvents(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  const record = useCallback((event: EventCore) => {
    setEvents((prev) => {
      const next = [event, ...prev.filter((e) => e.id !== event.id)].slice(0, MAX_ITEMS);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { events, record, ready };
}
