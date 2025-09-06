# AI 智慧投資平台

一個全功能的 AI 智慧投資輔助平台。整合了即時（模擬）數據、動態股票篩選、投資組合管理、交易歷史追蹤和進階 AI 分析功能。所有資料皆安全地儲存在您的瀏覽器本機儲存空間中，並可選擇透過 Firebase 登入以進行雲端同步。

## ✨ 主要功能

- **AI 智慧選股:** 提供多種內建策略（如波段突破、長期投資、價值低估等），利用 Gemini AI 從數千檔股票中快速篩選出潛力標的。
- **AI 專家小組評比:** 啟用一個由多個大型語言模型組成的「AI 專家辯論團隊」，對單一股票進行深度、多角度的分析。團隊成員包含：
    - **正方分析師 (Gemini):** 扮演樂觀派，專注挖掘潛在利多與成長機會。
    - **反方分析師 (Groq):** 扮演保守派，專注評估潛在風險與營運疑慮。
    - **第三方中立分析師 (GitHub Models):** 提供客觀的數據綜合分析與情境模擬。
    - **投資總監 (CIO - Gemini):** 整合所有衝突與共識觀點，做出最終的、包含資金配置與風控策略的權威决策。
- **即時投資組合追蹤:** 自動更新持股的即時價格與損益，並根據您的策略設定提供動態的停損、停利或複盤警示。
- **交易歷史與 AI 複盤:** 記錄每一筆已實現的交易，並利用 AI 進行策略評估與優化建議，幫助您從過去的經驗中學習。
- **AI 分析師設定:** 自由啟用或停用不同的 AI 模型，以管理 API 成本與用量。
- **系統監控儀表板:** 一站式檢查所有外部 API 服務（證交所、FinMind、AI 模型）的連線狀態，並管理本地與雲端資料庫的同步。

## 🚀 技術棧

- **前端:** React, Vite, TypeScript, Tailwind CSS
- **AI / 大型語言模型:** Google Gemini, Groq (Llama 3), GitHub Models (OpenAI, DeepSeek, xAI)
- **數據服務:** 
    - Firebase (認證與雲端資料庫)
    - Netlify Functions (作為後端代理)
    - **Supabase (核心市場數據庫)**
- **後端數據更新:** **本地 Python 腳本**
- **資料來源:** FinMind API, 臺灣證券交易所 OpenAPI, NewsAPI, yfinance, twstock

## 部署指南 (Deployment Guide)

### 前端部署 (Netlify)

1.  **上傳至 GitHub:** 將整個專案資料夾初始化為 Git repository，並推送到您在 GitHub 上的新儲存庫。
2.  **連接 Netlify:** 登入 Netlify，選擇 "Add new site" -> "Import an existing project"，然後連接到您的 GitHub 儲存庫。
3.  **設定建置指令:**
    *   **Build command:** `npm run build`
    *   **Publish directory:** `dist`
    *   **Functions directory:** `netlify/functions`
4.  **設定環境變數:** 參考下一節，在 Netlify 的 `Site settings` > `Build & deploy` > `Environment` 中設定必要的環境變數。
5.  **部署:** 點擊 "Deploy site"。

### 後端資料更新 (本地 Python 腳本)

本應用的核心市場數據依賴於一個 Python 腳本在您的本機電腦上執行，並將數據上傳至 Supabase。

**1. 環境設定**

請確保您已安裝 Python 3.8+ 及以下套件：
```bash
pip install yfinance pandas supabase tqdm twstock python-dotenv certifi numpy
```

**2. 設定 API 金鑰**

在您打算存放腳本的目錄下，建立一個名為 `.env` 的檔案，並填入您的金鑰：
```.env
SUPABASE_URL="https://...supabase.co"
SUPABASE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
```
*   **SUPABASE_URL:** 從您的 Supabase 專案設定 -> API -> Project URL 取得。
*   **SUPABASE_KEY:** **請務必使用 `service_role` 金鑰**，因為腳本需要寫入權限。此金鑰位於 Project API Keys 下方。

**3. 執行腳本**

將以下程式碼儲存為 `update_stock_database.py`，並與 `.env` 檔案放在同一目錄下。

