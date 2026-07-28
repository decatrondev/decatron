import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Save, Check, Copy, Mic, Globe, Zap, Volume2,
    Filter, Monitor, TestTube2, ChevronDown, ChevronUp, Lock, AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import {
    useVoiceCatalog,
    standardVoicesForLanguage,
    premiumVoicesForLanguage,
    languagesFor,
} from '../../components/tts/useVoiceCatalog';

// ===================== TYPES =====================

interface RoleConfig {
    everyone: boolean;
    subscriber: boolean;
    vip: boolean;
    moderator: boolean;
    broadcaster: boolean;
}

/** Cartera de créditos TTS. Dos bolsas: la estándar y la premium. */
interface CreditUsage {
    tier: string;
    isUnlimited: boolean;
    monthlyGranted: number;
    monthlyUsed: number;
    monthlyRemaining: number;
    purchasedBalance: number;
    totalAvailable: number;
    standardGranted: number;
    standardUsed: number;
    standardRemaining: number;
    standardPercentage: number;
    inTransitionWindow: boolean;
    transitionEndsAt: string | null;
    tierExpiresAt: string | null;
    percentage: number;
}

interface ChannelPointsReward {
    id: string;
    title: string;
    cost: number;
}

interface ActivationRule {
    type: 'command' | 'bits' | 'channelPoints' | 'roles' | 'all';
    enabled: boolean;
    commandName?: string;
    minBits?: number;
    rewardId?: string;
    roles?: RoleConfig;
}

interface SpeakChatConfigData {
    global: { enabled: boolean };
    activation: { rules: ActivationRule[] };
    // `voice` es el campo antiguo (nombre de voz Polly). Se conserva por
    // compatibilidad, pero cada motor tiene ya su propio campo.
    // `engine` es el proveedor (estándar o premium); `pollyEngine`, la calidad dentro de
    // Polly, que es lo que decide el multiplicador de créditos.
    voice: { engine: 'piper' | 'polly'; voice: string; pollyVoice: string; standardVoice: string; pollyEngine: 'standard' | 'neural'; languageCode: string; volume: number };
    filters: { globalCooldownSeconds: number; perUserCooldownSeconds: number; maxChars: number; blockedWords: string[]; blockedUsers: string[] };
    overlay: { showBubble: boolean; position: string; fontSize: number; backgroundColor: string; textColor: string; duration: number };
}

// ===================== DEFAULTS =====================

const defaultRoles: RoleConfig = { everyone: true, subscriber: false, vip: false, moderator: false, broadcaster: true };

const defaultConfig: SpeakChatConfigData = {
    global: { enabled: false },
    activation: {
        rules: [
            { type: 'command', enabled: false, commandName: '!tts', roles: { ...defaultRoles } },
            { type: 'bits', enabled: false, minBits: 100, roles: { ...defaultRoles } },
            { type: 'channelPoints', enabled: false, rewardId: '', roles: { ...defaultRoles } },
            { type: 'roles', enabled: false, roles: { everyone: false, subscriber: true, vip: true, moderator: true, broadcaster: true } },
            { type: 'all', enabled: false },
        ]
    },
    voice: { engine: 'piper', voice: 'Lupe', pollyVoice: 'Lupe', standardVoice: '', pollyEngine: 'standard', languageCode: 'es-US', volume: 80 },
    filters: { globalCooldownSeconds: 0, perUserCooldownSeconds: 10, maxChars: 200, blockedWords: [], blockedUsers: [] },
    overlay: { showBubble: true, position: 'bottom-left', fontSize: 16, backgroundColor: 'rgba(0,0,0,0.75)', textColor: '#ffffff', duration: 5000 }
};

// ===================== VOICE DATA =====================
//
// Las voces y los idiomas ya no se escriben aquí: vienen de `useVoiceCatalog`, que los
// pide al servidor. La lista de este archivo tenía 16 voces y la de las alertas 21, y
// ninguna de las dos coincidía con lo que AWS ofrece de verdad.

const RULE_META: Record<string, { label: string; emoji: string; desc: string }> = {
    command:       { label: 'Comando de chat',    emoji: '💬', desc: 'El viewer escribe el comando seguido del texto a leer' },
    bits:          { label: 'Bits mínimos',        emoji: '💎', desc: 'Cuando alguien dona X bits o más, se lee el mensaje' },
    channelPoints: { label: 'Puntos de canal',     emoji: '⭐', desc: 'Al canjear una recompensa específica de puntos' },
    roles:         { label: 'Por rol',             emoji: '🎭', desc: 'Solo usuarios con el rol habilitado activan el TTS' },
    all:           { label: 'Todos los mensajes',  emoji: '🌐', desc: 'Lee absolutamente todos los mensajes del chat' },
};

