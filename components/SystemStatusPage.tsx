import React, { useState, useEffect, useRef } from 'react';
import { updateAndCacheAllStockList, runOpenApiPreFilter } from '../services/stockService';
import { getCacheTimestamp } from '../services/cacheService';
import { ClockIcon, DatabaseIcon, BarChartIcon, XCircleIcon, CheckCircleIcon, ServerStackIcon } from './icons';
import { SystemCheck } from './SystemCheck';

interface SystemStatusPageProps {
  isLoading: boolean;
  processedCount: number;
  totalCount: number;
  failedLog: { name: string; reason: string }[];
  onFullListUpdated: () => void;
  isFirebaseConfigured: boolean;
  isUserLoggedIn: boolean;
}

const PREFILTER_DATA_KEY = 'openapi-prefiltered-data';
const PREFILTER_TIMESTAMP_KEY = 'openapi-prefiltered-timestamp';

export const SystemStatusPage: React.FC<SystemStatusPageProps> = ({ isLoading, processedCount, totalCount, failedLog, onFullListUpdated, isFirebaseConfigured, isUserLoggedIn }) => {
    const [dailyCacheLastUpdate, setDailyCacheLastUpdate] = useState<string | null>(null);
    
    // Full List State
    const [fullListCount, setFullListCount] = useState<number | null>(null);
    const [fullListLastUpdated, setFullListLastUpdated] = useState<string | null>(null);
    const [isFullListUpdating, setIsFullListUpdating] = useState(false);
    const [fullListUpdateMessage, setFullListUpdateMessage] = useState<string | null>(null);

    // OpenAPI Pre-filtering State
    const [isPreFiltering, setIsPreFiltering] = useState(false);
    const [preFilterLog, setPreFilterLog] = useState<string[]>([]);
    const [preFilteredCount, setPreFilteredCount] = useState<number>(0);
    const [preFilterLastUpdated, setPreFilterLastUpdated] = useState<string | null>(null);
    
    const preFilterLogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (preFilterLogRef.current) {
            preFilterLogRef.current.scrollTop = preFilterLogRef.current.scrollHeight;
        }
    }, [preFilterLog]);


    const updateStatus = async () => {
        const timestamp = await getCacheTimestamp();
        setDailyCacheLastUpdate(timestamp ? new Date(timestamp).toLocaleString('zh-TW') : '今日尚無');
        
        const fullListTimestamp = localStorage.getItem('all-stock-list-timestamp');
        if (fullListTimestamp) setFullListLastUpdated(new Date(parseInt(fullListTimestamp)).toLocaleString('zh-TW'));
        const fullCount = localStorage.getItem('all-stock-list-count');
        if (fullCount) setFullListCount(parseInt(fullCount));

        const preFilterTimestamp = localStorage.getItem(PREFILTER_TIMESTAMP_KEY);
        if (preFilterTimestamp) setPreFilterLastUpdated(new Date(parseInt(preFilterTimestamp)).toLocaleString('zh-TW'));
        try {
          const preFilteredList = JSON.parse(localStorage.getItem(PREFILTER_DATA_KEY) || '[]');
          setPreFilteredCount(preFilteredList.length);
        } catch {
          setPreFilteredCount(0);
        }
    };
    // Effect for updating general component status
    useEffect(() => {
        updateStatus();
        const interval = setInterval(updateStatus, 5000);
        return () => clearInterval(interval);
    }, []);
    
    const handleUpdateFullList = async () => {
        setIsFullListUpdating(true);
        setFullListUpdateMessage('');
        const result = await updateAndCacheAllStockList(msg => setFullListUpdateMessage(prev => `${prev}\n${msg}`.trim()));
        if (result.success) {
            setFullListUpdateMessage(prev => `${prev}\n成功更新 ${result.count} 支股票清單。`);
            onFullListUpdated();
        } else {
            setFullListUpdateMessage(prev => `${prev}\n${result.error}`);
        }
        setIsFullListUpdating(false);
        await updateStatus();
    };

    const handleRunPreFilter = async () => {
        setIsPreFiltering(true);
        setPreFilterLog([]);
        const handleProgress = (message: string, isFinal: boolean = false) => {
            setPreFilterLog(prev => [...prev, message]);
            if(isFinal) {
                setIsPreFiltering(false);
            }
        };
        const result = await runOpenApiPreFilter(handleProgress);
        setIsPreFiltering(false); // Ensure it's always set to false in the end
        await updateStatus();
    };

    const handleResetPreprocessing = () => {
        localStorage.removeItem(PREFILTER_DATA_KEY);
        localStorage.removeItem(PREFILTER_TIMESTAMP_KEY);
        setPreFilteredCount(0);
        setPreFilterLastUpdated(null);
        setPreFilterLog(['預篩選結果已清除。']);
    }

    return (
        <div className="space-y-6 fade-in-up">
            <h2 className="text-2xl font-bold text-white mb-2">系統監控儀表板</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-gray-900/50 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-400 flex items-center mb-2"><ClockIcon className="w-5 h-5 mr-2" /> 當前狀態</h3>
                    <p className={`text-lg font-bold ${
                        isLoading ? 'text-cyan-400 animate-pulse' :
                        isPreFiltering ? 'text-yellow-400 animate-pulse' :
                        'text-green-400'
                    }`}>{ isPreFiltering ? 'OpenAPI 預篩選中...' : isLoading ? '每日資料載入中...' : '閒置中'}</p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-400 flex items-center mb-2"><DatabaseIcon className="w-5 h-5 mr-2" /> 每日快取更新於</h3>
                     <p className="text-lg font-bold text-gray-200">{dailyCacheLastUpdate}</p>
                </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-6">
                <h3 className="text-lg font-semibold text-white">資料庫管理</h3>
                <div className="bg-gray-900/50 p-4 rounded-lg">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-3">
                        <h4 className="font-semibold text-gray-300">步驟 1: 全市場股票清單 {fullListCount && `(${fullListCount} 支)`}</h4>
                        <span className="text-xs text-gray-500 mt-1 sm:mt-0">最後更新: {fullListLastUpdated || '從未'}</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">從官方 OpenAPI 更新本地的上市公司完整清單。這是執行預篩選的基礎，若清單過舊建議先更新。</p>
                    <button onClick={handleUpdateFullList} disabled={isFullListUpdating || isPreFiltering} className="w-full flex items-center justify-center px-4 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
                        {isFullListUpdating ? (
                           <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div><span>更新中...</span></>
                        ) : '更新全市場股票清單'}
                    </button>
                    {fullListUpdateMessage && <div className={`whitespace-pre-wrap mt-3 p-2 rounded-md text-sm text-center ${fullListUpdateMessage.includes('失敗') || fullListUpdateMessage.includes('錯誤') ? 'bg-red-900/40 text-red-300' : 'bg-green-900/40 text-green-300'}`}>{fullListUpdateMessage}</div>}
                </div>
                
                <div className="bg-gray-900/50 p-4 rounded-lg">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-3">
                        <h4 className="font-semibold text-gray-300">步驟 2: 台股清單預篩引擎 (合格: {preFilteredCount} 支)</h4>
                        <span className="text-xs text-gray-500 mt-1 sm:mt-0">上次完成時間: {preFilterLastUpdated || '從未'}</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">使用證交所 OpenAPI 資料對完整清單進行體質篩選 (殖利率、本益比、股價淨值比、月線、成交量)，建立高品質的選股候選池。此過程會消耗大量 CPU 資源，但不會消耗 FinMind API 額度。</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <button onClick={handleRunPreFilter} disabled={!fullListCount || isFullListUpdating || isPreFiltering} className="w-full flex items-center justify-center px-4 py-2 bg-yellow-600 text-white font-semibold rounded-lg hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
                             {isPreFiltering ? '篩選中...' : '執行 OpenAPI 預篩選'}
                        </button>
                        <button onClick={handleResetPreprocessing} disabled={isPreFiltering} className="w-full flex items-center justify-center px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors">
                            重設預篩結果
                        </button>
                    </div>
                    
                    <div ref={preFilterLogRef} className="bg-gray-800 p-3 rounded-md max-h-60 overflow-y-auto">
                        <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono" aria-live="polite">
                            {preFilterLog.length > 0 ? preFilterLog.join('\n') : '日誌記錄將顯示於此處...'}
                        </pre>
                    </div>
                </div>
            </div>

            <SystemCheck isFirebaseConfigured={isFirebaseConfigured} isUserLoggedIn={isUserLoggedIn} />

            <div>
                <h3 className="text-lg font-semibold text-white mb-3">錯誤日誌 (每日資料載入)</h3>
                <div className="bg-gray-900/50 p-4 rounded-lg max-h-60 overflow-y-auto">
                    {failedLog.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                            {failedLog.map((log, index) => (
                                <li key={index} className="flex items-start">
                                    <XCircleIcon className="w-5 h-5 text-red-400 mr-2 shrink-0 mt-0.5" />
                                    <div><span className="font-semibold text-red-300">{log.name}: </span><span className="text-gray-400">{log.reason}</span></div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex items-center justify-center text-gray-500 py-4">
                            <CheckCircleIcon className="w-5 h-5 mr-2 text-green-500" /><span>上次執行無失敗紀錄</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};