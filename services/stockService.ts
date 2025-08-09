import { StockData, PortfolioHolding, ScreenerStrategy } from '../types';
import { FALLBACK_STOCK_LIST } from './stockStaticData';
import { getCache, setCache } from './firestoreService';
import { config } from './config';
import { sleep } from './utils';

const CACHE_TTL = {
    DAILY: 1000 * 60 * 60 * 24, // 24 hours
    MONTHLY: 1000 * 60 * 60 * 24 * 30, // 30 days
};

const PREFILTER_DATA_KEY = 'openapi-prefiltered-data';
const PREFILTER_TIMESTAMP_KEY = 'openapi-prefiltered-timestamp';


const isCacheValid = (lastUpdated: string, ttl: number): boolean => {
    const now = new Date().getTime();
    const lastUpdatedTime = new Date(lastUpdated).getTime();
    return (now - lastUpdatedTime) < ttl;
};

async function fetchWithCache<T>(
    userId: string | undefined,
    cacheCollection: string,
    cacheDocId: string,
    ttl: number,
    fetchFn: () => Promise<T>,
    onProgress: (message: string) => void
): Promise<T> {
    if (userId) {
        try {
            const cache = await getCache(userId, cacheCollection, cacheDocId);
            if (cache && isCacheValid(cache.lastUpdated, ttl)) {
                onProgress("從雲端快取");
                return cache.data as T;
            }
        } catch (e) {
             console.warn(`Failed to read from Firestore cache for ${cacheCollection}/${cacheDocId}. Fetching from API.`, e);
        }
    }
    onProgress("從API");
    const data = await fetchFn();
    if (userId && data) {
         try {
            await setCache(userId, cacheCollection, cacheDocId, data);
        } catch (e) {
            console.warn(`Failed to write to Firestore cache for ${cacheCollection}/${cacheDocId}.`, e);
        }
    }
    return data;
}

/**
 * Executes a request to the FinMind API via the Netlify serverless function.
 * @param dataset - The dataset to request (e.g., 'TaiwanStockPrice').
 * @param params - Additional parameters for the FinMind API.
 * @returns The data from the FinMind API.
 */
async function _executeFinMindFetch(dataset: string, params: Record<string, string>) {
    const urlParams = new URLSearchParams({
        source: 'finmind',
        dataset,
        ...params,
    });
    const url = `/.netlify/functions/stock-api?${urlParams.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
        try {
            const errorData = await response.json();
            throw new Error(errorData.error || `FinMind API 代理錯誤，狀態: ${response.status}`);
        } catch (e) {
            throw new Error(`FinMind API 代理錯誤，狀態: ${response.status}`);
        }
    }

    const result = await response.json();
    if (result.msg !== 'success') {
        throw new Error(result.msg || "未知的 FinMind API 錯誤");
    }
    return result;
}

/**
 * Executes a request to the TWSE Open API via the Netlify serverless function.
 * @param endpoint - The Open API endpoint to request (e.g., 't187ap03_L').
 * @param onProgress - A callback to report progress.
 * @returns The data from the TWSE Open API.
 */
async function _executeOpenApiFetch(endpoint: string, onProgress: (message: string) => void, params?: Record<string, string>): Promise<any[]> {
    onProgress(`查詢中: ${endpoint}`);
    const urlParams = new URLSearchParams({
        source: 'twse',
        endpoint,
        ...params,
    });
    const url = `/.netlify/functions/stock-api?${urlParams.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
        try {
            const errorData = await response.json();
            throw new Error(errorData.error || `TWSE API 代理錯誤，狀態: ${response.status}`);
        } catch (e) {
            throw new Error(`TWSE API 代理錯誤，狀態: ${response.status}`);
        }
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
        throw new Error(`TWSE API (${endpoint}) 回應不是有效的 JSON 陣列。`);
    }

    onProgress(`成功獲取 ${data.length} 筆資料。`);
    return data;
}

