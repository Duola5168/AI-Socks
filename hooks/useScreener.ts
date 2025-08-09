import { useState, useCallback } from 'react';
import { ScoredStock, StockData, TradeHistory, AIStockReport, ScreenerStrategy, CollaborativeAIReport, StrategySettings } from '../types';
import { runStrategyScreening } from '../services/stockScreener';
import { getAIStockReport } from '../services/geminiService';
import { performThreeStageAnalysis } from '../services/collaborativeAnalysisService';
import { config, IS_GEMINI_CONFIGURED, IS_GROQ_CONFIGURED } from '../services/config';

export const useScreener = (
    tradeHistory: TradeHistory[],
    tradeUnitMode: 'fractional' | 'whole',
    settings: StrategySettings
) => {
    const [screenedStocks, setScreenedStocks] = useState<ScoredStock[]>([]);
    const [isScreening, setIsScreening] = useState(false);
    const [screenerError, setScreenerError] = useState<string | null>(null);
    const [statusLog, setStatusLog] = useState<string[]>([]);

    const runScreener = useCallback(async (
        allStockData: StockData[],
        strategy: ScreenerStrategy
    ) => {
        if (allStockData.length === 0) {
            setScreenerError("沒有可供篩選的股票數據。");
            return;
        }

        setIsScreening(true);
        setScreenerError(null);
        setScreenedStocks([]);
        
        const newLog: string[] = [];
        const addLog = (message: string) => {
            newLog.push(message);
            setStatusLog([...newLog]); // Update log in real-time
        };

        addLog(`符合預篩條件股票總數: ${allStockData.length} (資料於 ${new Date().toLocaleTimeString('zh-TW')} 檢查)`);

        const results = await runStrategyScreening(allStockData, strategy, settings, addLog);
        
        addLog(`策略篩選後，找到 ${results.length} 支潛力股。`);
        
        if (results.length === 0) {
             addLog("所有策略篩選皆無結果，請調整條件或等待資料更新。");
             setScreenerError("此策略篩選無結果。請嘗試其他策略或等待市場狀況改變。");
             setIsScreening(false);
             return;
        }
        
        const finalResults = results.sort((a, b) => b.score - a.score).slice(0, 10);
        setScreenedStocks(finalResults.map(s => ({...s, analysisError: null, isCollaborating: false})));
        
        if (!IS_GEMINI_CONFIGURED) {
            addLog("警告: Gemini API Key 未設定，無法執行 AI 深度分析。");
            setScreenerError("Gemini API Key 未設定，僅顯示本地篩選結果，無法執行 AI 深度分析。");
        } else {
            addLog("正在為最佳結果執行 AI 分析...");
            try {
                const analysisPromises = finalResults.map(stock => getAIStockReport(stock, tradeHistory, tradeUnitMode));
                const aiReports = await Promise.all(analysisPromises);
                
                const stocksWithAI = finalResults.map((stock, index) => ({ ...stock, aiReport: aiReports[index] }));
                
                setScreenedStocks(stocksWithAI);
                addLog("AI 分析完成。");
            } catch (e: any) {
                addLog(`AI 分析失敗: ${e.message}`);
                setScreenerError(`AI 分析時發生錯誤: ${e.message}。僅顯示基本評分。`);
            }
        }
        
        setIsScreening(false);
    }, [tradeHistory, tradeUnitMode, settings]);

    const handleCollaborativeAnalysis = useCallback(async (stockId: string, userId?: string) => {
        if (!IS_GEMINI_CONFIGURED || !IS_GROQ_CONFIGURED) {
             setScreenerError("必須同時設定 Gemini 與 Groq API Keys 才能執行協同分析。");
             return;
        }
        setScreenerError(null);

        // Set loading state for the specific card
        setScreenedStocks(prev => prev.map(s =>
            s.stock.id === stockId ? { ...s, isCollaborating: true, analysisError: null, collaborativeReport: undefined } : s
        ));

        const targetStock = screenedStocks.find(s => s.stock.id === stockId);

        if (!targetStock || !targetStock.aiReport) {
            const errorMsg = "無法執行協同分析，缺少主要的 Gemini 分析報告。";
            setScreenerError(errorMsg);
            setScreenedStocks(prev => prev.map(s =>
                s.stock.id === stockId ? { ...s, isCollaborating: false, analysisError: errorMsg } : s
            ));
            return;
        }

        try {
            const finalReport = await performThreeStageAnalysis(targetStock, (progressMessage) => {
                // This is a hook to update the UI with progress.
                // For now, we use a more dynamic loader component in the UI.
                console.log(`Analysis progress for ${stockId}: ${progressMessage}`);
            }, userId);

            // Update the state with the final collaborative report
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
    }, [screenedStocks]);


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
