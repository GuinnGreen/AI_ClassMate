import { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Clock, Settings, Calendar as CalendarIcon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getCurrentTime } from '../utils/date';
import { isCurrentPeriod, getPeriodParts } from '../utils/schedule';
import { updateClassConfig } from '../services/firebaseService';
import { Modal } from './ui/Modal';
import { ManualScheduleEditor } from './ManualScheduleEditor';
import { ClassConfig, BoardWritingMode } from '../types';

export const WhiteboardWorkspace = ({
  userUid,
  config,
  onConfigUpdate,
}: {
  userUid: string;
  config: ClassConfig;
  onConfigUpdate?: (newConfig: ClassConfig) => void;
}) => {
  const theme = useTheme();
  const [boardContent, setBoardContent] = useState(config.class_board || '');
  const [isEditing, setIsEditing] = useState(false);
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const writingMode: BoardWritingMode = config.boardWritingMode ?? 'horizontal-tb';

  const setWritingMode = async (mode: BoardWritingMode) => {
    const newConfig = { ...config, boardWritingMode: mode };
    if (onConfigUpdate) onConfigUpdate(newConfig);
    await updateClassConfig(userUid, newConfig);
  };

  const writingModeOptions: { mode: BoardWritingMode; label: string }[] = [
    { mode: 'horizontal-tb', label: '橫' },
    { mode: 'vertical-lr', label: '直↓→' },
    { mode: 'vertical-rl', label: '直↓←' },
  ];

  const paperClass = writingMode === 'horizontal-tb' ? 'notebook-paper' : 'notebook-paper-vertical';

  useEffect(() => {
    setBoardContent(config.class_board || '');
  }, [config.class_board]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getCurrentTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const saveBoard = async () => {
    const newConfig = { ...config, class_board: boardContent };
    if (onConfigUpdate) onConfigUpdate(newConfig);
    await updateClassConfig(userUid, newConfig);
    setIsEditing(false);
  };

  const displaySchedule = useMemo(() => {
    const day = currentTime.dayOfWeek;
    return config.weeklySchedule?.find(s => s.dayOfWeek === day);
  }, [config.weeklySchedule, currentTime.dayOfWeek]);

  return (
    <div className="flex flex-col h-full p-6 lg:p-8 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-baseline gap-2">
          <Clock className={`w-6 h-6 ${theme.textLight} self-center`} />
          <h1 className={`${theme.text} text-5xl font-extrabold tracking-tight tabular-nums`}>{currentTime.time}</h1>
        </div>
        <div className="flex items-baseline gap-2">
          <CalendarIcon className={`w-5 h-5 ${theme.textLight} self-center`} />
          <p className={`${theme.text} text-2xl font-semibold tracking-wide`}>{currentTime.date}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left: Whiteboard (2/3) */}
        <div className={`flex-[2] ${theme.surface} rounded-3xl border ${theme.border} shadow-sm overflow-hidden flex flex-col`}>
          <div className={`p-6 border-b ${theme.border} flex justify-between items-center ${theme.surfaceAlt}`}>
            <h3 className={`text-lg font-bold ${theme.text} flex items-center gap-2`}>
              <ClipboardList className="w-5 h-5" /> 班級公告欄
            </h3>
            <div className="flex items-center gap-2">
              <div className={`flex rounded-lg border ${theme.border} overflow-hidden text-xs font-bold`}>
                {writingModeOptions.map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => setWritingMode(mode)}
                    className={`px-2.5 py-1.5 transition ${writingMode === mode ? `${theme.primary} text-white` : `${theme.surface} ${theme.text} hover:opacity-80`}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => isEditing ? saveBoard() : setIsEditing(true)}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition ${isEditing ? `${theme.primary} text-white` : `${theme.surface} ${theme.text} border ${theme.border}`}`}
              >
                {isEditing ? '儲存' : '編輯'}
              </button>
            </div>
          </div>
          <div className={`flex-1 p-6 relative ${writingMode !== 'horizontal-tb' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-y-auto'}`}>
            {isEditing ? (
              <textarea
                value={boardContent}
                onChange={(e) => setBoardContent(e.target.value)}
                style={{ writingMode }}
                className={`w-full h-full p-4 ${theme.inputBg} rounded-xl border ${theme.border} focus:ring-2 ${theme.focusRing} outline-none resize-none text-2xl leading-relaxed ${theme.text} font-handwritten ${paperClass}`}
                placeholder="請輸入今日事項、聯絡簿內容..."
              />
            ) : (
              <div
                style={{ writingMode }}
                className={`w-full h-full whitespace-pre-wrap leading-relaxed text-2xl ${theme.text} font-handwritten ${paperClass} ${!boardContent && 'text-opacity-50 italic'}`}
              >
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
                {displaySchedule.periods.map((p, idx) => {
                  const { name, time } = getPeriodParts(p.periodName);
                  const isActive = isCurrentPeriod(p.periodName);

                  return (
                    <div
                      key={idx}
                      className={`
                        grid grid-cols-[auto_1fr_1fr] gap-4 items-center p-3 rounded-xl border transition-all duration-300
                        ${isActive
                          ? `${theme.primary} border-transparent shadow-lg scale-105 z-10`
                          : `${theme.bg} border ${theme.border}`
                        }
                      `}
                    >
                      <span className={`w-12 text-center text-sm font-bold ${isActive ? 'text-white' : theme.text}`}>{name}</span>
                      <span className={`text-center text-xs font-mono whitespace-nowrap ${isActive ? 'text-white/80' : theme.textLight} bg-black/5 dark:bg-white/10 py-1 px-2 rounded-lg`}>{time}</span>
                      <span className={`text-center font-bold text-lg ${isActive ? 'text-white' : theme.text}`}>{p.subject || "---"}</span>
                    </div>
                  );
                })}
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
        maxWidth="max-w-4xl"
      >
        <ManualScheduleEditor
          initialSchedule={config.weeklySchedule}
          onSave={async (newSchedule) => {
            const newConfig = { ...config, weeklySchedule: newSchedule };
            if (onConfigUpdate) onConfigUpdate(newConfig);
            await updateClassConfig(userUid, newConfig);
            setShowScheduleEditor(false);
          }}
        />
      </Modal>
    </div>
  );
};
