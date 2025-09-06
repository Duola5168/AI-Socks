import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../components/Auth';
import { StrategySettings, ScreenerStrategy } from '../types';
import { DEFAULT_STRATEGY_SETTINGS } from '../services/stockScreener';
import * as firestoreService from '../services/firestoreService';
import useLocalStorage from './useLocalStorage';

export const useStrategySettings = () => {
    const { user } = useAuth();
    const [localSettings, setLocalSettings] = useLocalStorage<StrategySettings>('ai-investor-settings', DEFAULT_STRATEGY_SETTINGS);
    
    // Deeper merge to ensure all nested properties from default are present
    const mergeSettings = (base: StrategySettings, override: Partial<StrategySettings>): StrategySettings => {
        return {
            ...base,
            ...override,
            weights: { ...base.weights, ...(override.weights || {}) },
            screener: { ...base.screener, ...(override.screener || {}) },
            portfolio: { ...base.portfolio, ...(override.portfolio || {}) },
            prompts: { ...base.prompts, ...(override.prompts || {}) },
            analystPanel: { 
                ...base.analystPanel,
                ...(override.analystPanel || {}),
                githubModels: { ...base.analystPanel.githubModels, ...(override.analystPanel?.githubModels || {}) }
            },
        };
    };
    
    const [settings, setSettings] = useState<StrategySettings>(() => mergeSettings(DEFAULT_STRATEGY_SETTINGS, localSettings));

    const [isSyncing, setIsSyncing] = useState(false);
    const hasSynced = useRef(false);

    // When localSettings (from another tab) changes, update the state
    useEffect(() => {
        setSettings(prev => mergeSettings(prev, localSettings));
    }, [localSettings]);

    // Sync with Firestore on login
    useEffect(() => {
        if (user && !hasSynced.current) {
            const syncSettings = async () => {
                setIsSyncing(true);
                const firestoreSettings = await firestoreService.getSettings(user.uid);
                if (firestoreSettings) {
                    const mergedSettings = mergeSettings(DEFAULT_STRATEGY_SETTINGS, firestoreSettings);
                    setSettings(mergedSettings);
                    setLocalSettings(mergedSettings);
                } else {
                    // If Firestore is empty, upload local settings
                    await firestoreService.saveSettings(user.uid, settings);
                }
                hasSynced.current = true;
                setIsSyncing(false);
            };
            syncSettings();
        } else if (!user) {
            hasSynced.current = false; // Reset sync status on logout
        }
    }, [user, setLocalSettings, settings]);

    const saveSettings = useCallback(async (): Promise<void> => {
        setLocalSettings(settings);
        if (user && hasSynced.current) {
            try {
                setIsSyncing(true);
                await firestoreService.saveSettings(user.uid, settings);
            } catch (error) {
                console.error("Failed to save settings to Firestore:", error);
            } finally {
                setIsSyncing(false);
            }
        }
    }, [user, settings, setLocalSettings]);

    const resetSettings = useCallback(() => {
        setSettings(DEFAULT_STRATEGY_SETTINGS);
        setLocalSettings(DEFAULT_STRATEGY_SETTINGS);
        if (user && hasSynced.current) {
            firestoreService.saveSettings(user.uid, DEFAULT_STRATEGY_SETTINGS);
        }
    }, [user, setLocalSettings]);

    const updatePrompt = useCallback((strategyKey: ScreenerStrategy, newPrompt: string) => {
        const newSettings = {
            ...settings,
            prompts: {
                ...settings.prompts,
                [strategyKey]: newPrompt,
            },
        };
        setSettings(newSettings);
        setLocalSettings(newSettings);
        if (user && hasSynced.current) {
            firestoreService.saveSettings(user.uid, newSettings);
        }
    }, [user, settings, setLocalSettings]);

    return {
        settings,
        setSettings,
        saveSettings,
        resetSettings,
        updatePrompt,
        isSyncing,
    };
};