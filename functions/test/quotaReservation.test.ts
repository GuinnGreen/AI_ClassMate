import { describe, expect, it } from 'vitest';
import {
  countChargeableQuota,
  executeWithQuotaReservation,
  settleQuotaReservation,
} from '../src/quotaReservation';

describe('quota reservations', () => {
  it('excludes failed and expired reservations while retaining legacy usage', () => {
    const now = 1_000_000;

    expect(countChargeableQuota([
      { type: 'ai_generate', timestamp: 1 },
      { type: 'ai_generate', timestamp: 2, status: 'succeeded' },
      { type: 'ai_generate', timestamp: 3, status: 'reserved', reservationExpiresAt: now + 1 },
      { type: 'ai_generate', timestamp: 4, status: 'failed' },
      { type: 'ai_generate', timestamp: 5, status: 'reserved', reservationExpiresAt: now },
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
