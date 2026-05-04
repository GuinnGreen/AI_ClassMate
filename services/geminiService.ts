import { Student, DaySchedule } from "../types";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

// --- 隱私關鍵字過濾（保護輔導紀錄不外洩至 LLM） ---
const PRIVACY_KEYWORDS = [
  '離婚', '離異', '單親', '家暴', '低收', '中低收',
  '疾病', '生病', '憂鬱', '焦慮', '霸凌', '輔導',
  '父母', '父親', '母親', '隔代', '寄養', '受虐',
  '藥物', '過動', '亞斯', '自閉', '經濟', '貧困',
  'ADHD', '特教', '身障', '殘',
  '過世', '離世', '酗酒', '吸毒', '入獄', '外籍', '新住民'
];

function sanitizeNoteForRag(note: string): string | null {
  if (!note?.trim()) return null;
  for (const kw of PRIVACY_KEYWORDS) {
    if (note.includes(kw)) return null;
  }
  return note.trim();
}

// --- Cloud Functions Callable Wrappers ---
// LLM 呼叫已遷移至 functions/src/index.ts，前端僅透過 callable 呼叫，不再持有 API key
const callGenerateText = httpsCallable<
  { prompt: string; studentId?: string; lengthSetting?: number; hasCustomPrompt?: boolean },
  { text: string }
>(functions, "generateText");

const callParseSchedule = httpsCallable<
  { prompt: string; base64Data: string; mimeType: string },
  { text: string }
>(functions, "parseSchedule");

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
8. 字數需嚴格控制在【字數要求】所指定的範圍內，不可低於下限也不可超過上限。
9. 禁止寫出**過去的**具體日期或時間段（如「4 月 25 日」「學期初」「上週」「最近」「本週」），但可以使用「下學期」「未來」「接下來」等指向未來的詞彙以配合 Feed Forward。
10. 禁止使用問候語開頭（如「親愛的家長您好」「Dear Parents」「您好」），請直接從學生的特質或表現切入。
11. 禁止提及家庭狀況、宗教、政治、健康疾病、輔導內容等隱私敏感話題。
12. 評語中至少出現學生姓名 1 次（避免空泛、像通用範本）。

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
    const positiveCount = new Map<string, number>();
    const negativeCount = new Map<string, number>();
    const sanitizedNotes: string[] = [];

    sortedDates.forEach(date => {
      const record = student.dailyRecords[date];
      record.points.forEach(p => {
        if (p.value > 0) {
          positiveCount.set(p.label, (positiveCount.get(p.label) || 0) + 1);
        } else if (p.value < 0 && !p.label.startsWith('🎁')) {
          negativeCount.set(p.label, (negativeCount.get(p.label) || 0) + 1);
        }
      });
      const sanitized = sanitizeNoteForRag(record.note);
      if (sanitized) sanitizedNotes.push(sanitized);
    });

    const topPositives = [...positiveCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => `- ${label} (${count} 次)`);

    const topNegatives = [...negativeCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => `- ${label} (${count} 次)`);

    const sections: string[] = [];
    if (topPositives.length > 0) {
      sections.push(`【高頻優良表現】\n${topPositives.join('\n')}`);
    }
    if (topNegatives.length > 0) {
      sections.push(`【需要改進處】\n${topNegatives.join('\n')}`);
    }
    if (sanitizedNotes.length > 0) {
      sections.push(`【整學期累計教師行為觀察】\n${sanitizedNotes.join('；')}`);
    }
    historyText = sections.length > 0
      ? sections.join('\n\n')
      : "該生本學期尚無具體加減分紀錄。";
  }

  const tagsText = student.tags.length > 0 ? student.tags.join(", ") : "無特定標籤";
  const lengthDesc = `${Math.max(wordCount - 10, 100)}-${wordCount + 10} 字之間（含標點符號）`;
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
    const result = await callGenerateText({
      prompt,
      studentId: student.id,
      lengthSetting: wordCount,
      hasCustomPrompt: !!customInstruction.trim(),
    });
    return result.data.text || "無法生成評語，請稍後再試。";
  } catch (error: unknown) {
    console.error("[AI] generateText 失敗:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes("resource-exhausted") || errMsg.includes("配額")) {
      return "今日 AI 使用配額已達上限，請明日再試。";
    }
    if (errMsg.includes("unauthenticated") || errMsg.includes("登入")) {
      return "請先登入後再使用 AI 功能。";
    }
    return "AI 服務暫時無法使用，請稍後再試。";
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

  try {
    const result = await callParseSchedule({ prompt, base64Data, mimeType });
    return extractAndParseJson(result.data.text);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[課表辨識] 失敗:", errMsg);
    if (errMsg.includes("resource-exhausted") || errMsg.includes("配額")) {
      throw new Error("今日 AI 使用配額已達上限，請明日再試。");
    }
    throw new Error(`課表辨識失敗：${errMsg}`);
  }
};
