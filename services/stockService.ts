import { StockData, PartialStockData } from '../types';
import { sleep } from './utils';
import * as supabaseService from './supabase';

/**
 * Enriches a list of stocks with their full historical K-line data from Supabase.
 * @param topStocks - An array of stocks with partial data.
 * @param onProgress - A callback function to report progress.
 * @returns A promise that resolves to an array of fully enriched StockData objects.
 */
export async function fetchHistoricalDataForTopStocks(
    topStocks: PartialStockData[],
    onProgress: (message: string) => void
): Promise<StockData[]> {
    onProgress(`精煉階段: 正在為前 ${topStocks.length} 檔股票獲取歷史 K 線數據...`);
    
    const enrichedStocks: StockData[] = [];

    for (const stock of topStocks) {
        if (!stock.id) continue;
        try {
            onProgress(`- 正在獲取 ${stock.name} (${stock.ticker}) 的歷史數據...`);
            
            const klineHistory = await supabaseService.getKlineHistoryForTicker(stock.ticker);
            await sleep(50); 

            if (!klineHistory || klineHistory.length < 60) {
                 throw new Error('歷史 K 線數據不足 (少於 60 筆)');
            }

            const volumeHistory = klineHistory.map((d: any) => d.volume);
            
            const enrichedStock: StockData = {
                ...(stock as StockData), // Cast to full StockData and fill in the rest
                kline: klineHistory,
                volumeHistory: volumeHistory,
            };
            enrichedStocks.push(enrichedStock);

        } catch (error) {
             onProgress(`- 獲取 ${stock.name} (${stock.ticker}) 資料失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
        }
    }
    onProgress('歷史數據獲取完成。');
    return enrichedStocks;
}