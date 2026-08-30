import { useState, useEffect, useRef, useCallback } from 'react';
import { getAiQuotaUsageSnapshot } from '../services/firebaseService';

interface UseAiRateLimitOptions {
  cooldownSeconds?: number;  // 預設 10
  dailyLimit?: number;       // 預設 30
  userUid: string;
}

export function useAiRateLimit({
  cooldownSeconds = 10,
  dailyLimit: configuredDailyLimit = 30,
  userUid,
}: UseAiRateLimitOptions) {
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [dailyUsageCount, setDailyUsageCount] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(configuredDailyLimit);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 由後端回傳的 Asia/Taipei 日界線安排 rollover，不使用裝置本機日期。
  useEffect(() => {
    if (!userUid) return;
    let cancelled = false;
    let rolloverTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let requestId = 0;

    setDailyUsageCount(0);
    setDailyLimit(configuredDailyLimit);

    const refreshQuota = async (resetForNewDay = false) => {
      const currentRequest = ++requestId;
      if (resetForNewDay) setDailyUsageCount(0);

      try {
        const usage = await getAiQuotaUsageSnapshot(userUid);
        if (cancelled || currentRequest !== requestId) return;

        setDailyUsageCount(usage.used);
        setDailyLimit(usage.limit);
        const rolloverDelay = Math.max(0, usage.endMs - usage.serverNowMs + 1);
        rolloverTimer = setTimeout(() => { void refreshQuota(true); }, rolloverDelay);
      } catch (err) {
        if (cancelled || currentRequest !== requestId) return;
        console.warn('[RateLimit] 查詢每日用量失敗:', err);
        if (resetForNewDay) {
          retryTimer = setTimeout(() => { void refreshQuota(true); }, 30_000);
        }
      }
    };

    void refreshQuota();
    return () => {
      cancelled = true;
      if (rolloverTimer) clearTimeout(rolloverTimer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [configuredDailyLimit, userUid]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const recordGeneration = useCallback(() => {
    setDailyUsageCount(prev => prev + 1);
    setCooldownRemaining(cooldownSeconds);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    const startTime = Date.now();
    cooldownTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, cooldownSeconds - Math.floor((Date.now() - startTime) / 1000));
      setCooldownRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(cooldownTimerRef.current!);
        cooldownTimerRef.current = null;
      }
    }, 1000);
  }, [cooldownSeconds]);

  const isLimitReached = dailyUsageCount >= dailyLimit;
  const canGenerate = cooldownRemaining <= 0 && !isLimitReached;

  return { canGenerate, cooldownRemaining, dailyUsageCount, dailyLimit, isLimitReached, recordGeneration };
}
