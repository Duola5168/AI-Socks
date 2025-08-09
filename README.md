# AI 智慧投資平台

這是一個全功能的 AI 智慧投資輔助平台，旨在利用 AI 技術和 **100% 真實市場數據**，幫助使用者做出更明智的投資決策。透過 Firebase，您的所有資料都將安全地儲存在雲端，實現跨裝置同步。

## ✨ 核心功能 (Core Features)

### 1. 全新策略驅動選股介面
我們徹底改造了選股流程，用五個直觀的「情境策略按鈕」取代了複雜的參數設定，讓投資決策變得前所未有的簡單與強大。
*   **波段突破**：尋找從盤整區帶量突破、趨勢可能發動的股票。
*   **長期投資**：篩選財務穩健、高 ROE 且持續發放股利的價值型公司。
*   **當沖標的**：找出市場成交量大、波動劇烈，適合極短線操作的熱門股。
*   **價值低估**：發掘本益比、股價淨值比偏低，且殖利率高的潛在便宜股。
*   **成長動能**：鎖定營收年增率高、毛利佳，處於強勁成長週期的公司。

### 2. 兩階段式分析流程
1.  **一鍵篩選，快速鎖定**：在主畫面點擊任一策略按鈕，系統會立即對全市場股票進行篩選、評分與排序，並呈現該策略下**前 10 名**最匹配的股票清單。
2.  **深入洞察，全面分析**：點擊清單中的任一股票，即可進入全新的**AI 深度分析視圖**。這裡匯集了所有關鍵資訊，包括 K 線圖、多空觀點辯論、進出場時機建議等，幫助您做出最終決策。

### 3. AI 市場宏觀分析 (AI Market Macro Analysis)
在您開始選股之前，平台會先對市場進行「健康檢查」。AI 會分析當前市場的整體趨勢（多頭/空頭佔比）與波動性，並建議最適合的宏觀策略——「進攻型」、「穩健型」或「保守型」。這能幫助您順勢而為，在大盤不佳時避免不必要的風險。

### 4. 雙 AI 協同深度分析 (Dual AI Collaborative In-depth Analysis)
這不僅是單一模型的意見。對於通過篩選的頂級候選股，我們啟動一個協同分析流程：
1.  **初步分析 (Gemini)**：由 Google Gemini 產出詳細的初步分析報告。
2.  **批判性審閱 (Groq)**：接著，以速度與批判性思維見長的 Groq (Llama 3) 會對 Gemini 的報告提出質疑、反對或補充意見。
3.  **最終裁決 (Gemini)**：最後，Gemini 會扮演投資總監的角色，綜合雙方觀點，給出一個更全面、更平衡的最終投資建議與進場時機分析。

### 5. 智慧投資組合與風險監控 (Smart Portfolio & Risk Monitoring)
*   **動態倉位管理**：將持股分為「短期交易」（最多5檔，享有完整監控）與「長期追蹤」，靈活管理不同策略的部位。
*   **即時警示系統**：持股的損益、價位每分鐘更新。系統會根據內建的風控規則，自動發出「停損」、「停利」、「續抱」或「週五複盤」等動態警示。
*   **Email 即時通知 (Brevo)**：當持股觸發關鍵停損條件時（如跌破5日線），系統會立即發送 Email 通知您，讓您不錯過任何重要時機。

### 6. AI 驅動的學習與複盤 (AI-driven Learning & Review)
平台會與您一同成長：
*   **個人化選股建議**：AI 在分析股票時，會參考您過去的交易歷史，幫助您識別並避開重複的投資盲點。
*   **自動交易複盤**：在您賣出股票三天後，AI 會自動分析賣出後的股價走勢，客觀評斷您的賣出時機。

### 7. 智慧型混合數據引擎
*   **OpenAPI 優先**：我們最大化利用**台灣證券交易所 (TWSE) 的免費 OpenAPI** 進行大規模的日常數據篩選（如股價、成交量、本益比、股價淨值比等），此舉快速、高效且不消耗付費額度。
*   **FinMind 深度補充**：對於需要深入歷史財報數據的策略（如 ROE、毛利率、負債比等），系統會智慧地只針對通過第一層 OpenAPI 篩選的潛力股，調用 **FinMind API** 獲取深度數據。
*   **企業級快取架構**：結合雲端共享快取 (Firestore) 與本地每日快取 (IndexedDB)，大幅減少 API 重複請求和等待時間，實現秒級載入體驗。

