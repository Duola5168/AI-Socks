import { GoogleGenAI, Type } from "@google/genai";
import { ScoredStock, TradeHistory, AIStockReport, StockCategory, MarketHealth, AIMarketStrategySuggestion, DebateReport, FinalDecision, DebatePoint, NewsArticle, NewsSentimentReport, StrategySettings, AIStrategyAnalysis } from '../types';
import { getCriteriaText } from './utils';
import { config } from './config';
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

const getStrategyText = (strategy?: string): string => {
    if (!strategy) return '手動選股';
    // Check for new AI categories first
    if (['進攻型', '穩健型', '保守型'].includes(strategy)) {
        return `AI ${strategy}策略`;
    }
    // Check for old strategies
    switch (strategy) {
        case 'SHORT_TERM_BREAKOUT': return '短線噴發策略';
        case 'DARK_HORSE': return '潛力黑馬策略';
        case 'STABLE_GROWTH': return '穩健成長策略';
        default: return strategy;
    }
};

const debatePointSchema = {
    type: Type.OBJECT,
    properties: {
        score: { type: Type.NUMBER, description: "對此面向的評分 (0-100)。" },
        reasoning: { type: Type.STRING, description: "給予此分數的簡要理由 (約 30-50 字)。" },
    },
    required: ["score", "reasoning"],
};

const debateReportSchema = {
    type: Type.OBJECT,
    properties: {
        overallStance: { type: Type.STRING, enum: ['看好', '看壞'] },
        fundamentals: debatePointSchema,
        technicals: debatePointSchema,
        momentum: debatePointSchema,
        riskAssessment: debatePointSchema,
    },
    required: ["overallStance", "fundamentals", "technicals", "momentum", "riskAssessment"],
};

