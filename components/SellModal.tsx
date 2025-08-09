import React, { useState, useEffect } from 'react';
import { PortfolioHolding } from '../types';

interface SellModalProps {
  holding: PortfolioHolding;
  onClose: () => void;
  onConfirm: (sellPrice: number, sharesToSell: number) => Promise<void>;
}

export const SellModal: React.FC<SellModalProps> = ({ holding, onClose, onConfirm }) => {
  const [sellPrice, setSellPrice] = useState(parseFloat(holding.currentPrice.toFixed(2)));
  const [sharesToSell, setSharesToSell] = useState(holding.shares);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    setIsLoading(true);
    try {
        await onConfirm(sellPrice, sharesToSell);
        // The modal will be closed by the parent component after onConfirm completes.
    } catch (error) {
        console.error("Error during sell confirmation:", error);
        setIsLoading(false); // Re-enable form if there's an error
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">賣出 {holding.name} ({holding.ticker})</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">賣出價格</label>
              <input
                type="number"
                step="0.01"
                value={sellPrice}
                onChange={e => setSellPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-700 text-white p-2 rounded"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">賣出股數 (持有: {holding.shares})</label>
              <input
                type="number"
                value={sharesToSell}
                max={holding.shares}
                min={1}
                onChange={e => setSharesToSell(parseInt(e.target.value) || 0)}
                className="w-full bg-gray-700 text-white p-2 rounded"
                disabled={isLoading}
              />
            </div>
             <div>
                <p className="text-sm text-gray-400">預估損益: 
                    <span className={`font-bold ${((sellPrice - holding.entryPrice) * sharesToSell) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {' '}${((sellPrice - holding.entryPrice) * sharesToSell).toFixed(2)}
                    </span>
                </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-gray-600 rounded disabled:opacity-50">取消</button>
            <button type="submit" disabled={isLoading || sharesToSell <= 0 || sellPrice <= 0} className="px-4 py-2 bg-red-600 rounded disabled:bg-red-800 disabled:cursor-wait">
              {isLoading ? '處理中...' : '確認賣出'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
