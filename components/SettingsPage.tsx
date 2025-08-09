import React, { useState, useEffect } from 'react';
import { StrategySettings } from '../types';
import { BrainCircuitIcon, GroqIcon, GitHubIcon, XAiIcon } from './icons';
import { config, IS_GEMINI_CONFIGURED, IS_GROQ_CONFIGURED, IS_GITHUB_CONFIGURED } from '../services/config';
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

const ToggleSwitch: React.FC<{ label: string; icon: React.ReactNode; enabled: boolean; onToggle: (enabled: boolean) => void; disabled?: boolean; tooltip: string }> = ({ label, icon, enabled, onToggle, disabled = false, tooltip }) => (
    <div
        className={`flex items-center justify-between p-3 rounded-md transition-colors ${disabled ? 'bg-gray-800/50' : 'bg-gray-700/80'}`}
        title={tooltip}
    >
        <div className="flex items-center gap-2">
            {icon}
            <span className={`font-semibold ${disabled ? 'text-gray-500' : 'text-gray-200'}`}>{label}</span>
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
    const { rateLimitStatus } = useRateLimiter();

    const handleSettingChange = (
        key: keyof StrategySettings['analystPanel'],
        value: boolean
    ) => {
        onSettingsChange(prev => ({
            ...prev,
            analystPanel: {
                ...prev.analystPanel,
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
            <header>
                <h2 className="text-2xl font-bold text-white mb-2">AI 分析師設定</h2>
                <p className="text-gray-400">啟用或停用特定的 AI 分析師。只有被啟用的分析師才會參與「專家小組評比」，這可以幫助您管理 API 用量與成本。</p>
            </header>
            
            <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-6">
                <h3 className="text-xl font-semibold text-white border-b border-gray-600 pb-3">AI 專家小組成員</h3>
                 <p className="text-sm text-gray-400">
                    系統會自動追蹤 API 請求次數，當用量達到上限時，對應的分析師將被暫時禁用以保護您的帳戶。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <ToggleSwitch
                        label="Gemini"
                        icon={<BrainCircuitIcon className="w-5 h-5 text-purple-400" />}
                        enabled={settings.analystPanel.gemini}
                        onToggle={(v) => handleSettingChange('gemini', v)}
                        disabled={!IS_GEMINI_CONFIGURED}
                        tooltip={!IS_GEMINI_CONFIGURED ? "請先設定 Gemini API Key" : "主要分析師"}
                    />
                     <ToggleSwitch
                        label="Groq"
                        icon={<GroqIcon className="w-5 h-5 text-red-400" />}
                        enabled={settings.analystPanel.groq}
                        onToggle={(v) => handleSettingChange('groq', v)}
                        disabled={!IS_GROQ_CONFIGURED}
                        tooltip={!IS_GROQ_CONFIGURED ? "請先設定 Groq API Key" : "第二意見分析師"}
                    />
                     <ToggleSwitch
                        label="GitHub (Copilot)"
                        icon={<GitHubIcon className="w-5 h-5" />}
                        enabled={settings.analystPanel.github_copilot}
                        onToggle={(v) => handleSettingChange('github_copilot', v)}
                        disabled={!IS_GITHUB_CONFIGURED || rateLimitStatus.github_copilot?.isLimited}
                        tooltip={!IS_GITHUB_CONFIGURED ? "請先設定 GitHub API Key" : rateLimitStatus.github_copilot?.reason || ""}
                    />
                     <ToggleSwitch
                        label="GitHub (OpenAI)"
                        icon={<GitHubIcon className="w-5 h-5" />}
                        enabled={settings.analystPanel.github_openai}
                        onToggle={(v) => handleSettingChange('github_openai', v)}
                        disabled={!IS_GITHUB_CONFIGURED || rateLimitStatus.github_openai?.isLimited}
                        tooltip={!IS_GITHUB_CONFIGURED ? "請先設定 GitHub API Key" : rateLimitStatus.github_openai?.reason || ""}
                    />
                     <ToggleSwitch
                        label="GitHub (DeepSeek)"
                        icon={<GitHubIcon className="w-5 h-5" />}
                        enabled={settings.analystPanel.github_deepseek}
                        onToggle={(v) => handleSettingChange('github_deepseek', v)}
                        disabled={!IS_GITHUB_CONFIGURED || rateLimitStatus.github_deepseek?.isLimited}
                        tooltip={!IS_GITHUB_CONFIGURED ? "請先設定 GitHub API Key" : rateLimitStatus.github_deepseek?.reason || ""}
                    />
                    <ToggleSwitch
                        label="xAI (Grok)"
                        icon={<XAiIcon className="w-5 h-5" />}
                        enabled={settings.analystPanel.github_xai}
                        onToggle={(v) => handleSettingChange('github_xai', v)}
                        disabled={!IS_GITHUB_CONFIGURED || rateLimitStatus.github_xai?.isLimited}
                        tooltip={!IS_GITHUB_CONFIGURED ? "請先設定 GitHub API Key" : rateLimitStatus.github_xai?.reason || ""}
                    />
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