import { GoogleGenAI, Type } from "@google/genai";

// ---- 多 key rotation ----

interface KeyState {
  pool: GoogleGenAI[];
  index: number;
}

function buildPool(rawCsv: string): KeyState {
  const keys = rawCsv
    .split(/[,;\s]+/)
    .map(k => k.trim())
    .filter(Boolean);
  return {
    pool: keys.map(k => new GoogleGenAI({ apiKey: k })),
    index: 0,
  };
}

const MAX_BACKOFF_MS = 30000;

async function callGeminiWithRetry<T>(
  state: KeyState,
  operationName: string,
  operation: (client: GoogleGenAI) => Promise<T>
): Promise<T> {
  if (state.pool.length === 0) {
    throw new Error("Gemini: 未設定 API Key");
  }

  const maxAttempts = Math.max(state.pool.length * 3, 5);
  let attempt = 0;
  let delayMs = 2000;

  while (attempt < maxAttempts) {
    try {
      return await operation(state.pool[state.index]);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStatus = (error as { status?: number }).status;
      const isRateLimit =
        errMsg.includes("429") ||
        errStatus === 429 ||
        errMsg.includes("RESOURCE_EXHAUSTED");

      if (isRateLimit) {
        console.warn(
          `[Gemini] Key #${state.index} hit rate limit (${operationName}). Rotating...`
        );
        state.index = (state.index + 1) % state.pool.length;
        attempt++;
        if (attempt % state.pool.length === 0) {
          await new Promise(res => setTimeout(res, delayMs));
          delayMs = Math.min(delayMs * 2, MAX_BACKOFF_MS);
        }
        continue;
      }
      throw error;
    }
  }
  throw new Error("系統忙碌中 (所有 Gemini Key 皆達上限)");
}

// ---- Groq / OpenRouter (OpenAI-compatible) ----

async function callOpenAICompatible(
  apiUrl: string,
  apiKey: string,
  payload: Record<string, unknown>,
  providerName: string
): Promise<string> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`${providerName} API 錯誤 (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content || "";
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

// ---- Public router ----

export interface LlmConfig {
  geminiKeysCsv: string;
  groqApiKey: string;
  openrouterApiKey: string;
}

export async function routeTextGeneration(
  prompt: string,
  config: LlmConfig
): Promise<string> {
  const state = buildPool(config.geminiKeysCsv);

  // Layer 1: Gemini 2.5 Flash-Lite
  if (state.pool.length > 0) {
    try {
      const text = await callGeminiWithRetry(state, "generateText", async (client) => {
        const res = await client.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: prompt,
          config: { temperature: 0.7 },
        });
        return res.text || "";
      });
      if (text) return text;
    } catch (e) {
      console.warn("[LLM] Gemini 文字失敗:", e);
    }
  }

  // Layer 2: Groq qwen3-32b
  if (config.groqApiKey) {
    try {
      const text = await callOpenAICompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        config.groqApiKey,
        {
          model: "qwen/qwen3-32b",
          messages: [
            { role: "system", content: "/no_think" },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        },
        "Groq"
      );
      if (text) return text;
    } catch (e) {
      console.warn("[LLM] Groq 失敗:", e);
    }
  }

  // Layer 3: OpenRouter DeepSeek V3.1
  if (config.openrouterApiKey) {
    try {
      const text = await callOpenAICompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        config.openrouterApiKey,
        {
          model: "deepseek/deepseek-chat-v3.1:free",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        },
        "OpenRouter"
      );
      if (text) return text;
    } catch (e) {
      console.warn("[LLM] OpenRouter 失敗:", e);
    }
  }

  throw new Error("所有 AI 服務皆無法使用");
}

// ---- Schedule (Vision) ----

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

const VISION_SUPPORTED = ["image/jpeg", "image/png", "image/webp"];

export async function routeVisionGeneration(
  prompt: string,
  base64Data: string,
  mimeType: string,
  config: LlmConfig
): Promise<string> {
  const state = buildPool(config.geminiKeysCsv);
  const errors: string[] = [];

  // Layer 1: Gemini 2.5 Flash
  if (state.pool.length > 0) {
    try {
      const text = await callGeminiWithRetry(state, "parseSchedule", async (client) => {
        const res = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: {
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              { text: prompt },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: SCHEDULE_RESPONSE_SCHEMA,
            temperature: 0.1,
          },
        });
        return res.text || "[]";
      });
      return text;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[Vision] Gemini 失敗:", msg);
      errors.push(`Gemini: ${msg}`);
    }
  }

  // Layer 2: Groq Vision
  if (config.groqApiKey && VISION_SUPPORTED.includes(mimeType)) {
    try {
      return await callOpenAICompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        config.groqApiKey,
        {
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
                { type: "text", text: prompt },
              ],
            },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        },
        "Groq Vision"
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Groq Vision: ${msg}`);
    }
  }

  // Layer 3: OpenRouter Vision
  if (config.openrouterApiKey && VISION_SUPPORTED.includes(mimeType)) {
    try {
      return await callOpenAICompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        config.openrouterApiKey,
        {
          model: "qwen/qwen3-vl-235b-a22b-instruct:free",
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
                { type: "text", text: prompt },
              ],
            },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        },
        "OpenRouter Vision"
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`OpenRouter Vision: ${msg}`);
    }
  }

  throw new Error(`所有 AI 服務皆無法使用\n${errors.join("\n")}`);
}
