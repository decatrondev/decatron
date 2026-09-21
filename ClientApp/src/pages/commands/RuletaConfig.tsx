import { useState, useEffect } from 'react';
import { Crosshair, ChevronLeft, Save, Users, MessageSquare, Timer, Target, ShieldAlert, Sparkles, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

// Estos strings deben coincidir EXACTO con los niveles del backend (GachaCommand.GetUserLevel/HasPermission)
type Permission = 'everyone' | 'subscriber' | 'vip' | 'moderator' | 'lead_moderator' | 'broadcaster';

interface RuletaConfig {
    enabled: boolean;
    commandName: string;
    chancePercent: number;
    minTimeoutSeconds: number;
    maxTimeoutSeconds: number;
    globalCooldown: number;
    userCooldown: number;
    permission: Permission;
    allowSelfTarget: boolean;
    allowTargetModerators: boolean;
    protectedUsers: string[];
    blockedUsers: string[];
    hitMessages: string[];
    missMessages: string[];
    useSelfMessages: boolean;
    selfHitMessages: string[];
    selfMissMessages: string[];
}

const DEFAULT_CONFIG: RuletaConfig = {
    enabled: true,
    commandName: '!ruleta',
    chancePercent: 17,
    minTimeoutSeconds: 60,
    maxTimeoutSeconds: 60,
    globalCooldown: 10,
    userCooldown: 30,
    permission: 'everyone',
    allowSelfTarget: true,
    allowTargetModerators: false,
    protectedUsers: [],
    blockedUsers: [],
    hitMessages: ['🔫💥 BANG! @{shooter} le disparó a @{target} — {seconds}s de timeout'],
    missMessages: ['🔫 *click* @{shooter} apuntó a @{target}... y sobrevivió'],
    useSelfMessages: true,
    selfHitMessages: ['🔫💥 @{shooter} se apuntó a sí mismo... BANG! {seconds}s de timeout'],
    selfMissMessages: ['🔫 @{shooter} se apuntó a sí mismo... *click* sobrevivió de milagro'],
};

// Jerarquía ordenada de menor a mayor nivel — debe coincidir con el array del backend
const PERMISSION_HIERARCHY: Permission[] = ['everyone', 'subscriber', 'vip', 'moderator', 'lead_moderator', 'broadcaster'];

const PERMISSION_LABELS: Record<Permission, string> = {
    everyone: 'Todos',
    subscriber: 'Suscriptores',
    vip: 'VIPs',
    moderator: 'Moderadores',
    lead_moderator: 'Lead Moderators',
    broadcaster: 'Solo Streamer',
};

const PERMISSION_DESC: Record<Permission, string> = {
    everyone: 'Cualquier usuario puede usarlo',
    subscriber: 'Solo suscriptores, VIPs, mods y superiores',
    vip: 'Solo VIPs, mods y superiores',
    moderator: 'Solo moderadores y superiores',
    lead_moderator: 'Solo lead moderators y el streamer',
    broadcaster: 'Solo el streamer',
};

const MESSAGE_VARIABLES = ['{shooter}', '{target}', '{seconds}', '{chance}'];

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
    return (
        <button
            onClick={onChange}
            className={`relative w-11 h-6 rounded-full transition-all duration-200 ${value
                ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6]'
                : 'bg-[#cbd5e1] dark:bg-[#374151]'
                }`}
        >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    );
}

function ToggleSmall({ value, onChange }: { value: boolean; onChange: () => void }) {
    return (
        <button
            onClick={onChange}
            className={`relative w-9 h-5 rounded-full transition-all duration-200 ${value
                ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6]'
                : 'bg-[#cbd5e1] dark:bg-[#374151]'
                }`}
        >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
    );
}

