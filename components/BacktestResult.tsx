import React, { useState, useRef, useEffect } from 'react';
import { createChart, IChartApi, LineData } from 'lightweight-charts';
import { BacktestResult, SimulatedTrade, ScreenerStrategy, AIEvolutionSuggestion } from '../types';
import { BrainCircuitIcon, SparklesIcon } from './icons';

interface MetricCardProps {
    label: string;
    value: string;
    colorClass: string;
    tooltip: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, colorClass, tooltip }) => (
    <div className="bg-gray-900/50 p-4 rounded-lg text-center" title={tooltip}>
        <p className="text-sm text-gray-400">{label}</p>
        <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
);

const EquityChart: React.FC<{ data: BacktestResult['equityCurve'] }> = ({ data }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartContainerRef.current || data.length === 0) return;

        const chart: IChartApi = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 300,
            layout: { background: { color: '#111827' }, textColor: 'rgba(255, 255, 255, 0.9)' },
            grid: { vertLines: { color: '#374151' }, horzLines: { color: '#374151' } },
            timeScale: { borderColor: '#4b5563' },
        });

        const lineSeries = (chart as any).addLineSeries({
            color: 'rgba(7, 162, 223, 1)',
            lineWidth: 2,
        });
        
        const formattedData: LineData[] = data.map(d => ({
            time: d.time, 
            value: d.value
        }));
        lineSeries.setData(formattedData);
        chart.timeScale().fitContent();

        const handleResize = () => chartContainerRef.current && chart.resize(chartContainerRef.current.clientWidth, 300);
        window.addEventListener('resize', handleResize);
        
        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data]);

    return <div ref={chartContainerRef} className="w-full h-[300px]" />;
};

const EvolutionSuggestionCard: React.FC<{ suggestion: AIEvolutionSuggestion, isApplied: boolean, onApply: () => void }> = ({ suggestion, isApplied, onApply }) => (
    <div className={`p-4 rounded-lg border transition-all ${isApplied ? 'border-green-500 bg-green-900/30' : 'border-gray-700 bg-gray-900/50'}`}>
        <p className="font-mono text-sm text-cyan-300 mb-2">{suggestion.prompt}</p>
        <div className="flex justify-between items-center gap-4">
            <p className="text-xs text-gray-400 flex-1">
                <span className="font-semibold text-purple-300">進化理由：</span>{suggestion.reasoning}
            </p>
            <button
                onClick={onApply}
                disabled={isApplied}
                className="px-3 py-1 text-xs font-semibold rounded-md transition-colors bg-cyan-600 text-white hover:bg-cyan-500 disabled:bg-green-600 disabled:cursor-not-allowed"
            >
                {isApplied ? '已採用' : '採用此建議'}
            </button>
        </div>
    </div>
);


interface BacktestResultDisplayProps {
    result: BacktestResult;
    strategyKey: ScreenerStrategy;
    onGetEvolutionSuggestions: () => void;
    isEvolving: boolean;
    onPromptUpdate: (strategy: ScreenerStrategy, newPrompt: string) => void;
    currentPrompt: string;
}

export const BacktestResultDisplay: React.FC<BacktestResultDisplayProps> = ({ result, strategyKey, onGetEvolutionSuggestions, isEvolving, onPromptUpdate, currentPrompt }) => {
    const { metrics, simulatedTrades, equityCurve, evolutionAnalysis } = result;
    const [showTrades, setShowTrades] = useState(false);

    return (
        <div className="space-y-6">
            <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4">回測績效總覽</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <MetricCard label="總報酬率" value={`${metrics.totalReturn.toFixed(2)}%`} colorClass={metrics.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'} tooltip="整個回測期間的累積報酬率" />
                    <MetricCard label="勝率" value={`${metrics.winRate.toFixed(1)}%`} colorClass="text-cyan-400" tooltip="獲利交易次數佔總交易次數的百分比" />
                    <MetricCard label="盈虧比" value={metrics.profitFactor.toFixed(2)} colorClass="text-purple-400" tooltip="總盈利除以總虧損，越高越好" />
                    <MetricCard label="最大回撤" value={`${metrics.maxDrawdown.toFixed(2)}%`} colorClass="text-yellow-400" tooltip="從資產高峰到低谷的最大跌幅" />
                    <MetricCard label="總交易數" value={metrics.totalTrades.toString()} colorClass="text-gray-300" tooltip="在回測期間的總交易次數" />
                    <MetricCard label="平均報酬" value={`${metrics.avgTradeReturn.toFixed(2)}%`} colorClass={metrics.avgTradeReturn >= 0 ? 'text-green-400' : 'text-red-400'} tooltip="每筆交易的平均報酬率" />
                </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4">資產淨值曲線</h3>
                <EquityChart data={equityCurve} />
            </div>
            
            <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6">
                 <h3 className="text-xl font-bold text-white mb-4">AI 策略進化建議</h3>
                 {evolutionAnalysis ? (
                     <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-gray-300 mb-1">AI 策略批判</h4>
                            <p className="text-sm text-gray-400 bg-gray-900/50 p-3 rounded-md">{evolutionAnalysis.critique}</p>
                        </div>
                        <div>
                             <h4 className="font-semibold text-gray-300 mb-2">進化版策略提示詞</h4>
                             <div className="space-y-3">
                                {evolutionAnalysis.evolvedPrompts.map((suggestion, i) => (
                                    <EvolutionSuggestionCard 
                                      key={i} 
                                      suggestion={suggestion}
                                      isApplied={currentPrompt === suggestion.prompt}
                                      onApply={() => onPromptUpdate(strategyKey, suggestion.prompt)}
                                    />
                                ))}
                             </div>
                        </div>
                     </div>
                 ) : (
                     <button
                        onClick={onGetEvolutionSuggestions}
                        disabled={isEvolving}
                        className="w-full flex items-center justify-center px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-wait transition-colors"
                    >
                         <SparklesIcon className="w-5 h-5 mr-2" />
                         {isEvolving ? '進化中...' : '基於此回測結果，請 AI 提出進化建議'}
                     </button>
                 )}
            </div>
            
            <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6">
                <button onClick={() => setShowTrades(!showTrades)} className="text-lg font-bold text-white mb-4 w-full text-left">
                    模擬交易明細 ({simulatedTrades.length} 筆)
                </button>
                {showTrades && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                                <tr>
                                    <th className="px-4 py-2">股票</th>
                                    <th className="px-4 py-2">進場日期</th>
                                    <th className="px-4 py-2">出場日期</th>
                                    <th className="px-4 py-2">進場價</th>
                                    <th className="px-4 py-2">出場價</th>
                                    <th className="px-4 py-2 text-right">報酬率</th>
                                </tr>
                            </thead>
                            <tbody>
                                {simulatedTrades.map((trade, i) => (
                                    <tr key={i} className="border-b border-gray-700 hover:bg-gray-700/30">
                                        <td className="px-4 py-2 font-medium">{trade.stockName} ({trade.stockId})</td>
                                        <td className="px-4 py-2">{trade.entryDate}</td>
                                        <td className="px-4 py-2">{trade.exitDate}</td>
                                        <td className="px-4 py-2">{trade.entryPrice.toFixed(2)}</td>
                                        <td className="px-4 py-2">{trade.exitPrice.toFixed(2)}</td>
                                        <td className={`px-4 py-2 text-right font-semibold ${trade.returnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {trade.returnPct.toFixed(2)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};