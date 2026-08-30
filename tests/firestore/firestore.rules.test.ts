import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
