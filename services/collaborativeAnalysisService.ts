import { ScoredStock, CollaborativeAIReport, FinalDecision, DebateReport, NewsSentimentReport, AnalysisPanel, StrategySettings } from '../types';
import { getGeminiProAnalysis, getGeminiFinalDecision, getNewsSentimentSummary } from './geminiService';
import { getGroqConAnalysis } from './groqService';
import { getGitHubCopilotAnalysis, getGitHubOpenAIAnalysis, getGitHubDeepSeekAnalysis, getGitHubXAIAnalysis } from './githubService';
import * as newsService from './newsService';
import { config, IS_GITHUB_CONFIGURED } from './config';
import * as rateLimitService from './rateLimitService';

export type AnalystId = 'gemini' | 'groq' | 'github_copilot' | 'github_openai' | 'github_deepseek' | 'github_xai';

interface Analyst {
    id: AnalystId;
    name: string;
    icon: 'gemini' | 'groq' | 'github' | 'xai';
    analyze: (stock: ScoredStock, newsReport?: NewsSentimentReport) => Promise<DebateReport>;
    isConfigured: boolean;
}

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

    const allAnalysts: Analyst[] = [
        { id: 'gemini', name: 'Gemini', icon: 'gemini', analyze: getGeminiProAnalysis, isConfigured: !!config.geminiApiKey },
        { id: 'groq', name: 'Groq', icon: 'groq', analyze: getGroqConAnalysis.bind(null, config.groqApiKey), isConfigured: !!config.groqApiKey },
        { id: 'github_copilot', name: 'GitHub (Copilot)', icon: 'github', analyze: getGitHubCopilotAnalysis, isConfigured: IS_GITHUB_CONFIGURED },
        { id: 'github_openai', name: 'GitHub (OpenAI)', icon: 'github', analyze: getGitHubOpenAIAnalysis, isConfigured: IS_GITHUB_CONFIGURED },
        { id: 'github_deepseek', name: 'GitHub (DeepSeek)', icon: 'github', analyze: getGitHubDeepSeekAnalysis, isConfigured: IS_GITHUB_CONFIGURED },
        { id: 'github_xai', name: 'xAI (Grok)', icon: 'xai', analyze: getGitHubXAIAnalysis, isConfigured: IS_GITHUB_CONFIGURED },
    ];

    const activeAnalysts = allAnalysts.filter(a => a.isConfigured && settings.analystPanel[a.id]);


    if (activeAnalysts.length === 0) {
        throw new Error("沒有設定或啟用任何 AI 分析師。請檢查 API 金鑰與策略設定。");
    }

    // --- Stage 1: News Analysis ---
    let newsReport: NewsSentimentReport | undefined;
    if (config.newsApiKey) {
        try {
            onProgress("階段 1: 正在獲取與分析市場新聞...");
            const articles = await newsService.fetchNewsForStock(scoredStock.stock.name, scoredStock.stock.ticker, userId);

            if (articles.length > 0) {
                newsReport = await getNewsSentimentSummary(articles);
                onProgress("新聞輿情分析完成。");
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
    
    const analysisPromises = activeAnalysts.map(analyst => {
        // Rate limit check for non-Gemini/Groq models
        if (analyst.id.startsWith('github')) {
            const limitCheck = rateLimitService.checkRateLimit(analyst.id);
            if (limitCheck.isLimited) {
                const message = `分析師 '${analyst.name}' 因達到請求上限而被跳過: ${limitCheck.reason}`;
                onProgress(message);
                onAnalystDisable(analyst.id);
                return Promise.reject(new Error(message)); // Reject to be caught by allSettled
            }
        }

        onProgress(`分析師 '${analyst.name}' 正在準備報告...`);
        // Record the request for relevant analysts
        if (analyst.id.startsWith('github')) {
            rateLimitService.recordRequest(analyst.id);
        }
        return analyst.analyze(scoredStock, newsReport);
    });

    const results = await Promise.allSettled(analysisPromises);
    
    const successfulAnalyses: AnalysisPanel[] = [];
    results.forEach((result, index) => {
        const analyst = activeAnalysts[index];
        if (result.status === 'fulfilled') {
            successfulAnalyses.push({
                analystName: analyst.name,
                icon: analyst.icon,
                report: result.value
            });
            onProgress(`分析師 '${analyst.name}' 的報告已提交。`);
        } else {
            // Don't show rate limit errors twice.
            if (!result.reason.message.includes('Rate limited')) {
                 console.error(`Analyst ${analyst.name} failed:`, result.reason);
                 onProgress(`警告: 分析師 '${analyst.name}' 分析失敗 - ${result.reason.message}`);
            }
        }
    });

    if (successfulAnalyses.length === 0) {
        throw new Error("所有 AI 分析師均未能完成分析或已達用量上限。");
    }

    // --- Stage 3: CIO Synthesizes Reports for a Final Decision ---
    onProgress("決策階段：AI 投資總監正在整合所有報告...");
    const finalDecision: FinalDecision = await getGeminiFinalDecision(successfulAnalyses, scoredStock.stock, newsReport);
    
    onProgress("協同分析完成。");
    
    return {
        finalDecision,
        analysisPanels: successfulAnalyses,
        newsReport
    };
};