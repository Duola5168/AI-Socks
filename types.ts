


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

// --- New types for News Analysis ---
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


// --- New types for the 3-stage collaborative analysis ---

// Represents a single point of argument in the debate stage
export interface DebatePoint {
  score: number; // Score from 0-100 for this specific point
  reasoning: string; // Brief reasoning for the score
}

// Represents the full report from one side of the debate (Pro or Con)
export interface DebateReport {
  overallStance: '看好' | '看壞';
  fundamentals: DebatePoint;
  technicals: DebatePoint;
  momentum: DebatePoint;
  riskAssessment: DebatePoint;
}

// Represents the final decision from the "CIO" AI
export interface FinalDecision {
  compositeScore: number; // Final score from 0-100
  action: '買進' | '觀望' | '避免';
  confidence: '高' | '中' | '低';
  keyReasons: string[]; // Bullet points for the final decision
  synthesisReasoning: string; // How the CIO reached the conclusion
}

// The final, synthesized report from the new 3-stage collaborative analysis
export interface CollaborativeAIReport {
  finalDecision: FinalDecision;
  proAnalysis: DebateReport; // Gemini's "Pro" analysis
  conAnalysis: DebateReport; // Groq's "Con" analysis
  newsReport?: NewsSentimentReport; // Optional news analysis
}


// Represents the raw data for a single stock
export interface StockData {
  id: string;
  name: string;
  ticker: string;
  kline: { time: string; open: number; high: number; low: number; close: number; }[];
  volumeHistory: number[];

  // From OpenAPI / Daily data
  close?: number; // Last close price
  dailyOpen?: number;
  dailyHigh?: number;
  dailyLow?: number;
  tradeValue?: number; // Daily trade value in TWD
  peRatio?: number;
  pbRatio?: number;
  yield?: number; // Dividend yield in %
  amplitude?: number; // Daily amplitude in %
  marginTrading?: boolean;

  // From FinMind / Deeper data
  revenueGrowth: number; // YoY or QoQ growth percentage
  consecutiveRevenueGrowthMonths: number;
  roe?: number; // Return on Equity
  grossMargin?: number;
  debtRatio?: number;
  epsHistory?: { year: number, value: number }[];
  
  // From existing logic
  volatility: number; // A measure like ATR as a percentage of price
  oddLotVolume: number; // Latest daily odd lot (fractional share) trading volume
}

// Breakdown of why a stock was scored the way it was
export interface ScoreBreakdown {
  // Breakout
  maCluster?: boolean;
  volumeSpike?: boolean;
  priceAboveMAs?: boolean;
  // Long Term
  highROE?: boolean;
  stableEPS?: boolean;
  goodYield?: boolean;
  lowDebt?: boolean;
  // Day Trade
  highLiquidity?: boolean;
  highAmplitude?: boolean;
  canMargin?: boolean;
  goodPriceRange?: boolean;
  // Value
  lowPE?: boolean;
  lowPB?: boolean;
  highYield?: boolean;
  revenueGrowing?: boolean;
  // Growth
  highYoYGrowth?: boolean;
  highGrossMargin?: boolean;
  aboveQuarterLine?: boolean;

  [key: string]: boolean | undefined;
}

export interface LayerScores {
    fundamentals: number;
    technicals: number;
    momentum: number;
    risk: number;
}

// A stock that has been processed by the screener
export interface ScoredStock {
  stock: StockData;
  score: number;
  breakdown: ScoreBreakdown;
  layerScores: LayerScores;
  aiReport?: AIStockReport;
  isCollaborating?: boolean;
  collaborativeReport?: CollaborativeAIReport;
  analysisError?: string | null;
}

// A position held in the user's portfolio
export interface PortfolioHolding {
  id: string; // Should match a StockData id
  ticker: string;
  name: string;
  entryPrice: number;
  shares: number;
  currentPrice: number;
  // New properties for learning
  initialScore?: number;
  breakdown?: ScoreBreakdown;
  layerScores?: LayerScores;
  strategy?: string;
  notifiedStopLoss?: boolean;
  trackingMode?: 'active' | 'watch'; // 'active' for short-term, 'watch' for long-term tracking
}

// An alert for a holding based on monitoring rules
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

// A record of a completed trade
export interface TradeHistory {
  id:string;
  ticker: string;
  name: string;
  entryPrice: number;
  sellPrice: number;
  shares: number;
  profit: number;
  sellDate: string;
  analysis?: string; // Optional AI analysis of the trade
  postSellAnalysis?: string; // AI analysis of the sell timing
  // New properties for learning
  initialScore?: number;
  breakdown?: ScoreBreakdown;
  layerScores?: LayerScores;
  strategy?: string;
  trackingMode?: 'active' | 'watch'; // The mode it was in when sold
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