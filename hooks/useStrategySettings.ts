

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../components/Auth';
import { StrategySettings } from '../types';
import { DEFAULT_STRATEGY_SETTINGS } from '../services/stockScreener';
import * as firestoreService from '../services/firestoreService';
import useLocalStorage from './useLocalStorage';

export const useStrategySettings = () => {
    const { user } = useAuth();
    const [localSettings, setLocalSettings] = useLocalStorage<StrategySettings>('ai-investor-settings', DEFAULT_STRATEGY_SETTINGS);
    const [settings, setSettings] = useState<StrategySettings>(localSettings);
    const [isSyncing, setIsSyncing] = useState(false);
    const hasSynced = useRef(false);

    // When localSettings (from another tab) changes, update the state
    useEffect(() => {
        setSettings(localSettings);
    }, [localSettings]);

    // Sync with Firestore on login
    useEffect(() => {
        if (user && !hasSynced.current) {
            const syncSettings = async () => {
                setIsSyncing(true);
                const firestoreSettings = await firestoreService.getSettings(user.uid);
                if (firestoreSettings) {
                    // Firestore is source of truth
                    setSettings(firestoreSettings);
                    setLocalSettings(firestoreSettings);
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
                // Optionally handle error feedback to the user
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

    return {
        settings,
        setSettings,
        saveSettings,
        resetSettings,
        isSyncing,
    };
};