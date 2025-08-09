declare global {
  interface Window {
    LightweightCharts: any;
  }
}

export type ScreenerStrategy = 'BREAKOUT' | 'LONG_TERM' | 'DAY_TRADE' | 'VALUE' | 'GROWTH';
export type StrategyUIName = '波段突破' | '長期投資' | '當沖標的' | '價值低估' | '成長動能';

export type StockCategory = '進攻型' | '穩健型' | '保守型';

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
}

export interface NewsSentimentReport {
  sentiment: '正面' | '負面' | '中性';
  summary: string;
  keyPoints: string[];
  articleCount: number;
}

export interface DebatePoint {
  score: number;
  reasoning: string;
}

export interface DebateReport {
  overallStance: '看好' | '看壞';
  fundamentals: DebatePoint;
  technicals: DebatePoint;
  momentum: DebatePoint;
  riskAssessment: DebatePoint;
}

export interface FinalDecision {
  compositeScore: number;
  action: '買進' | '觀望' | '避免';
  confidence: '高' | '中' | '低';
  keyReasons: string[];
  synthesisReasoning: string;
}

export interface AnalysisPanel {
    analystName: string;
    icon: 'gemini' | 'groq' | 'github' | 'xai' | 'default';
    report: DebateReport;
}

export interface CollaborativeAIReport {
  finalDecision: FinalDecision;
  analysisPanels: AnalysisPanel[];
  newsReport?: NewsSentimentReport;
}

// 根據新的多來源資料庫規格書更新
export interface StockData {
  // --- 核心識別 ---
  id: string; // 主鍵 (e.g., '2330')
  name: string;
  ticker: string;

  // --- 系統管理 ---
  lastUpdated?: string; // ISO Timestamp for client-side cache
  lastAccessed?: string; // ISO Timestamp for Firestore TTL logic
  qualityFlag?: 'high' | 'medium' | 'low'; // AI分級
  growthPotential?: number; // AI成長潛力評分 (0-1)

  // --- 市場數據 (TWSE/FinMind) ---
  close?: number;
  dailyOpen?: number;
  dailyHigh?: number;
  dailyLow?: number;
  tradeValue?: number; // 成交值(元)
  amplitude?: number; // 振幅(%)
  kline: { time: string; open: number; high: number; low: number; close: number; }[];
  volumeHistory: number[];
  volatility: number; // 波動率

  // --- 估值指標 (TWSE/Goodinfo) ---
  peRatio?: number;
  pbRatio?: number;
  dividendYield?: number;

  // --- 基本面指標 (MOPS/Goodinfo/FinMind) ---
  revenueGrowth?: number; // 營收年增率(%)
  grossMargin?: number; // 毛利率(%)
  roe?: number; // 股東權益報酬率(%)
  eps?: number; // 每股盈餘(元)
  
  // --- 籌碼面 ---
  marginTrading?: boolean; // 可否資券
  
  // -- 歷史數據 (可選) --
  consecutiveRevenueGrowthMonths?: number;
  epsHistory?: { year: number, value: number }[];
  oddLotVolume?: number;
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
    github_copilot: boolean;
    github_openai: boolean;
    github_deepseek: boolean;
    github_xai: boolean;
  };
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