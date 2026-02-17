import { useState, useEffect } from 'react';
import { FileText, Upload } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const StudentImporter = ({
  onImport,
}: {
  onImport: (names: string[]) => void;
}) => {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<string[]>([]);

  useEffect(() => {
    const lines = text.split(/\n/).map(s => s.trim()).filter(s => s.length > 0);
    setPreview(lines);
  }, [text]);

  const handleImport = () => {
    if (preview.length > 0) {
      onImport(preview);
      setText('');
    }
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl ${theme.surfaceAccent} border ${theme.border}`}>
        <h3 className={`font-bold ${theme.text} mb-2 flex items-center gap-2`}>
          <FileText className="w-5 h-5" /> 批次匯入說明
        </h3>
        <p className={`text-sm ${theme.textLight} leading-relaxed`}>
          請直接從 Excel 或試算表中複製整排學生姓名，並貼上到下方欄位。
          <br />
          系統將會自動處理：
          <ul className="list-disc list-inside mt-1 ml-2">
            <li>自動去除空白行</li>
            <li><strong>第一行名字將會是座號 1 號</strong>，以此類推</li>
            <li>支援 Excel 直接複製貼上</li>
          </ul>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label className={`text-sm font-bold ${theme.text} mb-2`}>在此貼上姓名列表</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            className={`flex-1 min-h-[300px] p-4 rounded-xl border ${theme.border} ${theme.inputBg} ${theme.text} focus:ring-2 ${theme.focusRing} outline-none resize-none font-mono text-sm leading-relaxed`}
            placeholder={`王小明\n李大華\n張美美\n...`}
          />
        </div>
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <label className={`text-sm font-bold ${theme.text}`}>預覽確認 ({preview.length} 人)</label>
            <span className={`text-xs ${theme.textLight}`}>確認順序是否正確</span>
          </div>
          <div className={`flex-1 min-h-[300px] max-h-[300px] overflow-y-auto p-0 rounded-xl border ${theme.border} ${theme.surface}`}>
            {preview.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {preview.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 transition">
                    <span className={`w-6 h-6 rounded-full ${theme.primary} text-white flex items-center justify-center text-xs font-bold`}>{idx + 1}</span>
                    <span className={`font-bold ${theme.text}`}>{name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`h-full flex items-center justify-center ${theme.textLight} text-sm`}>
                尚未輸入資料
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleImport}
          disabled={preview.length === 0}
          className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2
            ${preview.length > 0 ? `${theme.primary} ${theme.primaryHover}` : 'bg-gray-300 cursor-not-allowed'}
          `}
        >
          <Upload className="w-5 h-5" /> 確認匯入 {preview.length} 位學生
        </button>
      </div>
    </div>
  );
};
