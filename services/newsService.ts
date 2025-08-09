import { NewsArticle } from '../types';
import { getCache, setCache } from './firestoreService';
import { config } from './config';
import { sleep } from './utils';

const CACHE_TTL_NEWS = 1000 * 60 * 60 * 24; // 24 hours
const MAX_REQUESTS_PER_DAY = 95; // Safety margin below 100

// --- API Quota Management ---

const getNewsApiTimestamps = (): number[] => {
    const item = localStorage.getItem('newsApiTimestamps');
    if (!item) return [];
    try {
        const timestamps = JSON.parse(item);
        return Array.isArray(timestamps) && timestamps.every(ts => typeof ts === 'number') ? timestamps : [];
    } catch {
        return [];
    }
};

const recordNewsApiRequest = () => {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const recentTimestamps = getNewsApiTimestamps().filter(ts => ts > oneDayAgo);
    recentTimestamps.push(now);
    localStorage.setItem('newsApiTimestamps', JSON.stringify(recentTimestamps));
};

export const getNewsApiQuotaStatus = (): { used: number; limit: number } => {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const recentTimestamps = getNewsApiTimestamps().filter(ts => ts > oneDayAgo);
    return { used: recentTimestamps.length, limit: MAX_REQUESTS_PER_DAY };
};


// --- Fetching Logic ---

const isCacheValid = (lastUpdated: string, ttl: number): boolean => {
    return (new Date().getTime() - new Date(lastUpdated).getTime()) < ttl;
};

async function fetchWithNewsCache(
    userId: string | undefined,
    cacheDocId: string,
    fetchFn: () => Promise<NewsArticle[]>
): Promise<NewsArticle[]> {
    if (userId) {
        try {
            const cache = await getCache(userId, 'cache_news', cacheDocId);
            if (cache && isCacheValid(cache.lastUpdated, CACHE_TTL_NEWS)) {
                return cache.data as NewsArticle[];
            }
        } catch (e) {
            console.warn(`Failed to read from Firestore news cache for ${cacheDocId}. Fetching from API.`, e);
        }
    }
    const data = await fetchFn();
    if (userId && data) {
        try {
            await setCache(userId, 'cache_news', cacheDocId, data);
        } catch (e) {
            console.warn(`Failed to write to Firestore news cache for ${cacheDocId}.`, e);
        }
    }
    return data;
}

export const fetchNewsForStock = async (
    stockName: string,
    ticker: string,
    userId?: string
): Promise<NewsArticle[]> => {
    if (!config.newsApiKey) {
        throw new Error("News API Key is not configured.");
    }
    
    const quota = getNewsApiQuotaStatus();
    if (quota.used >= quota.limit) {
        throw new Error(`News API 每日請求額度已達上限 (${quota.used}/${quota.limit})。`);
    }
    
    const fetchFn = async (): Promise<NewsArticle[]> => {
        // Construct a more precise query
        const query = `("${stockName}" OR "${ticker}") AND (公司 OR 股票 OR 營收 OR 財報) NOT "ETF"`;
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 7); // Look back 7 days for recent news
        const fromDateString = fromDate.toISOString().split('T')[0];

        const urlParams = new URLSearchParams({
            source: 'newsapi',
            q: query,
            language: 'zh',
            sortBy: 'relevancy',
            pageSize: '20',
            from: fromDateString,
        });
        const url = `/.netlify/functions/stock-api?${urlParams.toString()}`;

        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`News API proxy error: ${errorData.error || response.statusText}`);
        }
        
        recordNewsApiRequest();

        const result = await response.json();
        
        return result.articles.map((article: any) => ({
            title: article.title,
            description: article.description || '',
            url: article.url,
            publishedAt: article.publishedAt,
        }));
    };

    return fetchWithNewsCache(userId, ticker, fetchFn);
};