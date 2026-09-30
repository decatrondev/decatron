import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Ban, ShieldCheck, Trash2, Loader2, Plus, ChevronDown } from 'lucide-react';
import api from '../../../../../services/api';
import { Card, Toggle, inputClass } from '../ui';
import { formatDuration } from '../../utils';
import { PlatformIcon } from '../PlatformIcon';
import type { QueueSnapshot } from '../../types';
import type { SongRequestConfigState } from '../../hooks/useSongRequestConfig';

// Bandeja de pendientes y viewers de confianza (.dev/plans/SONG_REQUEST_PLAYLISTS_PLAN.md, fase 3).

interface PendingItem {
    id: number;
    number: number;
    playlistId: number | null;
    playlistName: string | null;
    title: string;
    artist: string;
    url: string | null;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
    requestedBy: string;
    platform: string;
    trusted: boolean;
    createdAt: string;
}

interface TrustedUser { id: number; platform: string; login: string; displayName: string; createdBy: string | null; createdAt: string }

type Decision = 'approve' | 'reject' | 'reject_silent' | 'ban' | 'trust';

const iconBtn = 'p-2 rounded-lg transition-colors disabled:opacity-40';
const smallBtn = 'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors disabled:opacity-50';
const primaryBtn = 'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white disabled:opacity-50 shrink-0';

export default function ReviewTab({ cfg, snapshot }: { cfg: SongRequestConfigState; snapshot: QueueSnapshot | null }) {
    const { t } = useTranslation('overlays');
    const [items, setItems] = useState<PendingItem[] | null>(null);
    const [trusted, setTrusted] = useState<TrustedUser[]>([]);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/song-request/pending');
            setItems(res.data.items ?? []);
            setTrusted(res.data.trusted ?? []);
        } catch { setItems([]); }
    }, []);
    // La bandeja se recarga sola cuando cambia la cantidad (llega por el hub de la cola)
    const pendingCount = snapshot?.pendingCount;
    useEffect(() => { load(); }, [load, pendingCount]);

    const decide = async (item: PendingItem, action: Decision) => {
        if (action === 'ban' && !window.confirm(t('songRequest.review.banConfirm', { user: item.requestedBy }))) return;
        setBusyId(item.id); setMessage(null);
        try {
            const res = await api.post(`/song-request/pending/${item.id}`, { action });
            const error = res.data.error as string | null;
            // Ya estaba en la cola o en la playlist: igual sale de la bandeja
            if (error && error !== 'already_queued' && error !== 'already_in_playlist')
                setMessage({ ok: false, text: t(`songRequest.errors.${error}`, { defaultValue: t('songRequest.errors.failed') }) });
            else
                setMessage({ ok: true, text: t(`songRequest.review.done.${action}`, { title: item.title, user: item.requestedBy, playlist: item.playlistName }) });
        } catch {
            setMessage({ ok: false, text: t('songRequest.errors.failed') });
        } finally {
            setBusyId(null);
            load();
        }
    };

    return (
        <div className="space-y-6">
            <Card title={t('songRequest.review.modeTitle')} description={t('songRequest.review.modeDescription')}>
                <div className="space-y-3">
                    <Toggle
                        checked={cfg.settings.requestReview}
                        onChange={v => cfg.updateSettings({ requestReview: v })}
                        label={t('songRequest.review.requestReview')}
                        hint={t('songRequest.review.requestReviewHint', { role: t(`songRequest.roles.${cfg.settings.permissions.review}`) })}
                    />
                    <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('songRequest.review.playlistsNote')}</p>
                </div>
            </Card>

            <Card title={t('songRequest.review.inboxTitle', { count: items?.length ?? 0 })} description={t('songRequest.review.inboxDescription')}>
                {message && <p className={`text-sm 3xl:text-base mb-3 ${message.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{message.text}</p>}
                {items === null ? <Loader2 className="w-5 h-5 animate-spin text-[#94a3b8]" />
                    : items.length === 0 ? <p className="text-sm 3xl:text-base text-[#94a3b8]">{t('songRequest.review.empty')}</p>
                        : (
                            <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                                {items.map(item => (
                                    <div key={item.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-3">
                                        <span className="w-6 text-right font-mono text-xs 3xl:text-sm text-[#94a3b8] shrink-0">{item.number}</span>
                                        {item.thumbnailUrl
                                            ? <img src={item.thumbnailUrl} alt="" loading="lazy" className="w-16 h-9 3xl:w-20 3xl:h-[45px] object-cover rounded shrink-0" />
                                            : <div className="w-16 h-9 3xl:w-20 3xl:h-[45px] rounded bg-[#e2e8f0] dark:bg-[#262626] shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                            <a href={item.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block text-sm 3xl:text-base font-semibold text-[#1e293b] dark:text-[#f8fafc] truncate hover:underline">{item.title}</a>
                                            <p className="text-xs 3xl:text-sm text-[#64748b] dark:text-[#94a3b8] truncate">
                                                {item.artist} · {formatDuration(item.durationSeconds)} · <PlatformIcon platform={item.platform} /> {item.requestedBy}
                                            </p>
                                            <p className="text-[11px] 3xl:text-xs font-bold text-[#2563eb] dark:text-[#60a5fa] truncate">
                                                {item.playlistName ? t('songRequest.review.toPlaylist', { name: item.playlistName }) : t('songRequest.review.toQueue')}
                                                <span className="font-normal text-[#94a3b8]"> · {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 ml-auto">
                                            <button
                                                className={`${iconBtn} bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50`}
                                                title={t('songRequest.review.approve')}
                                                disabled={busyId === item.id}
                                                onClick={() => decide(item, 'approve')}
                                            >
                                                {busyId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            </button>
                                            <RejectMenu disabled={busyId === item.id} onPick={action => decide(item, action)} />
                                            {!item.trusted && (
                                                <button
                                                    className={`${iconBtn} text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626] hover:text-[#2563eb]`}
                                                    title={t('songRequest.review.trust', { user: item.requestedBy })}
                                                    disabled={busyId === item.id}
                                                    onClick={() => decide(item, 'trust')}
                                                >
                                                    <ShieldCheck className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                className={`${iconBtn} text-[#64748b] dark:text-[#94a3b8] hover:bg-[#fef2f2] dark:hover:bg-red-900/20 hover:text-red-600`}
                                                title={t('songRequest.review.ban', { user: item.requestedBy })}
                                                disabled={busyId === item.id}
                                                onClick={() => decide(item, 'ban')}
                                            >
                                                <Ban className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
            </Card>

            <TrustedCard trusted={trusted} platforms={cfg.server?.platforms ?? ['twitch']} onChanged={load} />
        </div>
    );
}

