import { useState, useEffect } from 'react';
import {
  Users, LogOut, School, Edit3, Moon, Sun,
  Plus, Minus, Type, Sunset
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Modal } from './ui/Modal';
import { Student } from '../types';

export const Sidebar = ({
  students,
  selectedStudentId,
  onSelectStudent,
  onManageStudents,
  onLogout,
  fontSizeLevel,
  setFontSizeLevel,
  isDarkMode,
  setIsDarkMode,
}: {
  students: Student[];
  selectedStudentId: string | null;
  onSelectStudent: (id: string | null) => void;
  onManageStudents: () => void;
  onLogout: () => void;
  fontSizeLevel: number;
  setFontSizeLevel: (level: number) => void;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  napTimeStart?: string;
  napTimeEnd?: string;
  onNapTimeChange: (start: string, end: string) => void;
}) => {
  const theme = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showNapSettings, setShowNapSettings] = useState(false);
  const [napStart, setNapStart] = useState(napTimeStart || '');
  const [napEnd, setNapEnd] = useState(napTimeEnd || '');

  useEffect(() => {
    setNapStart(napTimeStart || '');
    setNapEnd(napTimeEnd || '');
  }, [napTimeStart, napTimeEnd]);

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

        {/* Student List Section */}
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
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-lg hover:${theme.surface} ${theme.textLight} hover:${theme.text} transition`}
                title="切換深色模式"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowNapSettings(true)}
                className={`p-2 rounded-lg hover:${theme.surface} transition ${napTimeStart && napTimeEnd ? theme.text : theme.textLight} hover:${theme.text}`}
                title="午休自動深色設定"
              >
                <Sunset className="w-5 h-5" />
              </button>
            </div>
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

      <Modal
        isOpen={showNapSettings}
        onClose={() => setShowNapSettings(false)}
        title="午休自動深色模式"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className={`text-sm ${theme.textLight}`}>設定午休時段，系統將自動切換為深色模式，結束後恢復原本主題。</p>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className={`block text-sm font-bold mb-1 ${theme.text}`}>開始時間</label>
              <input
                type="time"
                value={napStart}
                onChange={(e) => setNapStart(e.target.value)}
                className={`w-full p-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} outline-none focus:ring-2 ${theme.focusRing}`}
              />
            </div>
            <div className="flex-1">
              <label className={`block text-sm font-bold mb-1 ${theme.text}`}>結束時間</label>
              <input
                type="time"
                value={napEnd}
                onChange={(e) => setNapEnd(e.target.value)}
                className={`w-full p-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} outline-none focus:ring-2 ${theme.focusRing}`}
              />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <button
              onClick={() => {
                onNapTimeChange('', '');
                setShowNapSettings(false);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${theme.textLight} hover:opacity-80 transition`}
            >
              清除
            </button>
            <button
              onClick={() => {
                onNapTimeChange(napStart, napEnd);
                setShowNapSettings(false);
              }}
              disabled={!napStart || !napEnd}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${theme.primary} text-white transition disabled:opacity-40`}
            >
              儲存
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
