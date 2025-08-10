

import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { CheckCircleIcon, XCircleIcon, PuzzlePieceIcon } from './icons';
import { config, IS_FIREBASE_CONFIGURED, IS_GEMINI_CONFIGURED, IS_GROQ_CONFIGURED, IS_NEWS_CONFIGURED, IS_GITHUB_CONFIGURED } from '../services/config';
import * as githubService from '../services/githubService';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface ServiceStatus {
  status: Status;
  message: string;
}

interface ModelTestResult {
    status: Status;
    response: string;
}

const checkTwseProxy = async (): Promise<string> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
        const response = await fetch('/.netlify/functions/stock-api?source=twse&endpoint=t187ap03_L', { signal: controller.signal });
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

const checkGroq = async (): Promise<string> => {
    if (!IS_GROQ_CONFIGURED) return "Groq API Key 未設定。";
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.groqApiKey}`,
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
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

const checkGoodinfoCrawler = async (): Promise<string> => {
  try {
    const response = await fetch('/.netlify/functions/stock-api?source=goodinfo');
    if (!response.ok) throw new Error(`HTTP 錯誤! 狀態: ${response.status}`);
    const result = await response.json();
    if (result.status !== 'ok') throw new Error(result.message || "未知的 Goodinfo 爬蟲錯誤");
    return result.message;
  } catch (e: any) {
    console.error("Goodinfo Crawler check failed:", e);
    return `連接失敗: ${e.message}`;
  }
};

const checkMopsCrawler = async (): Promise<string> => {
  try {
    const response = await fetch('/.netlify/functions/stock-api?source=mops');
    if (!response.ok) throw new Error(`HTTP 錯誤! 狀態: ${response.status}`);
    const result = await response.json();
    if (result.status !== 'ok') throw new Error(result.message || "未知的 MOPS 爬蟲錯誤");
    return result.message;
  } catch (e: any) {
    console.error("MOPS Crawler check failed:", e);
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
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'hello' }],
                stream: false,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP 錯誤! 狀態: ${response.status}`);
        }
        await response.json();
        return "GitHub Models API (gpt-4o-mini) 連接成功。";
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


const StatusRow: React.FC<{ name: string; status: Status; message: string }> = ({ name, status, message }) => {
    return (
        <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
            <span className="font-semibold text-gray-300">{name}</span>
            <div className="flex items-center gap-2 text-sm text-right">
                <StatusIcon status={status} />
                <span className={`min-w-0 break-words ${status === 'error' ? 'text-red-300' : 'text-gray-400'}`}>{message}</span>
            </div>
        </div>
    );
};

