import { NextResponse } from "next/server";

const OCR_API_BASE_URL = process.env.OCR_API_BASE_URL ?? "http://34.146.158.181:8000";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const response = await fetch(`${OCR_API_BASE_URL}/api/v1/ocr`, {
      method: "POST",
      body: formData,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    return NextResponse.json(
      {
        upstream: OCR_API_BASE_URL,
        payload,
      },
      { status: response.status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        upstream: OCR_API_BASE_URL,
        payload: {
          status: "error",
          message: error instanceof Error ? error.message : "OCR backend proxy failed",
        },
      },
      { status: 502 }
    );
  }
}
