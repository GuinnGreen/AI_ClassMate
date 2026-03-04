import { useState, useEffect, useMemo, useRef } from 'react';
import { ClipboardList, Clock, Settings, Calendar as CalendarIcon, Minus, Plus, LayoutTemplate, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getCurrentTime } from '../utils/date';
import { isCurrentPeriod, getPeriodParts } from '../utils/schedule';
import { updateClassConfig } from '../services/firebaseService';
import { Modal } from './ui/Modal';
import { ManualScheduleEditor } from './ManualScheduleEditor';
import { BoardTemplateEditor } from './BoardTemplateEditor';
import { ClassConfig, BoardWritingMode } from '../types';

const clockSizeMap = [
  { time: 'text-xl lg:text-3xl',   date: 'text-sm lg:text-lg',  clockIcon: 'w-4 h-4 lg:w-5 lg:h-5', calIcon: 'w-3 h-3 lg:w-4 lg:h-4' },
  { time: 'text-3xl lg:text-5xl',  date: 'text-base lg:text-2xl', clockIcon: 'w-5 h-5 lg:w-6 lg:h-6', calIcon: 'w-4 h-4 lg:w-5 lg:h-5' },
  { time: 'text-5xl lg:text-7xl',  date: 'text-xl lg:text-3xl', clockIcon: 'w-6 h-6 lg:w-8 lg:h-8', calIcon: 'w-5 h-5 lg:w-6 lg:h-6' },
  { time: 'text-7xl lg:text-9xl',  date: 'text-2xl lg:text-4xl', clockIcon: 'w-8 h-8 lg:w-10 lg:h-10', calIcon: 'w-6 h-6 lg:w-8 lg:h-8' },
];

const boardFontSizeMap = [
  { template: 'text-base lg:text-xl',  board: 'text-lg lg:text-2xl',  lineHeight: '2.75rem', mobileLineHeight: '2rem' },    // S
  { template: 'text-lg lg:text-2xl',   board: 'text-xl lg:text-3xl',  lineHeight: '3.5rem',  mobileLineHeight: '2.5rem' },   // M（預設）
  { template: 'text-xl lg:text-3xl',   board: 'text-2xl lg:text-4xl', lineHeight: '4.25rem', mobileLineHeight: '3rem' },     // L
  { template: 'text-2xl lg:text-4xl',  board: 'text-3xl lg:text-5xl', lineHeight: '5.5rem',  mobileLineHeight: '3.75rem' },  // XL
];

const scheduleFontSizeMap = [
  { period: 'text-xs',   time: 'text-[10px]', subject: 'text-sm',  gap: 'space-y-1',   padding: 'p-2',   periodW: 'w-10' },  // S
  { period: 'text-sm',   time: 'text-xs',     subject: 'text-base', gap: 'space-y-1.5', padding: 'p-2.5', periodW: 'w-12' },  // M（預設）
  { period: 'text-sm',   time: 'text-xs',     subject: 'text-lg',  gap: 'space-y-2',   padding: 'p-3',   periodW: 'w-12' },  // L
  { period: 'text-base', time: 'text-sm',     subject: 'text-xl',  gap: 'space-y-2.5', padding: 'p-3.5', periodW: 'w-14' },  // XL
];

