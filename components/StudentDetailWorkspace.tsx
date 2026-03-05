import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronLeft, Sparkles, Save, Trash2, ClipboardList,
  Smile, Frown, School, Clock, Settings, Copy, AlignLeft,
  Check, Lock, Download, BookX, Users, HelpCircle, Gift
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { formatDate } from '../utils/date';
import { levenshteinDistance } from '../utils/levenshtein';
import {
  addPointToStudent,
  addPointToAllStudents,
  deletePointFromStudent,
  toggleStudentTag,
  updateStudentComment,
  saveStudentNote,
  setStudentAbsence,
  updateCustomBehaviors,
  updatePrizes,
  updateClassConfig,
  logAiGeneration,
  logCommentEdit,
  verifyPassword,
} from '../services/firebaseService';
import { generateStudentComment, DEFAULT_SYSTEM_INSTRUCTION } from '../services/geminiService';
import { Modal } from './ui/Modal';
import { WeeklyCalendar } from './WeeklyCalendar';
import { BehaviorEditor } from './BehaviorEditor';
import { PrizeEditor } from './PrizeEditor';
import {
  Student,
  ClassConfig,
  PointLog,
  BehaviorButton,
  DEFAULT_POSITIVE_BEHAVIORS,
  DEFAULT_NEGATIVE_BEHAVIORS,
  EVALUATION_CATEGORIES,
  AbsenceType,
  ABSENCE_TYPES,
  PrizeItem,
  DEFAULT_PRIZES,
} from '../types';
import { auth } from '../firebase';
import { useAiRateLimit } from '../hooks/useAiRateLimit';

