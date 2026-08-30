import { HttpsError } from "firebase-functions/v2/https";

export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

type AllowedImageMime = typeof ALLOWED_IMAGE_MIMES[number];

export interface ValidScheduleInput {
  prompt: string;
  base64Data: string;
  mimeType: AllowedImageMime;
}

export function validateScheduleInput(data: unknown): ValidScheduleInput {
  const value = data as Record<string, unknown> | null;
  const prompt = typeof value?.prompt === "string" ? value.prompt.trim() : "";
  const base64Data = typeof value?.base64Data === "string" ? value.base64Data : "";
  const mimeType = typeof value?.mimeType === "string" ? value.mimeType : "";

  if (!prompt || !base64Data || !mimeType) {
    throw new HttpsError("invalid-argument", "缺少必要參數");
  }
  if (!ALLOWED_IMAGE_MIMES.includes(mimeType as AllowedImageMime)) {
    throw new HttpsError("invalid-argument", `不支援的影像格式：${mimeType}`);
  }
  if (base64Data.length > 7_000_000) {
    throw new HttpsError("invalid-argument", "圖片過大（請壓縮至 5MB 以下）");
  }

  return { prompt, base64Data, mimeType: mimeType as AllowedImageMime };
}
