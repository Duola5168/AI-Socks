
import { useState, useCallback, useRef, useEffect } from 'react';
import { StockData, PartialStockData } from '../types';
import * as databaseService from '../services/databaseService';


export const useMarketData = () => {
    const [allStocks, setAllStocks] = useState<PartialStockData[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [apiError, setApiError] = useState<string | null>(null);
    const [failedStocksLog, setFailedStocksLog] = useState<{ name: string; reason: string }[]>([]);
    const [processedCount, setProcessedCount] = useState(0);
    const [totalStockCount, setTotalStockCount] = useState(0);

    const loadAllMarketData = useCallback(async (
        onComplete: (allData: PartialStockData[]) => void,
    ) => {
        setIsDataLoading(true);
        setApiError(null);
        setLoadingMessage('正在從本地資料庫載入市場數據...');

        try {
            const marketData = await databaseService.getMarketData();
            if (marketData.length === 0) {
                setApiError("本地資料庫是空的。請至「系統監控」頁面從雲端同步數據。");
                onComplete([]);
            } else {
                setAllStocks(marketData);
                onComplete(marketData);
            }
        } catch (e: any) {
            setApiError(`讀取本地資料庫失敗: ${e.message}`);
            onComplete([]);
        } finally {
            setIsDataLoading(false);
            setLoadingMessage('');
        }
    }, []);

    // This hook no longer fetches initial data, so the dependencies are simplified.
    // The main App component will now trigger the data loading logic.
    // Failed logs, processed counts are now managed by the SystemStatusPage component during DB update.

    return { allStocks, setAllStocks, isDataLoading, loadingMessage, apiError, loadAllMarketData, failedStocksLog, processedCount, totalStockCount };
};
