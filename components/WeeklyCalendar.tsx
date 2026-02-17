import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { formatDate } from '../utils/date';
import { Student } from '../types';

export const WeeklyCalendar = ({
  currentDate,
  onDateSelect,
  student,
}: {
  currentDate: string;
  onDateSelect: (date: string) => void;
  student: Student;
}) => {
  const theme = useTheme();
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
  const days = useMemo(() => {
    const curr = new Date(currentDate);
    const d = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate());
    const day = d.getDay();
    const diff = d.getDate() - day;
    const startOfWeek = new Date(d);
    startOfWeek.setDate(diff);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(startOfWeek);
      nextDay.setDate(startOfWeek.getDate() + i);
      week.push(nextDay);
    }
    return week;
  }, [currentDate]);

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const handlePrevWeek = () => {
    setSlideDirection('left');
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    onDateSelect(formatDate(d));
  };
  const handleNextWeek = () => {
    setSlideDirection('right');
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    onDateSelect(formatDate(d));
  };

  return (
    <div className={`${theme.surface} rounded-2xl p-4 shadow-sm border ${theme.border}`}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={handlePrevWeek} className={`p-1 hover:${theme.surfaceAlt} rounded-lg ${theme.textLight}`}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className={`text-base font-bold ${theme.text}`}>
          {days[0].getFullYear()}年 {days[0].getMonth() + 1}月
        </h3>
        <button onClick={handleNextWeek} className={`p-1 hover:${theme.surfaceAlt} rounded-lg ${theme.textLight}`}>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="overflow-x-hidden py-1">
        <div
          key={days[0].toISOString()}
          className={`grid grid-cols-7 gap-2 ${slideDirection === 'left' ? 'animate-slide-in-left' : slideDirection === 'right' ? 'animate-slide-in-right' : ''}`}
          onAnimationEnd={() => setSlideDirection('')}
        >
          {days.map((d, i) => {
            const dStr = formatDate(d);
            const isSelected = dStr === currentDate;
            const isToday = dStr === formatDate(new Date());
            const record = student.dailyRecords[dStr];
            const hasPositive = record?.points.some(p => p.value > 0);
            const hasNegative = record?.points.some(p => p.value < 0);
            const hasNote = record?.note && record.note.trim().length > 0;

            return (
              <button
                key={dStr}
                onClick={() => onDateSelect(dStr)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all relative ${isSelected
                  ? `${theme.primary} text-white shadow-md transform scale-105`
                  : `hover:${theme.surfaceAlt} ${theme.text}`
                  } ${isToday && !isSelected ? `ring-2 ring-inset ${theme.focusRing}` : ''}`}
              >
                <span className={`text-[10px] font-bold mb-1 opacity-70`}>{weekDays[i]}</span>
                <span className={`text-lg font-bold leading-none`}>{d.getDate()}</span>
                <div className="flex gap-1 mt-1.5 h-1.5">
                  {hasPositive && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : theme.accentPositive}`}></div>}
                  {hasNegative && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#e6bwbw]' : theme.accentNegative}`}></div>}
                </div>
                {hasNote && (
                  <div className="absolute top-1 right-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : theme.textLight}`}></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
