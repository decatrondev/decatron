import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle, CheckCircle, Siren, Plus, Trash2, RotateCcw } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import api from '../../../services/api';
import {
    FilterSwitch, fetchModerationFilters, saveModerationFilter, type FilterSeverity
} from './filterSwitch';

interface PanicSettings {
    durationMinutes: number;
    followersOnly: boolean;
    followersMinutes: number;
    emoteOnly: boolean;
    subscribersOnly: boolean;
    slowSeconds: number;
    shieldMode: boolean;
    announce: boolean;
    autoOnFollows: boolean;
    followsThreshold: number;
    autoOnNewAccounts: boolean;
    newAccountsThreshold: number;
    newAccountDays: number;
    autoWindowSeconds: number;
}

interface PanicState {
    active: boolean;
    endsAt?: string;
    triggeredBy?: string;
    reason?: string;
}

interface FilterDraft<T> {
    enabled: boolean;
    severity: FilterSeverity;
    settings: T;
    message: string;
}

const FOLLOW_AGES = [
    { value: 0, label: 'Cualquier seguidor' },
    { value: 10, label: '10 minutos' },
    { value: 30, label: '30 minutos' },
    { value: 60, label: '1 hora' },
    { value: 1440, label: '1 día' },
    { value: 10080, label: '1 semana' }
];
const SLOW_OPTIONS = [0, 5, 10, 30, 60, 120];

const card = 'bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg';
const input = 'w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]';
const text = 'text-[#1e293b] dark:text-[#f8fafc]';
const hint = 'text-sm text-[#64748b] dark:text-[#94a3b8]';
const label = `block text-sm font-semibold mb-2 ${text}`;

function minutesLeft(endsAt?: string) {
    if (!endsAt) return 0;
    return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 60000));
}

function NumberField({ value, min, max, suffix, onChange }: { value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void }) {
    return (
        <div className="flex items-center gap-2">
            <input
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
                className={input}
            />
            {suffix && <span className={`${hint} whitespace-nowrap`}>{suffix}</span>}
        </div>
    );
}

function SeveritySelect({ value, onChange }: { value: FilterSeverity; onChange: (v: FilterSeverity) => void }) {
    return (
        <select value={value} onChange={(e) => onChange(e.target.value as FilterSeverity)} className={input}>
            <option value="leve">Leve (escalamiento)</option>
            <option value="medio">Medio (timeout 10 min mín.)</option>
            <option value="severo">Severo (ban directo)</option>
        </select>
    );
}

