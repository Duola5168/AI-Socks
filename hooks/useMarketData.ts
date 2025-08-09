import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../components/Auth';
import { StockData, ScreenerStrategy } from '../types';
import { fetchInitialStockData } from '../services/stockService';
import { loadStockDataFromCache, saveStockDataToCache } from '../services/cacheService';
import { config } from '../services/config';
import { FALLBACK_STOCK_LIST } from '../services/stockStaticData';

const PREFILTER_DATA_KEY = 'openapi-prefiltered-data';
const PREFILTER_TIMESTAMP_KEY = 'openapi-prefiltered-timestamp';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const useMarketData = () => {
    const { user } = useAuth();
    const [allStocks, setAllStocks] = useState<StockData[]>([]);
    const allStocksRef = useRef(allStocks);
    useEffect(() => { allStocksRef.current = allStocks; }, [allStocks]);
    
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [apiError, setApiError] = useState<string | null>(null);
    const [failedStocksLog, setFailedStocksLog] = useState<{ name: string; reason: string }[]>([]);

    const [processedCount, setProcessedCount] = useState(0);
    const [totalStockCount, setTotalStockCount] = useState(0);

    const loadAllMarketData = useCallback(async (
        onComplete: (allData: StockData[]) => void,
        strategy: ScreenerStrategy
    ) => {
        setIsDataLoading(true);
        setFailedStocksLog([]);
        setAllStocks([]);
        allStocksRef.current = [];
        setProcessedCount(0);
        setTotalStockCount(0);
        setApiError(null);

        setLoadingMessage('正在檢查本日快取...');
        const cachedStocks = await loadStockDataFromCache();
        if (cachedStocks) {
            setLoadingMessage('從完整本機快取載入成功！');
            setAllStocks(cachedStocks);
            setProcessedCount(cachedStocks.length);
            setTotalStockCount(cachedStocks.length);
            setIsDataLoading(false);
            setLoadingMessage('');
            onComplete(cachedStocks);
            return;
        }

        try {
            // Stage 1: Get stock list, preferring the pre-filtered list
            setLoadingMessage('正在獲取待分析股票清單...');
            let stocksToFetch: (Partial<StockData> & { id: string; name: string; })[] = [];
            
            const preFilterTimestampStr = localStorage.getItem(PREFILTER_TIMESTAMP_KEY);
            const preFilterListStr = localStorage.getItem(PREFILTER_DATA_KEY);

            if (preFilterTimestampStr && preFilterListStr && (Date.now() - parseInt(preFilterTimestampStr)) < ONE_DAY_MS) {
                try {
                    stocksToFetch = JSON.parse(preFilterListStr);
                    setLoadingMessage(`偵測到今日有效的預篩選清單，將使用 ${stocksToFetch.length} 支高品質股票進行分析...`);
                } catch (e) {
                    stocksToFetch = []; // Reset on parse error
                }
            }

            if (stocksToFetch.length === 0) {
                // Fallback to full list if pre-filtered list is not available or empty
                const stockListStr = localStorage.getItem('all-stock-list');
                if (stockListStr) {
                    try {
                        stocksToFetch = JSON.parse(stockListStr);
                        setLoadingMessage('使用完整市場股票清單進行分析...');
                    } catch (e) {
                        stocksToFetch = FALLBACK_STOCK_LIST;
                        setApiError("解析本地股票清單失敗，使用備用清單。");
                    }
                } else {
                    stocksToFetch = FALLBACK_STOCK_LIST;
                    setApiError("未找到本地股票清單，建議先至「系統監控」頁面更新。目前使用備用清單。");
                }
            }
    
            setTotalStockCount(stocksToFetch.length);
            if (stocksToFetch.length === 0) {
                setIsDataLoading(false);
                setApiError("沒有可供分析的股票。請先至「系統監控」頁面更新完整清單。");
                onComplete([]);
                return;
            }
    
            // Stage 2: Fetch detailed data for the qualified stocks
            setLoadingMessage(`準備獲取 ${stocksToFetch.length} 支股票的詳細資料...`);
    
            const handleFailure = (stockName: string, reason: string) => {
                setFailedStocksLog(prev => [...prev, { name: stockName, reason }]);
            };
            
            let runningProcessedCount = 0;
            const handleNewBatch = (batch: StockData[]) => {
                runningProcessedCount += batch.length;
                setProcessedCount(runningProcessedCount);
                const newAllStocks = [...allStocksRef.current, ...batch];
                allStocksRef.current = newAllStocks;
                setAllStocks(newAllStocks);
            };
    
            // Fetch all data for all stocks. Future optimization: fetch based on strategy.
            await fetchInitialStockData(stocksToFetch, setLoadingMessage, handleFailure, handleNewBatch, user?.uid);
    
            setLoadingMessage('正在將所有資料寫入本日快取...');
            await saveStockDataToCache(allStocksRef.current);
            setLoadingMessage('資料載入完成！');
    
        } catch (e) {
            console.error(e);
            setApiError(`無法載入股票數據: ${e instanceof Error ? e.message : "請檢查 API Token 或網路連線。"}`);
        } finally {
            setIsDataLoading(false);
            setLoadingMessage('');
            onComplete(allStocksRef.current);
        }
    }, [user]);

    return { allStocks, setAllStocks, isDataLoading, loadingMessage, apiError, loadAllMarketData, failedStocksLog, processedCount, totalStockCount };
};