import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LIGHT_THEME } from '../../constants/theme';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { ToastProvider } from '../../contexts/ToastContext';
import type { Student } from '../../types';

const service = vi.hoisted(() => ({
  addPointToStudent: vi.fn(),
  addPointToAllStudents: vi.fn(),
  deletePointFromStudent: vi.fn(),
  toggleStudentTag: vi.fn(),
  updateStudentComment: vi.fn(),
  saveStudentNote: vi.fn(),
  appendStudentNote: vi.fn(),
  setStudentAbsence: vi.fn(),
  updateCustomBehaviors: vi.fn(),
  updatePrizes: vi.fn(),
  updateClassConfig: vi.fn(),
  logCommentEdit: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('../../services/firebaseService', () => service);
vi.mock('../../services/geminiService', () => ({
  DEFAULT_SYSTEM_INSTRUCTION: 'system prompt',
  generateStudentComment: vi.fn(),
}));
vi.mock('../../hooks/useAiRateLimit', () => ({
  useAiRateLimit: () => ({
    canGenerate: true,
    cooldownRemaining: 0,
    dailyUsageCount: 0,
    dailyLimit: 30,
    isLimitReached: false,
    recordGeneration: vi.fn(),
  }),
}));
vi.mock('../../firebase', () => ({
  auth: { currentUser: { uid: 'teacher-1', email: 'teacher@example.com' } },
}));

import { StudentDetailWorkspace } from '../../components/StudentDetailWorkspace';

const testNow = new Date();
const TODAY = [
  testNow.getFullYear(),
  String(testNow.getMonth() + 1).padStart(2, '0'),
  String(testNow.getDate()).padStart(2, '0'),
].join('-');

function student(id: string, name: string, note: string): Student {
  return {
    id,
    name,
    seatNumber: Number(id.slice(-1)),
    totalScore: 0,
    order: Number(id.slice(-1)),
    dailyRecords: {
      [TODAY]: { points: [], note, absence: null },
    },
    tags: [],
    comment: '',
  };
}

function workspace(currentStudent: Student, students: Student[]) {
  return (
    <ThemeProvider value={LIGHT_THEME}>
      <ToastProvider>
        <StudentDetailWorkspace
          userUid="teacher-1"
          student={currentStudent}
          students={students}
          onBack={vi.fn()}
          classConfig={{ class_board: '' }}
        />
      </ToastProvider>
    </ThemeProvider>
  );
}

async function unlockNoteEditor() {
  fireEvent.click(screen.getByTitle('輔導紀錄'));
  fireEvent.change(screen.getByPlaceholderText('Password'), {
    target: { value: 'teacher-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: '解鎖紀錄' }));
  await waitFor(() => expect(service.verifyPassword).toHaveBeenCalledTimes(1));
  return screen.findByPlaceholderText('請輸入私密觀察紀錄...');
}

describe('StudentDetailWorkspace note privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.verifyPassword.mockReset();
    service.saveStudentNote.mockReset();
    service.appendStudentNote.mockReset();
    service.verifyPassword.mockResolvedValue(undefined);
    service.saveStudentNote.mockResolvedValue(undefined);
    service.appendStudentNote.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('closes and clears the note editor when the selected student changes', async () => {
    const first = student('student-1', '甲生', '甲生原有紀錄');
    const second = student('student-2', '乙生', '乙生原有紀錄');
    const students = [first, second];
    const view = render(workspace(first, students));

    const noteEditor = await unlockNoteEditor();
    fireEvent.change(noteEditor, { target: { value: '甲生尚未儲存的私密內容' } });

    view.rerender(workspace(second, students));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('請輸入私密觀察紀錄...')).not.toBeInTheDocument();
    });
    expect(service.saveStudentNote).not.toHaveBeenCalled();
  });

  it('does not reopen student A note when password verification resolves after switching to B', async () => {
    const first = student('student-1', '甲生', '甲生機密紀錄');
    const second = student('student-2', '乙生', '乙生紀錄');
    const students = [first, second];
    let resolveVerification!: () => void;
    const pendingVerification = new Promise<void>((resolve) => {
      resolveVerification = resolve;
    });
    service.verifyPassword.mockReturnValue(pendingVerification);
    const view = render(workspace(first, students));

    fireEvent.click(screen.getByTitle('輔導紀錄'));
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'teacher-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '解鎖紀錄' }));
    await waitFor(() => expect(service.verifyPassword).toHaveBeenCalledTimes(1));

    view.rerender(workspace(second, students));
    await act(async () => {
      resolveVerification();
      await pendingVerification;
    });

    expect(screen.queryByPlaceholderText('請輸入私密觀察紀錄...')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('甲生機密紀錄')).not.toBeInTheDocument();
    expect(service.saveStudentNote).not.toHaveBeenCalled();
  });

  it('reports only completed note writes when a student switch aborts synchronization', async () => {
    const first = student('student-1', '甲生', '甲生原有紀錄');
    const second = student('student-2', '乙生', '');
    const third = student('student-3', '丙生', '');
    const students = [first, second, third];
    let resolveFirstSync!: () => void;
    const firstSync = new Promise<void>((resolve) => {
      resolveFirstSync = resolve;
    });
    service.appendStudentNote
      .mockReturnValueOnce(firstSync)
      .mockResolvedValue(undefined);
    const view = render(workspace(first, students));

    const noteEditor = await unlockNoteEditor();
    fireEvent.change(noteEditor, { target: { value: '需要同步的私密內容' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));
    await screen.findByText('✅ 已儲存 甲生 的紀錄');
    fireEvent.click(screen.getByRole('button', { name: '全選' }));
    fireEvent.click(screen.getByRole('button', { name: '同步紀錄（2 位）' }));
    await waitFor(() => expect(service.appendStudentNote).toHaveBeenCalledTimes(1));

    view.rerender(workspace(second, students));
    await act(async () => {
      resolveFirstSync();
      await firstSync;
    });

    expect(await screen.findByText('已同步至 1 位學生')).toBeInTheDocument();
    expect(service.saveStudentNote).toHaveBeenCalledTimes(1);
    expect(service.appendStudentNote).toHaveBeenCalledTimes(1);
  });

  it('delegates synchronization to the atomic server-note append boundary', async () => {
    const first = student('student-1', '甲生', '甲生原有紀錄');
    const second = student('student-2', '乙生', '畫面上的乙生舊紀錄');
    const students = [first, second];
    render(workspace(first, students));

    const noteEditor = await unlockNoteEditor();
    fireEvent.change(noteEditor, { target: { value: '這次要同步的私密內容' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));
    await screen.findByText('✅ 已儲存 甲生 的紀錄');
    fireEvent.click(screen.getByRole('button', { name: '全選' }));
    fireEvent.click(screen.getByRole('button', { name: '同步紀錄（1 位）' }));

    await waitFor(() => {
      expect(service.appendStudentNote).toHaveBeenCalledWith(
        'teacher-1',
        'student-2',
        TODAY,
        '這次要同步的私密內容',
      );
    });
    expect(service.saveStudentNote).toHaveBeenCalledTimes(1);
  });
});
