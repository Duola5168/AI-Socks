import React, { useState, useMemo, useEffect } from 'react';
import { PortfolioHolding, PartialStockData } from '../types';

interface AddHoldingModalProps {
  onClose: () => void;
  onConfirm: (stock: PartialStockData, shares: number, price: number) => Promise<void> | void;
  allStocks: PartialStockData[];
  portfolio: PortfolioHolding[];
}

export const AddHoldingModal: React.FC<AddHoldingModalProps> = ({ onClose, onConfirm, allStocks, portfolio }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStock, setSelectedStock] = useState<PartialStockData | null>(null);
  const [shares, setShares] = useState(1); // Default to 1 share for flexibility in manual entry
  const [price, setPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const portfolioIds = useMemo(() => new Set(portfolio.map(p => p.id)), [portfolio]);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            onClose();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const filteredStocks = useMemo(() => {
    if (!searchTerm) return [];
    return allStocks.filter(stock => 
      (stock.ticker.includes(searchTerm) || stock.name.toLowerCase().includes(searchTerm.toLowerCase()))
      && !portfolioIds.has(stock.id)
    ).slice(0, 5);
  }, [searchTerm, allStocks, portfolioIds]);

  const handleSelectStock = (stock: PartialStockData) => {
    setSelectedStock(stock);
    setPrice(stock.close ?? 0);
    setSearchTerm(`${stock.name} (${stock.ticker})`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStock && shares > 0 && price > 0) {
      setIsLoading(true);
      await onConfirm(selectedStock, shares, price);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">手動新增持股</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="relative">
              <label className="text-sm text-gray-400 block mb-1">搜尋股票 (代號或名稱)</label>
              <input
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setSelectedStock(null);
                }}
                className="w-full bg-gray-700 text-white p-2 rounded"
                placeholder="例如: 2330 或 台積電"
              />
              {filteredStocks.length > 0 && !selectedStock && (
                <ul className="absolute z-10 w-full bg-gray-600 border border-gray-500 rounded-md mt-1 max-h-40 overflow-y-auto">
                  {filteredStocks.map(stock => (
                    <li
                      key={stock.id}
                      onClick={() => handleSelectStock(stock)}
                      className="px-3 py-2 hover:bg-cyan-700 cursor-pointer"
                    >
                      {stock.name} ({stock.ticker})
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedStock && (
              <>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">股數</label>
                  <input
                    type="number"
                    value={shares}
                    onChange={e => setShares(parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-700 text-white p-2 rounded"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">買入價格</label>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-gray-700 text-white p-2 rounded"
                  />
                </div>
              </>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded">取消</button>
            <button type="submit" disabled={!selectedStock || shares <= 0 || price <= 0 || isLoading} className="px-4 py-2 bg-cyan-600 rounded disabled:bg-gray-500 disabled:opacity-50 disabled:cursor-wait">
              {isLoading ? '處理中...' : '確認新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};