### 8. 透明化的系統監控 (Transparent System Monitoring)
新增的「系統監控」儀表板讓應用程式的運作狀態一目了然，包含：
*   **手動數據管理工具**：提供按鈕讓您隨時更新「全市場股票清單」。
*   **即時狀態日誌**與**錯誤日誌**。
*   **API 用量**（採用滑動時間視窗演算法，精準追蹤）。

## ⚙️ 技術架構

*   **前端**: React, TypeScript, Tailwind CSS
*   **建置工具**: **Vite (推薦)** - 用於處理 JSX、TypeScript 編譯及環境變數注入。
*   **AI 模型**: Google Gemini, Groq (Llama 3)
*   **市場數據**: **台灣證券交易所 OpenAPI** (透過內建代理)、FinMind API (深度資料)
*   **新聞數據**: News API
*   **後端 & 驗證**: Firebase (Auth, Firestore), **Netlify Functions** (API Proxy)
*   **Email 通知**: Brevo (Sendinblue)
*   **圖表**: Lightweight Charts

## 🚀 開始使用

本專案要完整運作，需要設定多個外部服務的 API 金鑰。請依照以下步驟設定。

### 1. 環境變數設定與金鑰取得

您需要將所有金鑰設定為**環境變數**。

**重要提示：** 為了讓前端程式碼能夠存取這些金鑰，所有變數名稱都必須以 `VITE_` 作為前綴。這是現代前端建置工具（如 Vite）的安全機制。

如果您使用 Netlify 進行部署，請在您的網站設定中找到 `Build & deploy > Environment > Environment variables`，然後將以下所有變數逐一加入。

