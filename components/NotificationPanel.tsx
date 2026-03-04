import { useEffect } from 'react';
import { X, ExternalLink, Megaphone, ClipboardList } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Announcement } from '../types';
import { markAnnouncementAsRead } from '../services/firebaseService';

export const NotificationPanel = ({
  isOpen,
  onClose,
  announcements,
  readIds,
  userUid,
}: {
  isOpen: boolean;
  onClose: () => void;
  announcements: Announcement[];
  readIds: string[];
  userUid: string;
}) => {
  const theme = useTheme();

  // Mark all unread announcements as read when panel opens
  useEffect(() => {
    if (!isOpen) return;
    const unreadIds = announcements
      .filter(a => !readIds.includes(a.id))
      .map(a => a.id);
    unreadIds.forEach(id => markAnnouncementAsRead(userUid, id));
  }, [isOpen, announcements, readIds, userUid]);

  if (!isOpen) return null;

  const pairingCode = userUid.slice(-6).toUpperCase();

  const buildSurveyUrl = (baseUrl: string, paramName?: string): string => {
    if (!paramName) return baseUrl;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${paramName}=${encodeURIComponent(pairingCode)}`;
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className={`w-full max-w-md ${theme.surface} rounded-3xl shadow-2xl overflow-hidden animate-pop-in border ${theme.border}`}>
        <div className={`p-4 border-b ${theme.border} flex justify-between items-center ${theme.surfaceAlt}`}>
          <h3 className={`font-bold text-lg ${theme.text}`}>系統通知</h3>
          <button onClick={onClose} className={`p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition ${theme.textLight}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-3">
          {announcements.length === 0 ? (
            <p className={`text-center py-8 ${theme.textLight}`}>目前沒有通知</p>
          ) : (
            announcements.map(a => (
              <div
                key={a.id}
                className={`p-4 rounded-2xl border ${theme.border} ${!readIds.includes(a.id) ? theme.surfaceAccent : theme.surface} space-y-2`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${a.type === 'survey' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                    {a.type === 'survey' ? <ClipboardList className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-bold ${theme.text}`}>{a.title}</h4>
                      {!readIds.includes(a.id) && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      )}
                    </div>
                    <p className={`text-xs ${theme.textLight} mt-0.5`}>{formatTime(a.createdAt)}</p>
                  </div>
                </div>
                <p className={`text-sm ${theme.text} leading-relaxed whitespace-pre-wrap`}>{a.content}</p>

                {a.type === 'survey' && (
                  <div className="space-y-3 pt-1">
                    {a.showPairingCode && (
                      <div className={`p-3 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20`}>
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-bold mb-1">
                          您的專屬配對碼（請在問卷第一題輸入此代碼）
                        </p>
                        <p className="text-2xl font-mono font-black text-purple-700 dark:text-purple-300 tracking-widest text-center py-1">
                          {pairingCode}
                        </p>
                      </div>
                    )}
                    {a.surveyUrl && (
                      <a
                        href={buildSurveyUrl(a.surveyUrl, a.pairingCodeParam)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition"
                      >
                        <ExternalLink className="w-4 h-4" /> 前往填寫問卷
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
