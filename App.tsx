import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './components/Auth';
import { useMarketData } from './hooks/useMarketData';
import { useUserData } from './hooks/useUserData';
import { useScreener } from './hooks/useScreener';
import { useStrategySettings } from './hooks/useStrategySettings';
import { ScoredStock, MarketHealth, ScreenerStrategy, PartialStockData } from './types';
import { IS_GEMINI_CONFIGURED, IS_GROQ_CONFIGURED, IS_FIREBASE_CONFIGURED } from './services/config';
import { calculateMarketHealth, isTradingDay } from './services/utils';
import { getLatestTimestamp } from './services/supabase';

import { PortfolioTracker } from './components/PortfolioTracker';
import { History } from './components/History';
import { BrainCircuitIcon, XCircleIcon, LogOutIcon, GoogleIcon, BuildingIcon, HistoryIcon, ChatBubbleLeftIcon, CheckCircleIcon, ServerStackIcon, LightbulbIcon, CogIcon, ChartBarSquareIcon, BeakerIcon } from './components/icons';
import { ConfigError } from './components/ConfigError';
import { Clock } from './components/Clock';
import { AIChatModal } from './components/AIChatModal';
import { ScreenerControls } from './components/ScreenerControls';
import { SystemStatusPage } from './components/SystemStatusPage';
import { SettingsPage } from './components/SettingsPage';
import { StockListItem } from './components/StockListItem';
import { StockDetailView } from './components/StockDetailView';
import { BacktesterPage } from './components/BacktesterPage';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeSwitcher } from './components/ThemeSwitcher';


const MAX_ACTIVE_PORTFOLIO_SIZE = 5;

const AppLoader: React.FC<{ message: string }> = ({ message }) => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <div className="w-16 h-16 border-4 border-cyan-500 dark:border-cyan-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-cyan-600 dark:text-cyan-300">{message}</p>
    </div>
);

const LoginButton: React.FC = () => {
    const { signInWithGoogle, loading, isFirebaseConfigured } = useAuth();
    return (
        <button
            onClick={signInWithGoogle}
            disabled={loading || !isFirebaseConfigured}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold rounded-lg shadow-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
            title={!isFirebaseConfigured ? 'Firebase 未設定，無法登入' : '使用 Google 登入'}
        >
            <GoogleIcon className="w-5 h-5" />
            <span className="hidden sm:inline">使用 Google 登入</span>
        </button>
    );
};

interface NavButtonProps {
    tabName: string;
    label: string;
    icon: React.ReactElement<{className?: string}>;
    activeTab: string;
    onClick: (tabName: string) => void;
}

const NavButton: React.FC<NavButtonProps> = ({ tabName, label, icon, activeTab, onClick }) => (
    <button 
        onClick={() => onClick(tabName)} 
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tabName ? 'text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-500 dark:border-cyan-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
    >
        {React.cloneElement(icon, { className: "w-5 h-5"})}
        {label}
    </button>
);


