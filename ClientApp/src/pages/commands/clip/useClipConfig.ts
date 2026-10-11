import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../services/api';

// Comando !clip (.dev/plans/CLIP_COMANDO_PLAN.md). Habla con /api/clipcommand.

export type ClipRole = 'everyone' | 'follower' | 'subscriber' | 'vip' | 'moderator' | 'lead_moderator' | 'broadcaster';

export interface ClipConfig {
    enabled: boolean;
    language: 'es' | 'en';
    minRole: ClipRole;
    globalCooldownSeconds: number;
    userCooldownSeconds: number;
    staffSkipUserCooldown: boolean;
    maxPerUserPerStream: number | null;
    defaultDuration: number;
    minDuration: number;
    maxDuration: number;
    allowViewerDuration: boolean;
    allowTitle: boolean;
    maxTitleLength: number;
    aliases: string;
    unsupportedPlatformMode: 'message' | 'silent';
    downloadEnabled: boolean;
    /** Lo fija solo el administrador: la pantalla lo muestra pero no lo edita. */
    downloadMonthlyCap: number | null;
    historyRetentionDays: number | null;
}

export type MessageValue = { es: string; en: string };
export type MessageMap = Record<string, MessageValue>;

export const DURATION_LIMITS = { min: 5, max: 60 };
export const TITLE_LIMIT = 100;

export const DEFAULT_CONFIG: ClipConfig = {
    enabled: false, language: 'es', minRole: 'everyone', globalCooldownSeconds: 30, userCooldownSeconds: 120,
    staffSkipUserCooldown: true, maxPerUserPerStream: null, defaultDuration: 30, minDuration: 5, maxDuration: 60,
    allowViewerDuration: true, allowTitle: true, maxTitleLength: 100, aliases: '', unsupportedPlatformMode: 'message',
    downloadEnabled: false, downloadMonthlyCap: null, historyRetentionDays: 90,
};

/** Carga y guarda la config de !clip y los mensajes del chat. */
export function useClipConfig() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<'forbidden' | 'load_failed' | null>(null);
    const [dirty, setDirty] = useState(false);
    const [config, setConfig] = useState<ClipConfig>(DEFAULT_CONFIG);
    const [messages, setMessages] = useState<MessageMap>({});
    const [defaults, setDefaults] = useState<MessageMap>({});
    const [placeholders, setPlaceholders] = useState<Record<string, string[]>>({});
    const [roles, setRoles] = useState<ClipRole[]>([]);
    const messagesDirty = useRef(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/clipcommand/config');
            const d = res.data ?? {};
            setConfig({ ...DEFAULT_CONFIG, ...(d.config ?? {}) });
            const custom: MessageMap = {};
            for (const [k, v] of Object.entries<any>(d.messages ?? {})) custom[k] = { es: v?.es ?? '', en: v?.en ?? '' };
            setMessages(custom);
            setDefaults(d.defaults ?? {});
            setPlaceholders(d.placeholders ?? {});
            setRoles(d.roles ?? []);
            setDirty(false);
            messagesDirty.current = false;
        } catch (e: any) {
            setError(e?.response?.status === 403 || e?.response?.status === 401 ? 'forbidden' : 'load_failed');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const update = useCallback(<K extends keyof ClipConfig>(key: K, value: ClipConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setDirty(true);
    }, []);

    const setMessage = useCallback((key: string, lang: 'es' | 'en', value: string) => {
        setMessages(prev => ({ ...prev, [key]: { ...(prev[key] ?? { es: '', en: '' }), [lang]: value } }));
        messagesDirty.current = true;
        setDirty(true);
    }, []);

    /** Devuelve null si salió bien, o el mensaje de error del servidor (o 'save_failed'). */
    const save = useCallback(async (): Promise<string | null> => {
        setSaving(true);
        try {
            const { downloadMonthlyCap: _cap, ...body } = config;
            const res = await api.put('/clipcommand/config', body);
            if (res.data?.config) setConfig(prev => ({ ...prev, ...res.data.config }));
            // Los mensajes se guardan después: necesitan que la fila de config ya exista
            if (messagesDirty.current) {
                await api.put('/clipcommand/messages', messages);
                messagesDirty.current = false;
            }
            setDirty(false);
            return null;
        } catch (e: any) {
            return e?.response?.data?.message || 'save_failed';
        } finally {
            setSaving(false);
        }
    }, [config, messages]);

    return { loading, saving, error, dirty, config, messages, defaults, placeholders, roles, update, setMessage, save, reload: load };
}

export type ClipCfg = ReturnType<typeof useClipConfig>;
