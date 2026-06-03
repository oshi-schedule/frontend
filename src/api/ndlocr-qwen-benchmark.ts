function resolveBenchmarkApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_NDLOCR_QWEN_API_BASE_URL;
  if (configured) return configured;
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8010`;
  }
  return "http://localhost:8010";
}

const BENCHMARK_API_BASE_URL = resolveBenchmarkApiBaseUrl();

export interface EventCandidateBenchmarkResult {
  ocr_text: string;
  event_candidate: {
    event_name: string;
    venue_name: string;
    event_date: string;
    open_time: string;
    start_time: string;
  };
  metrics: {
    ocr_ms: number;
    llm_ms: number;
    total_ms: number;
  };
}

export async function runEventCandidateBenchmark(image: File): Promise<EventCandidateBenchmarkResult> {
  const formData = new FormData();
  formData.append("image", image);

  const response = await fetch(`${BENCHMARK_API_BASE_URL}/benchmark/event-candidate`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload);
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Benchmark API failed: ${response.status}`);
  }

  return response.json() as Promise<EventCandidateBenchmarkResult>;
}
