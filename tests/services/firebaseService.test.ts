import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  studentRef: { path: 'users/teacher-1/students/student-1' },
  doc: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: firestore.doc,
    updateDoc: firestore.updateDoc,
  };
});

vi.mock('../../firebase', () => ({ db: {} }));

import { saveStudentNote } from '../../services/firebaseService';

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
