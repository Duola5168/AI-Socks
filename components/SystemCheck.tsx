import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { CheckCircleIcon, XCircleIcon, PuzzlePieceIcon } from './icons';
import { config, IS_FIREBASE_CONFIGURED, IS_GEMINI_CONFIGURED, IS_GROQ_CONFIGURED, IS_NEWS_CONFIGURED, IS_GITHUB_CONFIGURED, IS_SUPABASE_CONFIGURED } from '../services/config';
import * as githubService from '../services/githubService';
import { getLatestTimestamp } from '../services/supabase';
import { StrategySettings } from '../types';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface ServiceStatus {
  status: Status;
  message: string;
}

interface DynamicModelTestResult {
    id: string;
    status: Status;
    message: string;
}

const checkTwseProxy = async (): Promise<string> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
        const response = await fetch('/.netlify/functions/stock-api?source=twse&category=company&endpoint=t187ap03_L', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`代理伺服器回傳 HTTP 錯誤! 狀態: ${response.status}`);
        }
        await response.json();
        return "證交所 API (透過代理) 連接成功。";
    } catch (e: any) {
        console.error("TWSE Proxy check failed:", e);
        if (e.name === 'AbortError') {
            return '連接失敗: 請求超時。';
        }
        return `連接失敗: ${e.message}`;
    }
};

