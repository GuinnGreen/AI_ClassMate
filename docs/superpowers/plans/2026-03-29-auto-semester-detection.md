# Auto Semester Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual semester date input with automatic detection based on current date using fixed approximation rules derived from 5-year analysis of Taiwan elementary school calendars.

**Architecture:** A new pure utility function `getCurrentSemester()` computes semester boundaries from any given date. App.tsx calls this instead of reading from Firebase config. Sidebar and StudentImporter lose their manual date inputs.

**Tech Stack:** TypeScript, React (existing stack, no new dependencies)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `utils/semester.ts` | Create | Pure function: date → semester info |
| `App.tsx` | Modify | Use `getCurrentSemester()` instead of config values; remove `handleSemesterChange` |
| `components/Sidebar.tsx` | Modify | Remove date inputs, show auto-detected label, keep archive |
| `components/StudentImporter.tsx` | Modify | Remove semester date input section and related props |

---

### Task 1: Create `utils/semester.ts`

**Files:**
- Create: `utils/semester.ts`

- [ ] **Step 1: Create the semester utility**

```typescript
import { formatDate } from './date';

export interface SemesterInfo {
  semesterStart: string;  // "YYYY-MM-DD"
  semesterEnd: string;    // "YYYY-MM-DD"
  label: string;          // e.g. "114 學年度上學期"
}

export const getCurrentSemester = (date: Date = new Date()): SemesterInfo => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  // Month-day as comparable number (e.g. 901 for Sep 1, 120 for Jan 20)
  const md = month * 100 + day;

  if (md >= 901) {
    // Sep 1 ~ Dec 31 → first semester of current academic year
    const academicYear = year - 1911;
    return {
      semesterStart: `${year}-09-01`,
      semesterEnd: `${year + 1}-01-20`,
      label: `${academicYear} 學年度上學期`,
    };
  } else if (md <= 120) {
    // Jan 1 ~ Jan 20 → first semester of previous calendar year's academic year
    const academicYear = year - 1 - 1911;
    return {
      semesterStart: `${year - 1}-09-01`,
      semesterEnd: `${year}-01-20`,
      label: `${academicYear} 學年度上學期`,
    };
  } else if (md <= 210) {
    // Jan 21 ~ Feb 10 → winter break, still counts as first semester
    const academicYear = year - 1 - 1911;
    return {
      semesterStart: `${year - 1}-09-01`,
      semesterEnd: `${year}-01-20`,
      label: `${academicYear} 學年度上學期`,
    };
  } else if (md <= 630) {
    // Feb 11 ~ Jun 30 → second semester
    const academicYear = year - 1 - 1911;
    return {
      semesterStart: `${year}-02-11`,
      semesterEnd: `${year}-06-30`,
      label: `${academicYear} 學年度下學期`,
    };
  } else {
    // Jul 1 ~ Aug 31 → summer break, still counts as second semester
    const academicYear = year - 1 - 1911;
    return {
      semesterStart: `${year}-02-11`,
      semesterEnd: `${year}-06-30`,
      label: `${academicYear} 學年度下學期`,
    };
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add utils/semester.ts
git commit -m "feat: 新增自動學期偵測工具函式"
```

---

### Task 2: Update `App.tsx` — use auto semester

**Files:**
- Modify: `App.tsx:192-197` (remove handleSemesterChange)
- Modify: `App.tsx:350-354` (StudentImporter props)

- [ ] **Step 1: Add import**

Add at the top of `App.tsx` with other util imports:

```typescript
import { getCurrentSemester } from './utils/semester';
```

- [ ] **Step 2: Add semester computation and remove handleSemesterChange**

After the existing state/handler declarations (around line 191), add:

```typescript
const semester = getCurrentSemester();
```

Delete lines 192-197 (`handleSemesterChange` function):

```typescript
// DELETE THIS:
const handleSemesterChange = async (start: string, end: string) => {
  if (!user) return;
  const newConfig = { ...classConfig, semesterStart: start, semesterEnd: end };
  setClassConfig(newConfig);
  await updateClassConfig(user.uid, newConfig);
};
```

- [ ] **Step 3: Update StudentImporter usage**

Change lines 350-355 from:

```tsx
<StudentImporter
  onImport={handleImportStudents}
  semesterStart={classConfig.semesterStart || ''}
  semesterEnd={classConfig.semesterEnd || ''}
  onSemesterChange={handleSemesterChange}
/>
```

To:

```tsx
<StudentImporter
  onImport={handleImportStudents}
/>
```

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: App.tsx 改用自動學期偵測，移除手動學期回呼"
```

---

### Task 3: Update `components/StudentImporter.tsx` — remove semester inputs

**Files:**
- Modify: `components/StudentImporter.tsx` (entire file)

- [ ] **Step 1: Remove semester props and UI**

Replace the entire file with:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/StudentImporter.tsx
git commit -m "feat: StudentImporter 移除手動學期設定區塊"
```

---

### Task 4: Update `components/Sidebar.tsx` — replace date inputs with auto label

**Files:**
- Modify: `components/Sidebar.tsx:1-14` (imports)
- Modify: `components/Sidebar.tsx:68-87` (state/effects)
- Modify: `components/Sidebar.tsx:256-262` (calendar button)
- Modify: `components/Sidebar.tsx:305-311` (AbsenceStatsModal props)
- Modify: `components/Sidebar.tsx:313-408` (semester settings modal)

