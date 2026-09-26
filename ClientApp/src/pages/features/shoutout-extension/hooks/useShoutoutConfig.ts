import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../../services/api';
import type { ShoutoutLayout } from '../../../../components/shoutout-overlay/types';
import { LAYOUT_VERSION } from '../../../../components/shoutout-overlay/defaults';
import { normalizeShoutoutLayout } from '../../../../components/shoutout-overlay/convertLegacy';

/** Lo que no es diseño. */
export interface ShoutoutSettings {
    duration: number;
    cooldown: number;
    blacklist: string[];
    whitelist: string[];
    /** Cómo se elige el clip (backend). */
    clipMode: ClipMode;
    clipDays: number;
    /** Si en el rango no hay clips, usar cualquiera. */
    clipFallback: boolean;
    /** Sin clip, cuánto se queda como mucho. */
    noClipSeconds: number;
    /** Varios !so seguidos, uno detrás del otro. */
    queueEnabled: boolean;
    /** Además, el shoutout nativo de Twitch. */
    nativeEnabled: boolean;
    raidEnabled: boolean;
    raidMinViewers: number;
    raidDelaySeconds: number;
    chatEnabled: boolean;
    /** Vacío = el mensaje de siempre. */
    chatMessage: string;
}

export type ClipMode = 'random' | 'top' | 'recent' | 'days';
export const CLIP_MODES: ClipMode[] = ['random', 'top', 'recent', 'days'];
export const NO_CLIP_RANGE = { min: 3, max: 60 };

export const DURATION_RANGE = { min: 5, max: 60 };
export const COOLDOWN_RANGE = { min: 0, max: 300 };

/** Carga y guarda la config de Shoutout (/api/shoutout/config). */
export function useShoutoutConfig() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    const [overlayUrl, setOverlayUrl] = useState('');
    const [settings, setSettings] = useState<ShoutoutSettings>({ duration: 10, cooldown: 30, blacklist: [], whitelist: [], clipMode: 'random', clipDays: 30, clipFallback: true, noClipSeconds: 5,
        queueEnabled: true, nativeEnabled: false, raidEnabled: false, raidMinViewers: 1, raidDelaySeconds: 5, chatEnabled: true, chatMessage: '',
    });
    const [layout, setLayout] = useState<ShoutoutLayout>(() => normalizeShoutoutLayout({}));
    // Lo que vino del backend: al guardar se reenvían tal cual las columnas viejas que la vista ya no edita
    const raw = useRef<any>({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [res, info] = await Promise.all([
                api.get('/shoutout/config'),
                api.get('/settings/frontend-info').catch(() => null),
            ]);
            const c = res.data?.config ?? {};
            raw.current = c;
            const login = info?.data?.channel?.login || '';
            setOverlayUrl(`${info?.data?.frontendUrl || window.location.origin}/overlay/shoutout?channel=${login || 'tu-canal'}`);
            setSettings({
                duration: c.duration || 10,
                cooldown: c.cooldown ?? 30,
                blacklist: Array.isArray(c.blacklist) ? c.blacklist : [],
                whitelist: Array.isArray(c.whitelist) ? c.whitelist : [],
                clipMode: CLIP_MODES.includes(c.settings?.clipMode) ? c.settings.clipMode : 'random',
                clipDays: c.settings?.clipDays ?? 30,
                clipFallback: c.settings?.clipFallback ?? true,
                noClipSeconds: c.settings?.noClipSeconds ?? 5,
                queueEnabled: c.settings?.queueEnabled ?? true,
                nativeEnabled: !!c.settings?.nativeEnabled,
                raidEnabled: !!c.settings?.raidEnabled,
                raidMinViewers: c.settings?.raidMinViewers ?? 1,
                raidDelaySeconds: c.settings?.raidDelaySeconds ?? 5,
                chatEnabled: c.settings?.chatEnabled ?? true,
                chatMessage: c.settings?.chatMessage ?? '',
            });
            setLayout(normalizeShoutoutLayout(c));
            setDirty(false);
            setError(null);
        } catch (e: any) {
            setError(e?.response?.status === 403 ? 'forbidden' : 'load_failed');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const update = useCallback((patch: Partial<ShoutoutSettings>) => {
        setSettings(prev => ({ ...prev, ...patch }));
        setDirty(true);
    }, []);

    const updateLayout = useCallback((next: ShoutoutLayout) => {
        setLayout(next);
        setDirty(true);
    }, []);

    const save = useCallback(async (): Promise<string | null> => {
        setSaving(true);
        try {
            const c = raw.current;
            await api.post('/shoutout/config', {
                duration: settings.duration,
                cooldown: settings.cooldown,
                showDebugTimer: !!layout.elements.find(e => e.kind === 'timer')?.enabled,
                // Formato nuevo: el diseño va entero en layout (las configs viejas se convierten al leer)
                layout: { ...layout, version: LAYOUT_VERSION },
                textLines: Array.isArray(c.textLines) ? c.textLines : [],
                styles: c.styles ?? {},
                shoutoutText: c.shoutoutText ?? null,
                animationType: c.animationType ?? 'none',
                animationSpeed: c.animationSpeed ?? 'normal',
                textOutlineEnabled: !!c.textOutlineEnabled,
                textOutlineColor: c.textOutlineColor ?? '#000000',
                textOutlineWidth: c.textOutlineWidth ?? 2,
                containerBorderEnabled: !!c.containerBorderEnabled,
                containerBorderColor: c.containerBorderColor ?? '#ffffff',
                containerBorderWidth: c.containerBorderWidth ?? 3,
                blacklist: settings.blacklist,
                whitelist: settings.whitelist,
                settings: {
                    clipMode: settings.clipMode, clipDays: settings.clipDays, clipFallback: settings.clipFallback, noClipSeconds: settings.noClipSeconds,
                    queueEnabled: settings.queueEnabled, nativeEnabled: settings.nativeEnabled,
                    raidEnabled: settings.raidEnabled, raidMinViewers: settings.raidMinViewers, raidDelaySeconds: settings.raidDelaySeconds,
                    chatEnabled: settings.chatEnabled, chatMessage: settings.chatMessage,
                },
            });
            raw.current = { ...c, duration: settings.duration, cooldown: settings.cooldown, layout, blacklist: settings.blacklist, whitelist: settings.whitelist };
            setDirty(false);
            return null;
        } catch (e: any) {
            return e?.response?.data?.message || 'save_failed';
        } finally {
            setSaving(false);
        }
    }, [settings, layout]);

    return { loading, saving, error, dirty, overlayUrl, settings, layout, update, updateLayout, save, reload: load };
}

export type ShoutoutConfigState = ReturnType<typeof useShoutoutConfig>;
