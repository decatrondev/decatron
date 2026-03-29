/**
 * Timer Extension - useTimerConfig Hook
 *
 * Hook personalizado para manejar todo el estado de configuración del timer.
 */

import { useState } from 'react';
import type {
    DisplayConfig,
    ProgressBarConfig,
    StyleConfig,
    AnimationConfig,
    ThemeConfig,
    EventsConfig,
    CommandsConfig,
    AlertsConfig,
    GoalConfig,
    AdvancedConfig,
    HistoryConfig,
    RafflesConfig,
    TimeUnit,
    AlertsSubTab,
    TimerEventType
} from '../types';
import {
    DEFAULT_DURATION,
    DEFAULT_AUTO_START,
    DEFAULT_DISPLAY_CONFIG,
    DEFAULT_PROGRESSBAR_CONFIG,
    DEFAULT_STYLE_CONFIG,
    DEFAULT_ANIMATION_CONFIG,
    DEFAULT_THEME_CONFIG,
    DEFAULT_EVENTS_CONFIG,
    DEFAULT_EVENT_TIME_UNITS,
    DEFAULT_COMMANDS_CONFIG,
    DEFAULT_GOAL_CONFIG,
    DEFAULT_ADVANCED_CONFIG,
    DEFAULT_HISTORY_CONFIG,
    DEFAULT_RAFFLES_CONFIG
} from '../constants';
import { DEFAULT_ALERTS_CONFIG } from '../../../../types/timer-alerts';

