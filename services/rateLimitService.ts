import { AnalystId } from './collaborativeAnalysisService';

type ModelId = 'github_copilot' | 'github_openai' | 'github_deepseek' | 'github_xai';

interface RateLimits {
    perMinute: number;
    perDay: number;
}

const LIMITS: Record<ModelId, RateLimits> = {
    github_copilot: { perMinute: 15, perDay: 150 },
    github_openai: { perMinute: 2, perDay: 10 }, // Assumed gpt-4o maps to "o1 and o3"
    github_deepseek: { perMinute: 1, perDay: 8 }, // Assumed deepseek-chat maps to "DeepSeek-R1"
    github_xai: { perMinute: 2, perDay: 30 }, // Assumed grok-3-mini
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
    if (!modelId.startsWith('github')) return;
    const now = Date.now();
    const timestamps = getTimestamps(modelId);
    timestamps.push(now);
    // Clean up old timestamps to prevent localStorage from growing indefinitely
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const recentTimestamps = timestamps.filter(ts => ts > oneDayAgo);
    saveTimestamps(modelId, recentTimestamps);
};

export const checkRateLimit = (modelId: AnalystId): { isLimited: boolean; reason: string } => {
    if (!modelId.startsWith('github')) {
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

    return { isLimited: false, reason: '' };
};

export const getRateLimitStatus = (): Record<ModelId, { isLimited: boolean; reason: string }> => {
    const allStatuses: Record<ModelId, { isLimited: boolean; reason: string }> = {
        github_copilot: { isLimited: false, reason: '' },
        github_openai: { isLimited: false, reason: '' },
        github_deepseek: { isLimited: false, reason: '' },
        github_xai: { isLimited: false, reason: '' },
    };
    for (const modelId in LIMITS) {
        allStatuses[modelId as ModelId] = checkRateLimit(modelId as ModelId);
    }
    return allStatuses;
};
