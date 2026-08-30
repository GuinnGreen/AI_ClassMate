import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export const DAILY_QUOTA = 30;
export const QUOTA_RESERVATION_TTL_MS = 5 * 60 * 1000;
export const QUOTA_TIME_ZONE = 'Asia/Taipei';

const TAIPEI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface QuotaWindow {
  timeZone: typeof QUOTA_TIME_ZONE;
  dayKey: string;
  startMs: number;
  endMs: number;
}

export function getTaipeiQuotaWindow(now: number): QuotaWindow {
  const dayKey = new Date(now + TAIPEI_UTC_OFFSET_MS).toISOString().slice(0, 10);
  const [year, month, day] = dayKey.split('-').map(Number);
  const startMs = Date.UTC(year, month - 1, day) - TAIPEI_UTC_OFFSET_MS;
  return {
    timeZone: QUOTA_TIME_ZONE,
    dayKey,
    startMs,
    endMs: startMs + DAY_MS,
  };
}

export type QuotaReservationStatus = 'reserved' | 'succeeded' | 'failed';
export type QuotaUsageType = 'ai_generate' | 'schedule_recognize';

export interface QuotaLogData {
  type?: unknown;
  status?: unknown;
  reservationExpiresAt?: unknown;
  [key: string]: unknown;
}

export interface QuotaReservationReference {
  update(data: Record<string, unknown>): Promise<unknown>;
}

export interface QuotaReservationHandle extends QuotaReservationReference {
  readonly logRef: DocumentReference;
  readonly counterRef: DocumentReference;
  readonly dayKey: string;
}

export interface QuotaUsage extends QuotaWindow {
  used: number;
  limit: number;
}

interface QuotaCounterState {
  used: number;
  activeReservations: Record<string, number | null>;
  initializedAt: number;
}

interface QuotaLogSnapshot {
  id: string;
  data(): QuotaLogData;
}

export type QuotaSettlementErrorHandler = (
  status: Exclude<QuotaReservationStatus, 'reserved'>,
  error: unknown
) => void;

function isQuotaUsageType(value: unknown): value is QuotaUsageType {
  return value === 'ai_generate' || value === 'schedule_recognize';
}

function isChargeableQuotaLog(log: QuotaLogData, now: number): boolean {
  if (!isQuotaUsageType(log.type)) return false;
  if (log.status === 'failed') return false;
  if (log.status === 'reserved') {
    return typeof log.reservationExpiresAt !== 'number' || log.reservationExpiresAt > now;
  }
  return true;
}

export function countChargeableQuota(logs: QuotaLogData[], now: number): number {
  return logs.filter(log => isChargeableQuotaLog(log, now)).length;
}

function counterStateFromLogs(logs: QuotaLogSnapshot[], now: number): QuotaCounterState {
  const activeReservations: Record<string, number | null> = {};
  for (const log of logs) {
    const data = log.data();
    if (!isChargeableQuotaLog(data, now) || data.status !== 'reserved') continue;
    activeReservations[log.id] = typeof data.reservationExpiresAt === 'number'
      ? data.reservationExpiresAt
      : null;
  }
  return {
    used: countChargeableQuota(logs.map(log => log.data()), now),
    activeReservations,
    initializedAt: now,
  };
}

function counterStateFromData(data: Record<string, unknown>, now: number): QuotaCounterState {
  const rawUsed = data.used;
  const rawActive = data.activeReservations;
  const activeReservations: Record<string, number | null> = {};
  if (rawActive && typeof rawActive === 'object' && !Array.isArray(rawActive)) {
    for (const [id, expiresAt] of Object.entries(rawActive)) {
      if (typeof expiresAt === 'number' || expiresAt === null) {
        activeReservations[id] = expiresAt;
      }
    }
  }
  return {
    used: typeof rawUsed === 'number' && Number.isFinite(rawUsed)
      ? Math.max(0, Math.floor(rawUsed))
      : 0,
    activeReservations,
    initializedAt: typeof data.initializedAt === 'number' ? data.initializedAt : now,
  };
}

function pruneExpiredReservations(
  state: QuotaCounterState,
  now: number,
  exceptLogId?: string,
): { state: QuotaCounterState; pruned: number } {
  const activeReservations = { ...state.activeReservations };
  let pruned = 0;
  for (const [logId, expiresAt] of Object.entries(activeReservations)) {
    if (logId !== exceptLogId && typeof expiresAt === 'number' && expiresAt <= now) {
      delete activeReservations[logId];
      pruned++;
    }
  }
  return {
    state: {
      ...state,
      used: Math.max(0, state.used - pruned),
      activeReservations,
    },
    pruned,
  };
}

function counterData(
  uid: string,
  window: QuotaWindow,
  state: QuotaCounterState,
  updatedAt: number,
): Record<string, unknown> {
  return {
    uid,
    dayKey: window.dayKey,
    timeZone: window.timeZone,
    startMs: window.startMs,
    endMs: window.endMs,
    used: state.used,
    activeReservations: state.activeReservations,
    initializedAt: state.initializedAt,
    updatedAt,
  };
}

function quotaReferences(db: Firestore, uid: string, window: QuotaWindow) {
  return {
    logsRef: db.collection(`users/${uid}/logs`),
    counterRef: db.doc(`aiQuotaCounters/${uid}/days/${window.dayKey}`),
  };
}

function quotaLogsForWindow(
  logsRef: FirebaseFirestore.CollectionReference,
  window: QuotaWindow,
) {
  return logsRef
    .where('timestamp', '>=', window.startMs)
    .where('timestamp', '<', window.endMs);
}

