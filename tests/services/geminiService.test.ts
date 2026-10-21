import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Student } from '../../types';
const callable = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('../../firebase', () => ({ functions: {} }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => callable.generate }));
import { generateStudentComment } from '../../services/geminiService';
const student: Student = { id: 's1', name: '測試學生', totalScore: 0, dailyRecords: {}, tags: [], comment: '原評語' };
beforeEach(() => { callable.generate.mockReset(); });
describe('AI results are successful text or rejected errors', () => {
  it.each(['functions/resource-exhausted', 'functions/unauthenticated', 'functions/invalid-argument',
    'functions/deadline-exceeded', 'functions/internal', 'unavailable'])('rejects %s instead of returning a savable comment', async code => {
    callable.generate.mockRejectedValue(Object.assign(new Error('provider failure'), { code }));
    await expect(generateStudentComment(student)).rejects.toThrow();
  });
  it.each(['', '   ', null, 123])('rejects invalid successful payload %s', async text => {
    callable.generate.mockResolvedValue({ data: { text } });
    await expect(generateStudentComment(student)).rejects.toThrow();
  });
  it('returns a valid comment', async () => {
    callable.generate.mockResolvedValue({ data: { text: '努力學習，值得肯定。' } });
    await expect(generateStudentComment(student)).resolves.toBe('努力學習，值得肯定。');
  });
});
