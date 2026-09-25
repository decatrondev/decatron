import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Star, ListPlus, RotateCcw, GripVertical, Plus, Download, Loader2, HardDriveDownload } from 'lucide-react';
import api from '../../../../../services/api';
import { Card, Field, NumberInput, Toggle, inputClass } from '../ui';
import { formatDuration } from '../../utils';
import type { SongRequestConfigState } from '../../hooks/useSongRequestConfig';
import { PlatformIcon, banPlatform } from '../PlatformIcon';

interface TabProps { cfg: SongRequestConfigState }

interface TrackDto {
    trackId: number;
    url: string | null;
    title: string;
    artist: string;
    durationSeconds: number | null;
    thumbnailUrl: string | null;
}

const smallBtn = 'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors disabled:opacity-50';
const primaryBtn = 'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white disabled:opacity-50 shrink-0';
const iconBtn = 'p-2 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626] hover:text-[#1e293b] dark:hover:text-white transition-colors';

function TrackRow({ track, children, leading }: { track: TrackDto; children?: React.ReactNode; leading?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 py-2">
            {leading}
            {track.thumbnailUrl
                ? <img src={track.thumbnailUrl} alt="" loading="lazy" className="w-16 h-9 3xl:w-20 3xl:h-[45px] object-cover rounded shrink-0" />
                : <div className="w-16 h-9 3xl:w-20 3xl:h-[45px] rounded bg-[#e2e8f0] dark:bg-[#262626] shrink-0" />}
            <div className="flex-1 min-w-0">
                <a href={track.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block text-sm 3xl:text-base font-semibold text-[#1e293b] dark:text-[#f8fafc] truncate hover:underline">{track.title}</a>
                <p className="text-xs 3xl:text-sm text-[#64748b] dark:text-[#94a3b8] truncate">{track.artist}</p>
            </div>
            <span className="font-mono text-xs 3xl:text-sm text-[#94a3b8] shrink-0 hidden sm:inline">{formatDuration(track.durationSeconds)}</span>
            {children}
        </div>
    );
}

function Feedback({ result }: { result: { ok: boolean; text: string } | null }) {
    if (!result) return null;
    return <p className={`text-sm 3xl:text-base mt-2 ${result.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{result.text}</p>;
}

function useErrorText() {
    const { t } = useTranslation('overlays');
    return (error: string | null | undefined) => t(`songRequest.errors.${error}`, { defaultValue: t('songRequest.errors.failed') });
}

// ── Filtros ──────────────────────────────────────────────────────────────

export function FiltersTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const s = cfg.settings;
    const minutes = Math.round((s.maxDurationSeconds / 60) * 10) / 10;

    return (
        <div className="space-y-6">
            <div className="p-4 rounded-xl border border-[#bfdbfe] dark:border-[#1e3a8a] bg-[#eff6ff] dark:bg-[#1e3a8a]/20 text-[#1e40af] dark:text-[#93c5fd] text-sm 3xl:text-base">
                {t('songRequest.filters.exempt')}
            </div>

            <Card title={t('songRequest.filters.durationTitle')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <Field label={t('songRequest.filters.maxDuration')} hint={t('songRequest.filters.maxDurationHint')}>
                        <NumberInput value={minutes} min={0} max={360} step={0.5} onChange={v => cfg.updateSettings({ maxDurationSeconds: Math.round(v * 60) })} />
                    </Field>
                    {s.maxDurationSeconds > 0 && (
                        <div className="md:pt-5">
                            <Toggle
                                checked={s.allowUnknownDuration}
                                onChange={v => cfg.updateSettings({ allowUnknownDuration: v })}
                                label={t('songRequest.filters.allowUnknown')}
                                hint={s.allowUnknownDuration ? t('songRequest.filters.allowUnknownOn') : t('songRequest.filters.allowUnknownOff')}
                            />
                        </div>
                    )}
                </div>
            </Card>

            <Card title={t('songRequest.filters.otherTitle')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('songRequest.filters.minViews')} hint={t('songRequest.filters.minViewsHint')}>
                        <NumberInput value={s.minViews} min={0} step={1000} onChange={v => cfg.updateSettings({ minViews: Math.round(v) })} />
                    </Field>
                    <Field label={t('songRequest.filters.noRepeat')} hint={t('songRequest.filters.noRepeatHint')}>
                        <NumberInput value={s.noRepeatMinutes} min={0} max={10080} onChange={v => cfg.updateSettings({ noRepeatMinutes: Math.round(v) })} />
                    </Field>
                </div>
                <p className="text-xs 3xl:text-sm text-[#94a3b8] mt-3">{t('songRequest.filters.alwaysBlocked')}</p>
            </Card>
        </div>
    );
}

// ── Listas negras ────────────────────────────────────────────────────────

interface Ban { id: number; type: 'track' | 'author' | 'user'; value: string; label: string; createdBy: string | null; createdAt: string }

export function BlacklistTab({ platforms }: { platforms: string[] }) {
    const { t } = useTranslation('overlays');
    const errorText = useErrorText();
    const [bans, setBans] = useState<Ban[] | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/song-request/bans');
            setBans(res.data.items ?? []);
        } catch { setBans([]); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const section = (type: Ban['type']) => (
        <BanSection
            key={type}
            type={type}
            bans={(bans ?? []).filter(b => b.type === type)}
            onChanged={load}
            errorText={errorText}
            platforms={platforms}
        />
    );

    return (
        <div className="space-y-6">
            <Card title={t('songRequest.blacklist.title')} description={t('songRequest.blacklist.description')}>
                {bans === null ? <Loader2 className="w-5 h-5 animate-spin text-[#94a3b8]" /> : null}
            </Card>
            {bans !== null && (['track', 'author', 'user'] as const).map(section)}
        </div>
    );
}

function BanSection({ type, bans, onChanged, errorText, platforms }: { type: Ban['type']; bans: Ban[]; onChanged: () => void; errorText: (e?: string | null) => string; platforms: string[] }) {
    const { t } = useTranslation('overlays');
    const [value, setValue] = useState('');
    // Con Twitch y Kick en la misma cola hay que decir de qué chat es el usuario
    const [platform, setPlatform] = useState(platforms[0] ?? 'twitch');
    const platformsKey = platforms.join(',');
    useEffect(() => { setPlatform(platformsKey.split(',')[0] || 'twitch'); }, [platformsKey]);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

    const add = async () => {
        if (!value.trim()) return;
        setBusy(true);
        setResult(null);
        try {
            const res = await api.post('/song-request/bans', { type, value: value.trim(), platform: type === 'user' ? platform : undefined });
            if (res.data.success) { setValue(''); onChanged(); }
            else setResult({ ok: false, text: errorText(res.data.error) });
        } catch { setResult({ ok: false, text: errorText('failed') }); }
        finally { setBusy(false); }
    };

    return (
        <Card title={t(`songRequest.blacklist.${type}.title`, { count: bans.length })} description={t(`songRequest.blacklist.${type}.description`)}>
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); add(); }}>
                {type === 'user' && platforms.length > 1 && (
                    <div className="flex shrink-0 rounded-lg border border-[#e2e8f0] dark:border-[#374151] overflow-hidden" role="radiogroup" aria-label={t('songRequest.blacklist.user.platform')}>
                        {platforms.map(p => (
                            <button
                                key={p}
                                type="button"
                                role="radio"
                                aria-checked={platform === p}
                                title={p === 'kick' ? 'Kick' : 'Twitch'}
                                onClick={() => setPlatform(p)}
                                className={`px-3 flex items-center transition-colors ${platform === p ? 'bg-[#eff6ff] dark:bg-[#1e3a8a]/40' : 'opacity-50 hover:opacity-100'}`}
                            >
                                <PlatformIcon platform={p} className="w-4 h-4 3xl:w-5 3xl:h-5" />
                            </button>
                        ))}
                    </div>
                )}
                <input value={value} onChange={e => setValue(e.target.value)} placeholder={t(`songRequest.blacklist.${type}.placeholder`)} className={inputClass} maxLength={500} />
                <button type="submit" disabled={busy || !value.trim()} className={primaryBtn}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t('songRequest.blacklist.add')}
                </button>
            </form>
            <Feedback result={result} />
            {bans.length > 0 ? (
                <div className="mt-4 divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                    {bans.map(b => (
                        <div key={b.id} className="flex items-center gap-3 py-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm 3xl:text-base font-semibold text-[#1e293b] dark:text-[#f8fafc] truncate">{type === 'user' ? <><PlatformIcon platform={banPlatform(b.value)} /> @{b.label}</> : b.label || b.value}</p>
                                <p className="text-xs 3xl:text-sm text-[#94a3b8] truncate">
                                    {b.createdBy ? t('songRequest.blacklist.by', { user: b.createdBy }) : ''} · {new Date(b.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <button className={iconBtn} title={t('songRequest.blacklist.remove')} onClick={async () => { await api.delete(`/song-request/bans/${b.id}`); onChanged(); }}>
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm 3xl:text-base text-[#94a3b8] mt-3">{t('songRequest.blacklist.empty')}</p>
            )}
        </Card>
    );
}

// ── Playlist de respaldo ─────────────────────────────────────────────────

interface FallbackItem { id: number; track: TrackDto }

export function FallbackTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const errorText = useErrorText();
    const s = cfg.settings;
    const [items, setItems] = useState<FallbackItem[] | null>(null);
    const [max, setMax] = useState(500);
    const [input, setInput] = useState('');
    const [playlist, setPlaylist] = useState('');
    const [busy, setBusy] = useState<'add' | 'import' | null>(null);
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
    const [dragId, setDragId] = useState<number | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/song-request/fallback');
            setItems(res.data.items ?? []);
            setMax(res.data.max ?? 500);
        } catch { setItems([]); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const add = async () => {
        if (!input.trim()) return;
        setBusy('add'); setResult(null);
        try {
            const res = await api.post('/song-request/fallback', { input: input.trim() });
            if (res.data.success) { setInput(''); setResult({ ok: true, text: t('songRequest.fallback.added') }); load(); }
            else setResult({ ok: false, text: errorText(res.data.error) });
        } catch { setResult({ ok: false, text: errorText('failed') }); }
        finally { setBusy(null); }
    };

    const importList = async () => {
        if (!playlist.trim()) return;
        setBusy('import'); setResult(null);
        try {
            const res = await api.post('/song-request/fallback/import', { url: playlist.trim() });
            if (res.data.success) {
                setPlaylist('');
                setResult({ ok: true, text: t('songRequest.fallback.imported', { added: res.data.added, skipped: res.data.skipped }) });
                load();
            } else setResult({ ok: false, text: errorText(res.data.error) });
        } catch { setResult({ ok: false, text: errorText('failed') }); }
        finally { setBusy(null); }
    };

    const drop = async (targetId: number) => {
        if (!items || dragId === null || dragId === targetId) return;
        const ids = items.map(i => i.id);
        ids.splice(ids.indexOf(targetId), 0, ids.splice(ids.indexOf(dragId), 1)[0]);
        const byId = new Map(items.map(i => [i.id, i]));
        setItems(ids.map(id => byId.get(id)!));
        setDragId(null);
        await api.put('/song-request/fallback/order', { ids });
    };

    return (
        <div className="space-y-6">
            <Card title={t('songRequest.fallback.title')} description={t('songRequest.fallback.description')}>
                <div className="space-y-4">
                    <Toggle checked={s.fallbackEnabled} onChange={v => cfg.updateSettings({ fallbackEnabled: v })} label={t('songRequest.fallback.enabled')} hint={t('songRequest.fallback.enabledHint')} />
                    <Toggle checked={s.fallbackShuffle} onChange={v => cfg.updateSettings({ fallbackShuffle: v })} label={t('songRequest.fallback.shuffle')} />
                    <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('songRequest.fallback.saveNote')}</p>
                </div>
            </Card>

            <Card title={t('songRequest.fallback.addTitle')}>
                <div className="space-y-3">
                    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); add(); }}>
                        <input value={input} onChange={e => setInput(e.target.value)} placeholder={t('songRequest.queue.addPlaceholder')} className={inputClass} maxLength={500} />
                        <button type="submit" disabled={!!busy || !input.trim()} className={primaryBtn}>
                            {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t('songRequest.queue.add')}
                        </button>
                    </form>
                    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); importList(); }}>
                        <input value={playlist} onChange={e => setPlaylist(e.target.value)} placeholder={t('songRequest.fallback.importPlaceholder')} className={inputClass} maxLength={500} />
                        <button type="submit" disabled={!!busy || !playlist.trim()} className={primaryBtn}>
                            {busy === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {t('songRequest.fallback.import')}
                        </button>
                    </form>
                    <Feedback result={result} />
                </div>
            </Card>

            <Card
                title={t('songRequest.fallback.listTitle', { count: items?.length ?? 0, max })}
                actions={items && items.length > 0 ? (
                    <button className={smallBtn} onClick={async () => { if (window.confirm(t('songRequest.fallback.clearConfirm'))) { await api.delete('/song-request/fallback'); load(); } }}>
                        <Trash2 className="w-4 h-4" /> {t('songRequest.fallback.clear')}
                    </button>
                ) : undefined}
            >
                {items === null ? <Loader2 className="w-5 h-5 animate-spin text-[#94a3b8]" />
                    : items.length === 0 ? <p className="text-sm 3xl:text-base text-[#94a3b8]">{t('songRequest.fallback.empty')}</p>
                        : (
                            <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                                {items.map((item, i) => (
                                    <div key={item.id} draggable onDragStart={() => setDragId(item.id)} onDragOver={e => e.preventDefault()} onDrop={() => drop(item.id)} className={dragId === item.id ? 'opacity-40' : ''}>
                                        <TrackRow
                                            track={item.track}
                                            leading={<>
                                                <GripVertical className="w-4 h-4 text-[#cbd5e1] dark:text-[#4b5563] cursor-grab shrink-0" />
                                                <span className="w-7 text-right font-mono text-xs 3xl:text-sm text-[#94a3b8] shrink-0">{i + 1}</span>
                                            </>}
                                        >
                                            <button className={iconBtn} title={t('songRequest.queue.remove')} onClick={async () => { await api.delete(`/song-request/fallback/${item.id}`); load(); }}>
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </TrackRow>
                                    </div>
                                ))}
                            </div>
                        )}
            </Card>
        </div>
    );
}

// ── Historial ────────────────────────────────────────────────────────────

interface HistoryItem { id: number; track: TrackDto; requestedBy: string | null; platform: string | null; endReason: string; isFavorite: boolean; playedAt: string }

export function HistoryTab({ onDownload }: { onDownload?: (url: string) => void }) {
    const { t } = useTranslation('overlays');
    const errorText = useErrorText();
    const [favorites, setFavorites] = useState(false);
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async (p: number, favs: boolean, append: boolean) => {
        setLoading(true);
        try {
            const res = await api.get('/song-request/history', { params: { page: p, favorites: favs } });
            const data = res.data.data;
            setTotal(data.total);
            setItems(prev => append ? [...prev, ...data.items] : data.items);
            setPage(p);
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(0, favorites, false); }, [favorites, load]);

    const act = async (fn: () => Promise<any>, okText: string) => {
        setResult(null);
        try {
            const res = await fn();
            setResult(res.data.success ? { ok: true, text: okText } : { ok: false, text: errorText(res.data.error) });
        } catch { setResult({ ok: false, text: errorText('failed') }); }
    };

    const toggleFavorite = async (item: HistoryItem) => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, isFavorite: !i.isFavorite } : i));
        await api.post(`/song-request/history/${item.id}/favorite`, { value: !item.isFavorite });
        if (favorites && item.isFavorite) setItems(prev => prev.filter(i => i.id !== item.id));
    };

    const reasonTone: Record<string, string> = {
        finished: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        skipped: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };

    return (
        <div className="space-y-6">
            <Card
                title={t('songRequest.history.title', { count: total })}
                description={t('songRequest.history.description')}
                actions={
                    <button className={smallBtn} onClick={async () => { if (window.confirm(t('songRequest.history.clearConfirm'))) { await api.delete('/song-request/history'); load(0, favorites, false); } }}>
                        <Trash2 className="w-4 h-4" /> {t('songRequest.history.clear')}
                    </button>
                }
            >
                <div className="flex gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111] w-fit mb-3">
                    {[false, true].map(f => (
                        <button key={String(f)} onClick={() => setFavorites(f)} className={`px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold ${favorites === f ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8]'}`}>
                            {f ? t('songRequest.history.favorites') : t('songRequest.history.all')}
                        </button>
                    ))}
                </div>
                <Feedback result={result} />
                {items.length === 0 && !loading ? (
                    <p className="text-sm 3xl:text-base text-[#94a3b8]">{favorites ? t('songRequest.history.noFavorites') : t('songRequest.history.empty')}</p>
                ) : (
                    <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                        {items.map(item => (
                            <TrackRow key={item.id} track={item.track}>
                                <div className="hidden md:flex flex-col items-end shrink-0 w-56 3xl:w-64">
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] 3xl:text-xs font-bold ${reasonTone[item.endReason] ?? reasonTone.finished}`}>{t(`songRequest.history.reasons.${item.endReason}`, { defaultValue: item.endReason })}</span>
                                    <span className="text-[11px] 3xl:text-xs text-[#94a3b8] mt-0.5 truncate max-w-full">
                                        {item.platform === 'fallback' ? t('songRequest.overlayLabels.fallback') : <><PlatformIcon platform={item.platform} /> {item.requestedBy}</>} · {new Date(item.playedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                    </span>
                                </div>
                                <button className={iconBtn} title={item.isFavorite ? t('songRequest.history.unfavorite') : t('songRequest.history.favorite')} onClick={() => toggleFavorite(item)}>
                                    <Star className={`w-4 h-4 ${item.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                                </button>
                                <button className={iconBtn} title={t('songRequest.history.requeue')} onClick={() => act(() => api.post(`/song-request/history/${item.id}/requeue`), t('songRequest.history.requeued'))}>
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                                {onDownload && item.track.url && (
                                    <button className={iconBtn} title={t('songRequest.downloads.sendTo')} onClick={() => onDownload(item.track.url!)}>
                                        <HardDriveDownload className="w-4 h-4" />
                                    </button>
                                )}
                                <button className={iconBtn} title={t('songRequest.history.toFallback')} onClick={() => act(() => api.post(`/song-request/history/${item.id}/fallback`), t('songRequest.fallback.added'))}>
                                    <ListPlus className="w-4 h-4" />
                                </button>
                            </TrackRow>
                        ))}
                    </div>
                )}
                {items.length < total && (
                    <button className={`${smallBtn} mt-4`} disabled={loading} onClick={() => load(page + 1, favorites, true)}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t('songRequest.history.more')}
                    </button>
                )}
            </Card>
        </div>
    );
}
