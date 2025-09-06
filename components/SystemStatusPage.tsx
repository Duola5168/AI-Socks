import React, { useState, useEffect, useCallback } from 'react';
import { ClockIcon, DatabaseIcon, CheckCircleIcon, XCircleIcon, CloudIcon, NewspaperIcon } from './icons';
import { SystemCheck } from './SystemCheck';
import * as firestoreService from '../services/firestoreService';
import * as newsService from '../services/newsService';
import { getLatestTimestamp } from '../services/supabase';
import { SystemLog, StrategySettings, NewsArticle } from '../types';
import { config, IS_FIREBASE_FUNCTIONS_CONFIGURED, IS_SUPABASE_CONFIGURED, IS_NEWS_CONFIGURED } from '../services/config';

interface SystemStatusPageProps {
  settings: StrategySettings;
  onDataUpdated: () => void;
  isFirebaseConfigured: boolean;
  isUserLoggedIn: boolean;
}

const DailyNewsWidget: React.FC = () => {
    const [newsPool, setNewsPool] = useState<NewsArticle[]>([]);
    const [currentNews, setCurrentNews] = useState<NewsArticle | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pickRandomNews = (pool: NewsArticle[]) => {
        if (pool.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * pool.length);
        return pool[randomIndex];
    };

    const loadNews = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const articles = await newsService.fetchMarketNews();
            if (articles.length === 0) {
                setError("今日無相關市場新聞。");
            } else {
                setNewsPool(articles);
                setCurrentNews(pickRandomNews(articles));
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    useEffect(() => {
        if (IS_NEWS_CONFIGURED) {
            loadNews();
        }
    }, [loadNews]);
    
    const handleRefresh = () => {
        if (newsPool.length > 1) { // only pick new one if there are options
            let newNews = pickRandomNews(newsPool);
            // simple logic to try not to show the same news twice in a row
            while (newNews?.url === currentNews?.url && newsPool.length > 1) {
                newNews = pickRandomNews(newsPool);
            }
            setCurrentNews(newNews);
        } else {
            loadNews(); // refetch if pool is small or empty
        }
    };

    if (!IS_NEWS_CONFIGURED) {
        return <p className="text-sm text-gray-500">News API 未設定，無法顯示新聞。</p>;
    }
    
    return (
        <>
            <div className="flex justify-between items-center">
                 <h3 className="text-lg font-semibold text-white flex items-center"><NewspaperIcon className="w-6 h-6 mr-2 text-cyan-400" /> 當日熱門新聞</h3>
                 <button onClick={handleRefresh} disabled={isLoading} className="text-sm px-3 py-1 bg-gray-600 rounded-md hover:bg-gray-500 disabled:opacity-50">
                    {isLoading ? '讀取中...' : '換一則'}
                </button>
            </div>
            
            {error && <p className="text-sm text-red-400 bg-red-900/30 p-2 rounded-md">{error}</p>}
            
            {currentNews && (
                 <div className="space-y-2 bg-gray-900/50 p-4 rounded-lg">
                    <a href={currentNews.url} target="_blank" rel="noopener noreferrer" className="font-bold text-cyan-400 hover:underline">
                        {currentNews.title}
                    </a>
                    <p className="text-sm text-gray-300 line-clamp-2">{currentNews.description}</p>
                    <p className="text-xs text-gray-500">{new Date(currentNews.publishedAt).toLocaleString('zh-TW')}</p>
                </div>
            )}
            
            {!isLoading && !error && !currentNews && <p className="text-sm text-gray-500 text-center py-4">正在載入新聞...</p>}
        </>
    );
}

export const SystemStatusPage: React.FC<SystemStatusPageProps> = ({ settings, onDataUpdated, isFirebaseConfigured, isUserLoggedIn }) => {
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);
    
    // State for Cloud Function logs
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [isTriggering, setIsTriggering] = useState(false);
    const [triggerError, setTriggerError] = useState<string | null>(null);

    const fetchLogs = async () => {
        if (!isUserLoggedIn || !isFirebaseConfigured) {
            setLogs([]);
            return;
        }
        const fetchedLogs = await firestoreService.getSystemLogs();
        setLogs(fetchedLogs);
    };

    const updateStatus = async () => {
        const timestamp = await getLatestTimestamp();
        setLastUpdate(timestamp ? new Date(timestamp).toLocaleString('zh-TW') : '從未更新');
    };

    useEffect(() => {
        updateStatus();
        fetchLogs();
    }, [isUserLoggedIn, isFirebaseConfigured]);

    const handleManualTrigger = async () => {
        if (!IS_FIREBASE_FUNCTIONS_CONFIGURED) {
            setTriggerError("Firebase Functions URL 未在環境變數中設定。");
            return;
        }
        setIsTriggering(true);
        setTriggerError(null);
        try {
            const response = await fetch(config.firebaseFunctionsUrl, { method: 'POST' });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || `請求失敗，狀態碼: ${response.status}`);
            }
            // Success, now refresh the logs
            await fetchLogs();
        } catch (error: any) {
            setTriggerError(`手動觸發失敗: ${error.message}`);
        } finally {
            setIsTriggering(false);
        }
    };

    return (
        <div className="space-y-6 fade-in-up">
            <h2 className="text-2xl font-bold text-white mb-2">系統監控儀表板</h2>
            
             <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white">市場數據庫 (Supabase)</h3>
                 <div className="bg-gray-900/50 p-4 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-400 flex items-center mb-2"><DatabaseIcon className="w-5 h-5 mr-2" /> 資料庫最新一筆資料時間</h4>
                    <p className="text-lg font-bold text-gray-200">{lastUpdate}</p>
                </div>
                 <div className="bg-blue-900/20 border border-blue-800/50 text-blue-300 px-4 py-3 rounded-lg">
                    <p className="text-sm">
                        <strong>資料更新說明：</strong>本系統的市場數據依賴於一個本地 Python 腳本 (`update_stock_database.py`) 進行更新。請確保您已在本地環境設定好 API 金鑰，並透過排程器 (如 Windows 工作排程器或 Linux cron) 每日執行此腳本，以確保數據的時效性。
                    </p>
                </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-4">
                <DailyNewsWidget />
            </div>

            <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white">雲端函式執行日誌 (Firebase Functions)</h3>
                <p className="text-sm text-gray-400">
                    此處顯示後端排程任務 (例如每日資料清理) 的最新執行紀錄。您也可以手動觸發一次清理任務來立即執行並檢查結果。
                </p>
                <button
                    onClick={handleManualTrigger}
                    disabled={isTriggering || !isUserLoggedIn || !isFirebaseConfigured}
                    title={!isUserLoggedIn ? "請先登入" : (!IS_FIREBASE_FUNCTIONS_CONFIGURED ? "請先設定 Firebase Functions URL" : "手動觸發清理")}
                    className="w-full flex items-center justify-center px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                    <CloudIcon className="w-5 h-5 mr-2" />
                    {isTriggering ? '執行中...' : '手動觸發雲端清理'}
                </button>
                
                {triggerError && <p className="text-red-400 text-sm text-center bg-red-900/30 p-2 rounded-lg">{triggerError}</p>}

                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {logs.length > 0 ? (
                        logs.map(log => (
                            <div key={log.id} className="flex items-start gap-3 p-2 bg-gray-900/50 rounded-md">
                                {log.status === 'success' ? <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> : <XCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
                                <div className="min-w-0">
                                    <p className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString('zh-TW')}</p>
                                    <p className="text-sm text-gray-300 break-words">{log.message}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 text-center py-4">
                            {isUserLoggedIn ? '尚無日誌紀錄。' : '請先登入以查看日誌。'}
                        </p>
                    )}
                </div>
            </div>

            <SystemCheck 
                settings={settings}
                isFirebaseConfigured={isFirebaseConfigured} 
                isSupabaseConfigured={IS_SUPABASE_CONFIGURED} 
                isUserLoggedIn={isUserLoggedIn} 
            />
        </div>
    );
};
