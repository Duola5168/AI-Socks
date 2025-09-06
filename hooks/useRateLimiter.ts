import { useState, useEffect } from 'react';
import * as rateLimitService from '../services/rateLimitService';
import { AnalystId } from '../services/collaborativeAnalysisService';

type RateLimitStatus = Record<string, { isLimited: boolean; reason: string }>;

export const useRateLimiter = () => {
    const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>({});

    useEffect(() => {
        // Initial check
        setRateLimitStatus(rateLimitService.getRateLimitStatus());

        // Periodically check for updates (e.g., every 5 seconds)
        const intervalId = setInterval(() => {
            setRateLimitStatus(rateLimitService.getRateLimitStatus());
        }, 5000);

        // Also listen for storage changes to sync across tabs
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key && event.key.startsWith('rate_limit_')) {
                 setRateLimitStatus(rateLimitService.getRateLimitStatus());
            }
        };
        
        window.addEventListener('storage', handleStorageChange);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    return { rateLimitStatus };
};
