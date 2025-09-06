import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config, IS_SUPABASE_CONFIGURED } from './config';
import { PartialStockData, KLineData, StockData } from '../types';

// Supabase Client Initialization
const supabaseUrl = config.supabase.url || '';
const supabaseAnonKey = config.supabase.anonKey || '';

// Conditionally create the client. It can be null if config is missing.
export const supabase: SupabaseClient | null = IS_SUPABASE_CONFIGURED
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
    
/**
 * Fetches the static, fundamental data for all stocks from the 'stock_fundamentals' table.
 */
// FIX: Corrected the return type from Partial<StockData>[] to PartialStockData[] to match implementation and fix downstream errors.
export const getAllStockFundamentals = async (): Promise<PartialStockData[]> => {
    if (!supabase) {
        throw new Error("Supabase client is not initialized.");
    }
    const { data, error } = await supabase
        .from('stock_fundamentals')
        .select('*');

    if (error) {
        console.error("Error fetching from Supabase 'stock_fundamentals':", error);
        throw new Error(error.message);
    }
    
    // Transform raw fundamental data to PartialStockData, ensuring name is correctly mapped.
    return data.map((d: any) => ({
        id: d.ticker,
        ticker: d.ticker,
        name: d.company_name || d.ticker, // Ensure name is populated from company_name, with ticker as fallback
        close: d.recent_close,
        tradeValue: d.recent_close && d.volume ? d.recent_close * d.volume : 0,
        peRatio: d.pe_ratio,
        pbRatio: d.pb_ratio,
        dividendYield: d.dividend_yield,
        revenueGrowth: d.revenue_growth,
        roe: d.roe,
        eps: d.eps, // Assuming the python script adds this
        grossMargin: d.gross_margin,
    }));
};

/**
 * Fetches all stock data by first getting fundamentals and then joining them with historical price data.
 * This is the main function to get all market data for the app.
 */
export const getAllStocksWithHistory = async (): Promise<PartialStockData[]> => {
    if (!supabase) {
        throw new Error("Supabase client is not initialized.");
    }
    
    // 1. Fetch all fundamentals to use as the base
    const fundamentals = await getAllStockFundamentals();
    const fundamentalsMap = new Map(fundamentals.map(f => [f.ticker, f]));

    // 2. Fetch all historical time-series data
    const { data: historyData, error: historyError } = await supabase
        .from('stocks')
        .select('ticker, date, open, high, low, close, volume');

    if (historyError) {
        console.error("Error fetching from Supabase 'stocks':", historyError);
        throw new Error(historyError.message);
    }

    // 3. Group historical data by ticker for efficient lookup
    const groupedHistory = historyData.reduce((acc, row) => {
        if (!acc[row.ticker]) {
            acc[row.ticker] = [];
        }
        acc[row.ticker].push(row);
        return acc;
    }, {} as Record<string, any[]>);

    // 4. Combine fundamentals with their historical data
    const combinedData: PartialStockData[] = [];

    fundamentalsMap.forEach((fundamentalData, ticker) => {
        const historyRows = groupedHistory[ticker] || [];
        const sortedHistory = historyRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const kline: KLineData[] = sortedHistory.map(d => ({
            time: d.date,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume,
        }));

        // Calculate volatility from the last 60 days of k-line data
        const volatilitySlice = kline.slice(-60).map(k => k.close);
        let volatility = 0;
        if (volatilitySlice.length > 1) {
            const returns = [];
            for (let i = 1; i < volatilitySlice.length; i++) {
                if (volatilitySlice[i-1] === 0) continue; // Avoid division by zero
                returns.push(Math.log(volatilitySlice[i] / volatilitySlice[i - 1]));
            }
            if (returns.length > 1) {
                const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
                const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
                volatility = Math.sqrt(variance);
            }
        }
        
        // Push the fully combined object
        combinedData.push({
            ...fundamentalData,
            kline,
            volumeHistory: kline.map(k => k.volume ?? 0),
            volatility,
        });
    });
    
    return combinedData;
};


export const getKlineHistoryForTicker = async (ticker: string): Promise<KLineData[]> => {
    if (!supabase) {
        throw new Error("Supabase client is not initialized.");
    }
    const { data, error } = await supabase
        .from('stocks')
        .select('date, open, high, low, close, volume')
        .eq('ticker', ticker)
        .order('date', { ascending: true });

    if (error) {
        console.error(`Error fetching kline for ${ticker}:`, error);
        throw new Error(error.message);
    }
    
    if (!data) return [];

    return data.map((d: any) => ({
        time: d.date,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
    }));
};


/**
 * Gets the most recent date from the 'stock_fundamentals' table, which is the true indicator of the last update.
 */
export const getLatestTimestamp = async (): Promise<string | null> => {
     if (!supabase) {
        console.warn("Supabase client is not initialized. Cannot fetch latest timestamp.");
        return null;
    }

    const { data, error } = await supabase
        .from('stock_fundamentals')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
        
    if (error || !data) {
        console.error("Error fetching latest timestamp from stock_fundamentals:", error?.message || "No data returned");
        // Fallback to stocks table if fundamentals fails, for resilience.
        const { data: stockData, error: stockError } = await supabase
            .from('stocks')
            .select('date')
            .order('date', { ascending: false })
            .limit(1)
            .single();

        if (stockError || !stockData) {
            console.error("Fallback error fetching latest timestamp from stocks:", stockError?.message || "No data returned");
            return null;
        }
        return stockData.date;
    }
    return data.updated_at;
};