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
      messages: [
        { role: "system", content: "/no_think" },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API 錯誤 (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  // 清除 Qwen3 可能殘留的 <think>...</think> 標籤
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

export const DEFAULT_SYSTEM_INSTRUCTION = `
你是一位擁有二十年教學經驗、信奉正向管教與成長型思維的台灣國小班導師。請根據以下提供的學生整學期行為紀錄與教師勾選的特質標籤，以溫暖、委婉且具備建設性的語氣，撰寫一份給家長閱讀的期末評語。

【撰寫原則】
1. 語氣溫和、鼓勵性質為主，但也需委婉指出需要改進的地方（若有負面紀錄）。
2. 必須具體引用上述的行為紀錄作為證據，不要憑空捏造（避免幻覺）。
3. 評語應聚焦於學生的「努力過程」與「自我調節策略」，避免空泛的自我層次讚美（如「你好棒」）。
4. 在描述待改進之處時，應轉化為正向的社會勸說，引導學生將失敗歸因為「可控的策略不足」而非「能力缺失」。
5. 結尾需包含具體可操作的「下一步建議」（Feed Forward），為學生新學期提供努力方向。
6. 格式為一段完整的文章，不需要列點。
7. 用台灣繁體中文撰寫。

【優良評語範例】
範例一（學業優異但內向）：
「小明這學期在數學領域展現了令人驚喜的成長，多次在課堂練習中主動嘗試不同解題策略，這份願意挑戰的精神非常值得肯定。在閱讀理解方面，他總能細心地找出文章的關鍵訊息，作業完成度也相當穩定。老師注意到小明在小組討論時比較安靜，建議下學期可以從「先和一位好朋友分享想法」開始練習，相信以他的思考深度，一定能為同學帶來很棒的觀點。」

範例二（活潑但常規不佳）：
「小華是班上的開心果，總能用樂觀的態度感染身邊的同學，在團體活動中展現了優秀的領導潛力。這學期他在美勞課的創意表現尤其亮眼，作品經常獲得同學的讚賞。不過，老師也發現小華有時會因為太投入與同學的互動，而錯過老師講解的重要內容。建議下學期可以試著練習「先聽完老師的說明，再和同學討論」，這樣就能兼顧學習與社交，讓自己的表現更上一層樓。」
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

    【教師勾選之特質標籤】
    ${tagsText}

    【整學期行為紀錄】
    ${historyText}

    【額外教師備註】
    ${teacherNote}

    【字數要求】
    請將字數控制在${lengthDesc}。請參考上述優良評語範例的風格與結構進行撰寫。
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
