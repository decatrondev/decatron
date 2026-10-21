// Estado de Speak Chat: carga, cambios sin guardar, guardado, prueba, saldo y estado de OBS.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../../services/api';
import { useOverlayStatus } from '../../../../components/overlay-editor/OverlayLinks';
import { defaultConfig, defaultRoles, deepMerge } from '../shared';
import type { ActivationRule, ChannelPointsReward, CreditUsage, RoleConfig, SpeakChatConfigData, VoiceCommandLimits } from '../types';
import { standardVoicesForLanguage } from '../../../../components/tts/useVoiceCatalog';
import type { VoiceCatalog } from '../../../../components/tts/useVoiceCatalog';

export type SaveResult = { ok: boolean; message?: string | null };

/** Lo que el servidor guardó, con los arreglos para configuraciones anteriores a cada opción nueva. */
function normalize(saved: any): SpeakChatConfigData {
    const merged = deepMerge(defaultConfig, saved);
    // Configs antiguas guardaban una sola voz (siempre un nombre de Polly)
    if (!saved.voice?.pollyVoice && merged.voice.voice) merged.voice.pollyVoice = merged.voice.voice;
    // Una config guardada antes de las Fuentes sigue leyendo solo Twitch, como hasta ahora
    if (!saved.global?.sources) merged.global.sources = { twitch: true, kick: false };
    // Una guardada antes de la opción de palabras bloqueadas conserva la coincidencia parcial
    if (!saved.filters?.blockedWordsMode) merged.filters.blockedWordsMode = 'partial';
    return merged;
}

