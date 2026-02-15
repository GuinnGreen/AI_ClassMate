import { GoogleGenAI } from "@google/genai";
import { Student, DaySchedule } from "../types";

// 嚴格遵循 Google GenAI SDK 規範，使用 process.env.API_KEY
// 注意：在 Vite 環境中，你需要確保 process.env.API_KEY 已透過 define 或其他方式注入
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * RAG 邏輯：聚合學生歷史紀錄與標籤，生成評語
 */
export const generateStudentComment = async (
  student: Student, 
  teacherNote: string = "",
  lengthSetting: 'short' | 'medium' | 'long' = 'medium'
): Promise<string> => {
  // 1. 資料清理與聚合 (RAG Context Building)
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

  // 字數設定轉換
  let lengthDesc = "";
  switch (lengthSetting) {
    case 'short': lengthDesc = "約 50 字左右的精簡短評"; break;
    case 'medium': lengthDesc = "約 100~150 字的完整段落"; break;
    case 'long': lengthDesc = "約 250~300 字的詳盡敘述"; break;
  }

  // 2. 建構 Prompt
  const prompt = `
    你是一位專業、溫暖且客觀的國小班級導師。請根據以下提供的學生整學期行為紀錄 (Evidence) 與教師勾選的特質標籤，撰寫一份期末評語。
    
    【學生資訊】
    姓名: ${student.name}
    總積分: ${student.totalScore}
    
    【特質標籤】
    ${tagsText}
    
    【整學期行為紀錄 (RAG Context)】
    ${historyText}
    
    【額外教師備註】
    ${teacherNote}

    【撰寫要求】
    1. 字數控制：請撰寫${lengthDesc}。
    2. 語氣溫和、鼓勵性質為主，但也需委婉指出需要改進的地方 (若有負面紀錄)。
    3. 必須具體引用上述的行為紀錄作為證據，不要憑空捏造。
    4. 針對家長閱讀，格式為一段完整的文章，不需要列點。
    5. 用台灣繁體中文撰寫。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return response.text || "無法生成評語，請稍後再試。";
  } catch (error) {
    console.error("Gemini AI Error:", error);
    throw new Error("AI 服務暫時無法使用");
  }
};

/**
 * 辨識課表圖片/PDF
 * @param base64Data - 圖片的 Base64 字串
 * @param mimeType - 檔案類型 (image/png, image/jpeg)
 */
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // 使用 Vision 能力強的模型
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt }
        ]
      }
    });

    const text = response.text || "[]";
    // 清理可能的 markdown
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr) as DaySchedule[];
  } catch (error) {
    console.error("Schedule Parse Error:", error);
    throw new Error("無法辨識課表，請確認圖片清晰度或手動輸入。");
  }
};