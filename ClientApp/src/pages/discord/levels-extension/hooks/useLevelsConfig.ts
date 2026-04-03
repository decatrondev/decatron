import { useState, useRef, useCallback } from 'react';
import type { LevelsConfig } from '../types';
import { DEFAULT_LEVELS_CONFIG } from '../constants/defaults';

export const useLevelsConfig = () => {
  const [config, setConfig] = useState<LevelsConfig>({ ...DEFAULT_LEVELS_CONFIG });
  const configRef = useRef(config);
  configRef.current = config;

  const updateConfig = useCallback((updates: Partial<LevelsConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      configRef.current = next;
      return next;
    });
  }, []);

  const loadConfig = useCallback((data: any) => {
    if (!data) return;
    const loaded: LevelsConfig = {
      enabled: data.enabled ?? DEFAULT_LEVELS_CONFIG.enabled,
      difficultyPreset: data.difficultyPreset ?? DEFAULT_LEVELS_CONFIG.difficultyPreset,
      customMultiplier: data.customMultiplier ?? DEFAULT_LEVELS_CONFIG.customMultiplier,
      xpMin: data.xpMin ?? DEFAULT_LEVELS_CONFIG.xpMin,
      xpMax: data.xpMax ?? DEFAULT_LEVELS_CONFIG.xpMax,
      cooldownSeconds: data.cooldownSeconds ?? DEFAULT_LEVELS_CONFIG.cooldownSeconds,
      maxXpPerHour: data.maxXpPerHour ?? DEFAULT_LEVELS_CONFIG.maxXpPerHour,
      minMessageLength: data.minMessageLength ?? DEFAULT_LEVELS_CONFIG.minMessageLength,
      excludedChannels: typeof data.excludedChannels === 'string'
        ? JSON.parse(data.excludedChannels || '[]')
        : data.excludedChannels ?? [],
      nightModeEnabled: data.nightModeEnabled ?? DEFAULT_LEVELS_CONFIG.nightModeEnabled,
      nightModeMultiplier: data.nightModeMultiplier ?? DEFAULT_LEVELS_CONFIG.nightModeMultiplier,
      levelupChannelId: data.levelupChannelId ?? null,
      achievementChannelId: data.achievementChannelId ?? null,
    };
    setConfig(loaded);
    configRef.current = loaded;
  }, []);

  const toApiFormat = useCallback(() => {
    const c = configRef.current;
    return {
      ...c,
      excludedChannels: c.excludedChannels,
    };
  }, []);

  const resetToDefaults = useCallback(() => {
    setConfig({ ...DEFAULT_LEVELS_CONFIG });
    configRef.current = { ...DEFAULT_LEVELS_CONFIG };
  }, []);

  return { config, updateConfig, loadConfig, toApiFormat, resetToDefaults };
};
