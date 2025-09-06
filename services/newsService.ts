import { NewsArticle } from '../types';
import { getCache, setCache } from './firestoreService';
import { config, IS_NEWS_CONFIGURED, IS_NEWS2_CONFIGURED } from './config';

const CACHE_TTL_NEWS = 1000 * 60 * 30; // 30 minutes for individual stock news
const MARKET_NEWS_CACHE_KEY_API1 = 'marketNewsCacheApi1';
const MARKET_NEWS_CACHE_TTL_API1 = 1000 * 60 * 60; // 1 hour for fallback API

// --- API Quota Management ---
// API 1 (newsapi.org)
const MAX_REQUESTS_PER_DAY_API1 = 95;
const getNewsApi1Timestamps = (): number[] => {
    const item = localStorage.getItem('newsApi1Timestamps');
    if (!item) return [];
    try {
        const timestamps = JSON.parse(item);
        return Array.isArray(timestamps) && timestamps.every(ts => typeof ts === 'number') ? timestamps : [];
    } catch { return []; }
};
const recordNewsApi1Request = () => {
    const recentTimestamps = getNewsApi1Timestamps().filter(ts => ts > Date.now() - (24 * 60 * 60 * 1000));
    recentTimestamps.push(Date.now());
    localStorage.setItem('newsApi1Timestamps', JSON.stringify(recentTimestamps));
};
export const getNewsApi1QuotaStatus = (): { used: number; limit: number } => {
    return { used: getNewsApi1Timestamps().filter(ts => ts > Date.now() - (24 * 60 * 60 * 1000)).length, limit: MAX_REQUESTS_PER_DAY_API1 };
};

// API 2 (Webz.io)
const MAX_REQUESTS_PER_DAY_API2 = 950; // Higher limit for the primary API
const getNewsApi2Timestamps = (): number[] => {
    const item = localStorage.getItem('newsApi2Timestamps');
    if (!item) return [];
    try {
        const timestamps = JSON.parse(item);
        return Array.isArray(timestamps) && timestamps.every(ts => typeof ts === 'number') ? timestamps : [];
    } catch { return []; }
};
const recordNewsApi2Request = () => {
    const recentTimestamps = getNewsApi2Timestamps().filter(ts => ts > Date.now() - (24 * 60 * 60 * 1000));
    recentTimestamps.push(Date.now());
    localStorage.setItem('newsApi2Timestamps', JSON.stringify(recentTimestamps));
};
export const getNewsApi2QuotaStatus = (): { used: number; limit: number } => {
    return { used: getNewsApi2Timestamps().filter(ts => ts > Date.now() - (24 * 60 * 60 * 1000)).length, limit: MAX_REQUESTS_PER_DAY_API2 };
};


// --- Cache Utility ---
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
    if (userId && data.length > 0) {
        try {
            await setCache(userId, 'cache_news', cacheDocId, data);
        } catch (e) {
            console.warn(`Failed to write to Firestore news cache for ${cacheDocId}.`, e);
        }
    }
    return data;
}

// --- API Fetching Logic ---

const mapSentiment = (sentiment: string | null): 'positive' | 'negative' | 'neutral' | undefined => {
    if (!sentiment) return undefined;
    switch (sentiment.toLowerCase()) {
        case 'positive': return 'positive';
        case 'negative': return 'negative';
        case 'neutral': return 'neutral';
        default: return undefined;
    }
};

