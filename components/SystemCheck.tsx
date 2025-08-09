import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { CheckCircleIcon, XCircleIcon, ServerStackIcon } from './icons';
import { config, IS_FIREBASE_CONFIGURED, IS_GEMINI_CONFIGURED, IS_GROQ_CONFIGURED, IS_NEWS_CONFIGURED } from '../services/config';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface ServiceStatus {
  status: Status;
  message: string;
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


const StatusRow: React.FC<{ name: string; status: Status; message: string }> = ({ name, status, message }) => {
    const getStatusUI = () => {
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
    
    return (
        <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
            <span className="font-semibold text-gray-300">{name}</span>
            <div className="flex items-center gap-2 text-sm text-right">
                {getStatusUI()}
                <span className={`min-w-0 break-words ${status === 'error' ? 'text-red-300' : 'text-gray-400'}`}>{message}</span>
            </div>
        </div>
    );
};

export const SystemCheck: React.FC<{ isFirebaseConfigured: boolean; isUserLoggedIn: boolean }> = ({ isFirebaseConfigured, isUserLoggedIn }) => {
    const [statuses, setStatuses] = useState({
        twse: { status: 'idle', message: '尚未檢查' } as ServiceStatus,
        finmind: { status: 'idle', message: '尚未檢查' } as ServiceStatus,
        gemini: { status: 'idle', message: '尚未檢查' } as ServiceStatus,
        groq: { status: 'idle', message: '尚未檢查' } as ServiceStatus,
        news: { status: 'idle', message: '尚未檢查' } as ServiceStatus,
    });
    const [isChecking, setIsChecking] = useState(false);

    const handleRunChecks = async () => {
        setIsChecking(true);
        setStatuses({
            twse: { status: 'loading', message: '檢查中...' },
            finmind: { status: 'loading', message: '檢查中...' },
            gemini: { status: 'loading', message: '檢查中...' },
            groq: { status: 'loading', message: '檢查中...' },
            news: { status: 'loading', message: '檢查中...' },
        });

        const [twseResult, finmindResult, geminiResult, groqResult, newsResult] = await Promise.all([
            checkTwseProxy(),
            checkFinMindProxy(),
            checkGemini(),
            checkGroq(),
            checkNewsApi()
        ]);

        setStatuses({
            twse: {
                status: twseResult.includes('成功') ? 'success' : 'error',
                message: twseResult,
            },
            finmind: {
                status: finmindResult.includes('成功') ? 'success' : 'error',
                message: finmindResult,
            },
            gemini: {
                status: geminiResult.includes('成功') ? 'success' : 'error',
                message: geminiResult,
            },
            groq: {
                status: groqResult.includes('成功') ? 'success' : 'error',
                message: groqResult,
            },
            news: {
                status: newsResult.includes('成功') ? 'success' : 'error',
                message: newsResult,
            }
        });
        setIsChecking(false);
    };

    const firebaseStatus = isFirebaseConfigured ? (isUserLoggedIn ? 'success' : 'error') : 'error';
    const firebaseMessage = isFirebaseConfigured ? (isUserLoggedIn ? '已登入並同步' : '未登入，資料僅儲存於本機') : 'Firebase 未設定';

    return (
        <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-cyan-400 border-b border-gray-600 pb-2">系統連接狀態檢查</h3>
            <p className="text-sm text-gray-400">
                執行主動檢測，以確認所有外部服務 (數據源、AI模型) 的 API 金鑰是否有效且網路連線正常。
            </p>
            <div className="space-y-3">
                 <StatusRow name="Firebase 雲端同步" status={firebaseStatus} message={firebaseMessage} />
                 <StatusRow name="證交所 API (代理)" status={statuses.twse.status} message={statuses.twse.message} />
                 <StatusRow name="FinMind 數據 (代理)" status={statuses.finmind.status} message={statuses.finmind.message} />
                 <StatusRow name="Gemini AI 分析" status={statuses.gemini.status} message={statuses.gemini.message} />
                 <StatusRow name="Groq 第二意見" status={statuses.groq.status} message={statuses.groq.message} />
                 <StatusRow name="News API 輿情" status={statuses.news.status} message={statuses.news.message} />
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
    );
};