function VariantList({
    title, hint, values, disabled, onChange, onAdd, onRemove, config,
}: {
    title: string;
    hint?: string;
    values: string[];
    disabled?: boolean;
    onChange: (index: number, value: string) => void;
    onAdd: () => void;
    onRemove: (index: number) => void;
    config: RuletaConfig;
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                    {title}
                </label>
                <button
                    onClick={onAdd}
                    disabled={disabled}
                    className="flex items-center gap-1 text-xs font-semibold text-[#2563eb] hover:text-blue-700 disabled:opacity-40 disabled:pointer-events-none"
                >
                    <Plus className="w-3 h-3" /> Variante
                </button>
            </div>
            {hint && <p className="text-xs text-[#94a3b8] mb-2">{hint}</p>}
            <div className="space-y-2">
                {values.map((v, i) => (
                    <div key={i} className="flex gap-2 items-start">
                        <textarea
                            rows={2}
                            value={v}
                            onChange={e => onChange(i, e.target.value)}
                            disabled={disabled}
                            className="flex-1 px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb] resize-none font-mono disabled:opacity-40"
                        />
                        <button
                            onClick={() => onRemove(i)}
                            disabled={disabled || values.length <= 1}
                            className="p-2 text-[#94a3b8] hover:text-red-500 disabled:opacity-30 disabled:pointer-events-none"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
            {values[0] && (
                <div className="mt-2 p-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] font-semibold mb-1">
                        Vista previa {values.length > 1 ? '(1ra variante)' : ''}:
                    </p>
                    <p className="text-xs text-[#1e293b] dark:text-[#f8fafc]">{buildPreview(values[0], config)}</p>
                </div>
            )}
        </div>
    );
}

function UserListEditor({ title, hint, values, placeholder, onAdd, onRemove }: {
    title: string;
    hint: string;
    values: string[];
    placeholder: string;
    onAdd: (username: string) => void;
    onRemove: (username: string) => void;
}) {
    const [draft, setDraft] = useState('');
    const submit = () => {
        const clean = draft.trim().replace(/^@/, '');
        if (clean) onAdd(clean);
        setDraft('');
    };
    return (
        <div>
            <label className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">{title}</label>
            <p className="text-xs text-[#94a3b8] mb-2">{hint}</p>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                    placeholder={placeholder}
                    className="flex-1 px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                />
                <button
                    onClick={submit}
                    className="px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#2563eb] hover:border-[#2563eb]"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
                {values.map(u => (
                    <span key={u} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-full text-xs font-mono text-[#1e293b] dark:text-[#f8fafc]">
                        @{u}
                        <button onClick={() => onRemove(u)} className="p-0.5 text-[#94a3b8] hover:text-red-500">
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                {values.length === 0 && <p className="text-xs text-[#94a3b8]">Sin usuarios en la lista</p>}
            </div>
        </div>
    );
}

function buildPreview(template: string, config: RuletaConfig): string {
    const avgSeconds = Math.round((config.minTimeoutSeconds + config.maxTimeoutSeconds) / 2);
    return template
        .replace('{shooter}', 'AnthonyDeca')
        .replace('{target}', 'Viewer123')
        .replace('{seconds}', String(avgSeconds))
        .replace('{chance}', String(config.chancePercent));
}

function fromApi(apiConfig: any): RuletaConfig {
    return {
        enabled: apiConfig.enabled,
        commandName: apiConfig.commandName,
        chancePercent: apiConfig.chancePercent,
        minTimeoutSeconds: apiConfig.minTimeoutSeconds,
        maxTimeoutSeconds: apiConfig.maxTimeoutSeconds,
        globalCooldown: apiConfig.cooldownGlobal,
        userCooldown: apiConfig.cooldownUser,
        permission: apiConfig.permission,
        allowSelfTarget: apiConfig.allowSelfTarget,
        allowTargetModerators: apiConfig.allowTargetModerators,
        protectedUsers: apiConfig.protectedUsers ?? [],
        blockedUsers: apiConfig.blockedUsers ?? [],
        hitMessages: apiConfig.hitMessages?.length ? apiConfig.hitMessages : DEFAULT_CONFIG.hitMessages,
        missMessages: apiConfig.missMessages?.length ? apiConfig.missMessages : DEFAULT_CONFIG.missMessages,
        useSelfMessages: apiConfig.useSelfMessages,
        selfHitMessages: apiConfig.selfHitMessages?.length ? apiConfig.selfHitMessages : DEFAULT_CONFIG.selfHitMessages,
        selfMissMessages: apiConfig.selfMissMessages?.length ? apiConfig.selfMissMessages : DEFAULT_CONFIG.selfMissMessages,
    };
}

function toApi(config: RuletaConfig) {
    return {
        enabled: config.enabled,
        commandName: config.commandName,
        chancePercent: config.chancePercent,
        minTimeoutSeconds: config.minTimeoutSeconds,
        maxTimeoutSeconds: config.maxTimeoutSeconds,
        cooldownGlobal: config.globalCooldown,
        cooldownUser: config.userCooldown,
        permission: config.permission,
        allowSelfTarget: config.allowSelfTarget,
        allowTargetModerators: config.allowTargetModerators,
        protectedUsers: config.protectedUsers,
        blockedUsers: config.blockedUsers,
        hitMessages: config.hitMessages,
        missMessages: config.missMessages,
        useSelfMessages: config.useSelfMessages,
        selfHitMessages: config.selfHitMessages,
        selfMissMessages: config.selfMissMessages,
    };
}

export default function RuletaConfig() {
    const navigate = useNavigate();
    const [config, setConfig] = useState<RuletaConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/ruleta/config');
                if (res.data?.success) {
                    setConfig(fromApi(res.data.config));
                }
            } catch (err) {
                console.error('Error cargando config de ruleta', err);
                setError('No se pudo cargar la configuración, se muestran valores por defecto');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const set = <K extends keyof RuletaConfig>(key: K, value: RuletaConfig[K]) => {
        setConfig(prev => {
            const next = { ...prev, [key]: value };
            if (key === 'minTimeoutSeconds' && next.minTimeoutSeconds > next.maxTimeoutSeconds) {
                next.maxTimeoutSeconds = next.minTimeoutSeconds;
            }
            if (key === 'maxTimeoutSeconds' && next.maxTimeoutSeconds < next.minTimeoutSeconds) {
                next.minTimeoutSeconds = next.maxTimeoutSeconds;
            }
            return next;
        });
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await api.post('/ruleta/config', toApi(config));
            if (res.data?.success) {
                setConfig(fromApi(res.data.config));
                setSaved(true);
            } else {
                setError(res.data?.message || 'Error guardando la configuración');
            }
        } catch (err: any) {
            console.error('Error guardando config de ruleta', err);
            setError(err?.response?.data?.message || 'Error guardando la configuración');
        } finally {
            setSaving(false);
        }
    };

    const selectedIndex = PERMISSION_HIERARCHY.indexOf(config.permission);

    const updateVariant = (key: 'hitMessages' | 'missMessages' | 'selfHitMessages' | 'selfMissMessages', index: number, value: string) => {
        set(key, config[key].map((m, i) => i === index ? value : m));
    };
    const addVariant = (key: 'hitMessages' | 'missMessages' | 'selfHitMessages' | 'selfMissMessages') => {
        set(key, [...config[key], '']);
    };
    const removeVariant = (key: 'hitMessages' | 'missMessages' | 'selfHitMessages' | 'selfMissMessages', index: number) => {
        if (config[key].length <= 1) return;
        set(key, config[key].filter((_, i) => i !== index));
    };

    const addUser = (key: 'protectedUsers' | 'blockedUsers', username: string) => {
        const clean = username.toLowerCase();
        if (config[key].includes(clean)) return;
        set(key, [...config[key], clean]);
    };
    const removeUser = (key: 'protectedUsers' | 'blockedUsers', username: string) => {
        set(key, config[key].filter(u => u !== username));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-[#64748b] dark:text-[#94a3b8]">Cargando configuración...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/commands')}
                        className="p-2 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#374151] transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <Crosshair className="w-6 h-6 text-[#2563eb]" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">Ruleta</h1>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                Configura el comando <span className="font-mono text-[#2563eb]">{config.commandName}</span>
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <span className="text-sm font-semibold text-[#64748b] dark:text-[#94a3b8]">
                            {config.enabled ? 'Activo' : 'Inactivo'}
                        </span>
                        <Toggle value={config.enabled} onChange={() => set('enabled', !config.enabled)} />
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Columna izquierda */}
                <div className="space-y-6">

                    {/* Comando */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <MessageSquare className="w-5 h-5 text-[#2563eb]" />
                            <h2 className="font-black text-[#1e293b] dark:text-[#f8fafc]">Comando</h2>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                                Nombre / Alias
                            </label>
                            <input
                                type="text"
                                value={config.commandName}
                                onChange={e => set('commandName', e.target.value)}
                                className="mt-1 w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                                placeholder="!ruleta"
                            />
                            <p className="text-xs text-[#94a3b8] mt-1">
                                Uso: <span className="font-mono">{config.commandName}</span> (a uno mismo) o <span className="font-mono">{config.commandName} usuario</span>
                            </p>
                        </div>
                    </div>

                    {/* Probabilidad y duración */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <Target className="w-5 h-5 text-[#2563eb]" />
                            <h2 className="font-black text-[#1e293b] dark:text-[#f8fafc]">Probabilidad y Duración</h2>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                                        Probabilidad de Bala
                                    </label>
                                    <span className="text-sm font-bold text-[#2563eb]">{config.chancePercent}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={100}
                                    value={config.chancePercent}
                                    onChange={e => set('chancePercent', Number(e.target.value))}
                                    className="w-full accent-[#2563eb]"
                                />
                                <p className="text-xs text-[#94a3b8] mt-1">Ruleta rusa clásica ≈ 17% (1 de 6)</p>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                                        Timeout Mínimo
                                    </label>
                                    <span className="text-sm font-bold text-[#2563eb]">{config.minTimeoutSeconds}s</span>
                                </div>
                                <input
                                    type="range"
                                    min={5}
                                    max={600}
                                    value={config.minTimeoutSeconds}
                                    onChange={e => set('minTimeoutSeconds', Number(e.target.value))}
                                    className="w-full accent-[#2563eb]"
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                                        Timeout Máximo
                                    </label>
                                    <span className="text-sm font-bold text-[#2563eb]">{config.maxTimeoutSeconds}s</span>
                                </div>
                                <input
                                    type="range"
                                    min={5}
                                    max={600}
                                    value={config.maxTimeoutSeconds}
                                    onChange={e => set('maxTimeoutSeconds', Number(e.target.value))}
                                    className="w-full accent-[#2563eb]"
                                />
                                <p className="text-xs text-[#94a3b8] mt-1">
                                    {config.minTimeoutSeconds === config.maxTimeoutSeconds
                                        ? 'Duración fija'
                                        : `Duración aleatoria entre ${config.minTimeoutSeconds}s y ${config.maxTimeoutSeconds}s`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Cooldowns */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <Timer className="w-5 h-5 text-[#2563eb]" />
                            <h2 className="font-black text-[#1e293b] dark:text-[#f8fafc]">Cooldowns</h2>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                                        Cooldown Global
                                    </label>
                                    <span className="text-sm font-bold text-[#2563eb]">{config.globalCooldown}s</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={120}
                                    value={config.globalCooldown}
                                    onChange={e => set('globalCooldown', Number(e.target.value))}
                                    className="w-full accent-[#2563eb]"
                                />
                                <p className="text-xs text-[#94a3b8] mt-1">Tiempo entre usos del comando en el chat general</p>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                                        Cooldown por Usuario
                                    </label>
                                    <span className="text-sm font-bold text-[#2563eb]">{config.userCooldown}s</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={600}
                                    value={config.userCooldown}
                                    onChange={e => set('userCooldown', Number(e.target.value))}
                                    className="w-full accent-[#2563eb]"
                                />
                                <p className="text-xs text-[#94a3b8] mt-1">Tiempo que cada usuario debe esperar entre usos</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Columna derecha */}
                <div className="space-y-6">

                    {/* Permisos */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg">
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-5 h-5 text-[#2563eb]" />
                            <h2 className="font-black text-[#1e293b] dark:text-[#f8fafc]">Permisos</h2>
                        </div>
                        <p className="text-xs text-[#94a3b8] mb-4">
                            Nivel mínimo para usar el comando — los niveles superiores siempre pueden usarlo
                        </p>
                        <div className="space-y-2">
                            {PERMISSION_HIERARCHY.map((p, index) => {
                                const isSelected = config.permission === p;
                                const isIncluded = index >= selectedIndex;
                                return (
                                    <button
                                        key={p}
                                        onClick={() => set('permission', p)}
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${isSelected
                                            ? 'bg-[#2563eb] border-[#2563eb] text-white'
                                            : 'bg-[#f8fafc] dark:bg-[#262626] border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${isSelected ? 'bg-white/20 text-white' : 'bg-[#e2e8f0] dark:bg-[#374151] text-[#64748b] dark:text-[#94a3b8]'}`}>
                                                {index + 1}
                                            </span>
                                            <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-[#1e293b] dark:text-[#f8fafc]'}`}>
                                                {PERMISSION_LABELS[p]}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!isSelected && (
                                                <span className={`text-xs ${isIncluded ? 'text-green-500' : 'text-[#94a3b8]'}`}>
                                                    {isIncluded ? '✓ puede usar' : '✗ no puede'}
                                                </span>
                                            )}
                                            {isSelected && (
                                                <span className="text-xs text-white/80">{PERMISSION_DESC[p]}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Objetivos */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldAlert className="w-5 h-5 text-[#2563eb]" />
                            <h2 className="font-black text-[#1e293b] dark:text-[#f8fafc]">Objetivos</h2>
                        </div>
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">Permitir Apuntarse a Uno Mismo</p>
                                    <p className="text-xs text-[#94a3b8]">Usar <span className="font-mono">{config.commandName}</span> sin usuario objetivo</p>
                                </div>
                                <Toggle value={config.allowSelfTarget} onChange={() => set('allowSelfTarget', !config.allowSelfTarget)} />
                            </div>

                            <div className="border-t border-[#e2e8f0] dark:border-[#374151]" />

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">Permitir Apuntar a Moderadores</p>
                                    <p className="text-xs text-[#94a3b8]">Cualquiera que cumpla el nivel de "Permisos" de abajo va a poder apuntarle a un moderador</p>
                                </div>
                                <Toggle value={config.allowTargetModerators} onChange={() => set('allowTargetModerators', !config.allowTargetModerators)} />
                            </div>

                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <p className="text-xs text-[#1e293b] dark:text-[#f8fafc]">
                                    El <span className="font-semibold">streamer</span> siempre es inmune a <span className="font-mono text-[#2563eb]">{config.commandName}</span>, no es configurable.
                                </p>
                                {config.allowTargetModerators && (
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        Si el moderador apuntado no recibe el mod de vuelta manualmente antes de que expire el timeout, el bot se lo restaura automáticamente.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Usuarios especiales */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldAlert className="w-5 h-5 text-[#2563eb]" />
                            <h2 className="font-black text-[#1e293b] dark:text-[#f8fafc]">Usuarios Especiales</h2>
                        </div>
                        <div className="space-y-5">
                            <UserListEditor
                                title="Protegidos"
                                hint="Nunca pueden ser el objetivo de la ruleta"
                                values={config.protectedUsers}
                                placeholder="usuario"
                                onAdd={u => addUser('protectedUsers', u)}
                                onRemove={u => removeUser('protectedUsers', u)}
                            />
                            <div className="border-t border-[#e2e8f0] dark:border-[#374151]" />
                            <UserListEditor
                                title="Bloqueados"
                                hint="No pueden usar el comando, sin importar su nivel de Permisos"
                                values={config.blockedUsers}
                                placeholder="usuario"
                                onAdd={u => addUser('blockedUsers', u)}
                                onRemove={u => removeUser('blockedUsers', u)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Mensajes — ancho completo */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg">
                <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-5 h-5 text-[#2563eb]" />
                    <h2 className="font-black text-[#1e293b] dark:text-[#f8fafc]">Mensajes</h2>
                </div>
                <div className="flex flex-wrap gap-1 mb-4">
                    {MESSAGE_VARIABLES.map(v => (
                        <code key={v} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-[#2563eb] font-mono">{v}</code>
                    ))}
                </div>

                <p className="text-xs text-[#94a3b8] mb-4">
                    Cada categoría acepta varias variantes — el bot elige una al azar en cada disparo.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <VariantList
                        title="Cuando le da (timeout aplicado)"
                        values={config.hitMessages}
                        config={config}
                        onChange={(i, v) => updateVariant('hitMessages', i, v)}
                        onAdd={() => addVariant('hitMessages')}
                        onRemove={i => removeVariant('hitMessages', i)}
                    />
                    <VariantList
                        title="Cuando falla (sobrevive)"
                        values={config.missMessages}
                        config={config}
                        onChange={(i, v) => updateVariant('missMessages', i, v)}
                        onAdd={() => addVariant('missMessages')}
                        onRemove={i => removeVariant('missMessages', i)}
                    />
                </div>

                <div className="border-t border-[#e2e8f0] dark:border-[#374151] my-4" />

                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">Mensajes Distintos al Apuntarse a Sí Mismo</p>
                        <p className="text-xs text-[#94a3b8]">Si está desactivado, se usan los mensajes de arriba también para autoruleta</p>
                    </div>
                    <ToggleSmall value={config.useSelfMessages} onChange={() => set('useSelfMessages', !config.useSelfMessages)} />
                </div>

                {config.useSelfMessages && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <VariantList
                            title="Autoruleta — le da"
                            values={config.selfHitMessages}
                            config={config}
                            disabled={!config.allowSelfTarget}
                            onChange={(i, v) => updateVariant('selfHitMessages', i, v)}
                            onAdd={() => addVariant('selfHitMessages')}
                            onRemove={i => removeVariant('selfHitMessages', i)}
                        />
                        <VariantList
                            title="Autoruleta — falla"
                            values={config.selfMissMessages}
                            config={config}
                            disabled={!config.allowSelfTarget}
                            onChange={(i, v) => updateVariant('selfMissMessages', i, v)}
                            onAdd={() => addVariant('selfMissMessages')}
                            onRemove={i => removeVariant('selfMissMessages', i)}
                        />
                    </div>
                )}
                {!config.allowSelfTarget && (
                    <p className="text-xs text-[#94a3b8] mt-2">Activa "Permitir Apuntarse a Uno Mismo" para usar estos mensajes</p>
                )}
            </div>

            {/* Overlay — próximamente */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg opacity-75">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-[#94a3b8]" />
                        <h2 className="font-black text-[#1e293b] dark:text-[#f8fafc]">Overlay del Mini-Juego</h2>
                    </div>
                    <span className="px-3 py-1 bg-[#f1f5f9] dark:bg-[#374151] text-[#64748b] dark:text-[#94a3b8] rounded-full text-xs font-bold uppercase tracking-wide">
                        Próximamente
                    </span>
                </div>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-2">
                    Animación visual de la ruleta para el overlay de OBS, sincronizada en vivo con cada disparo. Todavía no está disponible.
                </p>
            </div>
        </div>
    );
}
