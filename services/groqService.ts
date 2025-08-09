import { ScoredStock, TradeHistory, DebateReport, NewsSentimentReport, AIStrategyAnalysis, MarketHealth, StrategySettings } from '../types';
import { getCriteriaText } from './utils';
import { TWSE_API_ENDPOINTS } from './twseApiEndpoints';
import { FINMIND_API_ENDPOINTS } from './finmindApiEndpoints';

// Helper to format the API endpoints list for the AI prompt
const twseApiReference = Object.entries(TWSE_API_ENDPOINTS)
    .map(([category, endpoints]) => 
        `${category}:\n${endpoints.map(e => `- ${e.endpoint}: ${e.description}`).join('\n')}`
    )
    .join('\n\n');

const finmindApiReference = Object.entries(FINMIND_API_ENDPOINTS)
    .map(([category, datasets]) =>
        `${category}:\n${datasets.map(d => `- ${d.dataset}: ${d.description}`).join('\n')}`
    )
    .join('\n\n');


// Generic function to get a structured JSON report from Groq
const getGroqJSONReport = async <T,>(apiKey: string, userPrompt: string, systemPrompt: string): Promise<T> => {
     try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'llama3-70b-8192',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.5,
            }),
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Groq API Error:", errorData);
            throw new Error(errorData.error?.message || 'Unknown Groq API error');
        }

        const result = await response.json();
        return JSON.parse(result.choices[0].message.content) as T;

    } catch (error) {
        console.error("Error calling Groq API for JSON report:", error);
        throw new Error(`Groq API 呼叫失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};


export const getGroqConAnalysis = async (apiKey: string, scoredStock: ScoredStock, newsReport?: NewsSentimentReport): Promise<DebateReport> => {
     if (!apiKey) {
        throw new Error("AI 第二意見功能無法使用，因為尚未設定 Groq API 金鑰。");
    }
    
    const { stock, breakdown } = scoredStock;
    const metCriteria = getCriteriaText(breakdown);
    const klineDataSummary = stock.kline.slice(-30).map(d => `{d:"${d.time}",c:${d.close}}`).join(',');
    
    const newsContext = newsReport ? `
      **最新新聞輿情分析 (情緒: ${newsReport.sentiment}):**
      - 新聞總結: ${newsReport.summary}
      - 關鍵新聞點:
        ${newsReport.keyPoints.map(p => `- ${p}`).join('\n')}
      請在你的分析中，利用此新聞輿情來佐證或發現潛在風險。
    ` : '無相關新聞輿情資料。';

    const systemPrompt = `你是一位謹慎且具批判性的“反方”金融分析師。你的任務是專注於找出目標股票的**所有潛在風險和缺陷**。請從基本面、技術面、籌碼動能等角度進行分析，並為每個面向進行量化評分。分數越低代表風險越高。你的分析必須完全基於數據，並嚴格以結構化的 JSON 格式返回。

你可用的數據點參考如下，請在分析時納入考量：

**台灣證券交易所 (TWSE) OpenAPI:**
${twseApiReference}

**FinMind API:**
${finmindApiReference}`;

    const userPrompt = `
      ${newsContext}

      **目標股票資料:**
      - 名稱: ${stock.name} (${stock.ticker})
      - 當前價格: ${stock.kline[stock.kline.length - 1].close.toFixed(2)}
      - 關鍵數據: 營收年增率=${stock.revenueGrowth.toFixed(2)}%, 連續營收成長 ${stock.consecutiveRevenueGrowthMonths} 個月, 波動率=${(stock.volatility * 100).toFixed(2)}%
      - 符合的篩選條件: ${metCriteria.join('、')}
      - 最近30日K線數據 (部分): [${klineDataSummary}]

      **分析指令:**
      請扮演反方分析師，找出這支股票的風險與缺陷。
      1.  **Overall Stance**: 基於你的分析，整體是 '看好' 還是 '看壞'？
      2.  **Fundamentals**: 評估其營收是否不穩、獲利能力是否有隱憂等基本面缺陷。
      3.  **Technicals**: 評估其K線型態是否出現警訊、均線排列是否有壓力等技術面缺陷。
      4.  **Momentum**: 評估其成交量是否退潮、市場熱度是否消散等動能缺陷。
      5.  **Risk Assessment**: 從**負面角度**評估其風險，例如，指出其波動率過高可能導致巨大虧損，或其產業前景不明。
      為以上每個面向提供 0-100 的分數（分數越低風險越高）和簡短理由。
      `;
      
    const schemaDescription = `你必須嚴格地只用繁體中文回傳一個 JSON 物件，其結構必須符合：{"overallStance": "'看好' 或 '看壞'", "fundamentals": {"score": 數字, "reasoning": "字串"}, "technicals": {"score": 數字, "reasoning": "字串"}, "momentum": {"score": 數字, "reasoning": "字串"}, "riskAssessment": {"score": 數字, "reasoning": "字串"}}`;

    return getGroqJSONReport<DebateReport>(apiKey, userPrompt, `${systemPrompt}\n${schemaDescription}`);
};

export const getGroqStrategyAnalysis = async (apiKey: string, settings: StrategySettings, marketContext: MarketHealth, tradeHistory: TradeHistory[]): Promise<AIStrategyAnalysis> => {
     if (!apiKey) {
        throw new Error("AI 第二意見功能無法使用，因為尚未設定 Groq API 金鑰。");
    }

    const systemPrompt = `你是一位持懷疑態度且注重風險的投資策略顧問。你的任務是從批判性的角度分析使用者提供的策略設定，結合當前市場狀況和歷史交易數據，找出潛在的弱點並提供優化建議。你的回覆必須嚴格遵循指定的 JSON 物件格式。

你可用的數據點參考如下，請在分析時納入考量：

**台灣證券交易所 (TWSE) OpenAPI:**
${twseApiReference}

**FinMind API:**
${finmindApiReference}`;

    const historySummary = tradeHistory.slice(0, 5).map(t => {
        const outcome = t.profit > 0 ? '獲利' : '虧損';
        return `- ${t.name}: ${outcome} ${((t.sellPrice - t.entryPrice) / t.entryPrice * 100).toFixed(1)}%。`;
    }).join('\n');

    const userPrompt = `
      **當前市場健康指標:**
      - 多頭趨勢股票佔比: ${marketContext.percentAboveMa20}%
      - 市場平均波動率: ${marketContext.avgVolatility}%

      **使用者最近交易歷史 (摘要):**
      ${historySummary || "尚無交易歷史。"}

      **使用者目前的策略設定:**
      - **篩選權重:** ${JSON.stringify(settings.weights)}
      - **篩選條件:** ${JSON.stringify(settings.screener)}
      - **投資組合監控:** ${JSON.stringify(settings.portfolio)}

      **分析指令 (批判性角度):**
      1.  **marketOutlook**: 從風險角度解讀市場健康指標，指出潛在的宏觀風險 (約 30-50 字)。
      2.  **strategyCritique**: 批判使用者目前的策略設定，在當前市場環境下可能有哪些盲點或風險。例如，在弱勢市場下，營收成長權重是否過高？(約 50-70 字)。
      3.  **recommendations**: 提供 2-3 個最關鍵的參數調整建議，以增強策略的防禦性或適應性。解釋調整原因，並提供建議值。
    `;

    const schemaDescription = `你必須嚴格地只用繁體中文回傳一個 JSON 物件，其結構必須符合：{"marketOutlook": "字串", "strategyCritique": "字串", "recommendations": [{"parameter": "字串", "currentValue": "字串", "recommendedValue": "字串", "reason": "字串"}]}`;
    
    return getGroqJSONReport<AIStrategyAnalysis>(apiKey, userPrompt, `${systemPrompt}\n${schemaDescription}`);
};