export const getGeminiProAnalysis = async (scoredStock: ScoredStock, newsReport?: NewsSentimentReport): Promise<DebateReport> => {
    if (!config.geminiApiKey) throw new Error("缺少 Gemini API 金鑰。");
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const { stock, breakdown } = scoredStock;
    const metCriteria = getCriteriaText(breakdown);
    const klineDataSummary = stock.kline.slice(-30).map(d => `{d:"${d.time}",c:${d.close}}`).join(',');

    const newsContext = newsReport ? `
      **最新新聞輿情分析 (情緒: ${newsReport.sentiment}):**
      - 新聞總結: ${newsReport.summary}
      - 關鍵新聞點:
        ${newsReport.keyPoints.map(p => `- ${p}`).join('\n')}
      請在你的分析中，特別是在評估基本面和動能時，將此新聞輿情納入考量。
    ` : '無相關新聞輿情資料。';


    const systemInstruction = `你是一位樂觀但理性的“正方”金融分析師。你的任務是專注於找出目標股票的**所有優勢和潛力**。請從基本面、技術面、籌碼動能等角度進行分析，並為每個面向進行量化評分。你的分析必須完全基於數據，並以結構化的 JSON 格式返回。

你可用的數據點參考如下，請在分析時納入考量：

**台灣證券交易所 (TWSE) OpenAPI:**
${twseApiReference}

**FinMind API:**
${finmindApiReference}`;

    const prompt = `
      ${newsContext}

      **目標股票資料:**
      - 名稱: ${stock.name} (${stock.ticker})
      - 當前價格: ${stock.kline[stock.kline.length - 1].close.toFixed(2)}
      - 關鍵數據: 營收年增率=${stock.revenueGrowth.toFixed(2)}%, 連續營收成長 ${stock.consecutiveRevenueGrowthMonths} 個月, 波動率=${(stock.volatility * 100).toFixed(2)}%
      - 符合的篩選條件: ${metCriteria.join('、')}
      - 最近30日K線數據 (部分): [${klineDataSummary}]

      **分析指令:**
      請扮演正方分析師，找出這支股票的優點。
      1.  **Overall Stance**: 基於你的分析，整體是 '看好' 還是 '看壞'？
      2.  **Fundamentals**: 評估其營收成長、獲利能力等基本面優勢。
      3.  **Technicals**: 評估其K線型態、均線排列等技術面優勢。
      4.  **Momentum**: 評估其成交量、市場關注度等動能優勢。
      5.  **Risk Assessment**: 從**正面角度**評估其風險，例如，指出其波動率雖高，但可能帶來更高回報，或其風險相對同業較低。
      為以上每個面向提供 0-100 的分數和簡短理由。
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: debateReportSchema,
            },
        });
        return JSON.parse(response.text.trim()) as DebateReport;
    } catch (error) {
        console.error("Error calling Gemini API for Pro analysis:", error);
        throw new Error(`Gemini 正方分析失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const getGeminiFinalDecision = async (proAnalysis: DebateReport, conAnalysis: DebateReport, stock: ScoredStock['stock'], newsReport?: NewsSentimentReport): Promise<FinalDecision> => {
    if (!config.geminiApiKey) throw new Error("缺少 Gemini API 金鑰。");
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    
    const newsContext = newsReport ? `
      **獨立新聞輿情分析 (情緒: ${newsReport.sentiment}):**
      - 新聞總結: ${newsReport.summary}
      - 關鍵新聞點:
        ${newsReport.keyPoints.map(p => `- ${p}`).join('\n')}
      這份獨立的輿情報告應作為你最終決策的關鍵參考之一，用以驗證或挑戰兩位分析師的觀點。
    ` : '無相關新聞輿情資料。';


    const systemInstruction = `你是一位資深的金融投資總監。你的任務是審閱兩位下屬分析師（正方 Gemini，反方 Groq）的報告，並結合獨立的新聞輿情分析，做出最終的、權威的投資決策。你的決策應綜合所有觀點，並以客戶易於理解的方式呈現。你的回覆必須是結構化的 JSON 格式。

你可用的數據點參考如下，請在分析時納入考量：

**台灣證券交易所 (TWSE) OpenAPI:**
${twseApiReference}

**FinMind API:**
${finmindApiReference}`;
    
    const finalDecisionSchema = {
        type: Type.OBJECT,
        properties: {
            compositeScore: { type: Type.NUMBER, description: "綜合正反方觀點和所有數據後，你給出的最終綜合分數 (0-100)。" },
            action: { type: Type.STRING, enum: ['買進', '觀望', '避免'], description: "基於你的分數和分析，給出的明確投資建議。" },
            confidence: { type: Type.STRING, enum: ['高', '中', '低'], description: "你對此決策的信心水準。若正反方意見一致，信心應較高。" },
            keyReasons: {
                type: Type.ARRAY,
                description: "列出 3-5 個支持你最終決策的最關鍵理由（條列式）。",
                items: { type: Type.STRING }
            },
            synthesisReasoning: { type: Type.STRING, description: "約 50-70 字，說明你如何得出最終結論，如何權衡正反方觀點。例如：'我更認同反方，因其指出的高負債風險在當前市場環境下至關重要。'或'雙方皆看好，強化了多頭訊號，故維持買進評級。'" }
        },
        required: ["compositeScore", "action", "confidence", "keyReasons", "synthesisReasoning"],
    };

    const prompt = `
      **股票:** ${stock.name} (${stock.ticker})
      
      ${newsContext}

      **正方 (Gemini) 分析報告 (著重優勢):**
      - 整體看法: ${proAnalysis.overallStance}
      - 基本面: ${proAnalysis.fundamentals.score}/100, 理由: ${proAnalysis.fundamentals.reasoning}
      - 技術面: ${proAnalysis.technicals.score}/100, 理由: ${proAnalysis.technicals.reasoning}
      - 動能: ${proAnalysis.momentum.score}/100, 理由: ${proAnalysis.momentum.reasoning}
      - 風險評估 (正面解讀): ${proAnalysis.riskAssessment.score}/100, 理由: ${proAnalysis.riskAssessment.reasoning}

      **反方 (Groq) 分析報告 (專找缺陷):**
      - 整體看法: ${conAnalysis.overallStance}
      - 基本面: ${conAnalysis.fundamentals.score}/100, 理由: ${conAnalysis.fundamentals.reasoning}
      - 技術面: ${conAnalysis.technicals.score}/100, 理由: ${conAnalysis.technicals.reasoning}
      - 動能: ${conAnalysis.momentum.score}/100, 理由: ${conAnalysis.momentum.reasoning}
      - 風險評估 (負面解讀): ${conAnalysis.riskAssessment.score}/100, 理由: ${conAnalysis.riskAssessment.reasoning}

      **決策指令:**
      作為投資總監，請綜合以上所有資訊，做出最終決策。
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: finalDecisionSchema,
            },
        });
        return JSON.parse(response.text.trim()) as FinalDecision;
    } catch (error) {
        console.error("Error calling Gemini API for final decision:", error);
        throw new Error(`Gemini 最終決策失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const getNewsSentimentSummary = async (articles: NewsArticle[]): Promise<NewsSentimentReport> => {
    if (!config.geminiApiKey) throw new Error("缺少 Gemini API 金鑰。");
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const systemInstruction = "你是一位專門分析金融新聞的AI。你的任務是閱讀一系列新聞標題和摘要，並以結構化的JSON格式，提供一個中立、客觀的情緒總結。";
    
    const newsContent = articles.map(a => `- **標題:** ${a.title}\n  **摘要:** ${a.description}`).join('\n\n');

    const prompt = `
      請分析以下新聞內容，並提供情緒總結。
      
      **新聞列表:**
      ${newsContent}

      **分析指令:**
      1.  **sentiment**: 根據整體新聞氛圍，判斷情緒是 '正面', '負面', 或 '中性'。
      2.  **summary**: 用一句話（約 30-50 字）總結最近的新聞焦點。
      3.  **keyPoints**: 列出 2-3 個最具影響力的正面或負面新聞事件（條列式）。如果新聞平淡，可以說明「無重大多空消息」。
      4.  **articleCount**: 計算你分析的文章總數。
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            sentiment: {
                type: Type.STRING,
                description: "整體新聞情緒。",
                enum: ['正面', '負面', '中性'],
            },
            summary: {
                type: Type.STRING,
                description: "用一句話總結最近的新聞焦點。",
            },
            keyPoints: {
                type: Type.ARRAY,
                description: "列出 2-3 個最具影響力的正面或負面新聞事件。",
                items: { type: Type.STRING }
            },
            articleCount: {
                type: Type.NUMBER,
                description: "分析的文章總數。",
            },
        },
        required: ["sentiment", "summary", "keyPoints", "articleCount"],
    };
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        const report = JSON.parse(response.text.trim()) as NewsSentimentReport;
        // Ensure count is correct
        report.articleCount = articles.length;
        return report;

    } catch (error) {
        console.error("Error calling Gemini API for news sentiment analysis:", error);
        throw new Error(`Gemini 新聞情緒分析失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};


export const getAIStockReport = async (scoredStock: Omit<ScoredStock, 'aiReport'>, tradeHistory: TradeHistory[], tradeUnitMode: 'fractional' | 'whole'): Promise<AIStockReport> => {
    if (!config.geminiApiKey) {
        throw new Error("AI 分析功能無法使用，因為尚未設定 Gemini API 金鑰。");
    }
    
    const { stock, breakdown } = scoredStock;
    const metCriteria = getCriteriaText(breakdown);
    const klineDataSummary = stock.kline.slice(-30).map(d => `{date:"${d.time}",close:${d.close.toFixed(2)}}`).join(', ');

    const historySummary = tradeHistory.slice(0, 5).map(t => {
        const outcome = t.profit > 0 ? '獲利' : '虧損';
        return `- ${t.name}: ${outcome} ${((t.sellPrice - t.entryPrice) / t.entryPrice * 100).toFixed(1)}%。賣出時機複盤: ${t.postSellAnalysis || '無'}`;
    }).join('\n');
    
    const tradeUnitContext = tradeUnitMode === 'fractional'
      ? '我目前傾向於進行零股交易，請在分析時將此納入考量，例如流動性是否適合零股操作。'
      : '我目前傾向於進行整股交易。';
      
    const systemInstruction = `你是一位頂尖的金融分析師，風格類似喬治·索羅斯，擅長結合技術分析、基本面和市場情緒，進行短線操作判斷。
      我的交易策略是短線操作，通常在週一進場，並期望在週五根據當週表現決定是否出場或續抱。請基於此**一週**的交易框架進行分析。
      你的結論必須嚴格按照指定的 JSON Schema 格式返回。

你可用的數據點參考如下，請在分析時納入考量：

**台灣證券交易所 (TWSE) OpenAPI:**
${twseApiReference}

**FinMind API:**
${finmindApiReference}`;

    const prompt = `
      ${tradeUnitContext}

      **重要參考：我過去的交易經驗總結**
      為了讓你更了解我的風格與盲點，這裡是我最近的交易複盤摘要。請將這些歷史經驗納入考量來優化你的推薦，幫助我避免重複犯錯。
      ${historySummary || "尚無歷史交易可供參考。"}

      **目標股票資料:**
      - 名稱: ${stock.name} (${stock.ticker})
      - 當前價格: ${stock.kline[stock.kline.length - 1].close.toFixed(2)}
      - 關鍵數據: 營收年增率=${stock.revenueGrowth.toFixed(2)}%, 連續營收成長 ${stock.consecutiveRevenueGrowthMonths} 個月, 波動率=${(stock.volatility * 100).toFixed(2)}%
      - 符合的篩選條件: ${metCriteria.join('、')}
      - 最近30日K線數據 (部分): [${klineDataSummary}]

      請根據以上所有資訊，進行分析並返回你的結論。
      `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            category: {
                type: Type.STRING,
                description: "基於股票的動能、基本面、穩定性，並**參考我過去的交易經驗**，將其歸類為 '進攻型', '穩健型', 或 '保守型'。",
                enum: ['進攻型', '穩健型', '保守型'],
            },
            reasoning: {
                type: Type.STRING,
                description: "簡要說明為什麼這支股票被選中，以及你將其歸類到該類別的主要原因 (約50-70字)。",
            },
            entryAnalysis: {
                type: Type.STRING,
                description: "分析並提供一個具體的短線進場時機建議。例如：'等待股價回測5日線不破時' 或 '若明日帶量突破今日高點' (約50-70字)。",
            },
            supportLevel: {
                type: Type.NUMBER,
                description: "根據最近的K線數據，計算並提供一個關鍵的支撐價位。",
            },
            resistanceLevel: {
                type: Type.NUMBER,
                description: "根據最近的K線數據，計算並提供一個關鍵的壓力價位。",
            },
        },
        required: ["category", "reasoning", "entryAnalysis", "supportLevel", "resistanceLevel"],
    };
    
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        const jsonText = response.text.trim();
        const report = JSON.parse(jsonText);
        
        const validCategories: StockCategory[] = ['進攻型', '穩健型', '保守型'];
        if (!validCategories.includes(report.category)) {
            report.category = '穩健型'; // Fallback
        }
        return report as AIStockReport;
    } catch (error) {
        console.error("Error calling Gemini API for stock report:", error);
        throw new Error(`Gemini API 呼叫失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};


export const getPostTradeAnalysis = async (trade: TradeHistory): Promise<string> => {
  if (!config.geminiApiKey) {
    return "AI 分析功能無法使用，因為尚未設定 Gemini API 金鑰。";
  }
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

  const { name, ticker, entryPrice, sellPrice, shares, profit, breakdown, initialScore, strategy, postSellAnalysis } = trade;
  const outcome = profit > 0 ? '獲利' : '虧損';
  const strategyText = getStrategyText(strategy);

  let analysisContext = "這是一筆手動加入的交易。";
  if (breakdown && initialScore && strategy) {
      const metCriteria = getCriteriaText(breakdown);
      analysisContext = `這檔股票是透過「${strategyText}」策略選出的，原始評分為 ${initialScore}，基於以下條件：${metCriteria.join('、')}。`;
  }

  const prompt = `
    你是一位頂尖的投資策略教練，擅長從歷史交易中總結經驗並優化策略。我剛剛完成了一筆交易，請幫我進行深度複盤。我的策略是**週一進場、週五評估**的短線交易。
    
    **交易詳情:**
    - 股票: ${name} (${ticker})
    - 買入價格: ${entryPrice.toFixed(2)}
    - 賣出價格: ${sellPrice.toFixed(2)}
    - 股數: ${shares}
    - 最終結果: **${outcome} ${Math.abs(profit).toFixed(2)} 元**
    
    **原始選股背景:**
    - ${analysisContext}

    **賣出時機複盤 (由系統自動生成):**
    - ${postSellAnalysis || '尚無分析。'}
    
    **分析請求 (請以條列式、簡潔扼要的方式回答):**
    1.  **策略評估:** 根據這筆交易的結果和選股理由，這次的「${strategyText}」策略應用是否成功？簡要說明原因。
    2.  **關鍵因子分析:** 在當初的選股條件中，哪些是這次交易成功(或失敗)的關鍵？哪些可能無關緊要或產生誤導？
    3.  **優化建議:** 結合**賣出時機複盤**的結果，為了優化我未來的「${strategyText}」策略，我應該更關注哪些指標，或如何調整進出場標準？
    
    請用專業但易懂的語氣，提供約 150 字的繁體中文分析。
  `;

  try {
     const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API for post-trade analysis:", error);
    return "AI 交易複盤分析時發生錯誤。";
  }
};

export const getSellTimingAnalysis = async (trade: TradeHistory, postSellPrices: number[]): Promise<string> => {
    if (!config.geminiApiKey) {
        return "無法分析，缺少 API 金鑰。";
    }
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    const { name, sellPrice, sellDate } = trade;
    const priceChangePercent = ((postSellPrices[2] - sellPrice) / sellPrice * 100).toFixed(2);

    const prompt = `
      你是一位交易教練，請用簡潔、精闢的語言分析我的賣出時機。
      - **股票**: ${name}
      - **賣出日期**: ${sellDate}
      - **賣出價格**: ${sellPrice.toFixed(2)}
      - **賣出後3日收盤價**: ${postSellPrices.map(p => p.toFixed(2)).join(', ')}
      
      **分析任務:**
      根據賣出後股價上漲/下跌 ${priceChangePercent}% 的事實，判斷我的賣出時機是「時機絕佳」、「正常發揮」還是「賣出過早」？
      並提供一行核心建議來改進我未來的出場策略。總共約 50-70 字。
    `;
    
    try {
        const response = await ai.models.generateContent({
         model: 'gemini-2.5-flash',
         contents: prompt,
       });
       return response.text;
     } catch (error) {
       console.error("Error calling Gemini API for sell timing analysis:", error);
       return "AI 賣出時機分析時發生錯誤。";
     }
};

export const getMarketStrategySuggestion = async (marketContext: MarketHealth): Promise<AIMarketStrategySuggestion> => {
    if (!config.geminiApiKey) {
        throw new Error("AI 分析功能無法使用，因為尚未設定 Gemini API 金鑰。");
    }
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    
    const systemInstruction = `你是一位首席市場策略師，專為短線交易者提供宏觀建議。你的任務是根據市場的整體健康指標，從'進攻型'、'穩健型'、'保守型'中推薦一個最適合的策略。你的回答必須簡潔有力，並嚴格遵循指定的 JSON Schema 格式。`;

    const prompt = `
      **當前市場健康指標:**
      - **多頭趨勢股票佔比 (股價 > 20日均線):** ${marketContext.percentAboveMa20}%
        (解讀參考: > 60% 為強勢多頭, < 40% 為弱勢或空頭, 其餘為盤整)
      - **市場平均波動率:** ${marketContext.avgVolatility}%
        (解讀參考: < 1.5% 為低波動, 1.5%-2.5% 為中等, > 2.5% 為高波動)

      請根據以上數據，提供你的策略建議。
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            suggestedStrategy: {
                type: Type.STRING,
                description: "基於市場數據，推薦最適合的策略。",
                enum: ['進攻型', '穩健型', '保守型'],
            },
            reasoning: {
                type: Type.STRING,
                description: "用一句話精簡地解釋你推薦此策略的原因 (約 30-50 字)。例如：'市場多頭趨勢強勁且波動平穩，適合採用進攻型策略捕捉動能。'。",
            },
        },
        required: ["suggestedStrategy", "reasoning"],
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.2,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as AIMarketStrategySuggestion;
    } catch (error) {
        console.error("Error calling Gemini API for market strategy suggestion:", error);
        throw new Error(`AI 市場策略建議分析時發生錯誤: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const getStrategyAnalysis = async (settings: StrategySettings, marketContext: MarketHealth, tradeHistory: TradeHistory[]): Promise<AIStrategyAnalysis> => {
    if (!config.geminiApiKey) {
        throw new Error("AI 分析功能無法使用，因為尚未設定 Gemini API 金鑰。");
    }
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const systemInstruction = `你是一位數據驅動的投資策略顧問。你的任務是分析使用者提供的策略設定，結合當前市場狀況和歷史交易數據，提供具體的優化建議。你的回覆必須嚴格遵循指定的 JSON Schema 格式。`;

    const historySummary = tradeHistory.slice(0, 5).map(t => {
        const outcome = t.profit > 0 ? '獲利' : '虧損';
        return `- ${t.name}: ${outcome} ${((t.sellPrice - t.entryPrice) / t.entryPrice * 100).toFixed(1)}%。`;
    }).join('\n');

    const prompt = `
      **當前市場健康指標:**
      - 多頭趨勢股票佔比: ${marketContext.percentAboveMa20}%
      - 市場平均波動率: ${marketContext.avgVolatility}%

      **使用者最近交易歷史 (摘要):**
      ${historySummary || "尚無交易歷史。"}

      **使用者目前的策略設定:**
      - **篩選權重:** ${JSON.stringify(settings.weights)}
      - **篩選條件:** ${JSON.stringify(settings.screener)}
      - **投資組合監控:** ${JSON.stringify(settings.portfolio)}

      **分析指令:**
      請根據以上所有資訊，對此策略進行評估並返回你的結論。
      1.  **marketOutlook**: 根據市場健康指標，簡要描述當前市場是處於多頭、空頭還是盤整格局，以及市場的風險偏好程度 (約 30-50 字)。
      2.  **strategyCritique**: 評論使用者目前的策略設定在當前市場環境下的優缺點。例如，在高波動市場下，停損點是否過於寬鬆？(約 50-70 字)。
      3.  **recommendations**: 提供 2-3 個最具體的參數調整建議，以優化此策略。解釋調整原因，並提供建議值。如果認為某個參數設定良好，可以不提出建議。
    `;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            marketOutlook: {
                type: Type.STRING,
                description: "對當前市場格局和風險的簡要描述。",
            },
            strategyCritique: {
                type: Type.STRING,
                description: "評論當前策略在目前市場環境下的優缺點。",
            },
            recommendations: {
                type: Type.ARRAY,
                description: "具體的參數調整建議列表。",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        parameter: { type: Type.STRING, description: "建議調整的參數名稱 (例如: '停損點' 或 '營收年增率權重')。" },
                        currentValue: { type: Type.STRING, description: "參數的當前值。" },
                        recommendedValue: { type: Type.STRING, description: "建議的調整後數值。" },
                        reason: { type: Type.STRING, description: "調整此參數的簡要理由。" }
                    },
                    required: ["parameter", "currentValue", "recommendedValue", "reason"]
                }
            },
        },
        required: ["marketOutlook", "strategyCritique", "recommendations"],
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.3,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as AIStrategyAnalysis;
    } catch (error) {
        console.error("Error calling Gemini API for strategy analysis:", error);
        throw new Error(`Gemini 策略分析失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};
