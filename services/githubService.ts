import { ScoredStock, DebateReport, NewsSentimentReport } from '../types';
import { getCriteriaText } from './utils';

const _callGitHubModel = async (model: string, messages: { role: string; content: string }[]): Promise<string> => {
    try {
        const response = await fetch(`/.netlify/functions/stock-api?source=github_models`, {
            method: 'POST',
            body: JSON.stringify({
                model: model, 
                messages: messages,
                stream: false,
                response_format: { type: 'json_object' }, // Request JSON output for analysis
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Unknown GitHub Models API error (${response.status})`);
        }

        const result = await response.json();
        const content = result.choices[0]?.message?.content;
        if (!content) {
            throw new Error("GitHub Models API 回應格式不符預期，缺少內容。");
        }
        
        return content;

    } catch (error) {
        console.error(`Error calling GitHub Model (${model}) via proxy:`, error);
        throw new Error(`GitHub (${model}) 服務失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};

const buildStockAnalysisMessages = (scoredStock: ScoredStock, newsReport?: NewsSentimentReport) => {
    const { stock, breakdown } = scoredStock;
    const metCriteria = getCriteriaText(breakdown);

    const newsContext = newsReport ? `
      **最新新聞輿情分析 (情緒: ${newsReport.sentiment}):**
      - 新聞總結: ${newsReport.summary}
      - 關鍵新聞點: ${newsReport.keyPoints.join(', ')}
    ` : '無相關新聞輿情資料。';

    const systemPrompt = `你是一位 AI 程式碼與技術趨勢分析師，現在被要求從技術開發者的獨特視角來評估一家公司的股票。你的分析應側重於公司的技術護城河、開發者社群活躍度、產品創新潛力等。你的回答必須是結構化的 JSON 物件。`;

    const userPrompt = `
      ${newsContext}

      **目標股票資料:**
      - 名稱: ${stock.name} (${stock.ticker})
      - 當前價格: ${stock.close?.toFixed(2)}
      - 關鍵數據: 營收年增率=${stock.revenueGrowth?.toFixed(2)}%, ROE=${stock.roe?.toFixed(2)}%, P/E=${stock.peRatio?.toFixed(2)}
      - 符合的篩選條件: ${metCriteria.join('、')}

      **分析指令 (從開發者與技術角度):**
      請扮演一位技術分析師，對這家公司進行評估。
      1.  **Overall Stance**: 基於你的分析，整體是 '看好' 還是 '看壞'？
      2.  **Fundamentals**: 評估其技術創新能力、研發投入等基本面優勢。
      3.  **Technicals**: 從技術產品的角度評估其市場地位、競爭力。
      4.  **Momentum**: 評估其在開發者社群或技術圈的討論熱度與趨勢。
      5.  **Risk Assessment**: 評估其可能面臨的技術被淘汰、專利訴訟或人才流失等風險。
      為以上每個面向提供 0-100 的分數和簡短理由。你的回覆必須是符合以下結構的 JSON 物件:
      {"overallStance": "'看好' 或 '看壞'", "fundamentals": {"score": 數字, "reasoning": "字串"}, "technicals": {"score": 數字, "reasoning": "字串"}, "momentum": {"score": 數字, "reasoning": "字串"}, "riskAssessment": {"score": 數字, "reasoning": "字串"}}
      `;
    
    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
};

const getStockAnalysisReport = async (model: string, stock: ScoredStock, news?: NewsSentimentReport): Promise<DebateReport> => {
    const messages = buildStockAnalysisMessages(stock, news);
    const content = await _callGitHubModel(model, messages);
    return JSON.parse(content) as DebateReport;
}

export const getGitHubCopilotAnalysis = (stock: ScoredStock, news?: NewsSentimentReport) => 
    getStockAnalysisReport("gpt-4o-mini", stock, news);

export const getGitHubOpenAIAnalysis = (stock: ScoredStock, news?: NewsSentimentReport) => 
    getStockAnalysisReport("gpt-4o", stock, news);

export const getGitHubDeepSeekAnalysis = (stock: ScoredStock, news?: NewsSentimentReport) => 
    getStockAnalysisReport("DeepSeek-R1", stock, news);

export const getGitHubXAIAnalysis = (stock: ScoredStock, news?: NewsSentimentReport) =>
    getStockAnalysisReport("grok-3", stock, news);

export const getGitHubModelTestResponse = async (model: string, messages: { role: 'user' | 'system', content: string }[]): Promise<string> => {
    try {
        const response = await fetch(`/.netlify/functions/stock-api?source=github_models`, {
            method: 'POST',
            body: JSON.stringify({
                model: model, 
                messages: messages,
                stream: false,
                // Do not request JSON for this text-based test
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Unknown GitHub Models API error (${response.status})`);
        }

        const result = await response.json();
        return result.choices[0]?.message?.content || "模型未回傳任何內容。";

    } catch (error) {
        console.error(`Error testing GitHub Model (${model}):`, error);
        throw new Error(`GitHub (${model}) 測試失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};
