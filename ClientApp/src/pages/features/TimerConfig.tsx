/**
 * Timer Extension - Main Configuration Component (Refactored)
 *
 * Este es el archivo principal refactorizado que orquesta todos los componentes y hooks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Save, ArrowLeft, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
    GuideTab
} from './timer-extension/components/tabs';

// Types
import type { TabType } from './timer-extension/types';

const TimerConfig = () => {
    const navigate = useNavigate();
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
        { id: 'guide', label: 'Guía', icon: '📚' },         // 1. Empezar aquí
        { id: 'basic', label: 'Básico', icon: '⚙️' },       // 2. Configurar tiempo
        { id: 'events', label: 'Eventos', icon: '🎁' },     // 3. Reglas de dinero/tiempo (Vital)
        { id: 'theme', label: 'Tema', icon: '🎨' },         // 4. Estilo General
        { id: 'progressbar', label: 'Barra', icon: '📊' },  // 5. Visual Principal
        { id: 'display', label: 'Display', icon: '👁️' },    // 6. Qué mostrar
        { id: 'typography', label: 'Fuentes', icon: '🔤' }, // 7. Detalles de texto
        { id: 'alerts', label: 'Alertas', icon: '🔔' },     // 8. Feedback visual
        { id: 'commands', label: 'Comandos', icon: '💬' },  // 9. Control Chat
        { id: 'info-commands', label: 'Comandos Info', icon: '📢' }, // 10. Información
        { id: 'goal', label: 'Metas', icon: '🎯' },         // 10. Objetivos
        { id: 'raffles', label: 'Sorteos', icon: '🎲' },    // 11. Dinámica extra
        { id: 'animations', label: 'Animación', icon: '✨' },// 12. Pulido
        { id: 'advanced', label: 'Avanzado', icon: '🔧' },  // 13. Power users
        { id: 'history', label: 'Historial', icon: '📈' },  // 14. Logs
        { id: 'media', label: 'Media', icon: '🎬' },        // 15. Archivos
        { id: 'overlay', label: 'Overlay', icon: '🖥️' }     // 16. Salida final
    ];

    // ========================================================================
    // RENDER
    // ========================================================================

    if (persistence.loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Cargando configuración...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#1B1C1D] p-4 sm:p-6 lg:p-8">
            <div className="max-w-[1920px] mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/features')}
                            className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors shadow-lg"
                        >
                            <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                ⏱️ Timer Extensible
                            </h1>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                                Configura tu timer con eventos, comandos y alertas personalizadas
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDebug}
                            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-xl transition-colors flex items-center gap-2 font-bold shadow-lg"
                        >
                            <Terminal className="w-4 h-4" />
                            Debug
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={persistence.saving || activeTimerStatus === 'running'}
                            title={activeTimerStatus === 'running' ? '⏸️ Debes PAUSAR el timer para poder guardar cambios y evitar reinicios accidentales.' : 'Guardar cambios'}
                            className={`px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold shadow-lg ${
                                persistence.saving || activeTimerStatus === 'running'
                                    ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                                    : 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white'
                            }`}
                        >
                            <Save className="w-5 h-5" />
                            {persistence.saving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>

                {/* Save Message */}
                {persistence.saveMessage && (
                    <div className={`mb-6 p-4 rounded-xl border ${
                        persistence.saveMessage.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                    }`}>
                        {persistence.saveMessage.text}
                    </div>
                )}

                {/* Main Grid: 2/3 Editor + 1/3 Preview */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Column: Tabs + Content (2/3 en XL+) */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* Tabs Navigation - WRAPPING (No scroll) */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 shadow-lg">
                            <div className="flex flex-wrap gap-2">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => ui.setActiveTab(tab.id)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                            ui.activeTab === tab.id
                                                ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-lg'
                                                : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                        }`}
                                    >
                                        {tab.icon} {tab.label}
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
                                />
                            )}

                            {ui.activeTab === 'advanced' && (
                                <AdvancedTab
                                    advancedConfig={timerConfig.advancedConfig}
                                    onAdvancedConfigChange={timerConfig.updateAdvancedConfig}
                                    timeZone={timerConfig.timeZone}
                                    onTimeZoneChange={timerConfig.setTimeZone}
                                />
                            )}

                            {ui.activeTab === 'history' && (
                                <HistoryTab
                                    historyConfig={timerConfig.historyConfig}
                                    onHistoryConfigChange={timerConfig.updateHistoryConfig}
                                />
                            )}

                            {ui.activeTab === 'media' && (
                                <MediaTab />
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
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimerConfig;
