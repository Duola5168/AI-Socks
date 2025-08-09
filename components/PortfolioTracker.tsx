import React, { useState, useMemo } from 'react';
import { PortfolioHolding, Alert, StockData, PartialStockData } from '../types';
import { PortfolioItem } from './PortfolioItem';
import { AddHoldingModal } from './AddHoldingModal';
import { SellModal } from './SellModal';
import { PortfolioItemDetail } from './PortfolioItemDetail';
import { PlusCircleIcon, LightbulbIcon } from './icons';
import { AddToPortfolioOptions } from '../hooks/useUserData';

const MAX_ACTIVE_PORTFOLIO_SIZE = 5;

// New type for holdings with alerts attached
type PortfolioHoldingWithAlert = PortfolioHolding & { alert?: Alert };

interface PortfolioTrackerProps {
  holdings: PortfolioHolding[];
  alerts: Alert[];
  onSell: (holding: PortfolioHolding, sellPrice: number, shares: number) => Promise<void>;
  onAddToPortfolio: (options: AddToPortfolioOptions) => Promise<boolean>;
  onToggleTrackingMode: (holdingId: string) => void;
  isPortfolioFull: boolean;
  allStocks: PartialStockData[];
}

export const PortfolioTracker: React.FC<PortfolioTrackerProps> = ({ holdings, alerts, onSell, onAddToPortfolio, onToggleTrackingMode, isPortfolioFull, allStocks }) => {
  const [sellModalHolding, setSellModalHolding] = useState<PortfolioHolding | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const { totalValue, totalCost, totalPnl, totalPnlPercent, activeHoldings, watchedHoldings } = useMemo(() => {
    const totalCost = holdings.reduce((sum, h) => sum + h.entryPrice * h.shares, 0);
    const totalValue = holdings.reduce((sum, h) => sum + h.currentPrice * h.shares, 0);
    const totalPnl = totalValue - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    
    const alertMap = new Map(alerts.map(a => [a.ticker, a]));
    const holdingsWithAlerts: PortfolioHoldingWithAlert[] = holdings.map(h => ({
        ...h,
        alert: alertMap.get(h.ticker)
    }));
    
    // Filter holdings based on trackingMode
    const activeHoldings = holdingsWithAlerts.filter(h => (h.trackingMode ?? 'active') === 'active');
    const watchedHoldings = holdingsWithAlerts.filter(h => h.trackingMode === 'watch');


    return { totalValue, totalCost, totalPnl, totalPnlPercent, activeHoldings, watchedHoldings };
  }, [holdings, alerts]);

  const handleSellClick = (holding: PortfolioHolding) => {
    setSellModalHolding(holding);
  };

  const handleConfirmSell = async (sellPrice: number, sharesToSell: number) => {
    if (sellModalHolding) {
      await onSell(sellModalHolding, sellPrice, sharesToSell);
    }
    setSellModalHolding(null);
  };
  
  const handleAddToPortfolioConfirm = async (stock: PartialStockData, shares: number, price: number) => {
      const success = await onAddToPortfolio({ stock, shares, entryPrice: price });
      if (success) {
        setIsAddModalOpen(false);
      }
  }

  return (
    <div className="space-y-8">
      <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-white">投資組合與即時監控</h2>
                <p className="text-gray-400 mt-1">此處顯示您的持股與系統監控狀態，每分鐘自動更新。最多持有 {MAX_ACTIVE_PORTFOLIO_SIZE} 檔短期交易。</p>
            </div>
            <button
                onClick={() => setIsAddModalOpen(true)}
                disabled={isPortfolioFull}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
                <PlusCircleIcon className="w-5 h-5"/>
                手動新增持股
            </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-center">
            <div className="bg-gray-900/50 p-3 rounded-md">
                <p className="text-sm text-gray-400">總市值</p>
                <p className="font-bold text-lg text-white">${totalValue.toFixed(2)}</p>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-md">
                <p className="text-sm text-gray-400">總成本</p>
                <p className="font-bold text-lg text-white">${totalCost.toFixed(2)}</p>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-md">
                <p className="text-sm text-gray-400">總損益</p>
                <p className={`font-bold text-lg ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
                </p>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-md">
                <p className="text-sm text-gray-400">總報酬率</p>
                <p className={`font-bold text-lg ${totalPnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalPnlPercent.toFixed(2)}%
                </p>
            </div>
        </div>
      </div>
      
      <div className="bg-blue-900/20 border border-blue-800/50 text-blue-300 px-4 py-3 rounded-lg flex items-start gap-3">
        <LightbulbIcon className="w-6 h-6 mt-0.5 shrink-0 text-blue-400" />
        <p className="text-sm">
            <strong>智慧提示：</strong>系統會根據您的策略提供動態警示。將滑鼠懸停在標籤上或點擊展開項目，即可查看詳細建議。
        </p>
      </div>


      <div>
          <h3 className="text-xl font-semibold text-gray-200 mb-4">短期交易部位 ({activeHoldings.length}/{MAX_ACTIVE_PORTFOLIO_SIZE})</h3>
          <div className="space-y-2">
            {activeHoldings.length > 0 ? activeHoldings.map((holding, index) => (
              <div key={holding.id} style={{ animationDelay: `${index * 100}ms` }} className="fade-in-up opacity-0">
                <PortfolioItem
                  holding={holding}
                  alert={holding.alert}
                  onSellClick={handleSellClick}
                  onDetailClick={() => setExpandedItemId(expandedItemId === holding.id ? null : holding.id)}
                  isExpanded={expandedItemId === holding.id}
                  onToggleTrackingMode={onToggleTrackingMode}
                  isToggleDisabled={false}
                />
                {expandedItemId === holding.id && (
                  <PortfolioItemDetail 
                    holding={holding} 
                    stockData={allStocks.find(s => s.id === holding.id)}
                    alert={holding.alert}
                  />
                )}
              </div>
            )) : <p className="text-gray-500 text-center py-4">無短期交易持股。</p>}
          </div>
      </div>
      
      <div>
          <h3 className="text-xl font-semibold text-gray-200 mb-4">長期追蹤部位 ({watchedHoldings.length})</h3>
          <div className="space-y-2">
             {watchedHoldings.length > 0 ? watchedHoldings.map((holding, index) => (
              <div key={holding.id} style={{ animationDelay: `${(activeHoldings.length + index) * 100}ms` }} className="fade-in-up opacity-0">
                <PortfolioItem
                  holding={holding}
                  alert={undefined} // No alerts for watched items
                  onSellClick={handleSellClick}
                  onDetailClick={() => setExpandedItemId(expandedItemId === holding.id ? null : holding.id)}
                  isExpanded={expandedItemId === holding.id}
                  onToggleTrackingMode={onToggleTrackingMode}
                  isToggleDisabled={isPortfolioFull}
                />
                {expandedItemId === holding.id && (
                  <PortfolioItemDetail 
                    holding={holding} 
                    stockData={allStocks.find(s => s.id === holding.id)}
                    alert={undefined}
                  />
                )}
              </div>
            )) : <p className="text-gray-500 text-center py-4">無長期追蹤持股。</p>}
          </div>
      </div>


      {sellModalHolding && (
        <SellModal
          holding={sellModalHolding}
          onClose={() => setSellModalHolding(null)}
          onConfirm={handleConfirmSell}
        />
      )}
      {isAddModalOpen && (
          <AddHoldingModal 
            onClose={() => setIsAddModalOpen(false)}
            onConfirm={handleAddToPortfolioConfirm}
            allStocks={allStocks}
            portfolio={holdings}
          />
      )}
    </div>
  );
};