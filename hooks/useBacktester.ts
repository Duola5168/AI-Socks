import { useState, useCallback } from 'react';
import { ScreenerStrategy, BacktestResult, AIEvolutionAnalysis, StrategySettings } from '../types';
import * as backtestingService from '../services/backtestingService';
import * as geminiService from '../services/geminiService';
import { IS_GEMINI_CONFIGURED } from '../services/config';

export const useBacktester = (settings: StrategySettings) => { // Accept settings
    const [result, setResult] = useState<BacktestResult | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false); // For original analysis
    const [isEvolving, setIsEvolving] = useState(false); // For new evolution suggestions
    const [progress, setProgress] = useState('');
    const [error, setError] = useState<string | null>(null);

    const runBacktest = useCallback(async (strategy: ScreenerStrategy, period: string) => {
        setIsRunning(true);
        setError(null);
        setResult(null);
        setProgress('初始化回測引擎...');
        
        try {
            const backtestResult = await backtestingService.simulateTrades(strategy, period, setProgress);
            setResult(backtestResult);
        } catch (e: any) {
            setError(`回測失敗: ${e.message}`);
        } finally {
            setIsRunning(false);
            setProgress('');
        }
    }, []);
    
    const getAnalysis = useCallback(async () => {
        if (!result) return;
        if (!IS_GEMINI_CONFIGURED) {
            setError("無法進行分析，請先設定 Gemini API Key。");
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        try {
            const analysisResult = await geminiService.getAIBacktestAnalysis(
                settings.analystPanel.geminiModel,
                result.metrics,
                result.simulatedTrades
            );
            
            const formattedAnalysis = 
`#### 績效總評
${analysisResult.performanceSummary}

#### 策略優點
${analysisResult.strengths.map(s => `- ${s}`).join('\n')}

#### 策略弱點
${analysisResult.weaknesses.map(w => `- ${w}`).join('\n')}

#### 優化建議
${analysisResult.optimizationSuggestions.map(o => `- ${o}`).join('\n')}
`;
            
            setResult(prev => prev ? { ...prev, aiAnalysis: formattedAnalysis } : null);

        } catch (e: any) {
            setError(`AI 分析失敗: ${e.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    }, [result, settings.analystPanel.geminiModel]);

    const getEvolutionSuggestions = useCallback(async (originalPrompt: string) => {
        if (!result) return;
        if (!IS_GEMINI_CONFIGURED) {
            setError("無法進行分析，請先設定 Gemini API Key。");
            return;
        }

        setIsEvolving(true);
        setError(null);
        try {
            const evolutionAnalysis: AIEvolutionAnalysis = await geminiService.getAIEvolutionSuggestions(settings.analystPanel.geminiModel, originalPrompt, result);
            setResult(prev => prev ? { ...prev, evolutionAnalysis } : null);
        } catch (e: any) {
            setError(`AI 策略進化建議失敗: ${e.message}`);
        } finally {
            setIsEvolving(false);
        }
    }, [result, settings.analystPanel.geminiModel]);

    return {
        result,
        isRunning,
        progress,
        error,
        runBacktest,
        getAnalysis,
        isAnalyzing,
        getEvolutionSuggestions,
        isEvolving,
    };
};