import React from 'react';
import { PortfolioHolding, Alert, AlertType } from '../types';
import { TrendingUpIcon, CheckCircleIcon, XCircleIcon, DollarSignIcon, ChevronDownIcon, HistoryIcon, ArchiveBoxIcon, ArrowUpOnSquareIcon } from './icons';

interface PortfolioItemProps {
  holding: PortfolioHolding;
  alert?: Alert;
  isExpanded: boolean;
  onSellClick: (holding: PortfolioHolding) => void;
  onDetailClick: () => void;
  onToggleTrackingMode: (holdingId: string) => void;
  isToggleDisabled: boolean;
}

export const PortfolioItem: React.FC<PortfolioItemProps> = ({ holding, alert, isExpanded, onSellClick, onDetailClick, onToggleTrackingMode, isToggleDisabled }) => {
  const { entryPrice, currentPrice, name, ticker, shares, trackingMode } = holding;
  const pnl = (currentPrice - entryPrice) * shares;
  const pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
  const isProfit = pnl >= 0;
  const isWatched = trackingMode === 'watch';

  const getAlertUI = () => {
    if (!alert) return null;
    const commonClasses = "text-xs font-semibold flex items-center";
    let alertDiv;

    switch (alert.type) {
        case AlertType.StopLoss:
            alertDiv = <div className={`${commonClasses} text-red-400`}><XCircleIcon className="w-4 h-4 mr-1"/>{alert.type}</div>;
            break;
        case AlertType.TakeProfit:
            alertDiv = <div className={`${commonClasses} text-yellow-400`}><DollarSignIcon className="w-4 h-4 mr-1"/>{alert.type}</div>;
            break;
        case AlertType.Review:
            alertDiv = <div className={`${commonClasses} text-purple-400`}><HistoryIcon className="w-4 h-4 mr-1"/>{alert.type}</div>;
            break;
        case AlertType.Hold:
        default:
            alertDiv = <div className={`${commonClasses} text-blue-400`}><TrendingUpIcon className="w-4 h-4 mr-1"/>{alert.type}</div>;
            break;
    }
    // Add title attribute to the container for tooltip
    return React.cloneElement(alertDiv, { title: alert.message });
  }

  return (
    <div
      className={`bg-gray-800/60 border border-gray-700 hover:bg-gray-700/50 transition-all duration-200 cursor-pointer ${isExpanded ? 'rounded-t-lg' : 'rounded-lg'} ${isWatched ? 'opacity-80 border-blue-800' : ''}`}
      onClick={onDetailClick}
    >
      <div className="flex items-center justify-between space-x-2 sm:space-x-4">
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-bold text-white text-base sm:text-lg">{name}</p>
                {isWatched && <span className="text-xs bg-blue-900/70 text-blue-300 px-2 py-0.5 rounded-full">長期追蹤</span>}
              </div>
              {getAlertUI()}
          </div>
          <p className="text-sm text-gray-400">{ticker} &bull; {shares} 股</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
            <p className="text-gray-400">成本: <span className="text-gray-200">${entryPrice.toFixed(2)}</span></p>
            <p className="text-gray-400">現價: <span className="text-gray-200">${currentPrice.toFixed(2)}</span></p>
          </div>
        </div>
        <div className="text-right p-4">
          <p className={`text-lg font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
          </p>
          <p className={`text-sm font-semibold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
            ({pnlPercent.toFixed(2)}%)
          </p>
        </div>
        <div className="flex items-center space-x-2 p-4">
            <button
              onClick={(e) => {
                  e.stopPropagation();
                  onToggleTrackingMode(holding.id);
              }}
              disabled={isWatched && isToggleDisabled}
              title={isWatched ? (isToggleDisabled ? "短期交易部位已滿" : "移回短期交易") : "移至長期追蹤"}
              className="p-2 text-gray-300 rounded-md hover:bg-gray-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors z-10 relative"
            >
              {isWatched ? <ArrowUpOnSquareIcon className="w-5 h-5" /> : <ArchiveBoxIcon className="w-5 h-5" />}
            </button>
            <button 
              onClick={(e) => {
                  e.stopPropagation();
                  onSellClick(holding);
              }}
              className="px-3 py-1 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-500 transition-colors z-10 relative">
              賣出
            </button>
            <ChevronDownIcon className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${isExpanded ? 'transform rotate-180' : ''}`} />
        </div>
      </div>
    </div>
  );
};
