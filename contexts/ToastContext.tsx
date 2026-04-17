import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, message, duration }]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  const showError = useCallback((message: string) => showToast(message, 'error', 5000), [showToast]);
  const showSuccess = useCallback((message: string) => showToast(message, 'success', 3000), [showToast]);
  const showInfo = useCallback((message: string) => showToast(message, 'info', 3000), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess, showInfo }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: ReactNode }> = {
  success: {
    bg: 'bg-green-50 dark:bg-green-900/30',
    border: 'border-green-300 dark:border-green-700',
    icon: <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />,
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/30',
    border: 'border-red-300 dark:border-red-700',
    icon: <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />,
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-300 dark:border-blue-700',
    icon: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />,
  },
};

const ToastContainer = ({ toasts, onRemove }: { toasts: ToastMessage[]; onRemove: (id: number) => void }) => (
  <>
    <style>{`
      @keyframes toast-slide-in {
        from { opacity: 0; transform: translateX(120%); }
        to   { opacity: 1; transform: translateX(0); }
      }
      .toast-item { animation: toast-slide-in 0.3s ease-out; }
    `}</style>
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map(t => {
        const s = TOAST_STYLES[t.type];
        return (
          <div
            key={t.id}
            className={`toast-item flex items-start gap-3 px-4 py-3 rounded-xl border ${s.bg} ${s.border} shadow-lg backdrop-blur-sm pointer-events-auto`}
          >
            {s.icon}
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => onRemove(t.id)}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition shrink-0"
              aria-label="關閉通知"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  </>
);
