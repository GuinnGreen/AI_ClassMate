// 定義單筆加減分紀錄
export interface PointLog {
  id: string;
  label: string; // 例如: "+1 表現優良"
  value: number; // 例如: 1 或 -1
  timestamp: number;
}

// 定義每日紀錄結構
export interface DailyRecord {
  points: PointLog[];
  note: string; // 當日手寫筆記
}

// 定義學生資料結構
export interface Student {
  id: string; // Firestore Document ID
  name: string;
  totalScore: number;
  order?: number; // 排序欄位，用於維持匯入順序
  // Key 為日期字串 "YYYY-MM-DD"
  dailyRecords: Record<string, DailyRecord>;
  tags: string[]; // 評語標籤
  comment: string; // AI 生成的評語
  originalAiComment?: string; // 暫存欄位：紀錄最後一次 AI 生成的原始版本，用於計算編輯距離
}

// 定義行為按鈕配置
export interface BehaviorButton {
  id: string; // 新增 ID 以便管理
  label: string;
  value: number;
}

// --- 課表相關 ---
export interface Period {
  periodName: string; // e.g. "第一節", "08:00-08:40"
  subject: string;    // e.g. "國語"
}

export interface DaySchedule {
  dayOfWeek: number; // 1=Mon, 2=Tue... 5=Fri
  periods: Period[];
}

// 定義全班設定 (電子白板 + 自訂行為 + 課表)
export interface ClassConfig {
  class_board: string;
  customBehaviors?: {
    positive: BehaviorButton[];
    negative: BehaviorButton[];
  };
  weeklySchedule?: DaySchedule[]; // 儲存週一到週五的課表
}

export const DEFAULT_POSITIVE_BEHAVIORS: BehaviorButton[] = [
  { id: 'p1', label: '回答正確', value: 1 },
  { id: 'p2', label: '熱心服務', value: 1 },
  { id: 'p3', label: '作業優良', value: 1 },
  { id: 'p4', label: '小組合作', value: 1 },
];

export const DEFAULT_NEGATIVE_BEHAVIORS: BehaviorButton[] = [
  { id: 'n1', label: '上課講話', value: -1 },
  { id: 'n2', label: '遲到', value: -1 },
  { id: 'n3', label: '遲交作業', value: -1 },
  { id: 'n4', label: '未帶用品', value: -1 },
];

// --- 評語標籤系統 ---
export interface EvaluationCategory {
  title: string;
  positive: string[];
  negative: string[];
}

export const EVALUATION_CATEGORIES: EvaluationCategory[] = [
  {
    title: '一、性格特質',
    positive: ['性情溫和', '善解人意', '誠實可靠', '開朗樂觀', '獨立自主', '富正義感', '勇敢果決', '情緒穩定', '幽默風趣', '直率坦白'],
    negative: ['情緒多變', '抗壓較弱', '固執己見', '內向寡言', '易生爭執', '缺乏自信', '依賴心重', '較易衝動']
  },
  {
    title: '二、學習態度',
    positive: ['勤奮好學', '自動自發', '作業工整', '理解力強', '舉一反三', '專心聽講', '踴躍發言', '準時繳交', '富有創意'],
    negative: ['學習被動', '敷衍了事', '遇難退縮', '容易分心', '課堂多語', '粗心大意', '作業遲交', '忘帶書籍']
  },
  {
    title: '三、生活態度',
    positive: ['人緣極佳', '熱心助人', '謙虛有禮', '負責盡職', '循規蹈矩', '注重整潔', '愛護公物'],
    negative: ['難以合群', '易生衝突', '禮儀欠缺', '衛生欠佳', '常規散漫', '遲到早退', '輕忽公物']
  }
];