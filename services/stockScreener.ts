import { PortfolioHolding, Alert, AlertType, ScreenerStrategy, StrategySettings, StockData } from '../types';

export const DEFAULT_STRATEGY_SETTINGS: StrategySettings = {
    name: '預設策略',
    weights: {
        maUptrend: 0.15,
        revenueGrowth: 0.25,
        breakout5MA: 0.15,
        volumeSpike: 0.15,
        lowVolatility: 0.1,
        activeOddLotTrading: 0.20,
    },
    screener: {
        minRevenueGrowth: 10,
        volumeMultiplier: 1.5,
        minScore: 70,
        minOddLotVolume: 10000,
    },
    portfolio: {
        stopLoss: 0.08, // 8%
        takeProfit: 0.15, // 15%
    },
    analystPanel: {
        gemini: true,
        groq: true,
        github_copilot: true,
        github_openai: true,
        github_deepseek: true,
        github_xai: true,
    },
};

const calculateMA = (kline: {close: number}[], period: number): number => {
  if (kline.length < period) return 0;
  const relevantData = kline.slice(kline.length - period);
  return relevantData.reduce((sum, data) => sum + data.close, 0) / period;
};


const determineAlertForHolding = (
  holding: PortfolioHolding,
  stockData: StockData,
  settings: StrategySettings,
): Omit<Alert, 'ticker'> => {
  const { stopLoss, takeProfit } = settings.portfolio;
  const STOP_LOSS_PERCENT = stopLoss; 
  const TAKE_PROFIT_PERCENT = takeProfit;
  const STOP_LOSS_WARNING_PERCENT = STOP_LOSS_PERCENT * 0.6;
  
  const dayOfWeek = new Date().getDay(); // 0=Sun, ..., 5=Fri

  const { currentPrice, entryPrice } = holding;
  const gainPercent = (currentPrice - entryPrice) / entryPrice;

  const ma5 = calculateMA(stockData.kline, 5);
  const ma20 = calculateMA(stockData.kline, 20);
  const isStrongUptrend = ma5 > ma20;

  if (currentPrice < ma5) {
    return { type: AlertType.StopLoss, message: `股價 ${currentPrice.toFixed(2)} 已跌破 5 日均線 (${ma5.toFixed(2)})，為重要停損訊號，應立即處理。` };
  }
  if (gainPercent <= -STOP_LOSS_PERCENT) {
    return { type: AlertType.StopLoss, message: `虧損已達 ${(gainPercent * 100).toFixed(1)}%，觸及 ${STOP_LOSS_PERCENT * 100}% 固定停損點，應立即處理。` };
  }

  if (dayOfWeek === 5) {
    if (gainPercent >= TAKE_PROFIT_PERCENT) {
      if (isStrongUptrend) {
        return { type: AlertType.Review, message: `已達獲利目標且趨勢強勁。可考慮續抱至下週爭取更高報酬，或部分停利鎖定獲利。` };
      }
      return { type: AlertType.Review, message: `已達獲利目標但趨勢轉弱。建議在本週結束前考慮獲利了結，避免下週回吐。` };
    }
    if (gainPercent > 0) {
      return { type: AlertType.Review, message: `目前獲利 ${(gainPercent * 100).toFixed(1)}%。可考慮續抱，或設定更嚴格的移動停利點。` };
    }
    return { type: AlertType.Review, message: `目前虧損 ${(gainPercent * 100).toFixed(1)}%。請評估K線型態，決定是否停損出場或設定下週觀察計畫。` };
  }

  if (gainPercent <= -STOP_LOSS_WARNING_PERCENT) {
    return { type: AlertType.StopLoss, message: `虧損已達 ${(gainPercent * 100).toFixed(1)}%，接近 ${STOP_LOSS_PERCENT * 100}% 停損點，請密切注意。` };
  }
  if (gainPercent >= TAKE_PROFIT_PERCENT) {
    if (isStrongUptrend) {
      return { type: AlertType.Hold, message: `已達 ${TAKE_PROFIT_PERCENT * 100}% 獲利目標，且趨勢強勁 (5日線 > 20日線)，建議續抱等待週五複盤。` };
    }
    return { type: AlertType.TakeProfit, message: `已達 ${TAKE_PROFIT_PERCENT * 100}% 停利點 (${(gainPercent * 100).toFixed(1)}%)，趨勢轉弱，可考慮提前獲利了結。` };
  }

  return { type: AlertType.Hold, message: `目前損益 ${(gainPercent * 100).toFixed(1)}%，盤中追蹤，等待週五複盤訊號。` };
};

export const checkPortfolio = (portfolio: PortfolioHolding[], allStocks: StockData[], settings: StrategySettings): Alert[] => {
  const alerts: Alert[] = [];
  portfolio.forEach(holding => {
    const stockData = allStocks.find(s => s.id === holding.id);
    if (!stockData || stockData.kline.length < 20) return;
    const alertInfo = determineAlertForHolding(holding, stockData, settings);
    alerts.push({ ticker: holding.ticker, ...alertInfo });
  });
  return alerts;
};