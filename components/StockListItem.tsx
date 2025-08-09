import React from 'react';
import { ScoredStock } from '../types';
import { TrendingUpIcon } from './icons';

interface StockListItemProps {
    scoredStock: ScoredStock;
    onSelect: () => void;
    animationDelay: number;
}

export const StockListItem: React.FC<StockListItemProps> = ({ scoredStock, onSelect, animationDelay }) => {
    const { stock, score } = scoredStock;
    const currentPrice = stock.kline[stock.kline.length - 1]?.close ?? stock.close ?? 0;

    return (
        <div
            className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:bg-gray-700/60 hover:border-cyan-500/50 transition-all duration-200 cursor-pointer fade-in-up opacity-0"
            style={{ animationDelay: `${animationDelay}ms` }}
            onClick={onSelect}
        >
            <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-white truncate">{stock.name}</p>
                <p className="text-sm text-gray-400">{stock.ticker}</p>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
                <div className="text-right">
                    <p className="text-lg font-semibold text-gray-200">${currentPrice.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">當前股價</p>
                </div>
                 <div className="text-right">
                    <p className="text-xl font-bold text-cyan-400">{score}</p>
                    <p className="text-xs text-gray-500">策略評分</p>
                </div>
                <button
                    onClick={onSelect}
                    className="px-4 py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-500 transition-colors hidden sm:block"
                >
                    查看分析
                </button>
                 <TrendingUpIcon className="w-6 h-6 text-gray-500 sm:hidden" />
            </div>
        </div>
    );
};
