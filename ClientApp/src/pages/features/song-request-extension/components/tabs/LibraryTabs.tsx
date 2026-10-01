import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Star, ListPlus, RotateCcw, GripVertical, Plus, Download, Loader2, HardDriveDownload, Globe, Lock, Radio, Play, Square, ThumbsUp } from 'lucide-react';
import api from '../../../../../services/api';
import { Card, Field, NumberInput, PlanLimitNote, Select, Toggle, inputClass } from '../ui';
import { formatDuration } from '../../utils';
import type { SongRequestConfigState } from '../../hooks/useSongRequestConfig';
import { PlatformIcon, banPlatform } from '../PlatformIcon';
import { useDesktopDownload } from '../../../../../hooks/useDesktopDownload';
import type { Playlist, PlaylistRequirements, Role, SongRequestLimits } from '../../types';
import { ROLES } from '../../constants/defaults';

type PlaylistChangeKeys = 'name' | 'visibility' | 'shuffle' | 'isFallback' | 'contribution' | 'requirements' | 'votingEnabled' | 'sortByVotes';

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

            <Card title={t('songRequest.filters.sourceTitle')} description={t('songRequest.filters.sourceDescription')}>
                <Field label={t('songRequest.filters.source')}>
                    <Select
                        value={s.requestSource}
                        onChange={v => { cfg.setRequestMode({ requestSource: v }); }}
                        options={[
                            { value: 'any', label: t('songRequest.filters.sourceAny') },
                            { value: 'playlists', label: t('songRequest.filters.sourcePlaylists') },
                        ]}
                    />
                </Field>
                <p className="text-xs 3xl:text-sm text-[#94a3b8] mt-2">{t(`songRequest.filters.sourceHint_${s.requestSource}`)}</p>
            </Card>

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

// ── Playlists ────────────────────────────────────────────────────────────

interface PlaylistItem { id: number; number: number; votes: number; track: TrackDto; addedBy: string | null; addedByPlatform: string | null }

function usePlaylists() {
    const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
    const [limits, setLimits] = useState<SongRequestLimits | null>(null);
    const load = useCallback(async () => {
        try {
            const res = await api.get('/song-request/playlists');
            setPlaylists(res.data.playlists ?? []);
            setLimits(res.data.limits ?? null);
        } catch { setPlaylists([]); }
    }, []);
    useEffect(() => { load(); }, [load]);
    return { playlists, limits, reload: load };
}

