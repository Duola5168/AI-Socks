import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../components/Auth';
import * as firestoreService from '../services/firestoreService';
import { checkPortfolio } from '../services/stockScreener';
import { getSellTimingAnalysis } from '../services/geminiService';
import { sendStopLossEmail } from '../services/notificationService';
import { isTradingHours } from '../services/utils';
import { PortfolioHolding, TradeHistory, StockData, ScoredStock, Alert, AlertType, StrategySettings, PartialStockData, ScreenerStrategy } from '../types';
import useLocalStorage from './useLocalStorage';
import { IS_GEMINI_CONFIGURED, IS_BREVO_CONFIGURED } from '../services/config';

const MAX_ACTIVE_PORTFOLIO_SIZE = 5;

export interface AddToPortfolioOptions {
  stock: StockData | PartialStockData;
  shares: number;
  entryPrice: number;
  position?: 'long' | 'short';
  screenerData?: Pick<ScoredStock, 'score' | 'breakdown' | 'layerScores' | 'aiReport' | 'collaborativeReport'>;
}

export const useUserData = (
    allStocks: PartialStockData[],
    isDataLoading: boolean,
    setLoadingMessage: (message: string) => void,
    settings: StrategySettings
) => {
    const { user } = useAuth();
    const [portfolio, setPortfolio] = useLocalStorage<PortfolioHolding[]>('ai-investor-portfolio', []);
    const [tradeHistory, setTradeHistory] = useLocalStorage<TradeHistory[]>('ai-investor-trade-history', []);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const portfolioRef = useRef(portfolio);
    useEffect(() => { portfolioRef.current = portfolio; }, [portfolio]);

    const allStocksRef = useRef(allStocks);
    useEffect(() => { allStocksRef.current = allStocks; }, [allStocks]);
    
    const tradeHistoryRef = useRef(tradeHistory);
    useEffect(() => { tradeHistoryRef.current = tradeHistory; }, [tradeHistory]);

    const hasSynced = useRef(false);

    // Sync with Firestore on login
    useEffect(() => {
        if (user && !hasSynced.current) {
            const syncData = async () => {
                setIsSyncing(true);
                setLoadingMessage('正在同步您的雲端資料...');

                const [firestorePortfolio, firestoreHistory] = await Promise.all([
                    firestoreService.getPortfolio(user.uid),
                    firestoreService.getTradeHistory(user.uid)
                ]);

                const localPortfolio = portfolioRef.current;
                const localHistory = tradeHistoryRef.current;

                // Simple merge: Firestore wins. If local has something F-store doesn't, add it.
                // This is a basic strategy and could be more sophisticated.
                const mergedPortfolio = [...firestorePortfolio];
                const firestoreIds = new Set(firestorePortfolio.map(p => p.id));
                localPortfolio.forEach(lp => {
                    if (!firestoreIds.has(lp.id)) {
                        mergedPortfolio.push(lp);
                    }
                });
                
                const mergedHistory = [...firestoreHistory];
                const firestoreHistoryIds = new Set(firestoreHistory.map(h => h.id));
                 localHistory.forEach(lh => {
                    if (!firestoreHistoryIds.has(lh.id)) {
                        mergedHistory.push(lh);
                    }
                });

                setPortfolio(mergedPortfolio);
                setTradeHistory(mergedHistory.sort((a,b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime()));
                
                // Upload the merged result back to ensure consistency
                if (mergedPortfolio.length > 0) await firestoreService.updatePortfolioBatch(user.uid, mergedPortfolio);
                if (mergedHistory.length > 0) {
                     for (const trade of mergedHistory) {
                        await firestoreService.addTradeHistory(user.uid, trade);
                     }
                }
                
                hasSynced.current = true;
                setIsSyncing(false);
                setLoadingMessage('');
            };
            syncData();
        } else if (!user) {
            hasSynced.current = false;
        }
    }, [user, setLoadingMessage, setPortfolio, setTradeHistory]);


    // Error Toast Effect
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);
    
    // Price Update and Alert Check
    useEffect(() => {
        const updatePricesAndAlerts = async () => {
            const currentPortfolio = portfolioRef.current;
            const currentAllStocks = allStocksRef.current;
            
            if (currentPortfolio.length === 0 || currentAllStocks.length === 0) {
                setAlerts([]); // Clear alerts if portfolio is empty
                return;
            }

            const stockPriceMap = new Map(currentAllStocks.map(s => [s.id, s.close]));

            let portfolioWithNewPrices = currentPortfolio.map(holding => ({
                ...holding,
                currentPrice: stockPriceMap.get(holding.id) ?? holding.currentPrice,
            }));
            
            const fullStockDataForPortfolio = currentAllStocks.filter(s => 
                (s.kline && s.kline.length > 0) && portfolioWithNewPrices.some(h => h.id === s.id)
            ) as StockData[];

            if (fullStockDataForPortfolio.length > 0) {
                const newAlerts = checkPortfolio(portfolioWithNewPrices, fullStockDataForPortfolio, settings);
                setAlerts(newAlerts);

                // --- Email Notification Logic ---
                if (IS_BREVO_CONFIGURED) {
                    const promises = newAlerts
                        .filter(alert => alert.type === AlertType.StopLoss)
                        .map(async alert => {
                            const holding = portfolioWithNewPrices.find(h => h.ticker === alert.ticker);
                            if (holding && !holding.notifiedStopLoss) {
                                const success = await sendStopLossEmail(holding, alert.message);
                                if (success) {
                                    return holding.id; // Return ID of notified holding
                                }
                            }
                            return null;
                        });

                    const notifiedIds = (await Promise.all(promises)).filter((id): id is string => id !== null);
                    
                    if (notifiedIds.length > 0) {
                        const notifiedIdSet = new Set(notifiedIds);
                        portfolioWithNewPrices = portfolioWithNewPrices.map(h => 
                            notifiedIdSet.has(h.id) ? { ...h, notifiedStopLoss: true } : h
                        );
                    }
                }
            } else {
                 setAlerts([]);
            }
            
            setPortfolio(portfolioWithNewPrices);
            
            if(user && hasSynced.current) {
                firestoreService.updatePortfolioBatch(user.uid, portfolioWithNewPrices);
            }
        };
        
        if (!isDataLoading) {
            updatePricesAndAlerts();

            const intervalId = setInterval(() => {
                if (isTradingHours()) {
                    updatePricesAndAlerts();
                }
            }, 1 * 60 * 1000); // 1 minute

            return () => clearInterval(intervalId);
        }
    }, [isDataLoading, user, settings, setPortfolio]);

    const handleUpdatePostSellAnalysis = useCallback(async (tradeId: string, analysis: string) => {
        setTradeHistory(prev => prev.map(t => t.id === tradeId ? { ...t, postSellAnalysis: analysis } : t));
        if (!user || !hasSynced.current) return;
        await firestoreService.updateTradeHistory(user.uid, tradeId, { postSellAnalysis: analysis });
    }, [user, setTradeHistory]);

    // Automatic Post-Sell Analysis
    useEffect(() => {
        const analyzeRecentTrades = async () => {
            if (allStocksRef.current.length === 0) return;

            const now = new Date();
            const tradesToAnalyze = tradeHistoryRef.current.filter(trade => {
                const sellDate = new Date(trade.sellDate);
                const daysSinceSell = (now.getTime() - sellDate.getTime()) / (1000 * 3600 * 24);
                return !trade.postSellAnalysis && daysSinceSell >= 3 && daysSinceSell < 14;
            });
            
            if(tradesToAnalyze.length === 0) return;

            for (const trade of tradesToAnalyze) {
                const stockData = allStocksRef.current.find(s => s.ticker === trade.ticker);
                if (!stockData || !stockData.kline) continue;
                
                const sellDateIndex = stockData.kline.findIndex(k => k.time === trade.sellDate);
                if (sellDateIndex === -1 || sellDateIndex + 3 >= stockData.kline.length) {
                  continue;
                }

                const postSellPrices = [
                  stockData.kline[sellDateIndex + 1].close,
                  stockData.kline[sellDateIndex + 2].close,
                  stockData.kline[sellDateIndex + 3].close,
                ];

                try {
                  const analysis = await getSellTimingAnalysis(settings.analystPanel.geminiModel, trade, postSellPrices);
                  await handleUpdatePostSellAnalysis(trade.id, analysis);
                } catch (e) {
                  console.error(`Error analyzing sell timing for ${trade.ticker}`, e);
                }
            }
        };

        if(!isDataLoading && IS_GEMINI_CONFIGURED) {
            analyzeRecentTrades();
            const analysisInterval = setInterval(analyzeRecentTrades, 5 * 60 * 1000); 
            return () => clearInterval(analysisInterval);
        }
    }, [isDataLoading, handleUpdatePostSellAnalysis, settings.analystPanel.geminiModel]);

    const handleAddToPortfolio = useCallback(async (options: AddToPortfolioOptions) => {
        const { stock, shares, entryPrice, screenerData, position } = options;
        const activeCount = portfolio.filter(h => (h.trackingMode ?? 'active') === 'active').length;

        if (activeCount >= MAX_ACTIVE_PORTFOLIO_SIZE) {
            setError(`短期交易部位最多只能有 ${MAX_ACTIVE_PORTFOLIO_SIZE} 檔。`);
            return false;
        }
        if (portfolio.some(h => h.id === stock.id)) {
            setError('此股票已在投資組合中。');
            return false;
        }
        
        const getStrategy = () => {
            if (!screenerData) return '手動新增';
            if (screenerData.collaborativeReport) return screenerData.collaborativeReport.finalDecision.action;
            if (screenerData.aiReport) return screenerData.aiReport.category;
            return 'AI 選股';
        }
        
        const isShortStrategy = screenerData?.aiReport?.category && ['高風險空方', '趨勢空方', '價值陷阱'].includes(screenerData.aiReport.category);

        const newHolding: PortfolioHolding = {
            id: stock.id,
            ticker: stock.ticker,
            name: stock.name,
            entryPrice,
            shares,
            position: position || (isShortStrategy ? 'short' : 'long'),
            currentPrice: 'kline' in stock && stock.kline && stock.kline.length > 0
                ? stock.kline[stock.kline.length - 1].close
                : (stock.close ?? entryPrice),
            initialScore: screenerData?.score,
            breakdown: screenerData?.breakdown,
            layerScores: screenerData?.layerScores,
            strategy: getStrategy(),
            trackingMode: 'active',
        };

        setPortfolio(prev => [...prev, newHolding]);

        if (user && hasSynced.current) {
            try {
                await firestoreService.addHolding(user.uid, newHolding);
            } catch (e) {
                console.error("Failed to sync add holding:", e);
                setError("同步新增持股失敗。");
            }
        }
        return true;
    }, [portfolio, user, setPortfolio]);

    const handleSell = useCallback(async (holding: PortfolioHolding, sellPrice: number, sharesToSell: number) => {
        const isShort = holding.position === 'short';
        const profit = isShort 
            ? (holding.entryPrice - sellPrice) * sharesToSell 
            : (sellPrice - holding.entryPrice) * sharesToSell;

        const historyId = `${new Date().toISOString()}-${holding.ticker}`;
        const newHistoryItem: TradeHistory = {
            id: historyId,
            ticker: holding.ticker, name: holding.name, entryPrice: holding.entryPrice, sellPrice: sellPrice,
            shares: sharesToSell, profit: profit, sellDate: new Date().toISOString().split('T')[0],
            position: holding.position,
            initialScore: holding.initialScore, breakdown: holding.breakdown, 
            layerScores: holding.layerScores,
            strategy: holding.strategy,
            trackingMode: holding.trackingMode,
        };
        
        // Update local state first
        setTradeHistory(prev => [newHistoryItem, ...prev].sort((a,b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime()));

        const remainingShares = holding.shares - sharesToSell;
        if (remainingShares > 0) {
            const updatedHolding = { ...holding, shares: remainingShares };
            setPortfolio(prev => prev.map(p => p.id === holding.id ? updatedHolding : p));
        } else {
            setPortfolio(prev => prev.filter(p => p.id !== holding.id));
        }

        // Sync with firestore if online
        if(user && hasSynced.current) {
            try {
                await firestoreService.addTradeHistory(user.uid, newHistoryItem);
                if (remainingShares > 0) {
                    await firestoreService.updateHolding(user.uid, holding.id, { shares: remainingShares });
                } else {
                    await firestoreService.deleteHolding(user.uid, holding.id);
                }
            } catch (e) {
                console.error("Failed to sync sell action:", e);
                setError("同步賣出交易失敗。");
            }
        }
    }, [user, setTradeHistory, setPortfolio]);

    const handleUpdateTradeAnalysis = useCallback(async (tradeId: string, analysis: string) => {
        setTradeHistory(prev => prev.map(t => t.id === tradeId ? { ...t, analysis } : t));
        if(user && hasSynced.current) {
            try {
                await firestoreService.updateTradeHistory(user.uid, tradeId, { analysis });
            } catch (e) {
                console.error("Failed to sync trade analysis:", e);
                setError("同步交易分析失敗。");
            }
        }
    }, [user, setTradeHistory]);

    const handleToggleTrackingMode = useCallback(async (holdingId: string) => {
        const targetHolding = portfolio.find(h => h.id === holdingId);
        if (!targetHolding) return;

        const newMode: 'active' | 'watch' = (targetHolding.trackingMode ?? 'active') === 'active' ? 'watch' : 'active';

        // Check portfolio size limit only when moving a stock to 'active'
        if (newMode === 'active') {
            const activeCount = portfolio.filter(h => (h.trackingMode ?? 'active') === 'active').length;
            if (activeCount >= MAX_ACTIVE_PORTFOLIO_SIZE) {
                setError(`短期交易部位已滿 (${MAX_ACTIVE_PORTFOLIO_SIZE}檔)，無法將股票移回。`);
                return;
            }
        }

        const updatedPortfolio = portfolio.map(h => 
            h.id === holdingId ? { ...h, trackingMode: newMode } : h
        );
        setPortfolio(updatedPortfolio);

        if (user && hasSynced.current) {
            try {
                await firestoreService.updateHolding(user.uid, holdingId, { trackingMode: newMode });
            } catch (e) {
                console.error("Failed to sync tracking mode toggle:", e);
                setError("同步追蹤模式切換失敗。");
            }
        }
    }, [portfolio, user, setPortfolio]);

    return {
        portfolio,
        tradeHistory,
        alerts,
        error,
        isSyncing,
        setError,
        handleAddToPortfolio,
        handleSell,
        handleUpdateTradeAnalysis,
        handleToggleTrackingMode,
    };
};