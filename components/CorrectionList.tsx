import { useState } from 'react';
import { Plus, CheckCircle2, X, Pencil, Trash2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { Student, CorrectionItem, ClassConfig, DEFAULT_CORRECTION_PRESETS } from '../types';
import { addCorrectionBatch, deleteCorrection, deleteCorrectionsByLabel, updateClassConfig } from '../services/firebaseService';

export function CorrectionList({
  corrections,
  students,
  userUid,
  classConfig,
  onConfigUpdate,
  isEditingPresets,
  onEditingPresetsChange,
}: {
  corrections: CorrectionItem[];
  students: Student[];
  userUid: string;
  classConfig: ClassConfig;
  onConfigUpdate: (config: ClassConfig) => void;
  isEditingPresets: boolean;
  onEditingPresetsChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  const { showError, showSuccess } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [labelLocked, setLabelLocked] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [newPresetName, setNewPresetName] = useState('');

  const presets = classConfig.correctionPresets ?? DEFAULT_CORRECTION_PRESETS;
  const cols = classConfig.correctionColumns ?? 4;
  const colsClass = cols === 3 ? 'grid-cols-3' : cols === 5 ? 'grid-cols-5' : 'grid-cols-4';
  const seatTextClass = cols === 3 ? 'text-2xl' : cols === 5 ? 'text-lg' : 'text-xl';

  const studentMap = new Map(students.map(s => [s.id, s]));

  // 按 label 分組
  const grouped = corrections.reduce<Record<string, CorrectionItem[]>>((acc, c) => {
    if (!acc[c.label]) acc[c.label] = [];
    acc[c.label].push(c);
    return acc;
  }, {});

  const handleDelete = async (correctionId: string) => {
    try { await deleteCorrection(userUid, correctionId); }
    catch (err) { console.error('[handleDelete]', err); showError('刪除訂正失敗'); }
  };

  const handleDeleteGroup = async (label: string) => {
    try { await deleteCorrectionsByLabel(userUid, label, corrections); }
    catch (err) { console.error('[handleDeleteGroup]', err); showError('刪除訂正群組失敗'); }
  };

  const handleAdd = async () => {
    if (!selectedLabel || selectedStudentIds.size === 0) return;
    const count = selectedStudentIds.size;
    try {
      await addCorrectionBatch(userUid, Array.from(selectedStudentIds), selectedLabel);
      setIsAdding(false);
      setSelectedLabel('');
      setLabelLocked(false);
      setSelectedStudentIds(new Set());
      showSuccess(`已新增 ${count} 筆訂正`);
    } catch (err) { console.error('[handleAdd]', err); showError('新增訂正失敗'); }
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddPreset = async () => {
    const name = newPresetName.trim();
    if (!name || presets.includes(name)) return;
    const newPresets = [...presets, name];
    const prev = classConfig;
    const newConfig = { ...classConfig, correctionPresets: newPresets };
    onConfigUpdate(newConfig);
    try {
      await updateClassConfig(userUid, newConfig);
      setNewPresetName('');
    } catch (err) {
      console.error('[handleAddPreset]', err);
      onConfigUpdate(prev);
      showError('新增預設類型失敗');
    }
  };

  const handleDeletePreset = async (preset: string) => {
    const newPresets = presets.filter(p => p !== preset);
    const prev = classConfig;
    const newConfig = { ...classConfig, correctionPresets: newPresets };
    onConfigUpdate(newConfig);
    try {
      await updateClassConfig(userUid, newConfig);
      if (selectedLabel === preset) setSelectedLabel('');
    } catch (err) {
      console.error('[handleDeletePreset]', err);
      onConfigUpdate(prev);
      showError('刪除預設類型失敗');
    }
  };

  const getSeatNumber = (studentId: string) => {
    const s = studentMap.get(studentId);
    return s?.seatNumber ?? s?.order ?? 0;
  };

  if (isEditingPresets) {
    return (
      <div className="px-3 pb-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-bold ${theme.text}`}>管理訂正類型</span>
          <button onClick={() => onEditingPresetsChange(false)} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${theme.primary} text-white hover:opacity-90 transition`}>
            儲存
          </button>
        </div>
        <div className="space-y-1.5">
          {presets.map(preset => (
            <div key={preset} className={`flex items-center justify-between p-2.5 rounded-xl ${theme.surfaceAlt}`}>
              <span className={`text-sm font-bold ${theme.text}`}>{preset}</span>
              <button
                onClick={() => handleDeletePreset(preset)}
                className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddPreset()}
            placeholder="新增類型名稱..."
            className={`flex-1 px-3 py-2 text-sm rounded-xl border ${theme.border} ${theme.inputBg} ${theme.text} outline-none focus:ring-2 ${theme.focusRing}`}
          />
          <button
            onClick={handleAddPreset}
            disabled={!newPresetName.trim()}
            className={`px-3 py-2 rounded-xl text-sm font-bold ${theme.primary} text-white disabled:opacity-40 transition`}
          >
            新增
          </button>
        </div>

        {/* 每行顯示座號數 */}
        <div className="pt-2">
          <span className={`text-xs font-bold ${theme.text} mb-2 block`}>每行顯示座號數</span>
          <div className="flex gap-2">
            {([3, 4, 5] as const).map(n => {
              const active = cols === n;
              return (
                <button
                  key={n}
                  onClick={async () => {
                    const newConfig = { ...classConfig, correctionColumns: n };
                    onConfigUpdate(newConfig);
                    await updateClassConfig(userUid, newConfig);
                  }}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all
                    ${active
                      ? `${theme.primary} text-white shadow-md`
                      : `${theme.surfaceAlt} ${theme.text} hover:shadow-md`
                    }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (isAdding) {
    const selectableIds = selectedLabel
      ? students
          .filter(s => !corrections.some(c => c.label === selectedLabel && c.studentId === s.id))
          .map(s => s.id)
      : [];
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedStudentIds.has(id));
    const toggleAll = () => {
      if (allSelected) setSelectedStudentIds(new Set());
      else setSelectedStudentIds(new Set(selectableIds));
    };
    return (
      <div className="px-3 pb-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-bold ${theme.text}`}>{labelLocked ? `新增訂正 — ${selectedLabel}` : '新增訂正'}</span>
          <button onClick={() => { setIsAdding(false); setSelectedLabel(''); setLabelLocked(false); setSelectedStudentIds(new Set()); }} className={`p-1 rounded-lg ${theme.textLight} hover:${theme.text} transition`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 選擇類型 */}
        {!labelLocked && (
        <div>
          <span className={`text-[10px] font-bold ${theme.textLight} mb-1.5 block`}>選擇類型</span>
          <div className="flex flex-wrap gap-1.5">
            {presets.map(preset => (
              <button
                key={preset}
                onClick={() => setSelectedLabel(preset)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${selectedLabel === preset
                    ? `${theme.primary} text-white shadow-md`
                    : `${theme.surfaceAlt} ${theme.textLight} hover:${theme.text} hover:shadow-md`
                  }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        )}

        {/* 選擇學生 */}
        {selectedLabel && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[10px] font-bold ${theme.textLight}`}>選擇學生</span>
              <button
                onClick={toggleAll}
                disabled={selectableIds.length === 0}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition disabled:opacity-30 ${
                  allSelected
                    ? `${theme.primary} text-white`
                    : `${theme.surfaceAlt} ${theme.text} hover:opacity-80 border ${theme.border}`
                }`}
              >
                {allSelected ? '取消全選' : '全選'}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {students.map(s => {
                const seat = s.seatNumber ?? s.order ?? '?';
                const isSelected = selectedStudentIds.has(s.id);
                // 已經有此標籤的訂正中的學生
                const alreadyHas = corrections.some(c => c.label === selectedLabel && c.studentId === s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => !alreadyHas && toggleStudent(s.id)}
                    disabled={alreadyHas}
                    className={`p-1.5 rounded-lg text-xs font-bold transition-all text-center
                      ${alreadyHas
                        ? `${theme.surfaceAlt} ${theme.textLight} opacity-40 cursor-not-allowed`
                        : isSelected
                          ? `${theme.primary} text-white shadow-md`
                          : `${theme.surfaceAlt} ${theme.text} hover:shadow-md`
                      }`}
                    title={alreadyHas ? `${s.name} 已在訂正名單中` : s.name}
                  >
                    {seat}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 確認按鈕 */}
        <button
          onClick={handleAdd}
          disabled={!selectedLabel || selectedStudentIds.size === 0}
          className={`w-full py-2.5 rounded-xl text-sm font-bold ${theme.primary} text-white disabled:opacity-40 transition hover:opacity-90`}
        >
          新增 {selectedStudentIds.size > 0 ? `(${selectedStudentIds.size} 人)` : ''}
        </button>
      </div>
    );
  }

  // 主列表視圖
  return (
    <div className="px-3 pb-4 space-y-2">
      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 opacity-60">
          <Pencil className={`w-10 h-10 mb-3 ${theme.textLight}`} />
          <p className={`text-sm ${theme.textLight}`}>目前沒有待訂正項目</p>
        </div>
      ) : (
        Object.entries(grouped).map(([label, items]) => {
          const sorted = [...items].sort((a, b) => getSeatNumber(a.studentId) - getSeatNumber(b.studentId));
          return (
            <div key={label} className={`p-3 rounded-xl ${theme.surfaceAlt} space-y-2`}>
              <div className="flex items-center justify-between">
                <span className={`text-base font-bold ${theme.text}`}>{label}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedLabel(label);
                      setLabelLocked(true);
                      setSelectedStudentIds(new Set());
                      setIsAdding(true);
                    }}
                    className={`flex items-center justify-center p-1.5 rounded-lg ${theme.textLight} hover:text-blue-600 hover:bg-blue-50 transition`}
                    title="新增學生到此類型"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(label)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${theme.textLight} hover:text-green-600 hover:bg-green-50 transition`}
                    title="全部完成"
                  >
                    <CheckCircle2 className="w-3 h-3" /> 全部完成
                  </button>
                </div>
              </div>
              <div className={`grid ${colsClass} gap-1.5`}>
                {sorted.map(item => {
                  const seat = getSeatNumber(item.studentId);
                  const student = studentMap.get(item.studentId);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleDelete(item.id)}
                      className={`w-full aspect-square rounded-full flex items-center justify-center ${seatTextClass} font-bold ${theme.surfaceAccent} ${theme.text} hover:bg-green-100 hover:text-green-600 hover:shadow-md transition-all`}
                      title={`${student?.name ?? '?'} — 點擊完成`}
                    >
                      {seat}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* 底部按鈕 */}
      <button
        onClick={() => setIsAdding(true)}
        className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold ${theme.surfaceAlt} ${theme.text} hover:shadow-md transition`}
      >
        <Plus className="w-4 h-4" /> 新增訂正
      </button>
    </div>
  );
}
