import { AnalystId } from './collaborativeAnalysisService';

type ModelId = 'openai/gpt-4o-mini' | 'xai/grok-3-mini' | 'deepseek/deepseek-v3-0324' | 'cohere/cohere-command-r-plus-08-2024';

interface RateLimits {
    perMinute: number;
    perDay: number;
}

// Approximate limits based on previous generic keys. Fine-tuning may be needed.
const LIMITS: Partial<Record<ModelId, RateLimits>> = {
    'openai/gpt-4o-mini': { perMinute: 15, perDay: 150 }, // formerly github_copilot
    'xai/grok-3-mini': { perMinute: 2, perDay: 30 },      // formerly github_xai
    'deepseek/deepseek-v3-0324': { perMinute: 1, perDay: 8 },  // formerly github_deepseek
    // Other models might have different limits, not tracked for now.
};

const getTimestamps = (modelId: AnalystId): number[] => {
    try {
        const item = localStorage.getItem(`rate_limit_${modelId}`);
        return item ? JSON.parse(item) : [];
    } catch {
        return [];
    }
};

const saveTimestamps = (modelId: AnalystId, timestamps: number[]) => {
    try {
        localStorage.setItem(`rate_limit_${modelId}`, JSON.stringify(timestamps));
    } catch (e) {
        console.error("Error saving timestamps to localStorage:", e);
    }
};

export const recordRequest = (modelId: AnalystId) => {
    if (!modelId.includes('/')) return;
    const now = Date.now();
    const timestamps = getTimestamps(modelId);
    timestamps.push(now);
    // Clean up old timestamps to prevent localStorage from growing indefinitely
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const recentTimestamps = timestamps.filter(ts => ts > oneDayAgo);
    saveTimestamps(modelId, recentTimestamps);
};

export const checkRateLimit = (modelId: AnalystId): { isLimited: boolean; reason: string } => {
    if (!modelId.includes('/')) {
        return { isLimited: false, reason: '' };
    }
    
    const validModelId = modelId as ModelId;
    const limits = LIMITS[validModelId];
    if (!limits) {
        return { isLimited: false, reason: '' }; // No limits defined for this model
    }

    const timestamps = getTimestamps(modelId);
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const requestsInLastMinute = timestamps.filter(ts => ts > oneMinuteAgo).length;
    const requestsInLastDay = timestamps.filter(ts => ts > oneDayAgo).length;

    if (requestsInLastDay >= limits.perDay) {
        return { isLimited: true, reason: `已達每日請求上限 (${requestsInLastDay}/${limits.perDay})` };
    }
    if (requestsInLastMinute >= limits.perMinute) {
        return { isLimited: true, reason: `已達每分鐘請求上限 (${requestsInLastMinute}/${limits.perMinute})` };
    }

    return { isLimited: false, reason: `每分鐘 ${requestsInLastMinute}/${limits.perMinute}, 每日 ${requestsInLastDay}/${limits.perDay}` };
};

export const getRateLimitStatus = (): Record<string, { isLimited: boolean; reason: string }> => {
    const allStatuses: Record<string, { isLimited: boolean; reason: string }> = {};
    for (const modelId in LIMITS) {
        allStatuses[modelId as ModelId] = checkRateLimit(modelId as ModelId);
    }
    return allStatuses;
};