export const StudentDetailWorkspace = ({
  userUid,
  student,
  students,
  onBack,
  classConfig,
  onConfigUpdate,
}: {
  userUid: string;
  student: Student;
  students: Student[];
  onBack: () => void;
  classConfig: ClassConfig;
  onConfigUpdate?: (config: ClassConfig) => void;
}) => {
  const theme = useTheme();
  const { canGenerate, cooldownRemaining, dailyUsageCount, dailyLimit, isLimitReached, recordGeneration } = useAiRateLimit({ userUid });
  const [mode, setMode] = useState<'daily' | 'ai'>('daily');
  const [mobileTab, setMobileTab] = useState<'record' | 'scoring'>('scoring');
  const [calendarViewMode, setCalendarViewMode] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(formatDate(new Date()));

  // Note & Security State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [tempNote, setTempNote] = useState('');
  const [noteSyncMode, setNoteSyncMode] = useState(false);
  const [syncTargetIds, setSyncTargetIds] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [verifyPasswordVal, setVerifyPasswordVal] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingAction, setPendingAction] = useState<'notes' | 'export'>('notes');

  // Behavior Settings Modal
  const [isBehaviorSettingsOpen, setIsBehaviorSettingsOpen] = useState(false);

  // Export CSV State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFields, setExportFields] = useState({
    behaviorDetail: true,
    dailyScore: true,
    note: false,
    aiComment: true,
    tags: true,
    totalScore: true,
  });

  const escapeCsvValue = (val: string): string => {
    if (val.includes(',') || val.includes('\n') || val.includes('"')) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  };

  const handleExportCsv = () => {
    const headers = ['座號', '姓名', '日期'];
    if (exportFields.behaviorDetail) headers.push('行為紀錄明細');
    if (exportFields.dailyScore) headers.push('當日得分');
    if (exportFields.note) headers.push('輔導備註');
    if (exportFields.aiComment) headers.push('AI 評語');
    if (exportFields.tags) headers.push('特質標籤');
    if (exportFields.totalScore) headers.push('累計總分');

    const rows: string[][] = [];

    const sortedStudents = [...students].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    for (const s of sortedStudents) {
      const dates = Object.keys(s.dailyRecords).sort();
      let isFirstRow = true;
      for (const date of dates) {
        const record = s.dailyRecords[date];
        const hasPoints = record.points.length > 0;
        const hasNote = record.note && record.note.trim().length > 0;
        if (!hasPoints && !hasNote) continue;

        const row: string[] = [
          String(s.seatNumber ?? (s.order ?? 0) + 1),
          s.name,
          date,
        ];

        if (exportFields.behaviorDetail) {
          const groups: Record<string, { label: string; value: number; count: number }> = {};
          record.points.forEach(p => {
            if (!groups[p.label]) groups[p.label] = { label: p.label, value: p.value, count: 0 };
            groups[p.label].count += 1;
          });
          const detail = Object.values(groups)
            .map(g => `${g.label}(${g.value > 0 ? '+' : ''}${g.value})×${g.count}`)
            .join(', ');
          row.push(detail);
        }

        if (exportFields.dailyScore) {
          const score = record.points.reduce((sum, p) => sum + p.value, 0);
          row.push(String(score));
        }

        if (exportFields.note) {
          row.push(record.note || '');
        }

        if (exportFields.aiComment) {
          row.push(isFirstRow ? (s.comment || '') : '');
        }

        if (exportFields.tags) {
          row.push(isFirstRow ? s.tags.join(', ') : '');
        }

        if (exportFields.totalScore) {
          row.push(isFirstRow ? String(s.totalScore) : '');
        }

        rows.push(row);
        isFirstRow = false;
      }
    }

    const csvContent = '\uFEFF' +
      headers.map(escapeCsvValue).join(',') + '\n' +
      rows.map(row => row.map(escapeCsvValue).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = formatDate(new Date());
    a.href = url;
    a.download = `班級紀錄_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
  };

  const positiveBehaviors = classConfig.customBehaviors?.positive || DEFAULT_POSITIVE_BEHAVIORS;
  const negativeBehaviors = classConfig.customBehaviors?.negative || DEFAULT_NEGATIVE_BEHAVIORS;
  const prizes = classConfig.prizes || DEFAULT_PRIZES;
  const prizeShopEnabled = classConfig.prizeShopEnabled ?? false;

  const handleUpdateBehaviors = async (type: 'positive' | 'negative', newBtns: BehaviorButton[]) => {
    const newConfig = await updateCustomBehaviors(
      userUid, classConfig, type, newBtns, positiveBehaviors, negativeBehaviors
    );
    if (onConfigUpdate) onConfigUpdate(newConfig);
  };

  const handleUpdatePrizes = async (newPrizes: PrizeItem[]) => {
    const newConfig = await updatePrizes(userUid, classConfig, newPrizes);
    if (onConfigUpdate) onConfigUpdate(newConfig);
  };

  const handleRedeemPrize = (prize: PrizeItem) => {
    handleAddPoint({ id: prize.id, label: `🎁 ${prize.label}`, value: -prize.cost });
  };

  const handleTogglePrizeShop = async () => {
    const newConfig = { ...classConfig, prizeShopEnabled: !prizeShopEnabled };
    await updateClassConfig(userUid, newConfig);
    if (onConfigUpdate) onConfigUpdate(newConfig);
  };

  const [isClassMode, setIsClassMode] = useState(false);

  const absentCount = useMemo(() =>
    students.filter(s => s.dailyRecords[currentDate]?.absence).length,
    [students, currentDate]
  );
  const targetCount = students.length - absentCount;

  const handleAddPoint = async (behavior: BehaviorButton) => {
    if (isClassMode) {
      const msg = absentCount > 0
        ? `確定為全班 ${targetCount} 位同學（排除 ${absentCount} 位請假）加「${behavior.label}」(${behavior.value > 0 ? '+' : ''}${behavior.value})？`
        : `確定為全班 ${targetCount} 位同學加「${behavior.label}」(${behavior.value > 0 ? '+' : ''}${behavior.value})？`;
      if (!window.confirm(msg)) return;
      await addPointToAllStudents(userUid, students, currentDate, behavior);
    } else {
      const currentDayRecord = student.dailyRecords[currentDate] || { points: [], note: '', absence: null };
      await addPointToStudent(userUid, student.id, currentDate, currentDayRecord, behavior);
    }
  };

  const handleDeleteGroup = async (label: string) => {
    const currentDayRecord = student.dailyRecords[currentDate];
    if (!currentDayRecord) return;

    const reversedPoints = [...currentDayRecord.points].reverse();
    const targetIndexInReversed = reversedPoints.findIndex(p => p.label === label);

    if (targetIndexInReversed !== -1) {
      const targetPoint = reversedPoints[targetIndexInReversed];
      await deletePointFromStudent(
        userUid, student.id, currentDate, currentDayRecord, targetPoint.id, targetPoint.value
      );
    }
  };

  // --- Secure Verification Logic ---
  const handleVerifyPassword = async () => {
    if (!auth.currentUser) return;
    setIsVerifying(true);
    setVerifyError('');
    try {
      await verifyPassword(auth.currentUser, verifyPasswordVal);
      setShowPasswordModal(false);
      setVerifyPasswordVal('');
      if (pendingAction === 'export') {
        setIsExportModalOpen(true);
      } else {
        const currentDayRecord = student.dailyRecords[currentDate] || { points: [], note: '', absence: null };
        setTempNote(currentDayRecord.note || '');
        setIsNoteModalOpen(true);
      }
    } catch {
      setVerifyError('密碼錯誤');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveNote = async () => {
    const currentDayRecord = student.dailyRecords[currentDate] || { points: [], note: '', absence: null };
    await saveStudentNote(userUid, student.id, currentDate, currentDayRecord, tempNote);
    setNoteSyncMode(true);
  };

  const handleCloseNoteModal = () => {
    setIsNoteModalOpen(false);
    setNoteSyncMode(false);
    setSyncTargetIds(new Set());
  };

  const handleSyncNote = async () => {
    setIsSyncing(true);
    for (const targetId of syncTargetIds) {
      const target = students.find(s => s.id === targetId);
      if (!target) continue;
      const targetDayRecord = target.dailyRecords[currentDate] || { points: [], note: '', absence: null };
      const existingNote = targetDayRecord.note?.trim() || '';
      const mergedNote = existingNote
        ? `${existingNote}\n---\n${tempNote}`
        : tempNote;
      await saveStudentNote(userUid, targetId, currentDate, targetDayRecord, mergedNote);
    }
    setIsSyncing(false);
    setNoteSyncMode(false);
    setSyncTargetIds(new Set());
    setIsNoteModalOpen(false);
  };

  const todayAbsence = (student.dailyRecords[currentDate] || { absence: null }).absence ?? null;
  const [isAbsenceExpanded, setIsAbsenceExpanded] = useState(false);

  const handleSetAbsence = async (type: AbsenceType) => {
    const currentDayRecord = student.dailyRecords[currentDate] || { points: [], note: '', absence: null };
    const newAbsence = todayAbsence === type ? null : type;
    await setStudentAbsence(userUid, student.id, currentDate, currentDayRecord, newAbsence);
    setIsAbsenceExpanded(false);
  };

  // --- AI Logic ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [tempComment, setTempComment] = useState(student.comment);
  const [commentLength, setCommentLength] = useState<number>(100);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [originalAiText, setOriginalAiText] = useState(student.originalAiComment || "");
  const [isCopied, setIsCopied] = useState(false);
  const [activeEvaluationTab, setActiveEvaluationTab] = useState(0);
  const [generationStage, setGenerationStage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (typingRef.current) { clearInterval(typingRef.current); typingRef.current = null; }
    if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null; }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const prevStudentId = useRef(student.id);
  useEffect(() => {
    if (prevStudentId.current !== student.id) {
      setTempComment(student.comment);
      setOriginalAiText(student.originalAiComment || '');
      prevStudentId.current = student.id;
    }
  }, [student.id, student.comment, student.originalAiComment]);

  const handleToggleTag = async (tag: string) => {
    await toggleStudentTag(userUid, student.id, tag, student.tags);
  };

  const PROGRESS_MESSAGES = [
    '收集學生資料中...',
    'AI 正在分析行為紀錄...',
    '撰寫評語中，請稍候...',
    '仍在努力生成中...',
  ];

  const handleGenerateAI = async () => {
    clearTimers();
    setIsGenerating(true);
    setTempComment('');
    setGenerationStage(PROGRESS_MESSAGES[0]);

    // Rotate progress messages every 3 seconds
    let stageIndex = 0;
    progressRef.current = setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, PROGRESS_MESSAGES.length - 1);
      setGenerationStage(PROGRESS_MESSAGES[stageIndex]);
    }, 3000);

    try {
      const generatedText = await generateStudentComment(student, "", commentLength, customPrompt);

      // Stop progress, start typewriter
      clearTimers();
      setGenerationStage('');
      setIsGenerating(false);
      setIsTyping(true);

      let charIndex = 0;
      await new Promise<void>((resolve) => {
        typingRef.current = setInterval(() => {
          charIndex++;
          setTempComment(generatedText.slice(0, charIndex));
          if (charIndex >= generatedText.length) {
            if (typingRef.current) clearInterval(typingRef.current);
            typingRef.current = null;
            resolve();
          }
        }, 30);
      });

      setIsTyping(false);
      setOriginalAiText(generatedText);
      await updateStudentComment(userUid, student.id, generatedText, generatedText);
      await logAiGeneration(userUid, student.id, commentLength, !!customPrompt);
      recordGeneration();
    } catch (err: unknown) {
      clearTimers();
      setGenerationStage('');
      setIsTyping(false);
      setIsGenerating(false);
      const msg = err instanceof Error ? err.message : '未知錯誤';
      alert("生成失敗: " + msg);
    }
  };

  const handleSaveComment = async () => {
    await updateStudentComment(userUid, student.id, tempComment);
    if (originalAiText && tempComment) {
      const distance = levenshteinDistance(originalAiText, tempComment);
      await logCommentEdit(userUid, student.id, {
        type: 'comment_edit',
        originalLength: originalAiText.length,
        finalLength: tempComment.length,
        editDistance: distance,
        lengthSetting: commentLength
      });
    }
  };

  const handleCopyComment = async () => {
    await navigator.clipboard.writeText(tempComment);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);

    if (tempComment !== student.comment) {
      await handleSaveComment();
    } else if (originalAiText) {
      const distance = levenshteinDistance(originalAiText, tempComment);
      await logCommentEdit(userUid, student.id, {
        type: 'comment_copy',
        originalLength: originalAiText.length,
        finalLength: tempComment.length,
        editDistance: distance,
        lengthSetting: commentLength
      });
    }
  };

  const dayRecord = student.dailyRecords[currentDate] || { points: [], note: '', absence: null };
  const hasNote = dayRecord.note && dayRecord.note.trim().length > 0;

  // Grouping logic for points
  const groupPoints = (points: PointLog[]) => {
    const groups: Record<string, { label: string; count: number; totalValue: number; singleValue: number }> = {};
    points.forEach(p => {
      if (!groups[p.label]) {
        groups[p.label] = { label: p.label, count: 0, totalValue: 0, singleValue: p.value };
      }
      groups[p.label].count += 1;
      groups[p.label].totalValue += p.value;
    });
    return Object.values(groups);
  };

  const positiveGroups = groupPoints(dayRecord.points.filter(p => p.value > 0));
  const prizeGroups = groupPoints(dayRecord.points.filter(p => p.value < 0 && p.label.startsWith('🎁')));
  const negativeGroups = groupPoints(dayRecord.points.filter(p => p.value < 0 && !p.label.startsWith('🎁')));

  return (
    <>
      <div className={`flex flex-col h-full ${theme.surface} rounded-3xl overflow-hidden`}>
        <div className={`flex flex-col lg:flex-row lg:flex-nowrap lg:items-center lg:justify-between gap-2 lg:gap-3 p-3 pl-14 lg:p-6 border-b ${theme.border} z-20 shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 lg:gap-4">
              <button onClick={onBack} className={`p-2 hover:${theme.surfaceAlt} rounded-full lg:hidden ${theme.text}`}><ChevronLeft className="w-5 h-5" /></button>
              <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full ${theme.primary} text-white flex items-center justify-center font-bold text-base shadow-sm`}>{student.seatNumber ?? student.order ?? '?'}</div>
              <div>
                <h2 className={`text-lg lg:text-2xl font-bold ${theme.text}`}>{student.name}</h2>
                {/* 桌面端：總積分在姓名下方 */}
                <div className={`hidden lg:flex text-sm lg:text-base ${theme.textLight} items-center gap-2`}>
                  總積分 <span className={`px-2 py-0.5 rounded-lg text-sm font-bold ${student.totalScore >= 0 ? `${theme.accentPositive} text-white` : `${theme.accentNegative} text-white`}`}>{student.totalScore > 0 ? '+' : ''}{student.totalScore}</span>
                </div>
              </div>
            </div>
            {/* 手機端：總積分在右側 */}
            <div className={`flex lg:hidden items-center gap-1.5 text-sm ${theme.textLight}`}>
              總積分 <span className={`px-2 py-0.5 rounded-lg text-sm font-bold ${student.totalScore >= 0 ? `${theme.accentPositive} text-white` : `${theme.accentNegative} text-white`}`}>{student.totalScore > 0 ? '+' : ''}{student.totalScore}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 lg:gap-2 flex-nowrap overflow-x-auto">
            {/* 今日請假 */}
            <div className={`flex items-center gap-1 ${theme.surfaceAlt} p-1.5 rounded-xl`}>
              {!isAbsenceExpanded ? (
                todayAbsence ? (
                  <button
                    onClick={() => handleSetAbsence(todayAbsence)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${theme.primary} text-white shadow`}
                    title="點擊取消請假"
                  >
                    <BookX className="w-4 h-4" />
                    <span>{todayAbsence}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsAbsenceExpanded(true)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${theme.textLight} hover:${theme.text}`}
                  >
                    <BookX className="w-4 h-4" />
                    <span>假</span>
                  </button>
                )
              ) : (
                <>
                  <BookX className={`w-4 h-4 ${theme.textLight} ml-1 shrink-0`} />
                  {ABSENCE_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => handleSetAbsence(type)}
                      className={`px-2 py-1.5 lg:px-2.5 text-xs font-bold rounded-lg transition-all animate-fade-in
                        ${todayAbsence === type
                          ? `${theme.primary} text-white shadow`
                          : `${theme.textLight} hover:${theme.text}`
                        }`}
                    >
                      <span className="lg:hidden">{type[0]}</span>
                      <span className="hidden lg:inline">{type}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
            <button
              onClick={() => { setPendingAction('notes'); setShowPasswordModal(true); }}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl ${theme.surfaceAlt} ${theme.textLight} hover:${theme.text} transition text-sm font-bold`}
              title="輔導紀錄"
            >
              {hasNote ? <Check className={`w-4 h-4 ${theme.primaryText}`} /> : <Lock className="w-4 h-4" />}
              <span className="hidden lg:inline">輔導紀錄</span>
            </button>
            <div className={`flex ${theme.surfaceAlt} p-1.5 rounded-xl`}>
              <button onClick={() => setMode('daily')} className={`px-3 py-1.5 lg:px-5 lg:py-2 text-sm font-bold rounded-lg transition flex items-center gap-1 ${mode === 'daily' ? `${theme.surface} ${theme.text} shadow-sm` : `${theme.textLight} hover:${theme.text}`}`}><ClipboardList className="w-4 h-4 lg:hidden" /><span className="hidden lg:inline">日常紀錄</span></button>
              <button onClick={() => setMode('ai')} className={`px-3 py-1.5 lg:px-5 lg:py-2 text-sm font-bold rounded-lg transition flex items-center gap-1 ${mode === 'ai' ? `${theme.surface} ${theme.text} shadow-sm` : `${theme.textLight} hover:${theme.text}`}`}><Sparkles className="w-4 h-4" /><span className="hidden lg:inline">AI 評語</span></button>
            </div>
            <a
              href="https://ai-classmate.com/guide/"
              target="_blank"
              rel="noopener noreferrer"
              title="操作教學"
              className={`p-2.5 rounded-xl ${theme.surfaceAlt} ${theme.textLight} hover:${theme.text} transition`}
            >
              <HelpCircle className="w-5 h-5" />
            </a>
            <button
              onClick={() => { setPendingAction('export'); setShowPasswordModal(true); }}
              className={`p-2.5 rounded-xl ${theme.surfaceAlt} ${theme.textLight} hover:${theme.text} transition`}
              title="匯出整班紀錄"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden">
          {mode === 'daily' ? (
            <div className="flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden">
              <div
                className={`flex-1 flex flex-col lg:!grid border-r ${theme.border} ${theme.bg} p-3 lg:p-6 h-auto lg:h-full lg:overflow-hidden shrink-0`}
                style={{
                  gridTemplateRows: calendarViewMode === 'month' ? '1fr 0fr' : 'auto 1fr',
                  transition: 'grid-template-rows 400ms ease-in-out',
                }}
              >
                <div className="shrink-0 mb-3 lg:mb-0 lg:min-h-0">
                  <WeeklyCalendar currentDate={currentDate} onDateSelect={setCurrentDate} student={student} onViewModeChange={setCalendarViewMode} />
                </div>

                <div className={`flex ${theme.surfaceAlt} p-1.5 rounded-xl mb-3 lg:hidden`}>
                  <button
                    onClick={() => setMobileTab('record')}
                    className={`flex-1 px-3 py-1.5 text-sm font-bold rounded-lg transition flex items-center justify-center gap-1.5
                      ${mobileTab === 'record' ? `${theme.surface} ${theme.text} shadow-sm` : `${theme.textLight}`}`}
                  >
                    <ClipboardList className="w-4 h-4" /> 當日紀錄
                  </button>
                  <button
                    onClick={() => setMobileTab('scoring')}
                    className={`flex-1 px-3 py-1.5 text-sm font-bold rounded-lg transition flex items-center justify-center gap-1.5
                      ${mobileTab === 'scoring' ? `${theme.surface} ${theme.text} shadow-sm` : `${theme.textLight}`}`}
                  >
                    <Clock className="w-4 h-4" /> 快速計分板
                  </button>
                </div>

                <div className={`flex-1 flex flex-col min-h-[400px] lg:min-h-0 lg:overflow-hidden ${mobileTab !== 'record' ? 'hidden lg:flex' : ''}`}>
                  <h3 className={`font-bold ${theme.text} mb-2 shrink-0`}>當日紀錄</h3>
                  <div className={`flex-1 grid ${prizeShopEnabled ? 'grid-cols-3' : 'grid-cols-2'} gap-3 lg:gap-4 min-h-0`}>
                    <div className={`rounded-2xl p-3 lg:p-4 border ${theme.border} ${theme.surface} h-fit`}>
                      <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme.text}`}><div className={`w-2 h-2 rounded-full ${theme.accentPositive}`}></div> 正面表現</h4>
                      <div className="space-y-2">
                        {positiveGroups.map((group, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleDeleteGroup(group.label)}
                            className={`w-full ${theme.surfaceAlt} p-2 lg:p-3 rounded-xl border ${theme.border} flex justify-between items-center group animate-pop-in hover:border-${theme.primary} transition-all duration-75 relative active:scale-95 transform`}
                            title="點擊刪除一筆"
                          >
                            <span className={`font-bold text-sm ${theme.text}`}>{group.label}</span>
                            <div className="flex items-center gap-2">
                              <div className={`px-2 py-0.5 rounded-md text-xs font-bold bg-[#a8b7ab]/20 text-[#5a6b5d]`}>×{group.count}</div>
                              <span className="text-[#a8b7ab] font-bold">+{group.totalValue}</span>
                            </div>
                            <div className="absolute inset-0 bg-[#c48a8a]/90 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-xs backdrop-blur-sm">
                              <Trash2 className="w-4 h-4 mr-1" /> 刪除一筆
                            </div>
                          </button>
                        ))}
                        {positiveGroups.length === 0 && <div className={`text-center py-4 text-xs ${theme.textLight}`}>無紀錄</div>}
                      </div>
                    </div>

                    <div className={`rounded-2xl p-3 lg:p-4 border ${theme.border} ${theme.surface} h-fit`}>
                      <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme.text}`}><div className={`w-2 h-2 rounded-full ${theme.accentNegative}`}></div> 待改進</h4>
                      <div className="space-y-2">
                        {negativeGroups.map((group, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleDeleteGroup(group.label)}
                            className={`w-full ${theme.surfaceAlt} p-2 lg:p-3 rounded-xl border ${theme.border} flex justify-between items-center group animate-pop-in hover:border-${theme.accentNegative} transition-all duration-75 relative active:scale-95 transform`}
                            title="點擊刪除一筆"
                          >
                            <span className={`font-bold text-sm ${theme.text}`}>{group.label}</span>
                            <div className="flex items-center gap-2">
                              <div className={`px-2 py-0.5 rounded-md text-xs font-bold bg-[#c48a8a]/20 text-[#8f5e5e]`}>×{group.count}</div>
                              <span className="text-[#c48a8a] font-bold">{group.totalValue}</span>
                            </div>
                            <div className="absolute inset-0 bg-[#c48a8a]/90 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-xs backdrop-blur-sm">
                              <Trash2 className="w-4 h-4 mr-1" /> 刪除一筆
                            </div>
                          </button>
                        ))}
                        {negativeGroups.length === 0 && <div className={`text-center py-4 text-xs ${theme.textLight}`}>無紀錄</div>}
                      </div>
                    </div>

                    {prizeShopEnabled && (
                      <div className={`rounded-2xl p-3 lg:p-4 border ${theme.border} ${theme.surface} h-fit`}>
                        <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme.text}`}><Gift className="w-3.5 h-3.5 text-amber-500" /> 積分兌換</h4>
                        <div className="space-y-2">
                          {prizeGroups.map((group, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleDeleteGroup(group.label)}
                              className={`w-full ${theme.surfaceAlt} p-2 lg:p-3 rounded-xl border ${theme.border} flex justify-between items-center group animate-pop-in transition-all duration-75 relative active:scale-95 transform`}
                              title="點擊刪除一筆"
                            >
                              <span className={`font-bold text-sm ${theme.text}`}>{group.label.replace('🎁 ', '')}</span>
                              <div className="flex items-center gap-2">
                                <div className={`px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-700`}>×{group.count}</div>
                                <span className="text-amber-600 font-bold">{group.totalValue}</span>
                              </div>
                              <div className="absolute inset-0 bg-[#c48a8a]/90 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-xs backdrop-blur-sm">
                                <Trash2 className="w-4 h-4 mr-1" /> 刪除一筆
                              </div>
                            </button>
                          ))}
                          {prizeGroups.length === 0 && <div className={`text-center py-4 text-xs ${theme.textLight}`}>無兌換</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={`w-full lg:w-96 flex flex-col gap-3 lg:gap-4 p-3 lg:p-6 shrink-0 h-auto lg:h-full lg:overflow-y-auto lg:border-l ${theme.border} ${theme.surfaceAlt} ${mobileTab !== 'scoring' ? 'hidden lg:flex' : ''}`}>
                <div className={`${theme.surface} p-4 rounded-2xl border ${theme.border} shadow-sm flex items-center justify-between`}>
                  <h3 className={`text-sm font-bold ${theme.textLight} uppercase tracking-wide flex items-center gap-2`}>
                    <Clock className="w-4 h-4" /> 快速記分板
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsClassMode(prev => !prev)}
                      className={`p-2 rounded-lg transition flex items-center gap-1.5 text-xs font-bold
                        ${isClassMode
                          ? `${theme.primary} text-white shadow`
                          : `hover:${theme.surfaceAlt} ${theme.textLight}`
                        }`}
                      title={isClassMode ? '目前：全班加分模式' : '切換為全班加分'}
                    >
                      <Users className="w-4 h-4" />
                      <span className="hidden lg:inline">{isClassMode ? '全班' : ''}</span>
                    </button>
                    <button onClick={() => setIsBehaviorSettingsOpen(true)} className={`p-2 rounded-lg hover:${theme.surfaceAlt} ${theme.textLight} transition`} title="自訂按鈕">
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {isClassMode && (
                  <div className={`px-3 py-2 rounded-xl text-xs font-bold text-center ${theme.primary} text-white`}>
                    全班加分模式：{absentCount > 0
                      ? `將為 ${targetCount} 位到校同學加分（${absentCount} 位請假排除）`
                      : `將為全班 ${students.length} 位同學加分`}
                  </div>
                )}

                <div className={`${theme.surface} p-3 lg:p-5 rounded-2xl border ${theme.border} shadow-sm`}>
                  <label className={`text-sm font-bold ${theme.primaryText} mb-4 flex items-center gap-2`}><Smile className="w-4 h-4" /> 正面表現</label>
                  <div className="grid grid-cols-2 gap-2 lg:gap-3">
                    {positiveBehaviors.map((btn) => (
                      <button key={btn.id} onClick={() => handleAddPoint(btn)}
                        className={`flex flex-col items-center justify-center p-3 lg:p-4 rounded-2xl border ${theme.border} ${theme.surfaceAlt} hover:${theme.primary} hover:text-white hover:border-transparent hover:shadow-lg hover:-translate-y-1 transition-all duration-200 active:scale-95 group relative overflow-hidden active-shrink`}
                      >
                        <span className={`text-[1.5em] font-bold mb-1 ${theme.text} group-hover:text-white`}>+{btn.value}</span>
                        <span className={`text-[0.85em] font-medium ${theme.textLight} group-hover:text-white/90`}>{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`${theme.surface} p-3 lg:p-5 rounded-2xl border ${theme.border} shadow-sm`}>
                  <label className={`text-sm font-bold ${theme.accentNegativeText} mb-4 flex items-center gap-2`}><Frown className="w-4 h-4" /> 待改進</label>
                  <div className="grid grid-cols-2 gap-2 lg:gap-3">
                    {negativeBehaviors.map((btn) => (
                      <button key={btn.id} onClick={() => handleAddPoint(btn)}
                        className={`flex flex-col items-center justify-center p-3 lg:p-4 rounded-2xl border ${theme.border} ${theme.surfaceAlt} hover:${theme.accentNegative} hover:text-white hover:border-transparent hover:shadow-lg hover:-translate-y-1 transition-all duration-200 active:scale-95 group relative overflow-hidden active-shrink`}
                      >
                        <span className={`text-[1.5em] font-bold mb-1 ${theme.text} group-hover:text-white`}>{btn.value}</span>
                        <span className={`text-[0.85em] font-medium ${theme.textLight} group-hover:text-white/90`}>{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {prizeShopEnabled && prizes.length > 0 && (
                  <div className={`${theme.surface} p-3 lg:p-5 rounded-2xl border ${theme.border} shadow-sm`}>
                    <label className={`text-sm font-bold ${theme.textLight} mb-4 flex items-center gap-2`}><Gift className="w-4 h-4 text-amber-500" /> 積分商店</label>
                    <div className="grid grid-cols-2 gap-2 lg:gap-3">
                      {prizes.map((prize) => (
                        <button key={prize.id} onClick={() => handleRedeemPrize(prize)}
                          className={`flex flex-col items-center justify-center p-3 lg:p-4 rounded-2xl border ${theme.border} ${theme.surfaceAlt} hover:bg-amber-500 hover:text-white hover:border-transparent hover:shadow-lg hover:-translate-y-1 transition-all duration-200 active:scale-95 group relative overflow-hidden active-shrink`}
                        >
                          <span className={`text-[1.5em] font-bold mb-1 ${theme.text} group-hover:text-white`}>-{prize.cost}</span>
                          <span className={`text-[0.85em] font-medium ${theme.textLight} group-hover:text-white/90`}>{prize.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // AI Mode View
            <div className="flex flex-col h-full overflow-y-auto p-3 lg:p-12 max-w-6xl mx-auto w-full">
              <div className="grid lg:grid-cols-2 gap-4 lg:gap-8 h-full">
                <div className="space-y-4 lg:space-y-8">
                  <div className={`${theme.surface} p-4 lg:p-8 rounded-3xl shadow-sm border ${theme.border}`}>
                    <h3 className={`text-base lg:text-xl font-bold ${theme.text} mb-4 flex items-center gap-3`}><div className={`p-2 rounded-xl ${theme.primary} text-white`}><ClipboardList className="w-5 h-5" /></div> 特質標籤</h3>

                    {/* Tabs */}
                    <div className="flex gap-2 mb-4">
                      {EVALUATION_CATEGORIES.map((cat, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveEvaluationTab(idx)}
                          className={`flex-1 px-2 py-2 rounded-xl text-sm font-bold transition text-center
                            ${activeEvaluationTab === idx
                              ? `${theme.primary} text-white shadow-md`
                              : `${theme.surfaceAlt} ${theme.textLight} hover:${theme.text}`
                            }
                          `}
                        >
                          {cat.title}
                        </button>
                      ))}
                    </div>

                    {/* Content Area for Active Tab */}
                    <div className={`p-5 rounded-2xl border ${theme.border} ${theme.surfaceAlt} mb-6`}>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h4 className={`text-sm font-bold ${theme.text} mb-3 flex items-center gap-2`}>
                            <div className={`w-2 h-2 rounded-full ${theme.accentPositive}`}></div> 正向特質
                          </h4>
                          <div className="grid grid-cols-2 gap-1.5">
                            {EVALUATION_CATEGORIES[activeEvaluationTab]?.positive.map(tag => (
                              <button
                                key={tag}
                                onClick={() => handleToggleTag(tag)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border-2 w-full text-center
                                    ${student.tags.includes(tag)
                                    ? `${theme.primary} border-${theme.primary} text-white shadow-md transform scale-105`
                                    : `border-transparent ${theme.surfaceAccent} ${theme.text} hover:border-${theme.primary}`
                                  }
                                  `}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className={`text-sm font-bold ${theme.text} mb-3 flex items-center gap-2`}>
                            <div className={`w-2 h-2 rounded-full ${theme.accentNegative}`}></div> 待改進
                          </h4>
                          <div className="grid grid-cols-2 gap-1.5">
                            {EVALUATION_CATEGORIES[activeEvaluationTab]?.negative.map(tag => (
                              <button
                                key={tag}
                                onClick={() => handleToggleTag(tag)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border-2 w-full text-center
                                    ${student.tags.includes(tag)
                                    ? `${theme.accentNegative} border-${theme.accentNegative} text-white shadow-md transform scale-105`
                                    : `border-transparent ${theme.surfaceAccent} ${theme.text} hover:border-${theme.accentNegative}`
                                  }
                                  `}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <h3 className={`text-sm font-bold ${theme.text} mb-3 flex items-center gap-2`}><AlignLeft className="w-4 h-4" /> 生成字數設定</h3>
                    <div className={`grid grid-cols-4 gap-2 p-1 ${theme.surfaceAlt} rounded-xl mb-6`}>
                      {([50, 100, 150, 200] as const).map((len) => (
                        <button key={len} onClick={() => setCommentLength(len)} className={`py-2 text-sm font-bold rounded-lg transition ${commentLength === len ? `${theme.surface} ${theme.text} shadow-sm border ${theme.border}` : `${theme.textLight} hover:${theme.text}`}`}>
                          {len}字
                        </button>
                      ))}
                    </div>

                  </div>

                  <div className={`${theme.inputBg} p-4 lg:p-6 rounded-3xl border ${theme.border} relative overflow-hidden`}>
                    <div className="relative z-10">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className={`text-base lg:text-xl font-bold ${theme.text}`}>準備生成</h3>
                        <button onClick={() => setIsPromptModalOpen(true)} className={`p-2 rounded-lg ${theme.surfaceAlt} ${theme.textLight} hover:${theme.text} hover:bg-[rgba(0,0,0,0.05)] transition flex items-center gap-2 text-xs font-bold`}>
                          <Settings className="w-4 h-4" /> 自訂提示詞 Prompt
                        </button>
                      </div>
                      <p className={`text-base ${theme.textLight} mb-6`}>系統將讀取該生所有資料作為 AI 上下文。</p>
                      <button onClick={handleGenerateAI} disabled={isGenerating || isTyping || !canGenerate} className={`w-full py-4 ${theme.primary} text-white rounded-2xl font-bold shadow-lg hover:opacity-90 hover:shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2 transform hover:-translate-y-0.5`}>
                        {isGenerating ? (
                          <><Sparkles className="w-5 h-5 animate-spin" /> 生成評語中...</>
                        ) : isTyping ? (
                          <><Sparkles className="w-5 h-5 animate-spin" /> 輸出中...</>
                        ) : isLimitReached ? (
                          <><Sparkles className="w-5 h-5" /> 今日已達上限 ({dailyUsageCount}/{dailyLimit})</>
                        ) : cooldownRemaining > 0 ? (
                          <><Sparkles className="w-5 h-5" /> 冷卻中 ({cooldownRemaining}s)</>
                        ) : (
                          <><Sparkles className="w-5 h-5" /> 立即生成期末評語</>
                        )}
                      </button>
                      {dailyUsageCount > 0 && !isLimitReached && (
                        <p className={`text-xs ${theme.textLight} text-center mt-2`}>
                          今日已使用 {dailyUsageCount}/{dailyLimit} 次
                        </p>
                      )}
                      {generationStage && (
                        <p className={`text-sm ${theme.textLight} text-center mt-3 animate-pulse`}>{generationStage}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col h-full min-h-[300px] lg:min-h-[500px]">
                  <div className={`flex-1 ${theme.surface} p-4 lg:p-8 rounded-3xl shadow-sm border ${theme.border} flex flex-col relative`}>
                    <label className={`text-sm font-bold ${theme.textLight} mb-4 block flex items-center gap-2`}><School className="w-4 h-4" /> AI 生成結果</label>
                    <textarea value={tempComment} onChange={(e) => setTempComment(e.target.value)} readOnly={isTyping} placeholder={isGenerating ? '等待 AI 回應中...' : '評語將顯示於此...'} className={`flex-1 w-full p-4 lg:p-6 ${theme.inputBg} rounded-2xl border ${theme.border} outline-none focus:ring-2 ${theme.focusRing} transition leading-8 ${theme.text} resize-none text-lg ${isTyping ? 'cursor-default' : ''}`} />
                    <div className="absolute bottom-6 right-6 flex items-center gap-3 animate-pop-in">
                      {tempComment && (
                        <button
                          onClick={handleCopyComment}
                          className={`px-4 py-2 ${theme.surfaceAlt} ${theme.text} text-sm rounded-xl hover:bg-[#e0dcd3] transition flex items-center gap-2 font-bold shadow-sm ring-1 ring-[#e6e2d8]`}
                          title="複製並紀錄修改數據"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          {isCopied ? '已複製' : '複製'}
                        </button>
                      )}
                      {tempComment !== student.comment && (
                        <button
                          onClick={handleSaveComment}
                          className={`px-4 py-2 ${theme.accentPositive} text-white text-sm rounded-xl shadow-lg hover:opacity-90 transition flex items-center gap-2 font-bold`}
                        >
                          <Save className="w-4 h-4" /> 儲存
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isNoteModalOpen} onClose={handleCloseNoteModal} title="🔒 輔導紀錄">
        <div className="space-y-4">
          {!noteSyncMode ? (
            <>
              <p className={`text-sm ${theme.textLight} ${theme.surfaceAlt} p-3 rounded-xl border ${theme.border}`}>此內容僅供教師查看，可紀錄家庭狀況、輔導需求等隱私資訊。</p>
              <p className={`text-sm font-semibold ${theme.text}`}>
                {currentDate}（星期{['日','一','二','三','四','五','六'][new Date(currentDate).getDay()]}）
              </p>
              <textarea className={`w-full h-48 p-4 ${theme.inputBg} border ${theme.border} rounded-xl focus:ring-2 ${theme.focusRing} outline-none resize-none text-base ${theme.text}`} placeholder="請輸入私密觀察紀錄..." value={tempNote} onChange={(e) => setTempNote(e.target.value)} />
              <div className="flex gap-2 pt-2">
                <button onClick={handleSaveNote} className={`flex-1 py-3 ${theme.primary} text-white rounded-xl font-bold hover:opacity-90`}>儲存</button>
                <button onClick={handleCloseNoteModal} className={`flex-1 py-3 ${theme.surfaceAlt} ${theme.text} rounded-xl font-bold hover:opacity-80`}>取消</button>
              </div>
            </>
          ) : (
            <>
              <div className={`text-sm ${theme.accentPositive} bg-green-50 dark:bg-green-900/20 p-3 rounded-xl font-bold`}>
                ✅ 已儲存 {student.name} 的紀錄
              </div>
              <h4 className={`font-bold ${theme.text}`}>要將此紀錄同步到其他學生嗎？</h4>
              <p className={`text-xs ${theme.textLight}`}>已有紀錄的學生會自動追加，不會覆蓋原有內容</p>
              <div className="flex items-center gap-2 pb-1">
                <button
                  onClick={() => {
                    const otherIds = students.filter(s => s.id !== student.id).map(s => s.id);
                    setSyncTargetIds(prev => prev.size === otherIds.length ? new Set() : new Set(otherIds));
                  }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg ${theme.surfaceAlt} ${theme.text} hover:opacity-80 transition`}
                >
                  {syncTargetIds.size === students.filter(s => s.id !== student.id).length ? '取消全選' : '全選'}
                </button>
              </div>
              <div className={`max-h-60 overflow-y-auto space-y-1 border ${theme.border} rounded-xl p-2`}>
                {[...students]
                  .filter(s => s.id !== student.id)
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map(s => {
                    const targetNote = s.dailyRecords[currentDate]?.note?.trim() || '';
                    return (
                      <label key={s.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:${theme.surfaceAlt} transition`}>
                        <input
                          type="checkbox"
                          checked={syncTargetIds.has(s.id)}
                          onChange={() => {
                            setSyncTargetIds(prev => {
                              const next = new Set(prev);
                              if (next.has(s.id)) next.delete(s.id);
                              else next.add(s.id);
                              return next;
                            });
                          }}
                          className="w-4 h-4 rounded accent-current"
                        />
                        <span className={`font-bold text-sm ${theme.text}`}>{s.seatNumber ?? s.order ?? '?'}. {s.name}</span>
                        {targetNote && (
                          <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full font-bold">已有紀錄，將追加</span>
                        )}
                      </label>
                    );
                  })}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSyncNote}
                  disabled={syncTargetIds.size === 0 || isSyncing}
                  className={`flex-1 py-3 ${theme.primary} text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition`}
                >
                  {isSyncing ? '同步中...' : `同步紀錄（${syncTargetIds.size} 位）`}
                </button>
                <button onClick={handleCloseNoteModal} className={`flex-1 py-3 ${theme.surfaceAlt} ${theme.text} rounded-xl font-bold hover:opacity-80`}>跳過，直接關閉</button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal isOpen={showPasswordModal} onClose={() => { setShowPasswordModal(false); setVerifyPasswordVal(''); setVerifyError(''); }} title="🔒 安全驗證">
        <div className="space-y-4">
          <p className="text-sm text-[#c48a8a] bg-[#fcecec] p-3 rounded-xl border border-[#e6bwbw]">{pendingAction === 'export' ? '為了保護學生隱私，請輸入密碼以匯出班級紀錄。' : '為了保護學生隱私，請輸入密碼以解鎖輔導紀錄。'}</p>
          <div>
            <label className={`block text-sm font-bold ${theme.text} mb-2`}>請輸入登入密碼：</label>
            <input type="password" className={`w-full p-3 ${theme.inputBg} border ${theme.border} rounded-xl focus:ring-2 focus:ring-[#c48a8a] outline-none ${theme.text}`} value={verifyPasswordVal} onChange={(e) => setVerifyPasswordVal(e.target.value)} placeholder="Password" />
            {verifyError && <p className="text-xs text-red-500 mt-2 font-bold">{verifyError}</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleVerifyPassword} disabled={isVerifying || !verifyPasswordVal} className={`flex-1 py-3 ${theme.primary} text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50`}>{isVerifying ? '驗證中...' : pendingAction === 'export' ? '驗證並匯出' : '解鎖紀錄'}</button>
            <button onClick={() => setShowPasswordModal(false)} className={`flex-1 py-3 ${theme.surfaceAlt} ${theme.text} rounded-xl font-bold hover:opacity-80`}>取消</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isBehaviorSettingsOpen} onClose={() => setIsBehaviorSettingsOpen(false)} title="⚙️ 自訂快速記分按鈕">
        <div className="space-y-6">
          <div className={`flex items-center justify-between p-3 rounded-xl border ${theme.border} ${theme.surfaceAlt}`}>
            <span className={`font-bold ${theme.text} flex items-center gap-2`}><Gift className="w-4 h-4 text-amber-500" /> 啟用積分商店</span>
            <button
              onClick={handleTogglePrizeShop}
              className={`relative w-12 h-6 rounded-full transition-colors ${prizeShopEnabled ? theme.primary : theme.surfaceAccent}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${prizeShopEnabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
          <div className={`border-t ${theme.border}`}></div>
          <BehaviorEditor buttons={positiveBehaviors} onUpdate={(btns) => handleUpdateBehaviors('positive', btns)} title="正面表現 (Positive)" fixedValue={1} />
          <div className={`border-t ${theme.border}`}></div>
          <BehaviorEditor buttons={negativeBehaviors} onUpdate={(btns) => handleUpdateBehaviors('negative', btns)} title="待改進 (Improvement)" fixedValue={-1} />
          <div className={`border-t ${theme.border}`}></div>
          <PrizeEditor prizes={prizes} onUpdate={handleUpdatePrizes} />
          <div className="pt-2">
            <button onClick={() => setIsBehaviorSettingsOpen(false)} className={`w-full py-3 ${theme.primary} text-white rounded-xl font-bold`}>完成設定</button>
          </div>
        </div>
      </Modal>

      {/* Export CSV Modal */}
      <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="匯出整班紀錄">
        <div className="space-y-4">
          <p className={`text-sm ${theme.textLight}`}>請勾選要匯出的欄位，固定欄位（座號、姓名、日期）會自動包含。</p>
          <div className="space-y-3">
            {([
              { key: 'behaviorDetail' as const, label: '行為紀錄明細' },
              { key: 'dailyScore' as const, label: '當日得分' },
              { key: 'note' as const, label: '輔導備註', warning: '含隱私資料' },
              { key: 'aiComment' as const, label: 'AI 評語' },
              { key: 'tags' as const, label: '特質標籤' },
              { key: 'totalScore' as const, label: '累計總分' },
            ]).map(({ key, label, warning }) => (
              <label key={key} className={`flex items-center gap-3 p-3 rounded-xl border ${theme.border} ${theme.surface} cursor-pointer hover:${theme.surfaceAlt} transition`}>
                <input
                  type="checkbox"
                  checked={exportFields[key]}
                  onChange={() => setExportFields(prev => ({ ...prev, [key]: !prev[key] }))}
                  className="w-4 h-4 rounded accent-current"
                />
                <span className={`font-bold text-sm ${theme.text}`}>{label}</span>
                {warning && <span className="text-xs text-red-400 font-bold">{warning}</span>}
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleExportCsv}
              className={`flex-1 py-3 ${theme.primary} text-white rounded-xl font-bold hover:opacity-90 transition flex items-center justify-center gap-2`}
            >
              <Download className="w-4 h-4" /> 匯出 CSV
            </button>
            <button
              onClick={() => setIsExportModalOpen(false)}
              className={`flex-1 py-3 ${theme.surfaceAlt} ${theme.text} rounded-xl font-bold hover:opacity-80 transition`}
            >
              取消
            </button>
          </div>
        </div>
      </Modal>

      {/* Prompt Editor Modal */}
      <Modal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        title="🤖 自訂 AI 提示詞 (System Prompt)"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className={`p-4 rounded-xl ${theme.surfaceAlt} border ${theme.border} text-sm ${theme.textLight}`}>
            系統預設提示詞已經包含了角色設定、學生資料與行為紀錄的引用要求。您可以在此基礎上增加或修改指令。
            <br />
            <span className="font-bold text-red-400">注意：若清空則會使用系統預設提示詞。</span>
          </div>
          <textarea
            value={customPrompt || DEFAULT_SYSTEM_INSTRUCTION}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className={`w-full h-64 p-4 rounded-xl border ${theme.border} ${theme.inputBg} ${theme.text} font-mono text-sm leading-relaxed outline-none focus:ring-2 ${theme.focusRing}`}
            placeholder={DEFAULT_SYSTEM_INSTRUCTION}
          />
          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setCustomPrompt('')}
              className={`px-4 py-2 ${theme.surfaceAlt} ${theme.text} rounded-xl font-bold hover:bg-red-50 hover:text-red-500 transition`}
            >
              回復預設值
            </button>
            <button
              onClick={() => setIsPromptModalOpen(false)}
              className={`px-6 py-2 ${theme.primary} text-white rounded-xl font-bold hover:opacity-90 transition`}
            >
              完成設定
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
