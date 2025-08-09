# AI 智慧投資平台

這是一個基於多源數據和先進 AI 分析的智慧投資輔助平台。它整合了來自 **台灣證券交易所 (TWSE)**、**FinMind**、**公開資訊觀測站 (MOPS)** 及 **Goodinfo** 的數據，透過雲端同步與智慧管理，幫助您做出更明智的投資決策。

## ✨ 核心功能 (Core Features)

### 1. 全新情境化策略選股
用五個強大的「情境策略按鈕」取代複雜的參數設定，讓專業級的選股變得前所未有的簡單。

*   **波段突破**：監控盤整區的量價變化，尋找帶量突破、趨勢啟動的潛力股。
*   **長期投資**：篩選具備高 ROE、穩定 EPS 成長，且持續配息的優質公司。
*   **當沖標的**：鎖定高流動性、高波動性，適合極短線操作的市場熱門股。
*   **價值低估**：發掘本益比 (PE)、股價淨值比 (PB) 偏低，且具備高殖利率的價值型股票。
*   **成長動能**：聚焦營收年增率 (YoY)、毛利率強勁，處於高速成長週期的公司。

### 2. 智慧型混合數據引擎
*   **多源數據整合**：結合 TWSE API 的即時行情、FinMind 的歷史財報、以及 MOPS/Goodinfo 的深度財務指標（如 ROE, EPS），建立全面性的數據基礎。
*   **雲端數據中樞 (Firestore)**：所有來自不同來源的數據，經清洗與整合後，統一存放在 Firebase Firestore 中。這不僅實現了跨裝置同步，也成為 AI 分析的核心數據來源。
*   **自動化數據更新排程**：透過後端排程（如 Cloud Functions），每日、每週、每季自動更新關鍵數據，確保分析的時效性與準確度。

### 3. AI 驅動的兩階段分析流程
1.  **AI 初步篩選 (Gemini/Groq)**：當您選擇一個策略時，AI 會從 Firestore 的龐大數據庫中，根據該策略的核心指標（如 ROE、營收成長率等），快速篩選出前 20 名最具潛力的候選股。
2.  **即時行情最終排名 (FinMind)**：系統會立即獲取這 20 檔候選股的即時行情數據，根據量價動能進行最終排序，並呈現前 10 名的結果給您。

### 4. 智慧型資料庫管理
*   **自動清理 Cloud Function**：我們部署了一個 Firebase Cloud Function，它會根據您定義的規則（例如，90 天未存取、被 AI 標記為低品質），自動清理或歸檔冷數據，有效降低資料庫成本並提升查詢效能。
*   **AI 輔助分級**：AI 會定期分析所有股票的數據，將其標記為「優良股」、「待觀察」或「水餃股」。此標記會作為自動清理策略的依據，確保資料庫中保留的都是最有價值的資訊。

### 5. 可擴充的多 AI 分析師架構
對於頂級候選股，我們啟動一個可擴充的「AI 專家小組」分析流程，而非侷限於單一模型或雙邊辯論。

1.  **建立分析師小組 (Analyst Panel)**：系統會動態地組合所有已設定的 AI 模型（例如 Gemini, Groq, GitHub Models 等）成為一個分析小組。此架構具備高度擴充性，未來可以輕易加入更多第三方分析師。
2.  **平行獨立分析 (Parallel Analysis)**：小組中的每位 AI 分析師會同時、獨立地對目標股票進行深入分析，各自產出觀點報告。
3.  **投資總監最終裁決 (CIO Synthesis)**：最後，由一個扮演「投資總監」角色的高階 AI (Gemini) 綜合所有分析師的報告，權衡各方優劣觀點，給出一個更全面、更平衡的最終投資建議。

---

## 🚀 開始使用

本專案要完整運作，需要設定多個外部服務的 API 金鑰，並部署後端 Cloud Function。

### 1. Firebase 專案設定 (核心)

這是系統運作的基礎，請務必完成。