| 變數 | 說明 | 必要性 | 取得方式 |
| :--- | :--- | :--- | :--- |
| `VITE_API_KEY` | **Google Gemini** API 金鑰，用於主要的 AI 分析。 | **必需** | [見下方 Google Gemini 說明](#google-gemini-api) |
| `VITE_FINMIND_API_TOKEN` | **FinMind** API 金鑰。此金鑰僅在後端使用，不會暴露於前端。 | **必需** | [見下方 FinMind 說明](#finmind-api) |
| `VITE_GROQ_API_KEY` | **Groq** API 金鑰，用於 AI 第二意見和策略健檢。 | 推薦 | [見下方 Groq API 說明](#groq-api) |
| `VITE_NEWS_API_KEY` | **News API** 金鑰，用於獲取新聞輿情。 | 推薦 | [見下方 News API 說明](#news-api) |
| `VITE_FIREBASE_...` (共7個) | Firebase 專案設定，用於雲端同步、驗證與分析。 | 推薦 | [見下方 Firebase 說明](#firebase) |
| `VITE_BREVO_API_KEY` | **Brevo (Sendinblue)** API 金鑰，用於發送停損通知。 | 可選 | [見下方 Brevo 說明](#brevo-email-服務) |
| `VITE_USER_EMAIL` | 接收停損通知的 Email 地址。 | 可選 | 您自己的 Email |

---

#### **內建 API 代理 (Built-in API Proxy)**
本專案包含一個內建的 API 代理伺服器（位於 `netlify/functions/stock-api.js`）。當您將專案部署到 Netlify 時，此代理會自動啟用。

它的主要功能是：
- **安全處理 API 金鑰**：將您的 `VITE_FINMIND_API_TOKEN` 安全地保存在後端環境，避免洩漏到前端。
- **解決跨域問題**：處理直接從瀏覽器呼叫台灣證券交易所 (TWSE) OpenAPI 時會遇到的 CORS 限制。

您無需再自行設定或部署代理伺服器，也無需設定 `VITE_PROXY_URL` 環境變數。

#### **FinMind API**
1.  前往 [FinMind 台灣股市資料庫](https://finmindtrade.com/)。
2.  註冊一個免費帳號。
3.  登入後，點擊右上角您的頭像，進入「個人資訊」。
4.  在頁面中找到您的 **API Token**，並複製它。
5.  將此 Token 設定為環境變數 `VITE_FINMIND_API_TOKEN`。

#### **Google Gemini API**
1.  前往 [Google AI Studio](https://aistudio.google.com/)。
2.  使用您的 Google 帳號登入。
3.  點擊左側選單的 `Get API key`。
4.  點擊 `Create API key in new project`。
5.  複製產生的 API 金鑰。
6.  將此金鑰設定為環境變數 `VITE_API_KEY`。

#### **Groq API**
1.  前往 [GroqCloud Console](https://console.groq.com/keys)。
2.  使用您的 Google 帳號或 Email 註冊/登入。
3.  點擊 `Create API Key`。
4.  為金鑰命名（例如：`ai-investor-project`），然後點擊 `Create`。
5.  **立即複製產生的金鑰** (此金鑰只會顯示一次)。
6.  將此金鑰設定為環境變數 `VITE_GROQ_API_KEY`。

#### **News API**
1.  前往 [News API](https://newsapi.org/)。
2.  點擊 `Get API Key` 並註冊一個帳號。免費方案已足夠使用。
3.  登入後，您會在儀表板上看到您的 API 金鑰。
4.  複製此金鑰。
5.  將此金鑰設定為環境變數 `VITE_NEWS_API_KEY`。

#### **Firebase**
1.  前往 [Firebase Console](https://console.firebase.google.com/)。
2.  點擊 `Add project`，建立一個新專案。
3.  進入您的專案後，點擊左側選單的 `Build > Authentication`，然後點擊 `Get started`。在登入方式 (Sign-in providers) 中，啟用 **Google**。
4.  點擊左側選單的 `Build > Firestore Database`，然後點擊 `Create database`。選擇 `Start in production mode`，並選擇一個離您最近的伺服器位置。
5.  回到專案主頁，點擊網頁圖示 `</>` 來新增一個 Web App。
6.  為您的 App 命名後，Firebase 會顯示一段 `firebaseConfig` 的 JavaScript 程式碼。**您需要的就是這裡的資訊**。
7.  將 `firebaseConfig` 物件中的每一個鍵值對，分別設定為對應的環境變數（**記得加上 `VITE_` 前綴**）：
    *   `apiKey` -> `VITE_FIREBASE_API_KEY`
    *   `authDomain` -> `VITE_FIREBASE_AUTH_DOMAIN`
    *   `projectId` -> `VITE_FIREBASE_PROJECT_ID`
    *   `storageBucket` -> `VITE_FIREBASE_STORAGE_BUCKET`
    *   `messagingSenderId` -> `VITE_FIREBASE_MESSAGING_SENDER_ID`
    *   `appId` -> `VITE_FIREBASE_APP_ID`
    *   `measurementId` -> `VITE_FIREBASE_MEASUREMENT_ID`

#### **Brevo (Email 服務)**
1.  前往 [Brevo](https://www.brevo.com/) (前身為 Sendinblue)。
2.  註冊一個帳號。
3.  登入後，點擊右上角您的帳號名稱，選擇 `SMTP & API`。
4.  點擊 `API Keys` 頁籤，然後點擊 `Generate a new API key`。
5.  為金鑰命名，然後複製產生的 **v3** 金鑰。
6.  將此金鑰設定為環境變數 `VITE_BREVO_API_KEY`。
7.  將您想要接收通知的 Email 地址設定為 `VITE_USER_EMAIL`。

---

### 2. 本地開發

本專案需要使用建置工具 (如 Vite) 來運行。

1. **環境變數（本地）**: 在專案根目錄建立一個 `.env` 檔案，並將上述所有環境變數填入其中。**請注意，`.env` 檔案不應提交到 Git**。
    ```
    # .env
    VITE_API_KEY="your_gemini_key"
    VITE_FINMIND_API_TOKEN="your_finmind_token"
    VITE_GROQ_API_KEY="your_groq_key"
    VITE_NEWS_API_KEY="your_newsapi_key"
    # ... and so on for Firebase, Brevo...
    ```
2.  **安裝依賴**:
    ```bash
    npm install
    ```
3.  **啟動開發伺服器**:
    ```bash
    npm run dev
    ```
4.  在瀏覽器中開啟對應的本地網址 (通常是 `http://localhost:5173`)。

### 3. 部署

您可以輕易地將此專案部署到任何支援靜態網站託管的平台，如 Netlify, Vercel 或 GitHub Pages。**推薦使用 Netlify** 以便啟用內建的 API 代理功能。

**部署設定**:
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **環境變數**: **請務必在部署平台的設定中（如前所述）填入所有必要的環境變數。**

## ⚠️ 免責聲明

本應用程式僅為技術展示與學習用途。所有股票數據和 AI 分析結果**不構成任何形式的投資建議**。任何依據本平台資訊進行的交易，風險自負。在進行任何投資前，請諮詢合格的金融專業人士。