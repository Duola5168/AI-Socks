import React, { useState, useEffect, useRef } from 'react';
import { updateAllMarketData, getUpdateTimestamp } from '../services/databaseService';
import { ClockIcon, DatabaseIcon, CheckCircleIcon, XCircleIcon, CloudIcon } from './icons';
import { SystemCheck } from './SystemCheck';
import * as firestoreService from '../services/firestoreService';
import { SystemLog } from '../types';
import { config, IS_FIREBASE_FUNCTIONS_CONFIGURED } from '../services/config';

interface SystemStatusPageProps {
  onDataUpdated: () => void;
  isFirebaseConfigured: boolean;
  isUserLoggedIn: boolean;
}

export const SystemStatusPage: React.FC<SystemStatusPageProps> = ({ onDataUpdated, isFirebaseConfigured, isUserLoggedIn }) => {
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateLog, setUpdateLog] = useState<string[]>([]);
    const logRef = useRef<HTMLDivElement>(null);
    
    // State for Cloud Function logs
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [isTriggering, setIsTriggering] = useState(false);
    const [triggerError, setTriggerError] = useState<string | null>(null);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [updateLog]);

    const fetchLogs = async () => {
        if (!isUserLoggedIn || !isFirebaseConfigured) {
            setLogs([]);
            return;
        }
        const fetchedLogs = await firestoreService.getSystemLogs();
        setLogs(fetchedLogs);
    };

    const updateStatus = async () => {
        const timestamp = await getUpdateTimestamp();
        setLastUpdate(timestamp ? new Date(timestamp).toLocaleString('zh-TW') : '從未更新');
    };

    useEffect(() => {
        updateStatus();
        fetchLogs();
    }, [isUserLoggedIn, isFirebaseConfigured]);

    const handleUpdate = async () => {
        setIsUpdating(true);
        setUpdateLog([]);
        try {
            await updateAllMarketData((log) => {
                setUpdateLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
            });
            await updateStatus();
            onDataUpdated();
        } catch (error: any) {
            setUpdateLog(prev => [...prev, `發生嚴重錯誤: ${error.message}`]);
        } finally {
            setIsUpdating(false);
        }
    };
    
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-gray-900/50 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-400 flex items-center mb-2"><ClockIcon className="w-5 h-5 mr-2" /> 系統狀態</h3>
                    <p className={`text-lg font-bold ${isUpdating ? 'text-cyan-400 animate-pulse' : 'text-green-400'}`}>
                        {isUpdating ? '數據庫同步中...' : '閒置中'}
                    </p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-400 flex items-center mb-2"><DatabaseIcon className="w-5 h-5 mr-2" /> 資料庫上次同步於</h3>
                     <p className="text-lg font-bold text-gray-200">{lastUpdate}</p>
                </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white">本地數據庫管理</h3>
                <p className="text-sm text-gray-400">
                    點擊下方按鈕，系統將從您的 Firebase 雲端資料庫 (Firestore) 同步所有市場數據到本地快取。這將確保您的 AI 分析基於後端數據管道提供的最完整、最新的資訊。
                </p>
                <button 
                    onClick={handleUpdate} 
                    disabled={isUpdating || !isUserLoggedIn} 
                    title={!isUserLoggedIn ? "請先登入以使用雲端同步功能" : "同步資料庫"}
                    className="w-full flex items-center justify-center px-4 py-3 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                    {isUpdating ? (
                        <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div><span>同步中...</span></>
                    ) : '從雲端同步全市場數據庫'}
                </button>
                <div ref={logRef} className="bg-gray-900 p-3 rounded-md max-h-60 overflow-y-auto">
                    <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono" aria-live="polite">
                        {updateLog.length > 0 ? updateLog.join('\n') : '同步日誌將顯示於此處...'}
                    </pre>
                </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white">雲端函式執行日誌</h3>
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

            <SystemCheck isFirebaseConfigured={isFirebaseConfigured} isUserLoggedIn={isUserLoggedIn} />
        </div>
    );
};