import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bot, ChevronDown, ChevronUp, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import { FilterSwitch } from '../../pages/features/moderation/filterSwitch';

export type BotPlatform = 'twitch' | 'kick' | 'youtube';

interface Effects {
    hideOverlay: boolean;
    skipCounting: boolean;
    skipCommands: boolean;
    skipModeration: boolean;
    skipSpeech: boolean;
}

interface BotEntry {
    id: number | null;
    catalogId: number | null;
    platform: BotPlatform;
    username: string;
    displayName: string;
    category: string;
    isCustom: boolean;
    notes?: string | null;
    enabled: boolean;
    effects: Effects;
    defaults: Effects;
    customized: boolean;
}

interface BotListResponse {
    bots: BotEntry[];
    categories: string[];
    linked: { twitch: boolean; kick: boolean };
    maxCustom: number;
    isOwner: boolean;
}

export const CATEGORY_LABELS: Record<string, string> = {
    competencia: 'Competencia',
    moderacion: 'Moderación',
    musica: 'Música',
    alertas: 'Alertas',
    utilidad: 'Utilidad',
    propio: 'Decatron'
};

const PLATFORM_LABELS: Record<BotPlatform, string> = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube' };

const EFFECTS: { key: keyof Effects; label: string; hint: string }[] = [
    { key: 'hideOverlay', label: 'Ocultar del overlay de chat', hint: 'Sus mensajes no salen en el overlay de chat' },
    { key: 'skipCounting', label: 'No contar', hint: 'No suma a timers, tiempo de visualización, actividad ni rankings' },
    { key: 'skipCommands', label: 'No ejecutar comandos', hint: 'Sus mensajes no activan comandos de Decatron (evita bucles)' },
    { key: 'skipModeration', label: 'No sancionar', hint: 'Los filtros de moderación no lo sancionan' },
    { key: 'skipSpeech', label: 'No traducir ni leer en voz alta', hint: 'No se traduce ni se lee en el chat por voz' }
];

function errorMessage(e: unknown, fallback: string) {
    const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
    return message || fallback;
}

/**
 * Lista de bots del canal: el catálogo global con un interruptor por bot, los efectos de cada
 * uno y los bots propios del canal. La usan la página /features/bots y el modal que se abre
 * desde otras herramientas (overlay de chat, moderación).
 */
