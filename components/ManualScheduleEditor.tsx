import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { DaySchedule, Period } from '../types';

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
}: {
  initialSchedule?: DaySchedule[];
  onSave: (schedule: DaySchedule[]) => void;
}) => {
  const theme = useTheme();
  const [rows, setRows] = useState<EditorRow[]>([]);

  useEffect(() => {
    const newRows: EditorRow[] = ROW_CONFIG.map((cfg, idx) => ({
      id: `row-${idx}`,
      label: cfg.label,
      periodName: cfg.defaultTime,
      subjects: ['', '', '', '', ''],
      isLunch: cfg.isLunch
    }));

    if (initialSchedule && initialSchedule.length > 0) {
      newRows.forEach((row) => {
        let foundTime = "";

        for (let day = 1; day <= 5; day++) {
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

  const handleSave = () => {
    const schedule: DaySchedule[] = [];
    for (let day = 1; day <= 5; day++) {
      const periods: Period[] = [];
      rows.forEach(row => {
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
                  [0, 1, 2, 3, 4].map(day => (
                    <td key={day} className={`p-2 border-l ${theme.border}`}>
                      <input
                        value={row.subjects[day]}
                        onChange={(e) => handleSubjectChange(idx, day, e.target.value)}
                        className={`w-full text-center bg-transparent outline-none focus:font-bold ${theme.text}`}
                      />
                    </td>
                  ))
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
