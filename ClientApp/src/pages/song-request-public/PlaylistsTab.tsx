import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlaylistPanel, type PublicPlaylist } from './PlaylistPanel';

/** Las playlists que el streamer marcó como públicas; cada una abre su panel (SONG_REQUEST_PLAYLISTS_PLAN.md). */
export default function PlaylistsTab({ channel, activePlaylistId }: { channel: string; activePlaylistId?: number | null }) {
    const { t } = useTranslation('commands');
    const [playlists, setPlaylists] = useState<PublicPlaylist[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [openId, setOpenId] = useState<number | null>(null);
    const base = `/api/public/song-request/${encodeURIComponent(channel)}`;

    const loadPlaylists = useCallback(() => {
        fetch(`${base}/playlists`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => setPlaylists(d?.playlists ?? []))
            .finally(() => setLoaded(true))
            .catch(() => { /* sin playlists públicas */ });
    }, [base]);
    // Cuando cambia la que suena se recarga: cambian "Sonando" y a cuál cuenta !sr #n
    useEffect(loadPlaylists, [loadPlaylists, activePlaylistId]);

    // "Los números son los de «X»" en la guía lleva a #playlist-{id}: se abre sola
    useEffect(() => {
        const openFromHash = () => {
            const match = /^#playlist-(\d+)$/.exec(window.location.hash);
            const id = match ? Number(match[1]) : null;
            if (id != null && playlists.some(p => p.id === id)) setOpenId(id);
        };
        openFromHash();
        window.addEventListener('hashchange', openFromHash);
        return () => window.removeEventListener('hashchange', openFromHash);
    }, [playlists]);

    if (!loaded) return <p className="font-mono text-sm 3xl:text-base text-[#71717a] animate-pulse">{t('songRequestPublic.loading')}</p>;
    if (playlists.length === 0) return <p className="text-sm 3xl:text-base 4xl:text-lg text-[#71717a]">{t('songRequestPublic.noPlaylists')}</p>;
    return (
        <div className="space-y-2">
            {playlists.map(p => (
                <div key={p.id} id={`playlist-${p.id}`} className="border border-pub-border-soft rounded-lg scroll-mt-6">
                    <button onClick={() => setOpenId(prev => (prev === p.id ? null : p.id))} className="w-full flex items-center justify-between gap-3 px-4 py-3 4xl:py-4 text-left hover:bg-pub-surface rounded-lg transition-colors">
                        <span className="flex items-center gap-2 min-w-0">
                            <span className="text-white font-semibold text-sm 3xl:text-base 4xl:text-xl truncate">{p.name}</span>
                            {p.isActive && <span className="shrink-0 px-1.5 py-0.5 rounded border border-amber-400/50 font-mono text-[10px] 3xl:text-xs 4xl:text-sm uppercase tracking-wider text-amber-300">▶ {t('songRequestPublic.playing')}</span>}
                            {p.open && <span className="shrink-0 px-1.5 py-0.5 rounded border border-pub-accent/40 font-mono text-[10px] 3xl:text-xs 4xl:text-sm uppercase tracking-wider text-pub-accent-hi">{t('songRequestPublic.collaborative')}</span>}
                        </span>
                        <span className="font-mono text-xs 3xl:text-sm 4xl:text-base text-[#71717a] shrink-0">
                            {t('songRequestPublic.songs', { count: p.count })} {openId === p.id ? '▴' : '▾'}
                        </span>
                    </button>
                    {openId === p.id && (
                        <>
                            <PlaylistPanel channel={channel} playlist={p} loginRedirect={`/sr/${channel}?tab=playlists`} onChanged={loadPlaylists} />
                            <a
                                href={`/sr/${channel}/p/${p.code}`}
                                className="block px-4 py-2.5 border-t border-pub-border-soft font-mono text-xs 3xl:text-sm 4xl:text-base text-pub-accent-hi hover:underline"
                            >
                                {t('songRequestPublic.openPlaylistPage')} →
                            </a>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}