export default function BotListManager({ compact = false }: { compact?: boolean }) {
    const [data, setData] = useState<BotListResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [platform, setPlatform] = useState<BotPlatform>('twitch');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<string>('all');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [view, setView] = useState<'channel' | 'catalog'>('channel');

    const load = useCallback(async () => {
        try {
            const res = await api.get('/botlist');
            if (!res.data.success) throw new Error();
            const d: BotListResponse = res.data;
            setData(d);
            setError(null);
            setPlatform(prev => (prev === 'twitch' && !d.linked.twitch && d.linked.kick ? 'kick' : prev));
        } catch (e) {
            setError(errorMessage(e, 'No se pudo cargar la lista de bots'));
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const keyOf = (b: BotEntry) => `${b.platform}:${b.username}`;

    const patchLocal = (b: BotEntry, changes: Partial<BotEntry>) =>
        setData(d => d && ({ ...d, bots: d.bots.map(x => (keyOf(x) === keyOf(b) ? { ...x, ...changes } : x)) }));

    const saveEntry = async (b: BotEntry, body: Record<string, unknown>, optimistic: Partial<BotEntry>) => {
        const previous = data;
        patchLocal(b, optimistic);
        try {
            const res = await api.put('/botlist/entry', { platform: b.platform, username: b.username, ...body });
            if (!res.data.success) throw new Error();
            // Se vuelve a leer: "customized" y los valores por defecto los calcula el servidor
            await load();
        } catch (e) {
            setData(previous);
            setError(errorMessage(e, 'No se pudo guardar el cambio'));
        }
    };

    const toggleEffect = (b: BotEntry, key: keyof Effects, value: boolean) =>
        saveEntry(b, { [key]: value }, { effects: { ...b.effects, [key]: value } });

    const toggleCategory = async (cat: string, enabled: boolean) => {
        try {
            const res = await api.put(`/botlist/category/${cat}`, { enabled, platform });
            if (!res.data.success) throw new Error();
            await load();
        } catch (e) {
            setError(errorMessage(e, 'No se pudo guardar la categoría'));
        }
    };

    const removeCustom = async (b: BotEntry) => {
        if (b.id == null) return;
        try {
            const res = await api.delete(`/botlist/custom/${b.id}`);
            if (!res.data.success) throw new Error();
            await load();
        } catch (e) {
            setError(errorMessage(e, 'No se pudo quitar el bot'));
        }
    };

    const visible = useMemo(() => {
        if (!data) return [];
        const q = search.trim().toLowerCase();
        return data.bots
            .filter(b => b.platform === platform)
            .filter(b => category === 'all' || b.category === category)
            .filter(b => !q || b.username.includes(q) || b.displayName.toLowerCase().includes(q));
    }, [data, platform, category, search]);

    const counts = useMemo(() => {
        const result: Record<string, number> = {};
        data?.bots.filter(b => b.platform === platform).forEach(b => { result[b.category] = (result[b.category] ?? 0) + 1; });
        return result;
    }, [data, platform]);

    if (!data) {
        return error
            ? <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>
            : <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Cargando…</p>;
    }

    const platforms = (['twitch', 'kick'] as const).filter(p => data.linked[p]);
    const allOfCategoryOn = category !== 'all' && visible.length > 0 && visible.every(b => b.enabled);

    return (
        <div className="space-y-5">
            {data.isOwner && (
                <div className="flex gap-2">
                    {(['channel', 'catalog'] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${view === v
                                ? 'bg-[#2563eb] text-white'
                                : 'bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc]'}`}
                        >
                            {v === 'channel' ? 'Mi canal' : 'Catálogo global'}
                        </button>
                    ))}
                </div>
            )}

            {error && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm font-semibold">
                    <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</span>
                    <button onClick={() => setError(null)} aria-label="Cerrar"><X className="w-4 h-4" /></button>
                </div>
            )}

            {view === 'catalog' && data.isOwner
                ? <CatalogEditor bots={data.bots.filter(b => !b.isCustom)} onChanged={load} onError={setError} />
                : (
                    <>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Estos bots no cuentan como personas en tu canal. Todos los del catálogo vienen activos; apaga los que
                            no uses o cambia qué se les hace. Los bots de competencia y moderación se ocultan del todo; los de
                            música, alertas y utilidad siguen visibles en el overlay pero no cuentan ni ejecutan comandos.
                        </p>

                        <div className="flex flex-wrap items-center gap-3">
                            {platforms.length > 1 && (
                                <div className="flex gap-1 p-1 rounded-lg bg-[#e2e8f0] dark:bg-[#374151]">
                                    {platforms.map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setPlatform(p)}
                                            className={`px-3 py-1.5 rounded-md text-sm font-bold ${platform === p
                                                ? 'bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] shadow'
                                                : 'text-[#64748b] dark:text-[#94a3b8]'}`}
                                        >
                                            {PLATFORM_LABELS[p]}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="relative flex-1 min-w-[12rem]">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] dark:text-[#94a3b8]" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar bot"
                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                            <button
                                onClick={() => setAdding(a => !a)}
                                className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg font-semibold text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Agregar bot
                            </button>
                        </div>

                        {adding && (
                            <AddCustomForm
                                platform={platform}
                                categories={data.categories.filter(c => c !== 'propio')}
                                onDone={async () => { setAdding(false); await load(); }}
                                onError={setError}
                            />
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                            {['all', ...data.categories.filter(c => counts[c])].map(c => (
                                <button
                                    key={c}
                                    onClick={() => setCategory(c)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${category === c
                                        ? 'bg-[#2563eb] border-[#2563eb] text-white'
                                        : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8]'}`}
                                >
                                    {c === 'all' ? 'Todas' : `${CATEGORY_LABELS[c] ?? c} (${counts[c]})`}
                                </button>
                            ))}
                            {category !== 'all' && visible.length > 0 && (
                                <button
                                    onClick={() => toggleCategory(category, !allOfCategoryOn)}
                                    className="ml-auto text-xs font-bold text-[#2563eb] dark:text-[#3b82f6] hover:underline"
                                >
                                    {allOfCategoryOn ? 'Apagar toda la categoría' : 'Activar toda la categoría'}
                                </button>
                            )}
                        </div>

                        <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2'}`}>
                            {visible.map(b => {
                                const open = expanded === keyOf(b);
                                return (
                                    <div
                                        key={keyOf(b)}
                                        className={`bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] ${b.enabled ? '' : 'opacity-60'}`}
                                    >
                                        <div className="flex items-center gap-3 p-4">
                                            <Bot className="w-5 h-5 shrink-0 text-[#2563eb]" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-bold text-[#1e293b] dark:text-[#f8fafc] truncate">{b.displayName}</span>
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#e2e8f0] dark:bg-[#374151] text-[#475569] dark:text-[#cbd5e1]">
                                                        {CATEGORY_LABELS[b.category] ?? b.category}
                                                    </span>
                                                    {b.isCustom && (
                                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#2563eb]/10 text-[#2563eb] dark:text-[#3b82f6]">Propio</span>
                                                    )}
                                                    {b.customized && (
                                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">Ajustado</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] truncate">@{b.username}</p>
                                            </div>
                                            <button
                                                onClick={() => setExpanded(open ? null : keyOf(b))}
                                                className="p-2 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#374151]"
                                                aria-label={open ? 'Ocultar efectos' : 'Ver efectos'}
                                                aria-expanded={open}
                                            >
                                                {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                            {b.isCustom && (
                                                <button
                                                    onClick={() => removeCustom(b)}
                                                    className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    aria-label={`Quitar a ${b.displayName}`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                            {!b.isCustom && (
                                                <FilterSwitch
                                                    on={b.enabled}
                                                    onChange={next => saveEntry(b, { enabled: next }, { enabled: next })}
                                                    label={`Tratar a ${b.displayName} como bot`}
                                                />
                                            )}
                                        </div>

                                        {open && (
                                            <div className="px-4 pb-4 pt-3 border-t border-[#e2e8f0] dark:border-[#374151] space-y-3">
                                                {EFFECTS.map(fx => (
                                                    <div key={fx.key} className="flex items-center justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">{fx.label}</p>
                                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{fx.hint}</p>
                                                        </div>
                                                        <FilterSwitch
                                                            on={b.effects[fx.key]}
                                                            disabled={!b.enabled}
                                                            onChange={next => toggleEffect(b, fx.key, next)}
                                                            label={fx.label}
                                                        />
                                                    </div>
                                                ))}
                                                {b.customized && (
                                                    <button
                                                        onClick={() => saveEntry(b, { reset: true }, {})}
                                                        className="flex items-center gap-2 text-xs font-bold text-[#2563eb] dark:text-[#3b82f6] hover:underline"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                        Volver a los efectos por defecto
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {visible.length === 0 && (
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                {search ? 'Ningún bot coincide con la búsqueda.' : 'No hay bots en esta categoría.'}
                            </p>
                        )}
                    </>
                )}
        </div>
    );
}

function AddCustomForm({ platform, categories, onDone, onError }: {
    platform: BotPlatform;
    categories: string[];
    onDone: () => void;
    onError: (message: string) => void;
}) {
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [category, setCategory] = useState('utilidad');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!username.trim()) return;
        setSaving(true);
        try {
            const res = await api.post('/botlist/custom', { platform, username, displayName, category });
            if (!res.data.success) throw new Error();
            onDone();
        } catch (e) {
            onError(errorMessage(e, 'No se pudo agregar el bot'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-4 space-y-3">
            <p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Agregar un bot de {PLATFORM_LABELS[platform]}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Usuario (ej. minightbot)"
                    maxLength={40}
                    className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-transparent text-[#1e293b] dark:text-[#f8fafc] text-sm"
                />
                <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Nombre (opcional)"
                    maxLength={100}
                    className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-transparent text-[#1e293b] dark:text-[#f8fafc] text-sm"
                />
                <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                >
                    {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
                </select>
            </div>
            <button
                onClick={submit}
                disabled={saving || !username.trim()}
                className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-semibold text-sm"
            >
                {saving ? 'Agregando…' : 'Agregar'}
            </button>
        </div>
    );
}

/** Solo el owner: alta, edición y baja de los bots del catálogo global */
function CatalogEditor({ bots, onChanged, onError }: {
    bots: BotEntry[];
    onChanged: () => void;
    onError: (message: string) => void;
}) {
    const [editing, setEditing] = useState<number | 'new' | null>(null);
    const [form, setForm] = useState({ platform: 'twitch' as BotPlatform, username: '', displayName: '', category: 'utilidad', notes: '' });

    const startEdit = (b: BotEntry | null) => {
        setEditing(b ? b.catalogId : 'new');
        setForm(b
            ? { platform: b.platform, username: b.username, displayName: b.displayName, category: b.category, notes: b.notes ?? '' }
            : { platform: 'twitch', username: '', displayName: '', category: 'utilidad', notes: '' });
    };

    const save = async () => {
        try {
            const res = editing === 'new'
                ? await api.post('/botlist/catalog', form)
                : await api.put(`/botlist/catalog/${editing}`, form);
            if (!res.data.success) throw new Error();
            setEditing(null);
            onChanged();
        } catch (e) {
            onError(errorMessage(e, 'No se pudo guardar el bot'));
        }
    };

    const remove = async (b: BotEntry) => {
        if (!window.confirm(`¿Quitar a ${b.displayName} del catálogo? También se borran los ajustes que los canales hicieron sobre él.`)) return;
        try {
            const res = await api.delete(`/botlist/catalog/${b.catalogId}`);
            if (!res.data.success) throw new Error();
            onChanged();
        } catch (e) {
            onError(errorMessage(e, 'No se pudo quitar el bot'));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                    Lo que cambies aquí aplica a todos los canales. Cada canal puede apagar un bot o ajustar sus efectos.
                </p>
                <button
                    onClick={() => startEdit(null)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg font-semibold text-sm whitespace-nowrap"
                >
                    <Plus className="w-4 h-4" />
                    Agregar al catálogo
                </button>
            </div>

            {editing !== null && (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <select
                            value={form.platform}
                            onChange={e => setForm({ ...form, platform: e.target.value as BotPlatform })}
                            className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                        >
                            {(Object.keys(PLATFORM_LABELS) as BotPlatform[]).map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
                        </select>
                        <input
                            value={form.username}
                            onChange={e => setForm({ ...form, username: e.target.value })}
                            placeholder="Usuario"
                            maxLength={40}
                            className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-transparent text-[#1e293b] dark:text-[#f8fafc] text-sm"
                        />
                        <input
                            value={form.displayName}
                            onChange={e => setForm({ ...form, displayName: e.target.value })}
                            placeholder="Nombre"
                            maxLength={100}
                            className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-transparent text-[#1e293b] dark:text-[#f8fafc] text-sm"
                        />
                        <select
                            value={form.category}
                            onChange={e => setForm({ ...form, category: e.target.value })}
                            className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                        >
                            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    <input
                        value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        placeholder="Notas (opcional)"
                        maxLength={300}
                        className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-transparent text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    />
                    <div className="flex gap-2">
                        <button onClick={save} className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">Guardar</button>
                        <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] font-semibold text-sm">Cancelar</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {bots.map(b => (
                    <div key={b.catalogId} className="flex items-center gap-3 p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <Bot className="w-5 h-5 shrink-0 text-[#2563eb]" />
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] truncate">{b.displayName}</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] truncate">
                                {PLATFORM_LABELS[b.platform]} · @{b.username} · {CATEGORY_LABELS[b.category] ?? b.category}
                            </p>
                        </div>
                        <button onClick={() => startEdit(b)} className="p-2 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#374151]" aria-label={`Editar a ${b.displayName}`}>
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(b)} className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label={`Quitar a ${b.displayName} del catálogo`}>
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
