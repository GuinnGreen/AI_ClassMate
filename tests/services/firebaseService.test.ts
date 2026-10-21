import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  studentRef: { path: 'users/teacher-1/students/student-1' },
  logsRef: { path: 'users/teacher-1/logs' },
  serverDocs: new Map<string, Record<string, unknown>>(),
  doc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  runTransaction: vi.fn(),
  writeBatch: vi.fn(),
  increment: vi.fn(),
  onSnapshot: vi.fn(),
}));

const callable = vi.hoisted(() => ({
  functions: { name: 'functions' },
  httpsCallable: vi.fn(),
  getQuotaUsage: vi.fn(),
}));

function clone<T>(value: T): T {
  return structuredClone(value);
}

function applyUpdate(
  reference: { path: string },
  updates: Record<string, unknown>,
) {
  const stored = firestore.serverDocs.get(reference.path);
  if (!stored) throw new Error(`Missing fake document: ${reference.path}`);

  for (const [fieldPath, rawValue] of Object.entries(updates)) {
    const segments = fieldPath.split('.');
    let target: Record<string, unknown> = stored;
    for (const segment of segments.slice(0, -1)) {
      const next = target[segment];
      if (!next || typeof next !== 'object') target[segment] = {};
      target = target[segment] as Record<string, unknown>;
    }
    const field = segments.at(-1)!;
    const value = rawValue as { __increment?: number };
    if (typeof value?.__increment === 'number') {
      target[field] = Number(target[field] ?? 0) + value.__increment;
    } else {
      target[field] = clone(rawValue);
    }
  }
}

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: firestore.doc,
    onSnapshot: firestore.onSnapshot,
    collection: firestore.collection,
    query: firestore.query,
    where: firestore.where,
    getDocs: firestore.getDocs,
    updateDoc: firestore.updateDoc,
    runTransaction: firestore.runTransaction,
    writeBatch: firestore.writeBatch,
    increment: firestore.increment,
  };
});

vi.mock('firebase/functions', () => ({
  httpsCallable: callable.httpsCallable,
}));

vi.mock('../../firebase', () => ({ db: {}, functions: callable.functions }));

import * as firebaseService from '../../services/firebaseService';

const {
  addPointToAllStudents,
  appendStudentNote,
  getTodayAiGenerationCount,
  saveStudentNote,
  setStudentAbsence,
} = firebaseService;

beforeEach(() => {
  vi.clearAllMocks();
  firestore.serverDocs.clear();
  callable.getQuotaUsage.mockReset();
  firestore.doc.mockImplementation((_db, path: string) => ({ path }));
  firestore.increment.mockImplementation((value: number) => ({ __increment: value }));
  firestore.updateDoc.mockImplementation(async (reference, updates) => {
    applyUpdate(reference, updates);
  });
  firestore.writeBatch.mockImplementation(() => {
    const staged: Array<{ reference: { path: string }; updates: Record<string, unknown> }> = [];
    return {
      update(reference: { path: string }, updates: Record<string, unknown>) {
        staged.push({ reference, updates });
      },
      async commit() {
        staged.forEach(({ reference, updates }) => applyUpdate(reference, updates));
      },
    };
  });
  firestore.runTransaction.mockImplementation(async (_db, callback) => {
    const staged: Array<{ reference: { path: string }; updates: Record<string, unknown> }> = [];
    const result = await callback({
      async get(reference: { path: string }) {
        const data = firestore.serverDocs.get(reference.path);
        return {
          exists: () => data !== undefined,
          data: () => data === undefined ? undefined : clone(data),
        };
      },
      update(reference: { path: string }, updates: Record<string, unknown>) {
        staged.push({ reference, updates });
      },
    });
    staged.forEach(({ reference, updates }) => applyUpdate(reference, updates));
    return result;
  });
  callable.httpsCallable.mockReturnValue(callable.getQuotaUsage);
});

