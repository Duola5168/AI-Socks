import { ScoredStock, CollaborativeAIReport, FinalDecision, AnalystReport, NewsSentimentReport, AnalysisPanel, StrategySettings, NewsArticle } from '../types';
import { getGeminiProAnalysis, getGeminiFinalDecision, getNewsSentimentSummary } from './geminiService';
import { getGroqConAnalysis } from './groqService';
import { getGitHubModelAnalysis } from './githubService';
import * as newsService from './newsService';
import { config } from './config';
import * as rateLimitService from './rateLimitService';

export type AnalystId = string;

interface Analyst {
    id: AnalystId;
    name: string;
    icon: AnalysisPanel['icon'];
    analyze: (stock: ScoredStock, newsReport?: NewsSentimentReport) => Promise<AnalystReport>;
    isConfigured: boolean;
}

const getIconForModel = (modelId: string): AnalysisPanel['icon'] => {
    const lowerId = modelId.toLowerCase();
    if (lowerId.includes('openai')) return 'openai';
    if (lowerId.includes('microsoft')) return 'microsoft';
    if (lowerId.includes('meta') || lowerId.includes('llama')) return 'meta';
    if (lowerId.includes('cohere')) return 'cohere';
    if (lowerId.includes('xai') || lowerId.includes('grok')) return 'xai';
    if (lowerId.includes('ai21')) return 'ai21';
    if (lowerId.includes('deepseek')) return 'deepseek';
    return 'github'; // default
};

/**
 * Generates a NewsSentimentReport from articles that already have sentiment data.
 * This avoids an extra LLM call if the news source provides sentiment analysis.
 * @param articles - An array of NewsArticle objects, potentially with sentiment.
 * @returns A NewsSentimentReport object, or null if articles lack sentiment.
 */
const generateSentimentReportFromArticles = (articles: NewsArticle[]): NewsSentimentReport | null => {
    if (!articles.length || !articles[0].sentiment) return null;

    const sentiments = articles.map(a => a.sentiment).filter((s): s is 'positive' | 'negative' | 'neutral' => !!s);
    if (sentiments.length === 0) return null;

    const counts = { positive: 0, negative: 0, neutral: 0 };
    sentiments.forEach(s => {
        counts[s]++;
    });

    let overallSentiment: '正面' | '負面' | '中性' = '中性';
    if (counts.positive > counts.negative && counts.positive > counts.neutral) {
        overallSentiment = '正面';
    } else if (counts.negative > counts.positive && counts.negative > counts.neutral) {
        overallSentiment = '負面';
    }

    const summary = `根據 ${articles.length} 篇相關文章，市場情緒偏向 ${overallSentiment}。`;
    const keyPoints = articles.slice(0, 3).map(a => a.title);

    return {
        sentiment: overallSentiment,
        summary,
        keyPoints,
        articleCount: articles.length
    };
};


/**
 * Orchestrates a multi-stage collaborative analysis by a panel of AI analysts.
 * 1. Fetches and analyzes news sentiment.
 * 2. All configured and user-enabled analysts perform their analysis in parallel, respecting rate limits.
 * 3. A final "CIO" model (Gemini) synthesizes all reports to make a final decision.
 */