export function PlaylistsTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const errorText = useErrorText();
    const s = cfg.settings;
    const { playlists, limits, reload } = usePlaylists();
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

    const selected = playlists?.find(p => p.id === selectedId) ?? playlists?.[0] ?? null;
    const fallback = playlists?.find(p => p.isFallback) ?? null;
    const atLimit = !!limits && !!playlists && playlists.length >= limits.maxPlaylists;

    const create = async () => {
        if (!newName.trim()) return;
        setCreating(true); setResult(null);
        try {
            const res = await api.post('/song-request/playlists', { name: newName.trim() });
            if (res.data.success) { setNewName(''); setSelectedId(res.data.id); await reload(); }
            else setResult({ ok: false, text: errorText(res.data.error) });
        } catch { setResult({ ok: false, text: errorText('failed') }); }
        finally { setCreating(false); }
    };

    const update = async (id: number, changes: Partial<Pick<Playlist, PlaylistChangeKeys>>) => {
        setResult(null);
        try {
            const res = await api.put(`/song-request/playlists/${id}`, changes);
            if (!res.data.success) setResult({ ok: false, text: errorText(res.data.error) });
        } catch { setResult({ ok: false, text: errorText('failed') }); }
        await reload();
    };

    const remove = async (playlist: Playlist) => {
        if (!window.confirm(t('songRequest.playlists.deleteConfirm', { name: playlist.name, count: playlist.count }))) return;
        await api.delete(`/song-request/playlists/${playlist.id}`);
        setSelectedId(null);
        await reload();
    };

    if (playlists === null) return <Loader2 className="w-5 h-5 animate-spin text-[#94a3b8]" />;

    return (
        <div className="space-y-6">
            <Card title={t('songRequest.fallback.title')} description={t('songRequest.fallback.description')}>
                <div className="space-y-4">
                    <Toggle checked={s.fallbackEnabled} onChange={v => cfg.updateSettings({ fallbackEnabled: v })} label={t('songRequest.fallback.enabled')} hint={t('songRequest.fallback.enabledHint')} />
                    <Field label={t('songRequest.fallback.which')}>
                        <select
                            className={inputClass}
                            value={fallback?.id ?? ''}
                            onChange={e => {
                                const id = Number(e.target.value);
                                if (id) update(id, { isFallback: true });
                                else if (fallback) update(fallback.id, { isFallback: false });
                            }}
                        >
                            <option value="">{t('songRequest.fallback.none')}</option>
                            {playlists.map(p => <option key={p.id} value={p.id}>{p.name} ({p.count})</option>)}
                        </select>
                    </Field>
                    {s.fallbackEnabled && (!fallback || fallback.count === 0) && (
                        <p className="text-xs 3xl:text-sm text-amber-700 dark:text-amber-300">{t('songRequest.fallback.emptyWarning')}</p>
                    )}
                    <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('songRequest.fallback.saveNote')}</p>
                </div>
            </Card>

            <Card
                title={t('songRequest.playlists.title', { count: playlists.length, max: limits?.maxPlaylists ?? '…' })}
                description={t('songRequest.playlists.description')}
            >
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {playlists.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedId(p.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm 3xl:text-base font-semibold transition-colors ${selected?.id === p.id
                                    ? 'border-[#2563eb] bg-[#eff6ff] dark:bg-[#1e3a8a]/30 text-[#1d4ed8] dark:text-[#93c5fd]'
                                    : 'border-[#e2e8f0] dark:border-[#374151] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#f8fafc] dark:hover:bg-[#262626]'}`}
                            >
                                {p.visibility === 'public' ? <Globe className="w-4 h-4 shrink-0" /> : <Lock className="w-4 h-4 shrink-0" />}
                                <span className="truncate max-w-[12rem] 3xl:max-w-[16rem]">{p.name}</span>
                                <span className="text-xs 3xl:text-sm text-[#94a3b8]">{p.count}</span>
                                {p.isFallback && <span className="px-1.5 py-0.5 rounded-md text-[10px] 3xl:text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{t('songRequest.playlists.fallbackBadge')}</span>}
                                {p.isActive && <span className="px-1.5 py-0.5 rounded-md text-[10px] 3xl:text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">▶ {t('songRequest.playlists.playingBadge')}</span>}
                            </button>
                        ))}
                    </div>
                    {atLimit ? (
                        <PlanLimitNote text={t('songRequest.limits.playlists', { max: limits!.maxPlaylists })} />
                    ) : (
                        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); create(); }}>
                            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('songRequest.playlists.namePlaceholder')} className={inputClass} maxLength={60} />
                            <button type="submit" disabled={creating || !newName.trim()} className={primaryBtn}>
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t('songRequest.playlists.create')}
                            </button>
                        </form>
                    )}
                    <Feedback result={result} />
                </div>
            </Card>

            {selected && (
                <PlaylistEditor
                    key={selected.id}
                    playlist={selected}
                    channel={cfg.server?.channel ?? ''}
                    onUpdate={changes => update(selected.id, changes)}
                    onDelete={() => remove(selected)}
                    onItemsChanged={reload}
                    onPlay={async on => { await api.put('/song-request/active-playlist', { playlistId: on ? selected.id : null }); await reload(); }}
                />
            )}
        </div>
    );
}

function PlaylistEditor({ playlist, channel, onUpdate, onDelete, onItemsChanged, onPlay }: {
    onPlay: (on: boolean) => void;
    playlist: Playlist;
    channel: string;
    onUpdate: (changes: Partial<Pick<Playlist, PlaylistChangeKeys>>) => void;
    onDelete: () => void;
    onItemsChanged: () => void;
}) {
    const { t } = useTranslation('overlays');
    const errorText = useErrorText();
    const base = `/song-request/playlists/${playlist.id}`;
    const [name, setName] = useState(playlist.name);
    const [items, setItems] = useState<PlaylistItem[] | null>(null);
    const [max, setMax] = useState(500);
    const [input, setInput] = useState('');
    const [importUrl, setImportUrl] = useState('');
    const [busy, setBusy] = useState<'add' | 'import' | null>(null);
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
    const [dragId, setDragId] = useState<number | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get(`${base}/items`);
            setItems(res.data.items ?? []);
            setMax(res.data.max ?? 500);
        } catch { setItems([]); }
    }, [base]);
    // El orden cambia al prender o apagar "más votadas primero"
    useEffect(() => { load(); }, [load, playlist.sortByVotes]);

    const changed = async () => { await load(); onItemsChanged(); };

    const add = async () => {
        if (!input.trim()) return;
        setBusy('add'); setResult(null);
        try {
            const res = await api.post(`${base}/items`, { input: input.trim() });
            if (res.data.success) { setInput(''); setResult({ ok: true, text: t('songRequest.playlists.added', { name: playlist.name }) }); changed(); }
            else setResult({ ok: false, text: errorText(res.data.error) });
        } catch { setResult({ ok: false, text: errorText('failed') }); }
        finally { setBusy(null); }
    };

    const importList = async () => {
        if (!importUrl.trim()) return;
        setBusy('import'); setResult(null);
        try {
            // Toda importación corre en Decatron Desktop: el server no le consulta nada a YouTube (le bloquea la IP)
            const res = await api.post(`${base}/import-external`, { url: importUrl.trim() });
            if (res.data.success) { setImportUrl(''); setImportJob(res.data.job); }
            else {
                setResult({ ok: false, text: errorText(res.data.error) });
                if (res.data.error === 'desktop_missing' || res.data.error === 'desktop_outdated') setDesktopReady(false);
            }
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
        await api.put(`${base}/order`, { ids });
    };

    const saveName = () => {
        const clean = name.trim();
        if (clean && clean !== playlist.name) onUpdate({ name: clean });
        else setName(playlist.name);
    };

    const full = items !== null && items.length >= max;

    // Importación con Desktop: se sigue cada 2 s mientras busca; al terminar se recarga la lista
    const [importJob, setImportJob] = useState<ImportJob | null>(null);
    const [desktopReady, setDesktopReady] = useState<boolean | null>(null);
    const [desktopOutdated, setDesktopOutdated] = useState(false);
    const desktop = useDesktopDownload();
    const running = importJob?.state === 'matching' || importJob?.state === 'listing';
    const lastAdded = useRef(0);
    useEffect(() => {
        let alive = true;
        const poll = async () => {
            try {
                const res = await api.get('/song-request/imports/current');
                if (!alive) return;
                setDesktopReady(!!res.data.desktopReady);
                setDesktopOutdated(!!res.data.desktopOutdated);
                const job: ImportJob | null = res.data.job && res.data.job.playlistId === playlist.id ? res.data.job : null;
                setImportJob(job);
                if (job && job.added !== lastAdded.current) { lastAdded.current = job.added; changed(); }
            } catch { /* se reintenta */ }
        };
        poll();
        if (!running) return () => { alive = false; };
        const id = window.setInterval(poll, 2000);
        return () => { alive = false; window.clearInterval(id); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, playlist.id]);
    const importAction = async (action: 'cancel' | 'resume') => {
        const res = await api.post(`/song-request/imports/current/${action}`);
        if (!res.data.success) setResult({ ok: false, text: errorText(res.data.error) });
        const cur = await api.get('/song-request/imports/current');
        setImportJob(cur.data.job?.playlistId === playlist.id ? cur.data.job : null);
    };

    return (
        <>
            <Card
                title={playlist.name}
                actions={
                    <button className={smallBtn} onClick={onDelete}>
                        <Trash2 className="w-4 h-4" /> {t('songRequest.playlists.delete')}
                    </button>
                }
            >
                <div className="space-y-4">
                    <Field label={t('songRequest.playlists.name')}>
                        <input value={name} onChange={e => setName(e.target.value)} onBlur={saveName} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className={inputClass} maxLength={60} />
                    </Field>
                    <Toggle
                        checked={playlist.visibility === 'public'}
                        onChange={v => onUpdate({ visibility: v ? 'public' : 'private' })}
                        label={t('songRequest.playlists.public')}
                        hint={t('songRequest.playlists.publicHint', { url: `decatron.net/sr/${channel}` })}
                    />
                    <Toggle checked={playlist.shuffle} onChange={v => onUpdate({ shuffle: v })} label={t('songRequest.fallback.shuffle')} hint={t('songRequest.playlists.shuffleHint')} />
                    <Toggle checked={playlist.votingEnabled} onChange={v => onUpdate({ votingEnabled: v })} label={t('songRequest.playlists.voting')} hint={t('songRequest.playlists.votingHint')} />
                    <Toggle checked={playlist.sortByVotes} onChange={v => onUpdate({ sortByVotes: v })} label={t('songRequest.playlists.sortByVotes')} hint={t('songRequest.playlists.sortByVotesHint')} />
                    <div className="flex flex-wrap gap-2">
                        {playlist.isActive ? (
                            <button className={smallBtn} onClick={() => onPlay(false)}>
                                <Square className="w-4 h-4" /> {t('songRequest.playlists.stopPlaying')}
                            </button>
                        ) : (
                            <button className={primaryBtn} onClick={() => onPlay(true)}>
                                <Play className="w-4 h-4" /> {t('songRequest.playlists.play')}
                            </button>
                        )}
                        {!playlist.isFallback && (
                            <button className={smallBtn} onClick={() => onUpdate({ isFallback: true })}>
                                <Radio className="w-4 h-4" /> {t('songRequest.playlists.makeFallback')}
                            </button>
                        )}
                    </div>
                    <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t(playlist.isActive ? 'songRequest.playlists.playingHint' : 'songRequest.playlists.playHint')}</p>
                    <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('songRequest.playlists.instantNote')}</p>
                </div>
            </Card>

            <ContributionCard playlist={playlist} onUpdate={onUpdate} />

            <Card title={t('songRequest.fallback.addTitle')}>
                <div className="space-y-3">
                    {full && <PlanLimitNote text={t('songRequest.limits.items', { max })} />}
                    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); add(); }}>
                        <input value={input} onChange={e => setInput(e.target.value)} placeholder={t('songRequest.queue.addPlaceholder')} className={inputClass} maxLength={500} disabled={full} />
                        <button type="submit" disabled={!!busy || !input.trim() || full} className={primaryBtn}>
                            {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t('songRequest.queue.add')}
                        </button>
                    </form>
                    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); importList(); }}>
                        <input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder={t('songRequest.fallback.importPlaceholder')} className={inputClass} maxLength={500} disabled={full} />
                        <button type="submit" disabled={!!busy || !importUrl.trim() || full} className={primaryBtn}>
                            {busy === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {t('songRequest.fallback.import')}
                        </button>
                    </form>
                    {desktopReady === false ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
                            <p className="flex-1 text-xs 3xl:text-sm text-amber-900 dark:text-amber-200">
                                {t(desktopOutdated ? 'songRequest.importExt.outdated' : 'songRequest.importExt.noDesktop')}
                            </p>
                            <a href={desktop.url} target="_blank" rel="noreferrer" className={primaryBtn}><Download className="w-4 h-4" /> {desktop.label}</a>
                        </div>
                    ) : (
                        <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('songRequest.importExt.hint')}</p>
                    )}
                    <Feedback result={result} />
                    {importJob && <ImportJobCard job={importJob} onAction={importAction} />}
                </div>
            </Card>

            <Card
                title={t('songRequest.fallback.listTitle', { count: items?.length ?? 0, max })}
                actions={items && items.length > 0 ? (
                    <button className={smallBtn} onClick={async () => { if (window.confirm(t('songRequest.fallback.clearConfirm', { name: playlist.name }))) { await api.delete(`${base}/items`); changed(); } }}>
                        <Trash2 className="w-4 h-4" /> {t('songRequest.fallback.clear')}
                    </button>
                ) : undefined}
            >
                {items === null ? <Loader2 className="w-5 h-5 animate-spin text-[#94a3b8]" />
                    : items.length === 0 ? <p className="text-sm 3xl:text-base text-[#94a3b8]">{t('songRequest.fallback.empty')}</p>
                        : (
                            <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                                {items.map(item => (
                                    // Con "más votadas primero" el orden lo dan los votos: no se arrastra
                                    <div key={item.id} draggable={!playlist.sortByVotes} onDragStart={() => setDragId(item.id)} onDragOver={e => e.preventDefault()} onDrop={() => drop(item.id)} className={dragId === item.id ? 'opacity-40' : ''}>
                                        <TrackRow
                                            track={item.track}
                                            leading={<>
                                                {!playlist.sortByVotes && <GripVertical className="w-4 h-4 text-[#cbd5e1] dark:text-[#4b5563] cursor-grab shrink-0" />}
                                                <span className="w-9 text-right font-mono text-xs 3xl:text-sm text-[#94a3b8] shrink-0">#{item.number}</span>
                                            </>}
                                        >
                                            {playlist.votingEnabled && (
                                                <span className="inline-flex items-center gap-1 text-xs 3xl:text-sm font-bold text-[#64748b] dark:text-[#94a3b8] shrink-0" title={t('songRequest.playlists.votes', { count: item.votes })}>
                                                    <ThumbsUp className="w-3.5 h-3.5" /> {item.votes}
                                                </span>
                                            )}
                                            {item.addedBy && (
                                                <span className="hidden md:inline-flex items-center gap-1 text-xs 3xl:text-sm text-[#94a3b8] max-w-[10rem] 3xl:max-w-[14rem] truncate shrink-0" title={t('songRequest.playlists.addedBy', { user: item.addedBy })}>
                                                    <PlatformIcon platform={item.addedByPlatform ?? 'twitch'} /> {item.addedBy}
                                                </span>
                                            )}
                                            <button className={iconBtn} title={t('songRequest.queue.remove')} onClick={async () => { await api.delete(`${base}/items/${item.id}`); changed(); }}>
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </TrackRow>
                                    </div>
                                ))}
                            </div>
                        )}
            </Card>
        </>
    );
}

interface ImportJob {
    id: string;
    state: 'listing' | 'matching' | 'done' | 'canceled' | 'desktop_lost';
    service: 'youtube' | 'spotify' | 'deezer' | 'apple';
    error?: string | null;
    sourceName: string | null;
    playlistId: number;
    total: number;
    added: number;
    duplicates: number;
    notFound: number;
    rejected: number;
    pending: number;
    problems: { title: string; artist: string; url: string | null; reason: string | null }[];
}

/** Avance y resultado de una importación con Desktop, con lo que no entró para buscarlo a mano. */
function ImportJobCard({ job, onAction }: { job: ImportJob; onAction: (a: 'cancel' | 'resume') => void }) {
    const { t } = useTranslation('overlays');
    const [showProblems, setShowProblems] = useState(false);
    const done = job.total - job.pending;
    const percent = job.total ? Math.round((done / job.total) * 100) : 0;
    const service = t(`songRequest.importExt.services.${job.service}`);
    return (
        <div className="mt-2 p-4 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#111] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc]">
                    {t(`songRequest.importExt.state.${job.state}`, { service, name: job.sourceName ?? '' })}
                </p>
                {(job.state === 'matching' || job.state === 'listing') && <button className={smallBtn} onClick={() => onAction('cancel')}>{t('songRequest.importExt.cancel')}</button>}
                {(job.state === 'desktop_lost' || job.state === 'canceled') && (job.pending > 0 || job.total === 0) && (
                    <button className={primaryBtn} onClick={() => onAction('resume')}>{job.total === 0 ? t('songRequest.importExt.retry') : t('songRequest.importExt.resume', { count: job.pending })}</button>
                )}
            </div>
            <div className="h-2 rounded-full bg-[#e2e8f0] dark:bg-[#262626] overflow-hidden">
                <div className="h-full bg-[#2563eb] transition-all" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-xs 3xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                {t('songRequest.importExt.counts', { done, total: job.total, added: job.added, duplicates: job.duplicates, notFound: job.notFound, rejected: job.rejected })}
            </p>
            {job.state === 'desktop_lost' && <p className="text-xs 3xl:text-sm text-amber-700 dark:text-amber-300">{t('songRequest.importExt.lostHint')}</p>}
            {job.error && <p className="text-xs 3xl:text-sm text-red-600 dark:text-red-400">{t(`songRequest.importExt.listErrors.${job.error}`, { defaultValue: t('songRequest.importExt.listErrors.list_failed') })}</p>}
            {job.problems.length > 0 && (
                <div>
                    <button className="text-xs 3xl:text-sm font-bold text-[#2563eb] dark:text-[#60a5fa] underline" onClick={() => setShowProblems(v => !v)}>
                        {t('songRequest.importExt.problems', { count: job.problems.length })}
                    </button>
                    {showProblems && (
                        <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-[#e2e8f0] dark:divide-[#374151] text-xs 3xl:text-sm">
                            {job.problems.map((p, i) => (
                                <li key={i} className="flex items-center justify-between gap-3 py-1.5">
                                    <a href={p.url ?? undefined} target="_blank" rel="noopener noreferrer" className="truncate text-[#1e293b] dark:text-[#f8fafc] hover:underline">{p.artist} — {p.title}</a>
                                    <span className="shrink-0 text-[#94a3b8]">{t(`songRequest.importExt.reasons.${p.reason ?? 'no_match'}`, { defaultValue: t('songRequest.importExt.reasons.no_match') })}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

/** Quién puede agregar a la playlist y qué tiene que cumplir un viewer (fase 2). */
function ContributionCard({ playlist, onUpdate }: { playlist: Playlist; onUpdate: (changes: Partial<Pick<Playlist, PlaylistChangeKeys>>) => void }) {
    const { t } = useTranslation('overlays');
    const [draft, setDraft] = useState<PlaylistRequirements>(playlist.requirements);
    const dirty = JSON.stringify(draft) !== JSON.stringify(playlist.requirements);
    const set = (patch: Partial<PlaylistRequirements>) => setDraft(prev => ({ ...prev, ...patch }));
    const roleOptions = ROLES.filter(r => r !== 'broadcaster').map(r => ({ value: r as Role, label: t(`songRequest.roles.${r}`) }));
    const open = playlist.contribution !== 'owner';

    return (
        <Card title={t('songRequest.contrib.title')} description={t('songRequest.contrib.description')}>
            <div className="space-y-4">
                <Field label={t('songRequest.contrib.who')}>
                    <Select
                        value={playlist.contribution}
                        onChange={v => onUpdate({ contribution: v })}
                        options={[
                            { value: 'owner', label: t('songRequest.contrib.owner') },
                            { value: 'open', label: t('songRequest.contrib.open') },
                            { value: 'review', label: t('songRequest.contrib.review') },
                        ]}
                    />
                </Field>
                <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t(`songRequest.contrib.${playlist.contribution}Hint`, { name: playlist.name })}</p>
                {open && playlist.visibility !== 'public' && (
                    <p className="text-xs 3xl:text-sm text-amber-700 dark:text-amber-300">{t('songRequest.contrib.privateNote')}</p>
                )}

                {open && (
                    <div className="space-y-4 pt-2 border-t border-[#e2e8f0] dark:border-[#374151]">
                        <p className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc] pt-2">{t('songRequest.contrib.requirements')}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            <Field label={t('songRequest.contrib.minRole')} hint={t('songRequest.contrib.minRoleHint')}>
                                <Select value={draft.minRole} onChange={v => set({ minRole: v })} options={roleOptions} />
                            </Field>
                            <Field label={t('songRequest.contrib.accountAge')} hint={t('songRequest.contrib.twitchOnly')}>
                                <NumberInput value={draft.minAccountAgeDays} min={0} max={3650} onChange={v => set({ minAccountAgeDays: v })} />
                            </Field>
                            <Field label={t('songRequest.contrib.followAge')} hint={t('songRequest.contrib.twitchOnly')}>
                                <NumberInput value={draft.minFollowAgeDays} min={0} max={3650} onChange={v => set({ minFollowAgeDays: v })} />
                            </Field>
                            <Field label={t('songRequest.contrib.maxPerUser')} hint={t('songRequest.basic.zeroUnlimited')}>
                                <NumberInput value={draft.maxPerUser} min={0} max={1000} onChange={v => set({ maxPerUser: v })} />
                            </Field>
                            <Field label={t('songRequest.contrib.maxFromViewers')} hint={t('songRequest.contrib.maxFromViewersHint')}>
                                <NumberInput value={draft.maxFromViewers} min={0} max={100000} onChange={v => set({ maxFromViewers: v })} />
                            </Field>
                            <Field label={t('songRequest.contrib.cooldown')} hint={t('songRequest.basic.zeroUnlimited')}>
                                <NumberInput value={draft.cooldownMinutes} min={0} max={10080} onChange={v => set({ cooldownMinutes: v })} />
                            </Field>
                        </div>
                        <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('songRequest.contrib.alwaysApply')}</p>
                        <div className="flex flex-wrap gap-2">
                            <button className={primaryBtn} disabled={!dirty} onClick={() => onUpdate({ requirements: draft })}>
                                {t('songRequest.contrib.save')}
                            </button>
                            {dirty && (
                                <button className={smallBtn} onClick={() => setDraft(playlist.requirements)}>{t('songRequest.contrib.discard')}</button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}

/** Menú para mandar una canción del historial a cualquiera de las playlists. */
function AddToPlaylistMenu({ playlists, onPick }: { playlists: Playlist[]; onPick: (playlist: Playlist) => void }) {
    const { t } = useTranslation('overlays');
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button className={iconBtn} title={t('songRequest.history.toPlaylist')} onClick={() => setOpen(o => !o)}>
                <ListPlus className="w-4 h-4" />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 z-20 w-60 max-h-72 overflow-y-auto rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] shadow-xl p-1" onMouseLeave={() => setOpen(false)}>
                    {playlists.length === 0
                        ? <p className="px-3 py-2 text-sm 3xl:text-base text-[#94a3b8]">{t('songRequest.playlists.none')}</p>
                        : playlists.map(p => (
                            <button key={p.id} onClick={() => { setOpen(false); onPick(p); }} className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-lg text-sm 3xl:text-base text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]">
                                <span className="truncate">{p.name}</span>
                                <span className="text-xs 3xl:text-sm text-[#94a3b8] shrink-0">{p.count}</span>
                            </button>
                        ))}
                </div>
            )}
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
    const [historyDays, setHistoryDays] = useState<number | null>(null);
    const { playlists, reload: reloadPlaylists } = usePlaylists();

    const load = useCallback(async (p: number, favs: boolean, append: boolean) => {
        setLoading(true);
        try {
            const res = await api.get('/song-request/history', { params: { page: p, favorites: favs } });
            const data = res.data.data;
            setTotal(data.total);
            setHistoryDays(data.historyDays ?? null);
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
                {historyDays !== null && !favorites && <div className="mb-3"><PlanLimitNote text={t('songRequest.limits.history', { days: historyDays })} /></div>}
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
                                <AddToPlaylistMenu
                                    playlists={playlists ?? []}
                                    onPick={p => act(async () => {
                                        const res = await api.post(`/song-request/history/${item.id}/playlist/${p.id}`);
                                        reloadPlaylists();
                                        return res;
                                    }, t('songRequest.playlists.added', { name: p.name }))}
                                />
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
