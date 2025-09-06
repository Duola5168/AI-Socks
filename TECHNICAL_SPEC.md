# 技術規格書 - AI 智慧投資平台

本文檔概述了 AI 智慧投資平台的技術架構、核心組件和設計決策。

## 1. 系統架構

本應用程式採用現代化的 Jamstack 架構，具備高度的可擴展性和安全性。

- **前端 (Client-Side):** 一個使用 React 和 Vite 建置的單頁應用程式 (SPA)，負責所有 UI 渲染和使用者互動。
- **後端代理 (Serverless Functions):** 利用 Netlify Functions 作為一個安全的代理層，用於處理對外部 API（如 NewsAPI、GitHub Models）的請求。這樣做可以安全地隱藏 API 金鑰，避免其暴露在前端。
- **後端數據更新 (Backend Data Update):** 使用 **本地 Python 腳本** (`update_stock_database.py`)，負責定時（透過作業系統排程器）執行後端任務，例如從 yfinance 和 twstock 抓取每日市場數據、計算技術指標、生成 AI 摘要，並更新至 Supabase 資料庫。
- **資料庫:**
    - **主要市場數據庫 (Supabase):** 存放由本地 Python 腳本每日更新的、所有使用者共享的市場歷史數據。
    - **本地快取 (IndexedDB):** 在瀏覽器中儲存從 Supabase 同步的大量市場數據，實現離線存取和快速載入。
    - **個人化雲端資料庫 (Firestore):** 使用 Google Firebase 進行使用者認證和個人化資料（投資組合、交易歷史、設定）的雲端儲存與同步。
- **AI 服務:** 直接從前端客戶端呼叫 Google Gemini 和 Groq API，而 GitHub Models API 則透過 Netlify 代理呼叫。
- **資料來源:**
    - **主要市場數據:** 由本地 Python 腳本透過 yfinance 和 twstock 提供，並儲存於 Supabase。
    - **新聞數據:** Webz.io (主要來源), NewsAPI (備用來源)
    - **補充數據 (狀態檢查):** 臺灣證券交易所 OpenAPI, FinMind API

## 2. 前端技術棧

- **框架:** React 19 (with Hooks)
- **建置工具:** Vite
- **語言:** TypeScript
- **樣式:** Tailwind CSS
- **圖表:** Lightweight Charts
- **狀態管理:** React Context API 和自定義 Hooks (`useUserData`, `useMarketData`, `useScreener` 等)。

## 3. 核心功能模組

### 3.1. 數據管理 (`hooks/useMarketData.ts`, `services/supabase.ts`, `services/databaseService.ts`)
- **數據來源:** 透過 `supabaseService` 從 Supabase 同步全市場數據 (由本地 Python 腳本提供)。
- **本地儲存:** 將同步的數據儲存在 IndexedDB 中，以供應用程式快速讀取。
- **狀態鉤子:** `useMarketData` 負責管理從本地資料庫載入的市場數據狀態。

### 3.2. 使用者資料 (`hooks/useUserData.ts`, `services/firestoreService.ts`)
- **認證:** 使用 Firebase Authentication (Google 登入)。
- **資料模型:** `PortfolioHolding`, `TradeHistory` 等。
- **同步邏輯:** `useUserData` 鉤子處理本地 LocalStorage 與 Firestore 之間的資料同步，確保登入後資料一致。
- **即時更新:** 在交易時段，每分鐘自動更新投資組合的價格和警示。

### 3.3. AI 選股引擎 (`hooks/useScreener.ts`, `services/geminiService.ts`)
- **多階段篩選:**
    1.  **AI 初篩:** `geminiService.getAITopStocks` 接收全市場靜態數據，根據指定策略篩選出 Top 20 候選名單。
    2.  **即時數據獲取:** `stockService.fetchRealtimeDataForTopStocks` 為候選名單獲取詳細的 K 線數據。
    3.  **動能排序:** 在前端根據即時數據計算動能分數，進行最終排序。
    4.  **深度分析:** `geminiService.getAIStockReport` 為 Top 10 結果生成詳細的 AI 分析報告。

### 3.4. AI 協同分析 (`services/collaborativeAnalysisService.ts`)
- **分析師角色:**
    - **正方分析師 (Gemini):** 扮演樂觀派，專注挖掘潛在利多與成長機會。
    - **反方分析師 (Groq):** 扮演保守派，專注評估潛在風險與營運疑慮。
    - **第三方中立分析師 (GitHub Models):** 提供客觀的數據綜合分析與情境模擬。
    - **投資總監 (CIO - Gemini):** 整合所有報告，做出最終的、包含資金配置與風控策略的權威決策。
- **工作流程:**
    1.  (可選) 獲取並分析新聞輿情。若使用主要新聞來源 (Webz.io)，則直接使用其提供的情緒標籤；若使用備用來源，則呼叫 Gemini 進行分析。
    2.  所有啟用的分析師並行執行分析，產出標準化的 `AnalystReport` 結構化報告。
    3.  投資總監模型接收所有 `AnalystReport`，生成最終的 `FinalDecision` 決策報告。
- **資料結構:**
    - **`AnalystReport`:** 包含標準化的分析欄位，如 K線型態、均線排列、技術指標、籌碼面、基本面、支撐壓力位、進出場建議等，以及一段補充的文字分析。
    - **`FinalDecision`:** 包含綜合評分、操作建議、信心度、共識與分歧總結、操作策略、資金配置建議、風控計畫等。

## 4. 後端代理 (`netlify/functions/stock-api.js`)

- **目的:** 安全地管理和使用伺服器端的 API 金鑰。
- **路由:** 透過 `source` 查詢參數來決定要代理的目標 API。
- **支援的服務:**
    - `twse`: 臺灣證券交易所 OpenAPI
    - `finmind`: FinMind API
    - `newsapi2`: Webz.io News API (主要新聞來源)
    - `newsapi`: NewsAPI.org (備用新聞來源)
    - `github_models`: GitHub Models Inference API
    - `github_catalog`: GitHub Models Catalog API

## 5. 環境變數

應用程式依賴以下 `.env` 檔案中的環境變數：

- `VITE_API_KEY`: Google Gemini API 金鑰
- `VITE_GROQ_API_KEY`: Groq API 金鑰
- `VITE_NEWS2_API_KEY`: Webz.io News API 金鑰 (主要)
- `VITE_NEWS_API_KEY`: NewsAPI.org 金鑰 (備用)
- `VITE_FIREBASE_*`: Firebase 專案設定
- `VITE_FIREBASE_FUNCTIONS_URL`: Firebase Cloud Function 的觸發 URL

**伺服器端 (Netlify):**

- `VITE_FINMIND_API_TOKEN`: FinMind API 金鑰
- `VITE_GITHUB_API_KEY`: GitHub API 金鑰