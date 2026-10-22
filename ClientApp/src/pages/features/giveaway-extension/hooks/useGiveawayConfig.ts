/**
 * useGiveawayConfig Hook
 * Maneja toda la configuración del giveaway
 */

import { useState, useCallback } from 'react';
import type {
    GiveawayConfig,
    GiveawayRequirements,
    GiveawayWeights,
    GiveawaySettings,
} from '../types';
import {
    DEFAULT_GIVEAWAY_CONFIG,
    DEFAULT_REQUIREMENTS,
    DEFAULT_WEIGHTS,
    mergeSettings,
} from '../types';

export const useGiveawayConfig = () => {
    // ========================================================================
    // STATE
    // ========================================================================
    const [config, setConfig] = useState<GiveawayConfig>(DEFAULT_GIVEAWAY_CONFIG);

    // ========================================================================
    // BASIC CONFIG
    // ========================================================================
    const updateBasicConfig = useCallback((updates: Partial<GiveawayConfig>) => {
        setConfig((prev) => ({ ...prev, ...updates }));
    }, []);

    // ========================================================================
    // REQUIREMENTS
    // ========================================================================
    const updateRequirements = useCallback((updates: Partial<GiveawayRequirements>) => {
        setConfig((prev) => ({
            ...prev,
            requirements: { ...prev.requirements, ...updates },
        }));
    }, []);

    // ========================================================================
    // WEIGHTS
    // ========================================================================
    const updateWeights = useCallback((updates: Partial<GiveawayWeights>) => {
        setConfig((prev) => ({
            ...prev,
            weights: { ...prev.weights, ...updates },
        }));
    }, []);

    // ========================================================================
    // SETTINGS (mensajes del bot, topes, umbrales, roles)
    // ========================================================================
    const updateSettings = useCallback(<K extends keyof GiveawaySettings>(group: K, updates: Partial<GiveawaySettings[K]>) => {
        setConfig((prev) => ({
            ...prev,
            settings: {
                ...prev.settings,
                [group]: { ...prev.settings[group], ...updates },
            },
        }));
    }, []);

    // ========================================================================
    // LOAD CONFIG
    // ========================================================================
    // Lo guardado puede ser de una versión anterior (sin settings, sin algún requisito): se completa con los valores por defecto
    const loadConfig = useCallback((loadedConfig: GiveawayConfig) => {
        setConfig({
            ...DEFAULT_GIVEAWAY_CONFIG,
            ...loadedConfig,
            requirements: { ...DEFAULT_REQUIREMENTS, ...(loadedConfig.requirements ?? {}) },
            weights: { ...DEFAULT_WEIGHTS, ...(loadedConfig.weights ?? {}) },
            settings: mergeSettings(loadedConfig.settings),
        });
    }, []);

    // ========================================================================
    // RESET CONFIG
    // ========================================================================
    const resetConfig = useCallback(() => {
        setConfig(DEFAULT_GIVEAWAY_CONFIG);
    }, []);

    // ========================================================================
    // GET COMPLETE CONFIG
    // ========================================================================
    const getCompleteConfig = useCallback((): GiveawayConfig => {
        return { ...config };
    }, [config]);

    // ========================================================================
    // RETURN
    // ========================================================================
    return {
        // State
        config,

        // Basic config
        updateBasicConfig,

        // Requirements
        updateRequirements,

        // Weights
        updateWeights,

        // Settings
        updateSettings,

        // Utilities
        loadConfig,
        resetConfig,
        getCompleteConfig,
    };
};
