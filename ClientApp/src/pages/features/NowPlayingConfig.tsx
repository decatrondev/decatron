/**
 * Now Playing Extension - Configuration Page
 *
 * Modular config page for the "Now Playing" music overlay.
 * Supports Last.fm and Spotify with 8 configuration tabs.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Save, ArrowLeft, Music, Settings, Layout, Palette, Type,
    BarChart3, Sparkles, Monitor, Eye, ChevronRight, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

import type { TabId, ConfigJson, NowPlayingState, TierLimits, CupoInfo } from './now-playing-extension/types';
import { ALL_UNLOCKED, DEFAULT_CONFIG, DEFAULT_STATE } from './now-playing-extension/constants/defaults';
import {
    GeneralTab, LayoutTab, StyleTab, TypographyTab,
    ProgressBarTab, AnimationsTab, OverlayPositionTab, PreviewTab
} from './now-playing-extension/components/tabs';

// ============================================================================
// TABS DEFINITION
// ============================================================================

const TABS: { id: TabId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'layout', label: 'Layout', icon: Layout },
    { id: 'style', label: 'Estilo', icon: Palette },
    { id: 'typography', label: 'Tipografia', icon: Type },
    { id: 'progressBar', label: 'Progreso', icon: BarChart3 },
    { id: 'animations', label: 'Animaciones', icon: Sparkles },
    { id: 'overlay', label: 'Posicion', icon: Monitor },
    { id: 'preview', label: 'Preview', icon: Eye },
];

// ============================================================================
// UTILITY: Deep Merge
// ============================================================================

function deepMerge<T extends Record<string, any>>(defaults: T, overrides: Partial<T>): T {
    const result = { ...defaults };
    for (const key of Object.keys(overrides) as (keyof T)[]) {
        const val = overrides[key];
        if (val !== undefined && val !== null) {
            if (typeof val === 'object' && !Array.isArray(val) && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
                (result as any)[key] = deepMerge(defaults[key] as any, val as any);
            } else {
                (result as any)[key] = val;
            }
        }
    }
    return result;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const NowPlayingConfig: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabId>('general');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [channelName, setChannelName] = useState('');
    const [overlayUrl, setOverlayUrl] = useState('');

    // Main state
    const [state, setState] = useState<NowPlayingState>(DEFAULT_STATE);
    const [userTier, setUserTier] = useState<string>('free');
    const [limits, setLimits] = useState<TierLimits>(ALL_UNLOCKED);
    const [cupos, setCupos] = useState<CupoInfo>({ total: 5, used: 0, available: 5 });

    // Convenience updaters
    const updateState = useCallback((partial: Partial<NowPlayingState>) => {
        setState((prev) => ({ ...prev, ...partial }));
    }, []);

    const updateConfigJson = useCallback((partial: Partial<ConfigJson>) => {
        setState((prev) => ({
            ...prev,
            configJson: { ...prev.configJson, ...partial },
        }));
    }, []);

    // Load config on mount
    useEffect(() => {
        loadConfig();
        loadFrontendInfo();
    }, []);

    // Clear save message after timeout
    useEffect(() => {
        if (saveMessage) {
            const timer = setTimeout(() => setSaveMessage(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [saveMessage]);

    const loadFrontendInfo = async () => {
        try {
            const res = await api.get('/settings/frontend-info');
            if (res.data.success) {
                const { frontendUrl, channel } = res.data;
                const login = channel?.login || '';
                setChannelName(login);
                setOverlayUrl(`${frontendUrl}/overlay/now-playing?channel=${login}`);
            }
        } catch {
            setOverlayUrl(`${window.location.origin}/overlay/now-playing?channel=tu-canal`);
        }
    };

    const loadConfig = async () => {
        try {
            const [configRes, spotifyRes] = await Promise.all([
                api.get('/nowplaying/config'),
                api.get('/spotify/status').catch(() => ({ data: { connected: false } })),
            ]);
            const spotifyConnected = spotifyRes.data?.connected ?? false;

            if (configRes.data?.tier) setUserTier(configRes.data.tier);
            if (configRes.data?.limits) setLimits(configRes.data.limits);
            if (configRes.data?.cupos) setCupos(configRes.data.cupos);

            if (configRes.data?.success && configRes.data.config) {
                const data = configRes.data.config;
                setState({
                    isEnabled: data.isEnabled ?? DEFAULT_STATE.isEnabled,
                    provider: data.provider ?? DEFAULT_STATE.provider,
                    lastfmUsername: data.lastfmUsername ?? DEFAULT_STATE.lastfmUsername,
                    spotifyConnected,
                    spotifySlotRequested: data.spotifySlotRequested ?? false,
                    spotifySlotAssigned: data.spotifySlotAssigned ?? false,
                    pollingInterval: data.pollingInterval ?? DEFAULT_STATE.pollingInterval,
                    configJson: data.configJson
                        ? deepMerge(DEFAULT_CONFIG, typeof data.configJson === 'string' ? JSON.parse(data.configJson) : data.configJson)
                        : DEFAULT_CONFIG,
                });
            }
        } catch (err) {
            console.error('Error loading now playing config:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveMessage(null);
        try {
            const res = await api.post('/nowplaying/config', state);
            if (res.data?.success) {
                setSaveMessage({ type: 'success', text: 'Configuracion guardada' });
            } else {
                setSaveMessage({ type: 'error', text: res.data?.message || 'Error al guardar' });
            }
        } catch (err: any) {
            setSaveMessage({ type: 'error', text: `Error: ${err?.response?.data?.message || err?.message}` });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6 max-w-[1400px] mx-auto">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                        <p className="text-[#94a3b8] font-medium">Cargando Now Playing...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/overlays')}
                        className="p-3 bg-[#1B1C1D] rounded-xl border border-[#374151] hover:bg-[#262626] transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-[#94a3b8]" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-[#f8fafc] flex items-center gap-2">
                            <Music className="w-6 h-6 text-green-400" />
                            Now Playing
                        </h1>
                        <p className="text-sm text-[#94a3b8] mt-0.5">
                            Configura el overlay de musica para tu stream
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {saveMessage && (
                        <span className={`text-sm font-medium px-3 py-1.5 rounded-lg ${
                            saveMessage.type === 'success'
                                ? 'bg-green-900/30 text-green-400 border border-green-500/20'
                                : 'bg-red-900/30 text-red-400 border border-red-500/20'
                        }`}>
                            {saveMessage.text}
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl transition-colors flex items-center gap-2 font-bold"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>

            {/* Main Layout: Sidebar + Content */}
            <div className="flex gap-6">
                {/* Tab Sidebar */}
                <div className="w-48 flex-shrink-0">
                    <nav className="bg-[#1B1C1D] rounded-xl border border-[#374151] p-2 space-y-1 sticky top-8">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                        isActive
                                            ? 'bg-blue-600 text-white'
                                            : 'text-[#94a3b8] hover:bg-[#262626] hover:text-[#f8fafc]'
                                    }`}
                                >
                                    <Icon className="w-4 h-4 flex-shrink-0" />
                                    <span>{tab.label}</span>
                                    {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="flex-1 min-w-0">
                    {activeTab === 'general' && (
                        <GeneralTab config={state} onUpdate={updateState} overlayUrl={overlayUrl} channelName={channelName} limits={limits} userTier={userTier} cupos={cupos} onCuposChange={setCupos} />
                    )}
                    {activeTab === 'layout' && (
                        <LayoutTab config={state.configJson} onUpdate={updateConfigJson} limits={limits} />
                    )}
                    {activeTab === 'style' && (
                        <StyleTab config={state.configJson} onUpdate={updateConfigJson} limits={limits} />
                    )}
                    {activeTab === 'typography' && (
                        <TypographyTab config={state.configJson} onUpdate={updateConfigJson} limits={limits} />
                    )}
                    {activeTab === 'progressBar' && (
                        <ProgressBarTab config={state.configJson} onUpdate={updateConfigJson} limits={limits} />
                    )}
                    {activeTab === 'animations' && (
                        <AnimationsTab config={state.configJson} onUpdate={updateConfigJson} limits={limits} />
                    )}
                    {activeTab === 'overlay' && (
                        <OverlayPositionTab config={state.configJson} onUpdate={updateConfigJson} limits={limits} />
                    )}
                    {activeTab === 'preview' && (
                        <PreviewTab config={state.configJson} state={state} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default NowPlayingConfig;
