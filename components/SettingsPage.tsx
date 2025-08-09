import React, { useState, useMemo, useEffect } from 'react';
import { StrategySettings, StockData, TradeHistory, AIStrategyAnalysis } from '../types';
import { getStrategyAnalysis } from '../services/geminiService';
import { getGroqStrategyAnalysis } from '../services/groqService';
import { BrainCircuitIcon, LightbulbIcon, GroqIcon } from './icons';
import { calculateMarketHealth } from '../services/utils';
import { config, IS_GEMINI_CONFIGURED, IS_GROQ_CONFIGURED } from '../services/config';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText: string;
    confirmColor: string;
    isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText, confirmColor, isLoading }) => {
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">{title}</h3>
                <p className="text-gray-300 mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button 
                        type="button"
                        onClick={onClose} 
                        disabled={isLoading}
                        className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 transition-colors disabled:opacity-50">
                        取消
                    </button>
                    <button 
                        type="button"
                        onClick={onConfirm} 
                        disabled={isLoading}
                        className={`px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-wait ${confirmColor}`}>
                        {isLoading ? '處理中...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};


interface SettingsPageProps {
    settings: StrategySettings;
    onSettingsChange: React.Dispatch<React.SetStateAction<StrategySettings>>;
    onSave: () => Promise<void>;
    onReset: () => void;
    allStocks: StockData[];
    tradeHistory: TradeHistory[];
    strategyMode: 'ai' | 'manual';
    onStrategyModeChange: (mode: 'ai' | 'manual') => void;
}

const SettingsInput: React.FC<{label: string, value: number, onChange: (v: number) => void, type?: 'percent' | 'decimal' | 'multiplier' | 'score' | 'shares'}> = ({ label, value, onChange, type = 'score' }) => {
    let displayValue: string | number = value;
    let step = 1;
    if (type === 'percent') {
        displayValue = value;
        step = 1;
    } else if (type === 'decimal') {
        displayValue = value * 100;
        step = 0.1;
    } else if (type === 'multiplier' || type === 'shares') {
        displayValue = value;
        step = type === 'shares' ? 1000 : 0.1;
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let numValue = parseFloat(e.target.value) || 0;
        if (type === 'decimal') {
            numValue = numValue / 100;
        }
        onChange(numValue);
    }
    
    return (
        <div>
            <label className="text-sm text-gray-400 block mb-1">{label}</label>
            <div className="flex items-center">
                <input
                    type="number"
                    value={displayValue}
                    step={step}
                    onChange={handleChange}
                    className="w-full bg-gray-700 text-white p-2 rounded"
                />
                { (type === 'percent' || type === 'decimal') && <span className="ml-2 text-gray-400">%</span>}
                { type === 'multiplier' && <span className="ml-2 text-gray-400">倍</span>}
                { type === 'score' && <span className="ml-2 text-gray-400">分</span>}
                { type === 'shares' && <span className="ml-2 text-gray-400">股</span>}
            </div>
        </div>
    );
}

const AnalysisResultDisplay: React.FC<{
    title: string;
    icon: React.ReactElement<{ className?: string }>;
    analysis: AIStrategyAnalysis;
}> = ({ title, icon, analysis }) => {
    const combinedClassName = ["w-6 h-6", icon.props.className].filter(Boolean).join(' ');

    return (
        <div className="space-y-4 text-sm h-full flex flex-col bg-gray-900/40 p-4 rounded-lg">
            <h4 className="text-lg font-semibold text-gray-200 flex items-center gap-2 border-b border-gray-600 pb-2">
                {React.cloneElement(icon, { className: combinedClassName })}
                {title}
            </h4>
            <div className="p-3 bg-gray-800/50 rounded-lg">
                <h5 className="font-semibold text-purple-300 mb-1">市場前景</h5>
                <p className="text-gray-300">{analysis.marketOutlook}</p>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
                <h5 className="font-semibold text-purple-300 mb-1">策略評析</h5>
                <p className="text-gray-300">{analysis.strategyCritique}</p>
            </div>
            <div>
                <h5 className="font-semibold text-purple-300 mb-2 flex items-center gap-2"><LightbulbIcon className="w-5 h-5"/> 調整建議</h5>
                <div className="space-y-3">
                    {analysis.recommendations.map((rec, index) => (
                        <div key={index} className="p-3 bg-indigo-900/40 rounded-lg border border-indigo-700">
                            <p className="font-bold text-white">{rec.parameter}: <span className="text-red-400">{rec.currentValue}</span> &rarr; <span className="text-green-400">{rec.recommendedValue}</span></p>
                            <p className="text-indigo-300 mt-1">{rec.reason}</p>
                        </div>
                    ))}
                     {analysis.recommendations.length === 0 && (
                        <p className="text-indigo-300 text-center py-2">AI 認為當前設定無需調整。</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSettingsChange, onSave, onReset, allStocks, tradeHistory, strategyMode, onStrategyModeChange }) => {
    const [geminiResult, setGeminiResult] = useState<AIStrategyAnalysis | null>(null);
    const [groqResult, setGroqResult] = useState<AIStrategyAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [geminiError, setGeminiError] = useState<string | null>(null);
    const [groqError, setGroqError] = useState<string | null>(null);

    const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    
    const marketContext = useMemo(() => {
        return calculateMarketHealth(allStocks);
    }, [allStocks]);

    const handleDualAnalysis = async () => {
        setIsLoading(true);
        setGeminiError(null);
        setGroqError(null);
        setGeminiResult(null);
        setGroqResult(null);

        if (!IS_GEMINI_CONFIGURED || !IS_GROQ_CONFIGURED) {
            if (!IS_GEMINI_CONFIGURED) setGeminiError("Gemini API Key 未設定。");
            if (!IS_GROQ_CONFIGURED) setGroqError("Groq API Key 未設定。");
            setIsLoading(false);
            return;
        }

        const [geminiOutcome, groqOutcome] = await Promise.allSettled([
            getStrategyAnalysis(settings, marketContext, tradeHistory),
            getGroqStrategyAnalysis(config.groqApiKey, settings, marketContext, tradeHistory)
        ]);

        if (geminiOutcome.status === 'fulfilled') {
            setGeminiResult(geminiOutcome.value);
        } else {
            console.error("Gemini analysis failed:", geminiOutcome.reason);
            setGeminiError(geminiOutcome.reason?.message || "Gemini 分析時發生未知錯誤。");
        }

        if (groqOutcome.status === 'fulfilled') {
            setGroqResult(groqOutcome.value);
        } else {
            console.error("Groq analysis failed:", groqOutcome.reason);
            setGroqError(groqOutcome.reason?.message || "Groq 分析時發生未知錯誤。");
        }
        
        setIsLoading(false);
    };

    const handleSettingChange = <
        T extends keyof Omit<StrategySettings, 'name'>,
        K extends keyof StrategySettings[T]
    >(
        category: T,
        key: K,
        value: StrategySettings[T][K]
    ) => {
        onSettingsChange(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [key]: value
            }
        }));
    };

    const handleSaveConfirm = async () => {
        setIsSaving(true);
        await onSave();
        setIsSaving(false);
        setIsSaveConfirmOpen(false);
    };

    const handleResetConfirm = () => {
        onReset();
        setIsResetConfirmOpen(false);
    };
    
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">策略設定</h2>
                <p className="text-gray-400">在此調整您的個人化選股與監控策略。所有變更在儲存後將應用於整個平台。</p>
            </div>
            
            <div className="mb-6 p-1 bg-gray-700 rounded-lg flex w-full max-w-md mx-auto">
                <button
                    onClick={() => onStrategyModeChange('ai')}
                    className={`w-1/2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                        strategyMode === 'ai' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-600/50'
                    }`}
                >
                    AI 情境化策略 (預設)
                </button>
                <button
                    onClick={() => onStrategyModeChange('manual')}
                    className={`w-1/2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                        strategyMode === 'manual' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-600/50'
                    }`}
                >
                    手動精細化策略
                </button>
            </div>
            
            <fieldset disabled={strategyMode === 'ai'} className="space-y-8 transition-opacity duration-300 [&:disabled]:opacity-50 [&:disabled]:pointer-events-none">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Settings Form */}
                    <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-cyan-400 border-b border-gray-600 pb-2">篩選權重 (總分100分)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <SettingsInput label="均線多頭排列" value={settings.weights.maUptrend * 100} onChange={v => handleSettingChange('weights', 'maUptrend', v / 100)} />
                                <SettingsInput label="營收成長" value={settings.weights.revenueGrowth * 100} onChange={v => handleSettingChange('weights', 'revenueGrowth', v / 100)} />
                                <SettingsInput label="突破5日線" value={settings.weights.breakout5MA * 100} onChange={v => handleSettingChange('weights', 'breakout5MA', v / 100)} />
                                <SettingsInput label="成交量放大" value={settings.weights.volumeSpike * 100} onChange={v => handleSettingChange('weights', 'volumeSpike', v / 100)} />
                                <SettingsInput label="波動穩定" value={settings.weights.lowVolatility * 100} onChange={v => handleSettingChange('weights', 'lowVolatility', v / 100)} />
                                <SettingsInput label="零股交易熱絡" value={settings.weights.activeOddLotTrading * 100} onChange={v => handleSettingChange('weights', 'activeOddLotTrading', v / 100)} />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">"零股交易熱絡" 權重僅在篩選模式設定為 "零股" 時啟用。</p>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-cyan-400 border-b border-gray-600 pb-2">篩選條件</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <SettingsInput label="最低營收年增" value={settings.screener.minRevenueGrowth} onChange={v => handleSettingChange('screener', 'minRevenueGrowth', v)} type="percent"/>
                                <SettingsInput label="成交量放大倍數" value={settings.screener.volumeMultiplier} onChange={v => handleSettingChange('screener', 'volumeMultiplier', v)} type="multiplier"/>
                                <SettingsInput label="最低綜合評分" value={settings.screener.minScore} onChange={v => handleSettingChange('screener', 'minScore', v)} type="score"/>
                                <SettingsInput label="最低零股成交量" value={settings.screener.minOddLotVolume} onChange={v => handleSettingChange('screener', 'minOddLotVolume', v)} type="shares"/>
                            </div>
                        </div>

                         <div>
                            <h3 className="text-lg font-semibold text-cyan-400 border-b border-gray-600 pb-2">投資組合監控</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <SettingsInput label="停損點" value={settings.portfolio.stopLoss} onChange={v => handleSettingChange('portfolio', 'stopLoss', v)} type="decimal"/>
                                <SettingsInput label="停利點" value={settings.portfolio.takeProfit} onChange={v => handleSettingChange('portfolio', 'takeProfit', v)} type="decimal"/>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 pt-4">
                            <button onClick={() => setIsResetConfirmOpen(true)} className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors">重設為預設值</button>
                            <button onClick={() => setIsSaveConfirmOpen(true)} className="px-6 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-500 transition-colors">儲存設定</button>
                        </div>
                    </div>

                    {/* AI Analysis Section */}
                    <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 flex flex-col">
                        <h3 className="text-lg font-semibold text-purple-400 mb-2">雙 AI 策略適應性分析</h3>
                        <p className="text-sm text-gray-400 mb-4">讓 Gemini 與 Groq 檢視您目前的策略，並根據近期市場狀況與交易歷史的匹配度，提供客觀的優化建議。</p>
                        
                        <div className="grid grid-cols-2 gap-4 mb-6 text-center">
                            <div className="bg-gray-900/50 p-3 rounded-lg">
                                <p className="text-sm text-gray-400">多頭股票佔比</p>
                                <p className="text-2xl font-bold text-white">{marketContext.percentAboveMa20}%</p>
                            </div>
                            <div className="bg-gray-900/50 p-3 rounded-lg">
                                <p className="text-sm text-gray-400">市場平均波動率</p>
                                <p className="text-2xl font-bold text-white">{marketContext.avgVolatility}%</p>
                            </div>
                        </div>

                        <button
                          onClick={handleDualAnalysis}
                          disabled={!IS_GEMINI_CONFIGURED || !IS_GROQ_CONFIGURED || isLoading}
                          className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-lg shadow-lg hover:from-purple-600 hover:to-indigo-600 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-wait"
                          title={!IS_GEMINI_CONFIGURED || !IS_GROQ_CONFIGURED ? "請先設定 Gemini 與 Groq API Keys" : "執行雙 AI 適應性分析"}
                        >
                          {isLoading ? '分析中...' : '執行雙 AI 策略分析'}
                        </button>
                        
                        <div className="mt-6 flex-grow">
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center h-full text-purple-400">
                                    <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="mt-4">正在為您分析策略...</p>
                                </div>
                            )}
                            {(!isLoading && (geminiResult || groqResult || geminiError || groqError)) && (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                   <div>
                                        {geminiResult ? (
                                            <AnalysisResultDisplay title="Gemini AI 分析" icon={<BrainCircuitIcon className="text-purple-400"/>} analysis={geminiResult} />
                                        ) : geminiError && (
                                            <div className="text-center text-red-400 p-4 bg-red-900/50 rounded-lg h-full flex flex-col items-center justify-center">
                                               <h4 className="font-bold mb-2">Gemini 分析失敗</h4>
                                               <p className="text-sm">{geminiError}</p>
                                            </div>
                                        )}
                                   </div>
                                   <div>
                                       {groqResult ? (
                                            <AnalysisResultDisplay title="Groq 第二意見" icon={<GroqIcon className="text-teal-400"/>} analysis={groqResult} />
                                        ) : groqError && (
                                            <div className="text-center text-red-400 p-4 bg-red-900/50 rounded-lg h-full flex flex-col items-center justify-center">
                                                <h4 className="font-bold mb-2">Groq 分析失敗</h4>
                                                <p className="text-sm">{groqError}</p>
                                            </div>
                                        )}
                                   </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </fieldset>

            <ConfirmationModal
                isOpen={isSaveConfirmOpen}
                onClose={() => setIsSaveConfirmOpen(false)}
                onConfirm={handleSaveConfirm}
                title="確認儲存"
                message="您確定要儲存這些策略變更嗎？這將會影響未來的選股和投資組合監控。"
                confirmText="確認儲存"
                confirmColor="bg-cyan-600 hover:bg-cyan-500"
                isLoading={isSaving}
            />

            <ConfirmationModal
                isOpen={isResetConfirmOpen}
                onClose={() => setIsResetConfirmOpen(false)}
                onConfirm={handleResetConfirm}
                title="確認重設"
                message="您確定要將所有策略重設為預設值嗎？此操作無法復原。"
                confirmText="確認重設"
                confirmColor="bg-red-600 hover:bg-red-500"
            />
        </div>
    );
};