const checkFinMindProxy = async (): Promise<string> => {
  try {
    const response = await fetch(`/.netlify/functions/stock-api?source=finmind&dataset=TaiwanStockInfo`);
    if (!response.ok) throw new Error(`HTTP 錯誤! 狀態: ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    if (result.msg !== 'success') throw new Error(result.msg || "未知的 FinMind API 錯誤");
    return "FinMind API (透過代理) 連接成功。";
  } catch (e: any) {
    console.error("FinMind Proxy check failed:", e);
    return `連接失敗: ${e.message}`;
  }
};

const checkSupabase = async (): Promise<string> => {
    if (!IS_SUPABASE_CONFIGURED) return "Supabase 未設定。";
    try {
        const timestamp = await getLatestTimestamp();
        if (timestamp === null) {
            // This could mean an error OR an empty but connected DB.
            // For a status check, we'll consider it a soft-error/warning.
            return "連接成功，但資料庫可能為空或無法讀取最新時間。";
        }
        return "Supabase 資料庫連接成功。";
    } catch (e: any) {
        console.error("Supabase check failed:", e);
        return `連接失敗: ${e.message}`;
    }
};

const checkGemini = async (): Promise<string> => {
  if (!IS_GEMINI_CONFIGURED) return "Gemini API Key 未設定。";
  try {
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'hello' });
    return "Gemini API 連接成功。";
  } catch (e: any) {
    console.error("Gemini check failed:", e);
     if (e.message.includes('API key not valid')) {
        return "連接失敗: API Key 無效。";
     }
    return `連接失敗: ${e.message}`;
  }
};

const checkGroq = async (model: string): Promise<string> => {
    if (!IS_GROQ_CONFIGURED) return "Groq API Key 未設定。";
    if (!model) return "Groq 系統檢查模型未在設定中指定。";
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.groqApiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: 'hello' }],
                max_tokens: 1,
            }),
        });
        if (!response.ok) {
             const errorData = await response.json();
             throw new Error(errorData.error?.message || `HTTP 錯誤! 狀態: ${response.status}`);
        }
        return "Groq API 連接成功。";
    } catch (e: any) {
        console.error("Groq check failed:", e);
        return `連接失敗: ${e.message}`;
    }
};

const checkNewsApi = async (): Promise<string> => {
    if (!IS_NEWS_CONFIGURED) return "News API Key 未設定。";
    try {
        const urlParams = new URLSearchParams({
            source: 'newsapi',
            q: '台灣',
            language: 'zh',
            pageSize: '1',
        });
        const url = `/.netlify/functions/stock-api?${urlParams.toString()}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP 錯誤 ${response.status}`);
        }

        return "News API (透過代理) 連接成功。";
    } catch (e: any) {
        console.error("News API (Proxy) check failed:", e);
        return `連接失敗: ${e.message}`;
    }
};

const checkGitHubModels = async (): Promise<string> => {
    if (!IS_GITHUB_CONFIGURED) return "GitHub API Key 未在後端設定。"; // This check is mostly for completeness
    try {
        const response = await fetch('/.netlify/functions/stock-api?source=github_models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'openai/gpt-4o-mini', // Use a valid, common model for the connection test
                messages: [{ role: 'user', content: 'hello' }],
                stream: false,
                max_tokens: 1,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || `HTTP 錯誤! 狀態: ${response.status}`;
            // Provide a hint for the common permission error
            if (errorMessage.includes("authentication failed")) {
                return "連接失敗: 認證失敗。請檢查您的 PAT 是否包含 'models: read' 權限。";
            }
            throw new Error(errorMessage);
        }
        await response.json();
        return "GitHub Models API (openai/gpt-4o-mini) 連接成功。";
    } catch (e: any) {
        console.error("GitHub Models check failed:", e);
        return `連接失敗: ${e.message}`;
    }
};


const createServiceStatusFromResult = (message: string): ServiceStatus => ({
    status: message.includes('成功') ? 'success' : 'error',
    message,
});

const StatusIcon: React.FC<{ status: Status }> = ({ status }) => {
    switch (status) {
        case 'loading':
            return <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>;
        case 'success':
            return <CheckCircleIcon className="w-6 h-6 text-green-400" />;
        case 'error':
            return <XCircleIcon className="w-6 h-6 text-red-400" />;
        default:
            return <div className="w-5 h-5 bg-gray-600 rounded-full"></div>;
    }
};


interface StatusRowProps {
    name: string;
    status: Status;
    message: string;
    onReset?: () => void;
}

const StatusRow: React.FC<StatusRowProps> = ({ name, status, message, onReset }) => {
    return (
        <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg min-h-[56px]">
            <span className="font-semibold text-gray-300">{name}</span>
            <div className="flex items-center gap-2 text-sm text-right">
                {status === 'error' && onReset && (
                    <button
                        onClick={onReset}
                        className="text-xs text-gray-400 hover:text-white hover:bg-gray-700 px-2 py-1 rounded-md transition-colors"
                        title="恢復預設狀態"
                    >
                        恢復預設
                    </button>
                )}
                <StatusIcon status={status} />
                <span className={`min-w-0 break-words ${status === 'error' ? 'text-red-300' : 'text-gray-400'}`}>{message}</span>
            </div>
        </div>
    );
};

interface SystemCheckProps {
    settings: StrategySettings;
    isFirebaseConfigured: boolean;
    isSupabaseConfigured: boolean;
    isUserLoggedIn: boolean;
}


export const SystemCheck: React.FC<SystemCheckProps> = ({ settings, isFirebaseConfigured, isSupabaseConfigured, isUserLoggedIn }) => {
    const getInitialStatus = (name: string, isConfigured: boolean): ServiceStatus => ({
      status: isConfigured ? 'idle' : 'error',
      message: isConfigured ? '等待檢查' : `${name} 未設定`
    });

    const [statuses, setStatuses] = useState({
        supabase: getInitialStatus('Supabase', isSupabaseConfigured),
        twse: { status: 'idle', message: '等待檢查' } as ServiceStatus,
        finmind: { status: 'idle', message: '等待檢查' } as ServiceStatus,
        gemini: getInitialStatus('Gemini', IS_GEMINI_CONFIGURED),
        groq: getInitialStatus('Groq', IS_GROQ_CONFIGURED),
        news: getInitialStatus('News', IS_NEWS_CONFIGURED),
        github: getInitialStatus('GitHub', IS_GITHUB_CONFIGURED),
    });
    const [isChecking, setIsChecking] = useState(false);
    
    const [dynamicTestLog, setDynamicTestLog] = useState<string[]>([]);
    const [modelTestResults, setModelTestResults] = useState<DynamicModelTestResult[]>([]);
    const [isTestingModels, setIsTestingModels] = useState(false);

    const handleResetStatus = useCallback((serviceKey: keyof typeof statuses) => {
        setStatuses(prev => {
            const newStatuses = { ...prev };
            switch (serviceKey) {
                case 'supabase': newStatuses.supabase = getInitialStatus('Supabase', isSupabaseConfigured); break;
                case 'twse': newStatuses.twse = { status: 'idle', message: '等待檢查' }; break;
                case 'finmind': newStatuses.finmind = { status: 'idle', message: '等待檢查' }; break;
                case 'gemini': newStatuses.gemini = getInitialStatus('Gemini', IS_GEMINI_CONFIGURED); break;
                case 'groq': newStatuses.groq = getInitialStatus('Groq', IS_GROQ_CONFIGURED); break;
                case 'news': newStatuses.news = getInitialStatus('News', IS_NEWS_CONFIGURED); break;
                case 'github': newStatuses.github = getInitialStatus('GitHub', IS_GITHUB_CONFIGURED); break;
            }
            return newStatuses;
        });
    }, [isSupabaseConfigured]);

    const handleRunChecks = useCallback(async () => {
        if (isChecking) return;
        setIsChecking(true);
        const createLoadingStatus = (isConfigured: boolean, currentMessage: string): ServiceStatus => ({
            status: isConfigured ? 'loading' : 'error',
            message: isConfigured ? '檢查中...' : currentMessage
        });
        
        setStatuses(prev => ({
            supabase: createLoadingStatus(isSupabaseConfigured, prev.supabase.message),
            twse: { status: 'loading', message: '檢查中...' },
            finmind: { status: 'loading', message: '檢查中...' },
            gemini: createLoadingStatus(IS_GEMINI_CONFIGURED, prev.gemini.message),
            groq: createLoadingStatus(IS_GROQ_CONFIGURED, prev.groq.message),
            news: createLoadingStatus(IS_NEWS_CONFIGURED, prev.news.message),
            github: createLoadingStatus(IS_GITHUB_CONFIGURED, prev.github.message),
        }));

        const [supabaseResult, twseResult, finmindResult, geminiResult, groqResult, newsResult, githubResult] = await Promise.all([
            checkSupabase(),
            checkTwseProxy(),
            checkFinMindProxy(),
            checkGemini(),
            checkGroq(settings.analystPanel.groqSystemCheckModel as string),
            checkNewsApi(),
            checkGitHubModels(),
        ]);

        setStatuses({
            supabase: createServiceStatusFromResult(supabaseResult),
            twse: createServiceStatusFromResult(twseResult),
            finmind: createServiceStatusFromResult(finmindResult),
            gemini: createServiceStatusFromResult(geminiResult),
            groq: createServiceStatusFromResult(groqResult),
            news: createServiceStatusFromResult(newsResult),
            github: createServiceStatusFromResult(githubResult),
        });
        setIsChecking(false);
    }, [isChecking, isSupabaseConfigured, settings.analystPanel.groqSystemCheckModel]);

    const handleDynamicModelTest = async () => {
        if (!IS_GITHUB_CONFIGURED) {
            setDynamicTestLog(["GitHub API Key 未在後端設定。"]);
            return;
        }

        setIsTestingModels(true);
        setDynamicTestLog([]);
        setModelTestResults([]);
        
        const addLog = (msg: string) => setDynamicTestLog(prev => [...prev, msg]);

        try {
            addLog("🔄 正在從目錄獲取可用的模型列表...");
            const catalog = await githubService.fetchGitHubModelCatalog();
            
            if (!catalog || catalog.length === 0) {
                addLog("❌ 未找到任何可用模型。請檢查您的 PAT 權限是否包含 'models: read'。");
                setIsTestingModels(false);
                return;
            }

            addLog(`✅ 成功獲取目錄，找到 ${catalog.length} 個模型。`);
            
            const initialResults = catalog.map(model => ({
                id: model.id,
                status: 'idle' as Status,
                message: '等待測試'
            }));
            setModelTestResults(initialResults);
    
            const testPrompt: { role: 'user' | 'system'; content: string }[] = [{ role: 'user', content: `請回覆 "模型 MODEL_ID 正常運作"` }];
    
            for (let i = 0; i < catalog.length; i++) {
                const model = catalog[i];
                
                setModelTestResults(prev => prev.map(r => r.id === model.id ? { ...r, status: 'loading', message: '測試中...' } : r));
    
                try {
                    const promptWithId = testPrompt.map(p => ({...p, content: p.content.replace('MODEL_ID', model.id)}));
                    const response = await githubService.getGitHubModelTestResponse(model.id, promptWithId);
                    setModelTestResults(prev => prev.map(r => r.id === model.id ? { ...r, status: 'success', message: response } : r));
                } catch (error: any) {
                    setModelTestResults(prev => prev.map(r => r.id === model.id ? { ...r, status: 'error', message: error.message } : r));
                }
                
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            addLog("🏁 所有模型測試完成。");
    
        } catch (error: any) {
            addLog(`💥 獲取模型目錄時發生嚴重錯誤: ${error.message}`);
        } finally {
            setIsTestingModels(false);
        }
    };

    const firebaseStatus: Status = isFirebaseConfigured ? (isUserLoggedIn ? 'success' : 'error') : 'error';
    const firebaseMessage = isFirebaseConfigured ? (isUserLoggedIn ? '已登入並同步' : '未登入，資料僅儲存於本機') : 'Firebase 未設定';

    return (
    <>
        <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-cyan-400 border-b border-gray-600 pb-2">系統與服務狀態</h3>
            <p className="text-sm text-gray-400">
                點擊下方按鈕以檢測所有外部服務的連線狀態。
            </p>
            <div className="space-y-3">
                 <StatusRow name="Firebase 雲端同步" status={firebaseStatus} message={firebaseMessage} />
                 <StatusRow name="Supabase 核心數據庫" status={statuses.supabase.status} message={statuses.supabase.message} onReset={() => handleResetStatus('supabase')} />
                 <StatusRow name="證交所Open API" status={statuses.twse.status} message={statuses.twse.message} onReset={() => handleResetStatus('twse')} />
                 <StatusRow name="FinMind 股市數據" status={statuses.finmind.status} message={statuses.finmind.message} onReset={() => handleResetStatus('finmind')} />
                 <StatusRow name="News API 新聞輿情" status={statuses.news.status} message={statuses.news.message} onReset={() => handleResetStatus('news')} />
                 <StatusRow name="Gemini AI 分析" status={statuses.gemini.status} message={statuses.gemini.message} onReset={() => handleResetStatus('gemini')} />
                 <StatusRow name="Groq AI 分析" status={statuses.groq.status} message={statuses.groq.message} onReset={() => handleResetStatus('groq')} />
                 <StatusRow name="GitHub Models API" status={statuses.github.status} message={statuses.github.message} onReset={() => handleResetStatus('github')} />
            </div>
            <div className="pt-2">
                 <button
                    onClick={handleRunChecks}
                    disabled={isChecking}
                    className="w-full px-6 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-wait"
                 >
                    {isChecking ? '正在執行檢測...' : '重新檢測連線狀態'}
                </button>
            </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-cyan-400 border-b border-gray-600 pb-2">GitHub Models 可用性動態測試</h3>
            <p className="text-sm text-gray-400">
                此功能會自動從 GitHub 官方 API 獲取您帳號所有可用的模型清單，然後逐一發送請求以驗證其可用性。這有助於確認您的 PAT (個人存取權杖) 設定正確且具備 `models: read` 權限。
            </p>
            <div className="pt-2">
                <button
                    onClick={handleDynamicModelTest}
                    disabled={isTestingModels || !IS_GITHUB_CONFIGURED}
                    title={!IS_GITHUB_CONFIGURED ? "請先設定 GitHub API Key" : "執行可用性測試"}
                    className="w-full px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                    {isTestingModels ? '測試中...' : '執行可用性動態測試'}
                </button>
            </div>

            {(dynamicTestLog.length > 0 || modelTestResults.length > 0) && (
                <div className="mt-4 space-y-3 max-h-[40rem] overflow-y-auto">
                    {dynamicTestLog.length > 0 && (
                        <div className="p-3 bg-gray-900/50 rounded-lg">
                            <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono bg-gray-900 p-2 rounded-md">
                                {dynamicTestLog.join('\n')}
                            </pre>
                        </div>
                    )}
                    {modelTestResults.map((result) => (
                        <div key={result.id} className="p-3 bg-gray-900/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-gray-300">{result.id}</span>
                                <StatusIcon status={result.status} />
                            </div>
                            <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono bg-gray-900 p-2 rounded-md max-h-40 overflow-y-auto">
                                {result.message}
                            </pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </>
    );
};