describe('saveStudentNote', () => {
  beforeEach(() => {
    firestore.doc.mockReturnValue(firestore.studentRef);
    firestore.serverDocs.set(firestore.studentRef.path, {
      dailyRecords: {
        '2026-08-29': { points: [], note: '舊註記', absence: null },
      },
    });
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

    expect(firestore.serverDocs.get(firestore.studentRef.path)).toEqual({
      dailyRecords: { '2026-08-29': { points: [], note: '新的私密註記', absence: null } },
    });
  });
});

describe('competing student writes', () => {
  it('adds class points from server-latest records and preserves unrelated daily fields', async () => {
    const firstPath = 'users/teacher-1/students/student-1';
    const secondPath = 'users/teacher-1/students/student-2';
    const staleStudents = [
      {
        id: 'student-1', name: '甲生', totalScore: 0, tags: [], comment: '',
        dailyRecords: {
          '2026-08-29': {
            points: [{ id: 'stale', label: '舊畫面', value: 1, timestamp: 1 }],
            note: '畫面上的舊註記', absence: null,
          },
        },
      },
      {
        id: 'student-2', name: '乙生', totalScore: 0, tags: [], comment: '',
        dailyRecords: { '2026-08-29': { points: [], note: '', absence: null } },
      },
    ];
    firestore.serverDocs.set(firstPath, {
      totalScore: 7,
      dailyRecords: {
        '2026-08-29': {
          points: [{ id: 'concurrent', label: '其他裝置', value: 2, timestamp: 2 }],
          note: '伺服器最新私密註記',
          absence: null,
          teacherOnlyMarker: 'must-survive',
        },
      },
    });
    firestore.serverDocs.set(secondPath, {
      totalScore: 3,
      dailyRecords: {
        '2026-08-29': {
          points: [{ id: 'absent-point', label: '既有', value: 3, timestamp: 3 }],
          note: '請假學生註記',
          absence: '病假',
          teacherOnlyMarker: 'also-survives',
        },
      },
    });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    vi.spyOn(Date, 'now').mockReturnValue(1_999);

    const updatedCount = await addPointToAllStudents(
      'teacher-1', staleStudents, '2026-08-29', { label: '合作', value: 2 },
    );

    expect(updatedCount).toBe(1);
    expect(firestore.serverDocs.get(firstPath)).toEqual({
      totalScore: 9,
      dailyRecords: {
        '2026-08-29': {
          points: [
            { id: 'concurrent', label: '其他裝置', value: 2, timestamp: 2 },
            {
              id: '00000000-0000-4000-8000-000000000001',
              label: '合作',
              value: 2,
              timestamp: 1_999,
            },
          ],
          note: '伺服器最新私密註記',
          absence: null,
          teacherOnlyMarker: 'must-survive',
        },
      },
    });
    expect(firestore.serverDocs.get(secondPath)?.totalScore).toBe(3);
    expect((firestore.serverDocs.get(secondPath)?.dailyRecords as Record<string, unknown>)['2026-08-29'])
      .toMatchObject({ absence: '病假', teacherOnlyMarker: 'also-survives' });
  });

  it('changes only absence so concurrent points, notes, and extra fields survive', async () => {
    const path = 'users/teacher-1/students/student-1';
    firestore.serverDocs.set(path, {
      totalScore: 4,
      dailyRecords: {
        '2026-08-29': {
          points: [{ id: 'concurrent', label: '其他裝置', value: 4, timestamp: 4 }],
          note: '伺服器最新私密註記',
          absence: '病假',
          teacherOnlyMarker: 'must-survive',
        },
      },
    });

    await setStudentAbsence(
      'teacher-1',
      'student-1',
      '2026-08-29',
      { points: [], note: '畫面上的舊註記', absence: '病假' },
      null,
    );

    expect(firestore.serverDocs.get(path)).toEqual({
      totalScore: 4,
      dailyRecords: {
        '2026-08-29': {
          points: [{ id: 'concurrent', label: '其他裝置', value: 4, timestamp: 4 }],
          note: '伺服器最新私密註記',
          absence: null,
          teacherOnlyMarker: 'must-survive',
        },
      },
    });
  });

  it('appends a synchronized note to the server-latest note atomically', async () => {
    const path = 'users/teacher-1/students/student-1';
    firestore.serverDocs.set(path, {
      totalScore: 4,
      dailyRecords: {
        '2026-08-29': {
          points: [{ id: 'concurrent', label: '其他裝置', value: 4, timestamp: 4 }],
          note: '其他裝置剛寫入的私密註記',
          absence: null,
          teacherOnlyMarker: 'must-survive',
        },
      },
    });

    await appendStudentNote(
      'teacher-1',
      'student-1',
      '2026-08-29',
      '這次要同步的私密註記',
    );

    expect(firestore.serverDocs.get(path)).toEqual({
      totalScore: 4,
      dailyRecords: {
        '2026-08-29': {
          points: [{ id: 'concurrent', label: '其他裝置', value: 4, timestamp: 4 }],
          note: '其他裝置剛寫入的私密註記\n---\n這次要同步的私密註記',
          absence: null,
          teacherOnlyMarker: 'must-survive',
        },
      },
    });
  });
});

