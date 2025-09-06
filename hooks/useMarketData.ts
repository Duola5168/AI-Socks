import { useState, useCallback, useEffect } from 'react';
import { PartialStockData } from '../types';
import * as supabaseService from '../services/supabase';
import * as dbService from '../services/databaseService';
import { IS_SUPABASE_CONFIGURED } from '../services/config';

export const useMarketData = () => {
    const [allStocks, setAllStocks] = useState<PartialStockData[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [apiError, setApiError] = useState<string | null>(null);

    const loadAllMarketData = useCallback(async (
        onComplete: (allData: PartialStockData[]) => void,
    ) => {
        setIsDataLoading(true);
        setApiError(null);

        try {
            setLoadingMessage('正在從本地快取載入市場數據...');
            let cachedStocks = await dbService.loadAllStocks();
            
            // Sanitize data from cache to ensure correct naming convention
            if (cachedStocks.length > 0) {
                cachedStocks = cachedStocks.map(stock => {
                    const s = stock as any;
                    // If old data format with company_name exists, ensure it's mapped to name
                    if (s.company_name && !s.name) {
                        s.name = s.company_name;
                    }
                    return s as PartialStockData;
                });
            }
            
            if (cachedStocks.length > 0) {
                setAllStocks(cachedStocks);
                onComplete(cachedStocks); 
                // We can still trigger a background update check here if needed
                // For simplicity, we'll assume cached data is good for the session
            }

            if (!IS_SUPABASE_CONFIGURED) {
                if (cachedStocks.length === 0) {
                    setApiError("Supabase 未設定，且本地快取為空。");
                }
                onComplete(cachedStocks);
                return;
            }
            
            setLoadingMessage('正在檢查遠端數據庫更新...');
            const remoteTimestamp = await supabaseService.getLatestTimestamp();
            const localTimestamp = await dbService.getLatestTimestampInCache();

            if (!remoteTimestamp || (localTimestamp && new Date(remoteTimestamp) <= new Date(localTimestamp))) {
                setLoadingMessage('本地數據已是最新。');
                 if (cachedStocks.length > 0) {
                    onComplete(cachedStocks);
                    return;
                }
            }
            
            setLoadingMessage('偵測到數據更新，正在從 Supabase 下載完整歷史數據...');
            const marketData = await supabaseService.getAllStocksWithHistory();
            
            if (marketData.length === 0) {
                if(cachedStocks.length === 0) setApiError("遠端資料庫是空的。");
                onComplete(cachedStocks);
            } else {
                setLoadingMessage(`下載完成，正在快取 ${marketData.length} 筆股票資料...`);
                await dbService.saveAllStocks(marketData);
                setAllStocks(marketData);
                onComplete(marketData);
                setLoadingMessage('數據快取完成！');
            }
        } catch (e: any) {
            setApiError(`讀取市場資料失敗: ${e.message}`);
            onComplete([]);
        } finally {
            setIsDataLoading(false);
            setTimeout(() => setLoadingMessage(''), 2000); // Clear message after 2s
        }
    }, []);

    return { allStocks, setAllStocks, isDataLoading, loadingMessage, apiError, loadAllMarketData };
};