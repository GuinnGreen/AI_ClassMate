import { describe, expect, it } from 'vitest';
import {
  countChargeableQuota,
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
});
