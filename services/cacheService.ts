import { StockData } from '../types';

const DB_NAME = 'AIInvestorDB';
const STORE_NAME = 'StockDataCache';
const DB_VERSION = 1;
const CACHE_KEY = 'latestStockData';

interface CachedData {
    id: string; // The fixed key, e.g., 'latestStockData'
    date: string; // Store date as YYYY-MM-DD string
    stocks: StockData[];
    timestamp: number; // ISO string for more precise timing
}

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const saveStockDataToCache = async (stocks: StockData[]): Promise<void> => {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const today = new Date().toISOString().split('T')[0];
        store.put({ id: CACHE_KEY, date: today, stocks, timestamp: new Date().getTime() });
    } catch (error) {
        console.error('Failed to save stock data to cache:', error);
    }
};

export const loadStockDataFromCache = async (): Promise<StockData[] | null> => {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(CACHE_KEY);

        return new Promise((resolve, reject) => {
            request.onerror = () => {
                console.error('Failed to load from cache:', request.error);
                reject(request.error);
            };
            request.onsuccess = () => {
                const data: CachedData | undefined = request.result;
                const today = new Date().toISOString().split('T')[0];
                if (data && data.date === today) {
                    console.log("Cache hit for today's data.");
                    resolve(data.stocks);
                } else {
                    console.log("Cache miss or outdated.");
                    resolve(null);
                }
            };
        });
    } catch (error) {
        console.error('Failed to open DB for loading:', error);
        return null;
    }
};

export const getCacheTimestamp = async (): Promise<number | null> => {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(CACHE_KEY);

        return new Promise((resolve) => {
            request.onerror = () => {
                console.error('Failed to get cache timestamp:', request.error);
                resolve(null);
            };
            request.onsuccess = () => {
                const data: CachedData | undefined = request.result;
                resolve(data ? data.timestamp : null);
            };
        });
    } catch (error) {
        console.error('Failed to open DB for timestamp:', error);
        return null;
    }
};