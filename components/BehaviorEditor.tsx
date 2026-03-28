import { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { BehaviorButton } from '../types';

export const BehaviorEditor = ({
  buttons,
  onUpdate,
  title,
  defaultValue
}: {
  buttons: BehaviorButton[];
  onUpdate: (btns: BehaviorButton[]) => void;
  title: string;
  defaultValue: number;
}) => {
  const theme = useTheme();
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState(Math.abs(defaultValue));
  const sign = defaultValue > 0 ? 1 : -1;

  const handleAdd = () => {
    if (!newLabel.trim() || newValue < 1) return;
    onUpdate([...buttons, { id: crypto.randomUUID(), label: newLabel, value: sign * newValue }]);
    setNewLabel('');
    setNewValue(Math.abs(defaultValue));
  };

  const handleRemove = (id: string) => {
    onUpdate(buttons.filter(b => b.id !== id));
  };

  const handleValueChange = (id: string, absVal: number) => {
    if (absVal < 1) return;
    onUpdate(buttons.map(b => b.id === id ? { ...b, value: sign * absVal } : b));
  };

  return (
    <div className="mb-6">
      <h4 className={`font-bold ${theme.text} mb-2`}>{title}</h4>
      <div className="space-y-2 mb-3">
        {buttons.map(btn => (
          <div key={btn.id} className={`flex items-center justify-between p-2 rounded-lg border ${theme.border} ${theme.bg}`}>
            <span className={`${theme.text} flex-1`}>{btn.label}</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${theme.textLight}`}>{sign > 0 ? '+' : '-'}</span>
              <input
                type="number"
                min={1}
                value={Math.abs(btn.value)}
                onChange={e => handleValueChange(btn.id, parseInt(e.target.value) || 1)}
                className={`w-14 p-1 text-center rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} text-sm`}
              />
              <button onClick={() => handleRemove(btn.id)} className="text-[#c48a8a] hover:bg-white rounded p-1"><X className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="輸入行為名稱..."
          className={`flex-1 p-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text}`}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <div className="flex items-center gap-1">
          <span className={`text-sm ${theme.textLight}`}>{sign > 0 ? '+' : '-'}</span>
          <input
            type="number"
            min={1}
            value={newValue}
            onChange={e => setNewValue(parseInt(e.target.value) || 1)}
            className={`w-14 p-2 text-center rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text}`}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <button onClick={handleAdd} className={`${theme.primary} text-white p-2 px-4 rounded-lg font-bold flex items-center shadow-md hover:opacity-90 active:scale-95 transition`}>
          新增
        </button>
      </div>
    </div>
  );
};
