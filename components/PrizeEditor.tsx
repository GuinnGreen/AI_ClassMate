import { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { PrizeItem } from '../types';

export const PrizeEditor = ({
  prizes,
  onUpdate,
}: {
  prizes: PrizeItem[];
  onUpdate: (prizes: PrizeItem[]) => void;
}) => {
  const theme = useTheme();
  const [newLabel, setNewLabel] = useState('');
  const [newCost, setNewCost] = useState('');

  const handleAdd = () => {
    const cost = parseInt(newCost, 10);
    if (!newLabel.trim() || isNaN(cost) || cost <= 0) return;
    onUpdate([...prizes, { id: crypto.randomUUID(), label: newLabel.trim(), cost }]);
    setNewLabel('');
    setNewCost('');
  };

  const handleRemove = (id: string) => {
    onUpdate(prizes.filter(p => p.id !== id));
  };

  return (
    <div className="mb-6">
      <h4 className={`font-bold ${theme.text} mb-2`}>🎁 積分商店</h4>
      <div className="space-y-2 mb-3">
        {prizes.map(prize => (
          <div key={prize.id} className={`flex items-center justify-between p-2 rounded-lg border ${theme.border} ${theme.bg}`}>
            <span className={theme.text}>{prize.label} <span className={theme.textLight}>(扣 {prize.cost} 分)</span></span>
            <button onClick={() => handleRemove(prize.id)} className="text-[#c48a8a] hover:bg-white rounded p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="獎品名稱..."
          className={`flex-1 p-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text}`}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <input
          type="number"
          value={newCost}
          onChange={e => setNewCost(e.target.value)}
          placeholder="扣分"
          min="1"
          className={`w-20 p-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} text-center`}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          className={`${theme.primary} text-white p-2 px-4 rounded-lg font-bold flex items-center shadow-md hover:opacity-90 active:scale-95 transition`}
        >
          新增
        </button>
      </div>
    </div>
  );
};
