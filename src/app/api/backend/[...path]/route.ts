import { NextRequest } from "next/server";

export const runtime = "nodejs";

const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = (params.path ?? []).join("/");
  const target = new URL(`/${path}`, BACKEND_API_BASE_URL);
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  HOP_BY_HOP_HEADERS.forEach((header) => headers.delete(header));

  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });

  const responseHeaders = new Headers(upstream.headers);
  HOP_BY_HOP_HEADERS.forEach((header) => responseHeaders.delete(header));

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const HEAD = proxyRequest;

