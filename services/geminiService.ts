import { GoogleGenAI, Type } from "@google/genai";
import { 
    ScoredStock, TradeHistory, AIStockReport, StockCategory, MarketHealth, AIMarketStrategySuggestion, 
    AnalystReport, FinalDecision, NewsArticle, NewsSentimentReport, StrategySettings, AIStrategyAnalysis, 
    PartialStockData, StockData, AnalysisPanel, ScreenerStrategy, BacktestMetrics, SimulatedTrade, AIBacktestAnalysis,
    BacktestResult, AIEvolutionAnalysis
} from '../types';
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

const analystReportSchema = {
    type: Type.OBJECT,
    properties: {
        overallStance: { type: Type.STRING, enum: ['看好', '看壞', '中立'], description: "基於你的分析，給出整體立場。" },
        candlestickPattern: { type: Type.STRING, description: "分析K線圖的型態並附上簡短解說，例如：'多頭吞噬 (強烈的看漲訊號，表示買方力道強勁)'、'十字星 (市場猶豫不決的信號)'。" },
        movingAverageAlignment: { type: Type.STRING, description: "描述短期、中期和長期均線的排列關係，例如：'多頭排列'、'空頭排列'、'均線糾結'。" },
        technicalIndicators: { type: Type.STRING, description: "綜合評估RSI、KD、MACD等技術指標的訊號。" },
        institutionalActivity: { type: Type.STRING, description: "分析三大法人（外資、投信、自營商）的籌碼動向。" },
        fundamentalAssessment: { type: Type.STRING, description: "評估營收成長、ROE、EPS等基本面數據的優劣勢。" },
        supportLevel: { type: Type.STRING, description: "提供一個具體的關鍵支撐價位。" },
        resistanceLevel: { type: Type.STRING, description: "提供一個具體的關鍵壓力價位。" },
        recommendedEntryZone: { type: Type.STRING, description: "建議的進場價格區間與條件。" },
        recommendedExitConditions: { type: Type.STRING, description: "建議的出場條件，例如跌破某均線或出現特定K線訊號。" },
        supplementaryAnalysis: { type: Type.STRING, description: "任何額外的補充分析或觀察。" },
    },
     required: [
        "overallStance", "candlestickPattern", "movingAverageAlignment",
        "technicalIndicators", "institutionalActivity", "fundamentalAssessment",
        "supportLevel", "resistanceLevel", "recommendedEntryZone",
        "recommendedExitConditions", "supplementaryAnalysis"
    ]
};

