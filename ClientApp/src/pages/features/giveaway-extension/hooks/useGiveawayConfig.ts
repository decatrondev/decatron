/**
 * useGiveawayConfig Hook
 * Maneja toda la configuración del giveaway
 */

import { useState, useCallback } from 'react';
import type {
    GiveawayConfig,
    GiveawayRequirements,
    GiveawayWeights,
} from '../types';
import {
    DEFAULT_GIVEAWAY_CONFIG,
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
    // LOAD CONFIG
    // ========================================================================
    const loadConfig = useCallback((loadedConfig: GiveawayConfig) => {
        setConfig(loadedConfig);
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

        // Utilities
        loadConfig,
        resetConfig,
        getCompleteConfig,
    };
};
