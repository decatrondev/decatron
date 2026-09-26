import { useCallback, useEffect, useState } from 'react';
import api from '../../../../services/api';
import type { OverlayLayout, SavedTemplate } from '../../../../components/music-overlay/types';
import { LAYOUT_VERSION, normalizeNowPlayingLayout } from '../convertLegacy';

export interface CupoInfo { total: number; used: number; available: number }

/** Lo que no es diseño: conexión y estado. */
export interface NowPlayingSettings {
    isEnabled: boolean;
    provider: 'lastfm' | 'spotify';
    lastfmUsername: string | null;
    pollingInterval: number;
    spotifyConnected: boolean;
    spotifySlotRequested: boolean;
    spotifySlotAssigned: boolean;
}

/** Carga y guarda Now Playing: conexión (Last.fm / Spotify), cupo y el diseño del overlay. */
export function useNowPlayingConfig() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    const [channel, setChannel] = useState('');
    const [overlayUrl, setOverlayUrl] = useState('');
    const [cupos, setCupos] = useState<CupoInfo>({ total: 5, used: 0, available: 5 });
    const [settings, setSettings] = useState<NowPlayingSettings>({
        isEnabled: false, provider: 'lastfm', lastfmUsername: null, pollingInterval: 5,
        spotifyConnected: false, spotifySlotRequested: false, spotifySlotAssigned: false,
    });
    const [layout, setLayout] = useState<OverlayLayout>(() => normalizeNowPlayingLayout({}));
    const [templates, setTemplates] = useState<SavedTemplate[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [cfg, spotify, info] = await Promise.all([
                api.get('/nowplaying/config'),
                api.get('/spotify/status').catch(() => ({ data: { connected: false } })),
                api.get('/settings/frontend-info').catch(() => null),
            ]);
            const login = info?.data?.channel?.login || '';
            setChannel(login);
            setOverlayUrl(`${info?.data?.frontendUrl || window.location.origin}/overlay/now-playing?channel=${login || 'tu-canal'}`);
            if (cfg.data?.cupos) setCupos(cfg.data.cupos);
            const d = cfg.data?.config;
            const raw = d?.configJson ? (typeof d.configJson === 'string' ? JSON.parse(d.configJson) : d.configJson) : {};
            setSettings({
                isEnabled: d?.isEnabled ?? false,
                provider: d?.provider === 'spotify' ? 'spotify' : 'lastfm',
                lastfmUsername: d?.lastfmUsername ?? null,
                pollingInterval: d?.pollingInterval ?? 5,
                spotifyConnected: !!spotify.data?.connected,
                spotifySlotRequested: !!d?.spotifySlotRequested,
                spotifySlotAssigned: !!d?.spotifySlotAssigned,
            });
            setLayout(normalizeNowPlayingLayout(raw));
            setTemplates(Array.isArray(raw?.templates) ? raw.templates : []);
            setDirty(false);
            setError(null);
        } catch (e: any) {
            setError(e?.response?.status === 403 ? 'forbidden' : 'load_failed');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const update = useCallback((patch: Partial<NowPlayingSettings>, markDirty = true) => {
        setSettings(prev => ({ ...prev, ...patch }));
        if (markDirty) setDirty(true);
    }, []);

    const updateLayout = useCallback((next: OverlayLayout) => {
        setLayout(next);
        setDirty(true);
    }, []);

    const updateTemplates = useCallback((next: SavedTemplate[]) => {
        setTemplates(next);
        setDirty(true);
    }, []);

    const save = useCallback(async () => {
        setSaving(true);
        try {
            await api.post('/nowplaying/config', {
                isEnabled: settings.isEnabled,
                provider: settings.provider,
                lastfmUsername: settings.lastfmUsername,
                pollingInterval: settings.pollingInterval,
                // Formato nuevo: el diseño del motor compartido con su versión (las configs viejas se convierten al leer)
                configJson: { ...layout, version: LAYOUT_VERSION, templates },
            });
            setDirty(false);
            return true;
        } catch {
            return false;
        } finally {
            setSaving(false);
        }
    }, [settings, layout, templates]);

    return {
        loading, saving, error, dirty, channel, overlayUrl, cupos, settings, layout, templates,
        update, updateLayout, updateTemplates, setCupos, save, reload: load,
    };
}

export type NowPlayingConfigState = ReturnType<typeof useNowPlayingConfig>;
