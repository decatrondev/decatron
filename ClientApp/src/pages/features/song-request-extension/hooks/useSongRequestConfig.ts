import { useCallback, useEffect, useState } from 'react';
import api from '../../../../services/api';
import type { OverlayKind, OverlayLayout, SongRequestLimits, SongRequestOverlayConfig, SongRequestSettings } from '../types';
import { DEFAULT_SETTINGS, defaultOverlayConfig, normalizeOverlayConfig } from '../constants/defaults';

interface ServerConfig {
    channel: string;
    /** De qué chats llegan pedidos: Twitch, Kick o los dos (misma cola). */
    platforms: string[];
    publicUrl: string;
    playerKey: string;
    enabled: boolean;
    requestsOpen: boolean;
    commands: string[];
    messageDefaults: Record<string, string>;
    limits: SongRequestLimits;
}

const FREE_LIMITS: SongRequestLimits = { tier: 'free', maxPlaylists: 3, maxItemsPerPlaylist: 500, historyDays: 30, maxTemplates: 3, canHidePromo: false };

/** Carga y guarda la config del módulo (lo del chat y el diseño de los dos overlays). */
export function useSongRequestConfig() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [server, setServer] = useState<ServerConfig | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [settings, setSettings] = useState<SongRequestSettings>(DEFAULT_SETTINGS);
    const [overlay, setOverlay] = useState<SongRequestOverlayConfig>(defaultOverlayConfig);
    const [dirty, setDirty] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/song-request/config');
            const d = res.data;
            setServer({
                channel: d.channel, platforms: d.platforms ?? ['twitch'], publicUrl: d.publicUrl, playerKey: d.playerKey, enabled: d.enabled,
                requestsOpen: d.requestsOpen, commands: d.commands ?? [], messageDefaults: d.messageDefaults ?? {},
                limits: { ...FREE_LIMITS, ...(d.limits ?? {}) },
            });
            setEnabled(!!d.enabled);
            setSettings({
                ...DEFAULT_SETTINGS, ...d.settings,
                permissions: { ...DEFAULT_SETTINGS.permissions, ...(d.settings?.permissions ?? {}) },
                messages: d.settings?.messages ?? {},
            });
            setOverlay(normalizeOverlayConfig(d.overlayConfig));
            setDirty(false);
            setError(null);
        } catch (e: any) {
            setError(e?.response?.status === 403 ? 'forbidden' : 'load_failed');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const updateSettings = useCallback((patch: Partial<SongRequestSettings>) => {
        setSettings(prev => ({ ...prev, ...patch }));
        setDirty(true);
    }, []);

    const updateLayout = useCallback((kind: OverlayKind, next: OverlayLayout | ((prev: OverlayLayout) => OverlayLayout)) => {
        setOverlay(prev => ({ ...prev, [kind]: typeof next === 'function' ? next(prev[kind]) : next }));
        setDirty(true);
    }, []);

    const updateOverlay = useCallback((next: SongRequestOverlayConfig) => {
        setOverlay(next);
        setDirty(true);
    }, []);

    const toggleEnabled = useCallback((value: boolean) => {
        setEnabled(value);
        setDirty(true);
    }, []);

    /** error: la clave que mandó el backend (p. ej. templates_limit), o 'failed'. */
    const save = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
        setSaving(true);
        try {
            await api.put('/song-request/config', { enabled, settings, overlayConfig: overlay });
            setDirty(false);
            return { ok: true };
        } catch (e: any) {
            return { ok: false, error: e?.response?.data?.error ?? 'failed' };
        } finally {
            setSaving(false);
        }
    }, [enabled, settings, overlay]);

    /**
     * Modo de pedidos (abiertos, revisión, de dónde se pide): va al instante por su endpoint, no con Guardar,
     * para que un !srmode del chat y el dashboard no se pisen (fase 5).
     */
    const setRequestMode = useCallback(async (patch: { mode?: string; requestsOpen?: boolean; requestReview?: boolean; requestSource?: 'any' | 'playlists' }) => {
        const res = await api.put('/song-request/request-mode', patch);
        const d = res.data;
        if (d?.success) setSettings(prev => ({ ...prev, requestReview: d.requestReview, requestSource: d.requestSource }));
        return !!d?.success;
    }, []);

    /** Lo que llega en vivo (otro dashboard, !srmode del chat) sin marcar la vista como cambiada. */
    const syncMode = useCallback((requestReview?: boolean, requestSource?: 'any' | 'playlists') => {
        setSettings(prev => (requestReview === undefined || requestSource === undefined
            || (prev.requestReview === requestReview && prev.requestSource === requestSource))
            ? prev
            : { ...prev, requestReview, requestSource });
    }, []);

    const regenerateKey = useCallback(async () => {
        const res = await api.post('/song-request/player-key/regenerate');
        if (res.data?.playerKey) setServer(prev => prev ? { ...prev, playerKey: res.data.playerKey } : prev);
    }, []);

    return {
        loading, saving, error, dirty, server, enabled, settings, overlay,
        toggleEnabled, updateSettings, updateLayout, updateOverlay, save, regenerateKey, reload: load, setRequestMode, syncMode,
    };
}

export type SongRequestConfigState = ReturnType<typeof useSongRequestConfig>;
