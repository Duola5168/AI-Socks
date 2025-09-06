// services/utils.ts
import { ScoreBreakdown, StockData, MarketHealth } from '../types';

export class RateLimitError extends Error {
    public timeToWait: number;
    constructor(message: string, timeToWait: number) {
        super(message);
        this.name = 'RateLimitError';
        this.timeToWait = timeToWait;
    }
}

export class NonRetriableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NonRetriableError';
    }
}

export const getCriteriaText = (breakdown: ScoreBreakdown): string[] => {
    return Object.entries(breakdown)
        .filter(([, value]) => value)
        .map(([key]) => {
          switch (key) {
            case 'breakout5MA': return '技術面突破5日均線';
            case 'volumeSpike': return '技術面成交量放大';
            case 'revenueGrowth': return '營收年增率達標';
            case 'lowVolatility': return '股價波動穩定';
            case 'maUptrend': return '技術面均線多頭排列';
            case 'activeOddLotTrading': return '零股交易熱絡';
            case 'consecutiveRevenueGrowthMonths': return '營收連續成長';
            default: return '';
          }
        }).filter(Boolean);
};

const calculateMA = (kline: {close: number}[], period: number): number => {
  if (kline.length < period) return 0;
  const relevantData = kline.slice(kline.length - period);
  return relevantData.reduce((sum, data) => sum + data.close, 0) / period;
};

export const calculateMarketHealth = (allStocks: Partial<StockData>[]): MarketHealth => {
    if (!allStocks || allStocks.length === 0) {
        return { avgVolatility: '0.00', percentAboveMa20: '0.0' };
    }
    
    let stocksAboveMa20 = 0;
    let totalVolatility = 0;
    let validStocks = 0;

    allStocks.forEach(stock => {
        if (stock.kline && stock.kline.length >= 20) {
            validStocks++;
            const ma20 = calculateMA(stock.kline, 20);
            if (stock.kline[stock.kline.length - 1].close > ma20) {
                stocksAboveMa20++;
            }
            if(stock.volatility) totalVolatility += stock.volatility;
        }
    });

    if (validStocks === 0) {
        return { avgVolatility: '0.00', percentAboveMa20: '0.0' };
    }

    const percentAboveMa20 = (stocksAboveMa20 / validStocks) * 100;
    const avgVolatility = (totalVolatility / validStocks) * 100;
    
    return {
        percentAboveMa20: percentAboveMa20.toFixed(1),
        avgVolatility: avgVolatility.toFixed(2),
    };
};

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const isTradingDay = (date: Date): boolean => {
    // Use Taiwan's timezone for checking the day of the week
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Taipei',
        weekday: 'short',
    };
    const dayOfWeek = new Intl.DateTimeFormat('en-US', options).format(date);
    // Taiwan stock market is closed on Saturday and Sunday
    return !['Sat', 'Sun'].includes(dayOfWeek);
};

export const isTradingHours = (): boolean => {
    const now = new Date();
    if (!isTradingDay(now)) {
        return false;
    }

    const timeOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    };
    const timeString = new Intl.DateTimeFormat('en-US', timeOptions).format(now);
    // The result can be "24:00" for midnight, which needs to be handled.
    const [hoursStr, minutesStr] = timeString.split(':');
    const hours = hoursStr === '24' ? 0 : parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    const currentTimeInMinutes = hours * 60 + minutes;
    const startTimeInMinutes = 9 * 60; // 09:00
    const endTimeInMinutes = 13 * 60 + 30; // 13:30

    return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
};
