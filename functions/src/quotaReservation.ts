export const QUOTA_RESERVATION_TTL_MS = 5 * 60 * 1000;

export type QuotaReservationStatus = 'reserved' | 'succeeded' | 'failed';

export interface QuotaLogData {
  status?: unknown;
  reservationExpiresAt?: unknown;
  [key: string]: unknown;
}

export interface QuotaReservationReference {
  update(data: Record<string, unknown>): Promise<unknown>;
}

export function countChargeableQuota(logs: QuotaLogData[], now: number): number {
  return logs.filter((log) => {
    if (log.status === 'failed') return false;
    if (log.status === 'reserved') {
      return typeof log.reservationExpiresAt !== 'number' || log.reservationExpiresAt > now;
    }
    return true;
  }).length;
}

export async function settleQuotaReservation(
  reference: QuotaReservationReference,
  status: Exclude<QuotaReservationStatus, 'reserved'>,
  options: { maxAttempts?: number; now?: () => number } = {}
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? 3;
  const now = options.now ?? Date.now;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await reference.update({ status, settledAt: now() });
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}
