import { useState, useRef, useCallback } from 'react';
import { X, Play, Pause, RotateCcw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { UseCountdownTimerReturn } from '../hooks/useCountdownTimer';

interface Props {
  timer: UseCountdownTimerReturn;
  onClose: () => void;
}

const PRESET_MINUTES = [1, 3, 5, 10, 15, 20];

function playBeep() {
  try {
    const ctx = new AudioContext();
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    playTone(880, 0, 0.15);
    playTone(880, 0.2, 0.15);
    playTone(1320, 0.45, 0.3);
  } catch { /* Audio not available */ }
}

export function CountdownTimer({ timer, onClose }: Props) {
  const theme = useTheme();
  const [customMin, setCustomMin] = useState('');
  const [customSec, setCustomSec] = useState('');
  const hasPlayedRef = useRef(false);

  const isSetupMode = !timer.isRunning && !timer.isPaused && !timer.isFinished;

  const handleStart = useCallback((seconds: number) => {
    hasPlayedRef.current = false;
    timer.start(seconds);
  }, [timer]);

  const handleStartCustom = () => {
    const m = parseInt(customMin) || 0;
    const s = parseInt(customSec) || 0;
    const total = m * 60 + s;
    if (total > 0) handleStart(total);
  };

  const handleReset = () => {
    hasPlayedRef.current = false;
    timer.reset();
  };

  // Play beep when finished
  if (timer.isFinished && !hasPlayedRef.current) {
    hasPlayedRef.current = true;
    playBeep();
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // SVG circle progress
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const progress = timer.totalSeconds > 0 ? timer.remainingSeconds / timer.totalSeconds : 0;
  const strokeDashoffset = circumference * (1 - progress);

  const isWarning = timer.remainingSeconds <= 30 && timer.remainingSeconds > 10;
  const isCritical = timer.remainingSeconds <= 10 && timer.remainingSeconds > 0;

  const progressColor = timer.isFinished
    ? '#FF3B30'
    : isCritical
      ? '#FF3B30'
      : isWarning
        ? '#FF9500'
        : '#34C759';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full max-w-md ${theme.surface} rounded-3xl shadow-2xl overflow-hidden animate-pop-in border ${theme.border}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 border-b ${theme.border} flex justify-between items-center ${theme.surfaceAlt}`}>
          <h3 className={`font-bold text-lg ${theme.text}`}>倒數計時器</h3>
          <button onClick={onClose} className={`p-2 hover:bg-black/5 rounded-full transition ${theme.textLight}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isSetupMode ? (
            <>
              {/* Preset buttons */}
              <div className="grid grid-cols-3 gap-3">
                {PRESET_MINUTES.map(m => (
                  <button
                    key={m}
                    onClick={() => handleStart(m * 60)}
                    className={`py-4 rounded-2xl ${theme.surfaceAccent} ${theme.text} font-bold text-lg border ${theme.border} hover:scale-105 active:scale-95 transition-transform`}
                  >
                    {m} 分鐘
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div className={`p-4 rounded-2xl ${theme.surfaceAccent} border ${theme.border} space-y-3`}>
                <p className={`text-sm font-bold ${theme.textLight}`}>自訂時間</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={customMin}
                    onChange={e => setCustomMin(e.target.value)}
                    placeholder="0"
                    className={`w-20 p-3 rounded-xl border ${theme.border} ${theme.inputBg} ${theme.text} text-center text-lg font-bold outline-none focus:ring-2 ${theme.focusRing}`}
                  />
                  <span className={`font-bold ${theme.text}`}>分</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={customSec}
                    onChange={e => setCustomSec(e.target.value)}
                    placeholder="0"
                    className={`w-20 p-3 rounded-xl border ${theme.border} ${theme.inputBg} ${theme.text} text-center text-lg font-bold outline-none focus:ring-2 ${theme.focusRing}`}
                  />
                  <span className={`font-bold ${theme.text}`}>秒</span>
                </div>
                <button
                  onClick={handleStartCustom}
                  className={`w-full py-3 rounded-xl ${theme.primary} text-white font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-transform`}
                >
                  開始
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Countdown display */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-56 h-56">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                    {/* Background circle */}
                    <circle
                      cx="100" cy="100" r={radius}
                      fill="none" stroke="currentColor" strokeWidth="8"
                      className={theme.textLight} opacity={0.2}
                    />
                    {/* Progress circle */}
                    <circle
                      cx="100" cy="100" r={radius}
                      fill="none" stroke={progressColor} strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s' }}
                    />
                  </svg>
                  {/* Time text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {timer.isFinished ? (
                      <span className={`text-3xl font-bold text-red-500 animate-pulse`}>時間到！</span>
                    ) : (
                      <span className={`text-5xl font-bold tabular-nums ${theme.text} ${isCritical ? 'countdown-pulse' : ''}`}>
                        {formatTime(timer.remainingSeconds)}
                      </span>
                    )}
                    {timer.isPaused && (
                      <span className={`text-sm mt-1 ${theme.textLight}`}>已暫停</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex justify-center gap-4">
                {!timer.isFinished && (
                  <button
                    onClick={timer.isPaused ? timer.resume : timer.pause}
                    className={`w-14 h-14 rounded-full ${theme.surfaceAccent} border ${theme.border} flex items-center justify-center hover:scale-110 active:scale-95 transition-transform`}
                  >
                    {timer.isPaused ? (
                      <Play className={`w-6 h-6 ${theme.text}`} />
                    ) : (
                      <Pause className={`w-6 h-6 ${theme.text}`} />
                    )}
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className={`w-14 h-14 rounded-full ${theme.surfaceAccent} border ${theme.border} flex items-center justify-center hover:scale-110 active:scale-95 transition-transform`}
                >
                  <RotateCcw className={`w-6 h-6 ${theme.text}`} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
