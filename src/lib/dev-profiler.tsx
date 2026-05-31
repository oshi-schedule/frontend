"use client";

import { Profiler, useRef, type ProfilerOnRenderCallback, type ReactNode } from "react";

const store = new Map<string, { count: number; totalMs: number }>();

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  const entry = store.get(id) ?? { count: 0, totalMs: 0 };
  entry.count += 1;
  entry.totalMs += actualDuration;
  store.set(id, entry);
  // eslint-disable-next-line no-console
  console.debug(
    `[Profiler] ${id} | phase=${phase} | #${entry.count} | this=${actualDuration.toFixed(1)}ms | avg=${(entry.totalMs / entry.count).toFixed(1)}ms`,
  );
};

export function DevProfiler({ id, children }: { id: string; children: ReactNode }) {
  if (process.env.NODE_ENV !== "development") return <>{children}</>;
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}

export function useRenderCount(name: string) {
  const countRef = useRef(0);
  countRef.current += 1;
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug(`[RenderCount] ${name} #${countRef.current}`);
  }
  return countRef.current;
}
