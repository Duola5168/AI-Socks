import React from 'react';
import { PortfolioHolding, StockData, Alert, AlertType } from '../types';
import { XCircleIcon, DollarSignIcon, CheckCircleIcon, HistoryIcon } from './icons';
import StockChart from './StockChart';

interface PortfolioItemDetailProps {
  holding: PortfolioHolding;
  stockData?: Partial<StockData>;
  alert?: Alert;
}

const AlertInfoBox: React.FC<{ alert: Alert }> = ({ alert }) => {
    const getAlertStyle = () => {
        switch (alert.type) {
            case AlertType.StopLoss:
                return {
                    icon: <XCircleIcon className="w-6 h-6 mr-3" />,
                    bgColor: 'bg-red-900/50',
                    borderColor: 'border-red-700',
                    textColor: 'text-red-300',
                    title: '停損警示'
                };
            case AlertType.TakeProfit:
                return {
                    icon: <DollarSignIcon className="w-6 h-6 mr-3" />,
                    bgColor: 'bg-yellow-900/50',
                    borderColor: 'border-yellow-700',
                    textColor: 'text-yellow-300',
                    title: '停利建議'
                };
            case AlertType.Review:
                 return {
                    icon: <HistoryIcon className="w-6 h-6 mr-3" />,
                    bgColor: 'bg-purple-900/50',
                    borderColor: 'border-purple-700',
                    textColor: 'text-purple-300',
                    title: '週五複盤建議'
                };
            case AlertType.Hold:
            default:
                 return {
                    icon: <CheckCircleIcon className="w-6 h-6 mr-3" />,
                    bgColor: 'bg-blue-900/50',
                    borderColor: 'border-blue-700',
                    textColor: 'text-blue-300',
                    title: '續抱建議'
                };
        }
    }

    const { icon, bgColor, borderColor, textColor, title } = getAlertStyle();

    return (
        <div className={`p-4 rounded-lg border ${bgColor} ${borderColor}`}>
            <div className={`flex items-center text-lg font-bold ${textColor}`}>
                {icon}
                <h4>{title}</h4>
            </div>
            <p className="mt-2 text-gray-300 pl-9">{alert.message}</p>
        </div>
    );
};


export const PortfolioItemDetail: React.FC<PortfolioItemDetailProps> = ({ holding, stockData, alert }) => {
  return (
    <div className="bg-gray-800 border border-t-0 border-gray-700 rounded-b-lg p-4 sm:p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-gray-900/50 p-3 rounded-md">
              <p className="text-sm text-gray-400">持有股數</p>
              <p className="font-bold text-lg">{holding.shares}</p>
          </div>
            <div className="bg-gray-900/50 p-3 rounded-md">
              <p className="text-sm text-gray-400">平均成本</p>
              <p className="font-bold text-lg">${holding.entryPrice.toFixed(2)}</p>
          </div>
            <div className="bg-gray-900/50 p-3 rounded-md">
              <p className="text-sm text-gray-400">目前市價</p>
              <p className="font-bold text-lg">${holding.currentPrice.toFixed(2)}</p>
          </div>
            <div className="bg-gray-900/50 p-3 rounded-md">
              <p className="text-sm text-gray-400">未實現損益</p>
                <p className={`font-bold text-lg ${(holding.currentPrice - holding.entryPrice) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${((holding.currentPrice - holding.entryPrice) * holding.shares).toFixed(2)}
              </p>
          </div>
      </div>
      
      {alert && (
        <div>
          <h4 className="text-md font-semibold mb-3 text-cyan-400">系統監控建議</h4>
          <AlertInfoBox alert={alert} />
        </div>
      )}

      <div>
          <h4 className="text-md font-semibold mb-2 text-gray-300">K線圖與均線 (MA5/MA20)</h4>
          {stockData && stockData.kline ? <StockChart klineData={stockData.kline} entryPrice={holding.entryPrice} /> : <p className="text-gray-500 text-center py-10">無詳細 K 線資料可供顯示。</p>}
      </div>
    </div>
  );
};