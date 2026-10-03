import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Notice } from './song-request-public/shared';
import { PlaylistPanel, type PublicPlaylist } from './song-request-public/PlaylistPanel';

// Una playlist del canal para escuchar o mirar con su enlace: /sr/:channelName/p/:code
// (SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 1; el reproductor propio del viewer llega en la fase 2).
// Pública o "solo con enlace"; una privada o inexistente responde igual (404).

interface SharedPlaylist extends Omit<PublicPlaylist, 'id'> { listed: boolean }
type Status = 'loading' | 'ok' | 'notfound' | 'error';

export default function SongRequestPlaylistPage() {
    const { channelName = '', code = '' } = useParams<{ channelName: string; code: string }>();
    const { t } = useTranslation('commands');
    const [status, setStatus] = useState<Status>('loading');
    const [playlist, setPlaylist] = useState<SharedPlaylist | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const channel = channelName.toLowerCase();

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/public/song-request/${encodeURIComponent(channel)}/playlists/${encodeURIComponent(code)}`)
            .then(async r => {
                if (cancelled) return;
                if (r.status === 404) { setStatus('notfound'); return; }
                const d = r.ok ? await r.json() : null;
                if (!d?.shared) { setStatus('error'); return; }
                setPlaylist(d.shared.playlist);
                setStatus('ok');
            })
            .catch(() => { if (!cancelled) setStatus('error'); });
        api.get(`/public/song-request/${channel}`)
            .then(res => { if (!cancelled) { setDisplayName(res.data.displayName || channel); setAvatarUrl(res.data.avatarUrl || null); } })
            .catch(() => { /* sin cabecera con el nombre del canal */ });
        return () => { cancelled = true; };
    }, [channel, code]);

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-[#d4d4d8] relative overflow-x-hidden">
            <div
                className="pointer-events-none fixed inset-0 opacity-[0.04]"
                style={{
                    backgroundImage: 'linear-gradient(#39ff14 1px, transparent 1px), linear-gradient(90deg, #39ff14 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />
            <div className="sr-page relative max-w-3xl 3xl:max-w-5xl 4xl:max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 4xl:py-24">
                <header className="flex items-center gap-4 4xl:gap-6 mb-8 4xl:mb-12">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-14 h-14 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20 rounded-full border-2 border-[#39ff14]/40 shrink-0" />
                    ) : (
                        <div className="w-14 h-14 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20 rounded-full bg-[#18181b] border-2 border-[#27272a] shrink-0" />
                    )}
                    <div className="min-w-0">
                        <p className="font-mono text-xs 3xl:text-sm 4xl:text-base uppercase tracking-widest text-[#39ff14]/80">
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

                {status === 'ok' && playlist && (
                    <>
                        <div className="flex flex-wrap items-center gap-2 mb-6 4xl:mb-8 font-mono text-xs 3xl:text-sm 4xl:text-base">
                            <span className="text-[#71717a]">{t('songRequestPublic.songs', { count: playlist.count })}</span>
                            {playlist.isActive && <span className="px-1.5 py-0.5 rounded border border-amber-400/50 uppercase tracking-wider text-amber-300">▶ {t('songRequestPublic.playing')}</span>}
                            {!playlist.listed && <span className="px-1.5 py-0.5 rounded border border-[#27272a] uppercase tracking-wider text-[#a1a1aa]">{t('songRequestPublic.playlistPage.unlisted')}</span>}
                            <a href={`/sr/${channel}?tab=playlists`} className="ml-auto text-[#39ff14] hover:underline">← {t('songRequestPublic.playlistPage.back')}</a>
                        </div>
                        <div className="border border-[#1f1f23] rounded-lg pt-3">
                            <PlaylistPanel
                                channel={channel}
                                playlist={{ ...playlist, id: 0 }}
                                loginRedirect={`/sr/${channel}/p/${code}`}
                                listMaxHeight={false}
                            />
                        </div>
                    </>
                )}

                <footer className="mt-16 pt-6 border-t border-[#27272a] font-mono text-xs 3xl:text-sm text-[#3f3f46] flex items-center justify-between flex-wrap gap-2">
                    <span>{t('songRequestPublic.footer')}</span>
                    <span className="text-[#39ff14]/60">{window.location.host}</span>
                </footer>
            </div>
            <style>{`
                /* 4K sin escalado del sistema: el 4xl (2K) se queda chico, se agranda todo junto */
                @media (min-width: 3200px) { .sr-page { zoom: 1.6; } }
            `}</style>
        </div>
    );
}
