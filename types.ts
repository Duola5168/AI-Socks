export type ScreenerStrategy = 'BREAKOUT' | 'LONG_TERM' | 'DAY_TRADE' | 'VALUE' | 'GROWTH' | 'M_TOP_REVERSAL' | 'SUPPORT_BREAKDOWN' | 'WEAK_MOMENTUM';
export type StrategyUIName = '波段突破' | '長期投資' | '當沖標的' | '價值低估' | '成長動能' | 'M頭反轉' | '跌破支撐' | '弱勢動能' | '策略回測' | '策略進化';

export type StockCategory = '進攻型' | '穩健型' | '保守型' | '高風險空方' | '趨勢空方' | '價值陷阱';

export interface AIStockReport {
  category: StockCategory;
  reasoning: string;
  entryAnalysis: string;
  supportLevel: number;
  resistanceLevel: number;
}

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface NewsSentimentReport {
  sentiment: '正面' | '負面' | '中性';
  summary: string;
  keyPoints: string[];
  articleCount: number;
}

export interface AnalystReport {
  overallStance: '看好' | '看壞' | '中立';
  candlestickPattern: string;
  movingAverageAlignment: string;
  technicalIndicators: string;
  institutionalActivity: string;
  fundamentalAssessment: string;
  supportLevel: string;
  resistanceLevel: string;
  recommendedEntryZone: string;
  recommendedExitConditions: string;
  supplementaryAnalysis: string;
}

export interface FinalDecision {
  compositeScore: number;
  action: '買進' | '觀望' | '避免';
  confidence: '高' | '中' | '低';
  synthesisReasoning: string;
  consensusAndDisagreement: string;
  operationalStrategy: string;
  positionSizingSuggestion: string;
  stopLossStrategy: string;
  takeProfitStrategy: string;
  keyEventsToWatch: string[];
}

export interface AnalysisPanel {
    analystName: string;
    icon: 'gemini' | 'groq' | 'github' | 'xai' | 'openai' | 'microsoft' | 'meta' | 'cohere' | 'ai21' | 'deepseek' | 'default';
    report: AnalystReport;
}

export interface CollaborativeAIReport {
  finalDecision: FinalDecision;
  analysisPanels: AnalysisPanel[];
  newsReport?: NewsSentimentReport;
}

// Data format from backend (yfinance -> Firestore)
export interface YFinanceData {
    stock_id: string;
    name: string;
    symbol: string;
    price: number;
    k_line_data: {
        date: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    };
    pe_ratio?: number | null;
    pb_ratio?: number | null;
    dividend_yield?: number | null;
    roe?: number | null;
    revenue_growth_rate?: number | null;
    gross_profit_margin?: number | null;
    eps?: number | null;
    market_cap?: number | null;
}

export interface KLineData {
    time: string; // date
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

// Data format used throughout the application internally, compatible with components
export interface StockData {
  // --- 核心識別 ---
  id: string; // from stock_id
  name: string;
  ticker: string; // from symbol

  // --- 市場數據 (from yfinance) ---
  close?: number; // from price
  dailyOpen?: number;
  dailyHigh?: number;
  dailyLow?: number;
  tradeValue?: number; // calculated: price * volume
  
  // Historical data - Fetched separately for charts
  kline: KLineData[]; 
  volumeHistory: number[];
  
  // --- 估值指標 (from yfinance) ---
  peRatio?: number;
  pbRatio?: number;
  dividendYield?: number;

  // --- 基本面指標 (from yfinance) ---
  revenueGrowth?: number; // Converted to percentage
  grossMargin?: number; // Converted to percentage
  roe?: number; // Converted to percentage
  eps?: number;
  
  // --- Other metrics ---
  volatility: number; // calculated from kline history
}


// 用於初始載入或列表顯示，部分欄位可選
export type PartialStockData = Partial<Omit<StockData, 'id' | 'name' | 'ticker'>> & {
  id: string;
  name: string;
  ticker: string;
};

export interface ScoreBreakdown {
  // 策略相關指標
  volumeSpike?: boolean; // 成交量突破
  priceBreakout?: boolean; // 價格突破
  highROE?: boolean; // 高ROE
  stableEPS?: boolean; // 穩定EPS
  highYield?: boolean; // 高殖利率
  lowPE?: boolean; // 低本益比
  lowPB?: boolean; // 低股價淨值比
  highYoYGrowth?: boolean; // 高營收年增
  highGrossMargin?: boolean; // 高毛利率
  highLiquidity?: boolean; // 高流動性
  highAmplitude?: boolean; // 高振幅
  
