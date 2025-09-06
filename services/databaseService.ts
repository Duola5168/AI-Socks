// services/databaseService.ts
import { PartialStockData, KLineData } from '../types';

const DB_NAME = 'AIInvestorDB';
const DB_VERSION = 2;
const STOCKS_STORE_NAME = 'stocks';

let db: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject("Error opening DB");
    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const tempDb = (event.target as IDBOpenDBRequest).result;
      if (!tempDb.objectStoreNames.contains(STOCKS_STORE_NAME)) {
        tempDb.createObjectStore(STOCKS_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveAllStocks = async (stocks: PartialStockData[]): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction(STOCKS_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STOCKS_STORE_NAME);
  
  stocks.forEach(stock => {
      store.put(stock);
  });

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject("Error saving stocks to IndexedDB");
  });
};

export const loadAllStocks = async (): Promise<PartialStockData[]> => {
    const db = await openDB();
    const transaction = db.transaction(STOCKS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(STOCKS_STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Error loading stocks from IndexedDB");
    });
};

export const getLatestTimestampInCache = async (): Promise<string | null> => {
    const stocks = await loadAllStocks();
    if (stocks.length === 0) return null;

    let latestDate: string | null = null;
    stocks.forEach(stock => {
        if (stock.kline && stock.kline.length > 0) {
            const lastKline = stock.kline[stock.kline.length - 1];
            if (!latestDate || lastKline.time > latestDate) {
                latestDate = lastKline.time;
            }
        }
    });
    return latestDate;
};