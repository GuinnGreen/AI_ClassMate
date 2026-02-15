import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  writeBatch,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';

// --- Font Injection & Global Styles ---
// Inject Google Fonts: Zen Maru Gothic (Rounded) & Klee One (Handwritten)
const FontStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&family=Zen+Maru+Gothic:wght@400;500;700&display=swap');
    
    body {
      font-family: 'Zen Maru Gothic', sans-serif !important;
    }
    
    .font-handwritten {
      font-family: 'Klee One', cursive !important;
    }

    .notebook-paper {
      background-color: transparent;
      background-image: linear-gradient(transparent 95%, #e5e7eb 95%);
      background-size: 100% 3.5rem;
      line-height: 3.5rem;
      padding-top: 0.5rem;
      font-weight: 700;
    }
    
    .dark .notebook-paper {
      background-image: linear-gradient(transparent 95%, #404040 95%);
    }
  `}</style>
);
import {
  Student,
  ClassConfig,
  PointLog,
  BehaviorButton,
  DEFAULT_POSITIVE_BEHAVIORS,
  DEFAULT_NEGATIVE_BEHAVIORS,
  EVALUATION_CATEGORIES,
  DaySchedule,
  Period
} from './types';
import { generateStudentComment, parseScheduleFromImage } from './services/geminiService';
import { LiveSession } from './services/liveService';
import {
  Users,
  LogOut,
  Calendar as CalendarIcon,
  Sparkles,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Smile,
  Frown,
  School,
  X,
  Edit3,
  ZoomIn,
  ZoomOut,
  Home,
  CheckSquare,
  Square,
  Clock,
  EyeOff,
  Moon,
  Sun,
  Settings,
  Plus,
  Minus,
  Copy,
  AlignLeft,
  Check,
  Lock,
  Upload,
  Image as ImageIcon,
  FileText,
  Grid,
  ShieldCheck,
  Type,
  Mic,
  MicOff,
  Activity
} from 'lucide-react';

// --- Research Helper: Levenshtein Distance ---
const levenshteinDistance = (a: string, b: string): number => {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

// --- Theme Configurations ---

interface ThemePalette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceAccent: string;
  primary: string;
  primaryHover: string;
  primaryText: string;
  text: string;
  textLight: string;
  accentPositive: string;
  accentNegative: string;
  accentPositiveText: string;
  accentNegativeText: string;
  border: string;
  focusRing: string;
  inputBg: string;
}

const LIGHT_THEME: ThemePalette = {
  bg: 'bg-[#F5F5F7]', // Keep Apple Light Gray Background
  surface: 'bg-[#FFFFFF]',
  surfaceAlt: 'bg-[#FAFAFA]',
  surfaceAccent: 'bg-[#F2F4F7]',
  primary: 'bg-[#6B7C93]', // Morandi Blue-Gray (Muted, elegant)
  primaryHover: 'hover:bg-[#556375]', // Darker Morandi
  primaryText: 'text-[#6B7C93]',
  text: 'text-[#2D3436]', // Soft Black
  textLight: 'text-[#8795A1]', // Morandi Gray Text
  accentPositive: 'bg-[#34C759]',
  accentNegative: 'bg-[#FF3B30]',
  accentPositiveText: 'text-[#34C759]',
  accentNegativeText: 'text-[#FF3B30]',
  border: 'border-[#E3E8EE]',
  focusRing: 'focus:ring-[#6B7C93]',
  inputBg: 'bg-[#FFFFFF]',
};

const DARK_THEME: ThemePalette = {
  bg: 'bg-[#000000]',
  surface: 'bg-[#1C1C1E]',
  surfaceAlt: 'bg-[#2C2C2E]',
  surfaceAccent: 'bg-[#3A3A3C]',
  primary: 'bg-[#7E8F9F]', // Lighter Morandi for Dark Mode
  primaryHover: 'hover:bg-[#6B7C93]',
  primaryText: 'text-[#7E8F9F]',
  text: 'text-[#F5F5F7]',
  textLight: 'text-[#9CA3AF]',
  accentPositive: 'bg-[#30D158]',
  accentNegative: 'bg-[#FF453A]',
  accentPositiveText: 'text-[#30D158]',
  accentNegativeText: 'text-[#FF453A]',
  border: 'border-[#38383A]',
  focusRing: 'focus:ring-[#7E8F9F]',
  inputBg: 'bg-[#1C1C1E]',
};



// --- Helper: Format Date ---
const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getCurrentTime = () => {
  const now = new Date();
  return {
    date: now.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
    time: now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    dayOfWeek: now.getDay() // 0-6
  };
};

// --- Component: Editable Input ---
const EditableInput = ({
  value,
  onSave,
  className,
  placeholder
}: {
  value: string,
  onSave: (val: string) => void,
  className?: string,
  placeholder?: string
}) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    if (localValue !== value) {
      onSave(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder={placeholder}
    />
  );
};

// --- Component: Modal Wrapper ---
const Modal = ({ isOpen, onClose, title, children, theme, maxWidth = "max-w-md" }: { isOpen: boolean, onClose: () => void, title: string, children?: React.ReactNode, theme: ThemePalette, maxWidth?: string }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className={`w-full ${maxWidth} ${theme.surface} rounded-3xl shadow-2xl overflow-hidden animate-pop-in border ${theme.border}`}>
        <div className={`p-4 border-b ${theme.border} flex justify-between items-center ${theme.surfaceAlt}`}>
          <h3 className={`font-bold text-lg ${theme.text}`}>{title}</h3>
          <button onClick={onClose} className={`p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition ${theme.textLight}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Component: Manual Schedule Editor ---
const ManualScheduleEditor = ({
  initialSchedule,
  onSave,
  theme
}: {
  initialSchedule?: DaySchedule[],
  onSave: (schedule: DaySchedule[]) => void,
  theme: ThemePalette
}) => {
  interface EditorRow {
    id: string;
    periodName: string;
    label: string;
    subjects: string[];
  }

  const [rows, setRows] = useState<EditorRow[]>([]);

  useEffect(() => {
    if (initialSchedule && initialSchedule.length > 0) {
      const periodsMap = new Map<string, EditorRow>();
      const defaultOrder = ['第一節', '第二節', '第三節', '第四節', '午休', '第五節', '第六節', '第七節'];

      defaultOrder.forEach((pName, idx) => {
        periodsMap.set(pName, {
          id: idx.toString(),
          periodName: "00:00-00:00",
          label: pName,
          subjects: ['', '', '', '', '']
        });
      });

      initialSchedule.forEach((dayData) => {
        const dayIdx = dayData.dayOfWeek - 1;
        if (dayIdx >= 0 && dayIdx < 5) {
          dayData.periods.forEach(p => {
            let label = p.periodName;
            let existing = periodsMap.get(label);

            if (!existing) {
              const foundKey = Array.from(periodsMap.keys()).find(k => label.includes(k));
              if (foundKey) existing = periodsMap.get(foundKey);
            }

            if (existing) {
              existing.subjects[dayIdx] = p.subject;
              if (/\d/.test(label) && existing.periodName === "00:00-00:00") {
                existing.periodName = label;
              }
            } else {
              const newRow: EditorRow = {
                id: crypto.randomUUID(),
                periodName: "",
                label: label,
                subjects: ['', '', '', '', '']
              };
              newRow.subjects[dayIdx] = p.subject;
              periodsMap.set(label, newRow);
            }
          });
        }
      });
      setRows(Array.from(periodsMap.values()));
    } else {
      const defaultRows = [
        { label: '第一節', time: '08:40-09:20' },
        { label: '第二節', time: '09:30-10:10' },
        { label: '第三節', time: '10:30-11:10' },
        { label: '第四節', time: '11:20-12:00' },
        { label: '午休', time: '12:00-13:20' },
        { label: '第五節', time: '13:30-14:10' },
        { label: '第六節', time: '14:20-15:00' },
        { label: '第七節', time: '15:20-16:00' },
      ];
      setRows(defaultRows.map((r, i) => ({
        id: i.toString(),
        periodName: r.time,
        label: r.label,
        subjects: ['', '', '', '', '']
      })));
    }
  }, [initialSchedule]);

  const handleSubjectChange = (rowIdx: number, dayIdx: number, val: string) => {
    const newRows = [...rows];
    newRows[rowIdx].subjects[dayIdx] = val;
    setRows(newRows);
  };

  const handleRowChange = (rowIdx: number, field: 'periodName' | 'label', val: string) => {
    const newRows = [...rows];
    newRows[rowIdx][field] = val;
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, {
      id: crypto.randomUUID(),
      periodName: "00:00-00:00",
      label: "新節次",
      subjects: ['', '', '', '', '']
    }]);
  };

  const deleteRow = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const schedule: DaySchedule[] = [];
    for (let day = 1; day <= 5; day++) {
      const periods: Period[] = [];
      rows.forEach(row => {
        const subject = row.subjects[day - 1];
        if (subject || row.label) {
          const finalName = row.periodName && row.periodName !== "00:00-00:00"
            ? `${row.label} ${row.periodName}`
            : row.label;

          periods.push({
            periodName: finalName,
            subject: subject || ""
          });
        }
      });
      schedule.push({ dayOfWeek: day, periods });
    }
    onSave(schedule);
  };

  return (
    <div className="space-y-4">
      <div className={`overflow-x-auto border ${theme.border} rounded-xl`}>
        <table className="w-full text-sm min-w-[600px]">
          <thead className={`${theme.surfaceAccent} font-bold ${theme.text}`}>
            <tr>
              <th className="p-3 text-left w-32">節次名稱</th>
              <th className="p-3 text-left w-24">時間</th>
              <th className="p-3 w-20">週一</th>
              <th className="p-3 w-20">週二</th>
              <th className="p-3 w-20">週三</th>
              <th className="p-3 w-20">週四</th>
              <th className="p-3 w-20">週五</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className={`border-t ${theme.border} hover:${theme.surfaceAlt} group`}>
                <td className="p-2">
                  <input
                    value={row.label}
                    onChange={(e) => handleRowChange(idx, 'label', e.target.value)}
                    className={`w-full bg-transparent outline-none font-bold ${theme.text}`}
                  />
                </td>
                <td className="p-2">
                  <input
                    value={row.periodName}
                    onChange={(e) => handleRowChange(idx, 'periodName', e.target.value)}
                    className={`w-full bg-transparent outline-none text-xs ${theme.textLight}`}
                    placeholder="00:00"
                  />
                </td>
                {[0, 1, 2, 3, 4].map(day => (
                  <td key={day} className={`p-2 border-l ${theme.border}`}>
                    <input
                      value={row.subjects[day]}
                      onChange={(e) => handleSubjectChange(idx, day, e.target.value)}
                      className={`w-full text-center bg-transparent outline-none focus:font-bold ${theme.text}`}
                    />
                  </td>
                ))}
                <td className="p-2 text-center">
                  <button onClick={() => deleteRow(idx)} className="text-[#c48a8a] opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center pt-2">
        <button onClick={addRow} className={`text-xs font-bold ${theme.primary} flex items-center gap-1 hover:opacity-80`}>
          <Plus className="w-4 h-4" /> 新增節次
        </button>
        <button onClick={handleSave} className={`px-6 py-2 ${theme.primary} text-white rounded-lg font-bold shadow-md hover:opacity-90`}>
          儲存課表
        </button>
      </div>
    </div>
  );
};