export async function getQuotaUsage(
  db: Firestore,
  uid: string,
  options: { now?: () => number } = {},
): Promise<QuotaUsage> {
  const now = (options.now ?? Date.now)();
  const window = getTaipeiQuotaWindow(now);
  const { logsRef, counterRef } = quotaReferences(db, uid, window);

  const used = await db.runTransaction(async transaction => {
    const counterSnapshot = await transaction.get(counterRef);
    let state: QuotaCounterState;
    if (counterSnapshot.exists) {
      state = counterStateFromData(counterSnapshot.data() as Record<string, unknown>, now);
    } else {
      const logsSnapshot = await transaction.get(quotaLogsForWindow(logsRef, window));
      state = counterStateFromLogs(logsSnapshot.docs, now);
    }
    const pruned = pruneExpiredReservations(state, now);
    if (!counterSnapshot.exists || pruned.pruned > 0) {
      transaction.set(counterRef, counterData(uid, window, pruned.state, now));
    }
    return pruned.state.used;
  });

  return { ...window, used, limit: DAILY_QUOTA };
}

function createReservationHandle(
  db: Firestore,
  uid: string,
  window: QuotaWindow,
  logRef: DocumentReference,
  counterRef: DocumentReference,
): QuotaReservationHandle {
  return {
    logRef,
    counterRef,
    dayKey: window.dayKey,
    async update(data: Record<string, unknown>) {
      const status = data.status;
      if (status !== 'succeeded' && status !== 'failed') {
        return logRef.update(data);
      }
      const settledAt = typeof data.settledAt === 'number' ? data.settledAt : Date.now();
      return db.runTransaction(async transaction => {
        const logSnapshot = await transaction.get(logRef);
        const currentStatus = logSnapshot.data()?.status;
        if (!logSnapshot.exists || currentStatus !== 'reserved') return;

        const counterSnapshot = await transaction.get(counterRef);
        if (counterSnapshot.exists) {
          const originalState = counterStateFromData(
            counterSnapshot.data() as Record<string, unknown>,
            settledAt,
          );
          const pruned = pruneExpiredReservations(originalState, settledAt, logRef.id);
          const state = pruned.state;
          const hadActiveReservation = Object.prototype.hasOwnProperty.call(
            state.activeReservations,
            logRef.id,
          );
          delete state.activeReservations[logRef.id];

          if (status === 'failed' && hadActiveReservation) {
            state.used = Math.max(0, state.used - 1);
          } else if (
            status === 'succeeded'
            && !hadActiveReservation
            && typeof logSnapshot.data()?.reservationExpiresAt === 'number'
            && logSnapshot.data()!.reservationExpiresAt <= settledAt
          ) {
            // A client-visible read may already have pruned this expired reservation.
            // A late successful settlement still consumes the successful generation.
            state.used++;
          }
          transaction.set(counterRef, counterData(uid, window, state, settledAt));
        }
        transaction.update(logRef, { status, settledAt });
      });
    },
  };
}

export async function reserveQuota(
  db: Firestore,
  uid: string,
  type: QuotaUsageType,
  extra: Record<string, unknown> = {},
  options: { now?: () => number } = {},
): Promise<QuotaReservationHandle> {
  const now = (options.now ?? Date.now)();
  const window = getTaipeiQuotaWindow(now);
  const { logsRef, counterRef } = quotaReferences(db, uid, window);
  const logRef = logsRef.doc();
  const reservationExpiresAt = now + QUOTA_RESERVATION_TTL_MS;

  const reserved = await db.runTransaction(async transaction => {
    const counterSnapshot = await transaction.get(counterRef);
    let state: QuotaCounterState;
    if (counterSnapshot.exists) {
      state = counterStateFromData(counterSnapshot.data() as Record<string, unknown>, now);
    } else {
      const logsSnapshot = await transaction.get(quotaLogsForWindow(logsRef, window));
      state = counterStateFromLogs(logsSnapshot.docs, now);
    }
    const pruned = pruneExpiredReservations(state, now);
    state = pruned.state;

    if (state.used >= DAILY_QUOTA) {
      if (!counterSnapshot.exists || pruned.pruned > 0) {
        transaction.set(counterRef, counterData(uid, window, state, now));
      }
      return false;
    }

    state.used++;
    state.activeReservations[logRef.id] = reservationExpiresAt;
    transaction.set(counterRef, counterData(uid, window, state, now));
    transaction.set(logRef, {
      ...extra,
      type,
      timestamp: now,
      quotaDayKey: window.dayKey,
      status: 'reserved',
      reservationExpiresAt,
    });
    return true;
  });

  if (!reserved) {
    throw new HttpsError(
      'resource-exhausted',
      `每日 AI 使用配額已達上限（${DAILY_QUOTA} 次）`,
    );
  }
  return createReservationHandle(db, uid, window, logRef, counterRef);
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

export async function executeWithQuotaReservation<T>(
  reference: QuotaReservationReference,
  generate: () => Promise<T>,
  onSettlementError: QuotaSettlementErrorHandler = () => undefined
): Promise<T> {
  let result: T;
  try {
    result = await generate();
  } catch (generationError) {
    try {
      await settleQuotaReservation(reference, 'failed');
    } catch (settlementError) {
      onSettlementError('failed', settlementError);
    }
    throw generationError;
  }

  try {
    await settleQuotaReservation(reference, 'succeeded');
  } catch (settlementError) {
    onSettlementError('succeeded', settlementError);
  }
  return result;
}