export const useTimerConfig = () => {
    // ========================================================================
    // ESTADOS DE CONFIGURACIÓN
    // ========================================================================

    // Configuración básica
    const [defaultDuration, setDefaultDuration] = useState(DEFAULT_DURATION);
    const [autoStart, setAutoStart] = useState(DEFAULT_AUTO_START);
    const [maxChances, setMaxChances] = useState(0); 
    const [resurrectionMessage, setResurrectionMessage] = useState(''); // Nuevo
    const [gameOverMessage, setGameOverMessage] = useState(''); // Nuevo
    const [timeZone, setTimeZone] = useState('UTC');

    // Canvas dimensions
    const [canvasWidth, setCanvasWidth] = useState(1000);
    const [canvasHeight, setCanvasHeight] = useState(300);

    // Configuración de display
    const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);

    // Configuración de barra de progreso
    const [progressBarConfig, setProgressBarConfig] = useState<ProgressBarConfig>(DEFAULT_PROGRESSBAR_CONFIG);

    // Configuración de estilos
    const [styleConfig, setStyleConfig] = useState<StyleConfig>(DEFAULT_STYLE_CONFIG);

    // Configuración de animaciones
    const [animationConfig, setAnimationConfig] = useState<AnimationConfig>(DEFAULT_ANIMATION_CONFIG);

    // Configuración de tema
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>(DEFAULT_THEME_CONFIG);

    // Configuración de eventos
    const [eventsConfig, setEventsConfig] = useState<EventsConfig>(DEFAULT_EVENTS_CONFIG);
    const [eventTimeUnits, setEventTimeUnits] = useState<{
        bits: TimeUnit;
        follow: TimeUnit;
        subPrime: TimeUnit;
        subTier1: TimeUnit;
        subTier2: TimeUnit;
        subTier3: TimeUnit;
        giftSub: TimeUnit;
        raidBase: TimeUnit;
        raidPerParticipant: TimeUnit;
        hypeTrain: TimeUnit;
        followCooldown: TimeUnit;
    }>(DEFAULT_EVENT_TIME_UNITS);

    // Configuración de comandos
    const [commandsConfig, setCommandsConfig] = useState<CommandsConfig>(DEFAULT_COMMANDS_CONFIG);

    // Configuración de alertas
    const [alertsConfig, setAlertsConfig] = useState<AlertsConfig>(DEFAULT_ALERTS_CONFIG);
    const [alertsSubTab, setAlertsSubTab] = useState<AlertsSubTab>('template');
    const [showAlertPreview, setShowAlertPreview] = useState(false);
    const [previewAlertType, setPreviewAlertType] = useState<TimerEventType>('follow');

    // Configuración de objetivos
    const [goalConfig, setGoalConfig] = useState<GoalConfig>(DEFAULT_GOAL_CONFIG);

    // Configuración de sorteos
    const [rafflesConfig, setRafflesConfig] = useState<RafflesConfig>(DEFAULT_RAFFLES_CONFIG);

    // Configuración avanzada
    const [advancedConfig, setAdvancedConfig] = useState<AdvancedConfig>(DEFAULT_ADVANCED_CONFIG);

    // Configuración de historial
    const [historyConfig, setHistoryConfig] = useState<HistoryConfig>(DEFAULT_HISTORY_CONFIG);

    // Overlay URL
    const [overlayUrl, setOverlayUrl] = useState('');

    // ========================================================================
    // MÉTODOS HELPER PARA ACTUALIZAR CONFIGURACIONES
    // ========================================================================

    const updateDisplayConfig = (updates: Partial<DisplayConfig>) => {
        setDisplayConfig((prev) => ({ ...prev, ...updates }));
    };

    const updateProgressBarConfig = (updates: Partial<ProgressBarConfig>) => {
        setProgressBarConfig((prev) => ({ ...prev, ...updates }));
    };

    const updateStyleConfig = (updates: Partial<StyleConfig>) => {
        setStyleConfig((prev) => ({ ...prev, ...updates }));
    };

    const updateAnimationConfig = (updates: Partial<AnimationConfig>) => {
        setAnimationConfig((prev) => ({ ...prev, ...updates }));
    };

    const updateThemeConfig = (updates: Partial<ThemeConfig>) => {
        setThemeConfig((prev) => ({ ...prev, ...updates }));
    };

    const updateEventsConfig = (updates: Partial<EventsConfig>) => {
        setEventsConfig((prev) => {
            const newConfig = { ...prev, ...updates };
            if (updates.bits) {
            }
            return newConfig;
        });
    };

    const updateCommandsConfig = (updates: Partial<CommandsConfig>) => {
        setCommandsConfig((prev) => ({ ...prev, ...updates }));
    };

    const updateAlertsConfig = (updates: Partial<AlertsConfig>) => {
        setAlertsConfig((prev) => ({ ...prev, ...updates }));
    };

    const updateGoalConfig = (updates: Partial<GoalConfig>) => {
        setGoalConfig((prev) => ({ ...prev, ...updates }));
    };

    const updateRafflesConfig = (updates: Partial<RafflesConfig>) => {
        setRafflesConfig((prev) => ({ ...prev, ...updates }));
    };

    const updateAdvancedConfig = (updates: Partial<AdvancedConfig>) => {
        setAdvancedConfig((prev) => ({ ...prev, ...updates }));
    };

    const updateHistoryConfig = (updates: Partial<HistoryConfig>) => {
        setHistoryConfig((prev) => ({ ...prev, ...updates }));
    };

    // ========================================================================
    // OBTENER CONFIGURACIÓN COMPLETA
    // ========================================================================

    const getCompleteConfig = () => ({
        defaultDuration,
        autoStart,
        maxChances,
        resurrectionMessage, // Nuevo
        gameOverMessage, // Nuevo
        timeZone,
        displayConfig,
        progressBarConfig,
        styleConfig,
        animationConfig,
        themeConfig,
        eventsConfig,
        commandsConfig,
        alertsConfig,
        goalConfig,
        rafflesConfig,
        advancedConfig,
        historyConfig
    });

    // ========================================================================
    // CARGAR CONFIGURACIÓN DESDE OBJETO
    // ========================================================================

    const loadConfig = (config: any) => {

        if (config.defaultDuration !== undefined) {
            setDefaultDuration(config.defaultDuration);
        } else {
            console.warn('⚠️ [useTimerConfig] defaultDuration no definido en config');
        }

        if (config.autoStart !== undefined) setAutoStart(config.autoStart);
        if (config.maxChances !== undefined) setMaxChances(config.maxChances);
        if (config.resurrectionMessage !== undefined) setResurrectionMessage(config.resurrectionMessage); // Cargar
        if (config.gameOverMessage !== undefined) setGameOverMessage(config.gameOverMessage); // Cargar
        if (config.timeZone !== undefined) setTimeZone(config.timeZone);
        if (config.canvasWidth !== undefined) setCanvasWidth(config.canvasWidth);
        if (config.canvasHeight !== undefined) setCanvasHeight(config.canvasHeight);
        if (config.displayConfig) setDisplayConfig({ ...DEFAULT_DISPLAY_CONFIG, ...config.displayConfig });
        if (config.progressBarConfig) setProgressBarConfig({ ...DEFAULT_PROGRESSBAR_CONFIG, ...config.progressBarConfig });
        if (config.styleConfig) setStyleConfig({ ...DEFAULT_STYLE_CONFIG, ...config.styleConfig });
        if (config.animationConfig) setAnimationConfig({ ...DEFAULT_ANIMATION_CONFIG, ...config.animationConfig });
        if (config.themeConfig) setThemeConfig({ ...DEFAULT_THEME_CONFIG, ...config.themeConfig });
        if (config.eventsConfig) {
            // Deep merge para bits config para preservar tiers array
            const mergedEventsConfig = {
                ...DEFAULT_EVENTS_CONFIG,
                ...config.eventsConfig,
                bits: {
                    ...DEFAULT_EVENTS_CONFIG.bits,
                    ...config.eventsConfig.bits,
                    rules: config.eventsConfig.bits?.rules || DEFAULT_EVENTS_CONFIG.bits.rules
                }
            };
            setEventsConfig(mergedEventsConfig);
        }
        if (config.commandsConfig) setCommandsConfig({ ...DEFAULT_COMMANDS_CONFIG, ...config.commandsConfig });
        if (config.alertsConfig) setAlertsConfig({ ...DEFAULT_ALERTS_CONFIG, ...config.alertsConfig });
        if (config.goalConfig) setGoalConfig({ ...DEFAULT_GOAL_CONFIG, ...config.goalConfig });
        if (config.rafflesConfig) setRafflesConfig({ ...DEFAULT_RAFFLES_CONFIG, ...config.rafflesConfig });
        if (config.advancedConfig) setAdvancedConfig({ ...DEFAULT_ADVANCED_CONFIG, ...config.advancedConfig });
        if (config.historyConfig) setHistoryConfig({ ...DEFAULT_HISTORY_CONFIG, ...config.historyConfig });
    };

    return {
        // Estados
        defaultDuration,
        autoStart,
        maxChances,
        resurrectionMessage,
        gameOverMessage,
        timeZone,
        canvasWidth,
        canvasHeight,
        displayConfig,
        progressBarConfig,
        styleConfig,
        animationConfig,
        themeConfig,
        eventsConfig,
        eventTimeUnits,
        commandsConfig,
        alertsConfig,
        alertsSubTab,
        showAlertPreview,
        previewAlertType,
        goalConfig,
        rafflesConfig,
        advancedConfig,
        historyConfig,
        overlayUrl,

        // Setters directos
        setDefaultDuration,
        setAutoStart,
        setMaxChances,
        setResurrectionMessage,
        setGameOverMessage,
        setTimeZone,
        setCanvasWidth,
        setCanvasHeight,
        setDisplayConfig,
        setProgressBarConfig,
        setStyleConfig,
        setAnimationConfig,
        setThemeConfig,
        setEventsConfig,
        setEventTimeUnits,
        setCommandsConfig,
        setAlertsConfig,
        setAlertsSubTab,
        setShowAlertPreview,
        setPreviewAlertType,
        setGoalConfig,
        setRafflesConfig,
        setAdvancedConfig,
        setHistoryConfig,
        setOverlayUrl,

        // Métodos helper
        updateDisplayConfig,
        updateProgressBarConfig,
        updateStyleConfig,
        updateAnimationConfig,
        updateThemeConfig,
        updateEventsConfig,
        updateCommandsConfig,
        updateAlertsConfig,
        updateGoalConfig,
        updateRafflesConfig,
        updateAdvancedConfig,
        updateHistoryConfig,

        // Utilidades
        getCompleteConfig,
        loadConfig
    };
};
