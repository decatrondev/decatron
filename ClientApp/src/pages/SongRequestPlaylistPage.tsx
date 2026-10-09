import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as signalR from '@microsoft/signalr';
import api from '../services/api';
import { PlatformIcon } from './features/song-request-extension/components/PlatformIcon';
import { sourceName } from './features/song-request-extension/utils';
import { Notice, authHeaders, formatDuration, type QueueState } from './song-request-public/shared';
import { ContributeBox, useContributor, type PublicPlaylistItem } from './song-request-public/PlaylistPanel';
import { usePlaylistData } from './song-request-public/usePlaylistData';
import { ListenPlayerView, isPlayable, useListenPlayer } from './song-request-public/ListenPlayer';

// Una playlist del canal para escuchar con su enlace: /sr/:channelName/p/:code
// (SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 2). Pública o "solo con enlace"; una privada o inexistente responde 404.
// El reproductor es del viewer: no toca el stream. "Pedir al stream" es lo mismo que !sr de esa canción.

type Stream = Pick<QueueState, 'requestsOpen' | 'mode' | 'allowWebRequests'>;

export default function SongRequestPlaylistPage() {
    const { channelName = '', code = '' } = useParams<{ channelName: string; code: string }>();
    const { t } = useTranslation('commands');
    const channel = channelName.toLowerCase();
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [stream, setStream] = useState<Stream | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
    const [requesting, setRequesting] = useState<number | null>(null);
    const contributor = useContributor(channel);
    const { status, playlist, items, myVotes, vote, api: playlistApi, reload } = usePlaylistData(channel, code, refreshKey);
    const player = useListenPlayer(channel, code, items);
    const loginRedirect = `/sr/${channel}/p/${code}`;

    // Cabecera del canal
    useEffect(() => {
        let cancelled = false;
        api.get(`/public/song-request/${channel}`)
            .then(res => {
                if (cancelled) return;
                setDisplayName(res.data.displayName || channel);
                setAvatarUrl(res.data.avatarUrl || null);
                if (res.data.state) setStream(res.data.state);
            })
            .catch(() => { /* sin cabecera con el nombre del canal */ });
        return () => { cancelled = true; };
    }, [channel]);

    // En vivo: el modo del stream (si se puede pedir) y los cambios del streamer en la lista
    useEffect(() => {
        let timer: number | undefined;
        const connection = new signalR.HubConnectionBuilder()
            .withUrl('/hubs/songrequest')
            .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
            .configureLogging(signalR.LogLevel.None)
            .build();
        connection.on('SongRequestUpdated', (snapshot: QueueState) => { if (snapshot.enabled) setStream(snapshot); });
        // Varios cambios seguidos (una importación) se juntan en una sola recarga
        connection.on('SongRequestPlaylistsChanged', () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => setRefreshKey(k => k + 1), 800);
        });
        connection.onreconnected(async () => {
            await connection.invoke('Watch', channel).catch(() => undefined);
            setRefreshKey(k => k + 1);
        });
        connection.start().then(() => connection.invoke('Watch', channel)).catch(() => { /* la página sigue sirviendo sin el en vivo */ });
        return () => { window.clearTimeout(timer); connection.stop(); };
    }, [channel]);

    const canRequest = !!stream && stream.requestsOpen && stream.mode !== 'closed' && stream.allowWebRequests !== false;
    const hasPlayable = (items ?? []).some(isPlayable);

    useEffect(() => {
        if (!notice) return;
        const id = window.setTimeout(() => setNotice(null), 7000);
        return () => window.clearTimeout(id);
    }, [notice]);

    const castVote = async (itemId: number) => {
        if (!await vote(itemId, !!contributor)) window.location.href = `/login?redirect=${encodeURIComponent(loginRedirect)}`;
    };

    const requestToStream = useCallback(async (item: PublicPlaylistItem) => {
        if (!contributor) { window.location.href = `/login?redirect=${encodeURIComponent(loginRedirect)}`; return; }
        setRequesting(item.id);
        try {
            const r = await fetch(`${playlistApi}/items/${item.id}/request`, { method: 'POST', headers: authHeaders() });
            const d = r.ok ? await r.json() : null;
            if (d?.success) {
                setNotice({
                    ok: true,
                    text: d.pending
                        ? t('songRequestPublic.listen.requestPending', { title: d.title })
                        : t('songRequestPublic.listen.requested', { title: d.title, position: d.position }),
                });
            } else {
                const key = d?.error ?? 'failed';
                setNotice({ ok: false, text: String(t(`songRequestPublic.listen.errors.${key}`, { ...(d?.vars ?? {}), defaultValue: t('songRequestPublic.listen.errors.failed') })) });
            }
        } catch {
            setNotice({ ok: false, text: t('songRequestPublic.listen.errors.failed') });
        } finally { setRequesting(null); }
    }, [contributor, loginRedirect, playlistApi, t]);

    return (
        <div className="min-h-screen bg-pub-bg text-[#d4d4d8] relative overflow-x-hidden">
            <div
                className="pointer-events-none fixed inset-0 opacity-[0.04]"
                style={{
                    backgroundImage: 'linear-gradient(#3161d8 1px, transparent 1px), linear-gradient(90deg, #3161d8 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />
            <div className="sr-page relative max-w-3xl 3xl:max-w-5xl 4xl:max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 4xl:py-24">
                <header className="flex items-center gap-4 4xl:gap-6 mb-8 4xl:mb-12">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-14 h-14 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20 rounded-full border-2 border-pub-accent/40 shrink-0" />
                    ) : (
                        <div className="w-14 h-14 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20 rounded-full bg-pub-raised border-2 border-pub-border shrink-0" />
                    )}
                    <div className="min-w-0">
                        <p className="font-mono text-xs 3xl:text-sm 4xl:text-base uppercase tracking-widest text-pub-accent-hi/80">
                            {t('songRequestPublic.playlistPage.label', { channel: displayName || channelName })}
                        </p>
                        <h1 className="text-2xl sm:text-3xl 3xl:text-4xl 4xl:text-5xl font-black text-white break-words">
                            {playlist?.name ?? '…'}
                        </h1>
                    </div>
                </header>

                {status === 'loading' && <p className="font-mono text-sm 3xl:text-base text-[#71717a] animate-pulse">{t('songRequestPublic.loading')}</p>}
                {status === 'notfound' && <Notice text={t('songRequestPublic.playlistPage.notFound')} tone="error" />}
                {status === 'error' && <Notice text={t('songRequestPublic.error')} tone="error" />}

                {status === 'ok' && playlist && items && (
                    <>
                        <div className="flex flex-wrap items-center gap-2 mb-4 font-mono text-xs 3xl:text-sm 4xl:text-base">
                            <span className="text-[#71717a]">{t('songRequestPublic.songs', { count: items.length })}</span>
                            {playlist.isActive && <span className="px-1.5 py-0.5 rounded border border-amber-400/50 uppercase tracking-wider text-amber-300">▶ {t('songRequestPublic.playing')}</span>}
                            {!playlist.listed && <span className="px-1.5 py-0.5 rounded border border-pub-border uppercase tracking-wider text-[#a1a1aa]">{t('songRequestPublic.playlistPage.unlisted')}</span>}
                            <a href={`/sr/${channel}?tab=playlists`} className="ml-auto text-pub-accent-hi hover:underline">← {t('songRequestPublic.playlistPage.back')}</a>
                        </div>

                        <ListenPlayerView controller={player} hasPlayable={hasPlayable} />

                        {notice && (
                            <p role="status" className={`mb-4 px-4 py-3 rounded-lg border text-sm 3xl:text-base ${notice.ok ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-400' : 'border-red-500/30 bg-red-500/5 text-red-400'}`}>
                                {notice.text}
                            </p>
                        )}

                        <div className="border border-pub-border-soft rounded-lg pt-3">
                            {playlist.open && (
                                <ContributeBox channel={channel} playlist={{ ...playlist, id: 0 }} contributor={contributor} onAdded={reload} />
                            )}
                            {items.length === 0 ? (
                                <p className="px-4 pb-3 text-sm 3xl:text-base text-[#71717a]">{t('songRequestPublic.playlistEmpty')}</p>
                            ) : (
                                <ol className="divide-y divide-pub-border-soft border-t border-pub-border-soft">
                                    {items.map(item => {
                                        const blocked = player.blocked.has(item.track.trackId);
                                        const canPlay = isPlayable(item) && !blocked;
                                        const isNow = player.now?.id === item.id;
                                        return (
                                            <li key={item.id} className={`flex flex-wrap sm:flex-nowrap items-center ${isNow ? 'bg-pub-accent/[0.06] border-l-2 border-pub-accent' : 'border-l-2 border-transparent'}`}>
                                                <button
                                                    onClick={() => (canPlay ? player.play(item) : window.open(item.track.url ?? undefined, '_blank', 'noopener'))}
                                                    className="flex-1 min-w-0 flex items-center gap-3 4xl:gap-5 py-2 4xl:py-3 px-3 text-left hover:bg-pub-surface transition-colors"
                                                >
                                                    <span className="font-mono text-xs 3xl:text-sm 4xl:text-base text-[#52525b] w-9 4xl:w-12 text-right shrink-0">
                                                        {isNow && player.playing ? '▶' : `#${item.number}`}
                                                    </span>
                                                    {item.track.thumbnailUrl
                                                        ? <img src={item.track.thumbnailUrl} alt="" loading="lazy" className="w-16 h-9 3xl:w-20 3xl:h-[45px] 4xl:w-28 4xl:h-[63px] object-cover rounded shrink-0 bg-pub-raised" />
                                                        : <div className="w-16 h-9 3xl:w-20 3xl:h-[45px] 4xl:w-28 4xl:h-[63px] rounded shrink-0 bg-pub-raised" />}
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-sm 3xl:text-base 4xl:text-xl truncate ${isNow ? 'text-pub-accent-hi font-semibold' : 'text-white'}`}>{item.track.title}</p>
                                                        <p className="text-xs 3xl:text-sm 4xl:text-base text-[#71717a] truncate">
                                                            {item.track.artist}
                                                            {item.addedBy && (
                                                                <>
                                                                    <span className="text-[#3f3f46]"> · </span>
                                                                    <PlatformIcon platform={item.addedByPlatform ?? 'twitch'} className="w-3.5 h-3.5 3xl:w-4 3xl:h-4 4xl:w-5 4xl:h-5" />{' '}
                                                                    {t('songRequestPublic.addedBy', { user: item.addedBy })}
                                                                </>
                                                            )}
                                                            {!canPlay && (
                                                                <span className="ml-2 px-1.5 py-0.5 rounded border border-amber-400/40 text-amber-300 text-[10px] 3xl:text-xs uppercase tracking-wide">
                                                                    {t('songRequestPublic.listen.onlyOn', { source: sourceName(item.track.source) })} ↗
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <span className="font-mono text-xs 3xl:text-sm 4xl:text-base text-[#71717a] shrink-0">{formatDuration(item.track.durationSeconds)}</span>
                                                </button>
                                                <div className="flex items-center gap-2 pr-3 pb-2 sm:pb-0 ml-auto">
                                                    {canRequest && (
                                                        <button
                                                            onClick={() => requestToStream(item)}
                                                            disabled={requesting === item.id}
                                                            title={stream?.mode === 'review' ? t('songRequestPublic.listen.requestReviewHint') : t('songRequestPublic.listen.requestHint')}
                                                            className="shrink-0 px-2 py-1 rounded font-mono text-xs 3xl:text-sm 4xl:text-base border border-pub-border text-[#a1a1aa] hover:border-pub-accent/60 hover:text-pub-accent-hi disabled:opacity-50 transition-colors"
                                                        >
                                                            {requesting === item.id ? '…' : t('songRequestPublic.listen.request')}
                                                        </button>
                                                    )}
                                                    {playlist.votingEnabled && (
                                                        <button
                                                            onClick={() => castVote(item.id)}
                                                            title={contributor ? t('songRequestPublic.vote') : t('songRequestPublic.loginToVote')}
                                                            className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded font-mono text-xs 3xl:text-sm 4xl:text-base border transition-colors ${myVotes.has(item.id)
                                                                ? 'border-pub-accent text-pub-accent-hi bg-pub-accent/10'
                                                                : 'border-pub-border text-[#a1a1aa] hover:border-pub-accent/60'}`}
                                                        >
                                                            ▲ {item.votes}
                                                        </button>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}
                        </div>
                    </>
                )}

                <footer className="mt-16 pt-6 border-t border-pub-border font-mono text-xs 3xl:text-sm text-[#3f3f46] flex items-center justify-between flex-wrap gap-2">
                    <span>{t('songRequestPublic.footer')}</span>
                    <span className="text-pub-accent-hi/60">{window.location.host}</span>
                </footer>
            </div>
            <style>{`
                /* 4K sin escalado del sistema: el 4xl (2K) se queda chico, se agranda todo junto */
                @media (min-width: 3200px) { .sr-page { zoom: 1.6; } }
            `}</style>
        </div>
    );
}