export const performMultiStageAnalysis = async (
    scoredStock: ScoredStock,
    settings: StrategySettings,
    onProgress: (message: string) => void,
    onAnalystDisable: (analystId: AnalystId) => void,
    userId?: string,
): Promise<CollaborativeAIReport> => {
    const { analystPanel } = settings;

    const geminiAnalyst: Analyst = { 
        id: 'gemini', 
        name: 'Gemini (正方)', 
        icon: 'gemini', 
        analyze: (stock, news) => getGeminiProAnalysis(analystPanel.geminiModel, stock, news), 
        isConfigured: !!config.geminiApiKey 
    };
    
    const groqAnalyst: Analyst = { 
        id: 'groq', 
        name: 'Groq (反方)', 
        icon: 'groq', 
        analyze: (stock, news) => getGroqConAnalysis(config.groqApiKey, analystPanel.groqPrimaryModel as string, stock, news), 
        isConfigured: !!config.groqApiKey 
    };
    
    // Build the list of active GitHub analysts dynamically from the new settings structure
    const { githubModels = {} } = analystPanel;
    const activeGitHubAnalysts: Analyst[] = Object.entries(githubModels)
      .filter(([provider, modelSettings]) => modelSettings.enabled && modelSettings.selectedModel)
      .map(([provider, modelSettings]) => {
        const modelId = modelSettings.selectedModel;
        const name = modelId.split('/')[1] || modelId;
        return {
          id: modelId,
          name: `${name} (中立)`,
          icon: getIconForModel(modelId),
          analyze: (stock, news) => getGitHubModelAnalysis(modelId, 'Neutral', stock, news),
          isConfigured: true,
        };
      });

    const activeAnalysts: Analyst[] = [];
    if (geminiAnalyst.isConfigured && analystPanel.gemini) activeAnalysts.push(geminiAnalyst);
    if (groqAnalyst.isConfigured && analystPanel.groq) activeAnalysts.push(groqAnalyst);
    activeAnalysts.push(...activeGitHubAnalysts);

    if (activeAnalysts.length < 2) { // Need at least Gemini CIO and one other analyst
        throw new Error("至少需要啟用一位“正方”分析師 (Gemini) 和另一位任意分析師才能進行專家小組評比。");
    }

    // --- Stage 1: News Analysis ---
    let newsReport: NewsSentimentReport | undefined;
    if (config.newsApiKey || config.news2ApiKey) {
        try {
            onProgress("階段 1: 正在獲取與分析市場新聞...");
            const articles = await newsService.fetchNewsForStock(scoredStock.stock.name, scoredStock.stock.ticker, userId);

            if (articles.length > 0) {
                 const reportFromArticles = generateSentimentReportFromArticles(articles);
                 if (reportFromArticles) {
                    newsReport = reportFromArticles;
                    onProgress("新聞輿情分析完成 (來源: News API 2)。");
                 } else if (config.geminiApiKey) {
                    newsReport = await getNewsSentimentSummary(analystPanel.geminiModel, articles);
                    onProgress("新聞輿情分析完成 (來源: Gemini AI)。");
                 } else {
                    onProgress("新聞獲取完成，但無法進行情緒分析 (Gemini 未設定)。");
                 }
            } else {
                onProgress("未找到相關市場新聞。");
            }
        } catch (e: any) {
            console.warn(`News analysis failed: ${e.message}`);
            onProgress(`新聞分析失敗 (已略過): ${e.message}`); // Inform user, but continue.
        }
    }

    // --- Stage 2: Parallel Analysis by the Panel ---
    onProgress(`階段 2: AI 專家小組 (${activeAnalysts.map(a => a.name).join(', ')}) 正在進行平行分析...`);
    
    // Gemini's proponent analysis is a prerequisite and can run first.
    const geminiProponentPromise = geminiAnalyst.analyze(scoredStock, newsReport);

    const otherAnalysisPromises = activeAnalysts
        .filter(a => a.id !== 'gemini')
        .map(analyst => {
            if (analyst.id.includes('/')) {
                const limitCheck = rateLimitService.checkRateLimit(analyst.id);
                if (limitCheck.isLimited) {
                    const message = `分析師 '${analyst.name}' 因達到請求上限而被跳過: ${limitCheck.reason}`;
                    onProgress(message);
                    onAnalystDisable(analyst.id);
                    return Promise.reject(new Error(message));
                }
                 rateLimitService.recordRequest(analyst.id);
            }
            onProgress(`分析師 '${analyst.name}' 正在準備報告...`);
            return analyst.analyze(scoredStock, newsReport);
        });

    const [geminiResult, ...otherResults] = await Promise.allSettled([geminiProponentPromise, ...otherAnalysisPromises]);
    
    const successfulAnalyses: AnalysisPanel[] = [];
     if (geminiResult.status === 'fulfilled') {
        successfulAnalyses.push({
            analystName: geminiAnalyst.name,
            icon: geminiAnalyst.icon,
            report: geminiResult.value
        });
    } else {
        console.error(`Critical analyst ${geminiAnalyst.name} failed:`, geminiResult.reason);
        throw new Error(`關鍵分析師 '${geminiAnalyst.name}' 分析失敗: ${geminiResult.reason.message}`);
    }
    
    const otherAnalysts = activeAnalysts.filter(a => a.id !== 'gemini');
    otherResults.forEach((result, index) => {
        const analyst = otherAnalysts[index];
        if (result.status === 'fulfilled') {
            successfulAnalyses.push({
                analystName: analyst.name,
                icon: analyst.icon,
                report: result.value
            });
            onProgress(`分析師 '${analyst.name}' 的報告已提交。`);
        } else {
            if (!result.reason.message.includes('請求上限')) {
                 console.error(`Analyst ${analyst.name} failed:`, result.reason);
                 onProgress(`警告: 分析師 '${analyst.name}' 分析失敗 - ${result.reason.message}`);
            }
        }
    });

    if (successfulAnalyses.length < 2) {
        throw new Error("AI 分析師均未能完成分析或已達用量上限，無法產出最終報告。");
    }

    // --- Stage 3: CIO Synthesizes Reports for a Final Decision ---
    onProgress("決策階段：AI 投資總監正在整合所有報告...");
    const finalDecision: FinalDecision = await getGeminiFinalDecision(analystPanel.geminiModel, successfulAnalyses, scoredStock.stock, newsReport);
    
    onProgress("協同分析完成。");
    
    return {
        finalDecision,
        analysisPanels: successfulAnalyses,
        newsReport
    };
};