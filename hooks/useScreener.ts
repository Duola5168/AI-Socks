import { useState, useCallback, useRef, useEffect } from 'react';
import { ScoredStock, StockData, TradeHistory, ScreenerStrategy, StrategySettings, PartialStockData, LayerScores, AIStockReport } from '../types';
import { getAIStockReport, getAITopStocks } from '../services/geminiService';
import { fetchHistoricalDataForTopStocks } from '../services/stockService';
import { performMultiStageAnalysis, AnalystId } from '../services/collaborativeAnalysisService';
import { config, IS_GEMINI_CONFIGURED } from '../services/config';

const SHORT_STRATEGIES: ScreenerStrategy[] = ['M_TOP_REVERSAL', 'SUPPORT_BREAKDOWN', 'WEAK_MOMENTUM'];

const calculateMA = (kline: {close: number}[], period: number): number => {
    if (kline.length < period) return 0;
    const relevantData = kline.slice(kline.length - period);
    return relevantData.reduce((sum, data) => sum + data.close, 0) / period;
};


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

    const screenedStocksRef = useRef(screenedStocks);
    useEffect(() => {
        screenedStocksRef.current = screenedStocks;
    }, [screenedStocks]);

    const addLog = useCallback((message: string) => {
        const timestamp = `[${new Date().toLocaleTimeString()}]`;
        setStatusLog(prev => [...prev, `${timestamp} ${message}`]);
    }, []);

    const runScreener = useCallback(async (
        allStaticStockData: PartialStockData[],
        strategy: ScreenerStrategy,
        prompt: string,
    ) => {
        if (allStaticStockData.length === 0) {
            setScreenerError("沒有可供篩選的股票數據。請先更新資料庫。");
            return;
        }

        setIsScreening(true);
        setScreenerError(null);
        setScreenedStocks([]);
        setStatusLog([]); // Clear log for new run
        
        try {
            // Pre-filter for efficiency before hitting the AI
            const preFilteredData = allStaticStockData
                .filter(s => s.tradeValue && s.tradeValue > 10_000_000)
                .sort((a, b) => (b.tradeValue ?? 0) - (a.tradeValue ?? 0))
                .slice(0, 300);

            // Stage 1: AI Screens Static Data for Top 20 Candidates
            addLog(`階段 1: 從 ${allStaticStockData.length} 支股票中，預篩選成交最熱絡的 ${preFilteredData.length} 支股票...`);
            addLog(`選股提示詞: "${prompt}"`);
            if (!IS_GEMINI_CONFIGURED) throw new Error("Gemini API Key 未設定，無法執行 AI 初步篩選。");
            
            const top20StockIds = await getAITopStocks(settings.analystPanel.geminiModel, preFilteredData, prompt);
            addLog(`AI 初篩完成，找到 ${top20StockIds.length} 名候選者。`);

            if (top20StockIds.length === 0) {
                throw new Error("AI 未能根據此策略篩選出任何股票。");
            }

            const topStocksFromStaticData = allStaticStockData.filter(s => top20StockIds.includes(s.id!));

            // Stage 2: Fetch Historical Data for Top 20
            const top20WithHistoricalData = await fetchHistoricalDataForTopStocks(topStocksFromStaticData, addLog);
            if (top20WithHistoricalData.length === 0) {
                 throw new Error("無法為候選股票獲取歷史數據。");
            }
            
            addLog(`階段 2: 根據歷史動能指標進行最終排序...`);
            
            const isShortStrategy = SHORT_STRATEGIES.includes(strategy);

            // Stage 3: Final Momentum Ranking
            const rankedStocks = top20WithHistoricalData.map(stock => {
                const avgVolume5 = stock.volumeHistory.slice(-6, -1).reduce((sum, vol) => sum + vol, 0) / 5;
                const latestVolume = stock.volumeHistory[stock.volumeHistory.length - 1];
                const volumeMomentum = avgVolume5 > 0 ? latestVolume / avgVolume5 : 0;
                
                const priceMomentum = stock.kline.length > 5 && stock.kline[stock.kline.length - 6].close > 0
                    ? (stock.close! - stock.kline[stock.kline.length - 6].close) / stock.kline[stock.kline.length - 6].close
                    : 0;
                
                const adjustedPriceMomentum = isShortStrategy ? -priceMomentum : priceMomentum;

                const momentumScore = (volumeMomentum * 0.5 + adjustedPriceMomentum * 2) * 100;
                const aiRankScore = (top20StockIds.length - top20StockIds.indexOf(stock.id)) / top20StockIds.length * 100;
                const finalScore = Math.round(momentumScore * 0.6 + aiRankScore * 0.4);

                const layerScores: LayerScores = {
                    fundamentals: aiRankScore, 
                    technicals: 0, 
                    momentum: Math.min(100, momentumScore),
                    risk: 0, 
                };
                
                const breakdown = {
                    priceBreakout: stock.close && stock.kline.length > 5 ? stock.close > calculateMA(stock.kline, 5) : false,
                    volumeSpike: latestVolume > avgVolume5 * 1.5,
                    highROE: (stock.roe ?? 0) > 15,
                    highYoYGrowth: (stock.revenueGrowth ?? 0) > 10,
                    lowPE: (stock.peRatio ?? 999) < 20 && (stock.peRatio ?? 999) > 0,
                };


                return { stock, score: finalScore, layerScores, breakdown };
            }).sort((a, b) => b.score - a.score);

            const finalTop10 = rankedStocks.slice(0, 10);
            const initialScoredStocks: ScoredStock[] = finalTop10.map(s => ({
                ...s,
                isCollaborating: false,
                analysisError: null,
            }));

            setScreenedStocks(initialScoredStocks);
            addLog(`篩選完成，呈現前 ${finalTop10.length} 名。請點擊個股以查看詳細資料並啟動 AI 分析。`);

        } catch (e: any) {
            addLog(`篩選失敗: ${e.message}`);
            setScreenerError(e.message);
        } finally {
            setIsScreening(false);
        }
    }, [addLog, settings.analystPanel.geminiModel]);

    const runDirectAnalysis = useCallback(async (
        tickerInput: string,
        allStaticStockData: PartialStockData[],
    ): Promise<ScoredStock | null> => {
        if (allStaticStockData.length === 0) {
            setScreenerError("沒有可供分析的股票數據。請先更新資料庫。");
            return null;
        }
    
        setIsScreening(true);
        setScreenerError(null);
        setScreenedStocks([]);
        setStatusLog([]);
        
        try {
            addLog(`分析模式: 單一個股深度分析 (輸入: "${tickerInput}")`);
            
            const cleanedInput = tickerInput.trim().toUpperCase();
            const searchTicker = cleanedInput.replace(/\.TW$|\.TWO$/i, '');

            const stockInfo = allStaticStockData.find(s => s.ticker.toUpperCase() === searchTicker || s.id.toUpperCase() === searchTicker);
            
            if (!stockInfo) {
                throw new Error(`在資料庫中找不到股票代碼 ${searchTicker}。請確認代碼是否正確。`);
            }
            addLog(`找到股票: ${stockInfo.name} (${stockInfo.ticker})`);
    
            const stockWithHistoricalDataArr = await fetchHistoricalDataForTopStocks([stockInfo], addLog);
            if (stockWithHistoricalDataArr.length === 0) {
                throw new Error(`無法為 ${stockInfo.name} 獲取歷史數據。`);
            }
            const stockWithHistoricalData = stockWithHistoricalDataArr[0];
            
            const dummyScoredStock: Omit<ScoredStock, 'aiReport' | 'collaborativeReport'> = {
                stock: stockWithHistoricalData,
                score: 100, // Score is irrelevant for direct analysis view
                breakdown: {}, // No breakdown for direct analysis
                layerScores: { fundamentals: 100, technicals: 100, momentum: 100, risk: 100 },
            };
    
            const finalStock: ScoredStock = { 
                ...dummyScoredStock, 
                isCollaborating: false,
                analysisError: null,
            };
    
            addLog("個股資料載入完成，請啟動 AI 專家小組評比以獲得深度分析。");
            return finalStock;
            
        } catch (e: any) {
            addLog(`分析失敗: ${e.message}`);
            setScreenerError(e.message);
            return null;
        } finally {
            setIsScreening(false);
        }
    }, [addLog]);
    
    const handleCollaborativeAnalysis = useCallback(async (stockId: string, userId?: string) => {
        if (!IS_GEMINI_CONFIGURED) {
             setScreenerError("必須設定 Gemini API Key 才能執行協同分析。");
             return;
        }
        setScreenerError(null);

        const onProgress = (progressMessage: string) => {
            // Update both the main list and the single view if active
            setScreenedStocks(prev => prev.map(s =>
                s.stock.id === stockId ? { ...s, collaborationProgress: progressMessage } : s
            ));
        };

        const handleAnalystDisable = (analystId: AnalystId) => {
            setSettings(prev => {
                const newAnalystPanel = { ...prev.analystPanel, [analystId]: false };
                return { ...prev, analystPanel: newAnalystPanel };
            });
        };

        const updateStockState = (updates: Partial<ScoredStock>) => {
             setScreenedStocks(prev => prev.map(s => s.stock.id === stockId ? { ...s, ...updates } : s));
        };

        updateStockState({ isCollaborating: true, analysisError: null, collaborativeReport: undefined, collaborationProgress: '正在初始化...' });

        const targetStock = screenedStocksRef.current.find(s => s.stock.id === stockId);

        if (!targetStock) {
            const errorMsg = "無法執行協同分析，找不到目標股票。";
            setScreenerError(errorMsg);
            updateStockState({ isCollaborating: false, analysisError: errorMsg });
            return;
        }

        try {
            const finalReport = await performMultiStageAnalysis(targetStock, settings, onProgress, handleAnalystDisable, userId);
            updateStockState({ collaborativeReport: finalReport, isCollaborating: false });
        } catch (e: any) {
            console.error(e);
            const errorMsg = `協同分析失敗: ${e.message}`;
            setScreenerError(errorMsg);
            updateStockState({ isCollaborating: false, analysisError: errorMsg });
        }
    }, [settings, setSettings]);

    return {
        screenedStocks,
        isScreening,
        screenerError,
        setScreenerError,
        statusLog,
        runScreener,
        runDirectAnalysis,
        handleCollaborativeAnalysis,
    };
};
