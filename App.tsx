import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Users, Upload, PanelLeftOpen } from 'lucide-react';
import { auth } from './firebase';
import { LIGHT_THEME, buildTheme } from './constants/theme';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { Student, ClassConfig, Announcement, CorrectionItem } from './types';
import {
  subscribeToStudents,
  subscribeToConfig,
  subscribeToAnnouncements,
  subscribeToReadAnnouncements,
  subscribeToCorrections,
  updateStudentName,
  updateStudentSeatNumber,
  setStudentScore,
  importStudents,
  deleteStudents,
  updateClassConfig,
} from './services/firebaseService';

import { useAppUpdate } from './hooks/useAppUpdate';
import { UpdateBanner } from './components/UpdateBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FontStyles } from './components/FontStyles';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Modal } from './components/ui/Modal';
const StudentManager = lazy(() => import('./components/StudentManager').then(m => ({ default: m.StudentManager })));
import { StudentImporter } from './components/StudentImporter';
import { StudentDetailWorkspace } from './components/StudentDetailWorkspace';
import { WhiteboardWorkspace } from './components/WhiteboardWorkspace';
import { TeacherToolbar } from './components/TeacherToolbar';

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

function AppInner() {
  const { showError, showSuccess } = useToast();
  const { updateAvailable } = useAppUpdate();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classConfig, setClassConfig] = useState<ClassConfig>({ class_board: '' });
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fontSizeLevel, setFontSizeLevel] = useState(() => {
    try { const saved = localStorage.getItem('fontSizeLevel'); return saved ? Number(saved) : 1; }
    catch { return 1; }
  });
  const [clockSizeLevel, setClockSizeLevel] = useState(() => {
    try { const saved = localStorage.getItem('clockSizeLevel'); return saved ? Number(saved) : 1; }
    catch { return 1; }
  });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [colorScheme, setColorScheme] = useState(() => {
    try { return localStorage.getItem('colorScheme') || 'slate'; }
    catch { return 'slate'; }
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>([]);
  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-desktop-collapsed') === 'true'; }
    catch { return false; }
  });
  const napAutoActiveRef = useRef(false);
  const preNapDarkRef = useRef(false);
  const isDarkModeRef = useRef(false);
  const wasInNapRef = useRef(false);
  const theme = buildTheme(isDarkMode, colorScheme);

  // Student Manager State
  const [isStudentManagerOpen, setIsStudentManagerOpen] = useState(false);
  const [activeManagerTab, setActiveManagerTab] = useState<'list' | 'import'>('list');
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [showDeleteAuth, setShowDeleteAuth] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    try { localStorage.setItem('sidebar-desktop-collapsed', String(isSidebarCollapsed)); }
    catch { /* ignore */ }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    try { localStorage.setItem('fontSizeLevel', String(fontSizeLevel)); }
    catch { /* ignore */ }
  }, [fontSizeLevel]);

  useEffect(() => {
    try { localStorage.setItem('clockSizeLevel', String(clockSizeLevel)); }
    catch { /* ignore */ }
  }, [clockSizeLevel]);

  useEffect(() => {
    try { localStorage.setItem('colorScheme', colorScheme); }
    catch { /* ignore */ }
  }, [colorScheme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const handleSyncError = (label: string) => () => showError(`${label}同步失敗，請檢查網路`);
    const unsubStudents = subscribeToStudents(user.uid, (studentList) => {
      setStudents(studentList);
      setLoading(false);
    }, handleSyncError('學生資料'));
    const unsubConfig = subscribeToConfig(user.uid, setClassConfig, handleSyncError('班級設定'));
    const unsubAnnouncements = subscribeToAnnouncements(setAnnouncements, handleSyncError('公告'));
    const unsubReadAnnouncements = subscribeToReadAnnouncements(user.uid, setReadAnnouncementIds, handleSyncError('已讀狀態'));
    const unsubCorrections = subscribeToCorrections(user.uid, setCorrections, handleSyncError('訂正資料'));
    return () => { unsubStudents(); unsubConfig(); unsubAnnouncements(); unsubReadAnnouncements(); unsubCorrections(); };
  }, [user?.uid, showError]);

  // Nap time auto-dark: keep ref in sync
  useEffect(() => { isDarkModeRef.current = isDarkMode; }, [isDarkMode]);

  const handleToggleDarkMode = useCallback((newValue: boolean) => {
    if (napAutoActiveRef.current) napAutoActiveRef.current = false;
    setIsDarkMode(newValue);
  }, []);

  useEffect(() => {
    const { napTimeStart, napTimeEnd } = classConfig;
    if (!napTimeStart || !napTimeEnd) {
      if (napAutoActiveRef.current) {
        napAutoActiveRef.current = false;
        setIsDarkMode(preNapDarkRef.current);
      }
      wasInNapRef.current = false;
      return;
    }

    const parseTime = (str: string) => {
      const [h, m] = str.split(':').map(Number);
      return h * 60 + m;
    };
    const startMin = parseTime(napTimeStart);
    const endMin = parseTime(napTimeEnd);

    const checkNapTime = () => {
      const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
      const inNap = currentMinutes >= startMin && currentMinutes < endMin;

      if (inNap && !wasInNapRef.current) {
        wasInNapRef.current = true;
        if (!isDarkModeRef.current) {
          preNapDarkRef.current = false;
          napAutoActiveRef.current = true;
          setIsDarkMode(true);
        }
      } else if (!inNap && wasInNapRef.current) {
        wasInNapRef.current = false;
        if (napAutoActiveRef.current) {
          napAutoActiveRef.current = false;
          setIsDarkMode(preNapDarkRef.current);
        }
      }
    };

    checkNapTime();
    const interval = setInterval(checkNapTime, 30_000);
    return () => clearInterval(interval);
  }, [classConfig.napTimeStart, classConfig.napTimeEnd]);

  const handleNapTimeChange = useCallback(async (start: string, end: string) => {
    if (!user) return;
    const prev = classConfig;
    const newConfig = { ...classConfig, napTimeStart: start || '', napTimeEnd: end || '' };
    setClassConfig(newConfig);
    try { await updateClassConfig(user.uid, newConfig); }
    catch (err) {
      console.error('[handleNapTimeChange]', err);
      setClassConfig(prev);
      showError('午休時間儲存失敗');
    }
  }, [user, classConfig, showError]);

  const handleLogout = useCallback(async () => {
    try { await signOut(auth); }
    catch (err) { console.error('[handleLogout]', err); showError('登出失敗，請重試'); }
  }, [showError]);

  const handleManageStudents = useCallback(() => {
    setActiveManagerTab(students.length === 0 ? 'import' : 'list');
    setIsStudentManagerOpen(true);
  }, [students.length]);

  const handleToggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const handleZhuyinToggle = useCallback(async () => {
    if (!user) return;
    const prev = classConfig;
    const newConfig = { ...classConfig, zhuyinMode: !classConfig.zhuyinMode };
    setClassConfig(newConfig);
    try { await updateClassConfig(user.uid, newConfig); }
    catch (err) {
      console.error('[onZhuyinToggle]', err);
      setClassConfig(prev);
      showError('注音設定儲存失敗');
    }
  }, [user, classConfig, showError]);

  const handleDeleteSelectedStudents = async () => {
    if (!user) return;
    setDeleteError('');
    try {
      await deleteStudents(user, deletePassword, pendingDeleteIds);
      setShowDeleteAuth(false);
      setDeletePassword('');
      setPendingDeleteIds([]);
      setIsStudentManagerOpen(false);
      if (selectedStudentId && pendingDeleteIds.includes(selectedStudentId)) {
        setSelectedStudentId(null);
      }
    } catch {
      setDeleteError('驗證失敗：密碼錯誤');
    }
  };

  const handleUpdateStudentName = async (id: string, newName: string) => {
    if (!user) return;
    try {
      await updateStudentName(user.uid, id, newName);
    } catch (error) {
      console.error("Error updating Name:", error);
    }
  };

  const handleUpdateStudentSeatNumber = async (id: string, seatNumber: number) => {
    if (!user) return;
    try { await updateStudentSeatNumber(user.uid, id, seatNumber); }
    catch (err) { console.error('[handleUpdateStudentSeatNumber]', err); showError('座號更新失敗'); }
  };

  const handleUpdateStudentScore = async (id: string, newScore: number) => {
    if (!user) return;
    try { await setStudentScore(user.uid, id, newScore); }
    catch (err) { console.error('[handleUpdateStudentScore]', err); showError('更新分數失敗'); }
  };

  const handleImportStudents = async (names: string[]) => {
    if (!user) return;
    try {
      await importStudents(user.uid, names, students.length);
      setIsStudentManagerOpen(false);
      showSuccess(`成功匯入 ${names.length} 位學生`);
    } catch (err) {
      console.error('[handleImportStudents]', err);
      showError('匯入學生失敗，請重試');
    }
  };

  const getFontSizeClass = () => {
    switch (fontSizeLevel) {
      case 0: return 'text-sm';
      case 1: return 'text-base';
      case 2: return 'text-lg';
      case 3: return 'text-xl';
      case 4: return 'text-2xl';
      default: return 'text-base';
    }
  };

  if (!user && !loading) return <ErrorBoundary><FontStyles zhuyinMode={false} /><Login /></ErrorBoundary>;
  if (loading) return <div className={`h-dvh flex items-center justify-center ${theme.bg} ${theme.text}`}>載入資料中...</div>;

  return (
    <ErrorBoundary>
      {updateAvailable && <UpdateBanner />}
      <ThemeProvider value={theme}>
        <div className={`flex h-dvh w-full ${theme.bg} font-sans ${getFontSizeClass()} transition-colors duration-300 ${classConfig.zhuyinMode ? 'zhuyin-active' : ''}`}>
          <FontStyles zhuyinMode={classConfig.zhuyinMode ?? false} />
          {isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className={`hidden lg:flex fixed left-4 top-4 z-50 p-2 rounded-lg ${theme.surface} shadow-md border ${theme.border} hover:shadow-lg transition-all`}
              title="展開側邊欄"
            >
              <PanelLeftOpen className={`w-5 h-5 ${theme.text}`} />
            </button>
          )}
          <Sidebar
            students={students}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            onManageStudents={handleManageStudents}
            onLogout={handleLogout}
            fontSizeLevel={fontSizeLevel}
            setFontSizeLevel={setFontSizeLevel}
            isDarkMode={isDarkMode}
            setIsDarkMode={handleToggleDarkMode}
            napTimeStart={classConfig.napTimeStart}
            napTimeEnd={classConfig.napTimeEnd}
            onNapTimeChange={handleNapTimeChange}
            classConfig={classConfig}
            onConfigUpdate={setClassConfig}
            userUid={user!.uid}
            user={user!}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebarCollapse={handleToggleSidebarCollapse}
            zhuyinMode={classConfig.zhuyinMode ?? false}
            colorScheme={colorScheme}
            setColorScheme={setColorScheme}
            corrections={corrections}
            announcements={announcements}
            readAnnouncementIds={readAnnouncementIds}
            onZhuyinToggle={handleZhuyinToggle}
          />
          <div className={`flex-1 flex flex-col h-full overflow-hidden p-3 lg:p-4 relative transition-[margin] duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:ml-0' : 'lg:ml-72'}`}>
            <div className={`flex-1 overflow-hidden rounded-3xl shadow-sm border ${theme.border} ${theme.surface} relative`}>
              {students.length === 0 ? (
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
                  <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">
                    不確定怎麼開始？{' '}
                    <a
                      href="https://ai-classmate.com/guide/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      查看操作教學 →
                    </a>
                  </p>
                </div>
              ) : selectedStudentId ? (
                <StudentDetailWorkspace
                  userUid={user!.uid}
                  student={students.find(s => s.id === selectedStudentId)!}
                  students={students}
                  onBack={() => setSelectedStudentId(null)}
                  classConfig={classConfig}
                  onConfigUpdate={setClassConfig}
                />
              ) : (
                <WhiteboardWorkspace
                  userUid={user!.uid}
                  config={classConfig}
                  onConfigUpdate={setClassConfig}
                  clockSizeLevel={clockSizeLevel}
                  setClockSizeLevel={setClockSizeLevel}
                />
              )}
            </div>
          </div>

          <TeacherToolbar students={students} />

          {/* Student Manager Modal */}
          <Modal
            isOpen={isStudentManagerOpen}
            onClose={() => setIsStudentManagerOpen(false)}
            title={activeManagerTab === 'import' ? "匯入學生名單" : "管理學生 (編輯/刪除)"}
            maxWidth="max-w-2xl"
          >
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
              <Suspense fallback={<div className={`p-8 text-center ${theme.textLight}`}>載入學生管理...</div>}>
                <StudentManager
                  students={students}
                  onClose={() => setIsStudentManagerOpen(false)}
                  onDelete={(ids) => {
                    setPendingDeleteIds(ids);
                    setShowDeleteAuth(true);
                  }}
                  onUpdateName={handleUpdateStudentName}
                  onUpdateSeatNumber={handleUpdateStudentSeatNumber}
                  onUpdateScore={handleUpdateStudentScore}
                />
              </Suspense>
            ) : (
              <StudentImporter
                onImport={handleImportStudents}
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
      </ThemeProvider>
    </ErrorBoundary>
  );
}
