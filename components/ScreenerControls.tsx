import React, { useState, useEffect } from 'react';
import { ScreenerStrategy, StrategyUIName, MarketHealth, AIMarketStrategySuggestion, StockCategory, StrategySettings } from '../types';
import { getMarketStrategySuggestion } from '../services/geminiService';
import { GlobeIcon, LightbulbIcon, BrainCircuitIcon } from './icons';

interface ScreenerControlsProps {
  onSelectStrategy: (strategy: ScreenerStrategy, prompt: string) => void;
  onRunDirectAnalysis: (ticker: string) => void;
  isBusy: boolean;
  marketApiError: string | null;
  marketContext: MarketHealth | null;
  isGeminiConfigured: boolean;
  settings: StrategySettings;
}

const LONG_STRATEGIES: { name: StrategyUIName, key: ScreenerStrategy }[] = [
    { name: '波段突破', key: 'BREAKOUT' },
    { name: '長期投資', key: 'LONG_TERM' },
    { name: '當沖標的', key: 'DAY_TRADE' },
    { name: '價值低估', key: 'VALUE' },
    { name: '成長動能', key: 'GROWTH' },
];

const SHORT_STRATEGIES: { name: StrategyUIName, key: ScreenerStrategy }[] = [
    { name: 'M頭反轉', key: 'M_TOP_REVERSAL' },
    { name: '跌破支撐', key: 'SUPPORT_BREAKDOWN' },
    { name: '弱勢動能', key: 'WEAK_MOMENTUM' },
];

const getCategoryClass = (category: StockCategory) => {
    switch (category) {
        case '進攻型': return 'bg-red-500/80 text-white';
        case '穩健型': return 'bg-blue-500/80 text-white';
        case '保守型': return 'bg-green-500/80 text-white';
        default: return 'bg-gray-500/80 text-white';
    }
}

export const ScreenerControls: React.FC<ScreenerControlsProps> = ({
  onSelectStrategy,
  onRunDirectAnalysis,
  isBusy,
  marketApiError,
  marketContext,
  isGeminiConfigured,
  settings
}) => {
  const [suggestion, setSuggestion] = useState<AIMarketStrategySuggestion | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directTicker, setDirectTicker] = useState('');

  const handleGetSuggestion = async () => {
    if (!marketContext || !isGeminiConfigured) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await getMarketStrategySuggestion(settings.analystPanel.geminiModel, marketContext);
      setSuggestion(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (directTicker.trim()) {
        onRunDirectAnalysis(directTicker.trim());
    }
  };
  
  // Auto-run suggestion when marketContext is available
  useEffect(() => {
    if (marketContext && !suggestion && !isAnalyzing && isGeminiConfigured) {
        handleGetSuggestion();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketContext, isGeminiConfigured, settings.analystPanel.geminiModel]);

  return (
    <div className="mb-6 space-y-6">
      <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2"><GlobeIcon className="w-6 h-6 text-cyan-400" /> AI 市場宏觀分析</h3>
        
        {marketContext ? (
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-gray-900/50 p-3 rounded-lg">
              <p className="text-sm text-gray-400">多頭股票佔比</p>
              <p className="text-2xl font-bold text-white">{marketContext.percentAboveMa20}%</p>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-lg">
              <p className="text-sm text-gray-400">市場平均波動率</p>
              <p className="text-2xl font-bold text-white">{marketContext.avgVolatility}%</p>
            </div>
          </div>
        ) : (
            <p className="text-sm text-center text-gray-500">正在等待市場數據載入...</p>
        )}
        
        {isAnalyzing && (
            <div className="flex items-center justify-center p-4">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                AI 分析中...
            </div>
        )}

        {error && <p className="text-sm text-center text-red-400 bg-red-900/30 p-2 rounded-lg">{error}</p>}
        
        {suggestion && (
          <div className="p-4 bg-indigo-900/30 border border-indigo-700 rounded-lg space-y-3 fade-in-up">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-indigo-300 flex items-center gap-2">
                <LightbulbIcon className="w-5 h-5"/> AI 策略建議
              </h4>
              <span className={`px-3 py-1 text-xs font-bold rounded-full ${getCategoryClass(suggestion.suggestedStrategy)}`}>
                {suggestion.suggestedStrategy}
              </span>
            </div>
            <p className="text-gray-300 text-sm">{suggestion.reasoning}</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
        <h3 className="text-lg font-semibold text-white">AI 個股分析</h3>
        <p className="text-sm text-gray-400">直接輸入股票代碼，跳過篩選步驟，立即獲得單一股票的 AI 深度分析報告。</p>
        <form onSubmit={handleDirectSubmit} className="flex flex-col sm:flex-row items-stretch gap-3">
            <input 
                type="text"
                value={directTicker}
                onChange={(e) => setDirectTicker(e.target.value)}
                placeholder="請輸入股票代碼 (例如: 2330)"
                className="flex-1 w-full bg-gray-900/70 text-white p-3 rounded-lg border-2 border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none transition"
                disabled={isBusy}
            />
            <button 
                type="submit" 
                disabled={isBusy || !directTicker.trim()}
                className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-wait transition-colors"
            >
                <BrainCircuitIcon className="w-5 h-5 mr-2" />
                執行分析
            </button>
        </form>
      </div>
      
      <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">AI 智慧選股引擎</h3>
          <p className="text-sm text-gray-400">請選擇一個預設的量化策略來進行快速篩選。</p>
        </div>

        {/* Predefined Strategies */}
        <div className="space-y-4">
            <h4 className="font-semibold text-cyan-300">多方策略 (做多)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {LONG_STRATEGIES.map(strategy => (
                <button
                key={strategy.key}
                onClick={() => onSelectStrategy(strategy.key, settings.prompts[strategy.key])}
                disabled={isBusy || !!marketApiError}
                className="p-4 text-center bg-gray-900/70 rounded-lg border-2 border-gray-700 hover:border-cyan-500 hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-700 flex flex-col justify-between"
                >
                <p className="font-bold text-white text-base mb-2">{strategy.name}</p>
                <p className="text-xs text-gray-400 font-mono bg-gray-800/50 p-2 rounded-md h-full flex items-center justify-center">
                    {settings.prompts[strategy.key]}
                </p>
                </button>
            ))}
            </div>
        </div>

        <div className="space-y-4">
            <h4 className="font-semibold text-red-300">空方策略 (放空)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {SHORT_STRATEGIES.map(strategy => (
                <button
                key={strategy.key}
                onClick={() => onSelectStrategy(strategy.key, settings.prompts[strategy.key])}
                disabled={isBusy || !!marketApiError}
                className="p-4 text-center bg-gray-900/70 rounded-lg border-2 border-gray-700 hover:border-red-500 hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-700 flex flex-col justify-between"
                >
                <p className="font-bold text-white text-base mb-2">{strategy.name}</p>
                 <p className="text-xs text-gray-400 font-mono bg-gray-800/50 p-2 rounded-md h-full flex items-center justify-center">
                    {settings.prompts[strategy.key]}
                </p>
                </button>
            ))}
            </div>
        </div>
      </div>
    </div>
  );
};