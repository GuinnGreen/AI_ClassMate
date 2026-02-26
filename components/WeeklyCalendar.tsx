import { useMemo, useState, useRef, useEffect } from 'react';
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
  const hasInitialized = useRef(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      hasInitialized.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, []);

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

  const currentWeekRow = useMemo(() => {
    const idx = monthGrid.cells.findIndex(d => formatDate(d) === currentDate);
    return idx >= 0 ? Math.floor(idx / 7) : 0;
  }, [currentDate, monthGrid]);

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
    onDateSelect(formatDate(d));
  };

  const renderDayCell = (d: Date, opts: { isCurrentMonth?: boolean; dayIndex: number }) => {
    const dStr = formatDate(d);
    const isSelected = dStr === currentDate;
    const isToday = dStr === formatDate(new Date());
    const record = student.dailyRecords[dStr];
    const hasPositive = record?.points.some(p => p.value > 0);
    const hasNegative = record?.points.some(p => p.value < 0);
    const hasNote = record?.note && record.note.trim().length > 0;
    const absence = record?.absence;
    const outsideMonth = opts.isCurrentMonth === false;
    const isWeek = viewMode === 'week';

    return (
      <button
        key={dStr}
        onClick={() => handleDateClick(d)}
        className={`flex flex-col items-center justify-center transition-all relative
          ${outsideMonth ? 'opacity-30' : ''}
          ${isSelected
            ? `${theme.primary} text-white shadow-md${isWeek ? ' transform scale-105' : ''}`
            : `hover:${theme.surfaceAlt} ${theme.text}`
          }
          ${isToday && !isSelected ? `ring-2 ring-inset ${theme.focusRing}` : ''}
          ${isWeek ? 'p-2 rounded-xl' : 'p-1.5 rounded-lg'}`}
      >
        <span className={`font-bold leading-none ${isWeek ? 'text-base' : 'text-sm'}`}>{d.getDate()}</span>
        <div className={`flex items-center ${isWeek ? 'gap-1 mt-1.5 h-1.5' : 'gap-0.5 mt-1 h-1'}`}>
          {hasPositive && <div className={`rounded-full ${isSelected ? 'bg-white' : theme.accentPositive} ${isWeek ? 'w-1.5 h-1.5' : 'w-1 h-1'}`}></div>}
          {hasNegative && <div className={`rounded-full ${isSelected ? 'bg-[#e6bwbw]' : theme.accentNegative} ${isWeek ? 'w-1.5 h-1.5' : 'w-1 h-1'}`}></div>}
          {absence && <span className={`font-bold leading-none ${isSelected ? 'text-white/90' : 'text-orange-500'} ${isWeek ? 'text-[9px]' : 'text-[8px]'}`}>{absence[0]}</span>}
        </div>
        {hasNote && (
          <div className={`absolute ${isWeek ? 'top-0.5 right-0.5' : 'top-0 right-0'}`}>
            <div className={`rounded-full ${isSelected ? 'bg-white/80' : 'bg-amber-400'} ${isWeek ? 'w-3 h-3 ring-2 ring-white' : 'w-2 h-2 ring-1 ring-white'}`}></div>
          </div>
        )}
      </button>
    );
  };

  const headerTitle = `${monthGrid.year}年 ${monthGrid.month + 1}月`;

  return (
    <div className={`${theme.surface} rounded-2xl p-4 shadow-sm border ${theme.border} flex flex-col h-full`}>
      <div className="flex items-center justify-between mb-3 shrink-0">
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

      {/* Weekday header — always visible */}
      <div className="grid grid-cols-7 gap-1 mb-1 shrink-0">
        {weekDays.map(wd => (
          <div key={wd} className={`text-center text-[10px] font-bold opacity-50 ${theme.text}`}>{wd}</div>
        ))}
      </div>

      {/* Month grid — single 6-row grid with expand/collapse animation */}
      <div
        key={`${monthGrid.year}-${monthGrid.month}`}
        className={`flex-1 overflow-hidden ${slideDirection === 'left' ? 'animate-slide-in-left' : slideDirection === 'right' ? 'animate-slide-in-right' : ''}`}
        style={{
          display: 'grid',
          gridTemplateRows: [0, 1, 2, 3, 4, 5]
            .map(i => (viewMode === 'week' && i !== currentWeekRow) ? '0fr' : '1fr')
            .join(' '),
          transition: hasInitialized.current ? 'grid-template-rows 400ms ease-in-out' : 'none',
        }}
        onAnimationEnd={() => setSlideDirection('')}
      >
        {[0, 1, 2, 3, 4, 5].map(rowIdx => (
          <div key={rowIdx} style={{ overflow: 'hidden', minHeight: 0 }}>
            <div className="grid grid-cols-7 gap-1 h-full">
              {monthGrid.cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((d, i) =>
                renderDayCell(d, {
                  isCurrentMonth: d.getMonth() === monthGrid.month,
                  dayIndex: i,
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
