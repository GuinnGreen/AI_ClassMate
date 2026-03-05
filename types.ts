// 定義單筆加減分紀錄
export interface PointLog {
  id: string;
  label: string; // 例如: "+1 表現優良"
  value: number; // 例如: 1 或 -1
  timestamp: number;
}

// 假別型別
export type AbsenceType = '事假' | '病假' | '公假' | '喪假';
export const ABSENCE_TYPES: AbsenceType[] = ['事假', '病假', '公假', '喪假'];

// 定義每日紀錄結構
export interface DailyRecord {
  points: PointLog[];
  note: string; // 當日手寫筆記
  absence?: AbsenceType | null; // 當日請假
}

// 定義學生資料結構
export interface Student {
  id: string; // Firestore Document ID
  name: string;
  seatNumber?: number; // 座號
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

// 定義獎品配置
export interface PrizeItem {
  id: string;
  label: string;  // 例如: "小貼紙"
  cost: number;   // 兌換所需積分（正數，記帳時自動取負）
}

// --- 書寫方向 ---
export type BoardWritingMode = 'horizontal-tb' | 'vertical-lr' | 'vertical-rl';

// --- 課表相關 ---
export interface Period {
  periodName: string; // e.g. "第一節", "08:00-08:40"
  subject: string;    // e.g. "國語"
}

export interface DaySchedule {
  dayOfWeek: number; // 1=Mon, 2=Tue... 5=Fri
  periods: Period[];
}

// --- 公告欄情境模板 ---
export interface BoardSituationTemplate {
  id: string;
  name: string;    // e.g. "老師請假"
  content: string;
}

// 定義全班設定 (電子白板 + 自訂行為 + 課表)
export interface ClassConfig {
  class_board: string;
  customBehaviors?: {
    positive: BehaviorButton[];
    negative: BehaviorButton[];
  };
  weeklySchedule?: DaySchedule[]; // 儲存週一到週五的課表
  boardWritingMode?: BoardWritingMode; // 公告欄書寫方向
  napTimeStart?: string; // 午休開始時間 (HH:MM)
  napTimeEnd?: string;   // 午休結束時間 (HH:MM)
  showBoardLines?: boolean; // 公告欄是否顯示底線（預設 true）
  boardFontSizeLevel?: number; // 0-3, 預設 1
  scheduleFontSizeLevel?: number; // 0-3, 預設 1
  boardDailyTemplates?: Partial<Record<number, string>>; // key=dayOfWeek(1=Mon…5=Fri)
  boardSituationTemplates?: BoardSituationTemplate[];    // 教師自訂情境模板
  activeBoardSituation?: string | null;                 // null=今日 day template；非空=情境id
  showClock?: boolean;   // 時鐘顯示開關（預設 true）
  zhuyinMode?: boolean;  // 注音字型開關（預設 false）
  semesterStart?: string; // "YYYY-MM-DD"
  semesterEnd?: string;   // "YYYY-MM-DD"
  prizes?: PrizeItem[];   // 獎品兌換清單
  prizeShopEnabled?: boolean; // 積分商店開關（預設 false）
}

export const DEFAULT_POSITIVE_BEHAVIORS: BehaviorButton[] = [
  { id: 'p1', label: '回答正確', value: 1 },
  { id: 'p2', label: '熱心服務', value: 1 },
  { id: 'p3', label: '作業優良', value: 1 },
  { id: 'p4', label: '小組合作', value: 1 },
];

export const DEFAULT_PRIZES: PrizeItem[] = [
  { id: 'pr1', label: '小貼紙', cost: 5 },
  { id: 'pr2', label: '書籤', cost: 10 },
  { id: 'pr3', label: '鉛筆', cost: 15 },
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

// --- 公告系統 ---
export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'update' | 'survey';
  surveyUrl?: string;
  showPairingCode?: boolean;
  pairingCodeParam?: string;  // Google Form 欄位 ID，例如 "entry.123456789"
  createdAt: number;
  active: boolean;
}

export const EVALUATION_CATEGORIES: EvaluationCategory[] = [
  {
    title: '學習態度與責任',
    positive: ['勤奮好學', '自動自發', '作業工整', '舉一反三', '專心聽講', '負責盡職'],
    negative: ['學習被動', '容易分心', '課堂多語', '粗心大意', '作業遲交', '忘帶書籍']
  },
  {
    title: '同儕互動與關懷',
    positive: ['脾氣溫和', '熱心助人', '人緣極佳', '謙虛有禮', '富正義感', '樂於分享'],
    negative: ['難以合群', '易生衝突', '內向寡言', '較易衝動', '固執己見', '缺乏同理']
  },
  {
    title: '常規紀律與自省',
    positive: ['循規蹈矩', '情緒穩定', '獨立自主', '直率坦白', '勇於認錯', '服從指導'],
    negative: ['常規散漫', '遲到早退', '輕忽公物', '情緒多變', '抗壓較弱', '推卸責任']
  }
];