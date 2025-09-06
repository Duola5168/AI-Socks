import React, { useState } from 'react';
import { ScoredStock, StockCategory, CollaborativeAIReport, AnalystReport, FinalDecision, NewsSentimentReport, AnalysisPanel } from '../types';
import { 
  BrainCircuitIcon, PlusCircleIcon, GroqIcon, ChatBubbleBrainIcon, 
  PuzzlePieceIcon, ChevronDownIcon, ChatBubbleLeftRightIcon,
  NewspaperIcon, GitHubIcon, XAiIcon, MicrosoftIcon, MetaIcon, CohereIcon
} from './icons';
import { AddToPortfolioOptions } from '../hooks/useUserData';
import { StockInfoDisplay } from './StockInfoDisplay';
import StockChart from './StockChart';


interface StockDetailViewProps {
  scoredStock: ScoredStock;
  onBack: () => void;
  onAddToPortfolio: (options: AddToPortfolioOptions) => Promise<boolean>;
  isPortfolioFull: boolean;
  isInPortfolio: boolean;
  onStartCollaborativeAnalysis: (stockId: string) => void;
  onStartChat: (stock: ScoredStock) => void;
  isServiceConfigured: { gemini: boolean; groq: boolean; };
}

const getCategoryClass = (category: StockCategory | FinalDecision['action'] | FinalDecision['confidence'] | NewsSentimentReport['sentiment']) => {
    switch (category) {
        // Long / Positive
        case '進攻型': case '買進': case '高': case '正面': return 'bg-red-500/80 text-white';
        case '穩健型': case '觀望': case '中': case '中性': return 'bg-blue-500/80 text-white';
        case '保守型': case '避免': case '低': case '負面': return 'bg-green-500/80 text-white';
        // Short / Negative
        case '高風險空方': return 'bg-orange-600/80 text-white';
        case '趨勢空方': return 'bg-red-600/80 text-white';
        case '價值陷阱': return 'bg-yellow-600/80 text-white';
        default: return 'bg-gray-500/80 text-white';
    }
}

