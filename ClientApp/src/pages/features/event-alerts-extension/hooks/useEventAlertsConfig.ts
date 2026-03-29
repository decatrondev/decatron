import { useState, useCallback } from 'react';
import type {
  EventAlertsConfig,
  GlobalAlertsConfig,
  FollowAlertConfig,
  BitsAlertConfig,
  SubsAlertConfig,
  GiftSubsAlertConfig,
  RaidsAlertConfig,
  ResubsAlertConfig,
  HypeTrainAlertConfig,
} from '../types/index';
import { DEFAULT_EVENT_ALERTS_CONFIG } from '../constants/defaults';

/**
 * Hook principal para gestionar toda la configuración de Event Alerts
 * Similar a useTimerConfig pero para alertas de eventos
 */
export const useEventAlertsConfig = () => {
  // ============================================
  // ESTADOS POR SUBSISTEMA
  // ============================================

  const [globalConfig, setGlobalConfig] = useState<GlobalAlertsConfig>(
    DEFAULT_EVENT_ALERTS_CONFIG.global
  );

  const [followConfig, setFollowConfig] = useState<FollowAlertConfig>(
    DEFAULT_EVENT_ALERTS_CONFIG.follow
  );

  const [bitsConfig, setBitsConfig] = useState<BitsAlertConfig>(
    DEFAULT_EVENT_ALERTS_CONFIG.bits
  );

  const [subsConfig, setSubsConfig] = useState<SubsAlertConfig>(
    DEFAULT_EVENT_ALERTS_CONFIG.subs
  );

  const [giftSubsConfig, setGiftSubsConfig] = useState<GiftSubsAlertConfig>(
    DEFAULT_EVENT_ALERTS_CONFIG.giftSubs
  );

  const [raidsConfig, setRaidsConfig] = useState<RaidsAlertConfig>(
    DEFAULT_EVENT_ALERTS_CONFIG.raids
  );

  const [resubsConfig, setResubsConfig] = useState<ResubsAlertConfig>(
    DEFAULT_EVENT_ALERTS_CONFIG.resubs
  );

  const [hypeTrainConfig, setHypeTrainConfig] = useState<HypeTrainAlertConfig>(
    DEFAULT_EVENT_ALERTS_CONFIG.hypeTrain
  );

  // ============================================
  // MÉTODOS DE ACTUALIZACIÓN (Patrón Spread)
  // ============================================

  const updateGlobalConfig = useCallback(
    (updates: Partial<GlobalAlertsConfig>) => {
      setGlobalConfig((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const updateFollowConfig = useCallback(
    (updates: Partial<FollowAlertConfig>) => {
      setFollowConfig((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const updateBitsConfig = useCallback((updates: Partial<BitsAlertConfig>) => {
    setBitsConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateSubsConfig = useCallback((updates: Partial<SubsAlertConfig>) => {
    setSubsConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateGiftSubsConfig = useCallback(
    (updates: Partial<GiftSubsAlertConfig>) => {
      setGiftSubsConfig((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const updateRaidsConfig = useCallback(
    (updates: Partial<RaidsAlertConfig>) => {
      setRaidsConfig((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const updateResubsConfig = useCallback(
    (updates: Partial<ResubsAlertConfig>) => {
      setResubsConfig((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const updateHypeTrainConfig = useCallback(
    (updates: Partial<HypeTrainAlertConfig>) => {
      setHypeTrainConfig((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  // ============================================
  // MÉTODO PARA OBTENER CONFIGURACIÓN COMPLETA
  // ============================================

  const getCompleteConfig = useCallback((): EventAlertsConfig => {
    return {
      global: globalConfig,
      follow: followConfig,
      bits: bitsConfig,
      subs: subsConfig,
      giftSubs: giftSubsConfig,
      raids: raidsConfig,
      resubs: resubsConfig,
      hypeTrain: hypeTrainConfig,
    };
  }, [
    globalConfig,
    followConfig,
    bitsConfig,
    subsConfig,
    giftSubsConfig,
    raidsConfig,
    resubsConfig,
    hypeTrainConfig,
  ]);

  // ============================================
  // MÉTODO PARA CARGAR CONFIGURACIÓN
  // ============================================

  const loadConfig = useCallback((config: Partial<EventAlertsConfig>) => {
    if (config.global) {
      setGlobalConfig({
        ...DEFAULT_EVENT_ALERTS_CONFIG.global,
        ...config.global,
        // Deep merge para defaultStyle (para que textColor, fontSize, etc. no se pierdan)
        defaultStyle: {
          ...DEFAULT_EVENT_ALERTS_CONFIG.global.defaultStyle,
          ...(config.global.defaultStyle || {}),
          // Deep merge para backgroundGradient
          backgroundGradient: {
            ...DEFAULT_EVENT_ALERTS_CONFIG.global.defaultStyle.backgroundGradient,
            ...(config.global.defaultStyle?.backgroundGradient || {}),
          },
        },
        // Deep merge para overlayElements
        overlayElements: {
          ...DEFAULT_EVENT_ALERTS_CONFIG.global.overlayElements,
          ...(config.global.overlayElements || {}),
          card: {
            ...DEFAULT_EVENT_ALERTS_CONFIG.global.overlayElements.card,
            ...(config.global.overlayElements?.card || {}),
          },
          media: {
            ...DEFAULT_EVENT_ALERTS_CONFIG.global.overlayElements.media,
            ...(config.global.overlayElements?.media || {}),
          },
          text: {
            ...DEFAULT_EVENT_ALERTS_CONFIG.global.overlayElements.text,
            ...(config.global.overlayElements?.text || {}),
          },
        },
      });
    }

    if (config.follow) {
      setFollowConfig({
        ...DEFAULT_EVENT_ALERTS_CONFIG.follow,
        ...config.follow,
      });
    }

    if (config.bits) {
      setBitsConfig({
        ...DEFAULT_EVENT_ALERTS_CONFIG.bits,
        ...config.bits,
      });
    }

    if (config.subs) {
      setSubsConfig({
        ...DEFAULT_EVENT_ALERTS_CONFIG.subs,
        ...config.subs,
      });
    }

    if (config.giftSubs) {
      setGiftSubsConfig({
        ...DEFAULT_EVENT_ALERTS_CONFIG.giftSubs,
        ...config.giftSubs,
      });
    }

    if (config.raids) {
      setRaidsConfig({
        ...DEFAULT_EVENT_ALERTS_CONFIG.raids,
        ...config.raids,
      });
    }

    if (config.resubs) {
      setResubsConfig({
        ...DEFAULT_EVENT_ALERTS_CONFIG.resubs,
        ...config.resubs,
      });
    }

    if (config.hypeTrain) {
      setHypeTrainConfig({
        ...DEFAULT_EVENT_ALERTS_CONFIG.hypeTrain,
        ...config.hypeTrain,
      });
    }
  }, []);

  // ============================================
  // RESET A DEFAULTS
  // ============================================

  const resetToDefaults = useCallback(() => {
    setGlobalConfig(DEFAULT_EVENT_ALERTS_CONFIG.global);
    setFollowConfig(DEFAULT_EVENT_ALERTS_CONFIG.follow);
    setBitsConfig(DEFAULT_EVENT_ALERTS_CONFIG.bits);
    setSubsConfig(DEFAULT_EVENT_ALERTS_CONFIG.subs);
    setGiftSubsConfig(DEFAULT_EVENT_ALERTS_CONFIG.giftSubs);
    setRaidsConfig(DEFAULT_EVENT_ALERTS_CONFIG.raids);
    setResubsConfig(DEFAULT_EVENT_ALERTS_CONFIG.resubs);
    setHypeTrainConfig(DEFAULT_EVENT_ALERTS_CONFIG.hypeTrain);
  }, []);

  // ============================================
  // RETURN
  // ============================================

  return {
    // Estados
    globalConfig,
    followConfig,
    bitsConfig,
    subsConfig,
    giftSubsConfig,
    raidsConfig,
    resubsConfig,
    hypeTrainConfig,

    // Métodos de actualización
    updateGlobalConfig,
    updateFollowConfig,
    updateBitsConfig,
    updateSubsConfig,
    updateGiftSubsConfig,
    updateRaidsConfig,
    updateResubsConfig,
    updateHypeTrainConfig,

    // Métodos de utilidad
    getCompleteConfig,
    loadConfig,
    resetToDefaults,
  };
};
