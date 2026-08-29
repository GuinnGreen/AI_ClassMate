import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  studentRef: { path: 'users/teacher-1/students/student-1' },
  logsRef: { path: 'users/teacher-1/logs' },
  doc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: firestore.doc,
    collection: firestore.collection,
    query: firestore.query,
    where: firestore.where,
    getDocs: firestore.getDocs,
    updateDoc: firestore.updateDoc,
  };
});

vi.mock('../../firebase', () => ({ db: {} }));

import { getTodayAiGenerationCount, saveStudentNote } from '../../services/firebaseService';

describe('saveStudentNote', () => {
  beforeEach(() => {
    firestore.doc.mockReturnValue(firestore.studentRef);
    firestore.updateDoc.mockResolvedValue(undefined);
  });

  it('updates only the note field so concurrent points and absence changes survive', async () => {
    const staleDailyRecord = {
      points: [{ id: 'old-point', label: '舊紀錄', value: 1, timestamp: 1 }],
      note: '舊註記',
      absence: null,
    };

    await saveStudentNote(
      'teacher-1',
      'student-1',
      '2026-08-29',
      staleDailyRecord,
      '新的私密註記',
    );

    expect(firestore.updateDoc).toHaveBeenCalledWith(firestore.studentRef, {
      'dailyRecords.2026-08-29.note': '新的私密註記',
    });
  });
});

describe('getTodayAiGenerationCount', () => {
  it('counts legacy, succeeded, and active reservations but excludes failed and expired logs', async () => {
    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    firestore.collection.mockReturnValue(firestore.logsRef);
    firestore.where.mockReturnValue({ field: 'timestamp' });
    firestore.query.mockReturnValue({ source: firestore.logsRef });
    const logs = [
      { type: 'ai_generate', timestamp: 1 },
      { type: 'ai_generate', timestamp: 2, status: 'succeeded' },
      { type: 'schedule_recognize', timestamp: 3, status: 'reserved', reservationExpiresAt: now + 1 },
      { type: 'ai_generate', timestamp: 4, status: 'failed' },
      { type: 'ai_generate', timestamp: 5, status: 'reserved', reservationExpiresAt: now },
    ];
    firestore.getDocs.mockResolvedValue({
      size: 5,
      docs: logs.map((data, index) => ({
        id: `log-${index + 1}`,
        ref: { path: `users/teacher-1/logs/log-${index + 1}` },
        exists: () => true,
        data: () => data,
      })),
    });

    const count = await getTodayAiGenerationCount('teacher-1');

    expect(count).toBe(3);
  });
});
