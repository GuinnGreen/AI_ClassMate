import { useState } from 'react';
import { Dices, Timer } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useCountdownTimer } from '../hooks/useCountdownTimer';
import { RandomStudentPicker } from './RandomStudentPicker';
import { CountdownTimer } from './CountdownTimer';
import { Student } from '../types';

type ActivePanel = 'picker' | 'timer' | null;

export function TeacherToolbar({ students }: { students: Student[] }) {
  const theme = useTheme();
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const timer = useCountdownTimer();

  const togglePanel = (panel: 'picker' | 'timer') => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  const formatBadge = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`;
  };

  const showTimerBadge = (timer.isRunning || timer.isPaused) && activePanel !== 'timer';

  return (
    <>
      {/* Floating toolbar */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 items-center">
        {/* Timer badge */}
        {showTimerBadge && (
          <div
            className={`px-2 py-1 rounded-lg text-xs font-bold ${theme.surface} ${theme.text} shadow-lg border ${theme.border} cursor-pointer`}
            onClick={() => togglePanel('timer')}
          >
            {timer.isPaused ? '⏸ ' : ''}{formatBadge(timer.remainingSeconds)}
          </div>
        )}

        {/* Timer button */}
        <button
          onClick={() => togglePanel('timer')}
          className={`w-12 h-12 rounded-full ${theme.surface} shadow-lg border ${theme.border} flex items-center justify-center hover:scale-110 transition-transform ${timer.isFinished ? 'animate-pulse' : ''}`}
          title="倒數計時器"
        >
          <Timer className={`w-5 h-5 ${timer.isRunning || timer.isPaused ? 'text-orange-500' : theme.textLight}`} />
        </button>

        {/* Picker button */}
        <button
          onClick={() => togglePanel('picker')}
          className={`w-12 h-12 rounded-full ${theme.surface} shadow-lg border ${theme.border} flex items-center justify-center hover:scale-110 transition-transform`}
          title="抽籤筒"
        >
          <Dices className={`w-5 h-5 ${theme.textLight}`} />
        </button>
      </div>

      {/* Panels */}
      {activePanel === 'picker' && (
        <RandomStudentPicker
          students={students}
          onClose={() => setActivePanel(null)}
        />
      )}
      {activePanel === 'timer' && (
        <CountdownTimer
          timer={timer}
          onClose={() => setActivePanel(null)}
        />
      )}
    </>
  );
}