// --- Component: Login / Register ---
const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const theme = LIGHT_THEME;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') {
        setError('系統錯誤：尚未設定 Firebase API Key。');
      } else {
        setError(isRegistering ? '註冊失敗：' + err.message : '登入失敗，請檢查帳號密碼。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex items-center justify-center min-h-screen ${theme.bg} p-4 font-sans`}>
      <div className={`w-full max-w-md p-8 space-y-6 ${theme.surface} rounded-3xl shadow-xl border ${theme.border}`}>
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className={`p-4 ${theme.primary} rounded-full shadow-md`}>
              <School className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className={`text-2xl font-bold ${theme.text}`}>ClassMate AI</h1>
          <p className={`${theme.textLight} mt-2`}>
            {isRegistering ? '建立您的智慧班級' : '歡迎回來，老師'}
          </p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${theme.text} mb-1`}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-3 ${theme.inputBg} border ${theme.border} rounded-2xl focus:ring-2 ${theme.focusRing} outline-none transition ${theme.text}`}
              placeholder="teacher@school.edu.tw"
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${theme.text} mb-1`}>密碼</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 ${theme.inputBg} border ${theme.border} rounded-2xl focus:ring-2 ${theme.focusRing} outline-none transition ${theme.text}`}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-[#c48a8a] text-sm bg-red-50 p-2 rounded-lg">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 ${theme.primary} ${theme.primaryHover} text-white font-bold rounded-2xl shadow-md transition disabled:opacity-50 transform hover:-translate-y-0.5`}
          >
            {loading ? '處理中...' : (isRegistering ? '註冊帳號' : '進入系統')}
          </button>
        </form>
        <div className="text-center">
          <button
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            className={`text-sm ${theme.textLight} hover:${theme.text} underline underline-offset-2 transition`}
          >
            {isRegistering ? '已有帳號？返回登入' : '還沒有帳號？立即免費註冊'}
          </button>
        </div>
      </div>
    </div>
  );
};

