import { describe, expect, it } from 'vitest';
import {
  countChargeableQuota,
  executeWithQuotaReservation,
  getTaipeiQuotaWindow,
  settleQuotaReservation,
} from '../src/quotaReservation';

describe('Taipei quota days', () => {
  it('switches quota days at Taiwan midnight with exact UTC bounds', () => {
    expect(getTaipeiQuotaWindow(Date.parse('2026-08-29T15:59:59.999Z'))).toEqual({
      timeZone: 'Asia/Taipei',
      dayKey: '2026-08-29',
      startMs: Date.parse('2026-08-28T16:00:00.000Z'),
      endMs: Date.parse('2026-08-29T16:00:00.000Z'),
    });
    expect(getTaipeiQuotaWindow(Date.parse('2026-08-29T16:00:00.000Z'))).toEqual({
      timeZone: 'Asia/Taipei',
      dayKey: '2026-08-30',
      startMs: Date.parse('2026-08-29T16:00:00.000Z'),
      endMs: Date.parse('2026-08-30T16:00:00.000Z'),
    });
  });

  it('does not inherit the Functions runtime timezone', () => {
    const previousTimezone = process.env.TZ;
    try {
      process.env.TZ = 'America/Los_Angeles';
      expect(getTaipeiQuotaWindow(Date.parse('2026-08-29T16:00:00.000Z')).dayKey)
        .toBe('2026-08-30');
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });
});

describe('quota reservations', () => {
  it('excludes failed and expired reservations while retaining legacy usage', () => {
    const now = 1_000_000;

    expect(countChargeableQuota([
      { type: 'ai_generate', timestamp: 1 },
      { type: 'ai_generate', timestamp: 2, status: 'succeeded' },
      { type: 'ai_generate', timestamp: 3, status: 'reserved', reservationExpiresAt: now + 1 },
      { type: 'ai_generate', timestamp: 4, status: 'failed' },
      { type: 'ai_generate', timestamp: 5, status: 'reserved', reservationExpiresAt: now },
      { type: 'non_quota_audit', timestamp: 6 },
    ], now)).toBe(3);
  });

  it('retries a failed settlement and leaves the reservation marked failed', async () => {
    const stored: Record<string, unknown> = { status: 'reserved' };
    let firstAttempt = true;
    const reference = {
      async update(data: Record<string, unknown>) {
        if (firstAttempt) {
          firstAttempt = false;
          throw new Error('transient Firestore failure');
        }
        Object.assign(stored, data);
      },
    };

    await settleQuotaReservation(reference, 'failed', {
      maxAttempts: 3,
      now: () => 1_000_123,
    });

    expect(stored).toEqual({
      status: 'failed',
      settledAt: 1_000_123,
    });
  });

  it('returns a generated result when succeeded settlement exhausts retries without marking it failed', async () => {
    const attemptedStatuses: unknown[] = [];
    const reference = {
      async update(data: Record<string, unknown>) {
        attemptedStatuses.push(data.status);
        throw new Error('Firestore settlement unavailable');
      },
    };

    const result = await executeWithQuotaReservation(
      reference,
      async () => '已產生的評語',
    );

    expect(result).toBe('已產生的評語');
    expect(attemptedStatuses).toEqual(['succeeded', 'succeeded', 'succeeded']);
  });
});
