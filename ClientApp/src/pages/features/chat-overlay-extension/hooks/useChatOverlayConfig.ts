import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../../services/api';
import { DEFAULT_CHAT_CONFIG, normalizeChatConfig, type ChatOverlayConfig } from '../../../../components/chat-overlay/types';
import type { SampleEmote } from '../../../../components/chat-overlay/sample';

export interface ChatChannelInfo { login: string; hasTwitch: boolean; hasKick: boolean }

export interface ChannelEmote extends SampleEmote { name: string }

/** Carga y guarda la config del overlay de chat (/api/chat-overlay/config) */
export function useChatOverlayConfig() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    const [config, setConfig] = useState<ChatOverlayConfig>(DEFAULT_CHAT_CONFIG);
    const [channel, setChannel] = useState<ChatChannelInfo>({ login: '', hasTwitch: true, hasKick: false });
    const [overlayUrl, setOverlayUrl] = useState('');
    const [emotes, setEmotes] = useState<ChannelEmote[]>([]);
    const [emotesLoading, setEmotesLoading] = useState(false);
    const saved = useRef(JSON.stringify(DEFAULT_CHAT_CONFIG));

    const loadEmotes = useCallback(async () => {
        setEmotesLoading(true);
        try {
            const res = await api.get('/chat-overlay/emotes');
            if (res.data?.success) setEmotes(res.data.emotes);
        } catch { /* sin emotes externos se ve igual con los de Twitch */ }
        finally { setEmotesLoading(false); }
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [res, info] = await Promise.all([
                api.get('/chat-overlay/config'),
                api.get('/settings/frontend-info').catch(() => null),
            ]);
            const c = normalizeChatConfig(res.data?.config);
            saved.current = JSON.stringify(c);
            setConfig(c);
            const ch: ChatChannelInfo = res.data?.channel ?? { login: '', hasTwitch: true, hasKick: false };
            setChannel(ch);
            setOverlayUrl(`${info?.data?.frontendUrl || window.location.origin}/overlay/chat?channel=${ch.login || 'tu-canal'}`);
            setDirty(false);
            setError(null);
            loadEmotes();
        } catch (e) {
            const status = (e as { response?: { status?: number } })?.response?.status;
            setError(status === 403 ? 'forbidden' : 'load_failed');
        } finally {
            setLoading(false);
        }
    }, [loadEmotes]);

    useEffect(() => { load(); }, [load]);

    const update = useCallback((next: ChatOverlayConfig) => {
        setConfig(next);
        setDirty(JSON.stringify(next) !== saved.current);
    }, []);

    /** Devuelve null si guardó, o un texto de error */
    const save = useCallback(async (): Promise<string | null> => {
        setSaving(true);
        try {
            const res = await api.put('/chat-overlay/config', config);
            if (!res.data?.success) return res.data?.message || 'save_failed';
            saved.current = JSON.stringify(config);
            setDirty(false);
            return null;
        } catch (e) {
            return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'save_failed';
        } finally {
            setSaving(false);
        }
    }, [config]);

    const refreshEmotes = useCallback(async () => {
        setEmotesLoading(true);
        try {
            await api.post('/chat-overlay/emotes/refresh');
            await loadEmotes();
        } finally {
            setEmotesLoading(false);
        }
    }, [loadEmotes]);

    return { loading, saving, error, dirty, config, update, save, channel, overlayUrl, emotes, emotesLoading, refreshEmotes };
}

export type ChatOverlayConfigState = ReturnType<typeof useChatOverlayConfig>;
