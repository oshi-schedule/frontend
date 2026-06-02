export type OCRBackendSuccess = {
  status: "success";
  request_id: string;
  data: {
    engine: string;
    engine_version: string;
    ocr_text: string;
    elapsed_seconds: number;
    queue_wait_seconds?: number;
    active_ocr_count?: number;
    max_concurrent_ocr?: number;
    worker_id?: number;
    cpu_percent?: number;
    memory_percent?: number;
  };
};

export type OCRBackendError = {
  status: "error";
  request_id?: string;
  message: string;
};

export type OCRBackendProxyResponse = {
  upstream: string;
  payload: OCRBackendSuccess | OCRBackendError;
};

export async function postOCRBackendTest(file: File): Promise<OCRBackendProxyResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/ocr-backend/ocr", {
    method: "POST",
    body: formData,
  });

  const result = (await response.json()) as OCRBackendProxyResponse;
  if (!response.ok) {
    const message = result.payload.status === "error" ? result.payload.message : `OCR backend failed: ${response.status}`;
    throw new Error(message);
  }

  return result;
}
