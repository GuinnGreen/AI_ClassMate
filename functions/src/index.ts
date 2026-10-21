import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { routeTextGeneration, routeVisionGeneration } from "./llmRouter";
import { validateScheduleInput } from "./inputValidation";
import {
  executeWithQuotaReservation,
  getQuotaUsage,
  reserveQuota,
} from "./quotaReservation";

initializeApp();
const db = getFirestore();

// asia-east1 = 彰化機房，距台灣最近
setGlobalOptions({ region: "asia-east1", maxInstances: 10 });

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const OPENROUTER_API_KEY = defineSecret("OPENROUTER_API_KEY");

// 配額以 Asia/Taipei 日界線及 server-only deterministic counter 為權威；
// users/{uid}/logs 保留既有稽核與相容格式。

export const getAiQuotaUsage = onCall(async (req) => {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "請先登入");
  }
  return getQuotaUsage(db, req.auth.uid);
});

// ---- Callable: generateText（評語生成） ----

export const generateText = onCall(
  { secrets: [GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY] },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "請先登入");
    }
    const uid = req.auth.uid;

    const prompt = (req.data?.prompt as string | undefined)?.trim();
    if (!prompt) {
      throw new HttpsError("invalid-argument", "缺少 prompt");
    }
    if (prompt.length > 32000) {
      throw new HttpsError("invalid-argument", "prompt 過長");
    }

    const logRef = await reserveQuota(db, uid, "ai_generate", {
      studentId: req.data?.studentId ?? null,
      lengthSetting: req.data?.lengthSetting ?? null,
      hasCustomPrompt: req.data?.hasCustomPrompt ?? false,
    });

    const text = await executeWithQuotaReservation(
      logRef,
      () => routeTextGeneration(prompt, {
        geminiKeysCsv: GEMINI_API_KEY.value(),
        groqApiKey: GROQ_API_KEY.value(),
        openrouterApiKey: OPENROUTER_API_KEY.value(),
      }),
      (status, error) => console.error(
        `[generateText] 配額 ${status} 狀態寫入失敗；預留將自動逾時`,
        error
      )
    );
    return { text };
  }
);

// ---- Callable: parseSchedule（課表辨識） ----

export const parseSchedule = onCall(
  {
    secrets: [GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY],
    memory: "1GiB", // base64 圖檔可能較大
    timeoutSeconds: 120,
  },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "請先登入");
    }
    const uid = req.auth.uid;

    const { prompt, base64Data, mimeType } = validateScheduleInput(req.data);

    const logRef = await reserveQuota(db, uid, "schedule_recognize");

    const text = await executeWithQuotaReservation(
      logRef,
      () => routeVisionGeneration(prompt, base64Data, mimeType, {
        geminiKeysCsv: GEMINI_API_KEY.value(),
        groqApiKey: GROQ_API_KEY.value(),
        openrouterApiKey: OPENROUTER_API_KEY.value(),
      }),
      (status, error) => console.error(
        `[parseSchedule] 配額 ${status} 狀態寫入失敗；預留將自動逾時`,
        error
      )
    );
    return { text };
  }
);
