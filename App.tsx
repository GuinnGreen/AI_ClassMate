import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Users, Upload } from 'lucide-react';
import { auth } from './firebase';
import { LIGHT_THEME, DARK_THEME } from './constants/theme';
import { ThemeProvider } from './contexts/ThemeContext';
import { Student, ClassConfig } from './types';
import {
  subscribeToStudents,
  subscribeToConfig,
  updateStudentName,
  importStudents,
  deleteStudents,
} from './services/firebaseService';

import { ErrorBoundary } from './components/ErrorBoundary';
import { FontStyles } from './components/FontStyles';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Modal } from './components/ui/Modal';
import { StudentManager } from './components/StudentManager';
import { StudentImporter } from './components/StudentImporter';
import { StudentDetailWorkspace } from './components/StudentDetailWorkspace';
import { WhiteboardWorkspace } from './components/WhiteboardWorkspace';

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
    const unsubStudents = subscribeToStudents(user.uid, (studentList) => {
      setStudents(studentList);
      setLoading(false);
    });
    const unsubConfig = subscribeToConfig(user.uid, setClassConfig);
    return () => { unsubStudents(); unsubConfig(); };
  }, [user?.uid]);

  const handleLogout = () => signOut(auth);

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

  const handleImportStudents = async (names: string[]) => {
    if (!user) return;
    await importStudents(user.uid, names, students.length);
    setActiveManagerTab('list');
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

  if (!user && !loading) return <ErrorBoundary><FontStyles /><Login /></ErrorBoundary>;
  if (loading) return <div className={`h-screen flex items-center justify-center ${theme.bg} ${theme.text}`}>載入資料中...</div>;

  return (
    <ErrorBoundary>
      <ThemeProvider value={theme}>
        <div className={`flex h-screen w-full ${theme.bg} font-sans ${getFontSizeClass()} transition-colors duration-300`}>
          <FontStyles />
          <Sidebar
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
          />
          <div className="flex-1 flex flex-col h-full overflow-hidden p-3 lg:p-4 relative">
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
                </div>
              ) : selectedStudentId ? (
                <StudentDetailWorkspace
                  userUid={user!.uid}
                  student={students.find(s => s.id === selectedStudentId)!}
                  onBack={() => setSelectedStudentId(null)}
                  classConfig={classConfig}
                  onConfigUpdate={setClassConfig}
                />
              ) : (
                <WhiteboardWorkspace
                  userUid={user!.uid}
                  config={classConfig}
                  onConfigUpdate={setClassConfig}
                />
              )}
            </div>
          </div>

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
              <StudentManager
                students={students}
                onClose={() => setIsStudentManagerOpen(false)}
                onDelete={(ids) => {
                  setPendingDeleteIds(ids);
                  setShowDeleteAuth(true);
                }}
                onUpdateName={handleUpdateStudentName}
              />
            ) : (
              <StudentImporter onImport={handleImportStudents} />
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
