import { GoogleGenAI } from "@google/genai";
import { Student, DaySchedule } from "../types";

// --- Multi-Key Rotation Logic ---

const rawKeys = process.env.API_KEY || "";
const API_KEYS = rawKeys
  .split(/[,;\s]+/)
  .map((k) => k.trim())
  .filter((k) => k.length > 0);

console.log(`[Gemini Service] Initialized with ${API_KEYS.length} keys.`);

if (API_KEYS.length === 0) {
  console.warn("Project Warning: No API_KEY found in process.env");
}

const clientPool = API_KEYS.map((key) => new GoogleGenAI({ apiKey: key }));
let currentKeyIndex = 0;

const MAX_BACKOFF_MS = 30000;

async function callWithRetry<T>(
  operationName: string,
  operation: (client: GoogleGenAI) => Promise<T>
): Promise<T> {
  if (clientPool.length === 0) {
    throw new Error("系統錯誤：未設定 API Key");
  }

  const maxAttempts = Math.max(clientPool.length * 3, 5);
  let attempt = 0;
  let delayMs = 2000;

  while (attempt < maxAttempts) {
    try {
      const client = clientPool[currentKeyIndex];
      return await operation(client);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStatus = (error as { status?: number }).status;
      const isRateLimit =
        errMsg.includes("429") ||
        errStatus === 429 ||
        errMsg.includes("RESOURCE_EXHAUSTED");

      if (isRateLimit) {
        console.warn(
          `[Gemini] Key #${currentKeyIndex} hit rate limit (${operationName}). Rotating...`
        );

        currentKeyIndex = (currentKeyIndex + 1) % clientPool.length;
        attempt++;

        if (attempt % clientPool.length === 0) {
          console.warn(`[Gemini] All keys exhausted. Waiting ${delayMs}ms before retry...`);
          await new Promise(res => setTimeout(res, delayMs));
          delayMs = Math.min(delayMs * 2, MAX_BACKOFF_MS);
        }

        continue;
      }

      throw error;
    }
  }

  throw new Error("系統忙碌中 (所有 API Key 皆達上限)，請稍後再試。");
}

// --- Groq Fallback (OpenAI-compatible API) ---

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

async function callGroqFallback(prompt: string): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("未設定 GROQ_API_KEY，無法使用備援 AI");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen/qwen3-32b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API 錯誤 (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export const DEFAULT_SYSTEM_INSTRUCTION = `
你是一位專業、溫暖且客觀的國小班級導師。請根據以下提供的學生整學期行為紀錄 (Evidence) 與教師勾選的特質標籤，撰寫一份期末評語。

【撰寫要求】
1. 語氣溫和、鼓勵性質為主，但也需委婉指出需要改進的地方 (若有負面紀錄)。
2. 必須具體引用上述的行為紀錄作為證據，不要憑空捏造。
3. 針對家長閱讀，格式為一段完整的文章，不需要列點。
4. 用台灣繁體中文撰寫。
`;

export const generateStudentComment = async (
  student: Student,
  teacherNote: string = "",
  wordCount: number = 150,
  customInstruction: string = ""
): Promise<string> => {
  let historyText = "";
  const sortedDates = Object.keys(student.dailyRecords).sort();

  if (sortedDates.length === 0) {
    historyText = "該生本學期尚無具體加減分紀錄。";
  } else {
    sortedDates.forEach(date => {
      const record = student.dailyRecords[date];
      if (record.points.length > 0 || record.note) {
        historyText += `\n[日期: ${date}]`;
        if (record.points.length > 0) {
          const positives = record.points.filter(p => p.value > 0).map(p => p.label).join(", ");
          const negatives = record.points.filter(p => p.value < 0).map(p => p.label).join(", ");
          if (positives) historyText += `\n  - 優點表現: ${positives}`;
          if (negatives) historyText += `\n  - 待改進: ${negatives}`;
        }
        if (record.note) {
          historyText += `\n  - 教師筆記: ${record.note}`;
        }
      }
    });
  }

  const tagsText = student.tags.length > 0 ? student.tags.join(", ") : "無特定標籤";
  const lengthDesc = `約 ${wordCount} 字左右`;
  const baseInstruction = customInstruction.trim() || DEFAULT_SYSTEM_INSTRUCTION;

  const prompt = `
    ${baseInstruction}

    【學生資訊】
    姓名: ${student.name}
    總積分: ${student.totalScore}

    【特質標籤】
    ${tagsText}

    【整學期行為紀錄 (RAG Context)】
    ${historyText}

    【額外教師備註】
    ${teacherNote}

    【補充要求】
    請將字數控制在${lengthDesc}。
  `;

  try {
    const responseText = await callWithRetry("generateStudentComment", async (client) => {
      const response = await client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          temperature: 0.7,
        }
      });
      return response.text;
    });

    return responseText || "無法生成評語，請稍後再試。";
  } catch (error: unknown) {
    console.error("Gemini AI Error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);

    // Gemini 全部失敗時，嘗試 Groq 備援
    if (GROQ_API_KEY) {
      try {
        console.warn("[AI] Gemini 全部失敗，嘗試 Groq fallback...");
        const fallbackText = await callGroqFallback(prompt);
        if (fallbackText) return fallbackText;
      } catch (groqError: unknown) {
        console.error("[AI] Groq fallback 也失敗:", groqError);
      }
    }

    if (errMsg.includes("系統忙碌中")) {
      return errMsg;
    }
    return "AI 服務暫時無法使用 (請檢查網路或 API Key)";
  }
};

export const parseScheduleFromImage = async (
  base64Data: string,
  mimeType: string
): Promise<DaySchedule[]> => {
  const prompt = `
    請分析這張圖片，它是一張學校的課表。
    請將其轉換為 JSON 格式，結構如下：
    一個陣列，包含 5 個物件 (代表週一到週五)，每個物件有：
    - "dayOfWeek": 數字 1 到 5 (1=週一, 5=週五)
    - "periods": 一個陣列，包含當天所有節次。每個節次有：
      - "periodName": 字串 (例如 "第一節", "08:00-08:40", "午休" 等，請盡量辨識時間或節次名稱)
      - "subject": 字串 (科目名稱)

    請直接回傳純 JSON 字串，不要有 Markdown 標記 (如 \`\`\`json)。
    如果有無法辨識的科目，請填寫 "空堂" 或保留空白。
    請確保涵蓋週一至週五。
  `;

  try {
    const daySchedules = await callWithRetry("parseScheduleFromImage", async (client) => {
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: prompt }
          ]
        }
      });
      const text = response.text || "[]";
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        return JSON.parse(jsonStr) as DaySchedule[];
      } catch {
        console.error("Failed to parse JSON from AI response:", jsonStr);
        throw new Error("AI 回傳的格式無法解析，請重試或手動輸入。");
      }
    });

    return daySchedules;

  } catch (error: unknown) {
    console.error("Schedule Parse Error:", error);
    throw new Error("無法辨識課表，請確認圖片清晰度或手動輸入。");
  }
};
