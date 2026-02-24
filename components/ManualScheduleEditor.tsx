import { useState, useEffect, useRef } from 'react';
import { Save, Camera, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { DaySchedule, Period } from '../types';
import { parseScheduleFromImage } from '../services/geminiService';
import { useAiRateLimit } from '../hooks/useAiRateLimit';
import { logScheduleRecognition } from '../services/firebaseService';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface EditorRow {
  id: string;
  periodName: string;
  label: string;
  subjects: string[];
  isLunch: boolean;
}

const ROW_CONFIG = [
  { label: '第一節', defaultTime: '08:40-09:20', isLunch: false },
  { label: '第二節', defaultTime: '09:30-10:10', isLunch: false },
  { label: '第三節', defaultTime: '10:30-11:10', isLunch: false },
  { label: '第四節', defaultTime: '11:20-12:00', isLunch: false },
  { label: '午休', defaultTime: '12:00-13:20', isLunch: true },
  { label: '第五節', defaultTime: '13:30-14:10', isLunch: false },
  { label: '第六節', defaultTime: '14:20-15:00', isLunch: false },
  { label: '第七節', defaultTime: '15:20-16:00', isLunch: false },
];

export const ManualScheduleEditor = ({
  initialSchedule,
  onSave,
  userUid,
}: {
  initialSchedule?: DaySchedule[];
  onSave: (schedule: DaySchedule[]) => void;
  userUid: string;
}) => {
  const theme = useTheme();
  const { canGenerate, cooldownRemaining, isLimitReached, dailyUsageCount, dailyLimit, recordGeneration } = useAiRateLimit({ userUid });
  const [rows, setRows] = useState<EditorRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const newRows: EditorRow[] = ROW_CONFIG.map((cfg, idx) => ({
      id: `row-${idx}`,
      label: cfg.label,
      periodName: cfg.defaultTime,
      subjects: ['', '', '', '', ''],
      isLunch: cfg.isLunch
    }));

    if (initialSchedule && initialSchedule.length > 0) {
      const wedAfternoonLabels = ['第五節', '第六節', '第七節'];
      newRows.forEach((row) => {
        let foundTime = "";

        for (let day = 1; day <= 5; day++) {
          // 週三下午不載入
          if (day === 3 && wedAfternoonLabels.includes(row.label)) continue;
          const dayData = initialSchedule.find(d => d.dayOfWeek === day);
          if (dayData) {
            const period = dayData.periods.find(p => p.periodName.includes(row.label));
            if (period) {
              row.subjects[day - 1] = period.subject;
              const cleanPeriodName = period.periodName.replace(row.label, '').trim();
              if (cleanPeriodName) {
                foundTime = cleanPeriodName;
              }
            }
          }
        }

        if (foundTime) {
          row.periodName = foundTime;
        }
      });
    }

    setRows(newRows);
  }, [initialSchedule]);

  const handleSubjectChange = (rowIdx: number, dayIdx: number, val: string) => {
    const newRows = [...rows];
    newRows[rowIdx].subjects[dayIdx] = val;
    setRows(newRows);
  };

  const handleTimeChange = (rowIdx: number, val: string) => {
    const newRows = [...rows];
    newRows[rowIdx].periodName = val;
    setRows(newRows);
  };

  const normalizePeriodName = (name: string): string => {
    const map: Record<string, string> = {
      '1': '第一節', '2': '第二節', '3': '第三節', '4': '第四節',
      '5': '第五節', '6': '第六節', '7': '第七節',
    };
    const digit = name.match(/第(\d)節/)?.[1];
    if (digit) return `第${'一二三四五六七'[+digit - 1]}節`;
    return map[name.trim()] ?? name;
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsImporting(true);
    setImportError('');

    try {
      let base64: string;
      let mimeType: string;

      if (file.type === 'application/pdf') {
        // PDF → Canvas → PNG（Groq/OpenRouter 不支援 PDF）
        console.log('[課表辨識] 偵測到 PDF，轉換為 PNG...');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        base64 = dataUrl.split(',')[1];
        mimeType = 'image/png';
        console.log('[課表辨識] PDF 轉 PNG 完成');
      } else {
        // 圖片：直接讀 base64
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        mimeType = file.type;
      }

      const parsed = await parseScheduleFromImage(base64, mimeType);

      setRows(prev => {
        const next = prev.map(row => ({ ...row, subjects: [...row.subjects] }));
        const nonLunchRows = next.filter(r => !r.isLunch);

        for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
          const dayOfWeek = dayIdx + 1;
          const dayData = parsed.find(d => d.dayOfWeek === dayOfWeek);
          if (!dayData) continue;

          dayData.periods.forEach((period, pIdx) => {
            const normalizedPeriodName = normalizePeriodName(period.periodName);
            const byLabel = next.find(r => !r.isLunch && r.label === normalizedPeriodName);
            if (byLabel) {
              byLabel.subjects[dayIdx] = period.subject;
            } else if (pIdx < nonLunchRows.length) {
              // fallback: positional
              nonLunchRows[pIdx].subjects[dayIdx] = period.subject;
            }
          });
        }
        return next;
      });
      await logScheduleRecognition(userUid);
      recordGeneration();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : '辨識失敗，請重試。');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSave = () => {
    const schedule: DaySchedule[] = [];
    const wedAfternoonLabels = ['第五節', '第六節', '第七節'];
    for (let day = 1; day <= 5; day++) {
      const periods: Period[] = [];
      rows.forEach(row => {
        const isWedAfternoon = day === 3 && wedAfternoonLabels.includes(row.label);
        if (isWedAfternoon) return; // 週三下午不排課，跳過
        const subject = row.isLunch ? "午休" : row.subjects[day - 1];
        const userTime = row.periodName.replace(row.label, '').trim();
        const finalName = userTime
          ? `${row.label} ${userTime}`
          : row.label;

        periods.push({
          periodName: finalName,
          subject: subject || ""
        });
      });
      schedule.push({ dayOfWeek: day, periods });
    }
    onSave(schedule);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className={`flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer font-semibold text-sm border ${theme.border} ${theme.surfaceAlt} ${theme.text} hover:opacity-80 transition ${isImporting || !canGenerate ? 'opacity-50 pointer-events-none' : ''}`}>
          {isImporting
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Camera className="w-4 h-4" />}
          {isImporting ? '辨識中...'
            : isLimitReached ? `今日已達上限 (${dailyUsageCount}/${dailyLimit})`
            : cooldownRemaining > 0 ? `冷卻中 (${cooldownRemaining}s)`
            : '📷 拍照 / 上傳 PDF 自動辨識'}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileImport}
            disabled={isImporting || !canGenerate}
          />
        </label>
        {importError && (
          <span className="text-red-500 text-sm">{importError}</span>
        )}
      </div>

      <div className={`overflow-x-auto border ${theme.border} rounded-xl`}>
        <table className="w-full text-sm min-w-[600px]">
          <thead className={`${theme.surfaceAccent} font-bold ${theme.text}`}>
            <tr>
              <th className="p-3 text-left w-24">節次</th>
              <th className="p-3 text-left w-32">時間</th>
              <th className="p-3 w-20">週一</th>
              <th className="p-3 w-20">週二</th>
              <th className="p-3 w-20">週三</th>
              <th className="p-3 w-20">週四</th>
              <th className="p-3 w-20">週五</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                className={`
                  ${row.isLunch ? `bg-amber-50 dark:bg-amber-900/20 border-y-2 border-amber-200 dark:border-amber-800` : `border-t ${theme.border} hover:${theme.surfaceAlt}`}
                `}
              >
                <td className="p-2">
                  <span className={`font-bold ${row.isLunch ? 'text-amber-700 dark:text-amber-400' : theme.text} block pl-2`}>
                    {row.label}
                  </span>
                </td>
                <td className="p-2">
                  <input
                    value={row.periodName}
                    onChange={(e) => handleTimeChange(idx, e.target.value)}
                    className={`w-full bg-transparent outline-none text-xs font-mono
                        ${row.isLunch ? 'text-amber-700 dark:text-amber-400 font-bold' : theme.textLight}
                    `}
                    placeholder="00:00"
                  />
                </td>
                {row.isLunch ? (
                  <td colSpan={5} className="p-2 text-center font-bold text-amber-600 dark:text-amber-500 tracking-widest opacity-80">
                    — 午 休 時 間 —
                  </td>
                ) : (
                  [0, 1, 2, 3, 4].map(day => {
                    const isWedAfternoon = day === 2 && ['第五節', '第六節', '第七節'].includes(row.label);
                    return (
                      <td key={day} className={`p-2 border-l ${theme.border} ${isWedAfternoon ? 'bg-gray-100 dark:bg-gray-800/50' : ''}`}>
                        {isWedAfternoon ? (
                          <span className={`block w-full text-center text-xs ${theme.textLight} select-none`}>—</span>
                        ) : (
                          <input
                            value={row.subjects[day]}
                            onChange={(e) => handleSubjectChange(idx, day, e.target.value)}
                            className={`w-full text-center bg-transparent outline-none focus:font-bold ${theme.text}`}
                          />
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={handleSave} className={`px-6 py-3 ${theme.primary} text-white rounded-xl font-bold shadow-lg hover:opacity-90 hover:shadow-xl transition transform active:scale-95`}>
          <Save className="w-5 h-5 inline-block mr-2" />
          儲存並更新課表
        </button>
      </div>
    </div>
  );
};