describe('getTodayAiGenerationCount', () => {
  it('exposes the complete authoritative quota window for rollover scheduling', async () => {
    callable.getQuotaUsage.mockResolvedValue({
      data: {
        used: 30,
        limit: 30,
        dayKey: '2026-08-30',
        startMs: Date.parse('2026-08-29T16:00:00.000Z'),
        endMs: Date.parse('2026-08-30T16:00:00.000Z'),
        serverNowMs: Date.parse('2026-08-30T15:59:59.000Z'),
      },
    });
    const readSnapshot = Reflect.get(firebaseService, 'getAiQuotaUsageSnapshot');

    expect(readSnapshot).toBeTypeOf('function');
    await expect(readSnapshot('teacher-1')).resolves.toEqual({
      used: 30,
      limit: 30,
      dayKey: '2026-08-30',
      startMs: Date.parse('2026-08-29T16:00:00.000Z'),
      endMs: Date.parse('2026-08-30T16:00:00.000Z'),
      serverNowMs: Date.parse('2026-08-30T15:59:59.000Z'),
    });
  });

  it('uses the authoritative callable without sending a device-local date boundary', async () => {
    callable.getQuotaUsage.mockResolvedValue({
      data: {
        used: 17,
        limit: 30,
        dayKey: '2026-08-30',
        startMs: Date.parse('2026-08-29T16:00:00.000Z'),
        endMs: Date.parse('2026-08-30T16:00:00.000Z'),
        serverNowMs: Date.parse('2026-08-30T12:00:00.000Z'),
      },
    });
    firestore.getDocs.mockResolvedValue({ docs: [] });

    await expect(getTodayAiGenerationCount('teacher-1')).resolves.toBe(17);
    expect(callable.httpsCallable).toHaveBeenCalledWith(callable.functions, 'getAiQuotaUsage');
    expect(callable.getQuotaUsage).toHaveBeenCalledWith({});
  });

  it('returns the backend legacy-compatible chargeable count unchanged', async () => {
    callable.getQuotaUsage.mockResolvedValue({
      data: {
        used: 3,
        limit: 30,
        dayKey: '2026-08-30',
        startMs: Date.parse('2026-08-29T16:00:00.000Z'),
        endMs: Date.parse('2026-08-30T16:00:00.000Z'),
        serverNowMs: Date.parse('2026-08-30T12:00:00.000Z'),
      },
    });

    const count = await getTodayAiGenerationCount('teacher-1');

    expect(count).toBe(3);
  });
});