function App() {
  const { user, loading: authLoading, signOut, isFirebaseConfigured } = useAuth();
  const [activeTab, setActiveTab] = useState('screener');
  const [appLoadingMessage, setAppLoadingMessage] = useState('正在初始化...');
  const [chatStock, setChatStock] = useState<ScoredStock | null>(null);
  const [tradeUnitMode, setTradeUnitMode] = useState<'whole' | 'fractional'>('whole');
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [showUpdateReminder, setShowUpdateReminder] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [viewingStock, setViewingStock] = useState<ScoredStock | null>(null);
  
  const { 
    settings, 
    setSettings, 
    saveSettings, 
    resetSettings,
    updatePrompt,
    isSyncing: isSettingsSyncing 
  } = useStrategySettings();

  const { 
    allStocks, 
    isDataLoading, 
    loadingMessage: marketLoadingMessage, 
    apiError: marketApiError,
    loadAllMarketData,
  } = useMarketData();
  
  const {
    portfolio,
    tradeHistory,
    alerts,
    error: userError,
    isSyncing: isUserSyncing,
    setError: setUserError,
    handleAddToPortfolio,
    handleSell,
    handleUpdateTradeAnalysis,
    handleToggleTrackingMode,
  } = useUserData(allStocks, isDataLoading, setAppLoadingMessage, settings);

  const {
      screenedStocks,
      isScreening,
      screenerError,
      setScreenerError,
      statusLog,
      runScreener,
      runDirectAnalysis,
      handleCollaborativeAnalysis,
  } = useScreener(tradeHistory, tradeUnitMode, settings, setSettings);

  useEffect(() => {
      if(marketLoadingMessage) {
        setAppLoadingMessage(marketLoadingMessage);
      }
  }, [marketLoadingMessage]);
  
  const checkDataFreshness = useCallback(async () => {
    const dbTimestampStr = await getLatestTimestamp();
    if (!dbTimestampStr) {
        setShowUpdateReminder(true);
        setLastUpdateTime(null);
        return;
    }
    const lastUpdateDate = new Date(dbTimestampStr);
    setLastUpdateTime(lastUpdateDate);
    
    const today = new Date();
    const isTodayTradingDay = isTradingDay(today);
    const isDataFromToday = lastUpdateDate.getFullYear() === today.getFullYear() &&
                            lastUpdateDate.getMonth() === today.getMonth() &&
                            lastUpdateDate.getDate() === today.getDate();

    if (isTodayTradingDay && !isDataFromToday) {
        setShowUpdateReminder(true);
    } else {
        setShowUpdateReminder(false);
    }
  }, []);

  useEffect(() => {
    // Initial load when app mounts
    loadAllMarketData((loadedData) => {
        if (loadedData.length > 0) {
             checkDataFreshness();
        }
    });
  }, [loadAllMarketData, checkDataFreshness]);


  const handleFullListUpdated = () => {
    checkDataFreshness();
  };
  
  const handleStartStrategyScreening = useCallback((strategy: ScreenerStrategy, prompt: string) => {
    setCompletionMessage(null);
    setScreenerError(null);
    setViewingStock(null);
    runScreener(allStocks, strategy, prompt);
  }, [allStocks, runScreener, setScreenerError]);

  const handleRunDirectAnalysis = useCallback(async (ticker: string) => {
    setCompletionMessage(null);
    setScreenerError(null);
    setViewingStock(null);
    
    const analyzedStock = await runDirectAnalysis(ticker, allStocks);
    
    if (analyzedStock) {
        setViewingStock(analyzedStock);
    }
    // Error is handled inside the hook and will be displayed.
  }, [allStocks, runDirectAnalysis, setScreenerError]);
  
  const portfolioMap = useMemo(() => new Map(portfolio.map(h => [h.id, h])), [portfolio]);
  
  const marketContext = useMemo((): MarketHealth | null => {
      if (!allStocks || allStocks.length === 0) return null;
      return calculateMarketHealth(allStocks);
  }, [allStocks]);
  
  if (authLoading || (isDataLoading && allStocks.length === 0) ) {
    return <AppLoader message={appLoadingMessage || "正在驗證使用者身份..."} />;
  }

  const dismissibleError = userError || screenerError;
  const isSyncing = isUserSyncing || isSettingsSyncing;
  const isPortfolioFull = portfolio.filter(h => (h.trackingMode ?? 'active') === 'active').length >= MAX_ACTIVE_PORTFOLIO_SIZE;
  const isBusy = isScreening;

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="flex flex-col flex-grow w-full max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-600 dark:from-cyan-400 dark:to-purple-500 flex items-center">
            <BrainCircuitIcon className="w-8 h-8 mr-3"/>
            AI 智慧投資平台
          </h1>
           <div className="flex items-center gap-2 sm:gap-4">
            <ThemeSwitcher />
            <Clock />
            {isFirebaseConfigured && (
              user ? (
                  <>
                      {user.photoURL && <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-full" />}
                      <button onClick={signOut} className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                          <LogOutIcon className="w-6 h-6" />
                          <span className="hidden sm:inline">登出</span>
                      </button>
                  </>
              ) : (
                  <LoginButton />
              )
            )}
          </div>
        </header>
        
        {isSyncing && (
             <div className="text-center text-sm text-cyan-500 dark:text-cyan-400 mb-4 animate-pulse">正在同步雲端資料...</div>
        )}

        {showUpdateReminder && ['screener', 'status'].includes(activeTab) && (
            <div className="mb-4 bg-yellow-100 dark:bg-yellow-800/50 border border-yellow-400 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg relative flex items-center justify-between fade-in-up" role="alert">
                <div className="flex items-start gap-3">
                    <LightbulbIcon className="w-5 h-5 mt-0.5 shrink-0 text-yellow-500 dark:text-yellow-400" />
                    <p className="text-sm">
                        📌 {lastUpdateTime ? `您的市場資料庫上次更新於 ${lastUpdateTime.toLocaleString('zh-TW')}。` : '您的市場資料庫似乎是空的。'}
                        今天是開盤日，建議您在本機執行 Python 更新腳本，以獲取最新數據進行分析。
                    </p>
                </div>
                 <button onClick={() => setShowUpdateReminder(false)} className="text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-white">
                    <XCircleIcon className="w-5 h-5" />
                </button>
            </div>
        )}

        {dismissibleError && (
            <div className="mb-4 bg-red-100 dark:bg-red-800/50 border border-red-400 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg relative flex items-center justify-between" role="alert">
                <span className="block sm:inline">{dismissibleError}</span>
                <button 
                  onClick={() => {
                    if (userError) setUserError(null);
                    if (screenerError) setScreenerError(null);
                  }} 
                  className="text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-white">
                    <XCircleIcon className="w-5 h-5" />
                </button>
            </div>
        )}

        {completionMessage && (
            <div className="mb-4 bg-green-100 dark:bg-green-800/50 border border-green-400 dark:border-green-700 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg relative flex items-center justify-between" role="alert">
                <div className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    <span className="block sm:inline">{completionMessage}</span>
                </div>
                <button 
                  onClick={() => setCompletionMessage(null)} 
                  className="text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-white">
                    <XCircleIcon className="w-5 h-5" />
                </button>
            </div>
        )}
        
        {marketApiError && <ConfigError message={marketApiError} />}

        <nav className="mb-6 flex border-b border-gray-300 dark:border-gray-700 overflow-x-auto">
          <NavButton tabName="screener" label="AI 選股" icon={<ChatBubbleLeftIcon />} activeTab={activeTab} onClick={setActiveTab} />
          <NavButton tabName="portfolio" label="投資組合" icon={<BuildingIcon />} activeTab={activeTab} onClick={setActiveTab} />
          <NavButton tabName="history" label="交易歷史" icon={<HistoryIcon />} activeTab={activeTab} onClick={setActiveTab} />
          <NavButton tabName="backtester" label="策略回測" icon={<ChartBarSquareIcon />} activeTab={activeTab} onClick={setActiveTab} />
          <NavButton tabName="settings" label="AI分析師設定" icon={<CogIcon />} activeTab={activeTab} onClick={setActiveTab} />
          <NavButton tabName="status" label="系統監控" icon={<ServerStackIcon />} activeTab={activeTab} onClick={setActiveTab} />
        </nav>

        <main className="flex-grow">
          {activeTab === 'screener' && (
             <ErrorBoundary>
                <section id="screener">
                {viewingStock ? (
                    <StockDetailView 
                        scoredStock={viewingStock}
                        onBack={() => setViewingStock(null)}
                        onAddToPortfolio={handleAddToPortfolio}
                        isPortfolioFull={isPortfolioFull}
                        isInPortfolio={portfolioMap.has(viewingStock.stock.id)}
                        onStartCollaborativeAnalysis={(stockId) => handleCollaborativeAnalysis(stockId, user?.uid)}
                        onStartChat={setChatStock}
                        isServiceConfigured={{ gemini: IS_GEMINI_CONFIGURED, groq: IS_GROQ_CONFIGURED }}
                    />
                ) : (
                    <>
                    <ScreenerControls
                        onSelectStrategy={handleStartStrategyScreening}
                        onRunDirectAnalysis={handleRunDirectAnalysis}
                        isBusy={isBusy}
                        marketApiError={marketApiError}
                        marketContext={marketContext}
                        isGeminiConfigured={IS_GEMINI_CONFIGURED}
                        settings={settings}
                    />

                    {(statusLog.length > 0 || isBusy) && (
                        <div className="my-6 p-4 bg-gray-200 dark:bg-gray-800/50 rounded-xl border border-gray-300 dark:border-gray-700">
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">篩選狀態日誌</h4>
                            <div className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono bg-white dark:bg-gray-900 p-3 rounded-md max-h-48 overflow-y-auto">
                            {statusLog.join('\n')}
                            {isBusy && statusLog.length > 0 && '\n'}
                            {isScreening && `正在篩選與分析中...`}
                            </div>
                        </div>
                    )}
                    
                    {isBusy && screenedStocks.length === 0 ? (
                        <div className="flex justify-center items-center h-96 bg-gray-200 dark:bg-gray-800/30 rounded-xl">
                        <div className="text-center">
                            <div className="w-16 h-16 border-4 border-cyan-500 dark:border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-cyan-600 dark:text-cyan-300">正在分析中...</p>
                        </div>
                        </div>
                    ) : screenedStocks.length > 0 ? (
                        <div className="space-y-3">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">篩選結果</h3>
                        {screenedStocks.map((s, index) => (
                            <StockListItem 
                                key={s.stock.id}
                                scoredStock={s}
                                onSelect={() => setViewingStock(s)}
                                animationDelay={index * 100}
                            />
                        ))}
                        </div>
                    ) : (
                        <div className="flex justify-center items-center h-96 bg-gray-200 dark:bg-gray-800/30 rounded-xl text-center text-gray-500 dark:text-gray-400">
                        { !screenerError && !marketApiError && <p>使用上方功能開始執行 AI 篩選</p> }
                        </div>
                    )}
                    </>
                )}
                </section>
             </ErrorBoundary>
          )}

          {activeTab === 'portfolio' && (
            <ErrorBoundary>
                <PortfolioTracker 
                holdings={portfolio} 
                alerts={alerts} 
                onSell={handleSell}
                onAddToPortfolio={handleAddToPortfolio}
                onToggleTrackingMode={handleToggleTrackingMode}
                isPortfolioFull={isPortfolioFull}
                allStocks={allStocks}
                />
            </ErrorBoundary>
          )}

          {activeTab === 'history' && (
            <ErrorBoundary>
                <History 
                    tradeHistory={tradeHistory} 
                    onUpdateAnalysis={handleUpdateTradeAnalysis}
                    isGeminiConfigured={IS_GEMINI_CONFIGURED}
                    settings={settings}
                />
            </ErrorBoundary>
          )}

          {activeTab === 'backtester' && (
            <ErrorBoundary>
                <BacktesterPage settings={settings} onPromptUpdate={updatePrompt} />
            </ErrorBoundary>
          )}
          
          {activeTab === 'settings' && (
            <ErrorBoundary>
                <SettingsPage 
                settings={settings}
                onSettingsChange={setSettings}
                onSave={saveSettings}
                onReset={resetSettings}
                />
            </ErrorBoundary>
          )}

          {activeTab === 'status' && (
            <ErrorBoundary>
                <SystemStatusPage 
                    settings={settings}
                    onDataUpdated={handleFullListUpdated}
                    isFirebaseConfigured={isFirebaseConfigured}
                    isUserLoggedIn={!!user}
                />
            </ErrorBoundary>
          )}
        </main>
        
        {chatStock && (
            <AIChatModal 
                isOpen={!!chatStock}
                onClose={() => setChatStock(null)}
                stock={chatStock}
                settings={settings}
            />
        )}

        <footer className="text-center mt-12 text-gray-500 text-xs">
             {isFirebaseConfigured && !user && <p className="mb-2">登入即可跨裝置同步您的資料。</p>}
            <p>免責聲明：本應用程式為功能展示，所有資訊與 AI 分析結果不構成任何投資建議。</p>
        </footer>
      </div>
    </div>
  );
}

export default App;