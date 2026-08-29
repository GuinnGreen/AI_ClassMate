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

// Gemini Vision 支援的影像格式（PDF 已在前端轉為 image/png）
const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

// ---- 共用：配額預留（transaction 內檢查 + 寫 log，杜絕檢查與計數間的空窗） ----
// timestamp 用 Date.now() 毫秒數字（與前端 getTodayAiGenerationCount 對齊）
async function reserveQuota(
  uid: string,
  type: "ai_generate" | "schedule_recognize",
  extra: Record<string, unknown> = {}
): Promise<FirebaseFirestore.DocumentReference> {
  const logsRef = db.collection(`users/${uid}/logs`);
  const startOfDayMs = new Date().setHours(0, 0, 0, 0);

  return db.runTransaction(async (t) => {
    const countSnap = await t.get(
      logsRef.where("timestamp", ">=", startOfDayMs).count()
    );
    if (countSnap.data().count >= DAILY_QUOTA) {
      throw new HttpsError(
        "resource-exhausted",
        `每日 AI 使用配額已達上限（${DAILY_QUOTA} 次）`
      );
    }
    const logRef = logsRef.doc();
    t.set(logRef, { type, timestamp: Date.now(), ...extra });
    return logRef;
  });
}

// LLM 呼叫失敗時退還已預留的配額
async function refundQuota(
  logRef: FirebaseFirestore.DocumentReference
): Promise<void> {
  try {
    await logRef.delete();
  } catch (err) {
    console.error("[refundQuota] 配額退還失敗", err);
  }
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

    const logRef = await reserveQuota(uid, "ai_generate", {
      studentId: req.data?.studentId ?? null,
      lengthSetting: req.data?.lengthSetting ?? null,
      hasCustomPrompt: req.data?.hasCustomPrompt ?? false,
    });

    try {
      const text = await routeTextGeneration(prompt, {
        geminiKeysCsv: GEMINI_API_KEY.value(),
        groqApiKey: GROQ_API_KEY.value(),
        openrouterApiKey: OPENROUTER_API_KEY.value(),
      });
      return { text };
    } catch (err) {
      await refundQuota(logRef);
      throw err;
    }
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
    if (!ALLOWED_IMAGE_MIMES.includes(mimeType)) {
      throw new HttpsError("invalid-argument", `不支援的影像格式：${mimeType}`);
    }
    // base64 size limit: ~5MB raw → ~6.7MB base64
    if (base64Data.length > 7_000_000) {
      throw new HttpsError("invalid-argument", "圖片過大（請壓縮至 5MB 以下）");
    }

    const logRef = await reserveQuota(uid, "schedule_recognize");

    try {
      const text = await routeVisionGeneration(prompt, base64Data, mimeType, {
        geminiKeysCsv: GEMINI_API_KEY.value(),
        groqApiKey: GROQ_API_KEY.value(),
        openrouterApiKey: OPENROUTER_API_KEY.value(),
      });
      return { text };
    } catch (err) {
      await refundQuota(logRef);
      throw err;
    }
  }
);
