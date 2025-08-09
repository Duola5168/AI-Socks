

import { StockData, ScoredStock, ScoreBreakdown, PortfolioHolding, Alert, AlertType, ScreenerStrategy, StrategySettings } from '../types';

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
};

const QUALITY_THRESHOLD = 5; // 品質分數門檻

// --- Helper Functions ---

// 簡易的 TWSE API 請求輔助函式
async function _executeTwseFetch(endpoint: string): Promise<any[]> {
    const url = `/.netlify/functions/stock-api?source=twse&endpoint=${endpoint}`;
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.text();
        console.error(`TWSE API (${endpoint}) request failed:`, errorData);
        throw new Error(`TWSE API (${endpoint}) request failed with status ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
        throw new Error(`TWSE API (${endpoint}) response is not a valid JSON array.`);
    }
    return data;
}

const calculateMA = (kline: {close: number}[], period: number): number => {
  if (kline.length < period) return 0;
  const relevantData = kline.slice(kline.length - period);
  return relevantData.reduce((sum, data) => sum + data.close, 0) / period;
};

// --- 無上限累積制品質評分 (第一階段篩選) ---
const runQualityGateScoring = async (
    stocks: StockData[],
    addLog: (message: string) => void
): Promise<StockData[]> => {
    addLog("執行第一階段：無上限累積制品質評分...");

    // 1. 併發獲取所有需要的 OpenAPI 數據
    addLog("- 正在獲取停牌、信用交易與產業別資料...");
    const [suspendedResult, industryResult, marginResult] = await Promise.allSettled([
        _executeTwseFetch('t187ap11_L'), // 停牌
        _executeTwseFetch('t187ap03_L'), // 產業別
        _executeTwseFetch('t187ap07_L'), // 信用交易
    ]);
    
    const suspendedSet = suspendedResult.status === 'fulfilled' ? new Set(suspendedResult.value.map(s => s['證券代號'])) : new Set();
    const industryMap = industryResult.status === 'fulfilled' ? new Map(industryResult.value.map(s => [s['公司代號'], s['產業類別']])) : new Map();
    const marginSet = marginResult.status === 'fulfilled' ? new Set(marginResult.value.map(s => s['股票代號'])) : new Set();
    
    if (suspendedResult.status === 'rejected') addLog(`- 警告：無法獲取停牌名單。 ${suspendedResult.reason}`);
    if (industryResult.status === 'rejected') addLog(`- 警告：無法獲取產業類別。 ${industryResult.reason}`);
    if (marginResult.status === 'rejected') addLog(`- 警告：無法獲取信用交易資料。 ${marginResult.reason}`);

    const FOCUS_INDUSTRIES = ['半導體業', '電子零組件業', '電腦及週邊設備業', '光電業', '通信網路業', '其他電子業'];
    const qualityPassedStocks: StockData[] = [];
    const logDetails: string[] = [];

    // 2. 對每支股票進行評分
    for (const stock of stocks) {
        let score = 0;
        const reasons: string[] = [];

        // 停牌名單 (直接淘汰)
        if (suspendedSet.has(stock.id)) {
            score = -999;
            reasons.push('停牌[-999]');
            logDetails.push(`${stock.name}(${stock.id}): ${score}分 ${reasons.join(', ')} -> 淘汰`);
            continue;
        }

        // 月營收
        if (stock.revenueGrowth > 30) { score += 2; reasons.push('營收年增>30%[+2]'); }
        else if (stock.revenueGrowth > 10) { score += 1; reasons.push('營收年增>10%[+1]'); }
        if (stock.consecutiveRevenueGrowthMonths >= 3) { score += 1; reasons.push('連3月營收成長[+1]'); }

        // 每日股價
        if ((stock.tradeValue ?? 0) > 50_000_000) { score += 1; reasons.push('成交值>5千萬[+1]'); }
        if (stock.volumeHistory.length >= 21) {
            const avgVolume20 = stock.volumeHistory.slice(-21, -1).reduce((s, v) => s + v, 0) / 20;
            const todayVolume = stock.volumeHistory[stock.volumeHistory.length - 1];
            if (avgVolume20 > 0 && todayVolume > avgVolume20 * 1.5) { score += 1; reasons.push('成交量>20日均量1.5倍[+1]'); }
        }

        // EPS/產業
        if ((stock.peRatio ?? 0) > 0) { score += 1; reasons.push('EPS>0[+1]'); }
        if (stock.close && stock.peRatio && (stock.close / stock.peRatio) > 2) { score += 2; reasons.push('EPS>2[+2]'); }
        const industry = industryMap.get(stock.id);
        if (industry && FOCUS_INDUSTRIES.includes(industry)) { score += 1; reasons.push('關注產業[+1]'); }

        // 財務比率
        if ((stock.roe ?? 0) > 15) { score += 2; reasons.push('ROE>15%[+2]'); }
        else if ((stock.roe ?? 0) > 10) { score += 1; reasons.push('ROE>10%[+1]'); }
        if ((stock.debtRatio ?? 100) < 50) { score += 1; reasons.push('負債比<50%[+1]'); }
        
        // 殖利率/PE
        if ((stock.yield ?? 0) > 6) { score += 2; reasons.push('殖利率>6%[+2]'); }
        else if ((stock.yield ?? 0) > 4) { score += 1; reasons.push('殖利率>4%[+1]'); }
        if ((stock.peRatio ?? -1) > 0 && (stock.peRatio ?? 999) < 20) { score += 1; reasons.push('PE>0&<20[+1]'); }
        
        // 信用交易
        if (stock.marginTrading || marginSet.has(stock.id)) { score += 1; reasons.push('可信用交易[+1]'); }
        
        // 其他 API
        if (stock.roe !== undefined) { score += 1; reasons.push('有財報資料[+1]'); }
        if (stock.yield !== undefined) { score += 1; reasons.push('有配息記錄[+1]'); }

        // 3. 門檻判斷
        if (score >= QUALITY_THRESHOLD) {
            qualityPassedStocks.push(stock);
            logDetails.push(`${stock.name}(${stock.id}): ${score}分 ${reasons.join(', ')} -> 通過`);
        }
    }
    
    console.log("--- 品質評分詳細日誌 ---");
    console.log(logDetails.join('\n'));
    addLog(`品質評分完成。共 ${qualityPassedStocks.length} 支股票通過 ${QUALITY_THRESHOLD} 分門檻。`);
    
    return qualityPassedStocks;
};


// --- Strategy-specific Scoring Functions (第二階段篩選) ---

const scoreBreakout = (stock: StockData, threshold: number, settings: StrategySettings): { score: number, breakdown: ScoreBreakdown } => {
    const breakdown: ScoreBreakdown = {};
    let conditionsMet = 0;
    const totalConditions = 3;

    if (!stock.close) return { score: 0, breakdown };

    const ma5 = calculateMA(stock.kline, 5);
    const ma20 = calculateMA(stock.kline, 20);
    const ma60 = calculateMA(stock.kline, 60);

    const maxMa = Math.max(ma5, ma20, ma60);
    const minMa = Math.min(ma5, ma20, ma60);
    breakdown.maCluster = ma20 > 0 && ((maxMa - minMa) / ma20 < 0.03);
    if (breakdown.maCluster) conditionsMet++;

    const avgVolume20 = stock.volumeHistory.slice(-21, -1).reduce((s, v) => s + v, 0) / 20;
    const todayVolume = stock.volumeHistory[stock.volumeHistory.length - 1];
    breakdown.volumeSpike = avgVolume20 > 0 && todayVolume > avgVolume20 * settings.screener.volumeMultiplier;
    if (breakdown.volumeSpike) conditionsMet++;

    breakdown.priceAboveMAs = stock.close! > maxMa;
    if (breakdown.priceAboveMAs) conditionsMet++;

    if ((stock.tradeValue ?? 0) < 30_000_000) return { score: 0, breakdown };

    if ((conditionsMet / totalConditions) >= threshold) {
        const score = avgVolume20 > 0 ? (todayVolume / avgVolume20) * 50 : 50;
        return { score, breakdown };
    }
    return { score: 0, breakdown };
};

const scoreLongTerm = (stock: StockData, threshold: number): { score: number, breakdown: ScoreBreakdown } => {
    const breakdown: ScoreBreakdown = {}; let conditionsMet = 0; const totalConditions = 4;
    breakdown.highROE = (stock.roe ?? 0) >= 12; if(breakdown.highROE) conditionsMet++;
    const epsHistory = stock.epsHistory ?? [];
    breakdown.stableEPS = epsHistory.length >= 3 && epsHistory[0].value >= epsHistory[1].value && epsHistory[1].value >= epsHistory[2].value; if(breakdown.stableEPS) conditionsMet++;
    breakdown.goodYield = (stock.yield ?? 0) >= 3; if(breakdown.goodYield) conditionsMet++;
    breakdown.lowDebt = (stock.debtRatio ?? 100) <= 50; if(breakdown.lowDebt) conditionsMet++;
    if ((conditionsMet / totalConditions) >= threshold) {
        const score = (stock.roe ?? 0) * 5 + (stock.yield ?? 0) * 10;
        return { score, breakdown };
    } return { score: 0, breakdown };
};

const scoreDayTrade = (stock: StockData, threshold: number): { score: number, breakdown: ScoreBreakdown } => {
    const breakdown: ScoreBreakdown = {}; let conditionsMet = 0; const totalConditions = 4;
    breakdown.highLiquidity = (stock.tradeValue ?? 0) >= 500_000_000; if(breakdown.highLiquidity) conditionsMet++;
    breakdown.highAmplitude = (stock.amplitude ?? 0) >= 3; if(breakdown.highAmplitude) conditionsMet++;
    breakdown.canMargin = stock.marginTrading === true; if(breakdown.canMargin) conditionsMet++;
    breakdown.goodPriceRange = stock.close! >= 20 && stock.close! <= 150; if(breakdown.goodPriceRange) conditionsMet++;
    if ((conditionsMet / totalConditions) >= threshold) {
        const score = (stock.amplitude ?? 0) * 20 + ((stock.tradeValue ?? 0) / 10_000_000);
        return { score, breakdown };
    } return { score: 0, breakdown };
};

const scoreValue = (stock: StockData, threshold: number): { score: number, breakdown: ScoreBreakdown } => {
    const breakdown: ScoreBreakdown = {}; let conditionsMet = 0; const totalConditions = 4;
    breakdown.lowPE = (stock.peRatio ?? 999) <= 15 && (stock.peRatio ?? -1) > 0; if(breakdown.lowPE) conditionsMet++;
    breakdown.lowPB = (stock.pbRatio ?? 999) <= 1.2 && (stock.pbRatio ?? -1) > 0; if(breakdown.lowPB) conditionsMet++;
    breakdown.highYield = (stock.yield ?? 0) >= 4; if(breakdown.highYield) conditionsMet++;
    breakdown.revenueGrowing = stock.revenueGrowth > 0; if(breakdown.revenueGrowing) conditionsMet++;
    if ((conditionsMet / totalConditions) >= threshold) {
        const score = (15 - (stock.peRatio ?? 15)) * 4 + (1.2 - (stock.pbRatio ?? 1.2)) * 30 + (stock.yield ?? 0) * 10;
        return { score, breakdown };
    } return { score: 0, breakdown };
};

const scoreGrowth = (stock: StockData, threshold: number, settings: StrategySettings): { score: number, breakdown: ScoreBreakdown } => {
    const breakdown: ScoreBreakdown = {}; let conditionsMet = 0; const totalConditions = 3;
    if (!stock.close) return { score: 0, breakdown };
    breakdown.highYoYGrowth = stock.revenueGrowth >= settings.screener.minRevenueGrowth; if(breakdown.highYoYGrowth) conditionsMet++;
    breakdown.highGrossMargin = (stock.grossMargin ?? 0) >= 25; if(breakdown.highGrossMargin) conditionsMet++;
    const ma60 = calculateMA(stock.kline, 60);
    breakdown.aboveQuarterLine = ma60 > 0 && stock.close! > ma60; if(breakdown.aboveQuarterLine) conditionsMet++;
    if ((stock.tradeValue ?? 0) < 20_000_000) return { score: 0, breakdown };
    if ((conditionsMet / totalConditions) >= threshold) {
        const score = stock.revenueGrowth * 2 + (stock.grossMargin ?? 0) * 1.5;
        return { score, breakdown };
    } return { score: 0, breakdown };
};

// --- Main Screening Orchestrator ---
export const runStrategyScreening = async (
  stocks: StockData[], 
  strategy: ScreenerStrategy,
  settings: StrategySettings,
  addLog: (message: string) => void
): Promise<Omit<ScoredStock, 'aiReport'>[]> => {
  
  // 第一階段：無上限累積制品質篩選
  const highQualityStocks = await runQualityGateScoring(stocks, addLog);

  if (highQualityStocks.length === 0) {
      addLog("沒有任何股票通過品質篩選門檻，無法進行策略篩選。");
      return [];
  }

  addLog(`執行第二階段：對 ${highQualityStocks.length} 支高品質股票進行「${strategy}」策略評分...`);

  const scorer = {
      BREAKOUT: (stock: StockData, threshold: number) => scoreBreakout(stock, threshold, settings),
      LONG_TERM: scoreLongTerm,
      DAY_TRADE: scoreDayTrade,
      VALUE: scoreValue,
      GROWTH: (stock: StockData, threshold: number) => scoreGrowth(stock, threshold, settings),
  }[strategy];
  
  // 第二階段：策略評分
  let scoredStocks = highQualityStocks.map(stock => {
      const { score, breakdown } = scorer(stock, 0.8);
      return { stock, score, breakdown };
  });

  let finalResults = scoredStocks.filter(s => s.score > 0);
  
  if (finalResults.length === 0 && highQualityStocks.length > 0) {
    addLog("主要策略條件(80%)無結果，放寬至次要條件(60%)重新篩選...");
    scoredStocks = highQualityStocks.map(stock => {
      const { score, breakdown } = scorer(stock, 0.6);
      return { stock, score, breakdown };
    });
    finalResults = scoredStocks.filter(s => s.score > 0);
  }

  return finalResults
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ stock, score, breakdown }) => ({
        stock,
        score: Math.round(score),
        breakdown,
        layerScores: { fundamentals: 0, technicals: 0, momentum: 0, risk: 0 } 
    }));
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
