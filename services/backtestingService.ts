import { ScreenerStrategy, BacktestResult, SimulatedTrade, EquityDataPoint } from '../types';
import { sleep } from './utils';

// This is a MOCK implementation of a backtester.
// It returns a hardcoded result to demonstrate the UI flow.
// A real implementation would require a massive historical database and complex logic.

export const simulateTrades = async (
    strategy: ScreenerStrategy,
    period: string,
    onProgress: (message: string) => void
): Promise<BacktestResult> => {

    onProgress("正在載入歷史數據 (模擬)...");
    await sleep(1500);

    onProgress("逐日模擬交易中 (模擬)...");
    await sleep(2000);
    
    const isGoodStrategy = !['WEAK_MOMENTUM', 'M_TOP_REVERSAL'].includes(strategy);
    const isVolatile = ['DAY_TRADE', 'BREAKOUT'].includes(strategy);

    const baseReturn = isGoodStrategy ? 0.15 : -0.05;
    const volatility = isVolatile ? 0.1 : 0.05;

    let equity = 100000;
    const equityCurve: EquityDataPoint[] = [];
    const simulatedTrades: SimulatedTrade[] = [];
    const totalDays = 252; // Approx trading days in a year

    for(let i = 0; i < totalDays; i++) {
        const date = new Date(2023, 0, i + 1).toISOString().split('T')[0];
        
        // Simulate a trade every 15 days on average
        if (Math.random() < 1/15) {
             const returnPct = (Math.random() - 0.5 + (isGoodStrategy ? 0.1 : -0.1)) * volatility * 20; // Random trade return
             const exitPrice = 100 * (1 + returnPct);
             
             simulatedTrades.push({
                stockId: `${2000 + Math.floor(Math.random()*100)}`,
                stockName: '模擬股票',
                entryDate: date,
                exitDate: new Date(2023, 0, i + 6).toISOString().split('T')[0],
                entryPrice: 100,
                exitPrice: exitPrice,
                returnPct: returnPct * 100,
             });
             equity *= (1 + returnPct);
        }
        
        // Equity curve drift
        equity *= (1 + (baseReturn / totalDays) + (Math.random() - 0.5) * (volatility / Math.sqrt(totalDays)));
        equityCurve.push({ time: date, value: equity });
    }
    
    const winningTrades = simulatedTrades.filter(t => t.returnPct > 0).length;
    const totalProfit = simulatedTrades.filter(t => t.returnPct > 0).reduce((sum, t) => sum + t.returnPct, 0);
    const totalLoss = simulatedTrades.filter(t => t.returnPct < 0).reduce((sum, t) => sum + Math.abs(t.returnPct), 0);
    
    onProgress("計算績效指標 (模擬)...");
    await sleep(500);

    return {
        metrics: {
            totalReturn: ((equity / 100000) - 1) * 100,
            winRate: simulatedTrades.length > 0 ? (winningTrades / simulatedTrades.length) * 100 : 0,
            profitFactor: totalLoss > 0 ? totalProfit / totalLoss : Infinity,
            maxDrawdown: -12.8, // Hardcoded for now
            totalTrades: simulatedTrades.length,
            avgTradeReturn: simulatedTrades.length > 0 ? simulatedTrades.reduce((sum, t) => sum + t.returnPct, 0) / simulatedTrades.length : 0,
        },
        simulatedTrades,
        equityCurve
    };
};
