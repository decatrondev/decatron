import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bot, ChevronDown, ChevronUp, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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

export const CATEGORY_KEYS = ['competencia', 'moderacion', 'musica', 'alertas', 'utilidad', 'propio'];

const PLATFORM_LABELS: Record<BotPlatform, string> = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube' };

const EFFECT_KEYS: (keyof Effects)[] = ['hideOverlay', 'skipCounting', 'skipCommands', 'skipModeration', 'skipSpeech'];

/** Nombre de una categoría: las del catálogo salen de i18n; una desconocida se muestra tal cual */
function categoryLabel(t: (k: string) => string, c: string) {
    return CATEGORY_KEYS.includes(c) ? t(`botlist.categories.${c}`) : c;
}

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
    const { t } = useTranslation('moderation');
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
            setError(errorMessage(e, t('botlist.loadFailed')));
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
            setError(errorMessage(e, t('hub.saveFailed')));
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
            setError(errorMessage(e, t('botlist.categoryFailed')));
        }
    };

    const removeCustom = async (b: BotEntry) => {
        if (b.id == null) return;
        try {
            const res = await api.delete(`/botlist/custom/${b.id}`);
            if (!res.data.success) throw new Error();
            await load();
        } catch (e) {
            setError(errorMessage(e, t('botlist.removeFailed')));
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
            ? <p className="text-sm font-semibold text-ds-danger">{error}</p>
            : <p className="text-sm text-ds-soft">{t('common.loading')}</p>;
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
                            className={view === v ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {v === 'channel' ? t('botlist.myChannel') : t('botlist.globalCatalog')}
                        </button>
                    ))}
                </div>
            )}

            {error && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ds-danger/10 text-ds-danger text-sm font-semibold">
                    <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</span>
                    <button onClick={() => setError(null)} aria-label={t('botlist.close')}><X className="w-4 h-4" /></button>
                </div>
            )}

            {view === 'catalog' && data.isOwner
                ? <CatalogEditor bots={data.bots.filter(b => !b.isCustom)} onChanged={load} onError={setError} />
                : (
                    <>
                        <p className="text-sm text-ds-soft">
                            {t('botlist.intro')}
                        </p>

                        <div className="flex flex-wrap items-center gap-3">
                            {platforms.length > 1 && (
                                <div className="flex gap-1 p-1 rounded-lg bg-ds-raised">
                                    {platforms.map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setPlatform(p)}
                                            className={`px-3 py-1.5 rounded-md text-sm font-bold ${platform === p
                                                ? 'bg-ds-surface text-ds-text shadow'
                                                : 'text-ds-soft '}`}
                                        >
                                            {PLATFORM_LABELS[p]}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="relative flex-1 min-w-[12rem]">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ds-soft" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder={t('botlist.search')}
                                    className="ds-input w-full pl-9 pr-3"
                                />
                            </div>
                            <button
                                onClick={() => setAdding(a => !a)}
                                className="ds-btn ds-btn--primary"
                            >
                                <Plus className="w-4 h-4" />
                                {t('botlist.addBot')}
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
                                    className={category === c ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}
                                >
                                    {c === 'all' ? t('botlist.all') : `${categoryLabel(t, c)} (${counts[c]})`}
                                </button>
                            ))}
                            {category !== 'all' && visible.length > 0 && (
                                <button
                                    onClick={() => toggleCategory(category, !allOfCategoryOn)}
                                    className="ml-auto text-xs font-bold text-ds-accent-text hover:underline"
                                >
                                    {allOfCategoryOn ? t('botlist.allOff') : t('botlist.allOn')}
                                </button>
                            )}
                        </div>

                        <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2'}`}>
                            {visible.map(b => {
                                const open = expanded === keyOf(b);
                                return (
                                    <div
                                        key={keyOf(b)}
                                        className={`bg-ds-surface rounded-lg border border-ds-border ${b.enabled ? '' : 'opacity-60'}`}
                                    >
                                        <div className="flex items-center gap-3 p-4">
                                            <Bot className="w-5 h-5 shrink-0 text-ds-accent-text" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-bold text-ds-text truncate">{b.displayName}</span>
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-ds-raised text-ds-soft">
                                                        {categoryLabel(t, b.category)}
                                                    </span>
                                                    {b.isCustom && (
                                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-ds-accent/10 text-ds-accent-text">{t('botlist.own')}</span>
                                                    )}
                                                    {b.customized && (
                                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-ds-warn/10 text-ds-warn">{t('botlist.adjusted')}</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-ds-soft truncate">@{b.username}</p>
                                            </div>
                                            <button
                                                onClick={() => setExpanded(open ? null : keyOf(b))}
                                                className="ds-btn ds-btn--ghost ds-icon-btn"
                                                aria-label={open ? t('botlist.hideEffects') : t('botlist.showEffects')}
                                                aria-expanded={open}
                                            >
                                                {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                            {b.isCustom && (
                                                <button
                                                    onClick={() => removeCustom(b)}
                                                    className="p-2 rounded-lg text-ds-danger hover:bg-ds-danger/10"
                                                    aria-label={t('botlist.removeBot', { name: b.displayName })}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                            {!b.isCustom && (
                                                <FilterSwitch
                                                    on={b.enabled}
                                                    onChange={next => saveEntry(b, { enabled: next }, { enabled: next })}
                                                    label={t('botlist.treatAsBot', { name: b.displayName })}
                                                />
                                            )}
                                        </div>

                                        {open && (
                                            <div className="px-4 pb-4 pt-3 border-t border-ds-border space-y-3">
                                                {EFFECT_KEYS.map(fx => (
                                                    <div key={fx} className="flex items-center justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-ds-text">{t(`botlist.effects.${fx}.label`)}</p>
                                                            <p className="text-xs text-ds-soft">{t(`botlist.effects.${fx}.hint`)}</p>
                                                        </div>
                                                        <FilterSwitch
                                                            on={b.effects[fx]}
                                                            disabled={!b.enabled}
                                                            onChange={next => toggleEffect(b, fx, next)}
                                                            label={t(`botlist.effects.${fx}.label`)}
                                                        />
                                                    </div>
                                                ))}
                                                {b.customized && (
                                                    <button
                                                        onClick={() => saveEntry(b, { reset: true }, {})}
                                                        className="flex items-center gap-2 text-xs font-bold text-ds-accent-text hover:underline"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                        {t('botlist.resetEffects')}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {visible.length === 0 && (
                            <p className="text-sm text-ds-soft">
                                {search ? t('botlist.noMatch') : t('botlist.noneInCategory')}
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
    const { t } = useTranslation('moderation');
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
            onError(errorMessage(e, t('botlist.addFailed')));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-4 space-y-3">
            <p className="text-sm font-bold text-ds-text">{t('botlist.addFor', { platform: PLATFORM_LABELS[platform] })}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder={t('botlist.userPlaceholder')}
                    maxLength={40}
                    className="ds-input"
                />
                <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder={t('botlist.namePlaceholder')}
                    maxLength={100}
                    className="ds-input"
                />
                <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="ds-input"
                >
                    {categories.map(c => <option key={c} value={c}>{categoryLabel(t, c)}</option>)}
                </select>
            </div>
            <button
                onClick={submit}
                disabled={saving || !username.trim()}
                className="ds-btn ds-btn--primary"
            >
                {saving ? t('botlist.adding') : t('common.add')}
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
    const { t } = useTranslation('moderation');
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
            onError(errorMessage(e, t('botlist.saveBotFailed')));
        }
    };

    const remove = async (b: BotEntry) => {
        if (!window.confirm(t('botlist.catalogConfirm', { name: b.displayName }))) return;
        try {
            const res = await api.delete(`/botlist/catalog/${b.catalogId}`);
            if (!res.data.success) throw new Error();
            onChanged();
        } catch (e) {
            onError(errorMessage(e, t('botlist.removeFailed')));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ds-soft">
                    {t('botlist.catalogNote')}
                </p>
                <button
                    onClick={() => startEdit(null)}
                    className="ds-btn ds-btn--primary whitespace-nowrap"
                >
                    <Plus className="w-4 h-4" />
                    {t('botlist.addCatalog')}
                </button>
            </div>

            {editing !== null && (
                <div className="bg-ds-surface rounded-lg border border-ds-border p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <select
                            value={form.platform}
                            onChange={e => setForm({ ...form, platform: e.target.value as BotPlatform })}
                            className="ds-input"
                        >
                            {(Object.keys(PLATFORM_LABELS) as BotPlatform[]).map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
                        </select>
                        <input
                            value={form.username}
                            onChange={e => setForm({ ...form, username: e.target.value })}
                            placeholder={t('botlist.userLabel')}
                            maxLength={40}
                            className="ds-input"
                        />
                        <input
                            value={form.displayName}
                            onChange={e => setForm({ ...form, displayName: e.target.value })}
                            placeholder={t('botlist.nameLabel')}
                            maxLength={100}
                            className="ds-input"
                        />
                        <select
                            value={form.category}
                            onChange={e => setForm({ ...form, category: e.target.value })}
                            className="ds-input"
                        >
                            {CATEGORY_KEYS.map(k => <option key={k} value={k}>{categoryLabel(t, k)}</option>)}
                        </select>
                    </div>
                    <input
                        value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        placeholder={t('botlist.notes')}
                        maxLength={300}
                        className="ds-input w-full"
                    />
                    <div className="flex gap-2">
                        <button onClick={save} className="ds-btn ds-btn--primary">{t('botlist.save')}</button>
                        <button onClick={() => setEditing(null)} className="ds-btn ds-btn--secondary">{t('botlist.cancel')}</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {bots.map(b => (
                    <div key={b.catalogId} className="flex items-center gap-3 p-4 bg-ds-surface rounded-lg border border-ds-border">
                        <Bot className="w-5 h-5 shrink-0 text-ds-accent-text" />
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-ds-text truncate">{b.displayName}</p>
                            <p className="text-xs text-ds-soft truncate">
                                {PLATFORM_LABELS[b.platform]} · @{b.username} · {categoryLabel(t, b.category)}
                            </p>
                        </div>
                        <button onClick={() => startEdit(b)} className="ds-btn ds-btn--ghost ds-icon-btn" aria-label={t('botlist.editBot', { name: b.displayName })}>
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(b)} className="p-2 rounded-lg text-ds-danger hover:bg-ds-danger/10" aria-label={t('botlist.removeFromCatalog', { name: b.displayName })}>
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