type TabId = 'global' | 'activation' | 'voice' | 'filters' | 'overlay' | 'testing';

const TABS: { id: TabId; emoji: string; label: string }[] = [
    { id: 'global',     emoji: '⚙️',  label: 'Global' },
    { id: 'activation', emoji: '⚡',  label: 'Activación' },
    { id: 'voice',      emoji: '🔊',  label: 'Voz' },
    { id: 'filters',    emoji: '🛡️',  label: 'Filtros' },
    { id: 'overlay',    emoji: '🖥️',  label: 'Overlay' },
    { id: 'testing',    emoji: '🧪',  label: 'Testing' },
];

// ===================== SHARED CLASSES =====================

const cardClass = 'rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg';
const inputClass = 'w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm';
const labelClass = 'text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2';
const sectionTitle = 'text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-1';
const sectionDesc  = 'text-xs text-[#64748b] dark:text-[#94a3b8] mb-4';

// ===================== TOGGLE =====================

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
            <div className="w-14 h-7 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6]" />
        </label>
    );
}

// ===================== COMPONENT =====================

export default function SpeakChat() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabId>('global');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [saved, setSaved] = useState<'success' | 'error' | null>(null);
    const [testError, setTestError] = useState<string | null>(null);
    const [config, setConfig] = useState<SpeakChatConfigData>(defaultConfig);
    const [expandedRules, setExpandedRules] = useState<Record<number, boolean>>({});
    const [usage, setUsage] = useState<CreditUsage | null>(null);
    const [rewards, setRewards] = useState<ChannelPointsReward[]>([]);
    const [rewardsError, setRewardsError] = useState(false);
    const [reloading, setReloading] = useState(false);
    const [testMessage, setTestMessage] = useState('Hola, este es un mensaje de prueba del Speak Chat');
    const [overlayUrl, setOverlayUrl] = useState('');
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [blockedWordsText, setBlockedWordsText] = useState('');
    const [blockedUsersText, setBlockedUsersText] = useState('');
    const { catalog: voiceCatalog } = useVoiceCatalog();

    useEffect(() => {
        Promise.all([loadConfig(), loadUsage(), loadRewards()]);
    }, []);

    const loadConfig = async () => {
        try {
            const res = await api.get('/speakchat/config');
            if (res.data?.config?.data) {
                const merged = deepMerge(defaultConfig, res.data.config.data);
                // Configs antiguas guardaban una sola voz (siempre un nombre de Polly)
                if (!res.data.config.data.voice?.pollyVoice && merged.voice.voice) {
                    merged.voice.pollyVoice = merged.voice.voice;
                }
                setConfig(merged);
                setBlockedWordsText((merged.filters.blockedWords || []).join('\n'));
                setBlockedUsersText((merged.filters.blockedUsers || []).join('\n'));
            }
            // Obtener overlay URL con canal real
            const info = await api.get('/settings/frontend-info').catch(() => null);
            const channel = info?.data?.channel?.login ?? 'tu-canal';
            const base = info?.data?.frontendUrl ?? window.location.origin;
            setOverlayUrl(`${base}/overlay/speak-chat?channel=${channel}`);
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

    function deepMerge(target: any, source: any): any {
        const result = { ...target };
        for (const key of Object.keys(source)) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = deepMerge(target[key] ?? {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }

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
        } catch {
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
                voice: config.voice.engine === 'polly' ? config.voice.pollyVoice : config.voice.standardVoice,
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

    const copyOverlayUrl = () => {
        navigator.clipboard.writeText(overlayUrl);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
    };

    // Polly depende de tener créditos, no del tier: una cuenta free con créditos
    // comprados o de la transición puede usarlo.
    const isPollyAvailable = !!usage && (usage.isUnlimited || usage.totalAvailable > 0);

    // Catálogo de voces estándar, servido por el servidor: igual para todo el mundo
    const standardVoicesForLang = standardVoicesForLanguage(voiceCatalog, config.voice.languageCode);
    // Filtradas por la calidad elegida: no todas las voces hacen neural, y ofrecer una
    // que no puede acabaría en un fallo de síntesis en pleno directo.
    const premiumVoicesForLang = premiumVoicesForLanguage(
        voiceCatalog, config.voice.languageCode, config.voice.pollyEngine);

    // Los idiomas dependen de lo elegido antes: del proveedor y, en premium, también de
    // la calidad. Hay 13 idiomas que solo existen en alta calidad y 6 solo en normal, así
    // que sin filtrar por ella se puede elegir un idioma sin ninguna voz detrás.
    const languageOptions = config.voice.engine === 'polly'
        ? languagesFor(voiceCatalog, 'polly', config.voice.pollyEngine)
        : languagesFor(voiceCatalog, 'piper');

    // Cambiar la calidad puede dejar el idioma sin voces. Se conserva si sigue estando y,
    // si no, se salta al primero disponible: nunca se guarda una combinación imposible.
    const changePollyEngine = (pollyEngine: 'standard' | 'neural') => {
        const langs = languagesFor(voiceCatalog, 'polly', pollyEngine);
        const keeps = langs.some(l => l.code === config.voice.languageCode);
        const languageCode = keeps ? config.voice.languageCode : (langs[0]?.code ?? config.voice.languageCode);
        const firstVoice = premiumVoicesForLanguage(voiceCatalog, languageCode, pollyEngine)[0];

        setConfig(c => ({
            ...c,
            voice: {
                ...c.voice,
                pollyEngine,
                languageCode,
                pollyVoice: firstVoice?.id ?? '',
            }
        }));
    };

    // Créditos Polly restantes
    const charsLeft = usage && !usage.isUnlimited ? usage.totalAvailable : null;
    const creditsExhausted = charsLeft !== null && charsLeft === 0;
    const creditsLow = charsLeft !== null && !creditsExhausted &&
        usage!.monthlyGranted > 0 && usage!.percentage >= 85 && usage!.purchasedBalance === 0;

    const transitionEndsLabel = usage?.transitionEndsAt
        ? new Date(usage.transitionEndsAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
        : null;

    const tierExpiryLabel = usage?.tierExpiresAt
        ? new Date(usage.tierExpiresAt).toLocaleString('es-ES', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        })
        : null;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-4xl mb-4">🎤</div>
                    <p className="text-[#64748b] dark:text-[#94a3b8] font-bold">Cargando Speak Chat...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">

            {/* ===== HEADER ===== */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/features')}
                        className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors shadow-lg"
                    >
                        <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-3">
                            🎤 Speak Chat
                        </h1>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Lee los mensajes del chat en voz alta con Text-to-Speech
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {saved && (
                        <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                            saved === 'success'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                            {saved === 'success' ? '✅ Guardado' : `❌ ${testError ?? 'Error al guardar'}`}
                        </span>
                    )}
                    <button
                        onClick={save}
                        disabled={saving}
                        className="px-6 py-3 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-60 text-white rounded-xl transition-all flex items-center gap-2 font-bold shadow-lg"
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
                            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                activeTab === tab.id
                                    ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-lg'
                                    : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                            }`}
                        >
                            {tab.emoji} {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ===== GLOBAL ===== */}
            {activeTab === 'global' && (
                <div className="space-y-6">
                    <div className={cardClass}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={sectionTitle}>🎤 Speak Chat activo</p>
                                <p className={sectionDesc}>Activa o desactiva la lectura de mensajes en este canal</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Toggle
                                    checked={config.global.enabled}
                                    onChange={v => setConfig(c => ({ ...c, global: { enabled: v } }))}
                                />
                                <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    {config.global.enabled ? 'Activado' : 'Desactivado'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className={cardClass}>
                        <p className={sectionTitle}>🔗 URL del Overlay (OBS)</p>
                        <p className={sectionDesc}>
                            Agrega esta URL como Browser Source en OBS Studio. Con plan pago funciona directo en OBS.
                            Con el plan Free necesitas tener una pestaña del navegador abierta.
                        </p>
                        <div className="flex gap-2">
                            <input
                                readOnly
                                value={overlayUrl || 'Cargando...'}
                                className={`${inputClass} font-mono`}
                            />
                            <button
                                onClick={copyOverlayUrl}
                                disabled={!overlayUrl}
                                className="px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50 text-white rounded-lg transition-all font-bold text-sm flex items-center gap-2 whitespace-nowrap"
                            >
                                {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copiedUrl ? '¡Copiado!' : 'Copiar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== ACTIVACIÓN ===== */}
            {activeTab === 'activation' && (
                <div className="space-y-4">
                    <div className={cardClass}>
                        <p className={sectionTitle}>⚡ Reglas de activación</p>
                        <p className={sectionDesc}>
                            Habilita una o más reglas. Si cualquier regla activa se cumple, el mensaje se lee.
                            Puedes tener varias activas al mismo tiempo.
                        </p>
                    </div>

                    {config.activation.rules.map((rule, idx) => {
                        const meta = RULE_META[rule.type];
                        return (
                            <div key={rule.type} className={cardClass + ' !p-0 overflow-hidden'}>
                                {/* Header de la regla */}
                                <div className="flex items-center justify-between p-6">
                                    <div className="flex items-center gap-4">
                                        <Toggle
                                            checked={rule.enabled}
                                            onChange={v => updateRule(idx, { enabled: v })}
                                        />
                                        <div>
                                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                                {meta.emoji} {meta.label}
                                            </p>
                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{meta.desc}</p>
                                        </div>
                                    </div>
                                    {rule.type !== 'all' && (
                                        <button
                                            onClick={() => setExpandedRules(e => ({ ...e, [idx]: !e[idx] }))}
                                            className="p-2 rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors"
                                        >
                                            {expandedRules[idx] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>

                                {/* Body expandible */}
                                {expandedRules[idx] && rule.type !== 'all' && (
                                    <div className="border-t border-[#e2e8f0] dark:border-[#374151] p-6 space-y-5 bg-[#f8fafc] dark:bg-[#262626]">

                                        {rule.type === 'command' && (
                                            <div>
                                                <label className={labelClass}>Nombre del comando</label>
                                                <input
                                                    value={rule.commandName ?? '!tts'}
                                                    onChange={e => updateRule(idx, { commandName: e.target.value })}
                                                    placeholder="!tts"
                                                    className={`${inputClass} w-48`}
                                                />
                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                                    Ej: <code className="bg-[#e2e8f0] dark:bg-[#374151] px-1 rounded">!tts Hola streamer</code> → lee "Hola streamer"
                                                </p>
                                            </div>
                                        )}

                                        {rule.type === 'bits' && (
                                            <div>
                                                <label className={labelClass}>Bits mínimos</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={rule.minBits ?? 100}
                                                    onChange={e => updateRule(idx, { minBits: parseInt(e.target.value) || 1 })}
                                                    className={`${inputClass} w-32`}
                                                />
                                            </div>
                                        )}

                                        {rule.type === 'channelPoints' && (
                                            <div>
                                                <label className={labelClass}>Recompensa de puntos de canal</label>

                                                {rewards.length > 0 ? (
                                                    <>
                                                        <select
                                                            value={rule.rewardId ?? ''}
                                                            onChange={e => updateRule(idx, { rewardId: e.target.value })}
                                                            className={inputClass}
                                                        >
                                                            <option value="">— Elige una recompensa —</option>
                                                            {rewards.map(r => (
                                                                <option key={r.id} value={r.id}>
                                                                    {r.title} ({r.cost} puntos)
                                                                </option>
                                                            ))}
                                                            {/* La recompensa guardada puede haberse borrado en Twitch */}
                                                            {rule.rewardId && !rewards.some(r => r.id === rule.rewardId) && (
                                                                <option value={rule.rewardId}>
                                                                    Recompensa desconocida ({rule.rewardId.slice(0, 8)}…)
                                                                </option>
                                                            )}
                                                        </select>
                                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                                            Recomendado: que la recompensa pida texto al viewer — ese texto es lo que se lee.
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <input
                                                            value={rule.rewardId ?? ''}
                                                            onChange={e => updateRule(idx, { rewardId: e.target.value })}
                                                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                                            className={`${inputClass} font-mono`}
                                                        />
                                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                                            {rewardsError
                                                                ? 'No se pudieron cargar tus recompensas (token expirado o canal sin afiliación). Pega el ID a mano.'
                                                                : 'No hay recompensas de puntos en este canal. Créalas en Twitch o pega el ID a mano.'}
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Roles */}
                                        <div>
                                            <label className={labelClass}>¿Quién puede usar esta regla?</label>
                                            <div className="flex flex-wrap gap-2">
                                                {([
                                                    { key: 'everyone',    label: '🌐 Todos' },
                                                    { key: 'subscriber',  label: '⭐ Subs' },
                                                    { key: 'vip',         label: '💎 VIPs' },
                                                    { key: 'moderator',   label: '🛡️ Mods' },
                                                    { key: 'broadcaster', label: '🎙️ Streamer' },
                                                ] as const).map(({ key, label }) => (
                                                    <button
                                                        key={key}
                                                        onClick={() => updateRoleInRule(idx, key, !(rule.roles?.[key] ?? false))}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                            (rule.roles?.[key] ?? false)
                                                                ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow'
                                                                : 'bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#262626]'
                                                        }`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ===== VOZ ===== */}
            {activeTab === 'voice' && (
                <div className="space-y-6">
                    {/* Recarga de overlays. Se actualizan solos al detectar un despliegue
                        nuevo; el botón es para no esperar. */}
                    <div className={cardClass}>
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    El audio se genera en el servidor
                                </p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    Con voz estándar o premium sale siempre un MP3, así que suena en cualquier
                                    OBS sin depender de las voces que tenga instaladas ese equipo.
                                </p>
                            </div>
                            <button
                                onClick={reloadOverlays}
                                disabled={reloading}
                                className="px-4 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] text-xs font-bold hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors disabled:opacity-50"
                                title="Los overlays se actualizan solos, pero esto lo hace al instante"
                            >
                                {reloading ? '♻️ Recargando…' : '♻️ Recargar overlays'}
                            </button>
                        </div>
                    </div>

                    {/* Plan badge */}
                    <div className={`${cardClass} ${
                        isPollyAvailable
                            ? 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                            : ''
                    }`}>
                        <div className="flex items-start gap-4">
                            {isPollyAvailable
                                ? <div className="text-3xl">🎙️</div>
                                : <Lock className="w-8 h-8 text-[#94a3b8] flex-shrink-0 mt-1" />
                            }
                            <div className="flex-1">
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    {usage?.isUnlimited
                                        ? `Plan ${usage.tier} — créditos ilimitados`
                                        : isPollyAvailable
                                            ? `${(usage?.totalAvailable ?? 0).toLocaleString()} créditos premium disponibles`
                                            : 'Sin créditos premium'
                                    }
                                </p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    {usage?.isUnlimited
                                        ? 'Las voces de AWS Polly suenan en cualquier OBS.'
                                        : isPollyAvailable
                                            ? `1 crédito premium = 1 carácter. ${usage!.monthlyUsed.toLocaleString()} usados este mes de ${usage!.monthlyGranted.toLocaleString()} de tu plan${usage!.purchasedBalance > 0 ? `, más ${usage!.purchasedBalance.toLocaleString()} comprados que no caducan` : ''}.`
                                            : 'Los créditos premium abren las voces de Polly, con más idiomas y japonés. La voz estándar sigue funcionando sin ellos.'
                                    }
                                </p>
                                {usage && !usage.isUnlimited && usage.standardGranted > 0 && (
                                    <p className="text-xs text-green-700 dark:text-green-400 mt-1 font-bold">
                                        🆓 Voz estándar: {usage.standardRemaining.toLocaleString()} de {usage.standardGranted.toLocaleString()} caracteres este mes, incluidos en tu plan.
                                    </p>
                                )}
                                {isPollyAvailable && !usage?.isUnlimited && creditsLow && (
                                    <p className="text-xs mt-1 font-bold text-yellow-600 dark:text-yellow-500">
                                        ⚠️ Te queda poco saldo premium — al agotarse tendrás que cambiar a voz estándar.
                                    </p>
                                )}
                                {creditsExhausted && (
                                    <p className="text-xs mt-1 font-bold text-red-600 dark:text-red-400">
                                        ❌ Sin créditos premium. Se seguirá leyendo con voz estándar hasta tu cuota del día 1.
                                    </p>
                                )}
                                {config.voice.engine === 'polly' && (
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        Si te quedas sin créditos premium el chat no se queda mudo: se lee con voz estándar.
                                        {config.voice.languageCode.startsWith('ja') && ' Como el japonés no existe en voz estándar, sonará en español.'}
                                    </p>
                                )}
                                {usage?.inTransitionWindow && usage.tier === 'free' && transitionEndsLabel && (
                                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                        🎁 Créditos de bienvenida hasta el {transitionEndsLabel}. Después de esa fecha
                                        necesitarás un plan o un paquete de créditos para seguir usando Polly.
                                    </p>
                                )}
                                {isPollyAvailable && tierExpiryLabel && (
                                    <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                                        ⏳ Tu plan vence el {tierExpiryLabel}. Los créditos comprados no se pierden.
                                    </p>
                                )}
                                {isPollyAvailable && usage && !usage.isUnlimited && usage.monthlyGranted > 0 && (
                                    <div className="mt-3 h-2 bg-[#e2e8f0] dark:bg-[#374151] rounded-full overflow-hidden w-64">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                usage.percentage > 90 ? 'bg-red-500' : usage.percentage > 70 ? 'bg-yellow-500' : 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6]'
                                            }`}
                                            style={{ width: `${Math.min(usage.percentage, 100)}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={cardClass}>
                        <div className="space-y-6">
                            {/* Motor */}
                            <div>
                                <label className={labelClass}>Motor de voz</label>
                                <div className="flex gap-3">
                                    {[
                                        { id: 'piper', label: '🆓 Voz estándar', available: true },
                                        { id: 'polly', label: '🎙️ Voz premium', available: !!isPollyAvailable },
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => opt.available && setConfig(c => ({ ...c, voice: { ...c.voice, engine: opt.id as any } }))}
                                            disabled={!opt.available}
                                            className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                                                config.voice.engine === opt.id
                                                    ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20 text-[#2563eb]'
                                                    : opt.available
                                                        ? 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:border-[#94a3b8]'
                                                        : 'border-[#e2e8f0] dark:border-[#374151] text-[#94a3b8] dark:text-[#64748b] opacity-50 cursor-not-allowed'
                                            }`}
                                        >
                                            {opt.label} {!opt.available && <Lock className="w-3 h-3 inline ml-1" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Calidad primero: decide el precio y recorta los idiomas */}
                            {config.voice.engine === 'polly' && (
                                <div>
                                    <label className={labelClass}>Calidad</label>
                                    <select
                                        value={config.voice.pollyEngine}
                                        onChange={e => changePollyEngine(e.target.value as 'standard' | 'neural')}
                                        className={inputClass}
                                    >
                                        <option value="standard">Normal · 1 crédito por carácter</option>
                                        <option value="neural">Alta calidad · 4 créditos por carácter</option>
                                    </select>
                                    {config.voice.pollyEngine === 'neural' && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                            Suena mucho mejor, pero cada mensaje gasta cuatro veces más.
                                            Speak Chat lee mucho: revisa el saldo antes de dejarlo puesto.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Idioma: depende de la calidad elegida arriba */}
                            <div>
                                <label className={labelClass}>Idioma</label>
                                <select
                                    value={config.voice.languageCode}
                                    onChange={e => {
                                        const lang = e.target.value;
                                        // Al cambiar de idioma se reasignan las dos voces. Dejar la
                                        // anterior es lo que producía "voz japonesa, idioma español".
                                        const firstPremium = premiumVoicesForLanguage(
                                            voiceCatalog, lang, config.voice.pollyEngine)[0];
                                        const firstStandard = standardVoicesForLanguage(voiceCatalog, lang)[0];
                                        setConfig(c => ({
                                            ...c,
                                            voice: {
                                                ...c.voice,
                                                languageCode: lang,
                                                pollyVoice: firstPremium?.id ?? '',
                                                standardVoice: firstStandard?.id ?? '',
                                            }
                                        }));
                                    }}
                                    className={inputClass}
                                >
                                    {languageOptions.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                                </select>
                                {config.voice.engine !== 'polly' ? (
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        El japonés y el coreano solo están en voz premium.
                                    </p>
                                ) : (
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        Solo los idiomas con voces en la calidad elegida. Algunos existen
                                        en una y no en la otra.
                                    </p>
                                )}
                            </div>

                            {/* Voz — el catálogo depende del motor */}
                            {config.voice.engine === 'polly' ? (
                                <div>
                                    <label className={labelClass}>Voz (AWS Polly)</label>
                                    <select
                                        value={config.voice.pollyVoice}
                                        onChange={e => setConfig(c => ({ ...c, voice: { ...c.voice, pollyVoice: e.target.value } }))}
                                        className={inputClass}
                                    >
                                        {premiumVoicesForLang.map(v => (
                                            <option key={v.id} value={v.id}>
                                                {v.name}{v.gender ? ` · ${v.gender === 'Female' ? 'F' : 'M'}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {premiumVoicesForLang.length === 0 && (
                                        <p className="text-xs text-yellow-500 mt-1">
                                            No hay voces para este idioma en calidad{' '}
                                            {config.voice.pollyEngine === 'neural' ? 'alta' : 'normal'}. Prueba con la otra.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label className={labelClass}>
                                        Voz estándar
                                        {standardVoicesForLang.length > 0 && (
                                            <span className="font-normal normal-case ml-1">
                                                ({standardVoicesForLang.length} para este idioma)
                                            </span>
                                        )}
                                    </label>

                                    {standardVoicesForLang.length === 0 ? (
                                        <div className="px-4 py-3 rounded-lg border border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 text-xs text-yellow-700 dark:text-yellow-300">
                                            No hay voces estándar para este idioma. Cambia de idioma o usa voz premium.
                                        </div>
                                    ) : (
                                        <>
                                            <select
                                                value={config.voice.standardVoice}
                                                onChange={e => setConfig(c => ({ ...c, voice: { ...c.voice, standardVoice: e.target.value } }))}
                                                className={inputClass}
                                            >
                                                <option value="">Automática (la primera del idioma)</option>
                                                {standardVoicesForLang.map(v => (
                                                    <option key={v.id} value={v.id}>
                                                        {v.name} — {v.languageName} ({v.quality})
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                                Se generan en el servidor, así que suenan igual en cualquier OBS.
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Volumen */}
                            <div>
                                <label className={labelClass}>Volumen — {config.voice.volume}%</label>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={config.voice.volume}
                                    onChange={e => setConfig(c => ({ ...c, voice: { ...c.voice, volume: parseInt(e.target.value) } }))}
                                    className="w-full accent-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== FILTROS ===== */}
            {activeTab === 'filters' && (
                <div className="space-y-6">
                    <div className={cardClass}>
                        <p className={sectionTitle}>⏱️ Cooldowns</p>
                        <p className={sectionDesc}>Controla la frecuencia con que se leen mensajes</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>Cooldown global (segundos)</label>
                                <p className="text-xs text-[#94a3b8] mb-2">Tiempo mínimo entre cualquier mensaje leído</p>
                                <input
                                    type="number"
                                    min={0}
                                    value={config.filters.globalCooldownSeconds}
                                    onChange={e => setConfig(c => ({ ...c, filters: { ...c.filters, globalCooldownSeconds: parseInt(e.target.value) || 0 } }))}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Cooldown por usuario (segundos)</label>
                                <p className="text-xs text-[#94a3b8] mb-2">Tiempo mínimo entre mensajes del mismo usuario</p>
                                <input
                                    type="number"
                                    min={0}
                                    value={config.filters.perUserCooldownSeconds}
                                    onChange={e => setConfig(c => ({ ...c, filters: { ...c.filters, perUserCooldownSeconds: parseInt(e.target.value) || 0 } }))}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                        <div className="mt-6">
                            <label className={labelClass}>Máximo de caracteres por mensaje</label>
                            <input
                                type="number"
                                min={10}
                                max={500}
                                value={config.filters.maxChars}
                                onChange={e => setConfig(c => ({ ...c, filters: { ...c.filters, maxChars: parseInt(e.target.value) || 200 } }))}
                                className={`${inputClass} w-32`}
                            />
                        </div>
                    </div>

                    <div className={cardClass}>
                        <p className={sectionTitle}>🚫 Listas de bloqueo</p>
                        <p className={sectionDesc}>Los mensajes con estas palabras o de estos usuarios no se leerán</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>Palabras bloqueadas (una por línea)</label>
                                <textarea
                                    value={blockedWordsText}
                                    onChange={e => setBlockedWordsText(e.target.value)}
                                    rows={6}
                                    placeholder={'spam\nofensivo\n...'}
                                    className={`${inputClass} resize-none font-mono`}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Usuarios bloqueados (uno por línea)</label>
                                <textarea
                                    value={blockedUsersText}
                                    onChange={e => setBlockedUsersText(e.target.value)}
                                    rows={6}
                                    placeholder={'usuario1\nusuario2\n...'}
                                    className={`${inputClass} resize-none font-mono`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== OVERLAY ===== */}
            {activeTab === 'overlay' && (
                <div className="space-y-6">
                    <div className={cardClass}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className={sectionTitle}>🖥️ Burbuja de mensaje</p>
                                <p className={sectionDesc}>Muestra un globo con el username y el mensaje mientras se lee</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Toggle
                                    checked={config.overlay.showBubble}
                                    onChange={v => setConfig(c => ({ ...c, overlay: { ...c.overlay, showBubble: v } }))}
                                />
                                <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    {config.overlay.showBubble ? 'Visible' : 'Solo audio'}
                                </span>
                            </div>
                        </div>

                        {config.overlay.showBubble && (
                            <div className="space-y-6">
                                {/* Posición */}
                                <div>
                                    <label className={labelClass}>Posición en pantalla</label>
                                    <div className="grid grid-cols-3 gap-2 w-64">
                                        {(['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right'] as const).map(pos => (
                                            <button
                                                key={pos}
                                                onClick={() => setConfig(c => ({ ...c, overlay: { ...c.overlay, position: pos } }))}
                                                className={`py-2 px-2 rounded-lg border text-xs font-bold transition-all ${
                                                    config.overlay.position === pos
                                                        ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20 text-[#2563eb]'
                                                        : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:border-[#94a3b8]'
                                                }`}
                                            >
                                                {pos.replace('-', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Colores + tamaño */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className={labelClass}>Color de fondo</label>
                                        <input
                                            value={config.overlay.backgroundColor}
                                            onChange={e => setConfig(c => ({ ...c, overlay: { ...c.overlay, backgroundColor: e.target.value } }))}
                                            className={inputClass}
                                            placeholder="rgba(0,0,0,0.75)"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Color de texto</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={config.overlay.textColor}
                                                onChange={e => setConfig(c => ({ ...c, overlay: { ...c.overlay, textColor: e.target.value } }))}
                                                className="h-[42px] w-12 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-transparent cursor-pointer p-0.5"
                                            />
                                            <input
                                                value={config.overlay.textColor}
                                                onChange={e => setConfig(c => ({ ...c, overlay: { ...c.overlay, textColor: e.target.value } }))}
                                                className={`${inputClass} font-mono`}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Tamaño de fuente (px)</label>
                                        <input
                                            type="number"
                                            min={10}
                                            max={48}
                                            value={config.overlay.fontSize}
                                            onChange={e => setConfig(c => ({ ...c, overlay: { ...c.overlay, fontSize: parseInt(e.target.value) || 16 } }))}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Duración visible (ms)</label>
                                        <input
                                            type="number"
                                            min={1000}
                                            max={30000}
                                            step={500}
                                            value={config.overlay.duration}
                                            onChange={e => setConfig(c => ({ ...c, overlay: { ...c.overlay, duration: parseInt(e.target.value) || 5000 } }))}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    {config.overlay.showBubble && (
                        <div className={cardClass}>
                            <p className={sectionTitle}>👁️ Vista previa</p>
                            <div className="relative rounded-xl overflow-hidden bg-black" style={{ paddingBottom: '30%', minHeight: 120 }}>
                                <div
                                    className="absolute"
                                    style={{
                                        ...(config.overlay.position.includes('top') ? { top: 12 } : { bottom: 12 }),
                                        ...(config.overlay.position.includes('left') ? { left: 12 } : config.overlay.position.includes('right') ? { right: 12 } : { left: '50%', transform: 'translateX(-50%)' }),
                                        maxWidth: 280,
                                    }}
                                >
                                    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: config.overlay.backgroundColor }}>
                                        <p style={{ color: config.overlay.textColor, fontSize: Math.max(9, config.overlay.fontSize * 0.65), fontWeight: 700, margin: 0, fontFamily: 'Inter, sans-serif' }}>
                                            streamer
                                        </p>
                                        <p style={{ color: config.overlay.textColor, fontSize: Math.max(9, config.overlay.fontSize * 0.65), margin: '2px 0 0', fontFamily: 'Inter, sans-serif' }}>
                                            Hola, este es un mensaje de prueba
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ===== TESTING ===== */}
            {activeTab === 'testing' && (
                <div className="space-y-6">
                    {/* Stats */}
                    {usage && (
                        <div className={cardClass}>
                            <p className={sectionTitle}>📊 Créditos TTS</p>
                            <div className="flex items-center justify-between text-sm mb-3">
                                <span className="text-[#64748b] dark:text-[#94a3b8]">
                                    Plan: <span className="font-bold text-[#1e293b] dark:text-[#f8fafc] capitalize">{usage.tier}</span>
                                </span>
                                <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    {usage.isUnlimited ? '∞' : `${usage.totalAvailable.toLocaleString()} disponibles`}
                                </span>
                            </div>
                            {!usage.isUnlimited && (
                                <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                                    <div className="p-3 rounded-lg bg-[#f8fafc] dark:bg-[#262626]">
                                        <p className="text-[#64748b] dark:text-[#94a3b8]">Cuota del mes</p>
                                        <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                            {usage.monthlyRemaining.toLocaleString()} / {usage.monthlyGranted.toLocaleString()}
                                        </p>
                                        <p className="text-[#94a3b8]">se reinicia el día 1</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-[#f8fafc] dark:bg-[#262626]">
                                        <p className="text-[#64748b] dark:text-[#94a3b8]">Comprados</p>
                                        <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                            {usage.purchasedBalance.toLocaleString()}
                                        </p>
                                        <p className="text-[#94a3b8]">no caducan</p>
                                    </div>
                                </div>
                            )}
                            {tierExpiryLabel && (
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-3">
                                    Vence el {tierExpiryLabel}
                                </p>
                            )}
                            {!usage.isUnlimited && usage.monthlyGranted > 0 && (
                                <div className="h-3 bg-[#e2e8f0] dark:bg-[#374151] rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${
                                            usage.percentage > 90 ? 'bg-red-500' : usage.percentage > 70 ? 'bg-yellow-500' : 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6]'
                                        }`}
                                        style={{ width: `${Math.min(usage.percentage, 100)}%` }}
                                    />
                                </div>
                            )}
                            {!usage.isUnlimited && usage.totalAvailable === 0 && (
                                <div className="mt-4 flex items-start gap-2 text-xs text-[#64748b] dark:text-[#94a3b8]">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-yellow-500 mt-0.5" />
                                    Sin créditos solo puedes usar voces del navegador, que no suenan en OBS. Para usar
                                    Polly necesitas un plan o un paquete de créditos.
                                </div>
                            )}
                            {usage.inTransitionWindow && usage.tier === 'free' && transitionEndsLabel && (
                                <div className="mt-4 flex items-start gap-2 text-xs text-blue-600 dark:text-blue-400">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    Estás usando créditos de bienvenida, disponibles hasta el {transitionEndsLabel}.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Test */}
                    <div className={cardClass}>
                        <p className={sectionTitle}>🧪 Enviar mensaje de prueba</p>
                        <p className={sectionDesc}>
                            Envía un mensaje de prueba al overlay para verificar la voz y el display. El overlay debe estar abierto en OBS o en una pestaña del navegador.
                        </p>
                        <textarea
                            value={testMessage}
                            onChange={e => setTestMessage(e.target.value)}
                            rows={3}
                            className={`${inputClass} resize-none mb-4`}
                        />
                        <button
                            onClick={sendTest}
                            disabled={testing || !testMessage.trim()}
                            className="px-6 py-3 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-60 text-white rounded-xl transition-all flex items-center gap-2 font-bold shadow-lg"
                        >
                            <TestTube2 className="w-5 h-5" />
                            {testing ? 'Enviando...' : 'Enviar al overlay'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
