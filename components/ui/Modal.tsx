import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  maxWidth?: string;
}) => {
  const theme = useTheme();
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
