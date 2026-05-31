import { create } from "zustand";

type MetricKind = "event_create" | "timetable_create";

type Metric = {
  kind: MetricKind;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
};

type MetricsState = {
  metrics: Metric[];
  start: (kind: MetricKind) => void;
  finish: (kind: MetricKind) => number | null;
};

export const useUxMetrics = create<MetricsState>((set, get) => ({
  metrics: [],
  start: (kind) =>
    set((state) => ({
      metrics: [{ kind, startedAt: Date.now() }, ...state.metrics.filter((metric) => metric.kind !== kind)]
    })),
  finish: (kind) => {
    const metric = get().metrics.find((item) => item.kind === kind && !item.finishedAt);
    if (!metric) return null;
    const finishedAt = Date.now();
    const durationMs = finishedAt - metric.startedAt;
    set((state) => ({
      metrics: state.metrics.map((item) => (item === metric ? { ...item, finishedAt, durationMs } : item))
    }));
    return durationMs;
  }
}));
