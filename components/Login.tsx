import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { LIGHT_THEME } from '../constants/theme';
import { School } from 'lucide-react';

export const Login = () => {
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
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') {
        setError('系統錯誤：尚未設定 Firebase API Key。');
      } else {
        setError(isRegistering ? '註冊失敗：' + (firebaseErr.message ?? '未知錯誤') : '登入失敗，請檢查帳號密碼。');
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