describe('point writes on partial or reset day records', () => {
  it('adds a point after a note-only write without losing note or unknown fields', async () => {
    const path = 'users/teacher-1/students/student-1';
    firestore.serverDocs.set(path, { totalScore: 0, dailyRecords: {
      '2026-10-21': { note: '最新備註', marker: 'preserve' },
    }});
    await firebaseService.addPointToStudent('teacher-1', 'student-1', '2026-10-21',
      { points: [], note: 'stale', absence: null }, { label: '努力', value: 1 });
    const data = firestore.serverDocs.get(path) as any;
    expect(data.totalScore).toBe(1);
    expect(data.dailyRecords['2026-10-21']).toMatchObject({ note: '最新備註', marker: 'preserve' });
    expect(data.dailyRecords['2026-10-21'].points).toHaveLength(1);
  });
  it('does not resurrect stale records after a server-side reset', async () => {
    const path = 'users/teacher-1/students/student-1';
    firestore.serverDocs.set(path, { totalScore: 0, dailyRecords: {} });
    await firebaseService.addPointToStudent('teacher-1', 'student-1', '2026-10-21',
      { points: [{ id: 'old', label: 'old', value: 4, timestamp: 1 }], note: 'old', absence: null },
      { label: 'new', value: 1 });
    const data = firestore.serverDocs.get(path) as any;
    expect(data.dailyRecords['2026-10-21'].points).toHaveLength(1);
    expect(data.dailyRecords['2026-10-21'].note).not.toBe('old');
  });
  it('deletes a point while preserving sibling fields and ignores duplicate deletion', async () => {
    const path = 'users/teacher-1/students/student-1';
    firestore.serverDocs.set(path, { totalScore: 1, dailyRecords: {
      '2026-10-21': { points: [{ id: 'p', label: 'new', value: 1, timestamp: 1 }], marker: 'preserve' },
    }});
    const stale = { points: [], note: '', absence: null };
    await firebaseService.deletePointFromStudent('teacher-1', 'student-1', '2026-10-21', stale, 'p', 99);
    await firebaseService.deletePointFromStudent('teacher-1', 'student-1', '2026-10-21', stale, 'p', 99);
    expect(firestore.serverDocs.get(path)).toMatchObject({ totalScore: 0, dailyRecords: {
      '2026-10-21': { marker: 'preserve', points: [] },
    }});
  });
});


it('normalizes note-only and absence-only records for existing UI consumers', () => {
  firestore.onSnapshot.mockImplementation((_ref, callback) => {
    callback({ docs: [{ id: 'student-1', data: () => ({ name: '測試學生', dailyRecords: {
      '2026-10-20': { note: '備註' }, '2026-10-21': { absence: '病假' },
    } }) }] });
    return () => {};
  });
  const callback = vi.fn();
  firebaseService.subscribeToStudents('teacher-1', callback);
  expect(callback.mock.calls[0][0][0].dailyRecords).toEqual({
    '2026-10-20': { points: [], note: '備註', absence: null },
    '2026-10-21': { points: [], note: '', absence: '病假' },
  });
});

describe('legacy client compatibility for first daily writes', () => {
  it.each(['note', 'absence', 'append', 'class'])('creates complete daily shape for %s', async operation => {
    const path = 'users/teacher-1/students/student-1';
    const initial = { id: 'student-1', name: '測試學生', totalScore: 0, tags: [], comment: '', dailyRecords: {} };
    firestore.serverDocs.set(path, initial);
    const empty = { points: [], note: '', absence: null };
    if (operation === 'note') await saveStudentNote('teacher-1', 'student-1', '2026-10-21', empty, '備註');
    if (operation === 'absence') await setStudentAbsence('teacher-1', 'student-1', '2026-10-21', empty, '病假');
    if (operation === 'append') await appendStudentNote('teacher-1', 'student-1', '2026-10-21', '附加');
    if (operation === 'class') await addPointToAllStudents('teacher-1', [initial], '2026-10-21', { label: '努力', value: 1 });
    const record = (firestore.serverDocs.get(path) as any).dailyRecords['2026-10-21'];
    expect(Array.isArray(record.points)).toBe(true);
    expect(typeof record.note).toBe('string');
    expect(record).toHaveProperty('absence');
  });
});