const AnalystIcon: React.FC<{ icon: AnalysisPanel['icon'], className?: string }> = ({ icon, className="w-5 h-5" }) => {
    switch (icon) {
        case 'gemini': return <BrainCircuitIcon className={`${className} text-purple-400`} />;
        case 'groq': return <GroqIcon className={`${className} text-red-400`} />;
        case 'openai': return <GitHubIcon className={className} />;
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

const AnalystPanels: React.FC<{ panels: AnalysisPanel[] }> = ({ panels }) => {
    const reportFields: { key: keyof AnalystReport; label: string }[] = [
        { key: 'candlestickPattern', label: 'K線型態' },
        { key: 'movingAverageAlignment', label: '均線排列' },
        { key: 'technicalIndicators', label: '技術指標' },
        { key: 'institutionalActivity', label: '法人籌碼' },
        { key: 'fundamentalAssessment', label: '基本面評估' },
        { key: 'supportLevel', label: '支撐位' },
        { key: 'resistanceLevel', label: '壓力位' },
        { key: 'recommendedEntryZone', label: '建議進場區間' },
        { key: 'recommendedExitConditions', label: '建議出場條件' },
        { key: 'supplementaryAnalysis', label: '補充分析' },
    ];

    const AnalystCard: React.FC<{ panel: AnalysisPanel }> = ({ panel }) => (
        <div className="p-4 rounded-lg bg-gray-900/40 border border-gray-700 flex flex-col">
            <h5 className="font-semibold mb-3 flex items-center gap-2 text-gray-200 border-b border-gray-700 pb-2">
                <AnalystIcon icon={panel.icon} className="w-4 h-4" />
                {panel.analystName} (立場: {panel.report.overallStance})
            </h5>
            <div className="space-y-3 text-xs overflow-y-auto">
                {reportFields.map(({ key, label }) => (
                     <div key={key}>
                        <p className="font-bold text-gray-400">{label}</p>
                        <p className="text-gray-300 mt-1">{panel.report[key]}</p>
                    </div>
                ))}
            </div>
        </div>
    );
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {panels.map(panel => <AnalystCard key={panel.analystName} panel={panel} />)}
        </div>
    );
};

const NewsSentimentDisplay: React.FC<{ report: NewsSentimentReport }> = ({ report }) => {
    return (
        <div className="space-y-3 p-3 rounded-lg border border-yellow-700 bg-yellow-900/30">
            <div className="flex justify-between items-center">
                <h5 className="text-sm font-semibold text-yellow-300 flex items-center"><NewspaperIcon className="w-5 h-5 mr-2" /> 新聞輿情分析</h5>
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${getCategoryClass(report.sentiment)}`}>
                    {report.sentiment}
                </span>
            </div>
             <p className="text-gray-300 text-sm">{report.summary}</p>
             <ul className="text-gray-400 text-xs list-disc list-inside space-y-1">
                {report.keyPoints.map((point, i) => <li key={i}>{point}</li>)}
            </ul>
        </div>
    );
};

const CollaborativeReportDisplay: React.FC<{ report: CollaborativeAIReport }> = ({ report }) => {
    const [isDetailsVisible, setIsDetailsVisible] = useState(false);
    const { finalDecision, analysisPanels, newsReport } = report;

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-300 flex items-center"><ChatBubbleLeftRightIcon className="w-5 h-5 mr-2 text-teal-400" /> AI 專家小組評比報告</h4>
            
            {newsReport && newsReport.articleCount > 0 && <NewsSentimentDisplay report={newsReport} />}

            <div className="grid grid-cols-3 gap-3 text-center">
                 <div className="bg-gray-900/50 p-2 rounded-md">
                    <p className="text-xs text-gray-400">綜合分數</p>
                    <p className="text-2xl font-bold text-cyan-400">{finalDecision.compositeScore}</p>
                </div>
                <div className="bg-gray-900/50 p-2 rounded-md">
                    <p className="text-xs text-gray-400">建議動作</p>
                    <span className={`px-3 py-1 text-sm font-bold rounded-full inline-block mt-1 ${getCategoryClass(finalDecision.action)}`}>
                        {finalDecision.action}
                    </span>
                </div>
                <div className="bg-gray-900/50 p-2 rounded-md">
                    <p className="text-xs text-gray-400">信心度</p>
                     <span className={`px-3 py-1 text-sm font-bold rounded-full inline-block mt-1 ${getCategoryClass(finalDecision.confidence)}`}>
                        {finalDecision.confidence}
                    </span>
                </div>
            </div>

            <div className="bg-indigo-900/50 p-3 rounded-lg space-y-1">
                <h5 className="text-xs text-indigo-300 font-semibold">投資總監裁決理由</h5>
                <p className="text-gray-300 text-sm">{finalDecision.synthesisReasoning}</p>
            </div>
            
            <div className="bg-gray-900/50 p-3 rounded-lg space-y-1">
                <h5 className="text-xs text-gray-400 font-semibold">共識與分歧</h5>
                <p className="text-gray-300 text-sm">{finalDecision.consensusAndDisagreement}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900/50 p-3 rounded-lg space-y-1">
                    <h5 className="text-xs text-gray-400 font-semibold">操作策略</h5>
                    <p className="text-gray-300 text-sm">{finalDecision.operationalStrategy}</p>
                </div>
                 <div className="bg-gray-900/50 p-3 rounded-lg space-y-1">
                    <h5 className="text-xs text-gray-400 font-semibold">資金配置</h5>
                    <p className="text-gray-300 text-sm">{finalDecision.positionSizingSuggestion}</p>
                </div>
                 <div className="bg-gray-900/50 p-3 rounded-lg space-y-1">
                    <h5 className="text-xs text-gray-400 font-semibold">停損策略</h5>
                    <p className="text-gray-300 text-sm">{finalDecision.stopLossStrategy}</p>
                </div>
                 <div className="bg-gray-900/50 p-3 rounded-lg space-y-1">
                    <h5 className="text-xs text-gray-400 font-semibold">停利策略</h5>
                    <p className="text-gray-300 text-sm">{finalDecision.takeProfitStrategy}</p>
                </div>
            </div>
            
            <div>
                <p className="text-xs text-teal-300 mb-1 font-semibold">後續關鍵觀察點</p>
                <ul className="text-gray-300 text-sm bg-gray-900/50 p-3 rounded-md list-disc list-inside space-y-1">
                    {finalDecision.keyEventsToWatch.map((event, i) => <li key={i}>{event}</li>)}
                </ul>
            </div>


            <button onClick={() => setIsDetailsVisible(!isDetailsVisible)} className="w-full text-xs text-gray-400 hover:text-white flex items-center justify-center pt-2">
                {isDetailsVisible ? '隱藏專家小組分析過程' : '查看詳細分析過程'}
                <ChevronDownIcon className={`w-4 h-4 ml-1 transition-transform ${isDetailsVisible ? 'rotate-180' : ''}`} />
            </button>

            {isDetailsVisible && (
                 <div className="space-y-4 pt-4 border-t border-gray-700">
                    <AnalystPanels panels={analysisPanels} />
                </div>
            )}
        </div>
    );
};

const CollaborationLoader: React.FC<{ progressMessage: string }> = ({ progressMessage }) => {
    return (
        <div className="text-center text-teal-400 p-4">
            <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mt-2"></div>
            <p className="mt-4 text-sm font-semibold transition-opacity duration-500">{progressMessage}</p>
        </div>
    );
};


export const StockDetailView: React.FC<StockDetailViewProps> = ({ 
    scoredStock, onBack, onAddToPortfolio, isPortfolioFull, isInPortfolio, 
    onStartCollaborativeAnalysis, onStartChat, isServiceConfigured 
}) => {
  const { stock, isCollaborating, collaborationProgress, collaborativeReport, analysisError } = scoredStock;

  const handleConfirmAdd = async () => {
    await onAddToPortfolio({
      stock: scoredStock.stock,
      shares: 1000, 
      entryPrice: stock.close || 0,
      screenerData: {
        score: scoredStock.score,
        breakdown: scoredStock.breakdown,
        layerScores: scoredStock.layerScores,
        aiReport: scoredStock.aiReport,
        collaborativeReport: scoredStock.collaborativeReport,
      }
    });
  };

  return (
    <div className="bg-gray-800/30 rounded-xl shadow-lg border border-gray-700 p-4 sm:p-6 fade-in-up">
        <button onClick={onBack} className="text-cyan-400 hover:text-cyan-300 font-semibold mb-4">&larr; 返回列表</button>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Column (Data): 3/5 width */}
            <div className="lg:col-span-3 space-y-6">
                <StockInfoDisplay stock={stock} />
                {stock.kline && stock.kline.length > 20 ? (
                    <StockChart klineData={stock.kline} />
                ) : (
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold text-gray-200 mb-2">近期日 K 線圖</h3>
                        <div className="h-[300px] flex items-center justify-center text-gray-500">
                            K線數據不足，無法繪製圖表。
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column (AI): 2/5 width */}
            <div className="lg:col-span-2 space-y-4">
                <div className="bg-gray-900/50 p-4 rounded-lg sticky top-6">
                    <h3 className="text-lg font-semibold text-gray-200 mb-4">AI 專家分析</h3>
                    
                    <div className="min-h-[200px]">
                        {isCollaborating && <CollaborationLoader progressMessage={collaborationProgress || '分析已開始...'} />}
                        {analysisError && (
                            <div className="text-center text-red-400 bg-red-900/30 p-3 rounded-lg">
                                <p className="font-semibold">分析錯誤</p>
                                <p className="text-xs mt-1">{analysisError}</p>
                            </div>
                        )}
                        {collaborativeReport && <CollaborativeReportDisplay report={collaborativeReport} />}
                        
                        {!isCollaborating && !collaborativeReport && !analysisError && (
                             <div className="text-center p-4">
                                 <p className="text-gray-400 mb-4">點擊下方按鈕，啟動由多個 AI 模型組成的專家小組，對此股票進行深度分析。</p>
                                 <button
                                    onClick={() => onStartCollaborativeAnalysis(stock.id)}
                                    disabled={!isServiceConfigured.groq || !isServiceConfigured.gemini}
                                    className="w-full flex items-center justify-center px-4 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                                    title={!isServiceConfigured.groq || !isServiceConfigured.gemini ? '請先設定 Gemini 與 Groq API Keys' : '啟動 AI 協同分析'}
                                 >
                                    <ChatBubbleLeftRightIcon className="w-5 h-5 mr-2" />
                                    啟動 AI 專家小組評比
                                 </button>
                             </div>
                        )}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 gap-2">
                        <button
                          onClick={handleConfirmAdd}
                          disabled={isPortfolioFull || isInPortfolio}
                          className="flex items-center justify-center px-4 py-3 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                          <PlusCircleIcon className="w-5 h-5 mr-2" />
                          {isInPortfolio ? '已在組合' : (isPortfolioFull ? '組合已滿' : '加入組合')}
                        </button>
                        <button
                          onClick={() => onStartChat(scoredStock)}
                          disabled={!collaborativeReport || !isServiceConfigured.gemini}
                          className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                          title={!collaborativeReport ? '請先完成專家小組評比' : (!isServiceConfigured.gemini ? '請先設定 Gemini API Key' : '與 AI 深入對話')}
                        >
                          <ChatBubbleBrainIcon className="w-5 h-5 mr-2" />
                          與 AI 對話
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};