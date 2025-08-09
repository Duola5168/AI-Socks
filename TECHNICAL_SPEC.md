# 技術規格書 (Technical Specification)

本文檔旨在詳細說明「AI 智慧投資平台」專案的技術架構、API 設計、數據流、安全規範及未來發展建議。

## 1. 專案架構 (Project Architecture)

本專案採用現代化的前後端分離架構，旨在實現高效開發、易於維護和良好擴展性。

### 1.1 前端 (Frontend)

*   **框架 (Framework):** React (v19) with TypeScript
*   **建置工具 (Build Tool):** Vite
*   **主要功能:**
    *   提供用戶互動介面，包括投資組合追蹤、股票篩選、個股詳情查看等。
    *   透過呼叫後端 API (Netlify Functions) 獲取及展示市場數據。
    *   使用 Firebase 進行用戶認證和部分數據快取。
    *   所有業務邏輯和狀態管理都封裝在 `services` 和 `hooks` 目錄中，實現了關注點分離。

### 1.2 後端 (Backend - Netlify Functions)

*   **平台 (Platform):** Netlify Functions
*   **語言 (Language):** JavaScript (Node.js)
*   **核心功能:**
    *   作為一個 API 代理閘道 (API Gateway)，統一處理所有對外部數據源的請求。
    *   安全地管理和使用 API 金鑰 (例如 FinMind API Token)，避免金鑰洩漏到前端。
    *   解決前端直接請求外部 API 時遇到的跨域 (CORS) 問題。
    *   未來可在後端實現更集中、更高效的快取策略與請求頻率控制。

### 1.3 數據流 (Data Flow)

1.  **用戶操作:** 用戶在前端 UI 進行操作 (例如：請求更新股價)。
2.  **前端服務呼叫:** React 組件觸發 `services/stockService.ts` 中的函式。
3.  **API 請求:** `stockService` 不再直接請求外部 API，而是向內部的 Netlify Function (`/.netlify/functions/stock-api`) 發送請求。
4.  **後端代理:** `stock-api` Function 接收到請求，根據 `source` 參數判斷數據源 (FinMind 或 TWSE)。
5.  **外部 API 請求:** Netlify Function 帶上儲存在後端環境變數中的 API 金鑰，向目標外部 API (FinMind 或 TWSE) 發送請求。
6.  **數據回傳:** 外部 API 回傳數據給 Netlify Function。
7.  **回應前端:** Netlify Function 將數據回傳給前端的 `stockService`。
8.  **UI 更新:** `stockService` 將數據處理後，更新到前端的狀態 (State)，React 自動重新渲染 UI。

---

## 2. API 設計規格 (API Design Specification)

我們設計了一個統一的 API 入口點來處理所有股票相關的數據請求。

*   **根路徑 (Root Path):** `/.netlify/functions/stock-api`
*   **HTTP 方法 (Method):** `GET`

### 2.1 路由與參數 (Routes & Parameters)

透過 `source` 查詢參數來決定要存取的數據源。

#### **Source: `twse`**

*   **用途:** 獲取台灣證券交易所 (TWSE) 的公開數據。
*   **範例:** `/.netlify/functions/stock-api?source=twse&endpoint=t187ap03_L`
*   **參數:**
    *   `source` (必要): `twse`
    *   `endpoint` (必要): TWSE OpenData 的端點名稱，例如 `t187ap03_L` (上市股票清單) 或 `t187ap14_L` (個股日成交資訊)。

#### **Source: `finmind`**

*   **用途:** 獲取 FinMind 提供的詳細金融數據。
*   **範例:** `/.netlify/functions/stock-api?source=finmind&dataset=TaiwanStockPrice&data_id=2330&start_date=2024-01-01`
*   **參數:**
    *   `source` (必要): `finmind`
    *   `dataset` (必要): FinMind API 定義的資料集名稱，例如 `TaiwanStockPrice`。
    *   `data_id` (可選): 股票代碼，例如 `2330`。
    *   `start_date` (可選): 查詢的開始日期。

### 2.2 回傳格式 (Response Format)

*   **成功 (Success):**
    *   `statusCode`: `200`
    *   `headers`: `{ 'Content-Type': 'application/json' }`
    *   `body`: 從外部 API 獲取的原始 JSON 數據。