function RejectMenu({ disabled, onPick }: { disabled: boolean; onPick: (action: 'reject' | 'reject_silent') => void }) {
    const { t } = useTranslation('overlays');
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                className={`${iconBtn} flex items-center bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40`}
                title={t('songRequest.review.reject')}
                disabled={disabled}
                onClick={() => setOpen(o => !o)}
            >
                <X className="w-4 h-4" /><ChevronDown className="w-3 h-3" />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 z-20 w-64 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] shadow-xl p-1" onMouseLeave={() => setOpen(false)}>
                    {(['reject', 'reject_silent'] as const).map(action => (
                        <button key={action} onClick={() => { setOpen(false); onPick(action); }} className="w-full text-left px-3 py-2 rounded-lg text-sm 3xl:text-base text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#fef2f2] dark:hover:bg-red-900/20">
                            {t(`songRequest.review.rejectOptions.${action}`)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function TrustedCard({ trusted, platforms, onChanged }: { trusted: TrustedUser[]; platforms: string[]; onChanged: () => void }) {
    const { t } = useTranslation('overlays');
    const [login, setLogin] = useState('');
    const [platform, setPlatform] = useState(platforms[0] ?? 'twitch');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const add = async () => {
        if (!login.trim()) return;
        setBusy(true); setError(null);
        try {
            const res = await api.post('/song-request/trusted', { platform, login: login.trim() });
            if (res.data.success) { setLogin(''); onChanged(); }
            else setError(t(`songRequest.errors.${res.data.error}`, { defaultValue: t('songRequest.errors.failed') }));
        } catch { setError(t('songRequest.errors.failed')); }
        finally { setBusy(false); }
    };

    return (
        <Card title={t('songRequest.review.trustedTitle', { count: trusted.length })} description={t('songRequest.review.trustedDescription')}>
            <form className="flex flex-col sm:flex-row gap-2" onSubmit={e => { e.preventDefault(); add(); }}>
                {platforms.length > 1 && (
                    <select className={`${inputClass} sm:w-32`} value={platform} onChange={e => setPlatform(e.target.value)}>
                        {platforms.map(p => <option key={p} value={p}>{p === 'kick' ? 'Kick' : 'Twitch'}</option>)}
                    </select>
                )}
                <input value={login} onChange={e => setLogin(e.target.value)} placeholder={t('songRequest.review.trustedPlaceholder')} className={inputClass} maxLength={100} />
                <button type="submit" disabled={busy || !login.trim()} className={primaryBtn}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t('songRequest.review.trustedAdd')}
                </button>
            </form>
            {error && <p className="text-sm 3xl:text-base mt-2 text-red-600 dark:text-red-400">{error}</p>}
            {trusted.length === 0 ? (
                <p className="text-sm 3xl:text-base text-[#94a3b8] mt-3">{t('songRequest.review.trustedEmpty')}</p>
            ) : (
                <div className="mt-4 divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                    {trusted.map(u => (
                        <div key={u.id} className="flex items-center gap-3 py-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm 3xl:text-base font-semibold text-[#1e293b] dark:text-[#f8fafc] truncate"><PlatformIcon platform={u.platform} /> {u.displayName}</p>
                                {u.createdBy && <p className="text-xs 3xl:text-sm text-[#94a3b8] truncate">{t('songRequest.blacklist.by', { user: u.createdBy })} · {new Date(u.createdAt).toLocaleDateString()}</p>}
                            </div>
                            <button className={smallBtn} onClick={async () => { await api.delete(`/song-request/trusted/${u.id}`); onChanged(); }}>
                                <Trash2 className="w-4 h-4" /> {t('songRequest.review.trustedRemove')}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
