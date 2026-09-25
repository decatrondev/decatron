import { useCallback, useEffect, useState } from 'react';
import api from '../../../../services/api';
import type { OverlayKind, OverlayLayout, SongRequestOverlayConfig, SongRequestSettings } from '../types';
import { DEFAULT_SETTINGS, defaultOverlayConfig, normalizeOverlayConfig } from '../constants/defaults';

interface ServerConfig {
    channel: string;
    publicUrl: string;
    playerKey: string;
    enabled: boolean;
    requestsOpen: boolean;
    commands: string[];
    messageDefaults: Record<string, string>;
}

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
                channel: d.channel, publicUrl: d.publicUrl, playerKey: d.playerKey, enabled: d.enabled,
                requestsOpen: d.requestsOpen, commands: d.commands ?? [], messageDefaults: d.messageDefaults ?? {},
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

    const save = useCallback(async () => {
        setSaving(true);
        try {
            await api.put('/song-request/config', { enabled, settings, overlayConfig: overlay });
            setDirty(false);
            return true;
        } catch {
            return false;
        } finally {
            setSaving(false);
        }
    }, [enabled, settings, overlay]);

    const regenerateKey = useCallback(async () => {
        const res = await api.post('/song-request/player-key/regenerate');
        if (res.data?.playerKey) setServer(prev => prev ? { ...prev, playerKey: res.data.playerKey } : prev);
    }, []);

    return {
        loading, saving, error, dirty, server, enabled, settings, overlay,
        toggleEnabled, updateSettings, updateLayout, updateOverlay, save, regenerateKey, reload: load,
    };
}

export type SongRequestConfigState = ReturnType<typeof useSongRequestConfig>;
