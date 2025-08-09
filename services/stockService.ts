import { StockData, PortfolioHolding, PartialStockData } from '../types';
import { sleep } from './utils';

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

export async function fetchRealtimeDataForTopStocks(
    topStocks: PartialStockData[],
    onProgress: (message: string) => void
): Promise<StockData[]> {
    onProgress(`精煉階段: 正在為前 ${topStocks.length} 檔股票獲取即時數據...`);
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 180); // K-line data
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const enrichedStocks: StockData[] = [];

    for (const stock of topStocks) {
        if (!stock.id) continue;
        try {
            onProgress(`- 正在獲取 ${stock.name} (${stock.id}) 的詳細K線與營收...`);
            
            const klineResult = await _executeFinMindFetch('TaiwanStockPrice', { data_id: stock.id, start_date: startDateStr });
            await sleep(250); // Be respectful to the API

            const revenueResult = await _executeFinMindFetch('TaiwanStockMonthRevenue', { data_id: stock.id, start_date: '2022-01-01' });

            const klineHistoryRaw = klineResult.data;
            if (!klineHistoryRaw || klineHistoryRaw.length < 60) {
                 throw new Error('K線數據不足');
            }
            klineHistoryRaw.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            const kline = klineHistoryRaw.map((d: any) => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.close }));
            const volumeHistory = klineHistoryRaw.map((d: any) => d.Trading_Volume);

            const revenueHistory = revenueResult.data;
             if (revenueHistory) {
                revenueHistory.sort((a: any, b: any) => new Date(a.revenue_month).getTime() - new Date(b.revenue_month).getTime());
            }

            const latestRevenue = revenueHistory?.slice(-1)[0];
            const revenueGrowth = latestRevenue?.revenue_yoy ?? 0;
            let consecutiveRevenueGrowthMonths = 0;
            if (revenueHistory && revenueHistory.length > 1) {
                for (let j = revenueHistory.length - 1; j > 0; j--) {
                    if (revenueHistory[j].revenue > revenueHistory[j - 1].revenue) {
                        consecutiveRevenueGrowthMonths++;
                    } else { break; }
                }
            }

            const lastKline = kline[kline.length - 1];
            
            const enrichedStock: StockData = {
                ...stock,
                id: stock.id!,
                name: stock.name!,
                ticker: stock.id!,
                kline: kline,
                volumeHistory: volumeHistory,
                revenueGrowth: revenueGrowth,
                consecutiveRevenueGrowthMonths: consecutiveRevenueGrowthMonths,
                volatility: 0, // Placeholder, can be calculated if needed
                close: lastKline.close,
                dailyOpen: lastKline.open,
                dailyHigh: lastKline.high,
                dailyLow: lastKline.low,
            };
            enrichedStocks.push(enrichedStock);

        } catch (error) {
             onProgress(`- 獲取 ${stock.name} 資料失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
        }
    }
    onProgress('即時數據獲取完成。');
    return enrichedStocks;
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
                const latestPriceData = result.data[result.data.length - 1];
                if (latestPriceData && typeof latestPriceData.close === 'number') {
                    priceMap.set(holding.ticker, latestPriceData.close);
                }
            }
            await sleep(250); 
        } catch (e) {
            console.error(`Error updating price for ${holding.ticker}:`, e);
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
