# Auto Semester Detection Design

## Context

ClassMate AI currently requires teachers to manually input semester start/end dates via Sidebar settings. Based on analysis of Taiwan's elementary school calendar over 5 academic years (110-114), semester dates follow a predictable pattern with minor variations. This feature replaces manual input with automatic detection based on the current date.

## Semester Rules

Based on Taiwan MOE regulations and 5-year data analysis:

| Period | Date Range | Semester Assigned |
|--------|-----------|-------------------|
| First semester | 9/1 ~ next year 1/20 | start: {year}/09/01, end: {year+1}/01/20 |
| Winter break | 1/21 ~ 2/10 | Treated as first semester |
| Second semester | 2/11 ~ 6/30 | start: {year}/02/11, end: {year}/06/30 |
| Summer break | 7/1 ~ 8/31 | Treated as second semester |

Academic year label follows Taiwan convention: academic year = calendar year - 1911. First semester starting 2025/9/1 = "114 academic year first semester".

## New File

### `utils/semester.ts`

Pure function `getCurrentSemester(date?: Date)` returns:

```typescript
{
  semesterStart: string;  // "YYYY-MM-DD"
  semesterEnd: string;    // "YYYY-MM-DD"
  label: string;          // e.g. "114 學年度上學期"
}
```

Logic:
- Accepts optional date param (defaults to `new Date()`)
- Determines which period the date falls into using month/day comparison
- Returns the corresponding semester start, end, and label

## Modified Files

### `App.tsx`

- Replace `classConfig.semesterStart` / `classConfig.semesterEnd` usage with `getCurrentSemester()` output
- Remove `handleSemesterChange` callback (no longer needed)
- Pass computed semester values to child components

### `components/Sidebar.tsx`

- Remove semester date input fields (lines ~323-339)
- Remove `semStart` / `semEnd` local state (lines ~68-87)
- Display auto-detected semester label as read-only text
- Keep "archive semester" functionality unchanged

### `components/StudentImporter.tsx`

- Remove semester date input fields (lines ~50-74)
- Remove `semesterStart`, `semesterEnd`, `onSemesterChange` props

## Unchanged

- `types.ts` — keep `semesterStart?` / `semesterEnd?` fields in ClassConfig (backward compat)
- `services/firebaseService.ts` — `archiveSemester()` untouched
- `AbsenceStatsModal` — receives semester props as before, no interface change
- Firebase stored data — existing semesterStart/semesterEnd in config ignored but not deleted

## Verification

1. `npx tsc --noEmit` — no new type errors
2. `npm run build` — build succeeds
3. Manual check: semester label displays correctly in Sidebar for current date
4. AbsenceStatsModal semester tab still filters correctly