1.  **建立 Firebase 專案**:
    *   前往 [Firebase Console](https://console.firebase.google.com/) 並建立一個新專案。
2.  **啟用服務**:
    *   **Authentication**: 進入 `Build > Authentication`，點擊 `Get started`，然後在登入方式 (Sign-in providers) 中啟用 **Google**。
    *   **Firestore Database**: 進入 `Build > Firestore Database`，點擊 `Create database`。選擇 `Start in production mode`，並選擇一個離您最近的伺服器位置。
3.  **取得專案設定**:
    *   在專案主頁，點擊網頁圖示 `</>` 來新增一個 Web App。
    *   為您的 App 命名後，Firebase 會顯示一段 `firebaseConfig` 的 JavaScript 程式碼。
    *   將 `firebaseConfig` 物件中的每一個鍵值對，分別設定為對應的環境變數（**記得加上 `VITE_` 前綴**）。

### 2. 環境變數設定

您需要將所有金鑰設定為**環境變數**。如果您使用 Netlify/Vercel 部署，請在其儀表板的環境變數設定中加入。本地開發請建立 `.env` 檔案。

| 變數 | 說明 | 必要性 | 取得方式 |
| :--- | :--- | :--- | :--- |
| `VITE_API_KEY` | **Google Gemini** API 金鑰，用於主要的 AI 分析。 | **必需** | [見下方說明](#api-金鑰取得方式) |
| `VITE_FINMIND_API_TOKEN` | **FinMind** API 金鑰。此金鑰僅在後端使用。 | **必需** | [見下方說明](#api-金鑰取得方式) |
| `VITE_GITHUB_API_KEY` | **GitHub 個人存取權杖 (PAT)**，用於 GitHub Models AI 分析。 <br> ⚠️ **[極重要]** 此變數為**後端專用**，儘管有 `VITE_` 前綴，也**絕不能**暴露在前端。 | 推薦 | [見下方說明](#api-金鑰取得方式) |
| `VITE_GROQ_API_KEY` | **Groq** API 金鑰，用於 AI 第二意見。 | 推薦 | [見下方說明](#api-金鑰取得方式) |
| `VITE_NEWS_API_KEY` | **News API** 金鑰，用於獲取新聞輿情。 | 推薦 | [見下方說明](#api-金鑰取得方式) |
| `VITE_FIREBASE_...` (共7個) | **Firebase** 專案設定，用於雲端同步、驗證與資料庫。 | **必需** | [見上方 Firebase 說明](#1-firebase-專案設定-核心) |
| `VITE_FIREBASE_FUNCTIONS_URL` | **Firebase Cloud Function** 的公開 URL。用於手動觸發後端清理函式並監控其狀態。 | 推薦 | Firebase Console |
| `VITE_BREVO_API_KEY` | **Brevo (Sendinblue)** API 金鑰，用於發送停損通知。 | 可選 | [見下方說明](#api-金鑰取得方式) |
| `VITE_USER_EMAIL` | 接收停損通知的 Email 地址。 | 可選 | 您自己的 Email |

#### API 金鑰取得方式
*   **FinMind API**: 前往 [FinMind 網站](https://finmindtrade.com/) 註冊並獲取 API Token。
*   **Google Gemini API**: 前往 [Google AI Studio](https://aistudio.google.com/) 建立並獲取 API 金鑰。
*   **GitHub PAT (個人存取權杖)**:
    1. 前往 [GitHub Developer Settings](https://github.com/settings/tokens)。
    2. 點擊 `Generate new token` > `Generate new token (classic)`。
    3. **Note**: 填寫一個描述性的名稱，例如 `AI-Investor-Platform`。
    4. **Expiration**: 建議設定一個到期日。
    5. **Select scopes**: 勾選 `read:user` 和 `user:email`。若要使用 GitHub Models，可能需要 `codespace` 或 `copilot` 相關權限。請參考官方最新文件。
    6. 點擊 `Generate token` 並**立即複製**您的權杖。此權杖只會顯示一次。
    7. 將此權杖設定為 `VITE_GITHUB_API_KEY` 環境變數。
*   **Groq API**: 前往 [GroqCloud Console](https://console.groq.com/keys) 建立並獲取 API 金鑰。
*   **News API**: 前往 [News API](https://newsapi.org/) 註冊並獲取 API 金鑰。
*   **Brevo (Email 服務)**: 前往 [Brevo](https://www.brevo.com/) 註冊並在 `SMTP & API` 頁面產生 API v3 金鑰。

### 3. Firebase Cloud Function 部署 (自動清理)

我們利用 Firebase Cloud Functions 來執行定期的資料庫清理任務。

1.  **安裝 Firebase CLI**:
    ```bash
    npm install -g firebase-tools
    ```
2.  **登入與初始化**:
    ```bash
    firebase login
    firebase init functions
    ```
    *   在專案根目錄執行 `firebase init functions`。
    *   選擇 `Use an existing project` 並選取您剛建立的 Firebase 專案。
    *   語言選擇 `JavaScript`。
    *   當詢問是否安裝依賴時，回答 `Y`。
3.  **配置程式碼**:
    *   專案中已包含 `functions` 資料夾，裡面有 `index.js` 和 `package.json`。
    *   `index.js` 包含了自動清理的邏輯。
    *   `package.json` 包含了必要的依賴 `firebase-admin` 和 `firebase-functions`。
4.  **部署雲端函式**:
    ```bash
    firebase deploy --only functions
    ```
    *   部署完成後，您會得到一個新的 `triggerCleanupManually` 函式的 URL。請將此 URL 設為 `VITE_FIREBASE_FUNCTIONS_URL` 環境變數。
    *   Cloud Function 將根據 `index.js` 中的排程設定 (`.schedule('0 3 * * *')`)，每天凌晨 3 點自動執行。

### 4. 關於後端函式 URL 的說明

#### Netlify Functions (後端代理)
前端應用程式是透過**相對路徑** (`/.netlify/functions/stock-api`) 來呼叫 Netlify Functions 的。這是一個重要的最佳實踐，因為它確保了無論應用程式在哪個環境（本地開發、預覽分支、正式網域）執行，呼叫路徑都是正確的。因此，**Netlify Functions 的 URL 不需要也不應該被設定為環境變數**。

#### Firebase Cloud Functions
*   **排程函式 (`scheduledCleanup`)**: 主要由後端排程觸發，前端應用程式不會直接呼叫它。
*   **手動觸發函式 (`triggerCleanupManually`)**: 這是一個 HTTP 觸發的函式，需要一個公開 URL 才能從前端呼叫。部署後，請務必將此函式的 URL 填入 `VITE_FIREBASE_FUNCTIONS_URL` 環境變數，這樣前端的「手動觸發清理」按鈕才能正常運作。

### 5. 本地開發與部署

*   **本地開發**:
    1. 在專案根目錄建立 `.env` 檔案並填入所有環境變數。
    2. `npm install`
    3. `npm run dev`
*   **部署**:
    * 推薦使用 Netlify 或 Vercel。
    * **Build command**: `npm run build`
    * **Publish directory**: `dist`
    * **環境變數**: 請務必在部署平台的設定中填入所有必要的環境變數。

## ⚠️ 免責聲明

本應用程式僅為技術展示與學習用途。所有股票數據和 AI 分析結果**不構成任何形式的投資建議**。任何依據本平台資訊進行的交易，風險自負。在進行任何投資前，請諮詢合格的金融專業人士。