export const getAITopStocks = async (model: string, allStaticData: PartialStockData[], userPrompt: string): Promise<string[]> => {
    if (!config.geminiApiKey) throw new Error("缺少 Gemini API 金鑰。");
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const preFilteredData = allStaticData
        .filter(s => s.tradeValue && s.tradeValue > 10_000_000)
        .sort((a, b) => (b.tradeValue ?? 0) - (a.tradeValue ?? 0))
        .slice(0, 300);

    const dataSummary = preFilteredData.map(s => ({
        id: s.id,
        n: s.name,
        pe: s.peRatio,
        pb: s.pbRatio,
        y: s.dividendYield,
        v: s.tradeValue,
        rg: s.revenueGrowth, // 營收成長率 (%)
        roe: s.roe,
        eps: s.eps,
    }));

    const systemInstruction = `你是一位頂尖的量化金融分析師，你的篩選模型透過不斷學習歷史市場數據而進化。專長是從大量的靜態市場數據中，根據特定的投資策略，快速篩選出最具潛力的股票。你的任務是接收一個 JSON 格式的股票數據摘要，並根據指定的策略，回傳一個包含前 20 名最符合條件的股票代號的 JSON 陣列。你必須只回傳 JSON 陣列，不包含任何其他文字。`;
    
    const prompt = `
      **投資策略:** ${userPrompt}

      **市場數據摘要 (JSON):**
      ${JSON.stringify(dataSummary)}

      **任務:**
      請根據上述投資策略，從提供的市場數據中篩選出前 20 名最符合條件的股票，並以 JSON 陣列格式回傳它們的 'id'。

      **回傳範例:** ["2330", "2317", "2454", ...]
    `;
    
    const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
          description: '股票代號',
        },
    };
    
    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.1
            },
        });
        const result = JSON.parse(response.text.trim());
        if(Array.isArray(result) && result.every(item => typeof item === 'string')) {
            return result.slice(0, 20);
        }
        throw new Error("AI 回傳格式不符預期。");
    } catch (error) {
        console.error("Error calling Gemini API for AI Top Stocks:", error);
        throw new Error(`Gemini AI 初篩失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const getGeminiProAnalysis = async (model: string, scoredStock: ScoredStock, newsReport?: NewsSentimentReport): Promise<AnalystReport> => {
    if (!config.geminiApiKey) throw new Error("缺少 Gemini API 金鑰。");
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const { stock, breakdown } = scoredStock;
    const metCriteria = getCriteriaText(breakdown);

    const newsContext = newsReport ? `
      **最新新聞輿情分析 (情緒: ${newsReport.sentiment}):**
      - 新聞總結: ${newsReport.summary}
      - 關鍵新聞點:
        ${newsReport.keyPoints.map(p => `- ${p}`).join('\n')}
      請在你的分析中，將此新聞輿情納入考量以強化你的樂觀論點。
    ` : '無相關新聞輿情資料。';

    const systemInstruction = `你是一位樂觀但理性的“正方”金融分析師，你深信成功的投資決策來自於對歷史數據的深刻理解與持續學習。你的任務是專注於找出目標股票的**所有優勢和潛力**，並提供一份結構化的分析報告。你的分析必須完全基於數據，並以結構化的 JSON 格式返回。

你分析的數據來自於一個整合性的後端服務，其中可能包含以下來源的資訊，請在分析時納入考量：

**台灣證券交易所 (TWSE) OpenAPI:**
${twseApiReference}

**FinMind API:**
${finmindApiReference}`;

    const prompt = `
      ${newsContext}

      **目標股票資料:**
      - 名稱: ${stock.name} (${stock.ticker})
      - 當前價格: ${stock.close?.toFixed(2)}
      - 關鍵數據: 營收年增率=${stock.revenueGrowth?.toFixed(2)}%, ROE=${stock.roe?.toFixed(2)}%, EPS=${stock.eps?.toFixed(2)}, P/E=${stock.peRatio?.toFixed(2)}, P/B=${stock.pbRatio?.toFixed(2)}
      - 符合的篩選條件: ${metCriteria.join('、')}

      **分析指令:**
      請扮演正方分析師，找出這支股票的優點，並填寫一份完整的分析報告。你的整體立場應為 '看好'。
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: analystReportSchema,
            },
        });
        return JSON.parse(response.text.trim()) as AnalystReport;
    } catch (error) {
        console.error("Error calling Gemini API for Pro analysis:", error);
        throw new Error(`Gemini 正方分析失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const getGeminiFinalDecision = async (model: string, analysisPanels: AnalysisPanel[], stock: StockData, newsReport?: NewsSentimentReport): Promise<FinalDecision> => {
    if (!config.geminiApiKey) throw new Error("缺少 Gemini API 金鑰。");
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    
    const newsContext = newsReport ? `
      **獨立新聞輿情分析 (情緒: ${newsReport.sentiment}):**
      - 新聞總結: ${newsReport.summary}
      - 關鍵新聞點:
        ${newsReport.keyPoints.map(p => `- ${p}`).join('\n')}
      這份獨立的輿情報告應作為你最終決策的關鍵參考之一，用以驗證或挑戰分析師們的觀點。
    ` : '無相關新聞輿情資料。';

    const analystReportsContext = analysisPanels.map(panel => `
      ---
      **分析師: ${panel.analystName} (立場: ${panel.report.overallStance})**
      - 基本面評估: ${panel.report.fundamentalAssessment}
      - 技術面評估: ${panel.report.candlestickPattern} & ${panel.report.movingAverageAlignment}
      - 籌碼面評估: ${panel.report.institutionalActivity}
      - 補充分析: ${panel.report.supplementaryAnalysis}
    `).join('\n');


    const systemInstruction = `你是一位資深的金融投資總監 (CIO)，你的決策框架是建立在對歷史市場週期的深刻理解之上，並透過不斷複盤過去的案例來持續進化。你的任務是審閱來自你旗下一個 AI 專家小組的多份詳細分析報告，並結合獨立的新聞輿情分析，做出最終的、權威的投資決策。你的決策不僅是方向性的，更需要包含具體、可執行的策略。你的回覆必須是結構化的 JSON 格式。

你分析的數據來自於一個整合性的後端服務，其中可能包含以下來源的資訊，請在分析時納入考量：

**台灣證券交易所 (TWSE) OpenAPI:**
${twseApiReference}

**FinMind API:**
${finmindApiReference}`;
    
    const finalDecisionSchema = {
        type: Type.OBJECT,
        properties: {
            compositeScore: { type: Type.NUMBER, description: "綜合所有分析師觀點和所有數據後，你給出的最終綜合分數 (0-100)。" },
            action: { type: Type.STRING, enum: ['買進', '觀望', '避免'], description: "基於你的分數和分析，給出的明確投資建議。" },
            confidence: { type: Type.STRING, enum: ['高', '中', '低'], description: "你對此決策的信心水準。若多數分析師意見一致，信心應較高。" },
            synthesisReasoning: { type: Type.STRING, description: "約 50-70 字，說明你如何得出最終結論，如何權衡不同分析師的觀點。例如：'儘管反方提出風險，但我更認同正方的基本面分析，因其數據更具說服力。'" },
            consensusAndDisagreement: { type: Type.STRING, description: "總結分析師之間的主要共識與分歧點。" },
            operationalStrategy: { type: Type.STRING, description: "基於你的決策，提供具體的操作策略。例如：'建議分批買進，避免一次性追高' 或 '等待股價回測月線不破時再考慮進場'。" },
            positionSizingSuggestion: { type: Type.STRING, description: "建議的資金配置比例。例如：'動用總資金的 5%' 或 '小倉位試單'。" },
            stopLossStrategy: { type: Type.STRING, description: "具體的停損策略。例如：'跌破月線' 或 '設定固定 8% 停損'。" },
            takeProfitStrategy: { type: Type.STRING, description: "具體的停利策略。例如：'出現長上影線爆量收黑時' 或 '目標價 150 元'。" },
            keyEventsToWatch: {
                type: Type.ARRAY,
                description: "列出 2-3 個需要密切關注的未來事件或指標，例如：'下月營收公布'、'外資籌碼動向'。",
                items: { type: Type.STRING }
            },
        },
        required: [
            "compositeScore", "action", "confidence", "synthesisReasoning",
            "consensusAndDisagreement", "operationalStrategy", "positionSizingSuggestion",
            "stopLossStrategy", "takeProfitStrategy", "keyEventsToWatch"
        ],
    };

    const prompt = `
      **目標股票:** ${stock.name} (${stock.ticker})
      
      ${newsContext}

      **AI 專家小組分析報告:**
      ${analystReportsContext}

      **決策指令:**
      作為投資總監，請綜合以上所有資訊，做出最終決策並提供完整的操作策略。
    `;

    try {
        const response = await ai.models.generateContent({
            model,
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

export const getNewsSentimentSummary = async (model: string, articles: NewsArticle[]): Promise<NewsSentimentReport> => {
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
            model,
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


export const getAIStockReport = async (model: string, scoredStock: Omit<ScoredStock, 'aiReport'>, tradeHistory: TradeHistory[], tradeUnitMode: 'fractional' | 'whole', strategy: ScreenerStrategy): Promise<AIStockReport> => {
    if (!config.geminiApiKey) {
        throw new Error("AI 分析功能無法使用，因為尚未設定 Gemini API 金鑰。");
    }
    
    const SHORT_STRATEGIES: ScreenerStrategy[] = ['M_TOP_REVERSAL', 'SUPPORT_BREAKDOWN', 'WEAK_MOMENTUM'];
    const isShortStrategy = SHORT_STRATEGIES.includes(strategy);
    
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
      
    const getSystemInstruction = () => {
        if (isShortStrategy) {
            return `你是一位頂尖的金融分析師，風格類似吉姆·查諾斯 (Jim Chanos)，是個著名的**空頭大師**。你專長是找出被高估、基本面有瑕疵，或技術面出現反轉訊號的公司。你會**從使用者過去的交易紀錄中學習**，以識別他們可能忽略的風險，並提供持續進化的空方策略。
            我的交易策略是短線操作，通常在週一進場，並期望在週五根據當週表現決定是否出場或續抱。請基於此**一週**的交易框架進行**放空**分析。
            你的結論必須嚴格按照指定的 JSON Schema 格式返回。

你分析的數據來自於一個整合性的後端服務，其中可能包含以下來源的資訊，請在分析時納入考量：

**台灣證券交易所 (TWSE) OpenAPI:**
${twseApiReference}

**FinMind API:**
${finmindApiReference}`;
        }
        return `你是一位頂尖的金融分析師，風格類似喬治·索羅斯，擅長結合技術分析、基本面和市場情緒。最重要的是，你會**從使用者過去的交易紀錄中學習**，以提供不斷進化且個人化的建議。
      我的交易策略是短線操作，通常在週一進場，並期望在週五根據當週表現決定是否出場或續抱。請基於此**一週**的交易框架進行分析。
      你的結論必須嚴格按照指定的 JSON Schema 格式返回。

你分析的數據來自於一個整合性的後端服務，其中可能包含以下來源的資訊，請在分析時納入考量：

**台灣證券交易所 (TWSE) OpenAPI:**
${twseApiReference}

**FinMind API:**
${finmindApiReference}`;
    };

    const getPrompt = () => {
        const basePrompt = `
          ${tradeUnitContext}

          **重要參考：我過去的交易經驗總結**
          為了讓你更了解我的風格與盲點，這裡是我最近的交易複盤摘要。請將這些歷史經驗納入考量來優化你的推薦，幫助我避免重複犯錯。
          ${historySummary || "尚無歷史交易可供參考。"}

          **目標股票資料:**
          - 名稱: ${stock.name} (${stock.ticker})
          - 當前價格: ${stock.close?.toFixed(2)}
          - 關鍵數據: 營收年增率=${stock.revenueGrowth?.toFixed(2)}%, ROE=${stock.roe?.toFixed(2)}%, EPS=${stock.eps?.toFixed(2)}, P/E=${stock.peRatio?.toFixed(2)}, P/B=${stock.pbRatio?.toFixed(2)}, 波動率=${(stock.volatility * 100).toFixed(2)}%
          - 符合的篩選條件: ${metCriteria.join('、')}
          - 最近30日K線數據 (部分): [${klineDataSummary}]`;

        if (isShortStrategy) {
            return `${basePrompt}\n\n請根據以上所有資訊，進行**空方分析**並返回你的結論。`;
        }
        return `${basePrompt}\n\n請根據以上所有資訊，進行分析並返回你的結論。`;
    };

    const getSchema = () => {
        if (isShortStrategy) {
            return {
                type: Type.OBJECT,
                properties: {
                    category: {
                        type: Type.STRING,
                        description: "基於股票的風險、反轉可能性，將其歸類為 '高風險空方', '趨勢空方', 或 '價值陷阱'。",
                        enum: ['高風險空方', '趨勢空方', '價值陷阱'],
                    },
                    reasoning: {
                        type: Type.STRING,
                        description: "簡要說明為什麼這支股票是個潛在的放空標的 (約50-70字)。",
                    },
                    entryAnalysis: {
                        type: Type.STRING,
                        description: "分析並提供一個具體的**放空**時機建議。例如：'等待股價反彈至5日線無法站上時' 或 '若明日帶量跌破今日低點' (約50-70字)。",
                    },
                    supportLevel: {
                        type: Type.NUMBER,
                        description: "根據最近的K線數據，計算並提供一個關鍵的支撐價位 (潛在的**回補停利點**)。",
                    },
                    resistanceLevel: {
                        type: Type.NUMBER,
                        description: "根據最近的K線數據，計算並提供一個關鍵的壓力價位 (潛在的**停損點**)。",
                    },
                },
                required: ["category", "reasoning", "entryAnalysis", "supportLevel", "resistanceLevel"],
            };
        }
        return {
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
    };
    
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    try {
        const response = await ai.models.generateContent({
            model,
            contents: getPrompt(),
            config: {
                systemInstruction: getSystemInstruction(),
                responseMimeType: "application/json",
                responseSchema: getSchema(),
            },
        });
        const jsonText = response.text.trim();
        const report = JSON.parse(jsonText);
        
        const validCategories: StockCategory[] = isShortStrategy
            ? ['高風險空方', '趨勢空方', '價值陷阱']
            : ['進攻型', '穩健型', '保守型'];
            
        if (!validCategories.includes(report.category)) {
            report.category = isShortStrategy ? '趨勢空方' : '穩健型'; // Fallback
        }
        return report as AIStockReport;
    } catch (error) {
        console.error("Error calling Gemini API for stock report:", error);
        throw new Error(`Gemini API 呼叫失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};


export const getPostTradeAnalysis = async (model: string, trade: TradeHistory): Promise<string> => {
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
    你是一位頂尖的投資策略教練，你的核心價值就是幫助我從每一筆歷史交易中學習，以實現策略的**永續進化**。我剛剛完成了一筆交易，請幫我進行深度複盤。我的策略是**週一進場、週五評估**的短線交易。
    
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
      model,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API for post-trade analysis:", error);
    return "AI 交易複盤分析時發生錯誤。";
  }
};

