import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { routeTextGeneration, routeVisionGeneration } from "./llmRouter";

initializeApp();
const db = getFirestore();

// asia-east1 = 彰化機房，距台灣最近
setGlobalOptions({ region: "asia-east1", maxInstances: 10 });

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const OPENROUTER_API_KEY = defineSecret("OPENROUTER_API_KEY");

const DAILY_QUOTA = 30;

// ---- 共用：rate limit 檢查 ----
// timestamp 用 Date.now() 毫秒數字（與前端 getTodayAiGenerationCount 對齊）
async function checkRateLimit(uid: string): Promise<void> {
  const startOfDayMs = new Date().setHours(0, 0, 0, 0);

  const snapshot = await db
    .collection(`users/${uid}/logs`)
    .where("timestamp", ">=", startOfDayMs)
    .count()
    .get();

  const count = snapshot.data().count;
  if (count >= DAILY_QUOTA) {
    throw new HttpsError(
      "resource-exhausted",
      `每日 AI 使用配額已達上限（${DAILY_QUOTA} 次）`
    );
  }
}

async function writeLog(
  uid: string,
  type: "ai_generate" | "schedule_recognize",
  extra: Record<string, unknown> = {}
): Promise<void> {
  await db.collection(`users/${uid}/logs`).add({
    type,
    timestamp: Date.now(),
    ...extra,
  });
}

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

    await checkRateLimit(uid);

    const text = await routeTextGeneration(prompt, {
      geminiKeysCsv: GEMINI_API_KEY.value(),
      groqApiKey: GROQ_API_KEY.value(),
      openrouterApiKey: OPENROUTER_API_KEY.value(),
    });

    await writeLog(uid, "ai_generate", {
      studentId: req.data?.studentId ?? null,
      lengthSetting: req.data?.lengthSetting ?? null,
      hasCustomPrompt: req.data?.hasCustomPrompt ?? false,
    });
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

    const prompt = (req.data?.prompt as string | undefined)?.trim();
    const base64Data = req.data?.base64Data as string | undefined;
    const mimeType = req.data?.mimeType as string | undefined;

    if (!prompt || !base64Data || !mimeType) {
      throw new HttpsError("invalid-argument", "缺少必要參數");
    }
    // base64 size limit: ~5MB raw → ~6.7MB base64
    if (base64Data.length > 7_000_000) {
      throw new HttpsError("invalid-argument", "圖片過大（請壓縮至 5MB 以下）");
    }

    await checkRateLimit(uid);

    const text = await routeVisionGeneration(prompt, base64Data, mimeType, {
      geminiKeysCsv: GEMINI_API_KEY.value(),
      groqApiKey: GROQ_API_KEY.value(),
      openrouterApiKey: OPENROUTER_API_KEY.value(),
    });

    await writeLog(uid, "schedule_recognize");
    return { text };
  }
);
