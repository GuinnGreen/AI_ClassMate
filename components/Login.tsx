import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { LIGHT_THEME } from '../constants/theme';
import { School, LogIn, UserPlus } from 'lucide-react';

export const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const theme = LIGHT_THEME;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      if (isRegistering) {
        if (password !== confirmPassword) {
          setError('兩次密碼不一致');
          setLoading(false);
          return;
        }
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('重設密碼信件已寄出，請查看信箱');
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr.code === 'auth/user-not-found') {
        setError('找不到此信箱對應的帳號');
      } else if (firebaseErr.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') {
        setError('系統錯誤：尚未設定 Firebase API Key。');
      } else {
        setError('發送失敗：' + (firebaseErr.message ?? '未知錯誤'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (isForgotPassword) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${theme.bg} p-4 font-sans`}>
        <div className={`w-full max-w-md p-8 space-y-6 ${theme.surface} rounded-3xl shadow-xl border ${theme.border}`}>
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-[#6B7C93] rounded-full shadow-md">
                <LogIn className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className={`text-2xl font-bold ${theme.text}`}>ClassMate AI</h1>
            <p className={`${theme.textLight} mt-2`}>重設您的密碼</p>
          </div>
          <form onSubmit={handleForgotPassword} className="space-y-4">
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
            {error && <p className="text-[#c48a8a] text-sm bg-red-50 p-2 rounded-lg">{error}</p>}
            {successMessage && <p className="text-[#5B8C7B] text-sm bg-green-50 p-2 rounded-lg">{successMessage}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#6B7C93] hover:bg-[#556375] text-white font-bold rounded-2xl shadow-md transition disabled:opacity-50 transform hover:-translate-y-0.5"
            >
              {loading ? '處理中...' : '發送重設信件'}
            </button>
          </form>
          <div className="text-center">
            <button
              type="button"
              onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMessage(''); }}
              className={`text-sm ${theme.textLight} hover:underline`}
            >
              ← 返回登入
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center min-h-screen ${theme.bg} p-4 font-sans`}>
      <div className={`w-full max-w-md p-8 space-y-6 ${theme.surface} rounded-3xl shadow-xl border ${theme.border}`}>
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className={`p-4 ${isRegistering ? 'bg-[#5B8C7B]' : 'bg-[#6B7C93]'} rounded-full shadow-md transition-colors duration-300`}>
              {isRegistering
                ? <UserPlus className="w-10 h-10 text-white" />
                : <LogIn className="w-10 h-10 text-white" />}
            </div>
          </div>
          <h1 className={`text-2xl font-bold ${theme.text}`}>ClassMate AI</h1>
          <p className={`${theme.textLight} mt-2`}>
            {isRegistering ? '建立您的智慧班級' : '歡迎回來，老師'}
          </p>
        </div>
        <div className={`flex rounded-2xl bg-[#FAFAFA] p-1 border ${theme.border}`}>
          <button
            type="button"
            onClick={() => { setIsRegistering(false); setError(''); setConfirmPassword(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
              !isRegistering ? 'bg-[#6B7C93] text-white shadow-sm' : `${theme.textLight}`
            }`}
          >
            <LogIn className="w-4 h-4" />
            登入
          </button>
          <button
            type="button"
            onClick={() => { setIsRegistering(true); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
              isRegistering ? 'bg-[#5B8C7B] text-white shadow-sm' : `${theme.textLight}`
            }`}
          >
            <UserPlus className="w-4 h-4" />
            註冊
          </button>
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
          {isRegistering && (
            <div>
              <label className={`block text-sm font-medium ${theme.text} mb-1`}>確認密碼</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 ${theme.inputBg} border ${theme.border} rounded-2xl focus:ring-2 ${theme.focusRing} outline-none transition ${theme.text}`}
                placeholder="••••••••"
              />
            </div>
          )}
          {error && <p className="text-[#c48a8a] text-sm bg-red-50 p-2 rounded-lg">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 ${
              isRegistering ? 'bg-[#5B8C7B] hover:bg-[#4A7B6B]' : 'bg-[#6B7C93] hover:bg-[#556375]'
            } text-white font-bold rounded-2xl shadow-md transition disabled:opacity-50 transform hover:-translate-y-0.5`}
          >
            {loading ? '處理中...' : (isRegistering ? '註冊帳號' : '進入系統')}
          </button>
          {!isRegistering && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setIsForgotPassword(true); setError(''); setPassword(''); }}
                className={`text-sm ${theme.textLight} hover:underline`}
              >
                忘記密碼？
              </button>
            </div>
          )}
        </form>
        <p className={`text-center text-sm ${theme.textLight}`}>
          第一次使用？{' '}
          <a
            href="https://ai-classmate.com/guide/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-70"
          >
            查看操作教學 →
          </a>
        </p>
      </div>
    </div>
  );
};