```python
import yfinance as yf
import pandas as pd
import numpy as np
import datetime
from supabase import create_client, Client
import logging
import time
from tqdm import tqdm
import twstock
import os
import certifi
import traceback
from dotenv import load_dotenv

# 載入 .env 檔案中的環境變數
load_dotenv()

# 設定證書路徑，以解決 SSL 錯誤
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()
os.environ["SSL_CERT_FILE"] = certifi.where()

# 設定日誌記錄到文件和控制台
# 建議: 將日誌檔名改為相對路徑，使其與腳本放在同一目錄下
log_file_path = 'update_stock_database.log'
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file_path, encoding='utf-8'),
        logging.StreamHandler()
    ]
)

# Supabase 設定
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("請在 .env 檔案中設定 SUPABASE_URL 和 SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- 股票清單與基本資料處理 ---
def get_tw_listed_stocks():
    """
    從 twstock 庫抓取所有台灣上市股票的代碼和名稱。

    Returns:
        list: 包含股票代碼和名稱字典的列表，例如 [{'code': '2330.TW', 'name': '台積電'}]。
    """
    logging.info("開始抓取TWSE上市股票清單")
    stock_list = []
    codes = twstock.codes
    for code, info in codes.items():
        if info.type == '股票' and info.market == '上市':
            stock_list.append({'code': f"{code}.TW", 'name': info.name})
    logging.info(f"抓取到 {len(stock_list)} 支上市股票")
    return stock_list

def safe_get(d, key, default=None):
    """
    安全地從字典或 pandas Series 中獲取值，處理多種資料類型。
    """
    try:
        if isinstance(d, dict):
            val = d.get(key, default)
        elif isinstance(d, pd.Series):
            val = d.get(key, default) if key in d.index else default
        else:
            return default
        if isinstance(val, (pd.Series, np.ndarray, list)):
            if len(val) > 0:
                val = val[0]
            else:
                return default
        if isinstance(val, (int, float, np.number)):
            return float(val)
        return val
    except Exception:
        return default

def fmt_percent(val, default="N/A"):
    """
    將數值格式化為百分比字符串。
    """
    try:
        if val is None or (isinstance(val, str) and val == "N/A"):
            return default
        if float(val) > 1:
            return f"{float(val):.2f}%"
        return f"{float(val) * 100:.2f}%"
    except Exception:
        return default

def clean_data_for_json(data_dict):
    """
    將字典中的 NaN、None 和無限大值轉換為 None，以符合 JSON 規範。
    """
    cleaned_data = {}
    for key, value in data_dict.items():
        if isinstance(value, float):
            if np.isnan(value) or np.isinf(value):
                cleaned_data[key] = None
            else:
                cleaned_data[key] = value
        elif isinstance(value, list) and value and isinstance(value[0], (float, np.number)):
            cleaned_list = []
            for item in value:
                if np.isnan(item) or np.isinf(item):
                    cleaned_list.append(None)
                else:
                    cleaned_list.append(item)
            cleaned_data[key] = cleaned_list
        else:
            cleaned_data[key] = value
    return cleaned_data

# --- 技術指標計算 ---
def calculate_rsi(data, periods=14):
    delta = data.diff()
    gain = delta.where(delta > 0, 0).rolling(window=periods).mean()
    loss = -delta.where(delta < 0, 0).rolling(window=periods).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def calculate_macd(data, fast=12, slow=26, signal=9):
    ema_fast = data.ewm(span=fast, adjust=False).mean()
    ema_slow = data.ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    macd_signal = macd.ewm(span=signal, adjust=False).mean()
    return macd, macd_signal

def calculate_bollinger_bands(data, window=20, std=2):
    sma = data.rolling(window=window).mean()
    std_dev = data.rolling(window=window).std()
    bb_high = sma + std_dev * std
    bb_low = sma - std_dev * std
    return bb_high, bb_low

# --- 資料庫操作與資料處理 ---
def get_stock_info(ticker_obj):
    info_dict = {}
    required_keys = ['longName', 'sector', 'marketCap', 'trailingPE', 'priceToBook', 'dividendYield', 'returnOnEquity', 'revenueGrowth']
    try:
        if hasattr(ticker_obj, 'fast_info'):
            fi = ticker_obj.fast_info
            info_dict = {k: getattr(fi, k, None) for k in required_keys}
        for k in required_keys:
            if k not in info_dict or info_dict[k] is None:
                info_dict[k] = ticker_obj.info.get(k) if hasattr(ticker_obj, 'info') and ticker_obj.info else None
    except Exception as e:
        logging.warning(f"{ticker_obj.ticker} 讀取 info/fast_info 失敗: {e}")
        info_dict = {k: None for k in required_keys}
    return info_dict

def get_stock_fundamentals(ticker_obj):
    info, gross_margin = {}, None
    try:
        info = get_stock_info(ticker_obj)
        try:
            financials = ticker_obj.financials
            if not financials.empty:
                latest_fin = financials.iloc[:, 0]
                gross_profit = latest_fin.get('Gross Profit')
                total_revenue = latest_fin.get('Total Revenue')
                if pd.notna(gross_profit) and pd.notna(total_revenue) and total_revenue != 0:
                    gross_margin = (gross_profit / total_revenue) * 100
        except Exception as e:
            logging.warning(f"{ticker_obj.ticker} 毛利率計算失敗: {e}")
        return info, gross_margin
    except Exception as e:
        logging.error(f"{ticker_obj.ticker} 資料處理失敗: {e}")
        return {}, None

def fetch_stock_data(ticker, start_date, end_date):
    try:
        data = yf.download(ticker, start=start_date, end=end_date, progress=False)
        if data.empty:
            logging.warning(f"從 Yahoo Finance 獲取 {ticker} 資料失敗或為空")
            return None
        return data
    except Exception as e:
        logging.error(f"下載 {ticker} 歷史資料失敗: {e}")
        return None

def fetch_historical_data_from_supabase(ticker, start_date, end_date):
    try:
        response = supabase.table("stocks").select("date, close").eq("ticker", ticker).gte("date", start_date).lte("date", end_date).order("date").execute()
        data = response.data
        if data:
            df = pd.DataFrame(data).set_index(pd.to_datetime(pd.DataFrame(data)['date'])).drop('date', axis=1)
            return df[['close']].rename(columns={'close': 'Close'})
        return None
    except Exception as e:
        logging.error(f"從 Supabase 獲取 {ticker} 歷史資料失敗: {e}")
        return None

def process_and_prepare_data(ticker, data, historical_data, info, ticker_obj):
    if data is None or data.empty: return [], None

    combined_data = pd.concat([historical_data, data]).sort_index() if historical_data is not None and not historical_data.empty else data
    combined_data = combined_data[~combined_data.index.duplicated(keep='last')]
    
    # 計算技術指標
    combined_data['RSI'] = calculate_rsi(combined_data['Close'])
    combined_data['MACD'], combined_data['MACD_Signal'] = calculate_macd(combined_data['Close'])

    stock_data_list = []
    for index, row in data.iterrows():
        row_with_indicators = combined_data.loc[index]
        item = {
            "ticker": ticker, "date": index.strftime('%Y-%m-%d'),
            "open": float(row['Open']), "close": float(row['Close']),
            "high": float(row['High']), "low": float(row['Low']),
            "volume": int(row['Volume']),
            "rsi": float(row_with_indicators['RSI']), "macd": float(row_with_indicators['MACD']),
        }
        stock_data_list.append(clean_data_for_json(item))
    
    _, gross_margin = get_stock_fundamentals(ticker_obj)
    latest_data = combined_data.iloc[-1]
    
    fundamental_item = {
        "ticker": ticker, "company_name": safe_get(info, 'longName', ticker),
        "sector": safe_get(info, 'sector'), "market_cap": safe_get(info, 'marketCap'),
        "pe_ratio": safe_get(info, 'trailingPE'), "pb_ratio": safe_get(info, 'priceToBook'),
        "dividend_yield": safe_get(info, 'dividendYield'), "roe": safe_get(info, 'returnOnEquity'),
        "revenue_growth": safe_get(info, 'revenueGrowth'), "gross_margin": gross_margin,
        "recent_close": safe_get(latest_data, 'Close'), "volume": safe_get(data.iloc[-1], 'Volume'),
        "rsi": safe_get(latest_data, 'RSI'), "macd": safe_get(latest_data, 'MACD'),
        "updated_at": datetime.datetime.now().isoformat(),
    }
    
    return stock_data_list, clean_data_for_json(fundamental_item)

# --- 主程式 ---
def main():
    stock_list = get_tw_listed_stocks()
    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=5)
    historical_start_date = end_date - datetime.timedelta(days=365)
    
    logging.info(f"開始更新資料庫，日期範圍: {start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}")
        
    all_stocks_data, all_fundamentals_data = [], []
    
    for stock in tqdm(stock_list, desc="處理股票進度"):
        ticker_code = stock['code'].replace('.TW', '')
        try:
            ticker_obj = yf.Ticker(stock['code'])

            info, _ = get_stock_fundamentals(ticker_obj)
            historical_data = fetch_historical_data_from_supabase(ticker_code, historical_start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
            data = fetch_stock_data(stock['code'], start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
            
            if data is not None:
                stock_data, fundamental_data = process_and_prepare_data(ticker_code, data, historical_data, info, ticker_obj)
                if stock_data: all_stocks_data.extend(stock_data)
                if fundamental_data: all_fundamentals_data.append(fundamental_data)
            
            if len(all_fundamentals_data) >= 50:
                supabase.table("stock_fundamentals").upsert(all_fundamentals_data).execute()
                logging.info(f"成功上傳 {len(all_fundamentals_data)} 筆 stock_fundamentals 資料")
                all_fundamentals_data = []
            
            if len(all_stocks_data) >= 50:
                supabase.table("stocks").upsert(all_stocks_data).execute()
                logging.info(f"成功上傳 {len(all_stocks_data)} 筆 stocks 資料")
                all_stocks_data = []
            
            time.sleep(1)
        except Exception as e:
            logging.error(f"處理 {ticker_code} 失敗: {e}\n{traceback.format_exc()}")
            continue
    
    if all_fundamentals_data:
        supabase.table("stock_fundamentals").upsert(all_fundamentals_data).execute()
        logging.info(f"成功上傳剩餘 {len(all_fundamentals_data)} 筆 stock_fundamentals 資料")
    if all_stocks_data:
        supabase.table("stocks").upsert(all_stocks_data).execute()
        logging.info(f"成功上傳剩餘 {len(all_stocks_data)} 筆 stocks 資料")
    
    logging.info("股票資料庫更新完成。")

if __name__ == "__main__":
    main()
```

