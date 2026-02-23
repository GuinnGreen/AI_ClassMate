import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Modal } from './ui/Modal';
import { Student, ABSENCE_TYPES, AbsenceType } from '../types';

export const AbsenceStatsModal = ({
  isOpen,
  onClose,
  students,
}: {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
}) => {
  const theme = useTheme();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  type AbsenceCount = Record<AbsenceType, number>;

  const rows = [...students]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(student => {
      const counts: AbsenceCount = { '事假': 0, '病假': 0, '公假': 0, '喪假': 0, '不可抗力假': 0 };
      Object.entries(student.dailyRecords)
        .filter(([date]) => date.startsWith(monthPrefix))
        .forEach(([, record]) => {
          if (record.absence != null) {
            counts[record.absence] = (counts[record.absence] ?? 0) + 1;
          }
        });
      const total = Object.values(counts).reduce((s, v) => s + v, 0);
      return { student, counts, total };
    });

  const hasAnyAbsence = rows.some(r => r.total > 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="月請假統計" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Month Selector */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={prevMonth} className={`p-1.5 rounded-lg hover:${theme.surfaceAlt} ${theme.textLight} transition`}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className={`font-bold text-base ${theme.text} min-w-[120px] text-center`}>
            {year}年{String(month).padStart(2, '0')}月
          </span>
          <button onClick={nextMonth} className={`p-1.5 rounded-lg hover:${theme.surfaceAlt} ${theme.textLight} transition`}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {!hasAnyAbsence ? (
          <div className={`text-center py-8 text-sm ${theme.textLight}`}>當月無請假紀錄</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className={`${theme.surfaceAlt} ${theme.textLight}`}>
                  <th className="px-3 py-2 text-left font-bold rounded-tl-xl">座號</th>
                  <th className="px-3 py-2 text-left font-bold">姓名</th>
                  {ABSENCE_TYPES.map(t => (
                    <th key={t} className="px-3 py-2 text-center font-bold">{t}</th>
                  ))}
                  <th className="px-3 py-2 text-center font-bold rounded-tr-xl">合計</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ student, counts, total }) => (
                  <tr
                    key={student.id}
                    className={`border-t ${theme.border} ${total > 0 ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}
                  >
                    <td className={`px-3 py-2 ${theme.textLight}`}>{student.seatNumber ?? student.order ?? '?'}</td>
                    <td className={`px-3 py-2 font-bold ${total > 0 ? 'text-orange-600' : theme.text}`}>
                      {student.name}
                    </td>
                    {ABSENCE_TYPES.map(t => (
                      <td key={t} className={`px-3 py-2 text-center ${counts[t] > 0 ? theme.text : theme.textLight}`}>
                        {counts[t] > 0 ? counts[t] : '—'}
                      </td>
                    ))}
                    <td className={`px-3 py-2 text-center font-bold ${total > 0 ? 'text-orange-600' : theme.textLight}`}>
                      {total > 0 ? total : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};
