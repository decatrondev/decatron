import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ExternalLink } from 'lucide-react';
import api from '../../../../../services/api';
import { Card, Field, Select } from '../ui';

// Quién escucha las playlists (SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, etapa 3, fase 4): anónimo, sin IP ni cuentas.

interface TrackInfo { trackId: number; title: string; artist: string; thumbnailUrl: string | null; url: string | null }
interface Stats {
    found: boolean;
    days: number;
    listeningNow: number;
    totals: { listeners: number; listens: number; seconds: number; webRequests: number };
    series: { day: string; listens: number; seconds: number; listeners: number }[];
    playlists: { id: number; name: string; visibility: string; listeningNow: number; listeners: number; listens: number; seconds: number; webRequests: number }[];
    topTracks: { track: TrackInfo; listens: number; streamPlays: number }[];
    unplayable: { playlistId: number; playlistName: string | null; track: TrackInfo; reports: number; lastReported: string }[];
}

type Metric = 'listens' | 'listeners' | 'minutes';

/** 3725 s → "1 h 2 min"; menos de una hora → "12 min". */
function formatListened(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

const cardBorder = 'border border-ds-border ';

export function StatsTab() {
    const { t, i18n } = useTranslation('overlays');
    const [days, setDays] = useState(30);
    const [playlistId, setPlaylistId] = useState('');
    const [metric, setMetric] = useState<Metric>('listens');
    const [stats, setStats] = useState<Stats | null>(null);
    const [error, setError] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/song-request/stats', { params: { days, playlistId: playlistId || undefined } });
            if (res.data?.success) { setStats(res.data.stats); setError(false); }
        } catch { setError(true); }
    }, [days, playlistId]);

    useEffect(() => { setStats(null); load(); }, [load]);
    // "Escuchando ahora" cambia solo
    useEffect(() => {
        const id = window.setInterval(load, 20000);
        return () => window.clearInterval(id);
    }, [load]);

    if (error && !stats) return <p className="text-sm 3xl:text-base text-ds-danger">{t('songRequest.stats.error')}</p>;
    if (!stats) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-ds-soft" /></div>;
    if (!stats.found) return <p className="text-sm 3xl:text-base text-ds-soft">{t('songRequest.stats.notFound')}</p>;

    const value = (d: Stats['series'][number]) => (metric === 'listens' ? d.listens : metric === 'listeners' ? d.listeners : Math.round(d.seconds / 60));
    const max = Math.max(1, ...stats.series.map(value));
    const empty = stats.totals.listens === 0 && stats.totals.seconds === 0 && stats.totals.listeners === 0;
    const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', timeZone: 'UTC' });

    const tile = (label: string, value: string | number, hint?: string, live = false) => (
        <div className={`rounded-lg ${cardBorder} bg-ds-surface p-4 3xl:p-5`}>
            <p className="text-xs 3xl:text-sm font-semibold uppercase tracking-wide text-ds-soft flex items-center gap-1.5">
                {live && <span className={`w-2 h-2 rounded-full ${stats.listeningNow > 0 ? 'bg-ds-accent animate-pulse' : 'bg-ds-faint'}`} />}
                {label}
            </p>
            <p className="mt-1 text-2xl 3xl:text-3xl font-black text-ds-text">{value}</p>
            {hint && <p className="mt-0.5 text-xs 3xl:text-sm text-ds-soft">{hint}</p>}
        </div>
    );

    return (
        <div className="space-y-6">
            <Card title={t('songRequest.stats.title')} description={t('songRequest.stats.description')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                    <Field label={t('songRequest.stats.range')}>
                        <Select value={String(days)} onChange={v => setDays(Number(v))} options={[7, 30, 90].map(d => ({ value: String(d), label: t('songRequest.stats.lastDays', { count: d }) }))} />
                    </Field>
                    <Field label={t('songRequest.stats.playlist')}>
                        <Select
                            value={playlistId}
                            onChange={v => setPlaylistId(v)}
                            options={[{ value: '', label: t('songRequest.stats.allPlaylists') }, ...stats.playlists.map(p => ({ value: String(p.id), label: p.name }))]}
                        />
                    </Field>
                </div>
            </Card>

            <div className="grid grid-cols-2 lg:grid-cols-3 4xl:grid-cols-5 gap-3 3xl:gap-4">
                {tile(t('songRequest.stats.now'), stats.listeningNow, t('songRequest.stats.nowHint'), true)}
                {tile(t('songRequest.stats.listeners'), stats.totals.listeners, t('songRequest.stats.listenersHint'))}
                {tile(t('songRequest.stats.listens'), stats.totals.listens, t('songRequest.stats.listensHint'))}
                {tile(t('songRequest.stats.time'), formatListened(stats.totals.seconds))}
                {tile(t('songRequest.stats.webRequests'), stats.totals.webRequests, t('songRequest.stats.webRequestsHint'))}
            </div>

            {empty && <p className="text-sm 3xl:text-base text-ds-soft">{t('songRequest.stats.empty')}</p>}

            <Card
                title={t('songRequest.stats.perDay')}
                actions={
                    <div className="flex gap-1">
                        {(['listens', 'listeners', 'minutes'] as Metric[]).map(m => (
                            <button
                                key={m}
                                onClick={() => setMetric(m)}
                                className={`px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors ${metric === m ? 'bg-ds-accent text-ds-on-accent' : 'bg-ds-raised text-ds-soft hover:bg-ds-raised '}`}
                            >
                                {t(`songRequest.stats.metric.${m}`)}
                            </button>
                        ))}
                    </div>
                }
            >
                <div className="flex items-end gap-px sm:gap-0.5 h-44 3xl:h-56" role="img" aria-label={t('songRequest.stats.perDay')}>
                    {stats.series.map(d => {
                        const v = value(d);
                        return (
                            <div key={d.day} className="flex-1 min-w-0 h-full flex items-end group relative" title={`${dayLabel(d.day)}: ${v}`}>
                                <div
                                    className={`w-full rounded-t ${v > 0 ? 'bg-ds-accent group-hover:bg-ds-accent-hover' : 'bg-ds-raised '}`}
                                    style={{ height: v > 0 ? `${Math.max(4, (v / max) * 100)}%` : '2px' }}
                                />
                            </div>
                        );
                    })}
                </div>
                <div className="mt-2 flex justify-between text-xs 3xl:text-sm text-ds-soft">
                    <span>{dayLabel(stats.series[0].day)}</span>
                    <span>{t('songRequest.stats.utcNote')}</span>
                    <span>{dayLabel(stats.series[stats.series.length - 1].day)}</span>
                </div>
            </Card>

            {!playlistId && stats.playlists.length > 0 && (
                <Card title={t('songRequest.stats.byPlaylist')}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm 3xl:text-base">
                            <thead>
                                <tr className="text-left text-xs 3xl:text-sm uppercase tracking-wide text-ds-soft">
                                    <th className="py-2 pr-4">{t('songRequest.stats.playlist')}</th>
                                    <th className="py-2 pr-4 text-right">{t('songRequest.stats.now')}</th>
                                    <th className="py-2 pr-4 text-right">{t('songRequest.stats.listeners')}</th>
                                    <th className="py-2 pr-4 text-right">{t('songRequest.stats.listens')}</th>
                                    <th className="py-2 pr-4 text-right">{t('songRequest.stats.time')}</th>
                                    <th className="py-2 text-right">{t('songRequest.stats.webRequests')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ds-border text-ds-text">
                                {stats.playlists.map(p => (
                                    <tr key={p.id}>
                                        <td className="py-2 pr-4 font-semibold">{p.name}</td>
                                        <td className="py-2 pr-4 text-right">{p.listeningNow}</td>
                                        <td className="py-2 pr-4 text-right">{p.listeners}</td>
                                        <td className="py-2 pr-4 text-right">{p.listens}</td>
                                        <td className="py-2 pr-4 text-right whitespace-nowrap">{formatListened(p.seconds)}</td>
                                        <td className="py-2 text-right">{p.webRequests}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Card title={t('songRequest.stats.topTracks')} description={t('songRequest.stats.topTracksHint')}>
                {stats.topTracks.length === 0 ? (
                    <p className="text-sm 3xl:text-base text-ds-soft">{t('songRequest.stats.noTracks')}</p>
                ) : (
                    <ol className="divide-y divide-ds-border">
                        {stats.topTracks.map((row, i) => (
                            <li key={row.track.trackId} className="flex items-center gap-3 py-2.5">
                                <span className="w-6 text-right text-sm 3xl:text-base font-bold text-ds-soft">{i + 1}</span>
                                {row.track.thumbnailUrl
                                    ? <img src={row.track.thumbnailUrl} alt="" loading="lazy" className="w-16 h-9 3xl:w-20 3xl:h-[45px] object-cover rounded bg-ds-raised shrink-0" />
                                    : <div className="w-16 h-9 3xl:w-20 3xl:h-[45px] rounded bg-ds-raised shrink-0" />}
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm 3xl:text-base text-ds-text truncate">{row.track.title}</p>
                                    <p className="text-xs 3xl:text-sm text-ds-soft truncate">{row.track.artist}</p>
                                </div>
                                <div className="text-right shrink-0 text-xs 3xl:text-sm">
                                    <p className="font-bold text-ds-text">{t('songRequest.stats.listensCount', { count: row.listens })}</p>
                                    <p className="text-ds-soft">{t('songRequest.stats.streamPlays', { count: row.streamPlays })}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </Card>

            <Card title={t('songRequest.stats.unplayable')} description={t('songRequest.stats.unplayableHint')}>
                {stats.unplayable.length === 0 ? (
                    <p className="text-sm 3xl:text-base text-ds-soft">{t('songRequest.stats.noUnplayable')}</p>
                ) : (
                    <ul className="divide-y divide-ds-border">
                        {stats.unplayable.map(row => (
                            <li key={`${row.playlistId}-${row.track.trackId}`} className="flex items-center gap-3 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm 3xl:text-base text-ds-text truncate">{row.track.title}</p>
                                    <p className="text-xs 3xl:text-sm text-ds-soft truncate">{row.track.artist} · {row.playlistName}</p>
                                </div>
                                <span className="shrink-0 text-xs 3xl:text-sm text-ds-soft">{t('songRequest.stats.reports', { count: row.reports })}</span>
                                {row.track.url && (
                                    <a href={row.track.url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-2 rounded-lg text-ds-soft hover:bg-ds-raised" title={t('songRequest.stats.openOnYoutube')}>
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <p className="text-xs 3xl:text-sm text-ds-soft">{t('songRequest.stats.privacy')}</p>
        </div>
    );
}
