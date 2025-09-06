import React, { useState, useEffect, useMemo } from 'react';
import { StrategySettings, AnalysisPanel, GitHubModelInfo, GitHubModelSelection } from '../types';
import * as githubService from '../services/githubService';
import { 
    BrainCircuitIcon, GroqIcon, GitHubIcon, XAiIcon, PuzzlePieceIcon, 
    MicrosoftIcon, MetaIcon, CohereIcon 
} from './icons';
import { IS_GEMINI_CONFIGURED, IS_GROQ_CONFIGURED, IS_GITHUB_CONFIGURED } from '../services/config';
import { useRateLimiter } from '../hooks/useRateLimiter';

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
}

const AnalystIcon: React.FC<{ icon: AnalysisPanel['icon'], className?: string }> = ({ icon, className="w-5 h-5" }) => {
    switch (icon) {
        case 'gemini': return <BrainCircuitIcon className={`${className} text-purple-400`} />;
        case 'groq': return <GroqIcon className={`${className} text-red-400`} />;
        case 'openai': return <GitHubIcon className={className} />; // OpenAI models via GitHub
        case 'microsoft': return <MicrosoftIcon className={className} />;
        case 'meta': return <MetaIcon className={className} />;
        case 'cohere': return <CohereIcon className={className} />;
        case 'xai': return <XAiIcon className={className} />;
        case 'ai21':
        case 'deepseek':
        case 'github':
        default: return <PuzzlePieceIcon className={className} />;
    }
};

const getIconForModel = (modelId: string): AnalysisPanel['icon'] => {
    const lowerId = modelId.toLowerCase();
    if (lowerId.includes('openai')) return 'openai';
    if (lowerId.includes('microsoft')) return 'microsoft';
    if (lowerId.includes('meta') || lowerId.includes('llama')) return 'meta';
    if (lowerId.includes('cohere')) return 'cohere';
    if (lowerId.includes('xai') || lowerId.includes('grok')) return 'xai';
    if (lowerId.includes('ai21')) return 'ai21';
    if (lowerId.includes('deepseek')) return 'deepseek';
    return 'github';
};