  [key: string]: boolean | undefined;
}

export interface LayerScores {
    fundamentals: number;
    technicals: number;
    momentum: number;
    risk: number;
}

export interface ScoredStock {
  stock: StockData;
  score: number;
  breakdown: ScoreBreakdown;
  layerScores: LayerScores;
  aiReport?: AIStockReport;
  isCollaborating?: boolean;
  collaborationProgress?: string;
  collaborativeReport?: CollaborativeAIReport;
  analysisError?: string | null;
}

export interface PortfolioHolding {
  id: string;
  ticker: string;
  name: string;
  entryPrice: number;
  shares: number;
  currentPrice: number;
  position?: 'long' | 'short';
  initialScore?: number;
  breakdown?: ScoreBreakdown;
  layerScores?: LayerScores;
  strategy?: string;
  notifiedStopLoss?: boolean;
  trackingMode?: 'active' | 'watch';
}

export enum AlertType {
  StopLoss = '停損',
  TakeProfit = '停利',
  Hold = '續抱',
  Review = '週五複盤',
}

export interface Alert {
  ticker: string;
  type: AlertType;
  message: string;
}

export interface TradeHistory {
  id:string;
  ticker: string;
  name: string;
  entryPrice: number;
  sellPrice: number;
  shares: number;
  profit: number;
  sellDate: string;
  position?: 'long' | 'short';
  analysis?: string;
  postSellAnalysis?: string;
  initialScore?: number;
  breakdown?: ScoreBreakdown;
  layerScores?: LayerScores;
  strategy?: string;
  trackingMode?: 'active' | 'watch';
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
}

export interface MarketHealth {
    percentAboveMa20: string;
    avgVolatility: string;
}

export interface AIMarketStrategySuggestion {
    suggestedStrategy: StockCategory;
    reasoning: string;
}

export interface GitHubModelInfo {
    id: string;
    // Add other fields from catalog if needed, e.g., description, developer
}

export interface GitHubModelSelection {
  enabled: boolean;
  selectedModel: string;
}

export interface StrategySettings {
  name: string;
  weights: {
    maUptrend: number;
    revenueGrowth: number;
    breakout5MA: number;
    volumeSpike: number;
    lowVolatility: number;
    activeOddLotTrading: number;
  };
  screener: {
    minRevenueGrowth: number;
    volumeMultiplier: number;
    minScore: number;
    minOddLotVolume: number;
  };
  portfolio: {
    stopLoss: number;
    takeProfit: number;
  };
  analystPanel: {
    gemini: boolean;
    groq: boolean;
    geminiModel: string;
    groqPrimaryModel: string;
    groqSystemCheckModel: string;
    githubModelCatalog: GitHubModelInfo[];
    githubModels: Record<string, GitHubModelSelection>;
  };
  prompts: Record<ScreenerStrategy, string>;
}

export interface AIStrategyRecommendation {
  parameter: string;
  currentValue: string | number;
  recommendedValue: string | number;
  reason: string;
}

export interface AIStrategyAnalysis {
  marketOutlook: string;
  strategyCritique: string;
  recommendations: AIStrategyRecommendation[];
}

export interface SystemLog {
  id: string;
  timestamp: string; // ISO string
  status: 'success' | 'error';
  message: string;
}

// --- Backtesting Types ---
export interface SimulatedTrade {
  stockId: string;
  stockName: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
}

export interface BacktestMetrics {
  totalReturn: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  totalTrades: number;
  avgTradeReturn: number;
}

export interface EquityDataPoint {
    time: string; // YYYY-MM-DD
    value: number; // Portfolio value
}

export interface AIEvolutionSuggestion {
  prompt: string;
  reasoning: string;
}

export interface AIEvolutionAnalysis {
  critique: string;
  evolvedPrompts: AIEvolutionSuggestion[];
}

export interface BacktestResult {
  metrics: BacktestMetrics;
  equityCurve: EquityDataPoint[];
  simulatedTrades: SimulatedTrade[];
  aiAnalysis?: string; // Original analysis
  evolutionAnalysis?: AIEvolutionAnalysis; // New evolution suggestions
}

export interface AIBacktestAnalysis {
  performanceSummary: string;
  strengths: string[];
  weaknesses: string[];
  optimizationSuggestions: string[];
}