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

export const calculateMarketHealth = (allStocks: StockData[]): MarketHealth => {
    if (!allStocks || allStocks.length === 0) {
        return { avgVolatility: '0.00', percentAboveMa20: '0.0' };
    }
    
    let stocksAboveMa20 = 0;
    let totalVolatility = 0;
    let validStocks = 0;

    allStocks.forEach(stock => {
        if (stock.kline.length >= 20) {
            validStocks++;
            const ma20 = calculateMA(stock.kline, 20);
            if (stock.kline[stock.kline.length - 1].close > ma20) {
                stocksAboveMa20++;
            }
            totalVolatility += stock.volatility;
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
