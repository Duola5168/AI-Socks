import React, { useState } from 'react';
import { ScreenerStrategy, StrategyUIName, BacktestResult, StrategySettings } from '../types';
import { useBacktester } from '../hooks/useBacktester';
import { ChartBarSquareIcon, LightbulbIcon } from './icons';
import { BacktestResultDisplay } from './BacktestResult';

const ALL_STRATEGIES: { name: StrategyUIName, key: ScreenerStrategy }[] = [
    { name: '波段突破', key: 'BREAKOUT' },
    { name: '長期投資', key: 'LONG_TERM' },
    { name: '當沖標的', key: 'DAY_TRADE' },
    { name: '價值低估', key: 'VALUE' },
    { name: '成長動能', key: 'GROWTH' },
    { name: 'M頭反轉', key: 'M_TOP_REVERSAL' },
    { name: '跌破支撐', key: 'SUPPORT_BREAKDOWN' },
    { name: '弱勢動能', key: 'WEAK_MOMENTUM' },
];

interface BacktesterPageProps {
    settings: StrategySettings;
    onPromptUpdate: (strategy: ScreenerStrategy, newPrompt: string) => void;
}

export const BacktesterPage: React.FC<BacktesterPageProps> = ({ settings, onPromptUpdate }) => {
    const [selectedStrategy, setSelectedStrategy] = useState<ScreenerStrategy>('BREAKOUT');
    const [dateRange, setDateRange] = useState('past_year');
    const { result, isRunning, progress, error, runBacktest, getEvolutionSuggestions, isEvolving } = useBacktester(settings);

    const handleRunBacktest = () => {
        runBacktest(selectedStrategy, dateRange);
    };
    
    const handleGetEvolution = () => {
        const originalPrompt = settings.prompts[selectedStrategy];
        getEvolutionSuggestions(originalPrompt);
    };

    return (
        <div className="space-y-6 fade-in-up">
            <header>
                <h2 className="text-2xl font-bold text-white mb-2">AI 策略回測中心</h2>
                <p className="text-gray-400">在這裡，您可以選擇一個策略和歷史時間段，來模擬該策略的歷史表現，並透過 AI 深入分析其優缺點。</p>
            </header>

            <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label htmlFor="strategy-select" className="block text-sm font-medium text-gray-300 mb-1">選擇策略</label>
                        <select
                            id="strategy-select"
                            value={selectedStrategy}
                            onChange={(e) => setSelectedStrategy(e.target.value as ScreenerStrategy)}
                            disabled={isRunning}
                            className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring-2 focus:ring-cyan-500"
                        >
                            {ALL_STRATEGIES.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="daterange-select" className="block text-sm font-medium text-gray-300 mb-1">選擇回測期間</label>
                        <select
                            id="daterange-select"
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            disabled={isRunning}
                            className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="past_year">過去一年 (牛市)</option>
                            <option value="2022">2022年 (熊市)</option>
                            <option value="2021">2021年 (大多頭)</option>
                        </select>
                    </div>
                    <button
                        onClick={handleRunBacktest}
                        disabled={isRunning}
                        className="w-full flex items-center justify-center px-4 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-wait transition-colors"
                    >
                        <ChartBarSquareIcon className="w-5 h-5 mr-2" />
                        {isRunning ? '回測中...' : '開始回測'}
                    </button>
                </div>
            </div>

            {isRunning && (
                <div className="text-center p-8 bg-gray-800/30 rounded-lg">
                    <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-cyan-300 font-semibold">正在模擬交易，請稍候...</p>
                    <p className="text-gray-400 text-sm mt-2">{progress}</p>
                </div>
            )}
            
            {error && <p className="text-red-400 text-center bg-red-900/30 p-3 rounded-lg">{error}</p>}

            {result ? (
                <BacktestResultDisplay
                    result={result}
                    strategyKey={selectedStrategy}
                    onGetEvolutionSuggestions={handleGetEvolution}
                    isEvolving={isEvolving}
                    onPromptUpdate={onPromptUpdate}
                    currentPrompt={settings.prompts[selectedStrategy]}
                />
            ) : (
                 !isRunning && !error &&
                <div className="text-center p-8 bg-gray-800/30 rounded-lg">
                    <p className="text-gray-400">選擇策略和期間後，點擊「開始回測」以查看績效報告。</p>
                </div>
            )}

            <div className="bg-yellow-900/20 border border-yellow-800/50 text-yellow-300 px-4 py-3 rounded-lg flex items-start gap-3 mt-8">
                <LightbulbIcon className="w-6 h-6 mt-0.5 shrink-0 text-yellow-400" />
                <p className="text-sm">
                    <strong>開發者提示：</strong>目前回測功能為前端展示版本，使用預設的模擬數據。完整的歷史數據庫與逐日回測引擎將在後續版本中實現。
                </p>
            </div>
        </div>
    );
};