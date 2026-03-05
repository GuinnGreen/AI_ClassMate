import { useState } from 'react';
import { CheckSquare, Square, Trash2, Edit3, Check, Hash, Star } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Student } from '../types';

export const StudentManager = ({
  students,
  onClose,
  onDelete,
  onUpdateName,
  onUpdateSeatNumber,
  onUpdateScore,
}: {
  students: Student[];
  onClose: () => void;
  onDelete: (ids: string[]) => void;
  onUpdateName: (id: string, newName: string) => void;
  onUpdateSeatNumber: (id: string, seatNumber: number) => void;
  onUpdateScore: (id: string, newScore: number) => void;
}) => {
  const theme = useTheme();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editingSeatId, setEditingSeatId] = useState<string | null>(null);
  const [editSeatNum, setEditSeatNum] = useState('');
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [editScoreVal, setEditScoreVal] = useState('');

  const toggleSelect = (id: string) => {
    if (editingId || editingSeatId || editingScoreId) return;
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const startEdit = (e: React.MouseEvent, student: Student) => {
    e.stopPropagation();
    setEditingSeatId(null);
    setEditingScoreId(null);
    setEditingId(student.id);
    setEditName(student.name);
  };

  const saveEdit = (id: string) => {
    if (editName.trim()) {
      onUpdateName(id, editName.trim());
    }
    setEditingId(null);
  };

  const startSeatEdit = (e: React.MouseEvent, student: Student) => {
    e.stopPropagation();
    setEditingId(null);
    setEditingScoreId(null);
    setEditingSeatId(student.id);
    setEditSeatNum(String(student.seatNumber ?? student.order ?? ''));
  };

  const saveSeatEdit = (id: string) => {
    const num = parseInt(editSeatNum, 10);
    if (!isNaN(num) && num >= 1) {
      onUpdateSeatNumber(id, num);
    }
    setEditingSeatId(null);
  };

  const startScoreEdit = (e: React.MouseEvent, student: Student) => {
    e.stopPropagation();
    setEditingId(null);
    setEditingSeatId(null);
    setEditingScoreId(student.id);
    setEditScoreVal(String(student.totalScore));
  };

  const saveScoreEdit = (id: string) => {
    const num = parseInt(editScoreVal, 10);
    if (!isNaN(num)) {
      onUpdateScore(id, num);
    }
    setEditingScoreId(null);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map(s => s.id)));
    }
  };

  return (
    <div className="flex flex-col h-[500px]">
      <div className={`p-4 border-b ${theme.border} flex justify-between items-center ${theme.surfaceAlt}`}>
        <div className="flex items-center gap-2">
          <button onClick={handleSelectAll} className={`p-2 rounded-lg hover:${theme.surface} ${theme.text}`}>
            {selectedIds.size === students.length && students.length > 0 ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </button>
          <span className={`font-bold ${theme.text}`}>已選擇 {selectedIds.size} 人</span>
        </div>
        <button
          onClick={() => onDelete(Array.from(selectedIds))}
          disabled={selectedIds.size === 0}
          className={`px-4 py-2 ${theme.accentNegative} text-white rounded-xl font-bold disabled:opacity-50 flex items-center gap-2`}
        >
          <Trash2 className="w-5 h-5" /> 刪除
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {students.map(student => (
          <div
            key={student.id}
            onClick={() => toggleSelect(student.id)}
            className={`p-3 rounded-xl border ${selectedIds.has(student.id) ? `${theme.primary} border-transparent text-white` : `${theme.border} ${theme.surface} hover:${theme.surfaceAlt}`} flex items-center justify-between cursor-pointer transition`}
          >
            <div className="flex items-center gap-3 flex-1">
              {editingSeatId === student.id ? (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <input
                    type="number"
                    min="1"
                    value={editSeatNum}
                    onChange={e => setEditSeatNum(e.target.value)}
                    className="w-14 p-1 px-2 rounded bg-white text-black text-sm outline-none border-2 border-blue-400 text-center"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveSeatEdit(student.id); if (e.key === 'Escape') setEditingSeatId(null); }}
                  />
                  <button onClick={() => saveSeatEdit(student.id)} className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600"><Check className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedIds.has(student.id) ? 'bg-white/20' : `${theme.primary} text-white`}`}>
                  {student.seatNumber ?? student.order ?? '?'}
                </div>
              )}

              {editingId === student.id ? (
                <div className="flex-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className={`flex-1 p-1 px-2 rounded bg-white text-black text-sm outline-none border-2 ${theme.focusRing}`}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && saveEdit(student.id)}
                  />
                  <button onClick={() => saveEdit(student.id)} className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600"><Check className="w-4 h-4" /></button>
                </div>
              ) : (
                <span className={`font-bold ${selectedIds.has(student.id) ? 'text-white' : theme.text}`}>{student.name}</span>
              )}
            </div>

            {!editingId && !editingSeatId && !editingScoreId && (
              <div className="flex items-center gap-1">
                {selectedIds.has(student.id) ? <Check className="w-5 h-5" /> : (
                  <>
                    {/* 積分顯示 + 編輯 */}
                    <span className={`text-sm font-bold ${theme.textLight} mr-1`}>{student.totalScore > 0 ? '+' : ''}{student.totalScore}</span>
                    <button
                      onClick={(e) => startScoreEdit(e, student)}
                      className={`p-2 rounded-full hover:bg-black/10 transition ${theme.textLight} hover:${theme.text}`}
                      title="設定積分"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => startSeatEdit(e, student)}
                      className={`p-2 rounded-full hover:bg-black/10 transition ${theme.textLight} hover:${theme.text}`}
                      title="編輯座號"
                    >
                      <Hash className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => startEdit(e, student)}
                      className={`p-2 rounded-full hover:bg-black/10 transition ${theme.textLight} hover:${theme.text}`}
                      title="編輯姓名"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}
            {editingScoreId === student.id && (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <input
                  type="number"
                  value={editScoreVal}
                  onChange={e => setEditScoreVal(e.target.value)}
                  className="w-20 p-1 px-2 rounded bg-white text-black text-sm outline-none border-2 border-yellow-400 text-center"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveScoreEdit(student.id); if (e.key === 'Escape') setEditingScoreId(null); }}
                />
                <button onClick={() => saveScoreEdit(student.id)} className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600"><Check className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        ))}
        {students.length === 0 && <div className={`text-center py-10 ${theme.textLight}`}>目前無學生</div>}
      </div>
    </div>
  );
};
