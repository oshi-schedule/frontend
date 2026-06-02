function resolveApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configured) return configured;
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

const API_BASE_URL = resolveApiBaseUrl();

type ApiOptions = RequestInit & { query?: Record<string, string | number | undefined | null> };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: unknown
  ) {
    super(message);
  }
}

function buildUrl(path: string, query?: ApiOptions["query"]) {
  const url = new URL(path, API_BASE_URL);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

export function apiUrl(path: string, query?: ApiOptions["query"]) {
  return buildUrl(path, query);
}

function formatApiDetail(detail: unknown) {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object") {
    const value = detail as { detail?: unknown };
    if (typeof value.detail === "string" && value.detail.trim()) return value.detail;
    if (Array.isArray(value.detail)) {
      const messages = value.detail
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          const entry = item as { msg?: unknown; loc?: unknown };
          const location = Array.isArray(entry.loc) ? entry.loc.join(".") : "";
          const message = typeof entry.msg === "string" ? entry.msg : "";
          return [location, message].filter(Boolean).join(": ");
        })
        .filter(Boolean);
      if (messages.length > 0) return messages.join(" / ");
    }
  }
  return null;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildUrl(path, options.query), {
    ...options,
    headers
  });

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    const detailMessage = formatApiDetail(detail);
    throw new ApiError(detailMessage ? `API request failed: ${response.status} - ${detailMessage}` : `API request failed: ${response.status}`, response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