export default function RaidProtection() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();

    const [panic, setPanic] = useState<PanicSettings | null>(null);
    const [state, setState] = useState<PanicState>({ active: false });
    const [defaultPhrases, setDefaultPhrases] = useState<string[]>([]);
    const [age, setAge] = useState<FilterDraft<{ minDays: number; onlyDuringPanic: boolean }> | null>(null);
    const [bots, setBots] = useState<FilterDraft<{ phrases: string[] }> | null>(null);
    const [newPhrase, setNewPhrase] = useState('');
    const [saving, setSaving] = useState(false);
    const [switching, setSwitching] = useState(false);
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const showNotice = (type: 'success' | 'error', text: string) => {
        setNotice({ type, text });
        setTimeout(() => setNotice(null), 3500);
    };

    const load = async () => {
        const [panicRes, filters] = await Promise.all([api.get('/moderation/panic'), fetchModerationFilters()]);
        if (panicRes.data.success) {
            setPanic(panicRes.data.settings);
            setState(panicRes.data.state);
            setDefaultPhrases(panicRes.data.defaultBotPhrases);
        }
        const a = filters.find(f => f.key === 'account_age');
        setAge({
            enabled: a?.enabled ?? false,
            severity: a?.severity ?? 'leve',
            settings: { minDays: 7, onlyDuringPanic: false, ...(a?.settings as object) },
            message: a?.message ?? ''
        });
        const b = filters.find(f => f.key === 'bot_phrases');
        const savedPhrases = (b?.settings as { phrases?: string[] } | undefined)?.phrases;
        setBots({
            enabled: b?.enabled ?? false,
            severity: b?.severity ?? 'severo',
            settings: { phrases: savedPhrases ?? panicRes.data.defaultBotPhrases ?? [] },
            message: b?.message ?? ''
        });
    };

    useEffect(() => {
        if (permissionsLoading) return;
        if (!hasMinimumLevel('moderation')) {
            navigate('/dashboard');
            return;
        }
        load().catch(() => showNotice('error', 'No se pudo cargar la configuración'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    // Mientras el pánico está activo, refrescar el estado para ver cuándo se apaga
    useEffect(() => {
        if (!state.active) return;
        const id = setInterval(() => {
            api.get('/moderation/panic').then(res => res.data.success && setState(res.data.state)).catch(() => { });
        }, 15000);
        return () => clearInterval(id);
    }, [state.active]);

    const setP = (changes: Partial<PanicSettings>) => setPanic(p => (p ? { ...p, ...changes } : p));

    const togglePanic = async () => {
        setSwitching(true);
        try {
            const res = await api.post(`/moderation/panic/${state.active ? 'deactivate' : 'activate'}`);
            if (!res.data.success) throw new Error();
            const fresh = await api.get('/moderation/panic');
            setState(fresh.data.state);
            showNotice('success', res.data.active ? 'Modo pánico activado' : 'Modo pánico desactivado');
        } catch {
            showNotice('error', 'No se pudo cambiar el modo pánico');
        } finally {
            setSwitching(false);
        }
    };

    const toggleFilter = async (key: 'account_age' | 'bot_phrases', next: boolean) => {
        const apply = (enabled: boolean) => key === 'account_age'
            ? setAge(d => (d ? { ...d, enabled } : d))
            : setBots(d => (d ? { ...d, enabled } : d));
        apply(next);
        try {
            if (!(await saveModerationFilter(key, { enabled: next }))) throw new Error();
        } catch {
            apply(!next);
            showNotice('error', 'No se pudo cambiar el estado del filtro');
        }
    };

    const addPhrase = () => {
        const phrase = newPhrase.trim().toLowerCase();
        if (!bots || phrase.length === 0) return;
        if (phrase.replace(/[^\p{L}\p{N}]/gu, '').length < 8) {
            showNotice('error', 'La frase es muy corta: sin espacios ni signos necesita al menos 8 letras o números');
            return;
        }
        if (!bots.settings.phrases.includes(phrase))
            setBots({ ...bots, settings: { phrases: [...bots.settings.phrases, phrase] } });
        setNewPhrase('');
    };

    const save = async () => {
        if (!panic || !age || !bots) return;
        setSaving(true);
        try {
            const [panicRes, ageOk, botsOk] = await Promise.all([
                api.put('/moderation/panic', panic),
                saveModerationFilter('account_age', { severity: age.severity, settings: age.settings, message: age.message }),
                saveModerationFilter('bot_phrases', { severity: bots.severity, settings: bots.settings, message: bots.message })
            ]);
            if (panicRes.data.success) setPanic(panicRes.data.settings);
            const ok = panicRes.data.success && ageOk && botsOk;
            showNotice(ok ? 'success' : 'error', ok ? 'Configuración guardada' : 'Algo no se pudo guardar');
        } catch {
            showNotice('error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    if (!permissionsLoading && !hasMinimumLevel('moderation')) return null;

    return (
        <div className="panel-scale bg-[#f8fafc] dark:bg-[#1B1C1D] p-4 sm:p-6">
            <div className="max-w-6xl mx-auto mb-6">
                <button
                    onClick={() => navigate('/moderation')}
                    className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#3b82f6] mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a Moderación
                </button>
                <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Raids de odio y bots</h1>
                <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                    Modo pánico para cerrar el chat en segundos, filtro de cuentas nuevas y frases de bots que venden viewers.
                </p>
            </div>

            {notice && (
                <div className="max-w-6xl mx-auto mb-6">
                    <div className={`flex items-center gap-2 p-4 rounded-lg ${notice.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                        {notice.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                        <span className="font-semibold">{notice.text}</span>
                    </div>
                </div>
            )}

            {!panic || !age || !bots ? (
                <p className="max-w-6xl mx-auto text-center py-12 text-[#64748b] dark:text-[#94a3b8]">Cargando…</p>
            ) : (
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Estado del pánico */}
                    <div className={`rounded-2xl border-2 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${state.active
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-700'
                        : 'bg-white dark:bg-[#1B1C1D] border-[#e2e8f0] dark:border-[#374151]'}`}>
                        <div className="flex items-center gap-4 min-w-0">
                            <Siren className={`w-10 h-10 shrink-0 ${state.active ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-[#64748b] dark:text-[#94a3b8]'}`} />
                            <div className="min-w-0">
                                <p className={`text-xl font-black ${state.active ? 'text-red-700 dark:text-red-400' : text}`}>
                                    {state.active ? 'Modo pánico ACTIVO' : 'Modo pánico apagado'}
                                </p>
                                <p className={hint}>
                                    {state.active
                                        ? `${state.reason ?? ''} · se apaga solo en ${minutesLeft(state.endsAt)} min`
                                        : 'También se activa con !panico en el chat y se apaga con !panico off.'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={togglePanic}
                            disabled={switching}
                            className={`shrink-0 px-6 py-3 rounded-lg font-bold text-white transition-all disabled:bg-gray-400 ${state.active ? 'bg-[#2563eb] hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
                        >
                            {switching ? '…' : state.active ? 'Desactivar ahora' : 'Activar pánico'}
                        </button>
                    </div>

                    {/* Qué hace el pánico */}
                    <div className={card}>
                        <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-1">Qué hace el pánico</h2>
                        <p className={`${hint} mb-4`}>Al apagarse, el chat vuelve exactamente a como estaba antes.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer ${!panic.shieldMode ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20' : 'border-[#e2e8f0] dark:border-[#374151]'}`}>
                                <input type="radio" name="panicMode" checked={!panic.shieldMode} onChange={() => setP({ shieldMode: false })} className="w-4 h-4 mt-1" />
                                <span>
                                    <span className={`block font-bold ${text}`}>Modos del chat</span>
                                    <span className={hint}>Eliges qué restricciones aplica el bot.</span>
                                </span>
                            </label>
                            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer ${panic.shieldMode ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20' : 'border-[#e2e8f0] dark:border-[#374151]'}`}>
                                <input type="radio" name="panicMode" checked={panic.shieldMode} onChange={() => setP({ shieldMode: true })} className="w-4 h-4 mt-1" />
                                <span>
                                    <span className={`block font-bold ${text}`}>Shield Mode de Twitch</span>
                                    <span className={hint}>Aplica lo que configuraste en las herramientas de moderación de Twitch.</span>
                                </span>
                            </label>
                        </div>

                        {!panic.shieldMode && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                                        <input type="checkbox" checked={panic.followersOnly} onChange={(e) => setP({ followersOnly: e.target.checked })} className="w-4 h-4" />
                                        <span className={`text-sm font-semibold ${text}`}>Solo seguidores</span>
                                    </label>
                                    <select
                                        value={panic.followersMinutes}
                                        disabled={!panic.followersOnly}
                                        onChange={(e) => setP({ followersMinutes: Number(e.target.value) })}
                                        className={`${input} disabled:opacity-50`}
                                    >
                                        {FOLLOW_AGES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <span className={label}>Modo lento</span>
                                    <select value={panic.slowSeconds} onChange={(e) => setP({ slowSeconds: Number(e.target.value) })} className={input}>
                                        {SLOW_OPTIONS.map(s => <option key={s} value={s}>{s === 0 ? 'Sin modo lento' : `${s} segundos`}</option>)}
                                    </select>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer sm:pt-7">
                                    <input type="checkbox" checked={panic.emoteOnly} onChange={(e) => setP({ emoteOnly: e.target.checked })} className="w-4 h-4" />
                                    <span className={text}>Solo emotes</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer sm:pt-7">
                                    <input type="checkbox" checked={panic.subscribersOnly} onChange={(e) => setP({ subscribersOnly: e.target.checked })} className="w-4 h-4" />
                                    <span className={text}>Solo suscriptores</span>
                                </label>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <span className={label}>Se apaga solo después de</span>
                                <NumberField value={panic.durationMinutes} min={1} max={120} suffix="minutos" onChange={(v) => setP({ durationMinutes: v })} />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer sm:pt-7">
                                <input type="checkbox" checked={panic.announce} onChange={(e) => setP({ announce: e.target.checked })} className="w-4 h-4" />
                                <span className={text}>Avisar en el chat al activarse y al apagarse</span>
                            </label>
                        </div>
                    </div>

                    {/* Disparo automático */}
                    <div className={card}>
                        <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-1">Activación automática</h2>
                        <p className={`${hint} mb-4`}>Viene apagada. Si la activas, el bot enciende el pánico solo cuando detecta una oleada.</p>
                        <div className="space-y-5">
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer mb-3">
                                    <input type="checkbox" checked={panic.autoOnFollows} onChange={(e) => setP({ autoOnFollows: e.target.checked })} className="w-4 h-4" />
                                    <span className={`font-semibold ${text}`}>Oleada de follows (bots de follows)</span>
                                </label>
                                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${panic.autoOnFollows ? '' : 'opacity-50'}`}>
                                    <div>
                                        <span className={label}>Follows</span>
                                        <NumberField value={panic.followsThreshold} min={3} max={1000} suffix="o más" onChange={(v) => setP({ followsThreshold: v })} />
                                    </div>
                                    <div>
                                        <span className={label}>Dentro de</span>
                                        <NumberField value={panic.autoWindowSeconds} min={10} max={600} suffix="segundos" onChange={(v) => setP({ autoWindowSeconds: v })} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer mb-3">
                                    <input type="checkbox" checked={panic.autoOnNewAccounts} onChange={(e) => setP({ autoOnNewAccounts: e.target.checked })} className="w-4 h-4" />
                                    <span className={`font-semibold ${text}`}>Cuentas nuevas escribiendo a la vez (raid de odio)</span>
                                </label>
                                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${panic.autoOnNewAccounts ? '' : 'opacity-50'}`}>
                                    <div>
                                        <span className={label}>Cuentas distintas</span>
                                        <NumberField value={panic.newAccountsThreshold} min={2} max={1000} suffix="o más" onChange={(v) => setP({ newAccountsThreshold: v })} />
                                    </div>
                                    <div>
                                        <span className={label}>Con menos de</span>
                                        <NumberField value={panic.newAccountDays} min={1} max={365} suffix="días de creadas" onChange={(v) => setP({ newAccountDays: v })} />
                                    </div>
                                    <div>
                                        <span className={label}>Dentro de</span>
                                        <NumberField value={panic.autoWindowSeconds} min={10} max={600} suffix="segundos" onChange={(v) => setP({ autoWindowSeconds: v })} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Cuentas nuevas */}
                        <div className={card}>
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="min-w-0">
                                    <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">Cuentas nuevas</h2>
                                    <p className={hint}>Sanciona a las cuentas recién creadas que escriben. Su mensaje siempre se borra.</p>
                                </div>
                                <FilterSwitch on={age.enabled} onChange={(n) => toggleFilter('account_age', n)} label="Activar el filtro de cuentas nuevas" />
                            </div>
                            <div className={`space-y-4 ${age.enabled ? '' : 'opacity-60'}`}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <span className={label}>Cuentas con menos de</span>
                                        <NumberField value={age.settings.minDays} min={1} max={365} suffix="días" onChange={(v) => setAge({ ...age, settings: { ...age.settings, minDays: v } })} />
                                    </div>
                                    <div>
                                        <span className={label}>Severidad</span>
                                        <SeveritySelect value={age.severity} onChange={(v) => setAge({ ...age, severity: v })} />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={age.settings.onlyDuringPanic}
                                        onChange={(e) => setAge({ ...age, settings: { ...age.settings, onlyDuringPanic: e.target.checked } })}
                                        className="w-4 h-4"
                                    />
                                    <span className={text}>Solo mientras el modo pánico está activo</span>
                                </label>
                                <div>
                                    <span className={label}>Mensaje en el chat</span>
                                    <input
                                        type="text"
                                        maxLength={500}
                                        value={age.message}
                                        onChange={(e) => setAge({ ...age, message: e.target.value })}
                                        placeholder="🆕 $(user), tu cuenta es muy nueva para escribir en este chat."
                                        className={`${input} text-sm`}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Frases de bots */}
                        <div className={card}>
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="min-w-0">
                                    <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">Frases de bots</h2>
                                    <p className={hint}>Spam de bots que venden viewers y seguidores. Se detecta aunque lo escriban separado o con signos.</p>
                                </div>
                                <FilterSwitch on={bots.enabled} onChange={(n) => toggleFilter('bot_phrases', n)} label="Activar el filtro de frases de bots" />
                            </div>
                            <div className={`space-y-4 ${bots.enabled ? '' : 'opacity-60'}`}>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={newPhrase}
                                        onChange={(e) => setNewPhrase(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addPhrase()}
                                        placeholder="best viewers on"
                                        className={input}
                                    />
                                    <button onClick={addPhrase} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg flex items-center justify-center gap-2">
                                        <Plus className="w-4 h-4" />
                                        Agregar
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                                    {bots.settings.phrases.map(p => (
                                        <div key={p} className="flex items-center gap-2 px-3 py-1 bg-[#f1f5f9] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg">
                                            <span className={`text-sm font-mono ${text}`}>{p}</span>
                                            <button
                                                onClick={() => setBots({ ...bots, settings: { phrases: bots.settings.phrases.filter(x => x !== p) } })}
                                                aria-label={`Quitar ${p}`}
                                                className="text-red-600 hover:text-red-700 dark:text-red-400"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setBots({ ...bots, settings: { phrases: [...defaultPhrases] } })}
                                    className="flex items-center gap-2 text-sm font-semibold text-[#2563eb] hover:underline"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Volver a la lista base
                                </button>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <span className={label}>Severidad</span>
                                        <SeveritySelect value={bots.severity} onChange={(v) => setBots({ ...bots, severity: v })} />
                                    </div>
                                    <div>
                                        <span className={label}>Mensaje en el chat</span>
                                        <input
                                            type="text"
                                            maxLength={500}
                                            value={bots.message}
                                            onChange={(e) => setBots({ ...bots, message: e.target.value })}
                                            placeholder="🤖 $(user), nada de spam de bots en este chat."
                                            className={`${input} text-sm`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={save}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all shadow-lg"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? 'Guardando…' : 'Guardar configuración'}
                    </button>
                    <p className="text-xs text-center text-[#64748b] dark:text-[#94a3b8]">
                        El botón de pánico y los interruptores se aplican al momento; el resto, al guardar.
                    </p>
                </div>
            )}
        </div>
    );
}
