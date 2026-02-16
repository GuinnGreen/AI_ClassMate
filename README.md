# ClassMate AI - 智慧班級經營系統

這是一個結合 **Google Gemini AI** 與 **Firebase** 的智慧班級經營系統，協助老師進行學生管理、行為紀錄、AI 評語生成以及電子白板功能。

<div align="center">
<img width="800" alt="Dashboard Preview" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## 🚀 專案功能
- **學生管理**：批次匯入、編輯、刪除學生資料。
- **行為紀錄**：自訂正向/待改進行為按鈕，快速加減分。
- **AI 輔助評語**：根據學生學期紀錄與老師勾選的特質標籤，自動生成期末評語。
- **電子白板 & 課表**：首頁整合班級公告與今日課表。
- **資料安全**：重要操作（如刪除、查看隱私筆記）需密碼驗證。

---

## 🛠️ 本地開發 (Local Development)

### 1. 環境準備
請確保您已安裝 [Node.js](https://nodejs.org/) (建議 v18+)。

### 2. 下載專案 & 安裝套件
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
npm install
```

### 3. 設定環境變數 (.env)
本專案使用 Google Gemini API 與 Firebase。
請複製範例檔案 `.env.example` 為 `.env.local`，並填入您的 API Keys。

```bash
cp .env.example .env.local
```

打開 `.env.local` 填寫：
```ini
# Google Gemini API
# 支援多組 API Key 輪值 (用逗號隔開) 以避免 Rate Limit
GEMINI_API_KEY=key1,key2,key3

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_key_here
# ... 其他 Firebase 設定
```

### 4. 啟動開發伺服器
```bash
npm run dev
```
打開瀏覽器訪問 `http://localhost:3000` 即可開始使用。

---

## 📦 部署到 GitHub Pages (Deployment)

本專案已設定 GitHub Actions 自動部署流程。

### 1. 準備 GitHub Repository
將此專案 Push 到您的 GitHub Repository。

### 2. 設定 GitHub Secrets
為了讓 GitHub Actions 能讀取環境變數進行 Build，請到 GitHub Repository 的 **Settings** > **Secrets and variables** > **Actions** > **New repository secret**，依序新增以下變數 (對應您的 `.env.local`)：

- `GEMINI_API_KEY`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

### 3. 設定 GitHub Pages
到 **Settings** > **Pages**：
- **Source**: 選擇 `GitHub Actions` (Beta) 或 `Deploy from a branch` (若 Action 成功跑完會自動切換)。
- 建議直接選擇 **GitHub Actions** 作為 Source。

### 4. 設定 Base Path (重要！)
若您的網址是 `https://username.github.io/repo-name/`，請務必修改 `vite.config.ts`：

```typescript
export default defineConfig({
  base: '/repo-name/', // 請將 repo-name 改為您的專案名稱
  // ...
})
```
修改後 Push 上去，GitHub Actions 就會自動開始部署。

---

## 📂 檔案結構說明
- `.env.example`: 環境變數範例檔 (上傳至 GitHub)
- `.env.local`: 實際環境變數 (**請勿上傳至 GitHub**)
- `.github/workflows/deploy.yml`: 自動部署腳本
- `src/`: 原始碼目錄
  - `types.ts`: TypeScript 型別定義
  - `services/`: API 服務邏輯 (Gemini, Firebase)

---

## 📝 License
MIT License

