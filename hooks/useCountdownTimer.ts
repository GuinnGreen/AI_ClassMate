import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseCountdownTimerReturn {
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  isFinished: boolean;
  start: (durationSeconds: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export function useCountdownTimer(): UseCountdownTimerReturn {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const endTimeRef = useRef(0);
  const pausedRemainingRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
    setRemainingSeconds(remaining);
    if (remaining <= 0) {
      clearTick();
      setIsRunning(false);
      setIsFinished(true);
    }
  }, [clearTick]);

  const startTicking = useCallback(() => {
    clearTick();
    tick();
    intervalRef.current = setInterval(tick, 200);
  }, [clearTick, tick]);

  const start = useCallback((durationSeconds: number) => {
    clearTick();
    const dur = Math.max(1, Math.round(durationSeconds));
    setTotalSeconds(dur);
    setRemainingSeconds(dur);
    setIsFinished(false);
    setIsPaused(false);
    setIsRunning(true);
    endTimeRef.current = Date.now() + dur * 1000;
    startTicking();
  }, [clearTick, startTicking]);

  const pause = useCallback(() => {
    if (!isRunning || isPaused) return;
    clearTick();
    const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
    pausedRemainingRef.current = remaining;
    setRemainingSeconds(remaining);
    setIsPaused(true);
  }, [isRunning, isPaused, clearTick]);

  const resume = useCallback(() => {
    if (!isPaused) return;
    endTimeRef.current = Date.now() + pausedRemainingRef.current * 1000;
    setIsPaused(false);
    startTicking();
  }, [isPaused, startTicking]);

  const reset = useCallback(() => {
    clearTick();
    setRemainingSeconds(0);
    setTotalSeconds(0);
    setIsRunning(false);
    setIsPaused(false);
    setIsFinished(false);
  }, [clearTick]);

  useEffect(() => {
    return () => clearTick();
  }, [clearTick]);

  return { remainingSeconds, totalSeconds, isRunning, isPaused, isFinished, start, pause, resume, reset };
}