export const SystemCheck: React.FC<{ isFirebaseConfigured: boolean; isUserLoggedIn: boolean }> = ({ isFirebaseConfigured, isUserLoggedIn }) => {
    const getInitialStatus = (name: string, isConfigured: boolean): ServiceStatus => ({
      status: isConfigured ? 'idle' : 'error',
      message: isConfigured ? '等待檢查' : `${name} API Key 未設定`
    });

    const [statuses, setStatuses] = useState({
        twse: { status: 'idle', message: '等待檢查' } as ServiceStatus,
        finmind: { status: 'idle', message: '等待檢查' } as ServiceStatus,
        goodinfo: { status: 'idle', message: '等待檢查' } as ServiceStatus,
        mops: { status: 'idle', message: '等待檢查' } as ServiceStatus,
        gemini: getInitialStatus('Gemini', IS_GEMINI_CONFIGURED),
        groq: getInitialStatus('Groq', IS_GROQ_CONFIGURED),
        news: getInitialStatus('News', IS_NEWS_CONFIGURED),
        github: getInitialStatus('GitHub', IS_GITHUB_CONFIGURED),
    });
    const [isChecking, setIsChecking] = useState(false);
    
    const [modelTestResults, setModelTestResults] = useState<Record<string, ModelTestResult>>({});
    const [isTestingModels, setIsTestingModels] = useState(false);


    const handleRunChecks = async () => {
        setIsChecking(true);
        const createLoadingStatus = (isConfigured: boolean, currentMessage: string): ServiceStatus => ({
            status: isConfigured ? 'loading' : 'error',
            message: isConfigured ? '檢查中...' : currentMessage
        });
        
        setStatuses(prev => ({
            twse: { status: 'loading', message: '檢查中...' },
            finmind: { status: 'loading', message: '檢查中...' },
            goodinfo: { status: 'loading', message: '檢查中...' },
            mops: { status: 'loading', message: '檢查中...' },
            gemini: createLoadingStatus(IS_GEMINI_CONFIGURED, prev.gemini.message),
            groq: createLoadingStatus(IS_GROQ_CONFIGURED, prev.groq.message),
            news: createLoadingStatus(IS_NEWS_CONFIGURED, prev.news.message),
            github: createLoadingStatus(IS_GITHUB_CONFIGURED, prev.github.message),
        }));

        const [twseResult, finmindResult, geminiResult, groqResult, newsResult, goodinfoResult, mopsResult, githubResult] = await Promise.all([
            checkTwseProxy(),
            checkFinMindProxy(),
            checkGemini(),
            checkGroq(),
            checkNewsApi(),
            checkGoodinfoCrawler(),
            checkMopsCrawler(),
            checkGitHubModels(),
        ]);

        setStatuses({
            twse: createServiceStatusFromResult(twseResult),
            finmind: createServiceStatusFromResult(finmindResult),
            gemini: createServiceStatusFromResult(geminiResult),
            groq: createServiceStatusFromResult(groqResult),
            news: createServiceStatusFromResult(newsResult),
            goodinfo: createServiceStatusFromResult(goodinfoResult),
            mops: createServiceStatusFromResult(mopsResult),
            github: createServiceStatusFromResult(githubResult),
        });
        setIsChecking(false);
    };

    const handleModelResponseTest = async () => {
        if (!IS_GITHUB_CONFIGURED) {
            setModelTestResults({ 'GitHub Models': { status: 'error', response: 'GitHub API Key 未在後端設定。' } });
            return;
        }

        setIsTestingModels(true);
        const modelsToTest = [
            { id: 'gpt-4o-mini', name: 'GitHub (Copilot)' },
            { id: 'gpt-4o', name: 'GitHub (OpenAI)' },
            { id: 'DeepSeek-R1', name: 'GitHub (DeepSeek)' },
            { id: 'grok-3', name: 'xAI (Grok)' },
        ];
        
        const initialResults: Record<string, ModelTestResult> = {};
        modelsToTest.forEach(m => {
            initialResults[m.name] = { status: 'loading', response: '正在請求...' };
        });
        setModelTestResults(initialResults);
        
        const testPrompt: { role: 'user' | 'system', content: string }[] = [{ role: 'user', content: '你是由哪個組織或公司訓練的？' }];

        const results = await Promise.allSettled(
            modelsToTest.map(model => 
                githubService.getGitHubModelTestResponse(model.id, testPrompt)
            )
        );

        const finalResults: Record<string, ModelTestResult> = {};
        results.forEach((res, index) => {
            const modelName = modelsToTest[index].name;
            if (res.status === 'fulfilled') {
                finalResults[modelName] = { status: 'success', response: res.value };
            } else {
                finalResults[modelName] = { status: 'error', response: res.reason.message };
            }
        });
        
        setModelTestResults(finalResults);
        setIsTestingModels(false);
    };

    const firebaseStatus: Status = isFirebaseConfigured ? (isUserLoggedIn ? 'success' : 'error') : 'error';
    const firebaseMessage = isFirebaseConfigured ? (isUserLoggedIn ? '已登入並同步' : '未登入，資料僅儲存於本機') : 'Firebase 未設定';

    return (
    <>
        <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-cyan-400 border-b border-gray-600 pb-2">系統與服務狀態</h3>
            <p className="text-sm text-gray-400">
                執行主動檢測，以確認所有外部服務 (數據源、AI模型、爬蟲) 的 API 金鑰是否有效且網路連線正常。
            </p>
            <div className="space-y-3">
                 <StatusRow name="Firebase 雲端同步" status={firebaseStatus} message={firebaseMessage} />
                 <StatusRow name="證交所Open API" status={statuses.twse.status} message={statuses.twse.message} />
                 <StatusRow name="FinMind 股市數據" status={statuses.finmind.status} message={statuses.finmind.message} />
                 <StatusRow name="News API 新聞輿情" status={statuses.news.status} message={statuses.news.message} />
                 <StatusRow name="Goodinfo 股市數據" status={statuses.goodinfo.status} message={statuses.goodinfo.message} />
                 <StatusRow name="MOPS 股市數據" status={statuses.mops.status} message={statuses.mops.message} />
                 <StatusRow name="Gemini AI 分析" status={statuses.gemini.status} message={statuses.gemini.message} />
                 <StatusRow name="Groq AI 分析" status={statuses.groq.status} message={statuses.groq.message} />
                 <StatusRow name="GitHub Models API" status={statuses.github.status} message={statuses.github.message} />
            </div>
            <div className="pt-2">
                 <button
                    onClick={handleRunChecks}
                    disabled={isChecking}
                    className="w-full px-6 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-wait"
                 >
                    {isChecking ? '正在執行檢測...' : '執行全部連線檢測'}
                </button>
            </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-cyan-400 border-b border-gray-600 pb-2">AI 分析師模型回應測試</h3>
            <p className="text-sm text-gray-400">
                驗證 GitHub Models API 是否能正確地將請求路由到指定的底層模型。點擊按鈕後，系統會向每個模型發送一個相同的問題，並顯示其獨特的回應。
            </p>
            <div className="pt-2">
                <button
                    onClick={handleModelResponseTest}
                    disabled={isTestingModels || !IS_GITHUB_CONFIGURED}
                    title={!IS_GITHUB_CONFIGURED ? "請先設定 GitHub API Key" : "執行模型指紋測試"}
                    className="w-full px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                    {isTestingModels ? '測試中...' : '執行模型指紋測試'}
                </button>
            </div>

            {Object.keys(modelTestResults).length > 0 && (
                <div className="mt-4 space-y-3">
                    {Object.entries(modelTestResults).map(([modelName, result]) => (
                        <div key={modelName} className="p-3 bg-gray-900/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-gray-300">{modelName}</span>
                                <StatusIcon status={result.status} />
                            </div>
                            <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono bg-gray-900 p-2 rounded-md max-h-40 overflow-y-auto">
                                {result.response}
                            </pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </>
    );
};
