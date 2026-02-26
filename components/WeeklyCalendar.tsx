import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { formatDate } from '../utils/date';
import { Student } from '../types';

export const WeeklyCalendar = ({
  currentDate,
  onDateSelect,
  student,
  onViewModeChange,
}: {
  currentDate: string;
  onDateSelect: (date: string) => void;
  student: Student;
  onViewModeChange?: (mode: 'week' | 'month') => void;
}) => {
  const theme = useTheme();
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

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

  const monthGrid = useMemo(() => {
    const curr = new Date(currentDate);
    const year = curr.getFullYear();
    const month = curr.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0=Sun
    const startDate = new Date(firstDay);
    startDate.setDate(1 - startOffset);

    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      cells.push(d);
    }
    return { cells, year, month };
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
  const handlePrevMonth = () => {
    setSlideDirection('left');
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    onDateSelect(formatDate(d));
  };
  const handleNextMonth = () => {
    setSlideDirection('right');
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    onDateSelect(formatDate(d));
  };

  const handleDateClick = (d: Date) => {
    const dStr = formatDate(d);
    // In month view, if clicking a date outside current month, stay in month view
    // The onDateSelect will change currentDate which recalculates monthGrid
    onDateSelect(dStr);
  };

  const renderDayCell = (d: Date, opts: { isMonthView: boolean; isCurrentMonth?: boolean; dayIndex: number }) => {
    const dStr = formatDate(d);
    const isSelected = dStr === currentDate;
    const isToday = dStr === formatDate(new Date());
    const record = student.dailyRecords[dStr];
    const hasPositive = record?.points.some(p => p.value > 0);
    const hasNegative = record?.points.some(p => p.value < 0);
    const hasNote = record?.note && record.note.trim().length > 0;

    if (opts.isMonthView) {
      const outsideMonth = opts.isCurrentMonth === false;
      return (
        <button
          key={dStr}
          onClick={() => handleDateClick(d)}
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition-all relative
            ${outsideMonth ? 'opacity-30' : ''}
            ${isSelected
              ? `${theme.primary} text-white shadow-md`
              : `hover:${theme.surfaceAlt} ${theme.text}`
            }
            ${isToday && !isSelected ? `ring-2 ring-inset ${theme.focusRing}` : ''}`}
        >
          <span className="text-sm font-bold leading-none">{d.getDate()}</span>
          <div className="flex gap-0.5 mt-1 h-1">
            {hasPositive && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : theme.accentPositive}`}></div>}
            {hasNegative && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-[#e6bwbw]' : theme.accentNegative}`}></div>}
          </div>
          {hasNote && (
            <div className="absolute top-0 right-0">
              <div className={`w-2 h-2 rounded-full ring-1 ring-white ${isSelected ? 'bg-white/80' : 'bg-amber-400'}`}></div>
            </div>
          )}
        </button>
      );
    }

    // Week view (original)
    return (
      <button
        key={dStr}
        onClick={() => onDateSelect(dStr)}
        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all relative ${isSelected
          ? `${theme.primary} text-white shadow-md transform scale-105`
          : `hover:${theme.surfaceAlt} ${theme.text}`
          } ${isToday && !isSelected ? `ring-2 ring-inset ${theme.focusRing}` : ''}`}
      >
        <span className={`text-[10px] font-bold mb-1 opacity-70`}>{weekDays[opts.dayIndex]}</span>
        <span className={`text-lg font-bold leading-none`}>{d.getDate()}</span>
        <div className="flex gap-1 mt-1.5 h-1.5">
          {hasPositive && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : theme.accentPositive}`}></div>}
          {hasNegative && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#e6bwbw]' : theme.accentNegative}`}></div>}
        </div>
        {hasNote && (
          <div className="absolute top-0.5 right-0.5">
            <div className={`w-3 h-3 rounded-full ring-2 ring-white ${isSelected ? 'bg-white/80' : 'bg-amber-400'}`}></div>
          </div>
        )}
      </button>
    );
  };

  const headerTitle = viewMode === 'month'
    ? `${monthGrid.year}年 ${monthGrid.month + 1}月`
    : `${days[0].getFullYear()}年 ${days[0].getMonth() + 1}月`;

  return (
    <div className={`${theme.surface} rounded-2xl p-4 shadow-sm border ${theme.border} ${viewMode === 'month' ? 'lg:flex-1 lg:flex lg:flex-col' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={viewMode === 'month' ? handlePrevMonth : handlePrevWeek}
          className={`p-1 hover:${theme.surfaceAlt} rounded-lg ${theme.textLight}`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setViewMode(v => {
            const next = v === 'week' ? 'month' : 'week';
            onViewModeChange?.(next);
            return next;
          })}
          className={`flex items-center gap-1 text-base font-bold ${theme.text} hover:opacity-70 transition-opacity`}
        >
          {headerTitle}
          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${viewMode === 'month' ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={viewMode === 'month' ? handleNextMonth : handleNextWeek}
          className={`p-1 hover:${theme.surfaceAlt} rounded-lg ${theme.textLight}`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className={`calendar-view-transition ${viewMode === 'month' ? 'calendar-view-month lg:!max-h-none lg:flex-1 lg:flex lg:flex-col' : 'calendar-view-week'}`}>
        {viewMode === 'week' ? (
          <div className="overflow-x-hidden py-1">
            <div
              key={days[0].toISOString()}
              className={`grid grid-cols-7 gap-2 ${slideDirection === 'left' ? 'animate-slide-in-left' : slideDirection === 'right' ? 'animate-slide-in-right' : ''}`}
              onAnimationEnd={() => setSlideDirection('')}
            >
              {days.map((d, i) => renderDayCell(d, { isMonthView: false, dayIndex: i }))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-hidden lg:flex-1 lg:flex lg:flex-col">
            <div className="grid grid-cols-7 gap-1 mb-1 shrink-0">
              {weekDays.map(wd => (
                <div key={wd} className={`text-center text-[10px] font-bold opacity-50 ${theme.text}`}>{wd}</div>
              ))}
            </div>
            <div
              key={`${monthGrid.year}-${monthGrid.month}`}
              className={`grid grid-cols-7 gap-1 lg:flex-1 ${slideDirection === 'left' ? 'animate-slide-in-left' : slideDirection === 'right' ? 'animate-slide-in-right' : ''}`}
              style={{ gridTemplateRows: 'repeat(6, 1fr)' }}
              onAnimationEnd={() => setSlideDirection('')}
            >
              {monthGrid.cells.map((d, i) => renderDayCell(d, {
                isMonthView: true,
                isCurrentMonth: d.getMonth() === monthGrid.month,
                dayIndex: i % 7,
              }))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