- [ ] **Step 1: Add import for getCurrentSemester**

In `Sidebar.tsx` line 1-13, add the import:

```typescript
import { getCurrentSemester } from '../utils/semester';
```

Remove `Calendar` from the lucide-react import (line 4) since the calendar icon for semester settings button will be removed. The `Calendar` import is only used for the semester settings button (line 261).

Updated line 2-5:

```typescript
import {
  Users, LogOut, School, Edit3, Moon, Sun,
  Plus, Minus, Type, Sunset, BarChart2, PanelLeftClose, Languages, Bell
} from 'lucide-react';
```

- [ ] **Step 2: Replace semester state with auto computation**

Remove lines 68-70:

```typescript
// DELETE:
const [showSemesterSettings, setShowSemesterSettings] = useState(false);
const [semStart, setSemStart] = useState(classConfig.semesterStart || '');
const [semEnd, setSemEnd] = useState(classConfig.semesterEnd || '');
```

Remove lines 84-87:

```typescript
// DELETE:
useEffect(() => {
  setSemStart(classConfig.semesterStart || '');
  setSemEnd(classConfig.semesterEnd || '');
}, [classConfig.semesterStart, classConfig.semesterEnd]);
```

Add after the remaining state declarations:

```typescript
const semester = getCurrentSemester();
```

Keep `showArchiveConfirm`, `archivePassword`, `archiveError`, `archiving` state — these are still needed for the archive feature.

- [ ] **Step 3: Replace calendar button with semester label display**

Replace lines 256-262 (the calendar button):

```tsx
<button
  onClick={() => setShowSemesterSettings(true)}
  className={`p-2 rounded-lg hover:${theme.surface} transition ${classConfig.semesterStart && classConfig.semesterEnd ? theme.text : theme.textLight} hover:${theme.text}`}
  title="學期設定"
>
  <Calendar className="w-5 h-5" />
</button>
```

With a semester label display:

```tsx
<span className={`text-xs font-bold ${theme.textLight} px-2 py-1`} title={`${semester.semesterStart} ~ ${semester.semesterEnd}`}>
  {semester.label}
</span>
```

- [ ] **Step 4: Update AbsenceStatsModal props**

Replace lines 309-310:

```tsx
semesterStart={classConfig.semesterStart}
semesterEnd={classConfig.semesterEnd}
```

With:

```tsx
semesterStart={semester.semesterStart}
semesterEnd={semester.semesterEnd}
```

- [ ] **Step 5: Simplify semester settings modal**

Replace lines 313-408 (the entire semester settings modal) with just the archive section in a standalone modal. Since there are no more date inputs, the modal only needs to handle archiving:

```tsx
{/* Semester Archive Modal */}
<Modal
  isOpen={showSemesterSettings}
  onClose={() => { setShowSemesterSettings(false); setShowArchiveConfirm(false); setArchivePassword(''); setArchiveError(''); }}
  title="學期封存"
  maxWidth="max-w-sm"
>
  <div className="space-y-4">
    <div className={`p-3 rounded-xl ${theme.surfaceAccent} border ${theme.border}`}>
      <p className={`text-sm font-bold ${theme.text}`}>{semester.label}</p>
      <p className={`text-xs ${theme.textLight} mt-1`}>{semester.semesterStart} ~ {semester.semesterEnd}</p>
    </div>

    <div className={`border-t ${theme.border} pt-4`}>
      <p className={`text-xs ${theme.textLight} mb-2`}>封存學期將清空所有學生的累計分數與每日紀錄，此操作無法復原。</p>
      {!showArchiveConfirm ? (
        <button
          onClick={() => setShowArchiveConfirm(true)}
          className="w-full px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition"
        >
          封存學期
        </button>
      ) : (
        <div className="space-y-3">
          <p className={`text-sm font-bold text-red-500`}>請輸入登入密碼以確認封存</p>
          <input
            type="password"
            value={archivePassword}
            onChange={(e) => { setArchivePassword(e.target.value); setArchiveError(''); }}
            className={`w-full p-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} outline-none focus:ring-2 ${theme.focusRing}`}
            placeholder="請輸入密碼"
          />
          {archiveError && <p className="text-red-500 text-sm font-bold">{archiveError}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowArchiveConfirm(false); setArchivePassword(''); setArchiveError(''); }}
              className={`px-4 py-2 rounded-lg text-sm ${theme.textLight} hover:opacity-80 transition`}
            >
              取消
            </button>
            <button
              onClick={async () => {
                setArchiving(true);
                try {
                  await archiveSemester(user, archivePassword);
                  alert('學期封存完成！所有學生分數與紀錄已重置。');
                  setShowArchiveConfirm(false);
                  setArchivePassword('');
                  setShowSemesterSettings(false);
                } catch {
                  setArchiveError('密碼錯誤，請重新輸入');
                } finally {
                  setArchiving(false);
                }
              }}
              disabled={!archivePassword || archiving}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-40"
            >
              {archiving ? '處理中...' : '確認封存'}
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
</Modal>
```

Note: Keep `showSemesterSettings` state variable — it's still used to toggle the archive modal. Just rename isn't necessary since it's internal state.

- [ ] **Step 6: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: Sidebar 學期設定改為自動偵測，移除手動日期輸入"
```

---

### Task 5: Verify build

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit
```

Expected: No new errors (pre-existing errors about missing @types/react are OK).

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit all if any fixups needed**

---