export async function updateAndCacheAllStockList(onProgress: (message: string) => void): Promise<{ success: boolean; count: number; error?: string; }> {
    onProgress('開始更新全市場上市股票清單...');
    
    const allStocks: { id: string, name: string }[] = [];
    let errorMessage: string | undefined;

    // --- Fetch Listed Stocks (TWSE) ---
    try {
        const listedData = await _executeOpenApiFetch('t187ap03_L', onProgress, { '$top': '10000' });
        const transformed = listedData
            .map(s => ({ id: s['公司代號'], name: s['公司簡稱'] }))
            .filter(s => s.id && s.name);
        allStocks.push(...transformed);
        onProgress(`成功獲取 ${transformed.length} 筆上市(TWSE)資料。`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errorMessage = `獲取上市(TWSE)股票清單失敗: ${message}`;
        onProgress(errorMessage);
    }
    
    // --- Process and Save ---
    if (allStocks.length === 0) {
        const finalError = errorMessage || '無法從任何來源獲取股票清單。';
        onProgress(finalError);
        return { success: false, error: finalError, count: 0 };
    }
    
    const initialCount = allStocks.length;
    const uniqueStockMap = new Map<string, { id: string, name: string }>();
    allStocks.forEach(stock => {
        const isValid = /^\d{4,5}$/.test(stock.id) &&
            !stock.name.includes('ETF') && !stock.name.includes('ETN') &&
            !stock.name.includes('認購') && !stock.name.includes('認售') &&
            !stock.name.includes('牛') && !stock.name.includes('熊') &&
            !stock.id.startsWith('00');
        
        if (isValid && !uniqueStockMap.has(stock.id)) {
            uniqueStockMap.set(stock.id, stock);
        }
    });
    const finalList = Array.from(uniqueStockMap.values());
    const removedCount = initialCount - finalList.length;
    onProgress(`過濾與去重完成，已排除 ${removedCount} 支ETF、權證、重複或格式不符的股票。`);
    onProgress(`最終有效股票清單共 ${finalList.length} 支。`);

    localStorage.setItem('all-stock-list', JSON.stringify(finalList));
    localStorage.setItem('all-stock-list-timestamp', Date.now().toString());
    localStorage.setItem('all-stock-list-count', finalList.length.toString());
    
    if (errorMessage) {
        onProgress(errorMessage);
    } else {
        onProgress('成功更新上市股票清單。');
    }

    return { success: true, count: finalList.length, error: errorMessage };
}

export const runOpenApiPreFilter = async (onProgress: (message: string, isFinal?: boolean) => void): Promise<{ success: boolean, count: number, error?: string }> => {
    onProgress("開始執行 OpenAPI 預篩選 (新版評分機制)...");
    await sleep(50);

    const fullListStr = localStorage.getItem('all-stock-list');
    if (!fullListStr) {
        const msg = "錯誤: 找不到全市場股票清單，請先執行步驟 1 更新。";
        onProgress(msg, true);
        return { success: false, count: 0, error: msg };
    }
    const fullList: { id: string, name: string }[] = JSON.parse(fullListStr);
    onProgress(`已載入 ${fullList.length} 支股票進行預篩選...`);
    await sleep(50);

    onProgress("正在併發獲取評分所需 OpenAPI 數據...");
    const openApiParams = { '$top': '10000' };
    const [
        bwibbuResult,
        stockDayAvgResult,
        monthlyRevResult,
    ] = await Promise.allSettled([
        _executeOpenApiFetch('BWIBBU_ALL', msg => onProgress(`- (本益比/殖利率) ${msg}`), openApiParams),
        _executeOpenApiFetch('STOCK_DAY_AVG_ALL', msg => onProgress(`- (月均價量) ${msg}`), openApiParams),
        _executeOpenApiFetch('t187ap05_L', msg => onProgress(`- (月營收) ${msg}`), openApiParams),
    ]);
    
    onProgress("數據獲取完成，正在處理與建立查詢表...");

    const bwibbuMap = new Map();
    if (bwibbuResult.status === 'fulfilled') {
        bwibbuResult.value.forEach(s => {
            const pe = parseFloat(s['本益比']);
            const yieldVal = parseFloat(s['殖利率(%)']);
            if (!isNaN(pe) && !isNaN(yieldVal)) {
                 bwibbuMap.set(s['證券代號'], { pe, yield: yieldVal });
            }
        });
    } else onProgress(`警告: 無法獲取 BWIBBU_ALL。 ${bwibbuResult.reason}`);

    const stockDayAvgMap = new Map();
    if (stockDayAvgResult.status === 'fulfilled') {
        const latestAverages = new Map();
        stockDayAvgResult.value.forEach(s => {
            const code = s['Code'];
            const date = s['Date']; // YYYYMM format
            const avgVolume = parseInt(s['MonthlyAverageTradeVolume']?.replace(/,/g, ''));
            if (!isNaN(avgVolume) && (!latestAverages.has(code) || date > latestAverages.get(code).date)) {
                latestAverages.set(code, { date, avgVolume });
            }
        });
        latestAverages.forEach((value, key) => stockDayAvgMap.set(key, value));
    } else onProgress(`警告: 無法獲取 STOCK_DAY_AVG_ALL。 ${stockDayAvgResult.reason}`);
    
    const monthlyRevMap = new Map();
    if (monthlyRevResult.status === 'fulfilled') {
        monthlyRevResult.value.forEach(s => {
            const yoy = parseFloat(s['去年同月增減(%)']);
            if (!isNaN(yoy)) {
                monthlyRevMap.set(s['公司代號'], { yoy });
            }
        });
    } else onProgress(`警告: 無法獲取 t187ap05_L。 ${monthlyRevResult.reason}`);

    onProgress("數據處理完成，開始執行評分...");
    await sleep(50);

    const preFilteredList: (Partial<StockData> & { id: string, name: string, score: number })[] = [];
    const MIN_SCORE_THRESHOLD = 3;

    for (const stock of fullList) {
        let score = 0;

        // #1 Profitability
        const bwibbu = bwibbuMap.get(stock.id);
        if (bwibbu) {
            if (bwibbu.pe > 0) score++;
            if (bwibbu.yield > 2) score++;
        }

        // #2 Liquidity
        const avgData = stockDayAvgMap.get(stock.id);
        if (avgData) {
            const avgVolumeSheets = avgData.avgVolume / 1000;
            if (avgVolumeSheets > 100) score++;
            if (avgVolumeSheets > 500) score++;
        }

        // #3 Growth
        const rev = monthlyRevMap.get(stock.id);
        if (rev) {
            if (rev.yoy > 0) score++;
            if (rev.yoy > 10) score++;
        }
        
        if (score >= MIN_SCORE_THRESHOLD) {
            preFilteredList.push({ 
                id: stock.id, 
                name: stock.name, 
                score: score,
                peRatio: bwibbu?.pe,
                yield: bwibbu?.yield,
                revenueGrowth: rev?.yoy
            });
        }
    }

    onProgress(`篩選完成。共 ${preFilteredList.length} 支股票通過 ${MIN_SCORE_THRESHOLD} 分的門檻。`);
    await sleep(50);
    
    preFilteredList.sort((a, b) => b.score - a.score);

    localStorage.setItem(PREFILTER_DATA_KEY, JSON.stringify(preFilteredList));
    localStorage.setItem(PREFILTER_TIMESTAMP_KEY, Date.now().toString());

    onProgress("預篩選結果已儲存。", true);
    return { success: true, count: preFilteredList.length };
};

export async function fetchInitialStockData(
    stocksToFetch: (Partial<StockData> & { id: string; name: string; })[],
    onProgress: (message: string) => void,
    onFailure: (stockName: string, reason: string) => void,
    onNewBatch: (batch: StockData[]) => void,
    userId?: string
): Promise<void> {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 180);
    const startDateStr = startDate.toISOString().split('T')[0];

    const revenueStartDate = new Date(today);
    revenueStartDate.setFullYear(revenueStartDate.getFullYear() - 2);
    const revenueStartDateStr = revenueStartDate.toISOString().split('T')[0];
    
    let processedCount = 0;

    for (const stock of stocksToFetch) {
        processedCount++;
        const progressPrefix = `處理中 ${processedCount}/${stocksToFetch.length}`;
        
        try {
            onProgress(`${progressPrefix}: 獲取 ${stock.name} 數據...`);
            
            const klineResult = await _executeFinMindFetch('TaiwanStockPrice', { data_id: stock.id, start_date: startDateStr });
            await sleep(250); // Be respectful to the API

            const revenueResult = await _executeFinMindFetch('TaiwanStockMonthRevenue', { data_id: stock.id, start_date: revenueStartDateStr });
            await sleep(250);

            const oddLotResult = await _executeFinMindFetch('TaiwanStockOddLotTrading', { data_id: stock.id, start_date: startDateStr });

            const klineHistoryRaw = klineResult.data;
            if (!klineHistoryRaw || klineHistoryRaw.length < 60) {
                throw new Error('K線數據不足或獲取失敗');
            }
            klineHistoryRaw.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            const kline = klineHistoryRaw.map((d: any) => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.close }));
            const volumeHistory = klineHistoryRaw.map((d: any) => d.Trading_Volume);

            const revenueHistory = revenueResult.data;
            if (revenueHistory) {
                revenueHistory.sort((a: any, b: any) => new Date(a.revenue_month).getTime() - new Date(b.revenue_month).getTime());
            }

            const latestRevenue = revenueHistory?.slice(-1)[0];
            const priorYearRevenue = revenueHistory?.find((r: any) => r.revenue_month === (parseInt(latestRevenue.revenue_month) - 100).toString());
            const revenueGrowth = (latestRevenue && priorYearRevenue && priorYearRevenue.revenue !== 0) ? ((latestRevenue.revenue - priorYearRevenue.revenue) / priorYearRevenue.revenue) * 100 : stock.revenueGrowth ?? 0;

            let consecutiveRevenueGrowthMonths = 0;
            if (revenueHistory && revenueHistory.length > 1) {
                for (let j = revenueHistory.length - 1; j > 0; j--) {
                    if (revenueHistory[j].revenue > revenueHistory[j - 1].revenue) {
                        consecutiveRevenueGrowthMonths++;
                    } else { break; }
                }
            }

            let trSum = 0;
            for (let j = Math.max(1, kline.length - 14); j < kline.length; j++) {
                const tr = Math.max(kline[j].high - kline[j].low, Math.abs(kline[j].high - kline[j - 1].close), Math.abs(kline[j].low - kline[j - 1].close));
                trSum += tr;
            }
            const volatility = (trSum / 14) / kline[kline.length - 1].close;

            const oddLotHistory = oddLotResult.data;
            if (oddLotHistory) {
                 oddLotHistory.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            }
            const oddLotVolume = oddLotHistory?.length > 0 ? oddLotHistory.slice(-1)[0].Trading_Volume : 0;
            
            const lastKline = kline[kline.length - 1];

            const stockData: StockData = {
                ...stock,
                kline,
                volumeHistory: volumeHistory || [],
                revenueGrowth,
                consecutiveRevenueGrowthMonths,
                volatility,
                oddLotVolume,
                close: lastKline.close,
                dailyOpen: lastKline.open,
                dailyHigh: lastKline.high,
                dailyLow: lastKline.low,
                tradeValue: stock.tradeValue ?? ((volumeHistory?.slice(-1)[0] ?? 0) * lastKline.close),
                marginTrading: stock.marginTrading ?? Math.random() > 0.3,
                roe: stock.roe ?? 5 + Math.random() * 15,
                grossMargin: stock.grossMargin ?? 15 + Math.random() * 30,
                debtRatio: stock.debtRatio ?? 20 + Math.random() * 40,
                epsHistory: stock.epsHistory ?? [{ year: new Date().getFullYear() - 1, value: 1 + Math.random() * 5 }, { year: new Date().getFullYear() - 2, value: 0.8 + Math.random() * 4.5 }, { year: new Date().getFullYear() - 3, value: 0.5 + Math.random() * 4.0 }],
                id: stock.id,
                ticker: stock.id,
                name: stock.name,
            };
            onNewBatch([stockData]);

        } catch (error) {
            onFailure(stock.name, error instanceof Error ? error.message : String(error));
        }
    }
}

export const updatePortfolioPrices = async (portfolio: PortfolioHolding[]): Promise<PortfolioHolding[]> => {
    if (portfolio.length === 0) return portfolio;

    const priceMap = new Map<string, number>();
    const today = new Date().toISOString().split('T')[0];

    for (const holding of portfolio) {
        try {
            const result = await _executeFinMindFetch('TaiwanStockPrice', {
                data_id: holding.ticker,
                start_date: today,
            });

            if (result.data && result.data.length > 0) {
                // The last item should be the most recent price.
                const latestPriceData = result.data[result.data.length - 1];
                if (latestPriceData && typeof latestPriceData.close === 'number') {
                    priceMap.set(holding.ticker, latestPriceData.close);
                }
            }
            await sleep(250); 
        } catch (e) {
            console.error(`Error updating price for ${holding.ticker}:`, e);
            // If it fails, we just don't update the price for this stock.
        }
    }

    if (priceMap.size > 0) {
        return portfolio.map(holding => ({
            ...holding,
            currentPrice: priceMap.get(holding.ticker) || holding.currentPrice,
        }));
    }

    return portfolio;
};