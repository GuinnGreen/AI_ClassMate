import { useState, useEffect } from 'react';
import {
  Users, LogOut, School, Edit3, Moon, Sun,
  Plus, Minus, Type, Sunset, BarChart2, Calendar, PanelLeftClose, Languages, Bell
} from 'lucide-react';
import { User } from 'firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { Modal } from './ui/Modal';
import { Student, ClassConfig, Announcement } from '../types';
import { formatDate } from '../utils/date';
import { updateClassConfig, archiveSemester } from '../services/firebaseService';
import { AbsenceStatsModal } from './AbsenceStatsModal';
import { NotificationPanel } from './NotificationPanel';

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
  napTimeStart,
  napTimeEnd,
  onNapTimeChange,
  classConfig,
  onConfigUpdate,
  userUid,
  user,
  isSidebarCollapsed,
  onToggleSidebarCollapse,
  zhuyinMode,
  onZhuyinToggle,
  announcements,
  readAnnouncementIds,
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
  classConfig: ClassConfig;
  onConfigUpdate: (config: ClassConfig) => void;
  userUid: string;
  user: User;
  isSidebarCollapsed: boolean;
  onToggleSidebarCollapse: () => void;
  zhuyinMode: boolean;
  onZhuyinToggle: () => void;
  announcements: Announcement[];
  readAnnouncementIds: string[];
}) => {
  const theme = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showNapSettings, setShowNapSettings] = useState(false);
  const [showAbsenceStats, setShowAbsenceStats] = useState(false);
  const [napStart, setNapStart] = useState(napTimeStart || '');
  const [napEnd, setNapEnd] = useState(napTimeEnd || '');
  const [showSemesterSettings, setShowSemesterSettings] = useState(false);
  const [semStart, setSemStart] = useState(classConfig.semesterStart || '');
  const [semEnd, setSemEnd] = useState(classConfig.semesterEnd || '');
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archivePassword, setArchivePassword] = useState('');
  const [archiveError, setArchiveError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = announcements.filter(a => !readAnnouncementIds.includes(a.id)).length;

  useEffect(() => {
    setNapStart(napTimeStart || '');
    setNapEnd(napTimeEnd || '');
  }, [napTimeStart, napTimeEnd]);

  useEffect(() => {
    setSemStart(classConfig.semesterStart || '');
    setSemEnd(classConfig.semesterEnd || '');
  }, [classConfig.semesterStart, classConfig.semesterEnd]);

  const today = formatDate(new Date());

  return (
    <>
      {/* Mobile Toggle Button — 開啟 sidebar 時隱藏 */}
      {!isMobileOpen && (
        <button
          className={`lg:hidden fixed left-4 z-50 p-2 rounded-lg ${theme.surface} shadow-md border ${theme.border} top-[calc(env(safe-area-inset-top,0px)+1rem)]`}
          onClick={() => setIsMobileOpen(true)}
        >
          <Users className={`w-6 h-6 ${theme.text}`} />
        </button>
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ease-in-out
        pt-[env(safe-area-inset-top,0px)] lg:pt-0
        ${isSidebarCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        ${theme.surfaceAlt} border-r ${theme.border}
        flex flex-col h-full
      `}>
        {/* Header Section */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectStudent(null)}>
              <div className={`p-2 rounded-xl ${theme.primary} text-white shadow-lg`}>
                <School className="w-6 h-6" />
              </div>
              <h1 className={`font-bold text-xl ${theme.text} tracking-tight`}>主畫面</h1>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowNotifications(true)}
                className={`relative p-2 rounded-lg hover:${theme.surface} ${theme.textLight} hover:${theme.text} transition`}
                title="系統通知"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500 border-2 border-white dark:border-gray-800" />
                  </span>
                )}
              </button>
              <button
                onClick={onToggleSidebarCollapse}
                className={`hidden lg:flex p-2 rounded-lg hover:${theme.surface} ${theme.textLight} hover:${theme.text} transition`}
                title="收合側邊欄"
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Student List Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className={`px-4 py-3 flex items-center justify-between shrink-0`}>
            <span className={`text-xs font-bold ${theme.textLight} uppercase tracking-wider`}>學生名單 ({students.length})</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowAbsenceStats(true)}
                className={`p-1.5 rounded-lg hover:${theme.surface} transition ${theme.textLight} hover:${theme.text}`}
                title="月請假統計"
              >
                <BarChart2 className="w-4 h-4" />
              </button>
              <button
                onClick={onManageStudents}
                className={`p-1.5 rounded-lg hover:${theme.surface} transition ${theme.textLight} hover:${theme.text}`}
                title="管理學生"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-6 pb-1 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8" />
              <span className={`text-[10px] font-bold ${theme.textLight}`}>姓名</span>
            </div>
            <div className={`flex items-center gap-1 text-[10px] font-bold ${theme.textLight}`}>
              <span className="w-9 text-right">當日</span>
              <span className="w-9 text-right">總分</span>
              <span className="w-9 text-right">假別</span>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto px-3 pb-4 space-y-1 custom-scrollbar ${fontSizeLevel === 0 ? 'text-sm' :
            fontSizeLevel === 1 ? 'text-base' :
              fontSizeLevel === 2 ? 'text-lg' : 'text-xl'
            }`}>
            {students.map(student => {
              const todayScore = student.dailyRecords[today]?.points.reduce((sum, p) => sum + p.value, 0) ?? 0;
              return (
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
                  <div className="flex items-center gap-3 overflow-hidden min-w-0">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0
                      ${selectedStudentId === student.id ? `${theme.primary} text-white` : `${theme.surfaceAccent} ${theme.textLight}`}
                    `}>
                      {student.seatNumber ?? student.order ?? '?'}
                    </div>
                    <span className="font-bold truncate">{student.name}</span>
                  </div>
                  <div className="flex flex-row items-center gap-1 shrink-0">
                    <div className="w-9 flex justify-end">
                      {todayScore !== 0 && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${todayScore > 0 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                          {todayScore > 0 ? '+' : ''}{todayScore}
                        </span>
                      )}
                    </div>
                    <div className="w-9 flex justify-end">
                      {student.totalScore !== 0 && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${student.totalScore > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {student.totalScore > 0 ? '+' : ''}{student.totalScore}
                        </span>
                      )}
                    </div>
                    <div className="w-9 flex justify-end">
                      {student.dailyRecords[today]?.absence && (
                        <span className="text-[10px] font-bold px-1 py-0.5 rounded-md bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {student.dailyRecords[today].absence.replace('假', '')}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
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
              <button
                onClick={() => setShowSemesterSettings(true)}
                className={`p-2 rounded-lg hover:${theme.surface} transition ${classConfig.semesterStart && classConfig.semesterEnd ? theme.text : theme.textLight} hover:${theme.text}`}
                title="學期設定"
              >
                <Calendar className="w-5 h-5" />
              </button>
              <button
                onClick={onZhuyinToggle}
                className={`p-2 rounded-lg hover:${theme.surface} transition ${zhuyinMode ? theme.text : theme.textLight} hover:${theme.text}`}
                title="注音字型開關"
              >
                <Languages className="w-5 h-5" />
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

      <AbsenceStatsModal
        isOpen={showAbsenceStats}
        onClose={() => setShowAbsenceStats(false)}
        students={students}
        semesterStart={classConfig.semesterStart}
        semesterEnd={classConfig.semesterEnd}
      />

      {/* Semester Settings Modal */}
      <Modal
        isOpen={showSemesterSettings}
        onClose={() => { setShowSemesterSettings(false); setShowArchiveConfirm(false); setArchivePassword(''); setArchiveError(''); }}
        title="學期設定"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className={`block text-sm font-bold mb-1 ${theme.text}`}>學期開始</label>
              <input
                type="date"
                value={semStart}
                onChange={(e) => setSemStart(e.target.value)}
                className={`w-full p-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} outline-none focus:ring-2 ${theme.focusRing}`}
              />
            </div>
            <div className="flex-1">
              <label className={`block text-sm font-bold mb-1 ${theme.text}`}>學期結束</label>
              <input
                type="date"
                value={semEnd}
                onChange={(e) => setSemEnd(e.target.value)}
                className={`w-full p-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} outline-none focus:ring-2 ${theme.focusRing}`}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={async () => {
                const newConfig = { ...classConfig, semesterStart: semStart, semesterEnd: semEnd };
                onConfigUpdate(newConfig);
                await updateClassConfig(userUid, newConfig);
                setShowSemesterSettings(false);
              }}
              disabled={!semStart || !semEnd}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${theme.primary} text-white transition disabled:opacity-40`}
            >
              儲存
            </button>
          </div>

          <div className={`border-t ${theme.border} pt-4`}>
            <p className={`text-xs ${theme.textLight} mb-2`}>封存學期將清空所有學生的累計分數與每日紀錄，此操作無法復原。</p>
            {!showArchiveConfirm ? (
              <button
                onClick={() => setShowArchiveConfirm(true)}
                className="w-full px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition"
              >
                封存學期
              </button>
            ) : (
              <div className="space-y-3">
                <p className={`text-sm font-bold text-red-500`}>請輸入登入密碼以確認封存</p>
                <input
                  type="password"
                  value={archivePassword}
                  onChange={(e) => { setArchivePassword(e.target.value); setArchiveError(''); }}
                  className={`w-full p-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} outline-none focus:ring-2 ${theme.focusRing}`}
                  placeholder="請輸入密碼"
                />
                {archiveError && <p className="text-red-500 text-sm font-bold">{archiveError}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowArchiveConfirm(false); setArchivePassword(''); setArchiveError(''); }}
                    className={`px-4 py-2 rounded-lg text-sm ${theme.textLight} hover:opacity-80 transition`}
                  >
                    取消
                  </button>
                  <button
                    onClick={async () => {
                      setArchiving(true);
                      try {
                        await archiveSemester(user, archivePassword);
                        alert('學期封存完成！所有學生分數與紀錄已重置。');
                        setShowArchiveConfirm(false);
                        setArchivePassword('');
                        setShowSemesterSettings(false);
                      } catch {
                        setArchiveError('密碼錯誤，請重新輸入');
                      } finally {
                        setArchiving(false);
                      }
                    }}
                    disabled={!archivePassword || archiving}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-40"
                  >
                    {archiving ? '處理中...' : '確認封存'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <NotificationPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        announcements={announcements}
        readIds={readAnnouncementIds}
        userUid={userUid}
      />

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
