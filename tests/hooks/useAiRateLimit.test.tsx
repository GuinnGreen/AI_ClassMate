import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const quota = vi.hoisted(() => ({
  getAiQuotaUsageSnapshot: vi.fn(),
  getTodayAiGenerationCount: vi.fn(),
}));

vi.mock('../../services/firebaseService', () => quota);

import { useAiRateLimit } from '../../hooks/useAiRateLimit';

describe('useAiRateLimit Taiwan-day rollover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    quota.getAiQuotaUsageSnapshot.mockReset();
    quota.getTodayAiGenerationCount.mockReset().mockResolvedValue(30);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes an exhausted quota after the server-defined Taiwan midnight without a reload', async () => {
    quota.getAiQuotaUsageSnapshot
      .mockResolvedValueOnce({
        used: 30,
        limit: 30,
        dayKey: '2026-08-30',
        startMs: 1_788_019_200_000,
        endMs: 1_788_105_600_000,
        serverNowMs: 1_788_105_599_000,
      })
      .mockResolvedValueOnce({
        used: 0,
        limit: 30,
        dayKey: '2026-08-31',
        startMs: 1_788_105_600_000,
        endMs: 1_788_192_000_000,
        serverNowMs: 1_788_105_600_001,
      });

    const { result } = renderHook(() => useAiRateLimit({ userUid: 'teacher-1' }));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.dailyUsageCount).toBe(30);
    expect(result.current.canGenerate).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(1_001);
      await Promise.resolve();
    });

    expect(quota.getAiQuotaUsageSnapshot).toHaveBeenCalledTimes(2);
    expect(result.current.dailyUsageCount).toBe(0);
    expect(result.current.canGenerate).toBe(true);
  });

  it('fails open at the known boundary and retries when the rollover refresh is temporarily unavailable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    quota.getAiQuotaUsageSnapshot
      .mockResolvedValueOnce({
        used: 30,
        limit: 30,
        dayKey: '2026-08-30',
        startMs: 1_788_019_200_000,
        endMs: 1_788_105_600_000,
        serverNowMs: 1_788_105_599_000,
      })
      .mockRejectedValueOnce(new Error('temporary callable failure'))
      .mockResolvedValueOnce({
        used: 1,
        limit: 30,
        dayKey: '2026-08-31',
        startMs: 1_788_105_600_000,
        endMs: 1_788_192_000_000,
        serverNowMs: 1_788_105_630_001,
      });

    const { result } = renderHook(() => useAiRateLimit({ userUid: 'teacher-1' }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      vi.advanceTimersByTime(1_001);
      await Promise.resolve();
    });
    expect(result.current.dailyUsageCount).toBe(0);
    expect(result.current.canGenerate).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(quota.getAiQuotaUsageSnapshot).toHaveBeenCalledTimes(3);
    expect(result.current.dailyUsageCount).toBe(1);
  });
});
