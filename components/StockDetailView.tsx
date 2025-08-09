import React, { useState, useEffect } from 'react';
import { ScoredStock, StockCategory, CollaborativeAIReport, LayerScores, DebateReport, DebatePoint, FinalDecision, NewsSentimentReport, AnalysisPanel } from '../types';
import { 
  TrendingUpIcon, BarChartIcon, DollarSignIcon, 
  ShieldCheckIcon, BrainCircuitIcon, PlusCircleIcon,
  GroqIcon, SparklesIcon, ChatBubbleBrainIcon, PuzzlePieceIcon,
  XCircleIcon, ChevronDownIcon, ChatBubbleLeftRightIcon,
  NewspaperIcon, GitHubIcon
} from './icons';
import { AddToPortfolioOptions } from '../hooks/useUserData';
import { PortfolioItemDetail } from './PortfolioItemDetail'; // Re-use for chart and alert logic

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
        case '進攻型': case '買進': case '高': case '正面': return 'bg-red-500/80 text-white';
        case '穩健型': case '觀望': case '中': case '中性': return 'bg-blue-500/80 text-white';
        case '保守型': case '避免': case '低': case '負面': return 'bg-green-500/80 text-white';
        default: return 'bg-gray-500/80 text-white';
    }
}

const AnalysisPanels: React.FC<{ panels: AnalysisPanel[] }> = ({ panels }) => {
    const debatePointsConfig = [
        { key: 'fundamentals', label: '基本面' },
        { key: 'technicals', label: '技術面' },
        { key: 'momentum', label: '籌碼動能' },
        { key: 'riskAssessment', label: '風險評估' },
    ];

    const AnalystIcon: React.FC<{ icon: AnalysisPanel['icon'] }> = ({ icon }) => {
        switch (icon) {
            case 'gemini': return <BrainCircuitIcon className="w-4 h-4" />;
            case 'groq': return <GroqIcon className="w-4 h-4" />;
            case 'github': return <GitHubIcon className="w-4 h-4" />;
            default: return <PuzzlePieceIcon className="w-4 h-4" />;
        }
    };

    const AnalystCard: React.FC<{ panel: AnalysisPanel }> = ({ panel }) => (
        <div className="p-3 rounded-lg bg-gray-900/40 border border-gray-700">
            <h5 className="font-semibold mb-3 flex items-center gap-2 text-gray-200">
                <AnalystIcon icon={panel.icon} />
                {panel.analystName} (立場: {panel.report.overallStance})
            </h5>
            <div className="space-y-3">
                {debatePointsConfig.map(({ key, label }) => {
                    const point = panel.report[key as keyof DebateReport] as DebatePoint;
                    return (
                        <div key={key}>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-gray-300">{label}</span>
                                <span className="font-mono font-bold">{point.score}/100</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{point.reasoning}</p>
                        </div>
                    );
                })}
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
                {report.keyPoints.map((reason, i) => <li key={i}>{reason}</li>)}
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

            <div className="bg-indigo-900/50 p-3 rounded-lg">
                <h5 className="text-xs text-indigo-300 mb-1 font-semibold">投資總監裁決理由</h5>
                <p className="text-gray-300 text-sm">{finalDecision.synthesisReasoning}</p>
            </div>

             <div>
                <p className="text-xs text-teal-300 mb-1 font-semibold">最終關鍵理由</p>
                <ul className="text-gray-300 text-sm bg-gray-900/50 p-3 rounded-md list-disc list-inside space-y-1">
                    {finalDecision.keyReasons.map((reason, i) => <li key={i}>{reason}</li>)}
                </ul>
            </div>

            <button onClick={() => setIsDetailsVisible(!isDetailsVisible)} className="w-full text-xs text-gray-400 hover:text-white flex items-center justify-center pt-2">
                {isDetailsVisible ? '隱藏專家小組分析過程' : '查看詳細分析過程'}
                <ChevronDownIcon className={`w-4 h-4 ml-1 transition-transform ${isDetailsVisible ? 'rotate-180' : ''}`} />
            </button>

            {isDetailsVisible && (
                 <div className="space-y-4 pt-4 border-t border-gray-700">
                    <AnalysisPanels panels={analysisPanels} />
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
  const { stock, score, aiReport, isCollaborating, collaborationProgress, collaborativeReport, analysisError } = scoredStock;
  const currentPrice = stock.kline[stock.kline.length - 1].close;

  const handleConfirmAdd = async () => {
    await onAddToPortfolio({
      stock: scoredStock.stock,
      shares: 1000, // Default shares, can be made into a modal later if needed
      entryPrice: currentPrice,
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
    <div className="bg-gray-800/30 rounded-xl shadow-lg border border-gray-700 p-6 fade-in-up">
        <button onClick={onBack} className="text-cyan-400 hover:text-cyan-300 font-semibold mb-4">&larr; 返回列表</button>
        
        <div className="flex justify-between items-start mb-4">
            <div>
                <h2 className="text-3xl font-bold text-white">{stock.name} ({stock.ticker})</h2>
                <p className="text-lg text-gray-300">當前股價: ${currentPrice.toFixed(2)}</p>
            </div>
            <div className="text-right">
                <p className="text-4xl font-bold text-cyan-400">{score}</p>
                <p className="text-sm text-gray-400">策略評分</p>
            </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Chart and AI Actions */}
            <div className="space-y-6">
                <div className="bg-gray-900/50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-200 mb-2">K線圖與均線</h3>
                    <PortfolioItemDetail holding={{...stock, entryPrice: 0, shares: 0, currentPrice: currentPrice}} stockData={stock} />
                </div>
                 <div className="bg-gray-900/50 p-4 rounded-lg grid grid-cols-2 gap-2">
                    <button
                      onClick={handleConfirmAdd}
                      disabled={isPortfolioFull || isInPortfolio}
                      className="flex items-center justify-center px-4 py-3 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                      <PlusCircleIcon className="w-5 h-5 mr-2" />
                      {isInPortfolio ? '已在投資組合' : (isPortfolioFull ? '組合已滿' : '加入組合')}
                    </button>
                    <button
                      onClick={() => onStartChat(scoredStock)}
                      disabled={!aiReport || !isServiceConfigured.gemini}
                      className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                      title={!isServiceConfigured.gemini ? '請先設定 Gemini API Key' : '與 AI 深入對話'}
                    >
                      <ChatBubbleBrainIcon className="w-5 h-5 mr-2" />
                      與 AI 對話
                    </button>
                </div>
            </div>

            {/* Right Column: AI Analysis */}
            <div className="space-y-6">
                {aiReport && (
                    <div className="bg-gray-900/50 p-4 rounded-lg space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-lg font-semibold text-gray-200 flex items-center"><BrainCircuitIcon className="w-5 h-5 mr-2 text-purple-400" /> AI 初步分析</h4>
                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${getCategoryClass(aiReport.category)}`}>
                                {aiReport.category}
                            </span>
                        </div>
                       
                        <div>
                            <p className="text-xs text-purple-300 mb-1 font-semibold">篩選原因</p>
                            <p className="text-gray-300 text-sm bg-gray-900/50 p-3 rounded-md">{aiReport.reasoning}</p>
                        </div>
                        <div>
                            <p className="text-xs text-purple-300 mb-1 font-semibold">進場時機</p>
                            <p className="text-gray-300 text-sm bg-gray-900/50 p-3 rounded-md">{aiReport.entryAnalysis}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="bg-green-900/50 p-2 rounded-md">
                                <p className="text-xs text-green-300">支撐參考</p>
                                <p className="text-lg font-bold text-green-300">${aiReport.supportLevel.toFixed(2)}</p>
                            </div>
                            <div className="bg-red-900/50 p-2 rounded-md">
                                <p className="text-xs text-red-300">壓力參考</p>
                                <p className="text-lg font-bold text-red-300">${aiReport.resistanceLevel.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                  )}

                {aiReport && (
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                        {!collaborativeReport && !isCollaborating && (
                             <button
                                onClick={() => onStartCollaborativeAnalysis(stock.id)}
                                disabled={!isServiceConfigured.groq || !isServiceConfigured.gemini}
                                className="w-full flex items-center justify-center px-4 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                                title={!isServiceConfigured.groq || !isServiceConfigured.gemini ? '請先設定 Gemini 與 Groq API Keys' : '啟動 AI 協同分析'}
                             >
                                <ChatBubbleLeftRightIcon className="w-5 h-5 mr-2" />
                                啟動 AI 專家小組評比
                             </button>
                        )}
                        {isCollaborating && <CollaborationLoader progressMessage={collaborationProgress || '分析已開始...'} />}
                        {analysisError && (
                            <div className="text-center text-red-400 bg-red-900/30 p-3 rounded-lg">
                                <p className="font-semibold">分析錯誤</p>
                                <p className="text-xs mt-1">{analysisError}</p>
                            </div>
                        )}
                        {collaborativeReport && (
                            <CollaborativeReportDisplay report={collaborativeReport} />
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};