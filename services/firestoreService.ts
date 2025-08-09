import { db } from './firebase';
import { PortfolioHolding, TradeHistory, StrategySettings } from '../types';
import { 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    updateDoc, 
    deleteDoc, 
    writeBatch 
} from '@firebase/firestore';

// --- Cache Functions ---

interface CacheContainer {
    lastUpdated: string; // ISO string
    data: any;
}

export const getCache = async (userId: string, collectionName: string, docId: string): Promise<CacheContainer | null> => {
    if (!db || !userId) return null;
    try {
        const cacheDocRef = doc(db, 'users', userId, collectionName, docId);
        const docSnap = await getDoc(cacheDocRef);
        if (docSnap.exists()) {
            return docSnap.data() as CacheContainer;
        }
        return null;
    } catch (error) {
        console.error(`Error getting cache for ${collectionName}/${docId}:`, error);
        return null;
    }
};

export const setCache = async (userId: string, collectionName: string, docId: string, data: any): Promise<void> => {
    if (!db || !userId) return;
    try {
        const cacheDocRef = doc(db, 'users', userId, collectionName, docId);
        const cacheContainer: CacheContainer = {
            lastUpdated: new Date().toISOString(),
            data: data
        };
        await setDoc(cacheDocRef, cacheContainer);
    } catch (error) {
        console.error(`Error setting cache for ${collectionName}/${docId}:`, error);
    }
};


// --- Portfolio Functions ---

export const getPortfolio = async (userId: string): Promise<PortfolioHolding[]> => {
  if (!db) return [];
  const portfolioCollectionRef = collection(db, 'users', userId, 'portfolio');
  const snapshot = await getDocs(portfolioCollectionRef);
  return snapshot.docs.map(doc => doc.data() as PortfolioHolding);
};

export const addHolding = async (userId:string, holding: PortfolioHolding): Promise<void> => {
  if (!db) return;
  const holdingDocRef = doc(db, 'users', userId, 'portfolio', holding.id);
  await setDoc(holdingDocRef, holding);
};

export const updateHolding = async (userId: string, holdingId: string, data: Partial<PortfolioHolding>): Promise<void> => {
  if (!db) return;
  const holdingDocRef = doc(db, 'users', userId, 'portfolio', holdingId);
  await updateDoc(holdingDocRef, data);
};

export const deleteHolding = async (userId: string, holdingId: string): Promise<void> => {
  if (!db) return;
  const holdingDocRef = doc(db, 'users', userId, 'portfolio', holdingId);
  await deleteDoc(holdingDocRef);
};

export const updatePortfolioBatch = async (userId: string, portfolio: PortfolioHolding[]): Promise<void> => {
    if (!db) return;
    const batch = writeBatch(db);
    portfolio.forEach(holding => {
        const docRef = doc(db, 'users', userId, 'portfolio', holding.id);
        const holdingToSave: { [key: string]: any } = { ...holding };
        
        // Firestore doesn't like `undefined` values. Let's clean them up.
        Object.keys(holdingToSave).forEach(key => {
            if (holdingToSave[key] === undefined) {
                delete holdingToSave[key];
            }
        });

        // Using set with merge instead of update to handle all fields safely
        // This will update existing fields and add new ones (like notifiedStopLoss) if they exist
        batch.set(docRef, holdingToSave, { merge: true });
    });
    await batch.commit();
};


// --- Trade History Functions ---

export const getTradeHistory = async (userId: string): Promise<TradeHistory[]> => {
    if (!db) return [];
    const tradeHistoryCollectionRef = collection(db, 'users', userId, 'tradeHistory');
    const q = query(tradeHistoryCollectionRef, orderBy('sellDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as TradeHistory);
};

export const addTradeHistory = async (userId: string, trade: TradeHistory): Promise<void> => {
    if (!db) return;
    const tradeDocRef = doc(db, 'users', userId, 'tradeHistory', trade.id);
    await setDoc(tradeDocRef, trade);
};

export const updateTradeHistory = async (userId: string, tradeId: string, data: Partial<TradeHistory>): Promise<void> => {
    if (!db) return;
    const tradeDocRef = doc(db, 'users', userId, 'tradeHistory', tradeId);
    await updateDoc(tradeDocRef, data);
};

// --- Strategy Settings Functions ---

export const getSettings = async (userId: string): Promise<StrategySettings | null> => {
  if (!db) return null;
  const settingsDocRef = doc(db, 'users', userId, 'appData', 'strategySettings');
  const docSnap = await getDoc(settingsDocRef);
  return docSnap.exists() ? docSnap.data() as StrategySettings : null;
};

export const saveSettings = async (userId: string, settings: StrategySettings): Promise<void> => {
  if (!db) return;
  const settingsDocRef = doc(db, 'users', userId, 'appData', 'strategySettings');
  await setDoc(settingsDocRef, settings, { merge: true });
};