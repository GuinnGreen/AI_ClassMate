import { useState, useEffect, useRef, useCallback } from 'react';
import { getTodayAiGenerationCount } from '../services/firebaseService';

interface UseAiRateLimitOptions {
  cooldownSeconds?: number;  // 預設 10
  dailyLimit?: number;       // 預設 30
  userUid: string;
}

export function useAiRateLimit({
  cooldownSeconds = 10,
  dailyLimit = 30,
  userUid,
}: UseAiRateLimitOptions) {
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [dailyUsageCount, setDailyUsageCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mount 時從 Firestore 查今日已用次數
  useEffect(() => {
    if (!userUid) return;
    getTodayAiGenerationCount(userUid)
      .then(count => setDailyUsageCount(count))
      .catch(err => console.warn('[RateLimit] 查詢每日用量失敗:', err));
  }, [userUid]);

  // Cleanup
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const recordGeneration = useCallback(() => {
    setDailyUsageCount(prev => prev + 1);
    setCooldownRemaining(cooldownSeconds);
    if (timerRef.current) clearInterval(timerRef.current);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, cooldownSeconds - Math.floor((Date.now() - startTime) / 1000));
      setCooldownRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
      }
    }, 1000);
  }, [cooldownSeconds]);

  const isLimitReached = dailyUsageCount >= dailyLimit;
  const canGenerate = cooldownRemaining <= 0 && !isLimitReached;

  return { canGenerate, cooldownRemaining, dailyUsageCount, dailyLimit, isLimitReached, recordGeneration };
}