export function useSpeakChatConfig(voiceCatalog: VoiceCatalog) {
    const [config, setConfigState] = useState<SpeakChatConfigData>(defaultConfig);
    const [snapshot, setSnapshot] = useState(() => JSON.stringify(defaultConfig));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [reloading, setReloading] = useState(false);
    const [historyKey, setHistoryKey] = useState(0);
    const [limits, setLimits] = useState<VoiceCommandLimits>({ max: 3, used: 0 });
    const [usage, setUsage] = useState<CreditUsage | null>(null);
    const [rewards, setRewards] = useState<ChannelPointsReward[]>([]);
    const [rewardsError, setRewardsError] = useState(false);
    const [frontendBase, setFrontendBase] = useState('');
    const [fallbackChannel, setFallbackChannel] = useState('tu-canal');
    const { status, loaded: statusLoaded } = useOverlayStatus('/speakchat/status');
    const catalogRef = useRef(voiceCatalog);
    catalogRef.current = voiceCatalog;
    const configRef = useRef(config);
    configRef.current = config;

    const dirty = useMemo(() => JSON.stringify(config) !== snapshot, [config, snapshot]);
    const setConfig: React.Dispatch<React.SetStateAction<SpeakChatConfigData>> = useCallback(v => setConfigState(v), []);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/speakchat/config');
                if (res.data?.limits) setLimits(res.data.limits);
                if (res.data?.config?.data) {
                    const loaded = normalize(res.data.config.data);
                    setConfigState(loaded);
                    setSnapshot(JSON.stringify(loaded));
                } else {
                    setSnapshot(JSON.stringify(defaultConfig));
                }
                const info = await api.get('/settings/frontend-info').catch(() => null);
                setFrontendBase(info?.data?.frontendUrl ?? window.location.origin);
                setFallbackChannel(info?.data?.channel?.login ?? 'tu-canal');
            } catch { /* usa los valores por defecto */ }
            finally { setLoading(false); }
        })();
        api.get('/speakchat/usage').then(r => { if (r.data?.success) setUsage(r.data); }).catch(() => {});
        api.get('/soundalerts/channel-points-rewards')
            .then(r => { if (r.data?.success) setRewards(r.data.rewards || []); else setRewardsError(true); })
            .catch(() => setRewardsError(true));
    }, []);

    const save = useCallback(async (): Promise<SaveResult> => {
        setSaving(true);
        try {
            const toSave = {
                ...config,
                // Mantener `voice` sincronizado con la voz de Polly para no romper configs leídas por versiones anteriores
                voice: { ...config.voice, voice: config.voice.pollyVoice || config.voice.voice },
            };
            await api.post('/speakchat/config', { config: toSave });
            setSnapshot(JSON.stringify(config));
            setHistoryKey(k => k + 1);
            api.get('/speakchat/usage').then(r => { if (r.data?.success) setUsage(r.data); }).catch(() => {});
            return { ok: true };
        } catch (err: any) {
            // Si el servidor rechazó el guardado (p. ej. por el tope de comandos) se muestra su motivo
            return { ok: false, message: err?.response?.data?.message ?? null };
        } finally {
            setSaving(false);
        }
    }, [config]);

    const sendTest = useCallback(async (message: string, fishFallback: string): Promise<SaveResult> => {
        setTesting(true);
        try {
            await api.post('/speakchat/test', {
                message,
                // Cada motor tiene su propio catálogo de voces
                voice: config.voice.engine === 'polly' ? config.voice.pollyVoice
                    : config.voice.engine === 'fish' ? (config.voice.fishVoice || fishFallback)
                    : config.voice.standardVoice,
                engine: config.voice.engine,
                pollyEngine: config.voice.pollyEngine,
                languageCode: config.voice.languageCode,
            });
            return { ok: true };
        } catch (err: any) {
            return { ok: false, message: err?.response?.data?.message ?? null };
        } finally {
            setTesting(false);
        }
    }, [config.voice]);

    /** Fuerza que los overlays abiertos recarguen la página, sin tocar OBS a mano. */
    const reloadOverlays = useCallback(async () => {
        setReloading(true);
        try {
            await api.post('/speakchat/overlay/reload');
            await new Promise(r => setTimeout(r, 5000)); // recargar lleva unos segundos
        } catch { /* silencioso */ }
        finally { setReloading(false); }
    }, []);

    const updateRule = useCallback((idx: number, patch: Partial<ActivationRule>) => {
        setConfigState(c => {
            const rules = [...c.activation.rules];
            rules[idx] = { ...rules[idx], ...patch };
            return { ...c, activation: { rules } };
        });
    }, []);

    const updateRole = useCallback((idx: number, role: keyof RoleConfig, value: boolean) => {
        setConfigState(c => {
            const rules = [...c.activation.rules];
            rules[idx] = { ...rules[idx], roles: { ...(rules[idx].roles ?? defaultRoles), [role]: value } };
            return { ...c, activation: { rules } };
        });
    }, []);

    /** Comando nuevo con la voz estándar del idioma del canal; el motor y la voz se eligen después. */
    const addCommand = useCallback((): number => {
        const index = configRef.current.activation.rules.length;
        setConfigState(c => {
            const rule: ActivationRule = {
                type: 'command', enabled: true, commandName: '!', roles: { ...defaultRoles },
                voice: { engine: 'piper', standardVoice: standardVoicesForLanguage(catalogRef.current, c.voice.languageCode)[0]?.id ?? '' },
            };
            return { ...c, activation: { rules: [...c.activation.rules, rule] } };
        });
        return index;
    }, []);

    const removeRule = useCallback((idx: number) => {
        setConfigState(c => ({ ...c, activation: { rules: c.activation.rules.filter((_, i) => i !== idx) } }));
    }, []);

    // Con los dos canales vinculados el enlace sale de la clave de la cuenta; con uno solo se mantiene el de siempre
    const overlayLink = useCallback((source?: 'all' | 'twitch' | 'kick') => {
        const key = source && status.overlayKey ? status.overlayKey : fallbackChannel;
        return `${frontendBase}/overlay/speak-chat?channel=${key}${source ? `&source=${source}` : ''}`;
    }, [status.overlayKey, fallbackChannel, frontendBase]);

    return {
        config, setConfig, dirty, loading, saving, testing, reloading, historyKey, limits, usage, rewards, rewardsError,
        status, statusLoaded, overlayLink, save, sendTest, reloadOverlays, updateRule, updateRole, addCommand, removeRule,
    };
}

export type SpeakChatState = ReturnType<typeof useSpeakChatConfig>;
