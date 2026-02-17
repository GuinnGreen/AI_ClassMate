import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, Sparkles, Save, Trash2, ClipboardList,
  Smile, Frown, School, Clock, Settings, Copy, AlignLeft,
  Check, Lock, Download
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { formatDate } from '../utils/date';
import { levenshteinDistance } from '../utils/levenshtein';
import {
  addPointToStudent,
  deletePointFromStudent,
  toggleStudentTag,
  updateStudentComment,
  saveStudentNote,
  updateCustomBehaviors,
  logAiGeneration,
  logCommentEdit,
  verifyPassword,
} from '../services/firebaseService';
import { generateStudentComment, DEFAULT_SYSTEM_INSTRUCTION } from '../services/geminiService';
import { Modal } from './ui/Modal';
import { WeeklyCalendar } from './WeeklyCalendar';
import { BehaviorEditor } from './BehaviorEditor';
import {
  Student,
  ClassConfig,
  PointLog,
  BehaviorButton,
  DEFAULT_POSITIVE_BEHAVIORS,
  DEFAULT_NEGATIVE_BEHAVIORS,
  EVALUATION_CATEGORIES,
} from '../types';
import { auth } from '../firebase';

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
  const [mode, setMode] = useState<'daily' | 'ai'>('daily');
  const [currentDate, setCurrentDate] = useState(formatDate(new Date()));

  // Note & Security State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [tempNote, setTempNote] = useState('');
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
      for (const date of dates) {
        const record = s.dailyRecords[date];
        const hasPoints = record.points.length > 0;
        const hasNote = record.note && record.note.trim().length > 0;
        if (!hasPoints && !hasNote) continue;

        const row: string[] = [
          String((s.order ?? 0) + 1),
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
          row.push(s.comment || '');
        }

        if (exportFields.tags) {
          row.push(s.tags.join(', '));
        }

        if (exportFields.totalScore) {
          row.push(String(s.totalScore));
        }

        rows.push(row);
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

  const handleUpdateBehaviors = async (type: 'positive' | 'negative', newBtns: BehaviorButton[]) => {
    const newConfig = await updateCustomBehaviors(
      userUid, classConfig, type, newBtns, positiveBehaviors, negativeBehaviors
    );
    if (onConfigUpdate) onConfigUpdate(newConfig);
  };

  const handleAddPoint = async (behavior: BehaviorButton) => {
    const currentDayRecord = student.dailyRecords[currentDate] || { points: [], note: '' };
    await addPointToStudent(userUid, student.id, currentDate, currentDayRecord, behavior);
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
        const currentDayRecord = student.dailyRecords[currentDate] || { points: [], note: '' };
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
    const currentDayRecord = student.dailyRecords[currentDate] || { points: [], note: '' };
    await saveStudentNote(userUid, student.id, currentDate, currentDayRecord, tempNote);
    setIsNoteModalOpen(false);
  };

  // --- AI Logic ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [tempComment, setTempComment] = useState(student.comment);
  const [commentLength, setCommentLength] = useState<number>(150);
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

  useEffect(() => {
    setTempComment(student.comment);
    if (student.originalAiComment) {
      setOriginalAiText(student.originalAiComment);
    }
  }, [student.comment, student.originalAiComment]);

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

  const dayRecord = student.dailyRecords[currentDate] || { points: [], note: '' };
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
  const negativeGroups = groupPoints(dayRecord.points.filter(p => p.value < 0));

  return (
    <>
      <div className={`flex flex-col h-full ${theme.surface} rounded-3xl overflow-hidden`}>
        <div className={`flex items-center justify-between p-6 border-b ${theme.border} z-20 shrink-0`}>
          <div className="flex items-center gap-4">
            <button onClick={onBack} className={`p-2 hover:${theme.surfaceAlt} rounded-full lg:hidden ${theme.text}`}><ChevronLeft className="w-5 h-5" /></button>
            <div className={`w-12 h-12 rounded-full ${theme.primary} text-white flex items-center justify-center font-bold text-xl shadow-sm`}>{student.name.charAt(0)}</div>
            <div>
              <h2 className={`text-2xl font-bold ${theme.text}`}>{student.name}</h2>
              <div className={`text-base ${theme.textLight} flex items-center gap-2`}>
                總積分 <span className={`px-2 py-0.5 rounded-lg text-sm font-bold ${student.totalScore >= 0 ? `${theme.accentPositive} text-white` : `${theme.accentNegative} text-white`}`}>{student.totalScore > 0 ? '+' : ''}{student.totalScore}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex ${theme.surfaceAlt} p-1.5 rounded-xl`}>
              <button onClick={() => setMode('daily')} className={`px-5 py-2 text-sm font-bold rounded-lg transition ${mode === 'daily' ? `${theme.surface} ${theme.text} shadow-sm` : `${theme.textLight} hover:${theme.text}`}`}>日常紀錄</button>
              <button onClick={() => setMode('ai')} className={`px-5 py-2 text-sm font-bold rounded-lg transition flex items-center gap-1 ${mode === 'ai' ? `${theme.surface} ${theme.text} shadow-sm` : `${theme.textLight} hover:${theme.text}`}`}><Sparkles className="w-4 h-4" /> AI 評語</button>
            </div>
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
              <div className={`flex-1 flex flex-col border-r ${theme.border} ${theme.bg} p-6 h-auto lg:h-full lg:overflow-y-auto shrink-0`}>
                <div className="mb-6 shrink-0">
                  <WeeklyCalendar currentDate={currentDate} onDateSelect={setCurrentDate} student={student} />
                </div>

                <div className="flex-1 flex flex-col min-h-[400px] lg:min-h-0">
                  <h3 className={`font-bold ${theme.text} mb-2 shrink-0`}>當日紀錄</h3>
                  <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                    <div className={`rounded-2xl p-4 border ${theme.border} ${theme.surface} h-fit`}>
                      <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme.text}`}><div className={`w-2 h-2 rounded-full ${theme.accentPositive}`}></div> 正面表現</h4>
                      <div className="space-y-2">
                        {positiveGroups.map((group, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleDeleteGroup(group.label)}
                            className={`w-full ${theme.surfaceAlt} p-3 rounded-xl border ${theme.border} flex justify-between items-center group animate-pop-in hover:border-${theme.primary} transition-all duration-75 relative active:scale-95 transform`}
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

                    <div className={`rounded-2xl p-4 border ${theme.border} ${theme.surface} h-fit`}>
                      <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme.text}`}><div className={`w-2 h-2 rounded-full ${theme.accentNegative}`}></div> 待改進</h4>
                      <div className="space-y-2">
                        {negativeGroups.map((group, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleDeleteGroup(group.label)}
                            className={`w-full ${theme.surfaceAlt} p-3 rounded-xl border ${theme.border} flex justify-between items-center group animate-pop-in hover:border-${theme.accentNegative} transition-all duration-75 relative active:scale-95 transform`}
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
                  </div>
                </div>
              </div>

              <div className={`w-full lg:w-96 flex flex-col gap-4 p-6 shrink-0 h-auto lg:h-full lg:overflow-y-auto lg:border-l ${theme.border} ${theme.surfaceAlt}`}>
                <div className={`${theme.surface} p-4 rounded-2xl border ${theme.border} shadow-sm flex items-center justify-between`}>
                  <h3 className={`text-sm font-bold ${theme.textLight} uppercase tracking-wide flex items-center gap-2`}>
                    <Clock className="w-4 h-4" /> 快速記分板
                  </h3>
                  <button onClick={() => setIsBehaviorSettingsOpen(true)} className={`p-2 rounded-lg hover:${theme.surfaceAlt} ${theme.textLight} transition`} title="自訂按鈕">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                <div className={`${theme.surface} p-2 rounded-2xl border ${theme.border} shadow-sm`}>
                  <button
                    onClick={() => { setPendingAction('notes'); setShowPasswordModal(true); }}
                    className={`w-full p-4 rounded-xl ${theme.surfaceAccent} border-2 ${theme.border} text-center hover:border-[#8da399] transition-all transform active:scale-95 group`}
                  >
                    <div className="flex items-center justify-center gap-2 mb-1">
                      {hasNote ? <div className={`p-1 rounded-full ${theme.primary} text-white`}><Check className="w-3 h-3 stroke-[3]" /></div> : <Lock className={`w-5 h-5 ${theme.textLight} group-hover:${theme.text}`} />}
                      <span className={`font-bold text-lg ${theme.text}`}>輔導紀錄</span>
                    </div>
                    {hasNote ?
                      <p className={`text-xs ${theme.primary} font-bold`}>今日已建立紀錄 (加密)</p> :
                      <p className={`text-xs ${theme.textLight}`}>紀錄家庭狀況與隱私備註 (加密)</p>
                    }
                  </button>
                </div>

                <div className={`${theme.surface} p-5 rounded-2xl border ${theme.border} shadow-sm`}>
                  <label className={`text-sm font-bold ${theme.primaryText} mb-4 flex items-center gap-2`}><Smile className="w-4 h-4" /> 正面表現</label>
                  <div className="grid grid-cols-2 gap-3">
                    {positiveBehaviors.map((btn) => (
                      <button key={btn.id} onClick={() => handleAddPoint(btn)}
                        className={`
                            flex flex-col items-center justify-center p-4 rounded-2xl
                            border ${theme.border} ${theme.surfaceAlt}
                            hover:${theme.primary} hover:text-white hover:border-transparent hover:shadow-lg hover:-translate-y-1
                            transition-all duration-200 active:scale-95 group relative overflow-hidden active-shrink
                          `}
                      >
                        <span className={`text-[1.5em] font-bold mb-1 ${theme.text} group-hover:text-white`}>+{btn.value}</span>
                        <span className={`text-[0.85em] font-medium ${theme.textLight} group-hover:text-white/90`}>{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`${theme.surface} p-5 rounded-2xl border ${theme.border} shadow-sm`}>
                  <label className={`text-sm font-bold ${theme.accentNegativeText} mb-4 flex items-center gap-2`}><Frown className="w-4 h-4" /> 待改進</label>
                  <div className="grid grid-cols-2 gap-3">
                    {negativeBehaviors.map((btn) => (
                      <button key={btn.id} onClick={() => handleAddPoint(btn)}
                        className={`
                            flex flex-col items-center justify-center p-4 rounded-2xl
                            border ${theme.border} ${theme.surfaceAlt}
                            hover:${theme.accentNegative} hover:text-white hover:border-transparent hover:shadow-lg hover:-translate-y-1
                            transition-all duration-200 active:scale-95 group relative overflow-hidden active-shrink
                          `}
                      >
                        <span className={`text-[1.5em] font-bold mb-1 ${theme.text} group-hover:text-white`}>{btn.value}</span>
                        <span className={`text-[0.85em] font-medium ${theme.textLight} group-hover:text-white/90`}>{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // AI Mode View
            <div className="flex flex-col h-full overflow-y-auto p-6 lg:p-12 max-w-6xl mx-auto w-full">
              <div className="grid lg:grid-cols-2 gap-8 h-full">
                <div className="space-y-8">
                  <div className={`${theme.surface} p-8 rounded-3xl shadow-sm border ${theme.border}`}>
                    <h3 className={`text-xl font-bold ${theme.text} mb-4 flex items-center gap-3`}><div className={`p-2 rounded-xl ${theme.primary} text-white`}><ClipboardList className="w-5 h-5" /></div> 特質標籤</h3>

                    {/* Tabs */}
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                      {EVALUATION_CATEGORIES.map((cat, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveEvaluationTab(idx)}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap
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
                          <div className="flex flex-wrap gap-1.5">
                            {EVALUATION_CATEGORIES[activeEvaluationTab]?.positive.map(tag => (
                              <button
                                key={tag}
                                onClick={() => handleToggleTag(tag)}
                                className={`px-2.5 py-1.5 rounded-lg text-sm font-bold transition-all border-2 w-full md:w-auto text-left md:text-center
                                    ${student.tags.includes(tag)
                                    ? `${theme.primary} border-${theme.primary} text-white shadow-md transform scale-105`
                                    : `border-transparent bg-white dark:bg-black/10 ${theme.text} hover:border-${theme.primary}`
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
                          <div className="flex flex-wrap gap-1.5">
                            {EVALUATION_CATEGORIES[activeEvaluationTab]?.negative.map(tag => (
                              <button
                                key={tag}
                                onClick={() => handleToggleTag(tag)}
                                className={`px-2.5 py-1.5 rounded-lg text-sm font-bold transition-all border-2 w-full md:w-auto text-left md:text-center
                                    ${student.tags.includes(tag)
                                    ? `${theme.accentNegative} border-${theme.accentNegative} text-white shadow-md transform scale-105`
                                    : `border-transparent bg-white dark:bg-black/10 ${theme.text} hover:border-${theme.accentNegative}`
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

                  <div className={`${theme.inputBg} p-6 rounded-3xl border ${theme.border} relative overflow-hidden`}>
                    <div className="relative z-10">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className={`text-xl font-bold ${theme.text}`}>準備生成</h3>
                        <button onClick={() => setIsPromptModalOpen(true)} className={`p-2 rounded-lg ${theme.surfaceAlt} ${theme.textLight} hover:${theme.text} hover:bg-[rgba(0,0,0,0.05)] transition flex items-center gap-2 text-xs font-bold`}>
                          <Settings className="w-4 h-4" /> 自訂提示詞 Prompt
                        </button>
                      </div>
                      <p className={`text-base ${theme.textLight} mb-6`}>系統將讀取該生所有資料作為 AI 上下文。</p>
                      <button onClick={handleGenerateAI} disabled={isGenerating || isTyping} className={`w-full py-4 ${theme.primary} text-white rounded-2xl font-bold shadow-lg hover:opacity-90 hover:shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2 transform hover:-translate-y-0.5`}>
                        {isGenerating ? <><Sparkles className="w-5 h-5 animate-spin" /> 生成評語中...</> : isTyping ? <><Sparkles className="w-5 h-5 animate-spin" /> 輸出中...</> : <><Sparkles className="w-5 h-5" /> 立即生成期末評語</>}
                      </button>
                      {generationStage && (
                        <p className={`text-sm ${theme.textLight} text-center mt-3 animate-pulse`}>{generationStage}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col h-full min-h-[500px]">
                  <div className={`flex-1 ${theme.surface} p-8 rounded-3xl shadow-sm border ${theme.border} flex flex-col relative`}>
                    <label className={`text-sm font-bold ${theme.textLight} mb-4 block flex items-center gap-2`}><School className="w-4 h-4" /> AI 生成結果</label>
                    <textarea value={tempComment} onChange={(e) => setTempComment(e.target.value)} readOnly={isTyping} placeholder={isGenerating ? '等待 AI 回應中...' : '評語將顯示於此...'} className={`flex-1 w-full p-6 ${theme.inputBg} rounded-2xl border ${theme.border} outline-none focus:ring-2 ${theme.focusRing} transition leading-8 ${theme.text} resize-none text-lg ${isTyping ? 'cursor-default' : ''}`} />
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

      <Modal isOpen={isNoteModalOpen} onClose={() => setIsNoteModalOpen(false)} title="🔒 輔導紀錄">
        <div className="space-y-4">
          <p className={`text-sm ${theme.textLight} ${theme.surfaceAlt} p-3 rounded-xl border ${theme.border}`}>此內容僅供教師查看，可紀錄家庭狀況、輔導需求等隱私資訊。</p>
          <textarea className={`w-full h-48 p-4 ${theme.inputBg} border ${theme.border} rounded-xl focus:ring-2 ${theme.focusRing} outline-none resize-none text-base ${theme.text}`} placeholder="請輸入私密觀察紀錄..." value={tempNote} onChange={(e) => setTempNote(e.target.value)} />
          <div className="flex gap-2 pt-2">
            <button onClick={handleSaveNote} className={`flex-1 py-3 ${theme.primary} text-white rounded-xl font-bold hover:opacity-90`}>儲存</button>
            <button onClick={() => setIsNoteModalOpen(false)} className={`flex-1 py-3 ${theme.surfaceAlt} ${theme.text} rounded-xl font-bold hover:opacity-80`}>取消</button>
          </div>
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
          <BehaviorEditor buttons={positiveBehaviors} onUpdate={(btns) => handleUpdateBehaviors('positive', btns)} title="正面表現 (Positive)" fixedValue={1} />
          <div className={`border-t ${theme.border}`}></div>
          <BehaviorEditor buttons={negativeBehaviors} onUpdate={(btns) => handleUpdateBehaviors('negative', btns)} title="待改進 (Improvement)" fixedValue={-1} />
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
