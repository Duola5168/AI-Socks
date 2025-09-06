import React from 'react';
import { StockData } from '../types';

interface StockInfoDisplayProps {
  stock: StockData;
}

const DataBox: React.FC<{ label: string; value: string | number; color?: string; large?: boolean }> = ({ label, value, color, large }) => (
    <div className={`flex flex-col items-center justify-center p-2 rounded-md ${large ? 'sm:col-span-2' : ''}`}>
        <span className="text-xs text-gray-400">{label}</span>
        <span className={`font-semibold ${large ? 'text-2xl' : 'text-base'} ${color || 'text-white'}`}>{value}</span>
    </div>
);

const formatNumber = (num?: number, decimals = 2): string => {
    if (num === null || typeof num === 'undefined') return 'N/A';
    return num.toFixed(decimals);
};

const formatBigNumber = (num?: number): string => {
    if (num === null || typeof num === 'undefined') return 'N/A';
    if (num >= 100000000) {
        return `${(num / 100000000).toFixed(2)}億`;
    }
    if (num >= 10000) {
        return `${(num / 10000).toFixed(2)}萬`;
    }
    return num.toLocaleString();
};

export const StockInfoDisplay: React.FC<StockInfoDisplayProps> = ({ stock }) => {
    if (stock.kline.length < 2) {
        return <div className="text-center text-gray-500 p-4">數據不足，無法顯示詳細報價。</div>;
    }
    const latest = stock.kline[stock.kline.length - 1];
    const prev = stock.kline[stock.kline.length - 2];

    const change = latest.close - prev.close;
    const changePercent = (change / prev.close) * 100;
    const amplitude = (latest.high - latest.low) / prev.close * 100;

    const color = change > 0 ? 'text-red-400' : change < 0 ? 'text-green-400' : 'text-gray-300';
    const sign = change > 0 ? '+' : '';

    return (
        <div className="bg-gray-900/50 p-4 rounded-lg">
             <div className="flex justify-between items-center mb-4">
                 <h2 className="text-2xl font-bold text-white">{stock.name} ({stock.ticker})</h2>
                 <p className="text-xs text-gray-500">資料日期: {latest.time}</p>
             </div>
             <div className="grid grid-cols-3 sm:grid-cols-5 border-t border-b border-gray-700 divide-x divide-gray-700">
                <DataBox label="成交價" value={formatNumber(latest.close)} color={color} large />
                <DataBox label="昨收" value={formatNumber(prev.close)} />
                <DataBox label="漲跌價" value={`${sign}${formatNumber(change)}`} color={color} />
                <DataBox label="漲跌幅" value={`${sign}${formatNumber(changePercent)}%`} color={color} />
                <DataBox label="振幅" value={`${formatNumber(amplitude)}%`} />
                <DataBox label="開盤" value={formatNumber(latest.open)} />
                <DataBox label="最高" value={formatNumber(latest.high)} />
                <DataBox label="最低" value={formatNumber(latest.low)} />
             </div>
             <div className="grid grid-cols-3 sm:grid-cols-5 mt-2 divide-x divide-gray-700">
                <DataBox label="成交張數" value={(latest.volume! / 1000).toLocaleString('en-US', {maximumFractionDigits: 0})} />
                <DataBox label="成交金額" value={formatBigNumber(stock.tradeValue)} />
                <DataBox label="PBR" value={formatNumber(stock.pbRatio)} />
                <DataBox label="PER" value={formatNumber(stock.peRatio)} />
                <DataBox label="PEG" value="N/A" />
             </div>
        </div>
    );
};