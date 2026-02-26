import { useState } from 'react';
import { Plus, Trash2, Save, Copy } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { updateClassConfig } from '../services/firebaseService';
import { ClassConfig, BoardSituationTemplate } from '../types';

const DAY_LABELS: { key: number; label: string }[] = [
  { key: 1, label: '週一' },
  { key: 2, label: '週二' },
  { key: 3, label: '週三' },
  { key: 4, label: '週四' },
  { key: 5, label: '週五' },
];

export const BoardTemplateEditor = ({
  config,
  userUid,
  onConfigUpdate,
  onClose,
}: {
  config: ClassConfig;
  userUid: string;
  onConfigUpdate?: (c: ClassConfig) => void;
  onClose: () => void;
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<'daily' | 'situation'>('daily');

  // --- Tab 1: 每日固定 ---
  const [dailyTemplates, setDailyTemplates] = useState<Partial<Record<number, string>>>(
    config.boardDailyTemplates ?? {}
  );
  const [copySourceDay, setCopySourceDay] = useState<number | null>(null);
  const [copyTargetDays, setCopyTargetDays] = useState<Set<number>>(new Set());

  const handleCopyToTargets = () => {
    if (copySourceDay === null) return;
    const content = dailyTemplates[copySourceDay] ?? '';
    const updated = { ...dailyTemplates };
    for (const day of copyTargetDays) {
      updated[day] = content;
    }
    setDailyTemplates(updated);
    setCopySourceDay(null);
    setCopyTargetDays(new Set());
  };

  const handleDailySave = async () => {
    const newConfig: ClassConfig = { ...config, boardDailyTemplates: dailyTemplates };
    onConfigUpdate?.(newConfig);
    await updateClassConfig(userUid, newConfig);
    onClose();
  };

  // --- Tab 2: 情境模板 ---
  const [situations, setSituations] = useState<BoardSituationTemplate[]>(
    config.boardSituationTemplates ?? []
  );
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAddSituation = () => {
    if (!newName.trim()) return;
    const newItem: BoardSituationTemplate = {
      id: `sit-${Date.now()}`,
      name: newName.trim(),
      content: newContent,
    };
    setSituations(prev => [...prev, newItem]);
    setNewName('');
    setNewContent('');
  };

  const handleDeleteSituation = (id: string) => {
    setSituations(prev => prev.filter(s => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleUpdateSituation = (id: string, field: 'name' | 'content', value: string) => {
    setSituations(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSituationSave = async () => {
    const newConfig: ClassConfig = { ...config, boardSituationTemplates: situations };
    onConfigUpdate?.(newConfig);
    await updateClassConfig(userUid, newConfig);
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className={`flex gap-1 p-1 rounded-xl ${theme.surfaceAlt} w-fit`}>
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
            activeTab === 'daily'
              ? `${theme.surface} shadow ${theme.text}`
              : `${theme.textLight} hover:${theme.text}`
          }`}
        >
          每日固定
        </button>
        <button
          onClick={() => setActiveTab('situation')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
            activeTab === 'situation'
              ? `${theme.surface} shadow ${theme.text}`
              : `${theme.textLight} hover:${theme.text}`
          }`}
        >
          情境模板
        </button>
      </div>

      {/* Tab 1: 每日固定 */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          <p className={`text-sm ${theme.textLight}`}>
            設定各天公告欄上方固定顯示的事項（自動依星期切換）
          </p>
          {DAY_LABELS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={`block text-sm font-bold ${theme.text}`}>{label}</label>
                {(dailyTemplates[key] ?? '').trim() && (
                  <button
                    onClick={() => {
                      if (copySourceDay === key) {
                        setCopySourceDay(null);
                        setCopyTargetDays(new Set());
                      } else {
                        setCopySourceDay(key);
                        setCopyTargetDays(new Set());
                      }
                    }}
                    className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 transition
                      ${copySourceDay === key
                        ? `${theme.primary} text-white`
                        : `${theme.textLight} hover:${theme.text} hover:${theme.surfaceAlt}`
                      }`}
                    title="複製到其他天"
                  >
                    <Copy className="w-3 h-3" /> 複製到…
                  </button>
                )}
              </div>
              <textarea
                value={dailyTemplates[key] ?? ''}
                onChange={(e) =>
                  setDailyTemplates(prev => ({ ...prev, [key]: e.target.value }))
                }
                rows={3}
                className={`w-full p-3 ${theme.inputBg} border ${theme.border} rounded-xl text-sm ${theme.text} focus:ring-2 ${theme.focusRing} outline-none resize-none font-handwritten`}
                placeholder={`${label}固定事項（例：升旗典禮 07:40）`}
              />
              {copySourceDay === key && (
                <div className={`flex flex-wrap items-center gap-2 p-2 rounded-lg ${theme.surfaceAlt}`}>
                  <span className={`text-xs ${theme.textLight}`}>複製到：</span>
                  {DAY_LABELS.filter(d => d.key !== key).map(d => (
                    <label key={d.key} className={`flex items-center gap-1 text-xs cursor-pointer select-none ${theme.text}`}>
                      <input
                        type="checkbox"
                        checked={copyTargetDays.has(d.key)}
                        onChange={(e) => {
                          setCopyTargetDays(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(d.key); else next.delete(d.key);
                            return next;
                          });
                        }}
                        className="rounded"
                      />
                      {d.label}
                    </label>
                  ))}
                  <button
                    onClick={handleCopyToTargets}
                    disabled={copyTargetDays.size === 0}
                    className={`text-xs px-3 py-1 rounded-lg font-bold transition
                      ${copyTargetDays.size > 0
                        ? `${theme.primary} text-white hover:opacity-90`
                        : `${theme.textLight} opacity-50 cursor-not-allowed`
                      }`}
                  >
                    確認複製
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleDailySave}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm ${theme.primary} text-white shadow hover:opacity-90 transition flex items-center gap-2`}
            >
              <Save className="w-4 h-4" /> 儲存每日固定
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: 情境模板 */}
      {activeTab === 'situation' && (
        <div className="space-y-4">
          <p className={`text-sm ${theme.textLight}`}>
            新增特定情境的固定提醒（如：老師請假、學校活動），可從公告欄 toolbar 一鍵切換
          </p>

          {/* 現有情境列表 */}
          {situations.length > 0 && (
            <div className={`space-y-3 border ${theme.border} rounded-xl overflow-hidden`}>
              {situations.map(sit => (
                <div key={sit.id} className={`p-3 border-b last:border-b-0 ${theme.border}`}>
                  {editingId === sit.id ? (
                    <div className="space-y-2">
                      <input
                        value={sit.name}
                        onChange={(e) => handleUpdateSituation(sit.id, 'name', e.target.value)}
                        className={`w-full p-2 ${theme.inputBg} border ${theme.border} rounded-lg text-sm font-bold ${theme.text} focus:ring-2 ${theme.focusRing} outline-none`}
                      />
                      <textarea
                        value={sit.content}
                        onChange={(e) => handleUpdateSituation(sit.id, 'content', e.target.value)}
                        rows={3}
                        className={`w-full p-2 ${theme.inputBg} border ${theme.border} rounded-lg text-sm ${theme.text} focus:ring-2 ${theme.focusRing} outline-none resize-none font-handwritten`}
                      />
                      <button
                        onClick={() => setEditingId(null)}
                        className={`text-xs px-3 py-1 rounded-lg ${theme.surface} border ${theme.border} ${theme.textLight} hover:${theme.text} transition`}
                      >
                        完成
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => setEditingId(sit.id)}
                        className="flex-1 text-left space-y-1 hover:opacity-80 transition"
                      >
                        <div className={`font-bold text-sm ${theme.text}`}>{sit.name}</div>
                        <div className={`text-xs ${theme.textLight} line-clamp-2 whitespace-pre-wrap`}>
                          {sit.content || '（無內容）'}
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeleteSituation(sit.id)}
                        className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition shrink-0"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 新增情境 */}
          <div className={`p-4 border ${theme.border} rounded-xl space-y-2 ${theme.surfaceAlt}`}>
            <p className={`text-xs font-bold ${theme.textLight} uppercase tracking-wide`}>新增情境</p>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={`w-full p-2.5 ${theme.inputBg} border ${theme.border} rounded-lg text-sm font-bold ${theme.text} focus:ring-2 ${theme.focusRing} outline-none`}
              placeholder="情境名稱（例：老師請假）"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              className={`w-full p-2.5 ${theme.inputBg} border ${theme.border} rounded-lg text-sm ${theme.text} focus:ring-2 ${theme.focusRing} outline-none resize-none font-handwritten`}
              placeholder="情境內容（例：今日由代課老師上課，請同學配合）"
            />
            <button
              onClick={handleAddSituation}
              disabled={!newName.trim()}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition
                ${newName.trim()
                  ? `${theme.primary} text-white hover:opacity-90`
                  : `${theme.surface} ${theme.textLight} border ${theme.border} opacity-50 cursor-not-allowed`
                }`}
            >
              <Plus className="w-4 h-4" /> 新增
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSituationSave}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm ${theme.primary} text-white shadow hover:opacity-90 transition flex items-center gap-2`}
            >
              <Save className="w-4 h-4" /> 儲存情境模板
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
