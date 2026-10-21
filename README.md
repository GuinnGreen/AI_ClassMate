# ClassMate AI - 智慧班級經營系統

碩士論文專案，結合 **Google Gemini AI** 與 **Firebase** 的智慧班級經營系統，協助老師進行學生管理、行為紀錄、AI 評語生成及電子白板功能。
---

## 技術棧

| 類別 | 技術 | 版本 |
|------|------|------|
| 前端框架 | React | 19 |
| 型別系統 | TypeScript (strict mode) | 5.8 |
| 建置工具 | Vite | 6 |
| CSS 框架 | Tailwind CSS (`@tailwindcss/vite` plugin) | 4 |
| 後端服務 | Firebase | 12 |
| AI 引擎 | Google Gemini SDK (`@google/genai`) + Groq 備援 | 1.x |
| 圖示 | Lucide React | 0.564 |

---

## 功能特色

- **學生管理** — 批次匯入（支援複製貼上名單）、編輯、刪除學生資料
- **行為紀錄** — 自訂正向 / 待改進行為按鈕，快速加減分
- **AI 評語生成** — RAG 架構，根據學期行為紀錄與老師勾選的特質標籤自動產生期末評語；支援多組 API Key 輪值（指數退避，上限 30 秒），可自訂系統 Prompt；Gemini 額度用盡時自動切換 Groq 備援
- **電子白板 & 課表** — 班級公告白板、每週課表、今日課表即時顯示
- **評量標籤系統** — 3 大類 40+ 標籤，供老師快速勾選學生特質
- **深色模式 & 字體大小** — React Context 驅動的佈景主題切換與字體大小調整
- **密碼驗證保護** — 刪除學生、查看隱私筆記等敏感操作需輸入密碼
- **Error Boundary** — 元件級錯誤捕捉，防止整頁崩潰

---

## 專案結構

```
classmate-ai/
├── App.tsx                      # 主應用程式（狀態管理 + 組合元件）
├── index.tsx                    # React 進入點
├── index.html                   # HTML 模板
├── index.css                    # Tailwind 全域樣式
├── types.ts                     # TypeScript 型別定義
├── firebase.ts                  # Firebase 初始化
├── metadata.json                # 應用程式 metadata
│
├── components/
│   ├── ui/
│   │   ├── Modal.tsx            # 通用 Modal 元件
│   │   └── EditableInput.tsx    # 可編輯輸入欄位
│   ├── Login.tsx                # 登入頁面
│   ├── Sidebar.tsx              # 側邊欄導航
│   ├── StudentManager.tsx       # 學生列表管理
│   ├── StudentImporter.tsx      # 批次匯入學生
│   ├── StudentDetailWorkspace.tsx  # 學生詳細資料工作區
│   ├── WhiteboardWorkspace.tsx  # 電子白板
│   ├── WeeklyCalendar.tsx       # 每週課表
│   ├── BehaviorEditor.tsx       # 行為按鈕編輯器
│   ├── ManualScheduleEditor.tsx # 手動課表編輯器
│   ├── FontStyles.tsx           # 字體大小控制
│   └── ErrorBoundary.tsx        # 錯誤邊界元件
│
├── contexts/
│   └── ThemeContext.tsx          # 佈景主題 Context（ThemeProvider + useTheme）
│
├── constants/
│   └── theme.ts                 # 主題常數（LIGHT_THEME / DARK_THEME）
│
├── services/
│   ├── geminiService.ts         # Gemini AI 服務（多 Key 輪值 + 指數退避）
│   └── firebaseService.ts       # Firebase CRUD 操作
│
├── utils/
│   ├── date.ts                  # 日期工具函式
│   ├── schedule.ts              # 課表解析工具
│   └── levenshtein.ts           # 模糊比對（Levenshtein 距離）
│
├── vite.config.ts               # Vite 設定（含 Tailwind plugin + path alias）
├── tsconfig.json                # TypeScript 設定（strict mode）
├── .env.example                 # 環境變數範例
└── .github/workflows/deploy.yml # GitHub Actions 自動部署
```

---

## 本地開發

### 環境需求

- [Node.js](https://nodejs.org/) v20

### 安裝與啟動

```bash
# 1. 下載專案
git clone https://github.com/YOUR_USERNAME/AI_ClassMate.git
cd AI_ClassMate

# 2. 安裝套件
npm install

# 3. 設定環境變數
cp .env.example .env.local
```

編輯 `.env.local`，填入前端 Firebase 設定：

```ini
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

AI 供應商金鑰由外部部署的 Cloud Functions 執行環境管理（`GEMINI_API_KEY`、`GROQ_API_KEY`、`OPENROUTER_API_KEY`），不屬於 Vite 前端或 GitHub Pages 建置變數。

```bash
# 4. 啟動開發伺服器
npm run dev
```

開啟瀏覽器訪問 `http://localhost:3000` 即可使用。

### Safe local Firebase development

Run Firebase emulators in one terminal:

    npm run emulators

Run the Vite app with emulator configuration in another terminal:

    npm run dev -- --mode test

Run Firestore Rules tests:

    npm run test:rules

The emulator project is always `demo-classmate-ai`. Do not run seed, capture, migration, or destructive scripts with production Firebase configuration.

Staging credentials are not stored in the repository. A staging environment must set `VITE_APP_ENV=staging`, `VITE_ALLOW_REMOTE_FIREBASE=true`, `VITE_USE_FIREBASE_EMULATORS=false`, and a `VITE_FIREBASE_PROJECT_ID` different from `ai-teacher-classroom`; the runtime guard rejects the production project ID.

---

## 部署到 GitHub Pages

### 1. 設定 GitHub Secrets

到 Repository 的 **Settings** > **Secrets and variables** > **Actions** > **New repository secret**，新增以下變數：

| Secret 名稱 | 說明 |
|-------------|------|
| `VITE_FIREBASE_API_KEY` | Firebase API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Measurement ID |

GitHub Pages 僅建置靜態前端；AI 供應商金鑰應設定於另行部署的 Cloud Functions 執行環境，不可注入 Pages 前端建置。

### 2. 設定 GitHub Pages

到 **Settings** > **Pages**，將 **Source** 設為 **GitHub Actions**。

### 3. 設定 Base Path

`vite.config.ts` 中的 `base` 需對應您的 Repository 名稱：

```typescript
export default defineConfig({
  base: '/AI_ClassMate/', // 改為您的 repo 名稱
  // ...
})
```

Push 到 `main` 分支後，GitHub Actions 會自動建置並部署。

### Release identity

`public/version.json` records the exact app and Guide revisions used by the Pages artifact. Cloud Functions and Firestore Rules are labeled `external` because this Pages workflow does not deploy them. A release manifest is evidence of source identity, not proof of live Firebase deployment parity.

The `GUIDE_REF` GitHub repository variable must contain a reviewed 40-character commit SHA from `GuinnGreen/AI_ClassMate_guide`.

---

## License

MIT
