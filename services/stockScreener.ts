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
        gemini: true, // Proponent
        groq: true, // Opponent
        geminiModel: 'gemini-2.5-flash',
        groqPrimaryModel: 'llama-3.1-70b-versatile',
        groqSystemCheckModel: 'llama-3.1-8b-instant',
        githubModelCatalog: [],
        githubModels: {},
    },
    prompts: {
        BREAKOUT: '尋找市場動能強勁的突破候選股。優先考慮成交值 (tradeValue) 排名靠前、營收年增率 (revenueGrowth) 高，且股東權益報酬率 (ROE) 穩健的公司。目標是結合扎實基本面與市場熱度。',
        LONG_TERM: '尋找具備長期投資價值的公司。優先選擇擁有高且穩定股東權益報酬率 (ROE)、每股盈餘 (EPS) 表現良好，以及具備吸引力現金殖利率 (dividendYield) 的股票。',
        DAY_TRADE: '專注於極高的流動性與市場關注度。優先篩選成交值 (tradeValue) 在市場中名列前茅的股票。目標是找出當日價格波動潛力大的熱門股。',
        VALUE: '尋找市場上價值可能被低估的股票。優先選擇本益比 (PE) 與股價淨值比 (PB) 相對較低，同時現金殖利率 (dividendYield) 具備優勢的公司。',
        GROWTH: '尋找高速成長型公司。優先考慮營收年增率 (revenueGrowth) 突出，展現強勁成長動能的股票。可以接受相對較高的本益比 (PE)，因為我們更關注其未來潛力。',
        M_TOP_REVERSAL: '尋找價值可能被高估且成長動能趨緩的潛在空方標的。優先選擇本益比 (PE) 或股價淨值比 (PB) 顯著偏高，但營收年增率 (revenueGrowth) 較低或為負的公司。',
        SUPPORT_BREAKDOWN: '尋找基本面持續疲弱的潛在空方標的。優先選擇營收年增率 (revenueGrowth) 為負數，且股東權益報酬率 (ROE) 遠低於市場平均水平的公司。',
        WEAK_MOMENTUM: '尋找市場關注度低且基本面不佳的潛在空方標的。優先選擇成交值 (tradeValue) 排名靠後，且股東權益報酬率 (ROE) 持續表現不佳的公司。',
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
  const isShort = holding.position === 'short';
  const STOP_LOSS_PERCENT = stopLoss; 
  const TAKE_PROFIT_PERCENT = takeProfit;
  const STOP_LOSS_WARNING_PERCENT = STOP_LOSS_PERCENT * 0.6;
  
  const dayOfWeek = new Date().getDay(); // 0=Sun, ..., 5=Fri

  const { currentPrice, entryPrice } = holding;
  const gainPercent = isShort 
    ? (entryPrice - currentPrice) / entryPrice
    : (currentPrice - entryPrice) / entryPrice;

  const ma5 = calculateMA(stockData.kline, 5);
  const ma20 = calculateMA(stockData.kline, 20);
  
  // For short positions, a strong "uptrend" is actually a bad sign.
  const isFavorableTrend = isShort ? ma5 < ma20 : ma5 > ma20;

  // --- Priority 1: Stop Loss ---
  const technicalStopLossMessage = isShort
    ? `股價 ${currentPrice.toFixed(2)} 已突破 5 日均線 (${ma5.toFixed(2)})，為重要停損訊號，應立即回補。`
    : `股價 ${currentPrice.toFixed(2)} 已跌破 5 日均線 (${ma5.toFixed(2)})，為重要停損訊號，應立即處理。`;
  
  if (isShort ? currentPrice > ma5 : currentPrice < ma5) {
    return { type: AlertType.StopLoss, message: technicalStopLossMessage };
  }
  if (gainPercent <= -STOP_LOSS_PERCENT) {
    return { type: AlertType.StopLoss, message: `虧損已達 ${(gainPercent * 100).toFixed(1)}%，觸及 ${STOP_LOSS_PERCENT * 100}% 固定停損點，應立即處理。` };
  }

  // --- Priority 2: Friday Review ---
  if (dayOfWeek === 5) {
    if (gainPercent >= TAKE_PROFIT_PERCENT) {
      if (isFavorableTrend) {
        return { type: AlertType.Review, message: `已達獲利目標且趨勢對您有利。可考慮續抱至下週爭取更高報酬，或部分停利鎖定獲利。` };
      }
      return { type: AlertType.Review, message: `已達獲利目標但趨勢轉為不利。建議在本週結束前考慮獲利了結，避免下週回吐。` };
    }
    if (gainPercent > 0) {
      return { type: AlertType.Review, message: `目前獲利 ${(gainPercent * 100).toFixed(1)}%。可考慮續抱，或設定更嚴格的移動停利點。` };
    }
    return { type: AlertType.Review, message: `目前虧損 ${(gainPercent * 100).toFixed(1)}%。請評估K線型態，決定是否停損出場或設定下週觀察計畫。` };
  }
  
  // --- Priority 3: Mid-week warnings and suggestions ---
  if (gainPercent <= -STOP_LOSS_WARNING_PERCENT) {
    return { type: AlertType.StopLoss, message: `虧損已達 ${(gainPercent * 100).toFixed(1)}%，接近 ${STOP_LOSS_PERCENT * 100}% 停損點，請密切注意。` };
  }
  if (gainPercent >= TAKE_PROFIT_PERCENT) {
    if (isFavorableTrend) {
      const trendText = isShort ? '(5日線 < 20日線)' : '(5日線 > 20日線)';
      return { type: AlertType.Hold, message: `已達 ${TAKE_PROFIT_PERCENT * 100}% 獲利目標，且趨勢對您有利 ${trendText}，建議續抱等待週五複盤。` };
    }
    return { type: AlertType.TakeProfit, message: `已達 ${TAKE_PROFIT_PERCENT * 100}% 停利點 (${(gainPercent * 100).toFixed(1)}%)，趨勢轉為不利，可考慮提前獲利了結。` };
  }

  // --- Default: Hold ---
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
