/**
 * Timer Extension - Main Configuration Component (Refactored)
 *
 * Este es el archivo principal refactorizado que orquesta todos los componentes y hooks.
 */

import TabIcon from '../../components/dashboard/TabIcon';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Save, ArrowLeft, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../hooks/usePermissions';
import api from '../../services/api';
import * as signalR from '@microsoft/signalr';

// Hooks personalizados
import {
    useTimerConfig,
    useTimerPreview,
    useTimerPersistence,
    useTimerUI,
    useMediaUpload
} from './timer-extension/hooks';

// Componentes
import { TimerPreview } from './timer-extension/components/preview';
import {
    BasicTab,
    DisplayTab,
    TypographyTab,
    ProgressBarTab,
    AnimationsTab,
    EventsTab,
    CommandsTab,
    InfoCommandsTab,
    AlertsTab,
    GoalTab,
    AdvancedTab,
    HistoryTab,
    MediaTab,
    OverlayTab,
    ThemeTab,
    RafflesTab,
    GuideTab,
    WidgetsTab
} from './timer-extension/components/tabs';

// Types
import type { TabType } from './timer-extension/types';

const TimerConfig = () => {
    const navigate = useNavigate();
    const { t } = useTranslation('features');
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();

    // Estado para el timer activo (solo para mostrar, NO para guardar)
    const [activeTimerRemaining, setActiveTimerRemaining] = useState<number | null>(null);
    const [activeTotalDuration, setActiveTotalDuration] = useState<number | null>(null);
    const [activeTimerStatus, setActiveTimerStatus] = useState<string>('stopped');
    const activeChannelRef = useRef<string | null>(null);
    const hubConnectionRef = useRef<signalR.HubConnection | null>(null);

    // ========================================================================
    // HOOKS PERSONALIZADOS
    // ========================================================================

    // Configuración del timer
    const timerConfig = useTimerConfig();

    // Preview del timer
    const preview = useTimerPreview(timerConfig.defaultDuration);

    // Persistencia (guardar/cargar)
    const persistence = useTimerPersistence({
        onConfigLoaded: (config) => timerConfig.loadConfig(config),
        onFrontendInfoLoaded: (url) => timerConfig.setOverlayUrl(url)
    });

    // UI (tabs, drag & drop)
    const ui = useTimerUI();

    // Media upload
    const media = useMediaUpload({
        onMessage: (msg) => persistence.setSaveMessage(msg)
    });

    // ========================================================================
    // EFFECTS
    // ========================================================================

    // Inicialización: cargar configuración y verificar permisos
    useEffect(() => {
        if (!permissionsLoading && hasMinimumLevel('moderation')) {
            persistence.loadConfiguration();
            persistence.loadFrontendInfo();
            media.loadMediaFiles();
        } else if (!permissionsLoading) {
            navigate('/dashboard');
        }
    }, [permissionsLoading]);

    // Sincronización con timer activo del servidor
    const syncTimerRef = useRef<() => Promise<void>>();
    const timerStatusRef = useRef(activeTimerStatus);
    timerStatusRef.current = activeTimerStatus;
    const refreshTimerState = useCallback(() => { syncTimerRef.current?.(); }, []);

    // Conteo local fluido: decrementa cada segundo si está corriendo
    useEffect(() => {
        if (activeTimerStatus !== 'running') return;
        const localTick = setInterval(() => {
            if (timerStatusRef.current === 'running') {
                setActiveTimerRemaining(prev => prev !== null && prev > 0 ? prev - 1 : prev);
            }
        }, 1000);
        return () => clearInterval(localTick);
    }, [activeTimerStatus]);

    useEffect(() => {
        const syncActiveTimer = async () => {
            try {
                const stateRes = await api.get('/timer/state/current');
                if (stateRes.data.success && stateRes.data.state) {
                    const state = stateRes.data.state;
                    setActiveTimerStatus(state.status);
                    setActiveTotalDuration(state.totalTime || null);

                    if (state.status === 'running' || state.status === 'paused' || state.status === 'auto_paused' || state.status === 'stream_paused') {
                        let remainingSeconds = state.currentTime;
                        if (state.status === 'running' && state.startedAt) {
                            const elapsedMs = Date.now() - new Date(state.startedAt).getTime();
                            const elapsed = Math.floor(elapsedMs / 1000) - (state.elapsedPausedTime || 0);
                            remainingSeconds = Math.max(0, state.totalTime - elapsed);
                        }
                        setActiveTimerRemaining(remainingSeconds);
                    } else {
                        setActiveTimerRemaining(null);
                    }

                    if (state.channelName && state.channelName !== activeChannelRef.current) {
                        activeChannelRef.current = state.channelName;
                        connectSignalR(state.channelName);
                    }
                }
            } catch {
                setActiveTimerRemaining(null);
                setActiveTimerStatus('stopped');
                setActiveTotalDuration(null);
            }
        };

        const connectSignalR = (channelName: string) => {
            if (hubConnectionRef.current) {
                hubConnectionRef.current.stop();
            }
            const connection = new signalR.HubConnectionBuilder()
                .withUrl("/hubs/overlay")
                .withAutomaticReconnect()
                .build();

            connection.on("PauseTimer", () => { setActiveTimerStatus('paused'); syncActiveTimer(); });
            connection.on("ResumeTimer", () => { setActiveTimerStatus('running'); syncActiveTimer(); });
            connection.on("StopTimer", () => { setActiveTimerStatus('stopped'); setActiveTimerRemaining(null); });
            connection.on("StartTimer", () => { setActiveTimerStatus('running'); syncActiveTimer(); });
            connection.on("AddTime", () => syncActiveTimer());

            connection.start()
                .then(() => connection.invoke("JoinChannel", channelName))
                .catch(console.error);

            hubConnectionRef.current = connection;
        };

        syncTimerRef.current = syncActiveTimer;

        syncActiveTimer();
        const interval = setInterval(syncActiveTimer, 30000);

        return () => {
            clearInterval(interval);
            hubConnectionRef.current?.stop();
        };
    }, []);

    // ========================================================================
    // HANDLERS
    // ========================================================================

    const handleSave = async () => {
        const config = timerConfig.getCompleteConfig();
        await persistence.saveConfiguration(config);
    };

    const handleDebug = async () => {
        const config = timerConfig.getCompleteConfig();
        await persistence.debugConfig(config);
    };

    const handleApplyPreset = (presetConfig: any) => {
        console.log('🎨 [TimerConfig] Aplicando Preset:', presetConfig);
        if (presetConfig.theme) timerConfig.updateThemeConfig(presetConfig.theme);
        if (presetConfig.style) timerConfig.updateStyleConfig(presetConfig.style);
        if (presetConfig.progressBar) timerConfig.updateProgressBarConfig(presetConfig.progressBar);
        // Toast de éxito (opcional, ya que ThemeTab puede mostrarlo)
    };

    // ========================================================================
    // TAB COMPONENTS MAPPING
    // ========================================================================

    const tabs: { id: TabType; label: string; icon: string }[] = [
        { id: 'guide', label: t('timerConfig.tabs.guide'), icon: '📚' },
        { id: 'basic', label: t('timerConfig.tabs.basic'), icon: '⚙️' },
        { id: 'events', label: t('timerConfig.tabs.events'), icon: '🎁' },
        { id: 'theme', label: t('timerConfig.tabs.theme'), icon: '🎨' },
        { id: 'progressbar', label: t('timerConfig.tabs.progressbar'), icon: '📊' },
        { id: 'display', label: t('timerConfig.tabs.display'), icon: '👁️' },
        { id: 'typography', label: t('timerConfig.tabs.typography'), icon: '🔤' },
        { id: 'alerts', label: t('timerConfig.tabs.alerts'), icon: '🔔' },
        { id: 'commands', label: t('timerConfig.tabs.commands'), icon: '💬' },
        { id: 'info-commands', label: t('timerConfig.tabs.infoCommands'), icon: '📢' },
        { id: 'goal', label: t('timerConfig.tabs.goal'), icon: '🎯' },
        { id: 'raffles', label: t('timerConfig.tabs.raffles'), icon: '🎲' },
        { id: 'animations', label: t('timerConfig.tabs.animations'), icon: '✨' },
        { id: 'advanced', label: t('timerConfig.tabs.advanced'), icon: '🔧' },
        { id: 'history', label: t('timerConfig.tabs.history'), icon: '📈' },
        { id: 'media', label: t('timerConfig.tabs.media'), icon: '🎬' },
        { id: 'widgets', label: t('timerConfig.tabs.widgets'), icon: '📊' },
        { id: 'overlay', label: t('timerConfig.tabs.overlay'), icon: '🖥️' }
    ];

    // ========================================================================
    // RENDER
    // ========================================================================

    if (persistence.loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ds-accent mx-auto mb-4"></div>
                    <p className="text-ds-soft">{t('timerConfig.loadingConfig')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ds-bg p-4 sm:p-6 lg:p-8">
            <div className="max-w-[1920px] mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/features')}
                            className="p-3 bg-ds-surface rounded-lg border border-ds-border hover:bg-ds-bg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-ds-soft" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-ds-text">
                                {t('timerConfig.title')}
                            </h1>
                            <p className="text-sm text-ds-soft mt-1">
                                {t('timerConfig.subtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDebug}
                            className="px-4 py-2 bg-ds-faint hover:bg-ds-faint text-ds-text rounded-lg transition-colors flex items-center gap-2 font-bold"
                        >
                            <Terminal className="w-4 h-4" />
                            {t('timerConfig.debug')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={persistence.saving || activeTimerStatus === 'running'}
                            title={activeTimerStatus === 'running' ? t('timerConfig.savePausedWarning') : t('timerConfig.saveTooltip')}
                            className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 font-bold ${
                                persistence.saving || activeTimerStatus === 'running'
                                    ? 'bg-ds-faint cursor-not-allowed text-ds-text'
                                    : 'bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent'
                            }`}
                        >
                            <Save className="w-5 h-5" />
                            {persistence.saving ? t('timerConfig.saving') : t('timerConfig.saveConfig')}
                        </button>
                    </div>
                </div>

                {/* Save Message */}
                {persistence.saveMessage && (
                    <div className={`mb-6 p-4 rounded-lg border ${
                        persistence.saveMessage.type === 'success'
                            ? 'bg-ds-ok/10 border-ds-ok/40 text-ds-ok '
                            : 'bg-ds-danger/10 border-ds-danger/40 text-ds-danger '
                    }`}>
                        {persistence.saveMessage.text}
                    </div>
                )}

                {/* Main Grid: 2/3 Editor + 1/3 Preview */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Column: Tabs + Content (2/3 en XL+) */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* Tabs Navigation - WRAPPING (No scroll) */}
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                            <div className="flex flex-wrap gap-2">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => ui.setActiveTab(tab.id)}
                                        className={ui.activeTab === tab.id ? 'ds-btn ds-btn--primary ds-btn--sm whitespace-nowrap' : 'ds-btn ds-btn--secondary ds-btn--sm whitespace-nowrap'}
                                    >
                                        <TabIcon emoji={tab.icon} />{tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div>
                            {ui.activeTab === 'guide' && (
                                <GuideTab 
                                    config={timerConfig}
                                    onNavigate={ui.setActiveTab}
                                    overlayUrl={timerConfig.overlayUrl}
                                />
                            )}

                            {ui.activeTab === 'basic' && (
                                <BasicTab
                                    defaultDuration={timerConfig.defaultDuration}
                                    autoStart={timerConfig.autoStart}
                                    overlayUrl={timerConfig.overlayUrl}
                                    activeTimerRemaining={activeTimerRemaining}
                                    activeTotalDuration={activeTotalDuration}
                                    activeTimerStatus={activeTimerStatus}
                                    onDefaultDurationChange={timerConfig.setDefaultDuration}
                                    onAutoStartChange={timerConfig.setAutoStart}
                                    onCopyOverlayUrl={() => persistence.copyOverlayUrl(timerConfig.overlayUrl)}
                                    initialTimeOffset={timerConfig.advancedConfig.initialTimeOffset}
                                    onInitialTimeOffsetChange={(val) => timerConfig.updateAdvancedConfig({ initialTimeOffset: val })}
                                    maxChances={timerConfig.maxChances}
                                    onMaxChancesChange={timerConfig.setMaxChances}
                                    resurrectionMessage={timerConfig.resurrectionMessage}
                                    onResurrectionMessageChange={timerConfig.setResurrectionMessage}
                                    gameOverMessage={timerConfig.gameOverMessage}
                                    onGameOverMessageChange={timerConfig.setGameOverMessage}
                                    onStateRefresh={refreshTimerState}
                                    autoPlayOnStreamOnline={timerConfig.advancedConfig.autoPlayOnStreamOnline}
                                    autoStopOnStreamOffline={timerConfig.advancedConfig.autoStopOnStreamOffline}
                                    onAutoPlayOnStreamOnlineChange={(v) => timerConfig.updateAdvancedConfig({ autoPlayOnStreamOnline: v })}
                                    onAutoStopOnStreamOfflineChange={(v) => timerConfig.updateAdvancedConfig({ autoStopOnStreamOffline: v })}
                                    timeZone={timerConfig.timeZone}
                                />
                            )}

                            {ui.activeTab === 'theme' && (
                                <ThemeTab
                                    themeConfig={timerConfig.themeConfig}
                                    onThemeConfigChange={timerConfig.updateThemeConfig}
                                    onApplyPreset={handleApplyPreset}
                                />
                            )}

                            {ui.activeTab === 'display' && (
                                <DisplayTab
                                    displayConfig={timerConfig.displayConfig}
                                    onDisplayConfigChange={timerConfig.updateDisplayConfig}
                                />
                            )}

                            {ui.activeTab === 'typography' && (
                                <TypographyTab
                                    styleConfig={timerConfig.styleConfig}
                                    onStyleConfigChange={timerConfig.updateStyleConfig}
                                />
                            )}

                            {ui.activeTab === 'progressbar' && (
                                <ProgressBarTab
                                    progressBarConfig={timerConfig.progressBarConfig}
                                    onProgressBarConfigChange={timerConfig.updateProgressBarConfig}
                                />
                            )}

                            {ui.activeTab === 'animations' && (
                                <AnimationsTab
                                    animationConfig={timerConfig.animationConfig}
                            widgetsConfig={timerConfig.widgetsConfig}
                                    onAnimationConfigChange={timerConfig.updateAnimationConfig}
                                />
                            )}

                            {ui.activeTab === 'events' && (
                                <EventsTab
                                    eventsConfig={timerConfig.eventsConfig}
                                    eventTimeUnits={timerConfig.eventTimeUnits}
                                    onEventsConfigChange={timerConfig.updateEventsConfig}
                                    onEventTimeUnitsChange={timerConfig.setEventTimeUnits}
                                />
                            )}

                            {ui.activeTab === 'commands' && (
                                <CommandsTab
                                    commandsConfig={timerConfig.commandsConfig}
                                    onCommandsConfigChange={timerConfig.updateCommandsConfig}
                                />
                            )}

                            {ui.activeTab === 'info-commands' && (
                                <InfoCommandsTab
                                    commandsConfig={timerConfig.commandsConfig}
                                    onCommandsConfigChange={timerConfig.updateCommandsConfig}
                                />
                            )}

                            {ui.activeTab === 'alerts' && (
                                <AlertsTab
                                    alertsConfig={timerConfig.alertsConfig}
                                    onAlertsConfigChange={timerConfig.updateAlertsConfig}
                                    canvasWidth={timerConfig.canvasWidth}
                                    canvasHeight={timerConfig.canvasHeight}
                                />
                            )}

                            {ui.activeTab === 'goal' && (
                                <GoalTab
                                    goalConfig={timerConfig.goalConfig}
                                    onGoalConfigChange={timerConfig.updateGoalConfig}
                                />
                            )}

                            {ui.activeTab === 'raffles' && (
                                <RafflesTab
                                    rafflesConfig={timerConfig.rafflesConfig}
                                    onRafflesConfigChange={timerConfig.updateRafflesConfig}
                                    timeZone={timerConfig.timeZone}
                                />
                            )}

                            {ui.activeTab === 'advanced' && (
                                <AdvancedTab
                                    advancedConfig={timerConfig.advancedConfig}
                                    onAdvancedConfigChange={timerConfig.updateAdvancedConfig}
                                    timeZone={timerConfig.timeZone}
                                    onTimeZoneChange={timerConfig.setTimeZone}
                                    eventsConfig={timerConfig.eventsConfig}
                                />
                            )}

                            {ui.activeTab === 'history' && (
                                <HistoryTab
                                    historyConfig={timerConfig.historyConfig}
                                    onHistoryConfigChange={timerConfig.updateHistoryConfig}
                                    timeZone={timerConfig.timeZone}
                                />
                            )}

                            {ui.activeTab === 'media' && (
                                <MediaTab />
                            )}

                            {ui.activeTab === 'widgets' && (
                                <WidgetsTab
                                    widgetsConfig={timerConfig.widgetsConfig}
                                    onWidgetsConfigChange={timerConfig.updateWidgetsConfig}
                                    timeZone={timerConfig.timeZone}
                                />
                            )}

                            {ui.activeTab === 'overlay' && (
                                <OverlayTab
                                    progressBarConfig={timerConfig.progressBarConfig}
                                    alertsConfig={timerConfig.alertsConfig}
                                    goalConfig={timerConfig.goalConfig}
                                    displayConfig={timerConfig.displayConfig}
                                    styleConfig={timerConfig.styleConfig}
                                    canvasWidth={timerConfig.canvasWidth}
                                    canvasHeight={timerConfig.canvasHeight}
                                    onProgressBarConfigChange={timerConfig.updateProgressBarConfig}
                                    onAlertsConfigChange={timerConfig.updateAlertsConfig}
                                    onGoalConfigChange={timerConfig.updateGoalConfig}
                                    onDisplayConfigChange={timerConfig.updateDisplayConfig}
                                    onStyleConfigChange={timerConfig.updateStyleConfig}
                                    widgetsConfig={timerConfig.widgetsConfig}
                                    onWidgetsConfigChange={timerConfig.setWidgetsConfig}
                                    onCanvasWidthChange={timerConfig.setCanvasWidth}
                                    onCanvasHeightChange={timerConfig.setCanvasHeight}
                                    onSave={handleSave}
                                />
                            )}
                        </div>
                    </div>

                    {/* Right Column: Preview (1/3 en XL+) */}
                    <div className="xl:col-span-1">
                        <TimerPreview
                            displayConfig={timerConfig.displayConfig}
                            progressBarConfig={timerConfig.progressBarConfig}
                            styleConfig={timerConfig.styleConfig}
                            themeConfig={timerConfig.themeConfig}
                            canvasWidth={timerConfig.canvasWidth}
                            canvasHeight={timerConfig.canvasHeight}
                            previewTimeRemaining={preview.previewTimeRemaining}
                            previewTotalDuration={preview.previewTotalDuration}
                            previewIsRunning={preview.previewIsRunning}
                            previewRef={preview.previewRef}
                            onTogglePreview={preview.togglePreview}
                            onResetPreview={preview.resetPreview}
                            onPlayPreview={preview.playPreview}
                            onPausePreview={preview.pausePreview}
                            onStopPreview={preview.stopPreview}
                            initialTimeOffset={timerConfig.advancedConfig.initialTimeOffset}
                            animationConfig={timerConfig.animationConfig}
                            widgetsConfig={timerConfig.widgetsConfig}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimerConfig;
