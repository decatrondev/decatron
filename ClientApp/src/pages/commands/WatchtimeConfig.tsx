import { useState, useEffect } from 'react';
import { Clock, ChevronLeft, Save, Users, MessageSquare, Timer, Eye, History, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

// Estos strings deben coincidir EXACTO con los niveles del backend (GachaCommand.GetUserLevel/HasPermission)
type Permission = 'everyone' | 'subscriber' | 'vip' | 'moderator' | 'lead_moderator' | 'broadcaster';
type TimeFormat = 'minutes' | 'hours_minutes' | 'full';

interface WatchtimeConfig {
    enabled: boolean;
    commandName: string;
    globalCooldown: number;
    userCooldown: number;
    permission: Permission;
    trackLurkers: boolean;
    minMinutesToRespond: number;
    timeFormat: TimeFormat;
    showPosition: boolean;
    onlyWhenLive: boolean;
    customMessage: string;
    useFirstTimeMessage: boolean;
    firstTimeMessage: string;
    useNotEnoughTimeMessage: boolean;
    notEnoughTimeMessage: string;
    useOfflineMessage: boolean;
    offlineMessage: string;
}

const DEFAULT_CONFIG: WatchtimeConfig = {
    enabled: true,
    commandName: '!watchtime',
    globalCooldown: 5,
    userCooldown: 30,
    permission: 'everyone',
    trackLurkers: true,
    minMinutesToRespond: 0,
    timeFormat: 'full',
    showPosition: true,
    onlyWhenLive: false,
    customMessage: '@{user} llevas {hours} hora(s) {minutes} minuto(s) viendo el stream',
    useFirstTimeMessage: true,
    firstTimeMessage: '@{user} ¡es tu primera vez en el stream! Ya llevas {hours} hora(s) {minutes} minuto(s) — ¡bienvenido/a!',
    useNotEnoughTimeMessage: true,
    notEnoughTimeMessage: '@{user} aún llevas muy poco tiempo, ¡sigue viendo el stream!',
    useOfflineMessage: false,
    offlineMessage: '@{user} el stream no está en vivo ahora mismo',
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

const TIME_FORMAT_OPTIONS: { value: TimeFormat; label: string; example: string }[] = [
    { value: 'minutes', label: 'Solo minutos', example: 'ej: 90 minutos' },
    { value: 'hours_minutes', label: 'Horas y minutos', example: 'ej: 1 hora 30 minutos' },
    { value: 'full', label: 'Completo', example: 'ej: 1 hora 30 minutos 45 segundos' },
];

const MESSAGE_VARIABLES = ['{user}', '{hours}', '{minutes}', '{seconds}', '{total_minutes}', '{position}'];

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

function buildPreview(config: WatchtimeConfig): string {
    const sample = config.customMessage
        .replace('{user}', 'AnthonyDeca')
        .replace('{hours}', '1')
        .replace('{minutes}', '23')
        .replace('{seconds}', '45')
        .replace('{total_minutes}', '83')
        .replace('{position}', '#2');
    return sample;
}

function fromApi(apiConfig: any): WatchtimeConfig {
    return {
        enabled: apiConfig.enabled,
        commandName: apiConfig.commandName,
        globalCooldown: apiConfig.cooldownGlobal,
        userCooldown: apiConfig.cooldownUser,
        permission: apiConfig.permission,
        trackLurkers: apiConfig.trackLurkers,
        minMinutesToRespond: apiConfig.minMinutesToRespond,
        timeFormat: apiConfig.timeFormat,
        showPosition: apiConfig.showPosition,
        onlyWhenLive: apiConfig.onlyWhenLive,
        customMessage: apiConfig.customMessage,
        useFirstTimeMessage: apiConfig.useFirstTimeMessage,
        firstTimeMessage: apiConfig.firstTimeMessage,
        useNotEnoughTimeMessage: apiConfig.useNotEnoughTimeMessage,
        notEnoughTimeMessage: apiConfig.notEnoughTimeMessage,
        useOfflineMessage: apiConfig.useOfflineMessage,
        offlineMessage: apiConfig.offlineMessage,
    };
}

function toApi(config: WatchtimeConfig) {
    return {
        enabled: config.enabled,
        commandName: config.commandName,
        cooldownGlobal: config.globalCooldown,
        cooldownUser: config.userCooldown,
        permission: config.permission,
        trackLurkers: config.trackLurkers,
        minMinutesToRespond: config.minMinutesToRespond,
        timeFormat: config.timeFormat,
        showPosition: config.showPosition,
        onlyWhenLive: config.onlyWhenLive,
        customMessage: config.customMessage,
        useFirstTimeMessage: config.useFirstTimeMessage,
        firstTimeMessage: config.firstTimeMessage,
        useNotEnoughTimeMessage: config.useNotEnoughTimeMessage,
        notEnoughTimeMessage: config.notEnoughTimeMessage,
        useOfflineMessage: config.useOfflineMessage,
        offlineMessage: config.offlineMessage,
    };
}

export default function WatchtimeConfig() {
    const navigate = useNavigate();
    const [config, setConfig] = useState<WatchtimeConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/watchtime/config');
                if (res.data?.success) {
                    setConfig(fromApi(res.data.config));
                }
            } catch (err) {
                console.error('Error cargando config de watchtime', err);
                setError('No se pudo cargar la configuración, se muestran valores por defecto');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const set = <K extends keyof WatchtimeConfig>(key: K, value: WatchtimeConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await api.post('/watchtime/config', toApi(config));
            if (res.data?.success) {
                setConfig(fromApi(res.data.config));
                setSaved(true);
            } else {
                setError(res.data?.message || 'Error guardando la configuración');
            }
        } catch (err: any) {
            console.error('Error guardando config de watchtime', err);
            setError(err?.response?.data?.message || 'Error guardando la configuración');
        } finally {
            setSaving(false);
        }
    };

    const selectedIndex = PERMISSION_HIERARCHY.indexOf(config.permission);

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
                            <Clock className="w-6 h-6 text-[#2563eb]" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">Watchtime</h1>
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
                                placeholder="!watchtime"
                            />
                            <p className="text-xs text-[#94a3b8] mt-1">Puedes cambiarlo a cualquier alias, ej: <span className="font-mono">!tiempo</span></p>
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
                                    max={60}
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
                                    max={300}
                                    value={config.userCooldown}
                                    onChange={e => set('userCooldown', Number(e.target.value))}
                                    className="w-full accent-[#2563eb]"
                                />
                                <p className="text-xs text-[#94a3b8] mt-1">Tiempo que cada usuario debe esperar entre usos</p>
                            </div>
                        </div>
                    </div>

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
                </div>

                {/* Columna derecha */}
                <div className="space-y-6">

                    {/* Comportamiento */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <Eye className="w-5 h-5 text-[#2563eb]" />
                            <h2 className="font-black text-[#1e293b] dark:text-[#f8fafc]">Comportamiento</h2>
                        </div>
                        <div className="space-y-5">

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">Contar Lurkers</p>
                                    <p className="text-xs text-[#94a3b8]">Trackear viewers que no escriben en el chat</p>
                                </div>
                                <Toggle value={config.trackLurkers} onChange={() => set('trackLurkers', !config.trackLurkers)} />
                            </div>

                            <div className="border-t border-[#e2e8f0] dark:border-[#374151]" />

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">Solo en Stream en Vivo</p>
                                    <p className="text-xs text-[#94a3b8]">El comando no funciona si el stream está offline</p>
                                </div>
                                <Toggle value={config.onlyWhenLive} onChange={() => set('onlyWhenLive', !config.onlyWhenLive)} />
                            </div>

                            <div className="border-t border-[#e2e8f0] dark:border-[#374151]" />

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">Mostrar Posición</p>
                                    <p className="text-xs text-[#94a3b8]">Incluir ranking del viewer (variable <span className="font-mono text-[#2563eb]">{'{position}'}</span>)</p>
                                </div>
                                <Toggle value={config.showPosition} onChange={() => set('showPosition', !config.showPosition)} />
                            </div>

                            <div className="border-t border-[#e2e8f0] dark:border-[#374151]" />

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <div>
                                        <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">Tiempo mínimo para responder</p>
                                        <p className="text-xs text-[#94a3b8]">0 = responde siempre</p>
                                    </div>
                                    <span className="text-sm font-bold text-[#2563eb]">
                                        {config.minMinutesToRespond === 0 ? 'Sin mínimo' : `${config.minMinutesToRespond} min`}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={30}
                                    value={config.minMinutesToRespond}
                                    onChange={e => set('minMinutesToRespond', Number(e.target.value))}
                                    className="w-full accent-[#2563eb]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Formato de tiempo */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="w-5 h-5 text-[#2563eb]" />
                            <h2 className="font-black text-[#1e293b] dark:text-[#f8fafc]">Formato de Tiempo</h2>
                        </div>
                        <div className="space-y-2">
                            {TIME_FORMAT_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => set('timeFormat', opt.value)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${config.timeFormat === opt.value
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-[#2563eb]'
                                        : 'bg-[#f8fafc] dark:bg-[#262626] border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]'
                                        }`}
                                >
                                    <span className={`text-sm font-bold ${config.timeFormat === opt.value ? 'text-[#2563eb]' : 'text-[#1e293b] dark:text-[#f8fafc]'}`}>
                                        {opt.label}
                                    </span>
                                    <span className="text-xs text-[#94a3b8] font-mono">{opt.example}</span>
                                </button>
                            ))}
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

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">

                    {/* Mensaje principal */}
                    <div className="lg:col-span-2 xl:col-span-1">
                        <label className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                            Mensaje Principal
                        </label>
                        <textarea
                            rows={3}
                            value={config.customMessage}
                            onChange={e => set('customMessage', e.target.value)}
                            className="mt-1 w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb] resize-none font-mono"
                        />
                        {/* Preview */}
                        <div className="mt-2 p-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] font-semibold mb-1">Vista previa:</p>
                            <p className="text-xs text-[#1e293b] dark:text-[#f8fafc]">{buildPreview(config)}</p>
                        </div>
                    </div>

                    {/* Primera vez */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                                Primera Vez en el Stream
                            </label>
                            <ToggleSmall value={config.useFirstTimeMessage} onChange={() => set('useFirstTimeMessage', !config.useFirstTimeMessage)} />
                        </div>
                        <textarea
                            rows={3}
                            value={config.firstTimeMessage}
                            onChange={e => set('firstTimeMessage', e.target.value)}
                            disabled={!config.useFirstTimeMessage}
                            className="w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb] resize-none font-mono disabled:opacity-40"
                        />
                        <div className="mt-2 flex items-start gap-1.5">
                            <History className="w-3 h-3 text-[#94a3b8] mt-0.5 shrink-0" />
                            <p className="text-xs text-[#94a3b8]">
                                Se activa la primera vez que el viewer usa <span className="font-mono text-[#2563eb]">{config.commandName}</span> en el stream actual
                            </p>
                        </div>
                    </div>

                    {/* No enough time */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                                Tiempo Insuficiente
                            </label>
                            <ToggleSmall value={config.useNotEnoughTimeMessage} onChange={() => set('useNotEnoughTimeMessage', !config.useNotEnoughTimeMessage)} />
                        </div>
                        <textarea
                            rows={3}
                            value={config.notEnoughTimeMessage}
                            onChange={e => set('notEnoughTimeMessage', e.target.value)}
                            disabled={!config.useNotEnoughTimeMessage || config.minMinutesToRespond === 0}
                            className="w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb] resize-none font-mono disabled:opacity-40"
                        />
                        {config.minMinutesToRespond === 0 && (
                            <div className="mt-2 flex items-start gap-1.5">
                                <AlertCircle className="w-3 h-3 text-[#94a3b8] mt-0.5 shrink-0" />
                                <p className="text-xs text-[#94a3b8]">Activa el tiempo mínimo para usar este mensaje</p>
                            </div>
                        )}
                    </div>

                    {/* Offline */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                                Stream Offline
                            </label>
                            <ToggleSmall value={config.useOfflineMessage} onChange={() => set('useOfflineMessage', !config.useOfflineMessage)} />
                        </div>
                        <textarea
                            rows={3}
                            value={config.offlineMessage}
                            onChange={e => set('offlineMessage', e.target.value)}
                            disabled={!config.useOfflineMessage || config.onlyWhenLive}
                            className="w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb] resize-none font-mono disabled:opacity-40"
                        />
                        {config.onlyWhenLive && (
                            <div className="mt-2 flex items-start gap-1.5">
                                <AlertCircle className="w-3 h-3 text-[#94a3b8] mt-0.5 shrink-0" />
                                <p className="text-xs text-[#94a3b8]">Desactiva "Solo en vivo" para usar este mensaje</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
