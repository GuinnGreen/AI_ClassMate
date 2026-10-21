import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
const connection = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('../../firebase', () => ({ get db() { return connection.db; }, functions: {} }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => vi.fn() }));
import { addPointToAllStudents, addPointToStudent, appendStudentNote, deletePointFromStudent, saveStudentNote, setStudentAbsence } from '../../services/firebaseService';
let env: RulesTestEnvironment;
beforeAll(async () => {
  expect(process.env.GCLOUD_PROJECT).toBe('demo-classmate-ai');
  expect(process.env.FIRESTORE_EMULATOR_HOST).toBe('127.0.0.1:8080');
  env = await initializeTestEnvironment({ projectId: 'demo-classmate-ai', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
  connection.db = env.authenticatedContext('concurrent-teacher').firestore();
});
afterAll(async () => { await env?.cleanup(); });
it('preserves note, absence and every point under real competing writes', async () => {
  const db = env.authenticatedContext('concurrent-teacher').firestore();
  const ref = doc(db, 'users/concurrent-teacher/students/student-1');
  const day = '2026-10-21';
  const initial = { id: 'student-1', name: '測試學生', totalScore: 0, tags: [], comment: '', dailyRecords: {} };
  await setDoc(ref, initial);
  const stale = { points: [], note: '', absence: null };
  await Promise.all([
    addPointToStudent('concurrent-teacher', 'student-1', day, stale, { label: '單人', value: 1 }),
    addPointToAllStudents('concurrent-teacher', [initial], day, { label: '全班', value: 2 }),
    saveStudentNote('concurrent-teacher', 'student-1', day, stale, '保留備註'),
  ]);
  let stored = (await getDoc(ref)).data()!;
  expect(stored.totalScore).toBe(3);
  expect(stored.dailyRecords[day].points).toHaveLength(2);
  expect(stored.dailyRecords[day].note).toBe('保留備註');
  await Promise.all([
    setStudentAbsence('concurrent-teacher', 'student-1', day, stale, '病假'),
    appendStudentNote('concurrent-teacher', 'student-1', day, '同步一'),
    appendStudentNote('concurrent-teacher', 'student-1', day, '同步二'),
    addPointToStudent('concurrent-teacher', 'student-1', day, stale, { label: '另一台', value: 3 }),
  ]);
  stored = (await getDoc(ref)).data()!;
  expect(stored.totalScore).toBe(6);
  expect(stored.dailyRecords[day].points).toHaveLength(3);
  expect(stored.dailyRecords[day].absence).toBe('病假');
  for (const text of ['保留備註', '同步一', '同步二']) expect(stored.dailyRecords[day].note).toContain(text);
  const point = stored.dailyRecords[day].points[0];
  await Promise.all([1, 2].map(() => deletePointFromStudent('concurrent-teacher', 'student-1', day, stale, point.id, 999)));
  stored = (await getDoc(ref)).data()!;
  expect(stored.totalScore).toBe(6 - point.value);
  expect(stored.dailyRecords[day].points).toHaveLength(2);
});
