import { useState, useCallback } from 'react';
import { ScoredStock, StockData, TradeHistory, ScreenerStrategy, StrategySettings, PartialStockData, LayerScores } from '../types';
import { getAIStockReport, getAITopStocks } from '../services/geminiService';
import { fetchRealtimeDataForTopStocks } from '../services/stockService';
import { performMultiStageAnalysis, AnalystId } from '../services/collaborativeAnalysisService';
import { config, IS_GEMINI_CONFIGURED, IS_GROQ_CONFIGURED } from '../services/config';

export const useScreener = (
    tradeHistory: TradeHistory[],
    tradeUnitMode: 'fractional' | 'whole',
    settings: StrategySettings,
    setSettings: React.Dispatch<React.SetStateAction<StrategySettings>>
) => {
    const [screenedStocks, setScreenedStocks] = useState<ScoredStock[]>([]);
    const [isScreening, setIsScreening] = useState(false);
    const [screenerError, setScreenerError] = useState<string | null>(null);
    const [statusLog, setStatusLog] = useState<string[]>([]);

    const runScreener = useCallback(async (
        allStaticStockData: PartialStockData[],
        strategy: ScreenerStrategy
    ) => {
        if (allStaticStockData.length === 0) {
            setScreenerError("沒有可供篩選的股票數據。請先更新資料庫。");
            return;
        }

        setIsScreening(true);
        setScreenerError(null);
        setScreenedStocks([]);
        const newLog: string[] = [];
        const addLog = (message: string) => {
            newLog.push(`[${new Date().toLocaleTimeString()}] ${message}`);
            setStatusLog([...newLog]);
        };

        try {
            // Stage 1: AI Screens Static Data for Top 20 Candidates
            addLog(`階段 1: AI 正在從 ${allStaticStockData.length} 支股票中，根據「${strategy}」策略篩選前 20 名...`);
            if (!IS_GEMINI_CONFIGURED) throw new Error("Gemini API Key 未設定，無法執行 AI 初步篩選。");
            
            const top20StockIds = await getAITopStocks(allStaticStockData, strategy);
            addLog(`AI 初篩完成，找到 ${top20StockIds.length} 名候選者。`);

            if (top20StockIds.length === 0) {
                throw new Error("AI 未能根據此策略篩選出任何股票。");
            }

            const topStocksFromStaticData = allStaticStockData.filter(s => top20StockIds.includes(s.id!));

            // Stage 2: Fetch Real-time Data for Top 20
            const top20WithRealtimeData = await fetchRealtimeDataForTopStocks(topStocksFromStaticData, addLog);
            if (top20WithRealtimeData.length === 0) {
                 throw new Error("無法為候選股票獲取即時數據。");
            }
            
            addLog(`階段 2: 根據即時動能指標進行最終排序...`);
            
            // Stage 3: Final Momentum Ranking
            const rankedStocks = top20WithRealtimeData.map(stock => {
                const avgVolume5 = stock.volumeHistory.slice(-6, -1).reduce((sum, vol) => sum + vol, 0) / 5;
                const latestVolume = stock.volumeHistory[stock.volumeHistory.length - 1];
                const volumeMomentum = avgVolume5 > 0 ? latestVolume / avgVolume5 : 0;
                const priceMomentum = stock.kline.length > 5 && stock.kline[stock.kline.length - 6].close > 0
                    ? (stock.close! - stock.kline[stock.kline.length - 6].close) / stock.kline[stock.kline.length - 6].close
                    : 0;
                
                const momentumScore = (volumeMomentum * 0.5 + priceMomentum * 2) * 100;
                const aiRankScore = (top20StockIds.length - top20StockIds.indexOf(stock.id)) / top20StockIds.length * 100;
                const finalScore = Math.round(momentumScore * 0.6 + aiRankScore * 0.4);

                const layerScores: LayerScores = {
                    fundamentals: aiRankScore, // Use AI's initial rank as fundamentals score
                    technicals: 0, // Placeholder
                    momentum: Math.min(100, momentumScore), // Cap at 100
                    risk: 0, // Placeholder
                };

                return { stock, score: finalScore, layerScores };
            }).sort((a, b) => b.score - a.score);

            const finalTop10 = rankedStocks.slice(0, 10);
            const initialScoredStocks: ScoredStock[] = finalTop10.map(s => ({
                ...s,
                breakdown: {}, // breakdown is not heavily used in this new flow
                isCollaborating: false,
                analysisError: null,
            }));

            setScreenedStocks(initialScoredStocks);
            addLog(`最終排序完成，呈現前 ${finalTop10.length} 名。`);

            // Stage 4: AI In-depth Analysis for Top 10
            addLog("階段 3: 為最佳結果執行 AI 深度分析...");
            const analysisPromises = initialScoredStocks.map(s => getAIStockReport(s, tradeHistory, tradeUnitMode));
            const aiReports = await Promise.all(analysisPromises);

            const stocksWithAI = initialScoredStocks.map((stock, index) => ({ ...stock, aiReport: aiReports[index] }));
            setScreenedStocks(stocksWithAI);
            addLog("所有分析完成。");

        } catch (e: any) {
            addLog(`篩選失敗: ${e.message}`);
            setScreenerError(e.message);
        } finally {
            setIsScreening(false);
        }
    }, [tradeHistory, tradeUnitMode, settings]);
    
    const handleCollaborativeAnalysis = useCallback(async (stockId: string, userId?: string) => {
        if (!IS_GEMINI_CONFIGURED) { // Groq is optional, but Gemini is needed for CIO role
             setScreenerError("必須設定 Gemini API Key 才能執行協同分析。");
             return;
        }
        setScreenerError(null);

        const onProgress = (progressMessage: string) => {
            setScreenedStocks(prev => prev.map(s =>
                s.stock.id === stockId ? { ...s, collaborationProgress: progressMessage } : s
            ));
        };

        const handleAnalystDisable = (analystId: AnalystId) => {
            setSettings(prev => {
                // Do not modify previous state directly
                const newAnalystPanel = { ...prev.analystPanel, [analystId]: false };
                return { ...prev, analystPanel: newAnalystPanel };
            });
        };

        setScreenedStocks(prev => prev.map(s =>
            s.stock.id === stockId ? { ...s, isCollaborating: true, analysisError: null, collaborativeReport: undefined, collaborationProgress: '正在初始化...' } : s
        ));

        const targetStock = screenedStocks.find(s => s.stock.id === stockId) 
            // Use a fresh reference from state if available
            ?? (await new Promise<ScoredStock | undefined>(resolve => 
                setScreenedStocks(current => {
                    resolve(current.find(s => s.stock.id === stockId));
                    return current;
                })
            ));


        if (!targetStock || !targetStock.aiReport) {
            const errorMsg = "無法執行協同分析，缺少主要的 Gemini 分析報告。";
            setScreenerError(errorMsg);
            setScreenedStocks(prev => prev.map(s =>
                s.stock.id === stockId ? { ...s, isCollaborating: false, analysisError: errorMsg } : s
            ));
            return;
        }

        try {
            const finalReport = await performMultiStageAnalysis(targetStock, settings, onProgress, handleAnalystDisable, userId);

            setScreenedStocks(prev => prev.map(s =>
                s.stock.id === stockId ? { ...s, collaborativeReport: finalReport, isCollaborating: false } : s
            ));
        } catch (e: any) {
            console.error(e);
            const errorMsg = `協同分析失敗: ${e.message}`;
            setScreenerError(errorMsg);
            setScreenedStocks(prev => prev.map(s =>
                s.stock.id === stockId ? { ...s, isCollaborating: false, analysisError: errorMsg } : s
            ));
        }
    }, [screenedStocks, settings, setSettings]);


    return {
        screenedStocks,
        isScreening,
        screenerError,
        setScreenerError,
        statusLog,
        runScreener,
        handleCollaborativeAnalysis,
    };
};