const fetchNewsFromApi2 = async (query: string, sortBy: 'relevancy' | 'published'): Promise<NewsArticle[]> => {
    const quota = getNewsApi2QuotaStatus();
    if (quota.used >= quota.limit) {
        throw new Error(`News API 2 每日請求額度已達上限 (${quota.used}/${quota.limit})。`);
    }

    const fromTimestamp = Date.now() - (24 * 60 * 60 * 1000); // last 24 hours

    const fullQuery = `${query} language:(traditional chinese) published:>${fromTimestamp}`;

    const urlParams = new URLSearchParams({
        source: 'newsapi2',
        q: fullQuery,
        sort: sortBy,
        size: '20'
    });
    const url = `/.netlify/functions/stock-api?${urlParams.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`News API 2 proxy error: ${errorData.error || response.statusText}`);
    }
    
    recordNewsApi2Request();

    const result = await response.json();
    return result.posts
        .map((post: any) => ({
            title: post.title,
            description: post.highlightText || post.text || '',
            url: post.url,
            publishedAt: post.published,
            sentiment: mapSentiment(post.sentiment),
        }))
        .filter((article: NewsArticle) => article.title && !article.title.includes('[Removed]'));
};

const fetchNewsFromApi1 = async (query: string, sortBy: 'publishedAt' | 'popularity'): Promise<NewsArticle[]> => {
    const quota = getNewsApi1QuotaStatus();
    if (quota.used >= quota.limit) {
        throw new Error(`News API 1 每日請求額度已達上限 (${quota.used}/${quota.limit})。`);
    }

    const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const urlParams = new URLSearchParams({
        source: 'newsapi',
        q: query,
        language: 'zh',
        sortBy: sortBy,
        pageSize: '20',
        from: fromDate.toISOString(),
    });
    const url = `/.netlify/functions/stock-api?${urlParams.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`News API 1 proxy error: ${errorData.error || response.statusText}`);
    }
    
    recordNewsApi1Request();

    const result = await response.json();
    return result.articles
        .map((article: any) => ({
            title: article.title,
            description: article.description || '',
            url: article.url,
            publishedAt: article.publishedAt,
        }))
        .filter((article: NewsArticle) => article.title && !article.title.includes('[Removed]'));
};

// --- Public Service Functions ---

export const fetchNewsForStock = async (
    stockName: string,
    ticker: string,
    userId?: string
): Promise<NewsArticle[]> => {
    if (IS_NEWS2_CONFIGURED) {
        try {
            const query = `("${stockName}" OR "${ticker}") (site_country:TW)`;
            const fetchFn = () => fetchNewsFromApi2(query, 'relevancy');
            return await fetchWithNewsCache(userId, `${ticker}_api2`, fetchFn);
        } catch (e: any) {
            console.warn("News API 2 failed, falling back to News API 1.", e.message);
        }
    }

    if (IS_NEWS_CONFIGURED) {
        try {
            const query = `"${stockName}" OR "${ticker}"`;
            const fetchFn = () => fetchNewsFromApi1(query, 'publishedAt');
            return await fetchWithNewsCache(userId, ticker, fetchFn);
        } catch (e: any) {
            console.error("News API 1 (fallback) also failed.", e.message);
        }
    }
    
    throw new Error("All News APIs are not configured or have failed.");
};

export const fetchMarketNews = async (): Promise<NewsArticle[]> => {
     if (IS_NEWS2_CONFIGURED) {
        try {
            const query = `("台股" OR "台灣股市" OR "財經" OR "金融") (site_country:TW)`;
            return await fetchNewsFromApi2(query, 'published');
        } catch (e: any) {
            console.warn("News API 2 for market news failed, falling back to News API 1.", e.message);
        }
    }

    if (IS_NEWS_CONFIGURED) {
        try {
            const cachedItem = localStorage.getItem(MARKET_NEWS_CACHE_KEY_API1);
            if (cachedItem) {
                const { timestamp, articles } = JSON.parse(cachedItem);
                if (Date.now() - timestamp < MARKET_NEWS_CACHE_TTL_API1) {
                    return articles;
                }
            }
            const query = `("台股" OR "台灣股市" OR "加權指數" OR "大盤" OR "台灣經濟" OR 財經 OR 金融 OR 證券 OR 盤勢 OR 投資)`;
            const articles = await fetchNewsFromApi1(query, 'publishedAt');
            localStorage.setItem(MARKET_NEWS_CACHE_KEY_API1, JSON.stringify({ timestamp: Date.now(), articles }));
            return articles;
        } catch(e: any) {
            console.error("News API 1 (fallback) for market news also failed.", e.message);
        }
    }

    throw new Error("All News APIs are not configured or have failed for market news.");
};