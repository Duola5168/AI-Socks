
import { collection, getDocs } from '@firebase/firestore';
import { db } from './firebase';
import { PartialStockData } from '../types';

const DB_NAME = 'AIInvestorMarketDB';
const DB_VERSION = 1;

const STORES = {
    METADATA: 'metadata',
    MARKET_CACHE: 'market_cache',
};

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORES.METADATA)) {
                db.createObjectStore(STORES.METADATA);
            }
            if (!db.objectStoreNames.contains(STORES.MARKET_CACHE)) {
                const store = db.createObjectStore(STORES.MARKET_CACHE, { keyPath: 'id' });
                store.createIndex('ticker', 'ticker', { unique: false });
            }
        };
    });
};

const fetchAllStocksFromFirestore = async (onProgress: (message: string) => void): Promise<PartialStockData[]> => {
    if (!db) {
        throw new Error("Firebase is not configured or initialized.");
    }
    onProgress("正在連接 Firestore...");
    // Per the spec, the main stock data resides in the 'stocks' collection.
    const stocksCollectionRef = collection(db, 'stocks');
    const snapshot = await getDocs(stocksCollectionRef);

    if (snapshot.empty) {
        onProgress("警告: 雲端 'stocks' 資料庫是空的。");
        return [];
    }
    // The data in Firestore should match PartialStockData for the list view.
    return snapshot.docs.map(doc => doc.data() as PartialStockData);
};

export const updateAllMarketData = async (onProgress: (message: string) => void): Promise<void> => {
    onProgress("開始從雲端同步資料庫...");
    const dbInstance = await openDB();
    
    try {
        const stocks = await fetchAllStocksFromFirestore(onProgress);
        if (stocks.length === 0) {
            onProgress("雲端資料庫是空的，無需同步。請確保後端數據管道正常運作。");
            return;
        }

        onProgress(`從雲端獲取 ${stocks.length} 筆資料，正在寫入本地快取...`);
        
        const tx = dbInstance.transaction(STORES.MARKET_CACHE, 'readwrite');
        const store = tx.objectStore(STORES.MARKET_CACHE);
        
        // Clear before writing
        await new Promise<void>((resolve, reject) => {
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = (event) => reject((event.target as IDBRequest).error);
        });

        for (const stock of stocks) {
            store.put(stock);
        }
        
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        // Update timestamp in metadata
        const metaTx = dbInstance.transaction(STORES.METADATA, 'readwrite');
        const metaStore = metaTx.objectStore(STORES.METADATA);
        metaStore.put({ timestamp: new Date().toISOString() }, 'lastUpdate');
        
        await new Promise<void>((resolve, reject) => {
            metaTx.oncomplete = () => resolve();
            metaTx.onerror = () => reject(metaTx.error);
        });
        
        onProgress("本地市場數據庫同步完成！");

    } catch (error: any) {
        onProgress(`錯誤: 同步失敗 - ${error.message}`);
        console.error("updateAllMarketData failed:", error);
        throw error;
    }
};

export const getMarketData = async (): Promise<PartialStockData[]> => {
    const db = await openDB();
    const tx = db.transaction(STORES.MARKET_CACHE, 'readonly');
    const store = tx.objectStore(STORES.MARKET_CACHE);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
};

export const getUpdateTimestamp = async (): Promise<string | null> => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORES.METADATA, 'readonly');
        const store = tx.objectStore(STORES.METADATA);
        const request = store.get('lastUpdate');

        return new Promise((resolve) => {
            request.onerror = () => resolve(null);
            request.onsuccess = () => resolve(request.result ? request.result.timestamp : null);
        });
    } catch (error) {
        console.error("Could not get timestamp from DB:", error);
        return null;
    }
};