export const getSellTimingAnalysis = async (model: string, trade: TradeHistory, postSellPrices: number[]): Promise<string> => {
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
         model,
         contents: prompt,
       });
       return response.text;
     } catch (error) {
       console.error("Error calling Gemini API for sell timing analysis:", error);
       return "AI 賣出時機分析時發生錯誤。";
     }
};

export const getMarketStrategySuggestion = async (model: string, marketContext: MarketHealth): Promise<AIMarketStrategySuggestion> => {
    if (!config.geminiApiKey) {
        throw new Error("AI 分析功能無法使用，因為尚未設定 Gemini API 金鑰。");
    }
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    
    const systemInstruction = `你是一位首席市場策略師，專為短線交易者提供宏觀建議。你的策略模型會持續學習歷史數據，以判斷在類似的市場健康指標下，何種策略的歷史成功率較高。你的任務是根據市場的整體健康指標，從'進攻型'、'穩健型'、'保守型'中推薦一個最適合的策略。你的回答必須簡潔有力，並嚴格遵循指定的 JSON Schema 格式。`;

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
            model,
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

export const getStrategyAnalysis = async (model: string, settings: StrategySettings, marketContext: MarketHealth, tradeHistory: TradeHistory[]): Promise<AIStrategyAnalysis> => {
    if (!config.geminiApiKey) {
        throw new Error("AI 分析功能無法使用，因為尚未設定 Gemini API 金鑰。");
    }
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const systemInstruction = `你是一位數據驅動的投資策略顧問，你堅信**沒有完美的策略，只有不斷進化的策略**。你的任務是分析使用者提供的策略設定，結合當前市場狀況和**歷史交易績效**，找出其盲點並提供具體的優化建議，以推動策略進化。你的回覆必須嚴格遵循指定的 JSON Schema 格式。`;

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
            model,
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

export const getAIBacktestAnalysis = async (model: string, metrics: BacktestMetrics, trades: SimulatedTrade[]): Promise<AIBacktestAnalysis> => {
    if (!config.geminiApiKey) {
        throw new Error("AI 分析功能無法使用，因為尚未設定 Gemini API 金鑰。");
    }
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const systemInstruction = `你是一位頂尖的量化策略分析師，你的核心任務是**從回測數據中提煉出可促進策略進化的洞見**。你的任務是解讀一份策略回測報告，用簡潔、專業、易懂的語言，總結其表現、點出優缺點，並提供具體的優化建議。你的回覆必須嚴格遵循指定的 JSON Schema 格式。`;

    const prompt = `
      **策略回測績效報告:**
      - 總報酬率: ${metrics.totalReturn.toFixed(2)}%
      - 勝率: ${metrics.winRate.toFixed(1)}%
      - 盈虧比 (Profit Factor): ${metrics.profitFactor.toFixed(2)}
      - 最大回撤 (Max Drawdown): ${metrics.maxDrawdown.toFixed(2)}%
      - 總交易數: ${metrics.totalTrades}
      - 平均單筆交易報酬: ${metrics.avgTradeReturn.toFixed(2)}%

      **分析指令:**
      請根據以上回測數據，提供一份深度分析報告。
      1.  **performanceSummary**: (約 50-70 字) 對策略的整體表現給出一個總結性評論。指出這個策略是穩健、激進、還是有明顯缺陷。
      2.  **strengths**: (2-3 點) 根據數據，列出這個策略最主要的優點。例如：勝率高、回撤控制良好。
      3.  **weaknesses**: (2-3 點) 根據數據，列出這個策略最主要的弱點。例如：盈虧比過低、交易頻繁導致成本增加。
      4.  **optimizationSuggestions**: (2-3 點) 提出具體、可行的優化建議。例如："建議收緊停損點以改善盈虧比" 或 "可嘗試加入移動平均線作為濾網，以減少在盤整市中的無效交易"。
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            performanceSummary: { type: Type.STRING, description: "對策略整體表現的總結性評論。" },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "策略的主要優點列表。" },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "策略的主要弱點列表。" },
            optimizationSuggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "具體的優化建議列表。" }
        },
        required: ["performanceSummary", "strengths", "weaknesses", "optimizationSuggestions"]
    };

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.3,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as AIBacktestAnalysis;
    } catch (error) {
        console.error("Error calling Gemini API for backtest analysis:", error);
        throw new Error(`Gemini 回測分析失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const getAIEvolutionSuggestions = async (model: string, originalPrompt: string, result: BacktestResult): Promise<AIEvolutionAnalysis> => {
    if (!config.geminiApiKey) {
        throw new Error("AI 分析功能無法使用，因為尚未設定 Gemini API 金鑰。");
    }
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const systemInstruction = `你是一位世界級的量化策略工程師，你的存在就是為了**策略的永續進化**。你專長是分析交易策略的回測結果，並對其核心的篩選邏輯（以自然語言提示詞的形式存在）提出具體、可執行的改進方案，以解決回測中發現的弱點。你的目標是優化提示詞，以提高策略的未來表現。你的回覆必須嚴格遵循指定的 JSON Schema 格式。`;

    const prompt = `
      **原始策略提示詞:** "${originalPrompt}"

      **策略回測績效報告:**
      - 總報酬率: ${result.metrics.totalReturn.toFixed(2)}%
      - 勝率: ${result.metrics.winRate.toFixed(1)}%
      - 盈虧比: ${result.metrics.profitFactor.toFixed(2)}
      - 最大回撤: ${result.metrics.maxDrawdown.toFixed(2)}%
      
      **分析任務:**
      1.  **critique**: (約 50-70 字) 根據回測績效，對原始的策略提示詞提出簡潔的批判性分析。指出其最可能的問題點。例如："此策略在熊市中回撤過大，顯示其缺乏有效的風險過濾機制。"
      2.  **evolvedPrompts**: 提出 1 到 3 個**新的、經過優化的策略提示詞**。這些新提示詞應該在原始策略的基礎上，透過增加、修改或組合條件來解決回測中發現的弱點。
          - **prompt**: 新的、完整的策略提示詞 (字串)。
          - **reasoning**: 簡要解釋這個修改背後的邏輯，以及預期它能改善哪個績效指標。

      **範例 (如果原始策略是 "尋找帶量突破的股票"):**
      - **新提示詞**: "尋找帶量突破盤整區，且股價站上月線(MA20)的股票"
      - **理由**: "加入月線作為多頭濾網，旨在過濾掉假突破，提高勝率。"
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            critique: { type: Type.STRING, description: "對原始策略的批判性分析。" },
            evolvedPrompts: {
                type: Type.ARRAY,
                description: "優化後的新策略提示詞列表。",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        prompt: { type: Type.STRING, description: "新的、完整的策略提示詞。" },
                        reasoning: { type: Type.STRING, description: "修改此提示詞的理由和預期效果。" }
                    },
                    required: ["prompt", "reasoning"]
                }
            }
        },
        required: ["critique", "evolvedPrompts"]
    };

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.5,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as AIEvolutionAnalysis;
    } catch (error) {
        console.error("Error calling Gemini API for evolution suggestions:", error);
        throw new Error(`Gemini 策略進化建議失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
};