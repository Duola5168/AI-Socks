import { StockData, PortfolioHolding, ScreenerStrategy } from '../types';
import { FALLBACK_STOCK_LIST } from './stockStaticData';
import { getCache, setCache } from './firestoreService';
import { config } from './config';
import { sleep } from './utils';

const CACHE_TTL = {
    DAILY: 1000 * 60 * 60 * 24, // 24 hours
    MONTHLY: 1000 * 60 * 60 * 24 * 30, // 30 days
};

const BATCH_SIZE = 10; // Used for UI updates, not for fetching

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
async function _executeOpenApiFetch(endpoint: string, onProgress: (message: string) => void): Promise<any[]> {
    onProgress(`查詢中: ${endpoint}`);
    const urlParams = new URLSearchParams({
        source: 'twse',
        endpoint,
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
        const listedData = await _executeOpenApiFetch('t187ap03_L', onProgress);
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
    const [
        bwibbuResult,
        stockDayAvgResult,
        quarterlyEpsResult,
        monthlyRevResult,
        fmsrfkResult,
        dailyResult,
        basicInfoResult,
    ] = await Promise.allSettled([
        _executeOpenApiFetch('BWIBBU_ALL', msg => onProgress(`- (殖利率/PBR) ${msg}`)), // Item 1
        _executeOpenApiFetch('STOCK_DAY_AVG_ALL', msg => onProgress(`- (月均價量) ${msg}`)), // Item 2
        _executeOpenApiFetch('t187ap17_L', msg => onProgress(`- (季度EPS) ${msg}`)), // Item 4
        _executeOpenApiFetch('t187ap05_L', msg => onProgress(`- (月營收) ${msg}`)), // Item 5
        _executeOpenApiFetch('FMSRFK_ALL', msg => onProgress(`- (月成交資訊) ${msg}`)), // Item 6
        _executeOpenApiFetch('t187ap14_L', msg => onProgress(`- (每日行情) ${msg}`)), // Item 1, 7
        _executeOpenApiFetch('t187ap03_L', msg => onProgress(`- (基本資料) ${msg}`)), // Item 4, 8
    ]);
    
    onProgress("數據獲取完成，正在處理與建立查詢表...");

    const bwibbuMap = new Map();
    if (bwibbuResult.status === 'fulfilled') bwibbuResult.value.forEach(s => bwibbuMap.set(s['證券代號'], { pe: parseFloat(s['本益比']) }));
    else onProgress(`警告: 無法獲取 BWIBBU_ALL。 ${bwibbuResult.reason}`);

    const stockDayAvgMap = new Map();
    if (stockDayAvgResult.status === 'fulfilled') stockDayAvgResult.value.forEach(s => stockDayAvgMap.set(s['Code'], { avgVolume: parseInt(s['MonthlyAverageTradeVolume']?.replace(/,/g, '')) }));
    else onProgress(`警告: 無法獲取 STOCK_DAY_AVG_ALL。 ${stockDayAvgResult.reason}`);
    
    const quarterlyEpsMap = new Map();
    if (quarterlyEpsResult.status === 'fulfilled') {
        const latestFins = new Map();
        quarterlyEpsResult.value.forEach(s => {
            const code = s['公司代號'];
            if (!latestFins.has(code) || s['出表日期'] > latestFins.get(code).date) {
                latestFins.set(code, { date: s['出表日期'], profit: parseInt(s['本期綜合損益總額']?.replace(/,/g, '')) });
            }
        });
        latestFins.forEach((value, key) => quarterlyEpsMap.set(key, value.profit));
    } else onProgress(`警告: 無法獲取 t187ap17_L。 ${quarterlyEpsResult.reason}`);

    const monthlyRevMap = new Map();
    if (monthlyRevResult.status === 'fulfilled') monthlyRevResult.value.forEach(s => monthlyRevMap.set(s['公司代號'], { yoy: parseFloat(s['去年同月增減(%)']) }));
    else onProgress(`警告: 無法獲取 t187ap05_L。 ${monthlyRevResult.reason}`);
    
    const fmsrfkMap = new Map<string, { month: string, volume: number }[]>();
    if (fmsrfkResult.status === 'fulfilled') {
        fmsrfkResult.value.forEach(s => {
            const code = s['證券代號'];
            if (!fmsrfkMap.has(code)) fmsrfkMap.set(code, []);
            fmsrfkMap.get(code)!.push({ month: s['資料年月'], volume: parseInt(s['成交股數']?.replace(/,/g, '')) });
        });
        fmsrfkMap.forEach(volumes => volumes.sort((a,b) => b.month.localeCompare(a.month)));
    } else onProgress(`警告: 無法獲取 FMSRFK_ALL。 ${fmsrfkResult.reason}`);
    
    const dailyMap = new Map();
    if (dailyResult.status === 'fulfilled') dailyResult.value.forEach(s => dailyMap.set(s['證券代號'], { close: parseFloat(s['收盤價']), changePercent: parseFloat(s['漲跌幅']) }));
    else onProgress(`警告: 無法獲取 t187ap14_L。 ${dailyResult.reason}`);

    const basicInfoMap = new Map();
    if (basicInfoResult.status === 'fulfilled') basicInfoResult.value.forEach(s => basicInfoMap.set(s['公司代號'], { shares: parseInt(s['已發行普通股數或TDR原股發行股數']?.replace(/,/g, '')), industry: s['產業類別'], foundDate: s['成立日期'], capital: s['實收資本額'] }));
    else onProgress(`警告: 無法獲取 t187ap03_L。 ${basicInfoResult.reason}`);

    onProgress("數據處理完成，開始執行評分...");
    await sleep(50);
    onProgress("注意：因證交所 OpenAPI 限制，評分項目 #3(外資持股)、#9(投信趨勢)、#10(自營商趨勢) 將被跳過。");
    await sleep(50);

    const preFilteredList: (Partial<StockData> & { id: string, name: string, score: number })[] = [];
    const MIN_AVG_SCORE_THRESHOLD = 0;

    for (const stock of fullList) {
        let totalScore = 0;
        let effectiveItems = 0;

        const bwibbu = bwibbuMap.get(stock.id);
        const stockDayAvg = stockDayAvgMap.get(stock.id);
        const quarterlyProfit = quarterlyEpsMap.get(stock.id);
        const monthlyRev = monthlyRevMap.get(stock.id);
        const monthlyVols = fmsrfkMap.get(stock.id);
        const daily = dailyMap.get(stock.id);
        const basicInfo = basicInfoMap.get(stock.id);

        if (!daily || !basicInfo) continue;

        // #1. EPS (from PE)
        if (bwibbu && !isNaN(bwibbu.pe) && bwibbu.pe > 0 && !isNaN(daily.close)) {
            effectiveItems++;
            const eps = daily.close / bwibbu.pe;
            if (eps > 5) totalScore += 3; else if (eps >= 3) totalScore += 2; else if (eps >= 1) totalScore += 1;
        }

        // #2. Avg Monthly Volume
        if (stockDayAvg && !isNaN(stockDayAvg.avgVolume)) {
            effectiveItems++;
            const sheets = stockDayAvg.avgVolume / 1000;
            if (sheets > 1000) totalScore += 3; else if (sheets >= 500) totalScore += 2; else if (sheets >= 100) totalScore += 1;
        }

        // #4. Latest Quarter EPS
        if (!isNaN(basicInfo.shares) && basicInfo.shares > 0 && quarterlyProfit !== undefined && !isNaN(quarterlyProfit)) {
            effectiveItems++;
            const eps = quarterlyProfit / (basicInfo.shares / 10);
            if (eps > 3) totalScore += 3; else if (eps >= 1) totalScore += 2; else if (eps > 0) totalScore += 1;
        }

        // #5. Monthly Revenue YoY
        if (monthlyRev && !isNaN(monthlyRev.yoy)) {
            effectiveItems++;
            const yoy = monthlyRev.yoy;
            if (yoy > 20) totalScore += 3; else if (yoy >= 5) totalScore += 2; else if (yoy >= 0) totalScore += 1;
        }

        // #6. Monthly Volume YoY
        if (monthlyVols && monthlyVols.length >= 12) {
            const latest = monthlyVols[0];
            const lastYearMonth = (parseInt(latest.month.substring(0,4)) - 1) + latest.month.substring(4);
            const lastYearVol = monthlyVols.find(v => v.month === lastYearMonth);
            if (latest && lastYearVol && !isNaN(latest.volume) && !isNaN(lastYearVol.volume) && lastYearVol.volume > 0) {
                effectiveItems++;
                const growth = (latest.volume - lastYearVol.volume) / lastYearVol.volume * 100;
                if (growth > 20) totalScore += 3; else if (growth >= 5) totalScore += 2; else if (growth >= 0) totalScore += 1;
            }
        }

        // #7. Daily Price Change Stability
        if (!isNaN(daily.changePercent)) {
            effectiveItems++;
            const change = Math.abs(daily.changePercent);
            if (change < 2) totalScore += 3; else if (change <= 5) totalScore += 2; else if (change <= 10) totalScore += 1;
        }

        // #8. Basic Info Completeness
        effectiveItems++;
        let completenessScore = 0;
        if (basicInfo.industry) completenessScore++;
        if (basicInfo.foundDate) completenessScore++;
        if (basicInfo.capital) completenessScore++;
        totalScore += completenessScore;

        if (effectiveItems > 0) {
            const averageScore = (totalScore / effectiveItems) * 10 / 3; // Normalize to 10-point scale
            if (averageScore >= MIN_AVG_SCORE_THRESHOLD) {
                preFilteredList.push({ id: stock.id, name: stock.name, score: parseFloat(averageScore.toFixed(2)), close: daily?.close, peRatio: bwibbu?.pe });
            }
        }
    }

    onProgress(`篩選完成。共 ${preFilteredList.length} 支股票通過 ${MIN_AVG_SCORE_THRESHOLD} 分的門檻。`);
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

    const batchForUI: StockData[] = [];
    
    let stockIndex = 0;
    for (const stock of stocksToFetch) {
        try {
            onProgress(`處理中: ${stock.name} (${++stockIndex}/${stocksToFetch.length})`);
            
            const fetchKline = async () => (await _executeFinMindFetch('TaiwanStockPrice', { data_id: stock.id, start_date: startDateStr })).data.map((d: any) => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.close }));
            const fetchRevenue = async () => {
                const revenueStartDate = new Date(today); revenueStartDate.setFullYear(revenueStartDate.getFullYear() - 2);
                return (await _executeFinMindFetch('TaiwanStockMonthRevenue', { data_id: stock.id, start_date: revenueStartDate.toISOString().split('T')[0] })).data;
            };
            const fetchVolume = async () => (await _executeFinMindFetch('TaiwanStockTrading', { data_id: stock.id, start_date: startDateStr })).data.map((d: any) => d.Trading_Volume);
            const fetchOddLot = async () => (await _executeFinMindFetch('TaiwanStockOddLotTrading', { data_id: stock.id, start_date: startDateStr })).data;

            const kline = await fetchWithCache(userId, 'kline', stock.id, CACHE_TTL.DAILY, fetchKline, (msg) => onProgress(`- K線 (${msg})`));
            await sleep(250);
            const revenueHistory = await fetchWithCache(userId, 'revenue', stock.id, CACHE_TTL.MONTHLY, fetchRevenue, (msg) => onProgress(`- 營收 (${msg})`));
            await sleep(250);
            const volumeHistory = await fetchWithCache(userId, 'volume', stock.id, CACHE_TTL.DAILY, fetchVolume, (msg) => onProgress(`- 成交量 (${msg})`));
            await sleep(250);
            const oddLotHistory = await fetchWithCache(userId, 'oddlot', stock.id, CACHE_TTL.DAILY, fetchOddLot, (msg) => onProgress(`- 零股 (${msg})`));
            
            if (!kline || kline.length < 60) {
                throw new Error('K線數據不足或獲取失敗');
            }

            const latestRevenue = revenueHistory?.slice(-1)[0];
            const priorYearRevenue = revenueHistory?.find((r:any) => r.revenue_month === (parseInt(latestRevenue.revenue_month) - 100).toString());
            const revenueGrowth = (latestRevenue && priorYearRevenue) ? ((latestRevenue.revenue - priorYearRevenue.revenue) / priorYearRevenue.revenue) * 100 : stock.revenueGrowth ?? 0;
            
            let consecutiveRevenueGrowthMonths = 0;
            if (revenueHistory && revenueHistory.length > 1) {
              for (let i = revenueHistory.length - 1; i > 0; i--) {
                if (revenueHistory[i].revenue > revenueHistory[i - 1].revenue) {
                  consecutiveRevenueGrowthMonths++;
                } else { break; }
              }
            }

            let trSum = 0;
            for (let i = kline.length - 14; i < kline.length; i++) {
                const tr = Math.max(kline[i].high - kline[i].low, Math.abs(kline[i].high - kline[i - 1].close), Math.abs(kline[i].low - kline[i - 1].close));
                trSum += tr;
            }
            const volatility = (trSum / 14) / kline[kline.length - 1].close;
            const oddLotVolume = oddLotHistory?.length > 0 ? oddLotHistory.slice(-1)[0].Trading_Volume : 0;
            const lastKline = kline[kline.length-1];

            const stockData: StockData = { 
                // Pre-filtered data comes first
                ...stock,

                // Data from FinMind fetches (will overwrite if keys conflict, which is good for `close`)
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

                // Fallback mock data for values not available from either source
                marginTrading: stock.marginTrading ?? Math.random() > 0.3,
                roe: stock.roe ?? 5 + Math.random() * 15,
                grossMargin: stock.grossMargin ?? 15 + Math.random() * 30,
                debtRatio: stock.debtRatio ?? 20 + Math.random() * 40,
                epsHistory: stock.epsHistory ?? [
                    { year: new Date().getFullYear() - 1, value: 1 + Math.random() * 5 },
                    { year: new Date().getFullYear() - 2, value: 0.8 + Math.random() * 4.5 },
                    { year: new Date().getFullYear() - 3, value: 0.5 + Math.random() * 4.0 },
                ],
                // Ensure required fields from StockData are present even if `stock` doesn't have them
                id: stock.id,
                ticker: stock.id,
                name: stock.name,
            };

            batchForUI.push(stockData);
        } catch (error) {
            onFailure(stock.name, error instanceof Error ? error.message : String(error));
        }

        const isLastStock = stockIndex === stocksToFetch.length;
        if ((batchForUI.length >= BATCH_SIZE || isLastStock) && batchForUI.length > 0) {
            onNewBatch(batchForUI.slice()); 
            batchForUI.length = 0;
        }
    }
}

export const updatePortfolioPrices = async (portfolio: PortfolioHolding[]): Promise<PortfolioHolding[]> => {
    if (portfolio.length === 0) return portfolio;

    const tickers = portfolio.map(p => p.ticker);
    try {
        const result = await _executeFinMindFetch('TaiwanStockPrice', {
            data_id: tickers.join(','),
            start_date: new Date().toISOString().split('T')[0],
        });

        if (result.data && result.data.length > 0) {
            const priceMap = new Map<string, number>();
            result.data.forEach((item: any) => priceMap.set(item.stock_id, item.close));
            return portfolio.map(holding => ({
                ...holding,
                currentPrice: priceMap.get(holding.ticker) || holding.currentPrice,
            }));
        }
        return portfolio;
    } catch (e) {
        console.error('Error updating portfolio prices:', e);
        return portfolio;
    }
};
