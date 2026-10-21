import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../../services/api';
import { useFishVoices } from './fishVoices';
import { useVoiceCatalog, standardVoicesForLanguage } from '../../components/tts/useVoiceCatalog';
import { useOverlayStatus } from '../../components/overlay-editor/OverlayLinks';
import { cardClass, defaultConfig, defaultRoles, deepMerge, TABS } from './speakchat/shared';
import type { ActivationRule, ChannelPointsReward, CreditUsage, RoleConfig, SpeakChatConfigData, TabId, VoiceCommandLimits } from './speakchat/types';
import GlobalTab from './speakchat/GlobalTab';
import ActivationTab from './speakchat/ActivationTab';
import VoiceTab from './speakchat/VoiceTab';
import FiltersTab from './speakchat/FiltersTab';
import OverlayTab from './speakchat/OverlayTab';
import TestingTab from './speakchat/TestingTab';

// Cada pestaña vive en ./speakchat/. Aquí quedan el estado, la carga y el guardado.

export default function SpeakChat() {
    const { voices: fishVoices, creditsPerByte: fishCreditsPerByte } = useFishVoices();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabId>('global');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [saved, setSaved] = useState<'success' | 'error' | null>(null);
    const [historyKey, setHistoryKey] = useState(0);
    const [limits, setLimits] = useState<VoiceCommandLimits>({ max: 3, used: 0 });
    const [testError, setTestError] = useState<string | null>(null);
    const [config, setConfig] = useState<SpeakChatConfigData>(defaultConfig);
    const [expandedRules, setExpandedRules] = useState<Record<number, boolean>>({});
    const [usage, setUsage] = useState<CreditUsage | null>(null);
    const [rewards, setRewards] = useState<ChannelPointsReward[]>([]);
    const [rewardsError, setRewardsError] = useState(false);
    const [reloading, setReloading] = useState(false);
    const [testMessage, setTestMessage] = useState('Hola, este es un mensaje de prueba del Speak Chat');
    const [frontendBase, setFrontendBase] = useState('');
    const [fallbackChannel, setFallbackChannel] = useState('tu-canal');
    const { status, loaded: statusLoaded } = useOverlayStatus('/speakchat/status');
    const [blockedWordsText, setBlockedWordsText] = useState('');
    const [blockedUsersText, setBlockedUsersText] = useState('');
    const { catalog: voiceCatalog } = useVoiceCatalog();

    useEffect(() => {
        Promise.all([loadConfig(), loadUsage(), loadRewards()]);
    }, []);

    const loadConfig = async () => {
        try {
            const res = await api.get('/speakchat/config');
            if (res.data?.limits) setLimits(res.data.limits);
            if (res.data?.config?.data) {
                const merged = deepMerge(defaultConfig, res.data.config.data);
                // Configs antiguas guardaban una sola voz (siempre un nombre de Polly)
                if (!res.data.config.data.voice?.pollyVoice && merged.voice.voice) {
                    merged.voice.pollyVoice = merged.voice.voice;
                }
                // Una config guardada antes de esta opción conserva su comportamiento (parcial)
                if (!res.data.config.data.filters?.blockedWordsMode) merged.filters.blockedWordsMode = 'partial';
                setConfig(merged);
                setBlockedWordsText((merged.filters.blockedWords || []).join('\n'));
                setBlockedUsersText((merged.filters.blockedUsers || []).join('\n'));
            }
            // Obtener overlay URL con canal real
            const info = await api.get('/settings/frontend-info').catch(() => null);
            const channel = info?.data?.channel?.login ?? 'tu-canal';
            const base = info?.data?.frontendUrl ?? window.location.origin;
            setFrontendBase(base);
            setFallbackChannel(channel);
        } catch { /* usa defaults */ }
        finally { setLoading(false); }
    };

    const loadUsage = async () => {
        try {
            const res = await api.get('/speakchat/usage');
            if (res.data?.success) setUsage(res.data);
        } catch { /* silencioso */ }
    };

    /** Fuerza que los overlays abiertos recarguen la página, sin tocar OBS a mano. */
    const reloadOverlays = async () => {
        setReloading(true);
        try {
            await api.post('/speakchat/overlay/reload');
            // Recargar lleva unos segundos
            await new Promise(r => setTimeout(r, 5000));
        } catch { /* silencioso */ }
        finally { setReloading(false); }
    };

    // Recompensas reales del canal (mismo endpoint que usa Sound Alerts)
    const loadRewards = async () => {
        try {
            const res = await api.get('/soundalerts/channel-points-rewards');
            if (res.data?.success) setRewards(res.data.rewards || []);
            else setRewardsError(true);
        } catch {
            setRewardsError(true);
        }
    };

    const save = async () => {
        setSaving(true);
        setSaved(null);
        try {
            const toSave = {
                ...config,
                // Mantener `voice` sincronizado con la voz de Polly para no romper
                // configs leídas por versiones anteriores
                voice: { ...config.voice, voice: config.voice.pollyVoice || config.voice.voice },
                filters: {
                    ...config.filters,
                    blockedWords: blockedWordsText.split('\n').map(w => w.trim()).filter(Boolean),
                    blockedUsers: blockedUsersText.split('\n').map(u => u.trim()).filter(Boolean),
                }
            };
            await api.post('/speakchat/config', { config: toSave });
            setSaved('success');
            setHistoryKey(k => k + 1);
        } catch (err: any) {
            // Si el servidor rechazó el guardado (p. ej. por el tope de comandos), se muestra su motivo
            setTestError(err?.response?.data?.message ?? null);
            setSaved('error');
        } finally {
            setSaving(false);
            setTimeout(() => setSaved(null), 3000);
        }
    };

    const sendTest = async () => {
        setTesting(true);
        try {
            await api.post('/speakchat/test', {
                message: testMessage,
                // Cada motor tiene su propio catálogo de voces
                voice: config.voice.engine === 'polly' ? config.voice.pollyVoice
                    : config.voice.engine === 'fish' ? (config.voice.fishVoice || fishVoices[0]?.id || '')
                    : config.voice.standardVoice,
                engine: config.voice.engine,
                // Sin esto la prueba sonaría siempre en estándar y no se podría
                // comprobar la voz neural antes de dejarla puesta.
                pollyEngine: config.voice.pollyEngine,
                languageCode: config.voice.languageCode,
            });
            setTestError(null);
            setSaved('success');
        } catch (err: any) {
            // El servidor explica por qué rechazó la prueba —lo más habitual, que Speak
            // Chat esté apagado—. Enseñar "error al guardar" a secas manda al usuario a
            // buscar un problema que no existe.
            setTestError(err?.response?.data?.message ?? 'No se pudo enviar la prueba');
            setSaved('error');
        } finally {
            setTesting(false);
            setTimeout(() => { setSaved(null); setTestError(null); }, 6000);
        }
    };

    const updateRule = (idx: number, patch: Partial<ActivationRule>) => {
        const rules = [...config.activation.rules];
        rules[idx] = { ...rules[idx], ...patch };
        setConfig(c => ({ ...c, activation: { rules } }));
    };

    const updateRoleInRule = (idx: number, role: keyof RoleConfig, value: boolean) => {
        const rules = [...config.activation.rules];
        rules[idx] = { ...rules[idx], roles: { ...(rules[idx].roles ?? defaultRoles), [role]: value } };
        setConfig(c => ({ ...c, activation: { rules } }));
    };

    /** Comando nuevo con voz de personaje (o estándar si no hay créditos ni voces); queda desplegado para editarlo. */
    const addCommand = () => {
        const idx = config.activation.rules.length;
        const rule: ActivationRule = {
            type: 'command', enabled: true, commandName: '!', platform: 'all', roles: { ...defaultRoles },
            voice: { engine: 'piper', standardVoice: standardVoicesForLanguage(voiceCatalog, config.voice.languageCode)[0]?.id ?? '' },
        };
        setConfig(c => ({ ...c, activation: { rules: [...c.activation.rules, rule] } }));
        setExpandedRules(e => ({ ...e, [idx]: true }));
    };

    const removeRule = (idx: number) => {
        setConfig(c => ({ ...c, activation: { rules: c.activation.rules.filter((_, i) => i !== idx) } }));
        setExpandedRules({});
    };

    // Con los dos canales vinculados el enlace sale de la clave de la cuenta; con uno solo se mantiene el de siempre
    const overlayLink = (source?: 'all' | 'twitch' | 'kick') => {
        const key = source && status.overlayKey ? status.overlayKey : fallbackChannel;
        return `${frontendBase}/overlay/speak-chat?channel=${key}${source ? `&source=${source}` : ''}`;
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-4xl mb-4">🎤</div>
                    <p className="text-ds-soft font-bold">Cargando Speak Chat...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="panel-scale space-y-6 max-w-4xl mx-auto">

            {/* ===== HEADER ===== */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/features')}
                        className="ds-btn ds-btn--secondary ds-icon-btn"
                    >
                        <ArrowLeft className="w-5 h-5 text-ds-soft" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text flex items-center gap-3">
                            🎤 Speak Chat
                        </h1>
                        <p className="text-sm text-ds-soft mt-1">
                            Lee los mensajes del chat en voz alta con Text-to-Speech
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {saved && (
                        <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                            saved === 'success'
                                ? 'bg-ds-ok/10 text-ds-ok '
                                : 'bg-ds-danger/10 text-ds-danger '
                        }`}>
                            {saved === 'success' ? '✅ Guardado' : `❌ ${testError ?? 'Error al guardar'}`}
                        </span>
                    )}
                    <button
                        onClick={save}
                        disabled={saving}
                        className="ds-btn ds-btn--primary ds-btn--lg"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>

            {/* ===== TABS ===== */}
            <div className={cardClass}>
                <div className="flex flex-wrap gap-2">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={activeTab === tab.id ? 'ds-btn ds-btn--primary whitespace-nowrap' : 'ds-btn ds-btn--secondary whitespace-nowrap'}
                        >
                            {tab.emoji} {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'global' && (
                <GlobalTab
                    config={config} setConfig={setConfig}
                    overlayLink={overlayLink} status={status} statusLoaded={statusLoaded}
                    historyKey={historyKey}
                />
            )}

            {activeTab === 'activation' && (
                <ActivationTab
                    config={config}
                    rewards={rewards} rewardsError={rewardsError}
                    expandedRules={expandedRules} setExpandedRules={setExpandedRules}
                    updateRule={updateRule} updateRoleInRule={updateRoleInRule}
                    voiceCatalog={voiceCatalog} fishVoices={fishVoices}
                    paidAvailable={!!usage && (usage.isUnlimited || usage.totalAvailable > 0)}
                    limits={limits} addCommand={addCommand} removeRule={removeRule}
                />
            )}

            {activeTab === 'voice' && (
                <VoiceTab
                    config={config} setConfig={setConfig}
                    usage={usage} voiceCatalog={voiceCatalog}
                    fishVoices={fishVoices} fishCreditsPerByte={fishCreditsPerByte}
                    reloading={reloading} reloadOverlays={reloadOverlays}
                />
            )}

            {activeTab === 'filters' && (
                <FiltersTab
                    config={config} setConfig={setConfig}
                    blockedWordsText={blockedWordsText} setBlockedWordsText={setBlockedWordsText}
                    blockedUsersText={blockedUsersText} setBlockedUsersText={setBlockedUsersText}
                />
            )}

            {activeTab === 'overlay' && <OverlayTab config={config} setConfig={setConfig} />}

            {activeTab === 'testing' && (
                <TestingTab
                    usage={usage}
                    testMessage={testMessage} setTestMessage={setTestMessage}
                    testing={testing} sendTest={sendTest}
                />
            )}
        </div>
    );
}