const useIsLgScreen = () => {
  const [isLg, setIsLg] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsLg(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isLg;
};

export const WhiteboardWorkspace = ({
  userUid,
  config,
  onConfigUpdate,
  clockSizeLevel = 1,
  setClockSizeLevel,
}: {
  userUid: string;
  config: ClassConfig;
  onConfigUpdate?: (newConfig: ClassConfig) => void;
  clockSizeLevel?: number;
  setClockSizeLevel?: (n: number) => void;
}) => {
  const theme = useTheme();
  const cs = clockSizeMap[clockSizeLevel];
  const [boardContent, setBoardContent] = useState(config.class_board || '');
  const [isEditing, setIsEditing] = useState(false);
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showTomorrow, setShowTomorrow] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const writingMode: BoardWritingMode = config.boardWritingMode ?? 'horizontal-tb';
  const showClock = config.showClock ?? true;
  const showBoardLines = config.showBoardLines ?? true;
  const boardFontLevel = config.boardFontSizeLevel ?? 1;
  const bf = boardFontSizeMap[boardFontLevel];
  const isLg = useIsLgScreen();
  const effectiveLineHeight = isLg ? bf.lineHeight : bf.mobileLineHeight;

  const activeSituation = config.activeBoardSituation ?? null;

  const setWritingMode = async (mode: BoardWritingMode) => {
    const newConfig = { ...config, boardWritingMode: mode };
    if (onConfigUpdate) onConfigUpdate(newConfig);
    await updateClassConfig(userUid, newConfig);
  };

  const toggleLines = async () => {
    const newConfig = { ...config, showBoardLines: !showBoardLines };
    if (onConfigUpdate) onConfigUpdate(newConfig);
    await updateClassConfig(userUid, newConfig);
  };

  useEffect(() => {
    if (!showLayoutMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setShowLayoutMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showLayoutMenu]);

  const layoutLabel = writingMode === 'horizontal-tb' ? '橫' : writingMode === 'vertical-lr' ? '直→' : '直←';

  const setActiveSituation = async (id: string | null) => {
    const newConfig = { ...config, activeBoardSituation: id };
    if (onConfigUpdate) onConfigUpdate(newConfig);
    await updateClassConfig(userUid, newConfig);
  };

  const toggleClock = async () => {
    const newConfig = { ...config, showClock: !showClock };
    if (onConfigUpdate) onConfigUpdate(newConfig);
    await updateClassConfig(userUid, newConfig);
  };

  const setBoardFontSize = async (level: number) => {
    const clamped = Math.max(0, Math.min(boardFontSizeMap.length - 1, level));
    const newConfig = { ...config, boardFontSizeLevel: clamped };
    if (onConfigUpdate) onConfigUpdate(newConfig);
    await updateClassConfig(userUid, newConfig);
  };

  const scheduleFontLevel = config.scheduleFontSizeLevel ?? 1;
  const sf = scheduleFontSizeMap[scheduleFontLevel];

  const setScheduleFontSize = async (level: number) => {
    const clamped = Math.max(0, Math.min(scheduleFontSizeMap.length - 1, level));
    const newConfig = { ...config, scheduleFontSizeLevel: clamped };
    if (onConfigUpdate) onConfigUpdate(newConfig);
    await updateClassConfig(userUid, newConfig);
  };

  const writingModeOptions: { mode: BoardWritingMode; label: string }[] = [
    { mode: 'horizontal-tb', label: '橫' },
    { mode: 'vertical-lr', label: '直↓→' },
    { mode: 'vertical-rl', label: '直↓←' },
  ];

  const paperClass = !showBoardLines
    ? ''
    : writingMode === 'horizontal-tb'
      ? 'notebook-paper'
      : `notebook-paper-vertical${writingMode === 'vertical-rl' ? ' notebook-paper-vertical-rl' : ''}`;

  const verticalStyle = writingMode !== 'horizontal-tb'
    ? { writingMode, textOrientation: 'upright' as const }
    : { writingMode };

  const zhuyinMultiplier = (config.zhuyinMode ?? false) ? 1.5 : 1;
  const noLinesStyle = !showBoardLines
    ? { lineHeight: `calc(${effectiveLineHeight} * ${zhuyinMultiplier})` }
    : {};

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
    const tomorrowDayOfWeek = currentTime.dayOfWeek === 6 ? 0 : currentTime.dayOfWeek + 1;
    const targetDay = showTomorrow ? tomorrowDayOfWeek : currentTime.dayOfWeek;
    return config.weeklySchedule?.find(s => s.dayOfWeek === targetDay);
  }, [config.weeklySchedule, currentTime.dayOfWeek, showTomorrow]);

  // Decide which template content to show in the top section
  const templateContent = useMemo(() => {
    if (activeSituation) {
      return config.boardSituationTemplates?.find(t => t.id === activeSituation)?.content ?? '';
    }
    return config.boardDailyTemplates?.[currentTime.dayOfWeek] ?? '';
  }, [activeSituation, config.boardSituationTemplates, config.boardDailyTemplates, currentTime.dayOfWeek]);

  const hasSituationTemplates = (config.boardSituationTemplates?.length ?? 0) > 0;
  const hasDailyTemplates = Object.values(config.boardDailyTemplates ?? {}).some(v => v?.trim());
  const showSituationPills = hasSituationTemplates || hasDailyTemplates;

  return (
    <div className="flex flex-col h-full p-3 lg:p-8 overflow-hidden">
      {/* Header */}
      {showClock ? (
        <div className="group flex flex-col lg:flex-row lg:justify-between lg:items-center mb-3 lg:mb-6 gap-1 lg:gap-0 shrink-0 pl-11 lg:pl-0">
          <div className="flex items-center gap-2 relative">
            <div className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex gap-0.5 mr-1">
              <button
                onClick={toggleClock}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition"
                title="隱藏時鐘"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setClockSizeLevel?.(Math.max(0, clockSizeLevel - 1))}
                disabled={clockSizeLevel === 0}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setClockSizeLevel?.(Math.min(3, clockSizeLevel + 1))}
                disabled={clockSizeLevel === 3}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <Clock className={`${cs.clockIcon} ${theme.textLight} shrink-0`} />
            <h1 className={`${theme.text} ${cs.time} font-extrabold tracking-tight tabular-nums leading-none`}>{currentTime.time}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className={`${cs.calIcon} ${theme.textLight} shrink-0`} />
              <p className={`${theme.text} ${cs.date} font-semibold tracking-wide`}>{currentTime.date}</p>
            </div>
            <a
              href="https://ai-classmate.com/guide/"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${theme.surfaceAlt} ${theme.textLight} hover:${theme.text} transition text-sm font-bold shrink-0`}
            >
              <HelpCircle className="w-4 h-4" />
              操作教學
            </a>
          </div>
        </div>
      ) : (
        <div className="flex justify-end mb-2 shrink-0 pl-11 lg:pl-0">
          <button
            onClick={toggleClock}
            className={`p-1.5 rounded-lg hover:${theme.surfaceAlt} ${theme.textLight} transition`}
            title="顯示時鐘"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 lg:gap-6 flex-1 min-h-0">
        {/* Left: Whiteboard (2/3) */}
        <div className={`flex-[2] ${theme.surface} rounded-3xl border ${theme.border} shadow-sm overflow-hidden flex flex-col`} style={{ '--board-line-height': effectiveLineHeight } as React.CSSProperties}>

          {/* Board toolbar */}
          <div className={`p-4 border-b ${theme.border} flex flex-wrap justify-between items-center gap-2 ${theme.surfaceAlt}`}>
            <h3 className={`text-lg font-bold ${theme.text} flex items-center gap-2 shrink-0 group/font`}>
              <div className="opacity-100 lg:opacity-0 lg:group-hover/font:opacity-100 transition-opacity flex gap-0.5 mr-1">
                <button
                  onClick={() => setBoardFontSize(boardFontLevel - 1)}
                  disabled={boardFontLevel === 0}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setBoardFontSize(boardFontLevel + 1)}
                  disabled={boardFontLevel === boardFontSizeMap.length - 1}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <ClipboardList className="w-5 h-5" /> 班級公告欄
            </h3>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Situation pills (only visible when templates exist) */}
              {showSituationPills && (
                <div className="flex items-center gap-1 flex-wrap">
                  {/* 今日 pill */}
                  <button
                    onClick={() => setActiveSituation(null)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition border ${
                      activeSituation === null
                        ? `${theme.primary} text-white border-transparent`
                        : `${theme.surface} ${theme.text} ${theme.border} hover:opacity-80`
                    }`}
                  >
                    今日
                  </button>
                  {/* Situation template pills */}
                  {config.boardSituationTemplates?.map(sit => (
                    <button
                      key={sit.id}
                      onClick={() => setActiveSituation(sit.id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition border ${
                        activeSituation === sit.id
                          ? `${theme.primary} text-white border-transparent`
                          : `${theme.surface} ${theme.text} ${theme.border} hover:opacity-80`
                      }`}
                    >
                      {sit.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Template editor button */}
              <button
                onClick={() => setShowTemplateEditor(true)}
                className={`p-2 rounded-lg border ${theme.border} ${theme.surface} hover:opacity-80 transition ${theme.textLight}`}
                title="編輯模板"
              >
                <LayoutTemplate className="w-4 h-4" />
              </button>

              {/* Layout settings (writing mode + lines) */}
              <div className="relative" ref={layoutMenuRef}>
                <button
                  onClick={() => setShowLayoutMenu(v => !v)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition ${
                    showLayoutMenu
                      ? `${theme.primary} text-white border-transparent`
                      : `${theme.surface} ${theme.text} ${theme.border} hover:opacity-80`
                  }`}
                  title="版面設定"
                >
                  {layoutLabel}{showBoardLines ? ' ≡' : ''}
                </button>
                {showLayoutMenu && (
                  <div className={`absolute right-0 top-full mt-1 z-50 ${theme.surface} border ${theme.border} rounded-xl shadow-lg p-2 min-w-[140px]`}>
                    <div className={`text-xs font-bold ${theme.textLight} px-2 py-1`}>書寫方向</div>
                    <div className="flex flex-col gap-0.5">
                      {writingModeOptions.map(({ mode, label }) => (
                        <button
                          key={mode}
                          onClick={() => setWritingMode(mode)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold text-left transition ${
                            writingMode === mode
                              ? `${theme.primary} text-white`
                              : `${theme.text} hover:${theme.surfaceAlt}`
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className={`border-t ${theme.border} my-1.5`} />
                    <button
                      onClick={toggleLines}
                      className={`w-full px-3 py-1.5 rounded-lg text-xs font-bold text-left transition flex items-center justify-between ${theme.text} hover:${theme.surfaceAlt}`}
                    >
                      顯示底線
                      <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                        showBoardLines
                          ? `${theme.primary} text-white border-transparent`
                          : `${theme.border}`
                      }`}>
                        {showBoardLines ? '✓' : ''}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Edit / Save daily notes */}
              <button
                onClick={() => isEditing ? saveBoard() : setIsEditing(true)}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition ${isEditing ? `${theme.primary} text-white` : `${theme.surface} ${theme.text} border ${theme.border}`}`}
              >
                {isEditing ? '儲存' : '編輯'}
              </button>
            </div>
          </div>

          {/* Board body */}
          <div className={`flex-1 flex flex-col min-h-0 ${writingMode !== 'horizontal-tb' ? 'flex-row overflow-x-auto' : 'overflow-hidden'}`}>

            {/* Template section (top) — only shown when there is content */}
            {templateContent ? (
              <div
                className={`${writingMode !== 'horizontal-tb' ? 'overflow-y-auto border-r' : 'overflow-x-auto border-b'} ${theme.border} ${theme.surfaceAlt} shrink-0`}
                style={{ flex: '2' }}
              >
                <div
                  className={`p-5 h-full`}
                  style={writingMode !== 'horizontal-tb' ? { minHeight: '100%' } : {}}
                >
                  <div
                    style={{ ...verticalStyle, ...noLinesStyle }}
                    className={`whitespace-pre-wrap ${bf.template} ${theme.text} font-handwritten opacity-80 ${paperClass} w-full h-full`}
                  >
                    {templateContent}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Daily notes section (bottom / main) */}
            <div
              className={`${writingMode !== 'horizontal-tb' ? 'overflow-y-auto' : 'overflow-y-auto'} relative`}
              style={{ flex: '3' }}
            >
              <div className="p-5 h-full">
                {isEditing ? (
                  <textarea
                    value={boardContent}
                    onChange={(e) => setBoardContent(e.target.value)}
                    style={{ ...verticalStyle, ...noLinesStyle }}
                    className={`w-full h-full p-4 ${theme.inputBg} rounded-xl border ${theme.border} focus:ring-2 ${theme.focusRing} outline-none resize-none ${bf.board} ${theme.text} font-handwritten ${paperClass}`}
                    placeholder="請輸入今日事項、聯絡簿內容..."
                  />
                ) : (
                  <div
                    style={{ ...verticalStyle, ...noLinesStyle }}
                    onClick={() => setIsEditing(true)}
                    className={`w-full h-full whitespace-pre-wrap ${bf.board} ${theme.text} font-handwritten ${paperClass} cursor-text ${!boardContent && `${theme.textLight} italic`}`}
                  >
                    {boardContent || "點此輸入今日事項..."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Schedule (1/3) */}
        <div className={`flex-1 ${theme.surface} rounded-3xl border ${theme.border} shadow-sm overflow-hidden flex flex-col`}>
          <div className={`px-4 py-3 border-b ${theme.border} ${theme.surfaceAlt} flex justify-between items-center`}>
            <div className="flex items-center gap-2">
              {/* 字體縮放按鈕（hover 顯示） */}
              <div className="group/schfont flex items-center gap-2">
                <div className="opacity-100 lg:opacity-0 lg:group-hover/schfont:opacity-100 transition-opacity flex gap-0.5">
                  <button
                    onClick={() => setScheduleFontSize(scheduleFontLevel - 1)}
                    disabled={scheduleFontLevel === 0}
                    className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setScheduleFontSize(scheduleFontLevel + 1)}
                    disabled={scheduleFontLevel === scheduleFontSizeMap.length - 1}
                    className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Clock className={`w-5 h-5 ${theme.textLight}`} />
              </div>
              {/* 今日/明日 pill-tab */}
              <div className={`flex ${theme.bg} p-0.5 rounded-lg`}>
                <button
                  onClick={() => setShowTomorrow(false)}
                  className={`px-2.5 py-1 text-sm font-bold rounded-md transition
                    ${!showTomorrow ? `${theme.surface} ${theme.text} shadow-sm` : `${theme.textLight}`}`}
                >
                  今日
                </button>
                <button
                  onClick={() => setShowTomorrow(true)}
                  className={`px-2.5 py-1 text-sm font-bold rounded-md transition
                    ${showTomorrow ? `${theme.surface} ${theme.text} shadow-sm` : `${theme.textLight}`}`}
                >
                  明日
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowScheduleEditor(true)}
              className={`p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition ${theme.textLight}`}
              title="設定課表"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 p-3 overflow-y-auto">
            {displaySchedule && displaySchedule.periods.length > 0 ? (
              <div className={sf.gap}>
                {displaySchedule.periods.map((p, idx) => {
                  const { name, time } = getPeriodParts(p.periodName);
                  const isActive = !showTomorrow && isCurrentPeriod(p.periodName);

                  return (
                    <div
                      key={idx}
                      className={`
                        grid grid-cols-[auto_1fr_1fr] gap-3 items-center ${sf.padding} rounded-xl border transition-all duration-300
                        ${isActive
                          ? `${theme.primary} border-transparent shadow-lg scale-105 z-10`
                          : `${theme.bg} border ${theme.border}`
                        }
                      `}
                    >
                      <span className={`${sf.periodW} text-center ${sf.period} font-bold ${isActive ? 'text-white' : theme.text}`}>{name}</span>
                      <span className={`text-center ${sf.time} font-mono whitespace-nowrap ${isActive ? 'text-white/80' : theme.textLight} bg-black/5 dark:bg-white/10 py-0.5 px-1.5 rounded-md`}>{time}</span>
                      <span className={`text-center font-bold ${sf.subject} ${isActive ? 'text-white' : theme.text}`}>{p.subject || "---"}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                <CalendarIcon className={`w-12 h-12 mb-4 ${theme.textLight}`} />
                <p className={`${theme.text}`}>{showTomorrow ? '明日無課程或尚未設定' : '今日無課程或尚未設定'}</p>
                <button onClick={() => setShowScheduleEditor(true)} className={`mt-4 text-sm underline ${theme.primaryText} hover:opacity-80`}>
                  前往設定
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Editor Modal */}
      <Modal
        isOpen={showScheduleEditor}
        onClose={() => setShowScheduleEditor(false)}
        title="編輯課表"
        maxWidth="max-w-4xl"
      >
        <ManualScheduleEditor
          initialSchedule={config.weeklySchedule}
          userUid={userUid}
          onSave={async (newSchedule) => {
            const newConfig = { ...config, weeklySchedule: newSchedule };
            if (onConfigUpdate) onConfigUpdate(newConfig);
            await updateClassConfig(userUid, newConfig);
            setShowScheduleEditor(false);
          }}
        />
      </Modal>

      {/* Template Editor Modal */}
      <Modal
        isOpen={showTemplateEditor}
        onClose={() => setShowTemplateEditor(false)}
        title="編輯公告模板"
        maxWidth="max-w-2xl"
      >
        <BoardTemplateEditor
          config={config}
          userUid={userUid}
          onConfigUpdate={onConfigUpdate}
          onClose={() => setShowTemplateEditor(false)}
        />
      </Modal>
    </div>
  );
};
