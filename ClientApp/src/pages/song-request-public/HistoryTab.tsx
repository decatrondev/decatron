import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlatformIcon } from '../features/song-request-extension/components/PlatformIcon';
import { formatDuration } from './shared';

interface HistoryRow {
    id: number;
    track: { url?: string | null; title?: string; artist?: string; durationSeconds?: number | null; thumbnailUrl?: string | null };
    requestedBy: string | null;
    platform: string | null;
    isFallback: boolean;
    originUrl: string | null;
    playedAt: string;
}

function formatWhen(iso: string, locale: string): string {
    // El servidor manda UTC sin zona: se interpreta como UTC
    const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
    return date.toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Lo que ya sonó en el stream: solo lectura (SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 1b). */
export default function HistoryTab({ channel, currentId }: { channel: string; currentId: number | null }) {
    const { t, i18n } = useTranslation('commands');
    const [rows, setRows] = useState<HistoryRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const base = `/api/public/song-request/${encodeURIComponent(channel.toLowerCase())}/history`;

    const load = useCallback(async (p: number, replace: boolean) => {
        setLoading(true);
        try {
            const r = await fetch(`${base}?page=${p}`);
            const d = r.ok ? await r.json() : null;
            if (!d?.success) { setFailed(true); return; }
            setFailed(false);
            setTotal(d.data.total);
            setPage(p);
            setRows(prev => (replace ? d.data.items : [...prev, ...d.data.items]));
        } catch { setFailed(true); }
        finally { setLoading(false); }
    }, [base]);

    // Cuando cambia lo que suena, lo anterior acaba de pasar al historial
    useEffect(() => { load(0, true); }, [load, currentId]);

    if (failed && rows.length === 0)
        return <p className="text-sm 3xl:text-base 4xl:text-lg text-red-400">{t('songRequestPublic.history.error')}</p>;
    if (loading && rows.length === 0)
        return <p className="font-mono text-sm 3xl:text-base text-[#71717a] animate-pulse">{t('songRequestPublic.loading')}</p>;
    if (rows.length === 0)
        return <p className="text-sm 3xl:text-base 4xl:text-lg text-[#71717a]">{t('songRequestPublic.history.empty')}</p>;

    return (
        <div>
            <p className="mb-3 font-mono text-xs 3xl:text-sm 4xl:text-base text-[#71717a]">{t('songRequestPublic.history.count', { count: total })}</p>
            <ol className="divide-y divide-[#1f1f23] border-y border-[#1f1f23]">
                {rows.map(row => (
                    <li key={row.id}>
                        <a
                            href={row.originUrl ?? row.track.url ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 4xl:gap-5 py-3 4xl:py-4 px-2 -mx-2 rounded hover:bg-[#111114] transition-colors"
                        >
                            {row.track.thumbnailUrl ? (
                                <img src={row.track.thumbnailUrl} alt="" loading="lazy" className="w-20 h-[45px] 3xl:w-24 3xl:h-[54px] 4xl:w-32 4xl:h-[72px] object-cover rounded shrink-0 bg-[#18181b]" />
                            ) : (
                                <div className="w-20 h-[45px] 3xl:w-24 3xl:h-[54px] 4xl:w-32 4xl:h-[72px] rounded shrink-0 bg-[#18181b]" />
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="text-white font-semibold text-sm 3xl:text-base 4xl:text-xl truncate">{row.track.title}</p>
                                <p className="text-xs 3xl:text-sm 4xl:text-base text-[#71717a] truncate">
                                    {row.track.artist}
                                    <span className="text-[#3f3f46]"> · </span>
                                    {row.isFallback ? t('songRequestPublic.fromPlaylist') : (
                                        <>
                                            <PlatformIcon platform={row.platform ?? 'twitch'} className="w-3.5 h-3.5 3xl:w-4 3xl:h-4 4xl:w-5 4xl:h-5" />{' '}
                                            {t('songRequestPublic.requestedBy', { user: row.requestedBy })}
                                        </>
                                    )}
                                </p>
                                <p className="sm:hidden font-mono text-xs text-[#52525b] truncate">
                                    {formatWhen(row.playedAt, i18n.language)}
                                    {row.track.durationSeconds ? ` · ${formatDuration(row.track.durationSeconds)}` : ''}
                                </p>
                            </div>
                            <div className="hidden sm:block text-right shrink-0 font-mono text-xs 3xl:text-sm 4xl:text-base text-[#71717a]">
                                <p>{formatWhen(row.playedAt, i18n.language)}</p>
                                <p className="text-[#52525b]">{formatDuration(row.track.durationSeconds)}</p>
                            </div>
                        </a>
                    </li>
                ))}
            </ol>
            {rows.length < total && (
                <button
                    disabled={loading}
                    onClick={() => load(page + 1, false)}
                    className="mt-4 w-full py-2.5 rounded border border-[#27272a] font-mono text-xs 3xl:text-sm 4xl:text-base text-[#a1a1aa] hover:border-[#39ff14]/60 hover:text-white disabled:opacity-50 transition-colors"
                >
                    {loading ? t('songRequestPublic.loading') : t('songRequestPublic.history.more')}
                </button>
            )}
        </div>
    );
}