*   **失敗 (Failure):**
    *   `statusCode`: `400` (用戶端請求錯誤) 或 `500` (伺服器端錯誤)。
    *   `headers`: `{ 'Content-Type': 'application/json' }`
    *   `body`: `{ "error": "錯誤訊息描述" }`

### 2.3 台灣證券交易所 API 端點參考 (TWSE API Endpoint Reference)
為了提升 AI 分析的深度與廣度，應用程式內部維護了一份完整的台灣證券交易所 OpenAPI 端點清單。

*   **檔案位置:** `services/twseApiEndpoints.ts`
*   **用途:**
    *   此檔案將所有可用的官方數據 API (如重大訊息、公司治理資訊、處置股票等) 進行了結構化分類。
    *   在呼叫 AI 模型 (Gemini) 進行分析時，這份清單會作為額外的上下文 (Context) 提供給 AI。
    *   這使得 AI 能夠知道有哪些潛在的官方數據可以納入考量，從而提出更全面、更具情境感知能力的分析與建議。

---

## 3. 資料庫或狀態管理 (Database & State Management)

*   **前端狀態管理:** 主要透過 React Hooks (`useState`, `useEffect`) 和自定義 Hooks (`hooks/`) 來管理組件狀態和業務邏輯。
*   **客戶端快取:**
    *   `localStorage`: 用於儲存全市場股票清單、篩選後的候選池等，避免用戶每次訪問都需重新下載。
    *   `Firebase Firestore`: 如 `fetchWithCache` 函式所示，專案利用 Firestore 作為一個用戶級別的雲端快取，用來儲存個股的歷史數據 (如 K 線、營收)，並設定了 TTL (Time-To-Live) 來確保數據的時效性。

---

## 4. 安全性與性能優化建議 (Security & Performance Recommendations)

### 4.1 安全性 (Security)

*   **API 金鑰管理:** **(已完成)** `finmindApiToken` 已從前端移除，並應儲存在 Netlify 的環境變數中。這是本次重構最重要的安全提升。
*   **保護 API 端點:** 雖然目前是內部使用，未來若需對外開放，可考慮為 Netlify Function 增加認證機制 (例如，檢查 Firebase Auth 的 token)。
*   **依賴套件審核:** 定期執行 `npm audit` 來檢查並修復已知的前後端套件漏洞。

### 4.2 性能優化 (Performance)

*   **後端共享快取:** 目前的 Firestore 快取是基於 `userId` 的，這意味著每個用戶都有自己的快取。對於公開數據 (如個股 K 線)，未來可以在 Netlify Function 層級實現一個**共享快取** (例如，使用 Netlify 的 `Cache-Control` 標頭或一個外部 Redis 服務)，讓所有用戶共享同一份快取數據，大幅減少對外部 API 的請求。
*   **前端資源優化:**
    *   **程式碼分割 (Code Splitting):** React 和 Vite 已預設支持。可以檢查是否有特別大的組件或頁面可以手動進行延遲加載 (Lazy Loading)。
    *   **圖片優化:** 確保專案中使用的所有圖片都經過壓縮。
*   **API 請求最小化:** 前端應確保只有在必要時才發起 API 請求，避免在組件的重複渲染中觸發不必要的數據獲取。

---

## 5. 未來可擴充功能建議 (Future Scalability)

*   **進階選股策略:** 目前的篩選邏輯在前端，未來可以將其移至後端，並允許用戶自定義、保存和分享更複雜的選股策略 (例如，結合多個技術指標和財務數據)。
*   **用戶個人化設定:** 允許用戶儲存個人化的介面設定、自選股清單分組、甚至是綁定自己的券商帳戶 (需處理更高級別的安全性)。
*   **數據可視化增強:** 引入更專業的圖表庫 (如 TradingView Lightweight Charts)，提供更豐富的技術分析工具和繪圖功能。
*   **後端任務排程:** 對於需要定期執行的任務 (例如，每日收盤後更新所有股票的基礎數據)，可以使用 Netlify 的排程函式 (Scheduled Functions) 來自動化執行，並將結果存入快取或資料庫中。
*   **WebSocket 即時股價:** 引入 WebSocket 服務，實現股價的即時推送，提升用戶體驗。