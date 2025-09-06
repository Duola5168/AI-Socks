import { ScoredStock, AnalystReport, NewsSentimentReport } from '../types';
import { getCriteriaText } from './utils';

export type AnalystRole = 'Quant' | 'News Hound' | 'Chartist' | 'Neutral';

const _callGitHubModel = async (model: string, messages: { role: string; content: string }[], requestJson: boolean = true): Promise<any> => {
    try {
        const body: any = {
            model: model, 
            messages: messages,
            stream: false,
        };
        if (requestJson) {
            body.response_format = { type: 'json_object' };
        }
        
        const response = await fetch(`/.netlify/functions/stock-api?source=github_models`, {
            method: 'POST',
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Unknown GitHub Models API error (${response.status})`);
        }

        return await response.json();

    } catch (error) {
        console.error(`Error calling GitHub Model (${model}) via proxy:`, error);
        throw new Error(`GitHub (${model}) 服務失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};

const getSystemPromptForRole = (role: AnalystRole): string => {
    const baseSystemPrompt = `你的回覆必須是結構化的 JSON 物件。Your response must be a single JSON object with the following keys: "overallStance", "candlestickPattern", "movingAverageAlignment", "technicalIndicators", "institutionalActivity", "fundamentalAssessment", "supportLevel", "resistanceLevel", "recommendedEntryZone", "recommendedExitConditions", "supplementaryAnalysis".`;

    switch (role) {
        case 'Quant':
            return `你是一位量化金融分析師 ("Quant")。你的專長是嚴謹的、數據驅動的數字分析，並從歷史數據中尋找可重複的模式以優化策略。專注於技術指標 (RSI, MACD)、財務指標 (P/E, ROE) 和統計模式。提供客觀的、數字化的見解。${baseSystemPrompt}`;
        case 'News Hound':
            return `你是一位市場情緒分析師 ("News Hound")。你的專長是處理來自新聞文章和報告的大量文本，並與歷史事件進行比對，以衡量公眾和投資者的情緒。專注於總結敘事、識別關鍵主題，並評估市場話語的情感基調。${baseSystemPrompt}`;
        case 'Chartist':
            return `你是一位技術分析師 ("Chartist")。你專門解讀價格行為和圖表模式，並從歷史圖表中學習，以識別高成功率的型態。請像看圖表一樣描述K線形態、支撐/壓力位和趨勢線。你的分析應純粹是技術性的。${baseSystemPrompt}`;
        case 'Neutral':
        default:
            return `你是一位客觀、中立的第三方數據分析師。你的任務是無偏見地解讀所提供的數據，並將其與歷史基準進行比較。${baseSystemPrompt}`;
    }
};

const buildStockAnalysisMessages = (
    role: AnalystRole, 
    scoredStock: ScoredStock, 
    newsReport?: NewsSentimentReport
): { role: string; content: string }[] => {
    const { stock, breakdown } = scoredStock;
    const metCriteria = getCriteriaText(breakdown);

    const newsContext = newsReport ? `
      **最新新聞輿情分析 (情緒: ${newsReport.sentiment}):**
      - 新聞總結: ${newsReport.summary}
      - 關鍵新聞點: ${newsReport.keyPoints.join(', ')}
    ` : '無相關新聞輿情資料。';
      
    const systemPrompt = getSystemPromptForRole(role);

    const userPrompt = `
      ${newsContext}

      **目標股票資料:**
      - 名稱: ${stock.name} (${stock.ticker})
      - 當前價格: ${stock.close?.toFixed(2)}
      - 關鍵數據: 營收年增率=${stock.revenueGrowth?.toFixed(2)}%, ROE=${stock.roe?.toFixed(2)}%, P/E=${stock.peRatio?.toFixed(2)}
      - 符合的篩選條件: ${metCriteria.join('、')}

      **分析指令 (從 ${role} 角度):**
      請扮演一位 ${role}，對這家公司進行評估，並提供一個包含所有必要欄位的完整 JSON 物件。
      `;
    
    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
};

export const getGitHubModelAnalysis = async (
    model: string, 
    role: AnalystRole,
    stock: ScoredStock, 
    news?: NewsSentimentReport
): Promise<AnalystReport> => {
    const messages = buildStockAnalysisMessages(role, stock, news);
    const result = await _callGitHubModel(model, messages, true);
    const content = result.choices[0]?.message?.content;
     if (!content) {
        throw new Error("GitHub Models API 回應格式不符預期，缺少內容。");
    }
    return JSON.parse(content) as AnalystReport;
}

export const getGitHubModelTestResponse = async (model: string, messages: { role: 'user' | 'system', content: string }[]): Promise<string> => {
    try {
        const result = await _callGitHubModel(model, messages, false); // Do not request JSON for this text-based test
        return result.choices[0]?.message?.content || "模型未回傳任何內容。";
    } catch (error) {
        console.error(`Error testing GitHub Model (${model}):`, error);
        throw new Error(`GitHub (${model}) 測試失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const fetchGitHubModelCatalog = async (): Promise<{id: string}[]> => {
    try {
        const response = await fetch(`/.netlify/functions/stock-api?source=github_catalog`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Unknown GitHub Models API error (${response.status})`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching GitHub Model Catalog via proxy:`, error);
        throw new Error(`獲取 GitHub 模型目錄失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};