**4. 自動化排程**

建議使用您作業系統的排程工具每日自動執行此腳本（例如設定在凌晨3點），以確保數據庫保持最新狀態。
-   **Windows:** 使用「工作排程器」。
-   **macOS/Linux:** 使用 `cron`。

### 環境變數設定 (Netlify)

您需要在 Netlify 網站設定中加入以下環境變數，以確保所有功能正常運作：

| 變數名稱 (Key) | 用途 |
| :--- | :--- |
| `VITE_API_KEY` | **Google Gemini API 金鑰** (AI 核心功能) |
| `VITE_GROQ_API_KEY` | **Groq API 金鑰** (AI 專家小組-反方意見) |
| `VITE_GITHUB_API_KEY`| **GitHub API 金鑰** (AI 專家小組-第三方模型) |
| `VITE_NEWS2_API_KEY` | **主要新聞來源 API 金鑰 (Webz.io)** (新聞輿情分析) |
| `VITE_NEWS_API_KEY` | **備用新聞來源 API 金鑰 (NewsAPI)** (新聞輿情分析) |
| `VITE_SUPABASE_URL` | **Supabase 專案 URL** (核心市場數據庫) |
| `VITE_SUPABASE_KEY` | **Supabase anon public 金鑰** (核心市場數據庫) |
| `VITE_FIREBASE_API_KEY` | Firebase API 金鑰 |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase 認證網域 |
| `VITE_FIREBASE_PROJECT_ID`| Firebase 專案 ID |
| `VITE_FIREBASE_STORAGE_BUCKET`| Firebase 儲存桶 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID`| Firebase 訊息發送者 ID |
| `VITE_FIREBASE_APP_ID` | Firebase 應用 ID |
| `VITE_FIREBASE_FUNCTIONS_URL` | Firebase Function 觸發 URL (用於手動觸發後端日誌清理) |

### ⚠️ 重要提醒

*   **Firebase Functions**: `functions` 資料夾內的 Firebase Functions **需要另外獨立部署**。它負責後端日誌的定期清理。
*   **本地 Python 腳本**: 負責更新市場數據的 Python 腳本 (`update_stock_database.py`) **需要在您的本機電腦上設定並排程執行**。
*   **`.gitignore`**: 請確保您的 `.gitignore` 檔案包含 `.env`，以避免將您的 API 金鑰上傳到公開的 GitHub 儲存庫。


## ⚠️ 免責聲明

本應用程式為功能展示專案，所有資訊與 AI 分析結果僅供參考，不構成任何投資建議。請在做出任何投資決策前，進行自己的研究並諮詢專業人士。