const WeeklyCalendar = ({
  currentDate,
  onDateSelect,
  student,
  theme
}: {
  currentDate: string,
  onDateSelect: (date: string) => void,
  student: Student,
  theme: ThemePalette
}) => {
  const days = useMemo(() => {
    const curr = new Date(currentDate);
    const d = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate());
    const day = d.getDay();
    const diff = d.getDate() - day;
    const startOfWeek = new Date(d);
    startOfWeek.setDate(diff);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(startOfWeek);
      nextDay.setDate(startOfWeek.getDate() + i);
      week.push(nextDay);
    }
    return week;
  }, [currentDate]);

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    onDateSelect(formatDate(d));
  };
  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    onDateSelect(formatDate(d));
  };

  return (
    <div className={`${theme.surface} rounded-2xl p-4 shadow-sm border ${theme.border}`}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={handlePrevWeek} className={`p-1 hover:${theme.surfaceAlt} rounded-lg ${theme.textLight}`}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className={`text-base font-bold ${theme.text}`}>
          {days[0].getFullYear()}年 {days[0].getMonth() + 1}月
        </h3>
        <button onClick={handleNextWeek} className={`p-1 hover:${theme.surfaceAlt} rounded-lg ${theme.textLight}`}>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d, i) => {
          const dStr = formatDate(d);
          const isSelected = dStr === currentDate;
          const isToday = dStr === formatDate(new Date());
          const record = student.dailyRecords[dStr];
          const hasPositive = record?.points.some(p => p.value > 0);
          const hasNegative = record?.points.some(p => p.value < 0);
          const hasNote = record?.note && record.note.trim().length > 0;

          return (
            <button
              key={dStr}
              onClick={() => onDateSelect(dStr)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all relative ${isSelected
                ? `${theme.primary} text-white shadow-md transform scale-105`
                : `hover:${theme.surfaceAlt} ${theme.text}`
                } ${isToday && !isSelected ? `ring-2 ring-inset ${theme.focusRing}` : ''}`}
            >
              <span className={`text-[10px] font-bold mb-1 opacity-70`}>{weekDays[i]}</span>
              <span className={`text-lg font-bold leading-none`}>{d.getDate()}</span>
              <div className="flex gap-1 mt-1.5 h-1.5">
                {hasPositive && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : theme.accentPositive}`}></div>}
                {hasNegative && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#e6bwbw]' : theme.accentNegative}`}></div>}
              </div>
              {hasNote && (
                <div className="absolute top-1 right-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : theme.textLight}`}></div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- Component: Behavior Editor ---
const BehaviorEditor = ({
  buttons,
  onUpdate,
  title,
  theme
}: {
  buttons: BehaviorButton[],
  onUpdate: (btns: BehaviorButton[]) => void,
  title: string,
  theme: ThemePalette
}) => {
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState(1);

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    onUpdate([...buttons, { id: crypto.randomUUID(), label: newLabel, value: Math.abs(newValue) * (newValue < 0 ? 1 : 1) }]);
    setNewLabel('');
  };

  const handleRemove = (id: string) => {
    onUpdate(buttons.filter(b => b.id !== id));
  };

  return (
    <div className="mb-6">
      <h4 className={`font-bold ${theme.text} mb-2`}>{title}</h4>
      <div className="space-y-2 mb-3">
        {buttons.map(btn => (
          <div key={btn.id} className={`flex items-center justify-between p-2 rounded-lg border ${theme.border} ${theme.bg}`}>
            <span className={theme.text}>{btn.label} ({btn.value})</span>
            <button onClick={() => handleRemove(btn.id)} className="text-[#c48a8a] hover:bg-white rounded p-1"><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="名稱" className={`flex-1 p-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text}`} />
        <input type="number" value={newValue} onChange={e => setNewValue(parseInt(e.target.value))} className={`w-16 p-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text}`} />
        <button onClick={handleAdd} className={`${theme.primary} text-white p-2 rounded-lg`}><Plus className="w-5 h-5" /></button>
      </div>
    </div>
  );
};

// --- Component: Student Importer (Excel Copy-Paste Support) ---
const StudentImporter = ({
  onImport,
  theme
}: {
  onImport: (names: string[]) => void,
  theme: ThemePalette
}) => {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<string[]>([]);

  useEffect(() => {
    const lines = text.split(/\n/).map(s => s.trim()).filter(s => s.length > 0);
    setPreview(lines);
  }, [text]);

  const handleImport = () => {
    if (preview.length > 0) {
      onImport(preview);
      setText('');
    }
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl ${theme.surfaceAccent} border ${theme.border}`}>
        <h3 className={`font-bold ${theme.text} mb-2 flex items-center gap-2`}>
          <FileText className="w-5 h-5" /> 批次匯入說明
        </h3>
        <p className={`text-sm ${theme.textLight} leading-relaxed`}>
          請直接從 Excel 或試算表中複製整排學生姓名，並貼上到下方欄位。
          <br />
          系統將會自動處理：
          <ul className="list-disc list-inside mt-1 ml-2">
            <li>自動去除空白行</li>
            <li><strong>第一行名字將會是座號 1 號</strong>，以此類推</li>
            <li>支援 Excel 直接複製貼上</li>
          </ul>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label className={`text-sm font-bold ${theme.text} mb-2`}>在此貼上姓名列表</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            className={`flex-1 min-h-[300px] p-4 rounded-xl border ${theme.border} ${theme.inputBg} ${theme.text} focus:ring-2 ${theme.focusRing} outline-none resize-none font-mono text-sm leading-relaxed`}
            placeholder={`王小明\n李大華\n張美美\n...`}
          />
        </div>
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <label className={`text-sm font-bold ${theme.text}`}>預覽確認 ({preview.length} 人)</label>
            <span className={`text-xs ${theme.textLight}`}>確認順序是否正確</span>
          </div>
          <div className={`flex-1 min-h-[300px] max-h-[300px] overflow-y-auto p-0 rounded-xl border ${theme.border} ${theme.surface}`}>
            {preview.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {preview.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 transition">
                    <span className={`w-6 h-6 rounded-full ${theme.primary} text-white flex items-center justify-center text-xs font-bold`}>{idx + 1}</span>
                    <span className={`font-bold ${theme.text}`}>{name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`h-full flex items-center justify-center ${theme.textLight} text-sm`}>
                尚未輸入資料
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleImport}
          disabled={preview.length === 0}
          className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2
            ${preview.length > 0 ? `${theme.primary} ${theme.primaryHover}` : 'bg-gray-300 cursor-not-allowed'}
          `}
        >
          <Upload className="w-5 h-5" /> 確認匯入 {preview.length} 位學生
        </button>
      </div>
    </div>
  );
};

// --- Component: Student Manager (Multi-select Delete & Edit) ---
const StudentManager = ({
  students,
  onClose,
  onDelete,
  onUpdateName,
  theme
}: {
  students: Student[],
  onClose: () => void,
  onDelete: (ids: string[]) => void,
  onUpdateName: (id: string, newName: string) => void,
  theme: ThemePalette
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const toggleSelect = (id: string) => {
    if (editingId) return; // Disable selection while editing
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const startEdit = (e: React.MouseEvent, student: Student) => {
    e.stopPropagation();
    setEditingId(student.id);
    setEditName(student.name);
  };

  const saveEdit = (id: string) => {
    if (editName.trim()) {
      onUpdateName(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map(s => s.id)));
    }
  };

  return (
    <div className="flex flex-col h-[500px]">
      <div className={`p-4 border-b ${theme.border} flex justify-between items-center ${theme.surfaceAlt}`}>
        <div className="flex items-center gap-2">
          <button onClick={handleSelectAll} className={`p-2 rounded-lg hover:${theme.surface} ${theme.text}`}>
            {selectedIds.size === students.length && students.length > 0 ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </button>
          <span className={`font-bold ${theme.text}`}>已選擇 {selectedIds.size} 人</span>
        </div>
        <button
          onClick={() => onDelete(Array.from(selectedIds))}
          disabled={selectedIds.size === 0}
          className={`px-4 py-2 ${theme.accentNegative} text-white rounded-xl font-bold disabled:opacity-50 flex items-center gap-2`}
        >
          <Trash2 className="w-5 h-5" /> 刪除
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {students.map(student => (
          <div
            key={student.id}
            onClick={() => toggleSelect(student.id)}
            className={`p-3 rounded-xl border ${selectedIds.has(student.id) ? `${theme.primary} border-transparent text-white` : `${theme.border} ${theme.surface} hover:${theme.surfaceAlt}`} flex items-center justify-between cursor-pointer transition`}
          >
            <div className="flex items-center gap-3 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedIds.has(student.id) ? 'bg-white/20' : `${theme.primary} text-white`}`}>
                {student.name.charAt(0)}
              </div>

              {editingId === student.id ? (
                <div className="flex-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className={`flex-1 p-1 px-2 rounded bg-white text-black text-sm outline-none border-2 ${theme.focusRing}`}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && saveEdit(student.id)}
                  />
                  <button onClick={() => saveEdit(student.id)} className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600"><Check className="w-4 h-4" /></button>
                </div>
              ) : (
                <span className={`font-bold ${selectedIds.has(student.id) ? 'text-white' : theme.text}`}>{student.name}</span>
              )}
            </div>

            {!editingId && (
              <div className="flex items-center gap-2">
                {selectedIds.has(student.id) ? <Check className="w-5 h-5" /> : (
                  <button
                    onClick={(e) => startEdit(e, student)}
                    className={`p-2 rounded-full hover:bg-black/10 transition ${theme.textLight} hover:${theme.text}`}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {students.length === 0 && <div className={`text-center py-10 ${theme.textLight}`}>目前無學生</div>}
      </div>
    </div>
  );
};

// --- Workspace: Student Detail ---
const StudentDetailWorkspace = ({
  userUid,
  student,
  onBack,
  theme,
  classConfig
}: {
  userUid: string,
  student: Student,
  onBack: () => void,
  theme: ThemePalette,
  classConfig: ClassConfig
}) => {
  const [mode, setMode] = useState<'daily' | 'ai'>('daily');
  const [currentDate, setCurrentDate] = useState(formatDate(new Date()));

  // Note & Security State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [tempNote, setTempNote] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Behavior Settings Modal
  const [isBehaviorSettingsOpen, setIsBehaviorSettingsOpen] = useState(false);

  const positiveBehaviors = classConfig.customBehaviors?.positive || DEFAULT_POSITIVE_BEHAVIORS;
  const negativeBehaviors = classConfig.customBehaviors?.negative || DEFAULT_NEGATIVE_BEHAVIORS;

  const handleUpdateBehaviors = async (type: 'positive' | 'negative', newBtns: BehaviorButton[]) => {
    const ref = doc(db, `users/${userUid}/settings/config`);
    const currentConfig = classConfig;
    const updatedBehaviors = {
      positive: type === 'positive' ? newBtns : positiveBehaviors,
      negative: type === 'negative' ? newBtns : negativeBehaviors
    };
    await setDoc(ref, { ...currentConfig, customBehaviors: updatedBehaviors }, { merge: true });
  };

  const handleAddPoint = async (behavior: BehaviorButton) => {
    const studentRef = doc(db, `users/${userUid}/students/${student.id}`);
    const newPoint: PointLog = { id: crypto.randomUUID(), label: behavior.label, value: behavior.value, timestamp: Date.now() };
    const currentDayRecord = student.dailyRecords[currentDate] || { points: [], note: '' };
    const updatedPoints = [...currentDayRecord.points, newPoint];
    await updateDoc(studentRef, { totalScore: increment(behavior.value), [`dailyRecords.${currentDate}`]: { points: updatedPoints, note: currentDayRecord.note } });
  };

  const handleDeleteGroup = async (label: string, value: number) => {
    const studentRef = doc(db, `users/${userUid}/students/${student.id}`);
    const currentDayRecord = student.dailyRecords[currentDate];
    if (!currentDayRecord) return;

    // Find last index of this label
    const reversedPoints = [...currentDayRecord.points].reverse();
    const targetIndexInReversed = reversedPoints.findIndex(p => p.label === label);

    if (targetIndexInReversed !== -1) {
      // Filter out ONLY that specific instance (by ID preferably, but here we find it first)
      const targetPoint = reversedPoints[targetIndexInReversed];
      const updatedPoints = currentDayRecord.points.filter(p => p.id !== targetPoint.id);

      await updateDoc(studentRef, {
        totalScore: increment(-targetPoint.value),
        [`dailyRecords.${currentDate}`]: { points: updatedPoints, note: currentDayRecord.note }
      });
    }
  };

  // --- Secure Note Logic ---
  const handleVerifyAndOpenNotes = async () => {
    if (!auth.currentUser || !auth.currentUser.email) return;
    setIsVerifying(true);
    setVerifyError('');
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, verifyPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      setShowPasswordModal(false);
      setVerifyPassword('');
      const currentDayRecord = student.dailyRecords[currentDate] || { points: [], note: '' };
      setTempNote(currentDayRecord.note || '');
      setIsNoteModalOpen(true);
    } catch (err: any) {
      setVerifyError('密碼錯誤');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveNote = async () => {
    const studentRef = doc(db, `users/${userUid}/students/${student.id}`);
    const currentDayRecord = student.dailyRecords[currentDate] || { points: [], note: '' };
    await updateDoc(studentRef, { [`dailyRecords.${currentDate}`]: { points: currentDayRecord.points, note: tempNote } });
    setIsNoteModalOpen(false);
  };

  // --- AI Logic ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [tempComment, setTempComment] = useState(student.comment);
  const [commentLength, setCommentLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [originalAiText, setOriginalAiText] = useState(student.originalAiComment || "");
  const [isCopied, setIsCopied] = useState(false);
  const [activeEvaluationTab, setActiveEvaluationTab] = useState(0); // 0: Personality, 1: Learning, 2: Life

  useEffect(() => {
    setTempComment(student.comment);
    if (student.originalAiComment) {
      setOriginalAiText(student.originalAiComment);
    }
  }, [student.comment, student.originalAiComment]);

  const handleToggleTag = async (tag: string) => {
    const studentRef = doc(db, `users/${userUid}/students/${student.id}`);
    if (student.tags.includes(tag)) {
      await updateDoc(studentRef, { tags: arrayRemove(tag) });
    } else {
      await updateDoc(studentRef, { tags: arrayUnion(tag) });
    }
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      const generatedText = await generateStudentComment(student, "", commentLength);
      setTempComment(generatedText);
      setOriginalAiText(generatedText);
      const studentRef = doc(db, `users/${userUid}/students/${student.id}`);
      await updateDoc(studentRef, { comment: generatedText, originalAiComment: generatedText });
    } catch (err: any) {
      alert("生成失敗: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveComment = async () => {
    const studentRef = doc(db, `users/${userUid}/students/${student.id}`);
    await updateDoc(studentRef, { comment: tempComment });
    if (originalAiText && tempComment) {
      const distance = levenshteinDistance(originalAiText, tempComment);
      const logRef = collection(db, `users/${userUid}/research_logs`);
      await addDoc(logRef, { studentId: student.id, type: 'comment_edit', timestamp: Date.now(), originalLength: originalAiText.length, finalLength: tempComment.length, editDistance: distance, lengthSetting: commentLength });
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
      const logRef = collection(db, `users/${userUid}/research_logs`);
      await addDoc(logRef, { studentId: student.id, type: 'comment_copy', timestamp: Date.now(), originalLength: originalAiText.length, finalLength: tempComment.length, editDistance: distance, lengthSetting: commentLength });
    }
  };

  const dayRecord = student.dailyRecords[currentDate] || { points: [], note: '' };
  const hasNote = dayRecord.note && dayRecord.note.trim().length > 0;

  // Grouping logic for points
  const groupPoints = (points: PointLog[]) => {
    const groups: Record<string, { label: string, count: number, totalValue: number, singleValue: number }> = {};
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
          <div className={`flex ${theme.surfaceAlt} p-1.5 rounded-xl`}>
            <button onClick={() => setMode('daily')} className={`px-5 py-2 text-sm font-bold rounded-lg transition ${mode === 'daily' ? `${theme.surface} ${theme.text} shadow-sm` : `${theme.textLight} hover:${theme.text}`}`}>日常紀錄</button>
            <button onClick={() => setMode('ai')} className={`px-5 py-2 text-sm font-bold rounded-lg transition flex items-center gap-1 ${mode === 'ai' ? `${theme.surface} ${theme.text} shadow-sm` : `${theme.textLight} hover:${theme.text}`}`}><Sparkles className="w-4 h-4" /> AI 評語</button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden">
          {mode === 'daily' ? (
            <div className="flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden">
              <div className={`flex-1 flex flex-col border-r ${theme.border} ${theme.bg} p-6 h-auto lg:h-full lg:overflow-y-auto shrink-0`}>
                <div className="mb-6 shrink-0">
                  <WeeklyCalendar currentDate={currentDate} onDateSelect={setCurrentDate} student={student} theme={theme} />
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
                            onClick={() => handleDeleteGroup(group.label, group.singleValue)}
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
                            onClick={() => handleDeleteGroup(group.label, group.singleValue)}
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
                    onClick={() => setShowPasswordModal(true)}
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
                  <label className={`text-sm font-bold ${theme.primaryText} mb-4 flex items-center gap-2`}><Smile className="w-4 h-4" /> 正面行為</label>
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
            // AI Mode View (Same as before)
            <div className="flex flex-col h-full overflow-y-auto p-6 lg:p-12 max-w-6xl mx-auto w-full">
              <div className="grid lg:grid-cols-2 gap-8 h-full">
                <div className="space-y-8">
                  <div className={`${theme.surface} p-8 rounded-3xl shadow-sm border ${theme.border}`}>
                    {/* Evaluation Tags - Tabbed Interface */}
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
                    <div className={`p-5 rounded-2xl border ${theme.border} ${theme.surfaceAlt} mb-6 min-h-[300px]`}>
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Positive Column */}
                        <div>
                          <h4 className={`text-sm font-bold ${theme.text} mb-3 flex items-center gap-2`}>
                            <div className={`w-2 h-2 rounded-full ${theme.accentPositive}`}></div> 正向特質
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {EVALUATION_CATEGORIES[activeEvaluationTab]?.positive.map(tag => (
                              <button
                                key={tag}
                                onClick={() => handleToggleTag(tag)}
                                className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 w-full md:w-auto text-left md:text-center
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

                        {/* Negative Column */}
                        <div>
                          <h4 className={`text-sm font-bold ${theme.text} mb-3 flex items-center gap-2`}>
                            <div className={`w-2 h-2 rounded-full ${theme.accentNegative}`}></div> 待改進
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {EVALUATION_CATEGORIES[activeEvaluationTab]?.negative.map(tag => (
                              <button
                                key={tag}
                                onClick={() => handleToggleTag(tag)}
                                className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 w-full md:w-auto text-left md:text-center
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
                    <div className={`grid grid-cols-3 gap-2 p-1 ${theme.surfaceAlt} rounded-xl`}>
                      {(['short', 'medium', 'long'] as const).map((len) => (
                        <button key={len} onClick={() => setCommentLength(len)} className={`py-2 text-sm font-bold rounded-lg transition ${commentLength === len ? `${theme.surface} ${theme.text} shadow-sm` : `${theme.textLight} hover:${theme.text}`}`}>
                          {len === 'short' && '短 (50字)'}{len === 'medium' && '標準 (150字)'}{len === 'long' && '詳細 (300字)'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={`${theme.inputBg} p-8 rounded-3xl border ${theme.border} relative overflow-hidden`}>
                    <div className="relative z-10">
                      <h3 className={`text-xl font-bold ${theme.text} mb-2`}>準備生成</h3>
                      <p className={`text-base ${theme.textLight} mb-6`}>系統將讀取該生所有資料作為 AI 上下文。</p>
                      <button onClick={handleGenerateAI} disabled={isGenerating} className={`w-full py-4 ${theme.primary} text-white rounded-2xl font-bold shadow-lg hover:opacity-90 hover:shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2 transform hover:-translate-y-0.5`}>
                        {isGenerating ? <><Sparkles className="w-5 h-5 animate-spin" /> 生成評語中...</> : <><Sparkles className="w-5 h-5" /> 立即生成期末評語</>}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col h-full min-h-[500px]">
                  <div className={`flex-1 ${theme.surface} p-8 rounded-3xl shadow-sm border ${theme.border} flex flex-col relative`}>
                    <label className={`text-sm font-bold ${theme.textLight} mb-4 block flex items-center gap-2`}><School className="w-4 h-4" /> AI 生成結果</label>
                    <textarea value={tempComment} onChange={(e) => setTempComment(e.target.value)} placeholder="評語將顯示於此..." className={`flex-1 w-full p-6 ${theme.inputBg} rounded-2xl border ${theme.border} outline-none focus:ring-2 ${theme.focusRing} transition leading-8 ${theme.text} resize-none text-lg`} />
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

      <Modal isOpen={isNoteModalOpen} onClose={() => setIsNoteModalOpen(false)} title="🔒 輔導紀錄" theme={theme}>
        <div className="space-y-4">
          <p className={`text-sm ${theme.textLight} ${theme.surfaceAlt} p-3 rounded-xl border ${theme.border}`}>此內容僅供教師查看，可紀錄家庭狀況、輔導需求等隱私資訊。</p>
          <textarea className={`w-full h-48 p-4 ${theme.inputBg} border ${theme.border} rounded-xl focus:ring-2 ${theme.focusRing} outline-none resize-none text-base ${theme.text}`} placeholder="請輸入私密觀察紀錄..." value={tempNote} onChange={(e) => setTempNote(e.target.value)} />
          <div className="flex gap-2 pt-2">
            <button onClick={handleSaveNote} className={`flex-1 py-3 ${theme.primary} text-white rounded-xl font-bold hover:opacity-90`}>儲存</button>
            <button onClick={() => setIsNoteModalOpen(false)} className={`flex-1 py-3 ${theme.surfaceAlt} ${theme.text} rounded-xl font-bold hover:opacity-80`}>取消</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showPasswordModal} onClose={() => { setShowPasswordModal(false); setVerifyPassword(''); setVerifyError(''); }} title="🔒 安全驗證" theme={theme}>
        <div className="space-y-4">
          <p className="text-sm text-[#c48a8a] bg-[#fcecec] p-3 rounded-xl border border-[#e6bwbw]">為了保護學生隱私，請輸入密碼以解鎖輔導紀錄。</p>
          <div>
            <label className={`block text-sm font-bold ${theme.text} mb-2`}>請輸入登入密碼：</label>
            <input type="password" className={`w-full p-3 ${theme.inputBg} border ${theme.border} rounded-xl focus:ring-2 focus:ring-[#c48a8a] outline-none ${theme.text}`} value={verifyPassword} onChange={(e) => setVerifyPassword(e.target.value)} placeholder="Password" />
            {verifyError && <p className="text-xs text-red-500 mt-2 font-bold">{verifyError}</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleVerifyAndOpenNotes} disabled={isVerifying || !verifyPassword} className={`flex-1 py-3 ${theme.primary} text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50`}>{isVerifying ? '驗證中...' : '解鎖紀錄'}</button>
            <button onClick={() => setShowPasswordModal(false)} className={`flex-1 py-3 ${theme.surfaceAlt} ${theme.text} rounded-xl font-bold hover:opacity-80`}>取消</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isBehaviorSettingsOpen} onClose={() => setIsBehaviorSettingsOpen(false)} title="⚙️ 自訂快速記分按鈕" theme={theme}>
        <div className="space-y-6">
          <BehaviorEditor buttons={positiveBehaviors} onUpdate={(btns) => handleUpdateBehaviors('positive', btns)} title="正面行為 (Positive)" theme={theme} />
          <div className={`border-t ${theme.border}`}></div>
          <BehaviorEditor buttons={negativeBehaviors} onUpdate={(btns) => handleUpdateBehaviors('negative', btns)} title="待改進 (Improvement)" theme={theme} />
          <div className="pt-2">
            <button onClick={() => setIsBehaviorSettingsOpen(false)} className={`w-full py-3 ${theme.primary} text-white rounded-xl font-bold`}>完成設定</button>
          </div>
        </div>
      </Modal>
    </>
  );
};

// --- Live Assistant Floating Button ---
const LiveAssistantButton = ({ theme }: { theme: ThemePalette }) => {
  const [isActive, setIsActive] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isTalking, setIsTalking] = useState(false);

  const liveSession = useRef<LiveSession | null>(null);

  const toggleLive = async () => {
    if (isActive) {
      await liveSession.current?.disconnect();
      setIsActive(false);
      setIsTalking(false);
    } else {
      setIsError(false);
      liveSession.current = new LiveSession({
        onConnect: () => setIsActive(true),
        onDisconnect: () => {
          setIsActive(false);
          setIsTalking(false);
        },
        onError: (e) => {
          console.error(e);
          setIsError(true);
          setIsActive(false);
        },
        onAudioData: () => {
          setIsTalking(true);
          setTimeout(() => setIsTalking(false), 200); // Simple visual feedback decay
        }
      });
      await liveSession.current.connect();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {isError && (
        <div className="bg-red-500 text-white text-xs px-3 py-1 rounded-lg animate-pop-in mb-2 shadow-lg">
          連線失敗，請檢查 API Key 或網路
        </div>
      )}
      <button
        onClick={toggleLive}
        className={`
            w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 transform
            ${isActive
            ? 'bg-gradient-to-tr from-blue-500 to-purple-600 scale-110 ring-4 ring-purple-200'
            : `${theme.primary} hover:scale-105`
          }
         `}
      >
        {isActive ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Antigravity Pulse Effect */}
            <div className={`absolute inset-0 rounded-full border-2 border-white/30 ${isTalking ? 'animate-ping' : ''}`}></div>
            <Activity className={`w-8 h-8 text-white ${isTalking ? 'animate-pulse' : ''}`} />
          </div>
        ) : (
          <Mic className="w-8 h-8 text-white" />
        )}
      </button>
      <div className={`bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full ${isActive ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
        Antigravity Mode
      </div>
    </div>
  );
};

// --- Missing Components Implementation ---

const Sidebar = ({
  userUid,
  students,
  selectedStudentId,
  onSelectStudent,
  onManageStudents,
  onLogout,
  fontSizeLevel,
  setFontSizeLevel,
  isDarkMode,
  setIsDarkMode,
  theme
}: {
  userUid: string,
  students: Student[],
  selectedStudentId: string | null,
  onSelectStudent: (id: string | null) => void,
  onManageStudents: () => void,
  onLogout: () => void,
  fontSizeLevel: number,
  setFontSizeLevel: (level: number) => void,
  isDarkMode: boolean,
  setIsDarkMode: (v: boolean) => void,
  theme: ThemePalette
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        className={`lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg ${theme.surface} shadow-md border ${theme.border}`}
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        <Users className={`w-6 h-6 ${theme.text}`} />
      </button>

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0 
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        ${theme.surfaceAlt} border-r ${theme.border} 
        flex flex-col h-full
      `}>
        {/* Header Section */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectStudent(null)}>
            <div className={`p-2 rounded-xl ${theme.primary} text-white shadow-lg`}>
              <School className="w-6 h-6" />
            </div>
            <h1 className={`font-bold text-xl ${theme.text} tracking-tight`}>主畫面</h1>
          </div>
        </div>

        {/* Student List Section - KEY FIX: min-h-0 for flex child to scroll */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className={`px-4 py-3 flex items-center justify-between shrink-0`}>
            <span className={`text-xs font-bold ${theme.textLight} uppercase tracking-wider`}>學生名單 ({students.length})</span>
            <button
              onClick={onManageStudents}
              className={`p-1.5 rounded-lg hover:${theme.surface} transition ${theme.textLight} hover:${theme.text}`}
              title="管理學生"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          <div className={`flex-1 overflow-y-auto px-3 pb-4 space-y-1 custom-scrollbar ${fontSizeLevel === 0 ? 'text-sm' :
            fontSizeLevel === 1 ? 'text-base' :
              fontSizeLevel === 2 ? 'text-lg' : 'text-xl'
            }`}>
            {students.map(student => (
              <button
                key={student.id}
                onClick={() => {
                  onSelectStudent(student.id);
                  setIsMobileOpen(false);
                }}
                className={`
                  w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center justify-between group
                  ${selectedStudentId === student.id
                    ? `${theme.surface} shadow-md border ${theme.border} ${theme.text}`
                    : `hover:${theme.surface} hover:shadow-sm ${theme.textLight} hover:${theme.text}`}
                `}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0
                    ${selectedStudentId === student.id ? `${theme.primary} text-white` : `${theme.surfaceAccent} ${theme.textLight}`}
                  `}>
                    {student.name.charAt(0)}
                  </div>
                  <span className="font-bold truncate">{student.name}</span>
                </div>
                {student.totalScore !== 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ${student.totalScore > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {student.totalScore > 0 ? '+' : ''}{student.totalScore}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Footer Section */}
        <div className={`p-4 border-t ${theme.border} space-y-3 shrink-0`}>
          <div className="flex items-center justify-between px-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-lg hover:${theme.surface} ${theme.textLight} hover:${theme.text} transition`}
              title="切換深色模式"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className={`flex items-center gap-1 ${theme.surface} rounded-lg border ${theme.border} p-1`}>
              <button
                onClick={() => setFontSizeLevel(Math.max(0, fontSizeLevel - 1))}
                className={`p-1.5 rounded-md hover:${theme.surfaceAlt} ${theme.textLight} hover:${theme.text} transition disabled:opacity-30`}
                disabled={fontSizeLevel === 0}
                title="縮小字體"
              >
                <Minus className="w-4 h-4" />
              </button>
              <Type className={`w-4 h-4 ${theme.text}`} />
              <button
                onClick={() => setFontSizeLevel(Math.min(3, fontSizeLevel + 1))}
                className={`p-1.5 rounded-md hover:${theme.surfaceAlt} ${theme.textLight} hover:${theme.text} transition disabled:opacity-30`}
                disabled={fontSizeLevel === 3}
                title="放大字體"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button
            onClick={onLogout}
            className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl ${theme.surface} border ${theme.border} ${theme.text} hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all font-bold text-sm`}
          >
            <LogOut className="w-4 h-4" /> 登出系統
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
      )}
    </>
  );
};

const WhiteboardWorkspace = ({
  userUid,
  config,
  theme
}: {
  userUid: string,
  config: ClassConfig,
  theme: ThemePalette
}) => {
  const [boardContent, setBoardContent] = useState(config.class_board || '');
  const [isEditing, setIsEditing] = useState(false);
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);

  useEffect(() => {
    setBoardContent(config.class_board || '');
  }, [config.class_board]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getCurrentTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const saveBoard = async () => {
    const ref = doc(db, `users/${userUid}/settings/config`);
    await setDoc(ref, { ...config, class_board: boardContent }, { merge: true });
    setIsEditing(false);
  };

  const displaySchedule = useMemo(() => {
    const day = currentTime.dayOfWeek;
    // 1=Mon, 5=Fri. If Sat/Sun, show nothing or maybe handle differently?
    // User requested "Show Today's".
    return config.weeklySchedule?.find(s => s.dayOfWeek === day);
  }, [config.weeklySchedule, currentTime.dayOfWeek]);

  return (
    <div className="flex flex-col h-full p-6 lg:p-8 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0">
        <div className="flex items-end gap-4">
          <h1 className={`${theme.text} text-5xl font-bold tracking-tight leading-none`}>{currentTime.time}</h1>
          <p className={`${theme.textLight} text-xl font-medium pb-1`}>{currentTime.date}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left: Whiteboard (2/3) */}
        <div className={`flex-[2] ${theme.surface} rounded-3xl border ${theme.border} shadow-sm overflow-hidden flex flex-col`}>
          <div className={`p-6 border-b ${theme.border} flex justify-between items-center ${theme.surfaceAlt}`}>
            <h3 className={`text-lg font-bold ${theme.text} flex items-center gap-2`}>
              <ClipboardList className="w-5 h-5" /> 班級公告欄
            </h3>
            <button
              onClick={() => isEditing ? saveBoard() : setIsEditing(true)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition ${isEditing ? `${theme.primary} text-white` : `${theme.surface} ${theme.text} border ${theme.border}`}`}
            >
              {isEditing ? '儲存' : '編輯'}
            </button>
          </div>
          <div className="flex-1 p-6 relative overflow-y-auto">
            {isEditing ? (
              <textarea
                value={boardContent}
                onChange={(e) => setBoardContent(e.target.value)}
                className={`w-full h-full p-4 ${theme.inputBg} rounded-xl border ${theme.border} focus:ring-2 ${theme.focusRing} outline-none resize-none text-2xl leading-relaxed ${theme.text} font-handwritten notebook-paper`}
                placeholder="請輸入今日事項、聯絡簿內容..."
              />
            ) : (
              <div className={`w-full h-full whitespace-pre-wrap leading-relaxed text-2xl ${theme.text} font-handwritten notebook-paper ${!boardContent && 'text-opacity-50 italic'}`}>
                {boardContent || "尚無公告內容..."}
              </div>
            )}
          </div>
        </div>

        {/* Right: Schedule (1/3) */}
        <div className={`flex-1 ${theme.surface} rounded-3xl border ${theme.border} shadow-sm overflow-hidden flex flex-col`}>
          <div className={`p-6 border-b ${theme.border} ${theme.surfaceAlt} flex justify-between items-center`}>
            <h3 className={`text-lg font-bold ${theme.text} flex items-center gap-2`}>
              <Clock className="w-5 h-5" /> 今日課表
            </h3>
            <button
              onClick={() => setShowScheduleEditor(true)}
              className={`p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition ${theme.textLight} hover:${theme.text}`}
              title="設定課表"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            {displaySchedule && displaySchedule.periods.length > 0 ? (
              <div className="space-y-3">
                {displaySchedule.periods.map((p, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${theme.border} ${theme.bg}`}>
                    <span className={`text-sm ${theme.textLight}`}>{p.periodName}</span>
                    <span className={`font-bold ${theme.text}`}>{p.subject || "---"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                <CalendarIcon className={`w-12 h-12 mb-4 ${theme.textLight}`} />
                <p className={`${theme.text}`}>今日無課程或尚未設定</p>
                <button onClick={() => setShowScheduleEditor(true)} className={`mt-4 text-sm underline ${theme.primary} hover:opacity-80`}>
                  前往設定
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showScheduleEditor}
        onClose={() => setShowScheduleEditor(false)}
        title="編輯課表"
        theme={theme}
        maxWidth="max-w-4xl"
      >
        <ManualScheduleEditor
          initialSchedule={config.weeklySchedule}
          onSave={async (newSchedule) => {
            const ref = doc(db, `users/${userUid}/settings/config`);
            await setDoc(ref, { ...config, weeklySchedule: newSchedule }, { merge: true });
            setShowScheduleEditor(false);
          }}
          theme={theme}
        />
      </Modal>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classConfig, setClassConfig] = useState<ClassConfig>({ class_board: '' });
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fontSizeLevel, setFontSizeLevel] = useState(1);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;

  // Student Manager State
  const [isStudentManagerOpen, setIsStudentManagerOpen] = useState(false);
  const [activeManagerTab, setActiveManagerTab] = useState<'list' | 'import'>('list');
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [showDeleteAuth, setShowDeleteAuth] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const studentsRef = collection(db, `users/${user.uid}/students`);
    const unsubStudents = onSnapshot(studentsRef, (snapshot) => {
      const studentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
      studentList.sort((a, b) => {
        const orderA = a.order ?? 99999;
        const orderB = b.order ?? 99999;
        if (orderA !== orderB) return orderA - orderB;
        return a.id.localeCompare(b.id);
      });
      setStudents(studentList);
      setLoading(false);
    });

    const configRef = doc(db, `users/${user.uid}/settings/config`);
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        setClassConfig(docSnap.data() as ClassConfig);
      } else {
        setDoc(configRef, { class_board: '' });
      }
    });

    return () => { unsubStudents(); unsubConfig(); };
  }, [user?.uid]);

  const handleLogout = () => signOut(auth);

  const handleDeleteSelectedStudents = async () => {
    if (!user || !user.email) return;
    setDeleteError('');
    try {
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);

      const batch = writeBatch(db);
      pendingDeleteIds.forEach(id => {
        const ref = doc(db, `users/${user.uid}/students/${id}`);
        batch.delete(ref);
      });
      await batch.commit();

      setShowDeleteAuth(false);
      setDeletePassword('');
      setPendingDeleteIds([]);
      setIsStudentManagerOpen(false);
      if (selectedStudentId && pendingDeleteIds.includes(selectedStudentId)) {
        setSelectedStudentId(null);
      }
    } catch (err: any) {
      console.error(err);
      setDeleteError('驗證失敗：密碼錯誤');
    }
  };

  const handleUpdateStudentName = async (id: string, newName: string) => {
    if (!user) return;
    try {
      const ref = doc(db, `users/${user.uid}/students/${id}`);
      await updateDoc(ref, { name: newName });
    } catch (error) {
      console.error("Error updating Name:", error);
    }
  };

  const handleImportStudents = async (names: string[]) => {
    if (!user) return;
    const batch = writeBatch(db);
    const existingCount = students.length;

    names.forEach((name, idx) => {
      const newRef = doc(collection(db, `users/${user.uid}/students`));
      const newStudent: Student = {
        id: newRef.id,
        name: name,
        order: existingCount + idx + 1, // Append order
        totalScore: 0,
        tags: [],
        comment: '',
        dailyRecords: {}
      };
      batch.set(newRef, newStudent);
    });

    await batch.commit();
    setActiveManagerTab('list'); // Switch back to list view after import
    alert(`成功匯入 ${names.length} 位學生！`);
  };

  const getFontSizeClass = () => {
    switch (fontSizeLevel) {
      case 0: return 'text-sm';
      case 1: return 'text-base';
      case 2: return 'text-xl';
      case 3: return 'text-2xl';
      default: return 'text-base';
    }
  };

  if (!user && !loading) return <><FontStyles /><Login /></>;
  if (loading) return <div className={`h-screen flex items-center justify-center ${theme.bg} ${theme.text}`}>載入資料中...</div>;

  return (
    <div className={`flex h-screen w-full ${theme.bg} font-sans ${getFontSizeClass()} transition-colors duration-300`}>
      <FontStyles />
      <Sidebar
        userUid={user!.uid}
        students={students}
        selectedStudentId={selectedStudentId}
        onSelectStudent={setSelectedStudentId}
        onManageStudents={() => {
          setActiveManagerTab(students.length === 0 ? 'import' : 'list');
          setIsStudentManagerOpen(true);
        }}
        onLogout={handleLogout}
        fontSizeLevel={fontSizeLevel}
        setFontSizeLevel={setFontSizeLevel}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        theme={theme}
      />
      <div className="flex-1 flex flex-col h-full overflow-hidden p-3 lg:p-4 relative">
        <div className={`flex-1 overflow-hidden rounded-3xl shadow-sm border ${theme.border} ${theme.surface} relative`}>
          {students.length === 0 ? (
            // --- Onboarding / Empty State ---
            <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-fade-in">
              <div className={`w-24 h-24 rounded-full ${theme.surfaceAccent} flex items-center justify-center mb-6 shadow-lg`}>
                <Users className={`w-12 h-12 ${theme.primaryText}`} />
              </div>
              <h2 className={`text-3xl font-bold ${theme.text} mb-4`}>歡迎使用 ClassMate AI</h2>
              <p className={`text-lg ${theme.textLight} max-w-md mb-8 leading-relaxed`}>
                您的班級目前還沒有學生資料。<br />
                請先匯入學生名單，讓我們開始建立您的智慧班級！
              </p>
              <button
                onClick={() => {
                  setActiveManagerTab('import');
                  setIsStudentManagerOpen(true);
                }}
                className={`px-8 py-4 rounded-2xl ${theme.primary} text-white font-bold text-lg shadow-xl hover:scale-105 transition-all flex items-center gap-3`}
              >
                <Upload className="w-6 h-6" /> 立即匯入學生名單
              </button>
            </div>
          ) : selectedStudentId ? (
            <StudentDetailWorkspace
              userUid={user!.uid}
              student={students.find(s => s.id === selectedStudentId)!}
              onBack={() => setSelectedStudentId(null)}
              theme={theme}
              classConfig={classConfig}
            />
          ) : (
            <WhiteboardWorkspace
              userUid={user!.uid}
              config={classConfig}
              theme={theme}
            />
          )}
        </div>
        {/* Antigravity Floating Button */}
        <LiveAssistantButton theme={theme} />
      </div>

      {/* Student Manager Modal */}
      <Modal
        isOpen={isStudentManagerOpen}
        onClose={() => setIsStudentManagerOpen(false)}
        title={activeManagerTab === 'import' ? "匯入學生名單" : "管理學生 (編輯/刪除)"}
        theme={theme}
        maxWidth="max-w-2xl"
      >
        {/* Custom Tabs for Manager */}
        <div className="flex gap-2 mb-4 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 w-fit">
          <button
            onClick={() => setActiveManagerTab('list')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeManagerTab === 'list' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-700'}`}
          >
            學生列表
          </button>
          <button
            onClick={() => setActiveManagerTab('import')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeManagerTab === 'import' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-700'}`}
          >
            批次匯入
          </button>
        </div>

        {activeManagerTab === 'list' ? (
          <StudentManager
            students={students}
            onClose={() => setIsStudentManagerOpen(false)}
            onDelete={(ids) => {
              setPendingDeleteIds(ids);
              setShowDeleteAuth(true);
            }}
            onUpdateName={handleUpdateStudentName}
            theme={theme}
          />
        ) : (
          <StudentImporter
            onImport={handleImportStudents}
            theme={theme}
          />
        )}
      </Modal>

      <Modal
        isOpen={showDeleteAuth}
        onClose={() => {
          setShowDeleteAuth(false);
          setDeletePassword('');
          setDeleteError('');
        }}
        title="刪除確認 (需要密碼)"
        theme={theme}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className={`${theme.text}`}>為了安全起見，請輸入您的登入密碼以確認刪除 {pendingDeleteIds.length} 位學生。</p>
          <input
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            className={`w-full p-3 rounded-xl border ${theme.border} ${theme.inputBg} ${theme.text} focus:ring-2 ${theme.focusRing} outline-none`}
            placeholder="請輸入密碼"
          />
          {deleteError && <p className="text-red-500 text-sm font-bold">{deleteError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowDeleteAuth(false)}
              className={`px-4 py-2 rounded-lg ${theme.textLight} hover:${theme.surfaceAlt}`}
            >
              取消
            </button>
            <button
              onClick={handleDeleteSelectedStudents}
              className={`px-4 py-2 rounded-lg ${theme.accentNegative} text-white font-bold`}
            >
              確認刪除
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}