import { ScoredStock, CollaborativeAIReport, FinalDecision, DebateReport, NewsSentimentReport } from '../types';
import { getGeminiProAnalysis, getGeminiFinalDecision, getNewsSentimentSummary } from './geminiService';
import { getGroqConAnalysis } from './groqService';
import * as newsService from './newsService';
import { config } from './config';

/**
 * Orchestrates a four-stage collaborative analysis.
 * 0. Fetches and analyzes news sentiment.
 * 1. Gemini (Pro) analyzes the upsides.
 * 2. Groq (Con) analyzes the downsides.
 * 3. Gemini (CIO) makes a final, synthesized decision based on the debate and news.
 */
export const performThreeStageAnalysis = async (
    scoredStock: ScoredStock,
    onProgress: (message: string) => void,
    userId?: string,
): Promise<CollaborativeAIReport> => {

    let newsReport: NewsSentimentReport | undefined;
    if (config.newsApiKey) {
        try {
            onProgress("正在獲取與分析市場新聞...");
            const articles = await newsService.fetchNewsForStock(scoredStock.stock.name, scoredStock.stock.ticker, userId);

            if (articles.length > 0) {
                newsReport = await getNewsSentimentSummary(articles);
                 onProgress("新聞輿情分析完成...");
            } else {
                 onProgress("未找到相關市場新聞...");
            }
        } catch (e: any) {
            console.warn(`News analysis failed: ${e.message}`);
            onProgress(`新聞分析失敗: ${e.message}`); // Inform the user but continue.
        }
    }

    // --- Stage 1: Gemini as the "Pro" Analyst ---
    onProgress("辯論階段：Gemini (正方) 正在分析優勢...");
    const proAnalysis: DebateReport = await getGeminiProAnalysis(scoredStock, newsReport);

    // --- Stage 2: Groq as the "Con" Analyst ---
    onProgress("辯論階段：Groq (反方) 正在剖析風險...");
    const conAnalysis: DebateReport = await getGroqConAnalysis(config.groqApiKey, scoredStock, newsReport);

    // --- Stage 3: Gemini as the "CIO" for the final decision ---
    onProgress("決策階段：AI 投資總監正在整合報告...");
    const finalDecision: FinalDecision = await getGeminiFinalDecision(proAnalysis, conAnalysis, scoredStock.stock, newsReport);
    
    onProgress("協同分析完成。");
    
    return {
        finalDecision,
        proAnalysis,
        conAnalysis,
        newsReport
    };
};