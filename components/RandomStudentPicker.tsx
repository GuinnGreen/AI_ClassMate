import { useState, useRef, useCallback } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Student } from '../types';
import { formatDate } from '../utils/date';

interface Props {
  students: Student[];
  onClose: () => void;
}

export function RandomStudentPicker({ students, onClose }: Props) {
  const theme = useTheme();
  const [excludeAbsent, setExcludeAbsent] = useState(true);
  const [avoidRepeat, setAvoidRepeat] = useState(true);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [resultStudent, setResultStudent] = useState<Student | null>(null);
  const animFrameRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = formatDate(new Date());

  const getAvailableStudents = useCallback(() => {
    let pool = students;
    if (excludeAbsent) {
      pool = pool.filter(s => !s.dailyRecords[today]?.absence);
    }
    if (avoidRepeat) {
      pool = pool.filter(s => !pickedIds.includes(s.id));
    }
    return pool;
  }, [students, excludeAbsent, avoidRepeat, pickedIds, today]);

  const formatStudentLabel = (s: Student) =>
    s.seatNumber ? `${s.seatNumber} 號 ${s.name}` : s.name;

  const pick = () => {
    const pool = getAvailableStudents();
    if (pool.length === 0) return;

    setIsSpinning(true);
    setResultStudent(null);

    const target = pool[Math.floor(Math.random() * pool.length)];
    const allLabels = students.map(formatStudentLabel);

    let step = 0;
    const totalSteps = 20;

    const animate = () => {
      if (step < totalSteps) {
        const delay = 50 + (step / totalSteps) * 350;
        setDisplayName(allLabels[Math.floor(Math.random() * allLabels.length)]);
        step++;
        animFrameRef.current = setTimeout(animate, delay);
      } else {
        setDisplayName(formatStudentLabel(target));
        setResultStudent(target);
        setIsSpinning(false);
        if (avoidRepeat) {
          setPickedIds(prev => [...prev, target.id]);
        }
      }
    };

    animate();
  };

  const resetPicked = () => {
    setPickedIds([]);
    setResultStudent(null);
    setDisplayName('');
  };

  const available = getAvailableStudents();
  const allPicked = available.length === 0 && pickedIds.length > 0;

  const pickedStudents = students.filter(s => pickedIds.includes(s.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full max-w-md ${theme.surface} rounded-3xl shadow-2xl overflow-hidden animate-pop-in border ${theme.border}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 border-b ${theme.border} flex justify-between items-center ${theme.surfaceAlt}`}>
          <h3 className={`font-bold text-lg ${theme.text}`}>抽籤筒</h3>
          <button onClick={onClose} className={`p-2 hover:bg-black/5 rounded-full transition ${theme.textLight}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Display area */}
          <div className={`h-28 flex items-center justify-center rounded-2xl ${theme.surfaceAccent} border ${theme.border}`}>
            {allPicked ? (
              <p className={`text-lg font-bold ${theme.primaryText}`}>全班都抽過了！</p>
            ) : displayName ? (
              <p className={`text-3xl font-bold ${theme.text} ${isSpinning ? 'picker-spin-text' : 'animate-pop-in'}`}>
                {displayName}
              </p>
            ) : (
              <p className={`text-lg ${theme.textLight}`}>按下「抽籤！」開始</p>
            )}
          </div>

          {/* Pick button */}
          <button
            onClick={pick}
            disabled={isSpinning || (allPicked && avoidRepeat)}
            className={`w-full py-4 rounded-2xl ${theme.primary} text-white font-bold text-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-40 disabled:hover:scale-100`}
          >
            {isSpinning ? '抽籤中...' : '抽籤！'}
          </button>

          {/* Options */}
          <div className="flex flex-col gap-3">
            <label className={`flex items-center gap-3 cursor-pointer ${theme.text}`}>
              <input
                type="checkbox"
                checked={excludeAbsent}
                onChange={() => setExcludeAbsent(!excludeAbsent)}
                className="w-5 h-5 rounded accent-current"
              />
              <span className="text-sm">排除請假學生</span>
            </label>
            <label className={`flex items-center gap-3 cursor-pointer ${theme.text}`}>
              <input
                type="checkbox"
                checked={avoidRepeat}
                onChange={() => setAvoidRepeat(!avoidRepeat)}
                className="w-5 h-5 rounded accent-current"
              />
              <span className="text-sm">避免重複抽到</span>
            </label>
          </div>

          {/* Picked list */}
          {pickedStudents.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-bold ${theme.textLight}`}>
                  已抽過 ({pickedStudents.length}/{students.length})
                </span>
                <button
                  onClick={resetPicked}
                  className={`flex items-center gap-1 text-sm ${theme.primaryText} hover:underline`}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 重置
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {pickedStudents.map(s => (
                  <span
                    key={s.id}
                    className={`px-3 py-1 rounded-full text-sm ${theme.surfaceAccent} ${theme.text} border ${theme.border}`}
                  >
                    {formatStudentLabel(s)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
