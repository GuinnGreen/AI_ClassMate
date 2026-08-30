import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  DAILY_QUOTA,
  getQuotaUsage,
  getTaipeiQuotaWindow,
  reserveQuota,
  settleQuotaReservation,
} from '../src/quotaReservation';

const PROJECT_ID = 'demo-classmate-ai';
const EMULATOR_HOST = '127.0.0.1:8081';
const UID = 'quota-concurrency-teacher';
const NOW = Date.parse('2026-08-30T03:00:00.000Z');

let app: App;
let db: Firestore;

function assertIsolatedEmulator() {
  expect(process.env.FIRESTORE_EMULATOR_HOST).toBe(EMULATOR_HOST);
  expect(process.env.GCLOUD_PROJECT).toBe(PROJECT_ID);
}

async function clearFixture() {
  assertIsolatedEmulator();
  await db.recursiveDelete(db.doc(`users/${UID}`));
  await db.recursiveDelete(db.doc(`aiQuotaCounters/${UID}`));
}

beforeAll(() => {
  assertIsolatedEmulator();
  app = initializeApp({ projectId: PROJECT_ID }, `quota-concurrency-${process.pid}`);
  db = getFirestore(app);
});

beforeEach(clearFixture);

afterAll(async () => {
  await clearFixture();
  await deleteApp(app);
});

describe('serialized daily quota reservations', () => {
  it('allows only the remaining concurrent reservations and refunds a failed generation', async () => {
    const window = getTaipeiQuotaWindow(NOW);
    const batch = db.batch();
    for (let index = 0; index < 28; index++) {
      batch.set(db.doc(`users/${UID}/logs/legacy-${index}`), {
        type: index === 27 ? 'schedule_recognize' : 'ai_generate',
        timestamp: window.startMs + index + 1,
        ...(index === 27 ? { status: 'succeeded' } : {}),
      });
    }
    batch.set(db.doc(`users/${UID}/logs/ignored-failed`), {
      type: 'ai_generate',
      timestamp: window.startMs + 100,
      status: 'failed',
    });
    batch.set(db.doc(`users/${UID}/logs/ignored-expired`), {
      type: 'ai_generate',
      timestamp: window.startMs + 101,
      status: 'reserved',
      reservationExpiresAt: NOW,
    });
    await batch.commit();

    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) => reserveQuota(
        db,
        UID,
        index % 2 === 0 ? 'ai_generate' : 'schedule_recognize',
        { requestIndex: index },
        { now: () => NOW },
      )),
    );
    const reservations = attempts.flatMap(result =>
      result.status === 'fulfilled' ? [result.value] : []
    );

    expect(reservations).toHaveLength(DAILY_QUOTA - 28);
    expect(attempts.filter(result => result.status === 'rejected')).toHaveLength(6);
    await expect(getQuotaUsage(db, UID, { now: () => NOW })).resolves.toMatchObject({
      used: 30,
      limit: 30,
      dayKey: window.dayKey,
      startMs: window.startMs,
      endMs: window.endMs,
      serverNowMs: NOW,
    });
    const counter = await db.doc(`aiQuotaCounters/${UID}/days/${window.dayKey}`).get();
    expect(counter.exists).toBe(true);
    expect(counter.data()).toMatchObject({
      uid: UID,
      dayKey: window.dayKey,
      used: 30,
      startMs: window.startMs,
      endMs: window.endMs,
    });
    expect((await db.doc(`users/${UID}/quotaCounters/${window.dayKey}`).get()).exists)
      .toBe(false);

    await settleQuotaReservation(reservations[0], 'failed', { now: () => NOW + 1 });
    await expect(getQuotaUsage(db, UID, { now: () => NOW + 1 })).resolves
      .toMatchObject({ used: 29 });

    const replacement = await reserveQuota(
      db,
      UID,
      'ai_generate',
      { replacement: true },
      { now: () => NOW + 2 },
    );
    await settleQuotaReservation(replacement, 'succeeded', { now: () => NOW + 3 });
    await expect(getQuotaUsage(db, UID, { now: () => NOW + 3 })).resolves
      .toMatchObject({ used: 30 });
  });
});
