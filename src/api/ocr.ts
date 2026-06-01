import { apiFetch } from "./client";


export type OCRTestResponse = {
  raw_text: string;
};


export async function postOCRTest(file: File): Promise<OCRTestResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<OCRTestResponse>("/ocr/test", {
    method: "POST",
    body: formData,
  });
}
