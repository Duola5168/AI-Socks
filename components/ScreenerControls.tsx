import React, { useState, useEffect } from 'react';
import { ScreenerStrategy, StrategyUIName, MarketHealth, AIMarketStrategySuggestion, StockCategory } from '../types';
import { getMarketStrategySuggestion } from '../services/geminiService';
import { GlobeIcon, LightbulbIcon } from './icons';

interface ScreenerControlsProps {
  onSelectStrategy: (strategy: ScreenerStrategy) => void;
  isBusy: boolean;
  marketApiError: string | null;
  marketContext: MarketHealth | null;
  isGeminiConfigured: boolean;
}

const STRATEGIES: { name: StrategyUIName, key: ScreenerStrategy, description: string }[] = [
    { name: '波段突破', key: 'BREAKOUT', description: '尋找從盤整區帶量突破、趨勢可能發動的股票。' },
    { name: '長期投資', key: 'LONG_TERM', description: '篩選財務穩健、高 ROE 且持續發放股利的價值型公司。' },
    { name: '當沖標的', key: 'DAY_TRADE', description: '找出市場成交量大、波動劇烈，適合極短線操作的熱門股。' },
    { name: '價值低估', key: 'VALUE', description: '發掘本益比、股價淨值比偏低，且殖利率高的潛在便宜股。' },
    { name: '成長動能', key: 'GROWTH', description: '鎖定營收年增率高、毛利佳，處於強勁成長週期的公司。' },
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
  isBusy,
  marketApiError,
  marketContext,
  isGeminiConfigured,
}) => {
  const [suggestion, setSuggestion] = useState<AIMarketStrategySuggestion | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetSuggestion = async () => {
    if (!marketContext || !isGeminiConfigured) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await getMarketStrategySuggestion(marketContext);
      setSuggestion(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Auto-run suggestion when marketContext is available
  useEffect(() => {
    if (marketContext && !suggestion && !isAnalyzing && isGeminiConfigured) {
        handleGetSuggestion();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketContext, isGeminiConfigured]);

  return (
    <div className="mb-6 space-y-6">
      <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2"><GlobeIcon className="w-6 h-6 text-cyan-400" /> AI 市場宏觀分析</h3>
        <p className="text-sm text-gray-400">在選股前，先讓 AI 評估當前市場的整體健康度，並建議最適合的宏觀策略，以達到順勢而為、趨吉避凶的效果。</p>

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
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">AI 智慧選股引擎</h3>
          <p className="text-sm text-gray-400">請選擇一種投資策略。系統將對全市場股票進行篩選與 AI 分析，並呈現前 10 名最符合該策略的標的。</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {STRATEGIES.map(strategy => (
            <button
              key={strategy.key}
              onClick={() => onSelectStrategy(strategy.key)}
              disabled={isBusy || !!marketApiError}
              className="p-4 text-center bg-gray-900/70 rounded-lg border-2 border-gray-700 hover:border-cyan-500 hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-700"
              title={strategy.description}
            >
              <p className="font-bold text-white">{strategy.name}</p>
              <p className="text-xs text-gray-400 mt-1">{strategy.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
