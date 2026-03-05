import { GoogleGenAI, Type } from "@google/genai";
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
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

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

// --- OpenRouter Text Fallback (for comment generation) ---

async function callOpenRouterTextFallback(prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("未設定 OPENROUTER_API_KEY，無法使用備援 AI");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen/qwen-2.5-72b-instruct:free",
      messages: [
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API 錯誤 (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

// --- OpenAI-compatible Vision API (shared by Groq Vision & OpenRouter) ---

async function callOpenAICompatibleVision(
  apiUrl: string,
  apiKey: string,
  model: string,
  providerName: string,
  prompt: string,
  base64Data: string,
  mimeType: string
): Promise<string> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Data}` },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`${providerName} API 錯誤 (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
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
          const negatives = record.points
            .filter(p => p.value < 0 && !p.label.startsWith('🎁'))
            .map(p => p.label).join(", ");
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

    // OpenRouter fallback（第三層備援）
    if (OPENROUTER_API_KEY) {
      try {
        console.warn("[AI] Groq 也失敗，嘗試 OpenRouter fallback...");
        const fallbackText = await callOpenRouterTextFallback(prompt);
        if (fallbackText) return fallbackText;
      } catch (openRouterError: unknown) {
        console.error("[AI] OpenRouter fallback 也失敗:", openRouterError);
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
你是一位台灣教育課表辨識專家。請分析這份課表（圖片或PDF），準確提取每位學生的每日課程安排。

【台灣國小課表結構說明】
- 表格的「列」(rows) 代表節次（第一節到第七節，共7節）
- 表格的「欄」(columns) 代表星期（週一到週五，可能標示為「一」「二」「三」「四」「五」）
- 每個格子通常有「科目名稱」（較大的字）和「任課教師」（較小的字或不同顏色）
- 請只擷取科目名稱，完全忽略教師姓名

【科目名稱辨識規則】
1. 「藝文」+細項（如「藝文表藝」「藝文音樂」「藝文美勞」）→ 只填細項（「表藝」「音樂」「美勞」）
2. 「健體」+細項（如「健體健康」「健體體育」）→ 只填細項（「健康」「體育」）
3. 「彈性」開頭（如「彈性閱讀」「彈性電腦」「彈性社團」「彈性作文」「彈性校訂英語」）→ 保留完整名稱
4. 空格或無課 → 填寫空字串 ""

【節次名稱規則】
無論圖片上顯示時間或節次編號，一律輸出以下固定 periodName：
- 第一節（對應 08:40-09:20）
- 第二節（對應 09:30-10:10）
- 第三節（對應 10:30-11:10）
- 第四節（對應 11:20-12:00）
- 第五節（對應 13:30-14:10）
- 第六節（對應 14:20-15:00）
- 第七節（對應 15:20-16:00）

【雙語課表處理規則】
- 部分課表每格包含中文和英文（如「數學 Math」「體育 P.E.」），這是雙語標注，不是兩節課
- 遇到中英並列的格子，只取中文科目名稱，完全忽略英文部分
- 英文教師姓名（如「Wang」「Chen」）視同一般教師姓名，一律忽略
- 格子內的換行符或斜線（/）不代表分隔兩節課，整格仍算一節

【星期欄位辨識規則】
- 欄標題可能的格式：「一二三四五」、「星期一 星期二...」、「Mon Tue...」，皆對應 dayOfWeek 1-5
- 有些課表欄位順序是**從右到左**（五四三二一），請依照欄位實際位置對應正確的 dayOfWeek，不要假設一定是從左到右
- 若無法辨識欄標題，預設以從左到右為週一到週五

【早自習處理規則】
- 部分課表在第一節前有「早自習」、「早讀」、「晨間」等行，這不屬於七節課的範圍
- 請完全忽略早自習列，七節課從第一節（08:40）開始計算
- 若課表標示節次號碼，請以第 1 節 = 第一節、第 2 節 = 第二節……以此類推，不要將早自習算作第一節

【輸出格式】
直接輸出純 JSON 陣列，不加任何 Markdown 標記：
[
  {
    "dayOfWeek": 1,
    "periods": [
      {"periodName": "第一節", "subject": "國語"},
      {"periodName": "第二節", "subject": "數學"},
      {"periodName": "第三節", "subject": "社會"},
      {"periodName": "第四節", "subject": "社會"},
      {"periodName": "第五節", "subject": "表藝"},
      {"periodName": "第六節", "subject": "音樂"},
      {"periodName": "第七節", "subject": "閱讀"}
    ]
  },
  { "dayOfWeek": 2, "periods": [...] },
  { "dayOfWeek": 3, "periods": [...] },
  { "dayOfWeek": 4, "periods": [...] },
  { "dayOfWeek": 5, "periods": [...] }
]

注意：
- dayOfWeek: 1=週一, 2=週二, 3=週三, 4=週四, 5=週五
- 每天必須有恰好 7 個 periods（第一節到第七節）
- periodName 只能使用「第一節」到「第七節」
  `;

  const PERIOD_NAMES = ["第一節","第二節","第三節","第四節","第五節","第六節","第七節"] as const;

  function validateAndRepairSchedule(raw: unknown[]): DaySchedule[] {
    const dayMap = new Map<number, DaySchedule>();

    for (const item of raw) {
      if (typeof item !== 'object' || item === null) continue;
      const obj = item as Record<string, unknown>;
      const dayOfWeek = Number(obj.dayOfWeek);
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 5) continue;

      const rawPeriods = Array.isArray(obj.periods) ? obj.periods : [];
      const periods = PERIOD_NAMES.map((periodName, idx) => {
        const p = rawPeriods[idx] as Record<string, unknown> | undefined;
        const subject = typeof p?.subject === 'string' ? p.subject.trim() : "";
        return { periodName, subject };
      });

      dayMap.set(dayOfWeek, { dayOfWeek, periods });
    }

    for (let day = 1; day <= 5; day++) {
      if (!dayMap.has(day)) {
        dayMap.set(day, {
          dayOfWeek: day,
          periods: PERIOD_NAMES.map(periodName => ({ periodName, subject: "" })),
        });
      }
    }

    return [1,2,3,4,5].map(day => dayMap.get(day)!);
  }

  function extractAndParseJson(text: string): DaySchedule[] {
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return validateAndRepairSchedule(parsed);
    } catch { /* 繼續 */ }

    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.substring(start, end + 1));
        if (Array.isArray(parsed)) return validateAndRepairSchedule(parsed);
      } catch { /* 繼續 */ }
    }

    console.error("[課表辨識] 無法提取 JSON:", cleaned.substring(0, 300));
    throw new Error("AI 回傳的格式無法解析，請重試或手動輸入。");
  }

  const SCHEDULE_RESPONSE_SCHEMA = {
    type: Type.ARRAY,
    minItems: "5",
    maxItems: "5",
    items: {
      type: Type.OBJECT,
      required: ["dayOfWeek", "periods"],
      properties: {
        dayOfWeek: { type: Type.INTEGER },
        periods: {
          type: Type.ARRAY,
          minItems: "7",
          maxItems: "7",
          items: {
            type: Type.OBJECT,
            required: ["periodName", "subject"],
            properties: {
              periodName: {
                type: Type.STRING,
                enum: ["第一節","第二節","第三節","第四節","第五節","第六節","第七節"],
              },
              subject: { type: Type.STRING },
            },
          },
        },
      },
    },
  };

  const VISION_SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const errors: string[] = [];

  // --- Layer 1: Gemini ---
  if (API_KEYS.length > 0) {
    try {
      const daySchedules = await callWithRetry("parseScheduleFromImage", async (client) => {
        const response = await client.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: {
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              { text: prompt }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: SCHEDULE_RESPONSE_SCHEMA,
            temperature: 0.1,
          }
        });
        return extractAndParseJson(response.text || "[]");
      });
      return daySchedules;
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn("[課表辨識] Gemini 失敗:", detail);
      errors.push(`Gemini: ${detail}`);
    }
  }

  // --- Layer 2: Groq Vision ---
  if (GROQ_API_KEY && VISION_SUPPORTED_TYPES.includes(mimeType)) {
    try {
      console.warn("[課表辨識] 嘗試 Groq Vision 備援...");
      const text = await callOpenAICompatibleVision(
        "https://api.groq.com/openai/v1/chat/completions",
        GROQ_API_KEY,
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "Groq Vision",
        prompt,
        base64Data,
        mimeType
      );
      return extractAndParseJson(text);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn("[課表辨識] Groq Vision 失敗:", detail);
      errors.push(`Groq Vision: ${detail}`);
    }
  } else if (GROQ_API_KEY) {
    console.warn(`[課表辨識] Groq Vision 不支援 ${mimeType}，跳過`);
    errors.push(`Groq Vision: 不支援 ${mimeType} 格式`);
  }

  // --- Layer 3: OpenRouter ---
  if (OPENROUTER_API_KEY && VISION_SUPPORTED_TYPES.includes(mimeType)) {
    try {
      console.warn("[課表辨識] 嘗試 OpenRouter 備援...");
      const text = await callOpenAICompatibleVision(
        "https://openrouter.ai/api/v1/chat/completions",
        OPENROUTER_API_KEY,
        "qwen/qwen-2.5-vl-72b-instruct:free",
        "OpenRouter",
        prompt,
        base64Data,
        mimeType
      );
      return extractAndParseJson(text);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn("[課表辨識] OpenRouter 失敗:", detail);
      errors.push(`OpenRouter: ${detail}`);
    }
  } else if (OPENROUTER_API_KEY) {
    console.warn(`[課表辨識] OpenRouter 不支援 ${mimeType}，跳過`);
    errors.push(`OpenRouter: 不支援 ${mimeType} 格式`);
  }

  // 全部失敗
  console.error("[課表辨識] 所有 AI 服務皆失敗:", errors);
  throw new Error(`所有 AI 服務皆無法使用，請稍後再試。\n${errors.join("\n")}`);
};
