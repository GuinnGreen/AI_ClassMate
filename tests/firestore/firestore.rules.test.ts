import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-classmate-ai';
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterEach(async () => testEnv.clearFirestore());
afterAll(async () => testEnv.cleanup());

describe('Firestore tenant isolation', () => {
  it('allows an authenticated owner to write their student document', async () => {
    const db = testEnv.authenticatedContext('teacher-a').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/teacher-a/students/student-1'), { name: '測試學生' }));
  });

  it('denies cross-tenant reads', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users/teacher-a/students/student-1'), { name: '測試學生' });
    });
    const db = testEnv.authenticatedContext('teacher-b').firestore();
    await assertFails(getDoc(doc(db, 'users/teacher-a/students/student-1')));
  });

  it('denies unauthenticated reads', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'users/teacher-a/students/student-1')));
  });
});


describe('server-owned AI quota records', () => {
  for (const suffix of ['logs/log-1', 'logs/log-1/nested/doc']) {
    it(`denies owner create, update and delete for ${suffix}`, async () => {
      const path = `users/teacher-a/${suffix}`;
      const db = testEnv.authenticatedContext('teacher-a').firestore();
      await assertFails(setDoc(doc(db, path), { timestamp: 1 }));
      await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), path), { timestamp: 1 });
      });
      await assertSucceeds(getDoc(doc(db, path)));
      await assertFails(updateDoc(doc(db, path), { timestamp: 0 }));
      await assertFails(deleteDoc(doc(db, path)));
    });
  }
  it('denies client reads and writes to quota counters', async () => {
    const db = testEnv.authenticatedContext('teacher-a').firestore();
    const ref = doc(db, 'aiQuotaCounters/teacher-a/days/2026-10-21');
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { used: 0 }));
  });
  it('preserves owner settings, notes, research logs and nested archives', async () => {
    const db = testEnv.authenticatedContext('teacher-a').firestore();
    for (const suffix of ['settings/config', 'research_logs/edit-1', 'archives/term/students/student-1']) {
      await assertSucceeds(setDoc(doc(db, `users/teacher-a/${suffix}`), { test: true }));
    }
  });
});