const ToggleSwitch: React.FC<{ label: React.ReactNode; icon: React.ReactNode; enabled: boolean; onToggle: (enabled: boolean) => void; disabled?: boolean; tooltip: string }> = ({ label, icon, enabled, onToggle, disabled = false, tooltip }) => (
    <div
        className={`flex items-center justify-between p-3 rounded-md transition-colors ${disabled ? 'bg-gray-800/50 cursor-not-allowed' : 'bg-gray-700/80'}`}
        title={tooltip}
    >
        <div className="flex items-center gap-3">
            {icon}
            <div className={`font-semibold ${disabled ? 'text-gray-500' : 'text-gray-200'}`}>{label}</div>
        </div>
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onToggle(!enabled)}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-50 ${
                enabled ? 'bg-cyan-600' : 'bg-gray-500'
            }`}
        >
            <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
            />
        </button>
    </div>
);

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSettingsChange, onSave, onReset }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [isRefreshingModels, setIsRefreshingModels] = useState(false);
    const [refreshError, setRefreshError] = useState<string | null>(null);
    const { rateLimitStatus } = useRateLimiter();
    
    const { analystPanel } = settings;

    const handleAnalystToggle = (key: string, value: boolean) => {
        onSettingsChange(prev => ({
            ...prev,
            analystPanel: { ...prev.analystPanel, [key]: value }
        }));
    };
    
     const handleModelNameChange = (key: keyof StrategySettings['analystPanel'], value: string) => {
        onSettingsChange(prev => ({
            ...prev,
            analystPanel: { ...prev.analystPanel, [key]: value }
        }));
    };

    const handleRefreshGitHubModels = async () => {
        setIsRefreshingModels(true);
        setRefreshError(null);
        try {
            const models = await githubService.fetchGitHubModelCatalog();
            onSettingsChange(prev => ({
                ...prev,
                analystPanel: {
                    ...prev.analystPanel,
                    githubModelCatalog: models
                }
            }));
        } catch (e: any) {
            setRefreshError(`獲取模型列表失敗: ${e.message}`);
        } finally {
            setIsRefreshingModels(false);
        }
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
    
    const groupedModels = useMemo(() => {
        return analystPanel.githubModelCatalog.reduce((acc, model) => {
            const [provider] = model.id.split('/');
            if (!acc[provider]) {
                acc[provider] = [];
            }
            acc[provider].push(model);
            return acc;
        }, {} as Record<string, GitHubModelInfo[]>);
    }, [analystPanel.githubModelCatalog]);
    
    const handleGitHubModelChange = (provider: string, field: keyof GitHubModelSelection, value: boolean | string) => {
        onSettingsChange(prev => {
            const currentProviderSettings = prev.analystPanel.githubModels[provider] || {
                enabled: false,
                selectedModel: groupedModels[provider]?.[0]?.id || '',
            };
            return {
                ...prev,
                analystPanel: {
                    ...prev.analystPanel,
                    githubModels: {
                        ...prev.analystPanel.githubModels,
                        [provider]: {
                            ...currentProviderSettings,
                            [field]: value,
                        },
                    },
                },
            };
        });
    };
    
    return (
        <div className="space-y-8">
            <header>
                <h2 className="text-2xl font-bold text-white mb-2">AI 分析師設定</h2>
                <p className="text-gray-400">啟用或停用特定的 AI 分析師，並設定其使用的模型。只有被啟用的分析師才會參與「專家小組評比」，這可以幫助您管理 API 用量與成本。</p>
            </header>
            
            <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-6">
                <div className="space-y-4">
                     <h3 className="text-xl font-semibold text-white border-b border-gray-600 pb-3">核心分析師</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-700/80 p-3 rounded-md space-y-2">
                             <ToggleSwitch
                                label={<span>Gemini <span className="text-gray-400 font-normal">(正方)</span></span>}
                                icon={<AnalystIcon icon="gemini" />}
                                enabled={analystPanel.gemini}
                                onToggle={(v) => handleAnalystToggle('gemini', v)}
                                disabled={!IS_GEMINI_CONFIGURED}
                                tooltip={!IS_GEMINI_CONFIGURED ? "請先設定 Gemini API Key" : "主要分析師，不可或缺"}
                            />
                            <select value={analystPanel.geminiModel} onChange={e => handleModelNameChange('geminiModel', e.target.value)}
                                className="w-full bg-gray-600 text-sm p-2 rounded-md border border-gray-500 focus:ring-cyan-500 focus:border-cyan-500" disabled={!IS_GEMINI_CONFIGURED}>
                                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                            </select>
                        </div>
                        <div className="bg-gray-700/80 p-3 rounded-md space-y-2">
                             <ToggleSwitch
                                label={<span>Groq <span className="text-gray-400 font-normal">(反方)</span></span>}
                                icon={<AnalystIcon icon="groq" />}
                                enabled={analystPanel.groq}
                                onToggle={(v) => handleAnalystToggle('groq', v)}
                                disabled={!IS_GROQ_CONFIGURED}
                                tooltip={!IS_GROQ_CONFIGURED ? "請先設定 Groq API Key" : "第二意見分析師"}
                            />
                             <select value={analystPanel.groqPrimaryModel} onChange={e => handleModelNameChange('groqPrimaryModel', e.target.value)}
                                className="w-full bg-gray-600 text-sm p-2 rounded-md border border-gray-500 focus:ring-cyan-500 focus:border-cyan-500" disabled={!IS_GROQ_CONFIGURED}>
                                <option value="llama-3.1-70b-versatile">llama-3.1-70b-versatile</option>
                                <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                             </select>
                             <select value={analystPanel.groqSystemCheckModel} onChange={e => handleModelNameChange('groqSystemCheckModel', e.target.value)}
                                className="w-full bg-gray-600 text-sm p-2 rounded-md border border-gray-500 focus:ring-cyan-500 focus:border-cyan-500" disabled={!IS_GROQ_CONFIGURED}>
                                 <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                                <option value="gemma2-9b-it">gemma2-9b-it</option>
                             </select>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                     <div className="flex justify-between items-center border-b border-gray-600 pb-3">
                         <h3 className="text-xl font-semibold text-white">第三方專家 (透過 GitHub Models)</h3>
                         <button onClick={handleRefreshGitHubModels} disabled={isRefreshingModels || !IS_GITHUB_CONFIGURED} className="px-3 py-1 bg-gray-600 text-xs rounded hover:bg-gray-500 disabled:opacity-50">
                            {isRefreshingModels ? '整理中...' : '重新整理模型列表'}
                         </button>
                     </div>
                     <p className="text-sm text-gray-400">
                        點擊「重新整理模型列表」以從 GitHub 即時獲取您帳號下所有可用的模型。系統會自動追蹤 API 請求次數，當用量達到上限時，對應的分析師將被暫時禁用。
                    </p>
                    {refreshError && <p className="text-red-400 bg-red-900/30 p-2 text-sm rounded-md">{refreshError}</p>}
                    
                    {Object.keys(groupedModels).length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(groupedModels).map(([provider, models]) => {
                                const providerSettings = analystPanel.githubModels[provider] || { enabled: false, selectedModel: models[0]?.id || '' };
                                const isLimited = rateLimitStatus[providerSettings.selectedModel]?.isLimited;
                                
                                return (
                                <div key={provider} className="bg-gray-700/80 p-3 rounded-md space-y-2">
                                    <ToggleSwitch
                                        label={<span className="capitalize">{provider}</span>}
                                        icon={<AnalystIcon icon={getIconForModel(models[0]?.id || 'github')} />}
                                        enabled={providerSettings.enabled}
                                        onToggle={(v) => handleGitHubModelChange(provider, 'enabled', v)}
                                        disabled={isLimited}
                                        tooltip={rateLimitStatus[providerSettings.selectedModel]?.reason || `啟用 ${provider} 分析師`}
                                    />
                                    {providerSettings.enabled && (
                                        <select
                                            value={providerSettings.selectedModel}
                                            onChange={(e) => handleGitHubModelChange(provider, 'selectedModel', e.target.value)}
                                            className="w-full bg-gray-600 text-sm p-2 rounded-md border border-gray-500 focus:ring-cyan-500 focus:border-cyan-500"
                                            disabled={isLimited}
                                        >
                                            {models.map(model => (
                                                <option key={model.id} value={model.id}>{model.id.split('/')[1] || model.id}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 py-4">請點擊「重新整理模型列表」以載入可用的第三方模型。</p>
                    )}
                </div>

                 <div className="flex justify-end gap-3 pt-4 border-t border-gray-600">
                    <button onClick={() => setIsResetConfirmOpen(true)} className="px-4 py-2 bg-gray-600 rounded text-sm hover:bg-gray-500 transition-colors">恢復預設</button>
                    <button onClick={() => setIsSaveConfirmOpen(true)} className="px-6 py-2 bg-cyan-600 rounded text-sm hover:bg-cyan-500 transition-colors">儲存設定</button>
                </div>
            </div>
            
            <ConfirmationModal
                isOpen={isSaveConfirmOpen}
                onClose={() => setIsSaveConfirmOpen(false)}
                onConfirm={handleSaveConfirm}
                title="確認儲存"
                message="您確定要儲存目前的分析師啟用狀態嗎？"
                confirmText="確認儲存"
                confirmColor="bg-cyan-600 hover:bg-cyan-500"
                isLoading={isSaving}
            />
            
            <ConfirmationModal
                isOpen={isResetConfirmOpen}
                onClose={() => setIsResetConfirmOpen(false)}
                onConfirm={handleResetConfirm}
                title="確認重設"
                message="您確定要將所有分析師啟用狀態恢復為預設值嗎？"
                confirmText="確認重設"
                confirmColor="bg-red-600 hover:bg-red-500"
            />
        </div>
    );
};