
import React, { useState } from 'react';
import { TradeHistory } from '../types';
import { BrainCircuitIcon, LightbulbIcon, ClockIcon } from './icons';
import { getPostTradeAnalysis } from '../services/geminiService';

interface HistoryProps {
  tradeHistory: TradeHistory[];
  onUpdateAnalysis: (tradeId: string, analysis: string) => void;
  isGeminiConfigured: boolean;
}

export const History: React.FC<HistoryProps> = ({ tradeHistory, onUpdateAnalysis, isGeminiConfigured }) => {
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const handleAnalysis = async (tradeId: string) => {
    if (!isGeminiConfigured) return;

    setAnalyzingId(tradeId);
    const trade = tradeHistory.find(t => t.id === tradeId);
    if (trade) {
      const analysisResult = await getPostTradeAnalysis(trade);
      onUpdateAnalysis(tradeId, analysisResult);
    }
    setAnalyzingId(null);
  };

  return (
    <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6">
      <h2 className="text-2xl font-bold text-white mb-6">交易歷史紀錄</h2>
      {tradeHistory.length > 0 ? (
        <div className="space-y-4">
          {tradeHistory.map(trade => {
            const isProfit = trade.profit >= 0;
            return (
              <div key={trade.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                  <div className="col-span-2 md:col-span-1">
                    <p className="font-bold text-white">{trade.name}</p>
                    <p className="text-sm text-gray-400">{trade.ticker}</p>
                    <p className="text-xs text-gray-500">{trade.sellDate}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-gray-400">均價</p>
                    <p>{trade.entryPrice.toFixed(2)} &rarr; {trade.sellPrice.toFixed(2)}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-gray-400">股數</p>
                    <p>{trade.shares}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-gray-400">損益</p>
                    <p className={`font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                      {isProfit ? '+' : ''}{trade.profit.toFixed(2)}
                    </p>
                  </div>
                  <div className="col-span-2 md:col-span-1 flex justify-end">
                    <button
                      onClick={() => handleAnalysis(trade.id)}
                      disabled={!isGeminiConfigured || !!analyzingId}
                      title={!isGeminiConfigured ? "請先設定 Gemini API Key" : "執行 AI 總結"}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white text-xs font-semibold rounded-md hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                      <BrainCircuitIcon className="w-4 h-4" />
                      {analyzingId === trade.id ? '分析中...' : (trade.analysis ? '重新複盤' : 'AI 總結')}
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-700/60 space-y-3">
                  {trade.analysis && (
                    <div>
                      <h4 className="text-sm font-semibold text-purple-300 mb-2">AI 策略總結</h4>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-900/50 p-3 rounded-md">{trade.analysis}</p>
                    </div>
                  )}

                  {trade.postSellAnalysis ? (
                    <div>
                      <h4 className="text-sm font-semibold text-cyan-300 mb-2 flex items-center">
                        <LightbulbIcon className="w-4 h-4 mr-2" /> 賣出時機複盤
                      </h4>
                      <p className="text-sm text-gray-300 bg-gray-900/50 p-3 rounded-md">{trade.postSellAnalysis}</p>
                    </div>
                  ) : (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 mb-2 flex items-center">
                        <ClockIcon className="w-4 h-4 mr-2" /> 賣出時機複盤
                      </h4>
                       <p className="text-sm text-gray-500 bg-gray-900/50 p-3 rounded-md">等待交易 3 日後，系統將自動分析賣出時機...</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-900/30 rounded-lg">
          <p className="text-gray-400">尚無交易紀錄。</p>
          <p className="text-sm text-gray-500">完成的交易將會顯示在此處。</p>
        </div>
      )}
    </div>
  );
};
