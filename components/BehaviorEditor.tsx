import { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { BehaviorButton } from '../types';

export const BehaviorEditor = ({
  buttons,
  onUpdate,
  title,
  fixedValue
}: {
  buttons: BehaviorButton[];
  onUpdate: (btns: BehaviorButton[]) => void;
  title: string;
  fixedValue: number;
}) => {
  const theme = useTheme();
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    onUpdate([...buttons, { id: crypto.randomUUID(), label: newLabel, value: fixedValue }]);
    setNewLabel('');
  };

  const handleRemove = (id: string) => {
    onUpdate(buttons.filter(b => b.id !== id));
  };

  return (
    <div className="mb-6">
      <h4 className={`font-bold ${theme.text} mb-2`}>{title}</h4>
      <div className="space-y-2 mb-3">
        {buttons.map(btn => (
          <div key={btn.id} className={`flex items-center justify-between p-2 rounded-lg border ${theme.border} ${theme.bg}`}>
            <span className={theme.text}>{btn.label} ({btn.value > 0 ? `+${btn.value}` : btn.value})</span>
            <button onClick={() => handleRemove(btn.id)} className="text-[#c48a8a] hover:bg-white rounded p-1"><X className="w-4 h-4" /></button>
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
        <button onClick={handleAdd} className={`${theme.primary} text-white p-2 px-4 rounded-lg font-bold flex items-center shadow-md hover:opacity-90 active:scale-95 transition`}>
          新增
        </button>
      </div>
    </div>
  );
};
