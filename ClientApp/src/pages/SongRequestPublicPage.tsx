import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as signalR from '@microsoft/signalr';
import api from '../services/api';
import { Chip, Notice, type QueueState } from './song-request-public/shared';
import StreamTab from './song-request-public/StreamTab';
import GuideTab from './song-request-public/GuideTab';
import PlaylistsTab from './song-request-public/PlaylistsTab';
import HistoryTab from './song-request-public/HistoryTab';

// Vista pública de song request: /sr/:channelName (.dev/plans/SONG_REQUEST_PLAN.md, fase 1).
// Cabecera fija + pestañas (SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 1b). Una sola conexión a
// /hubs/songrequest (grupo sr_{canal}) alimenta todas las pestañas.

type Status = 'loading' | 'ok' | 'disabled' | 'notfound' | 'error';
const TABS = ['stream', 'guide', 'playlists', 'history'] as const;
type Tab = typeof TABS[number];

export default function SongRequestPublicPage() {
    const { channelName = '' } = useParams<{ channelName: string }>();
    const { t } = useTranslation('commands');
    const [searchParams, setSearchParams] = useSearchParams();
    const [status, setStatus] = useState<Status>('loading');
    const [state, setState] = useState<QueueState | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);

    const requested = searchParams.get('tab');
    const tab: Tab = (TABS as readonly string[]).includes(requested ?? '') ? (requested as Tab) : 'stream';
    const setTab = (next: Tab) => {
        setSearchParams(prev => {
            const params = new URLSearchParams(prev);
            if (next === 'stream') params.delete('tab'); else params.set('tab', next);
            return params;
        }, { replace: true });
    };

    // Los enlaces #playlist-{id} (de la guía) abren la pestaña Playlists
    useEffect(() => {
        const fromHash = () => { if (/^#playlist-\d+$/.test(window.location.hash)) setTab('playlists'); };
        fromHash();
        window.addEventListener('hashchange', fromHash);
        return () => window.removeEventListener('hashchange', fromHash);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let cancelled = false;
        const channel = channelName.toLowerCase();

        const load = async () => {
            try {
                const res = await api.get(`/public/song-request/${channel}`);
                if (cancelled) return;
                setDisplayName(res.data.displayName || channel);
                setAvatarUrl(res.data.avatarUrl || null);
                if (res.data.state) {
                    setState(res.data.state);
                    setStatus('ok');
                } else {
                    setStatus('disabled');
                }
            } catch (err: any) {
                if (cancelled) return;
                setStatus(err?.response?.status === 404 ? 'notfound' : 'error');
            }
        };

        const connection = new signalR.HubConnectionBuilder()
            .withUrl('/hubs/songrequest')
            .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
            .configureLogging(signalR.LogLevel.None)
            .build();

        connection.on('SongRequestUpdated', (snapshot: QueueState) => {
            if (!snapshot.enabled) {
                setStatus('disabled');
                return;
            }
            setState(snapshot);
            setStatus('ok');
        });
        connection.onreconnecting(() => setConnected(false));
        connection.onreconnected(async () => {
            await connection.invoke('Watch', channel);
            setConnected(true);
            load(); // lo que cambió mientras no había conexión
        });
        connection.onclose(() => setConnected(false));

        load();
        connection.start()
            .then(() => connection.invoke('Watch', channel))
            .then(() => { if (!cancelled) setConnected(true); })
            .catch(() => setConnected(false));

        return () => {
            cancelled = true;
            connection.stop();
        };
    }, [channelName]);

    const tabLabel: Record<Tab, string> = {
        stream: t('songRequestPublic.tabs.stream'),
        guide: t('songRequestPublic.tabs.guide'),
        playlists: t('songRequestPublic.tabs.playlists'),
        history: t('songRequestPublic.tabs.history'),
    };

    return (
        <div className="min-h-screen bg-pub-bg text-ds-text relative overflow-x-hidden">
            <div
                className="pointer-events-none fixed inset-0 opacity-[0.04]"
                style={{
                    backgroundImage:
                        'linear-gradient(#3161d8 1px, transparent 1px), linear-gradient(90deg, #3161d8 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />

            <div className="sr-page relative max-w-3xl 3xl:max-w-5xl 4xl:max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 4xl:py-24">
                {/* Encabezado */}
                <header className="flex items-center gap-4 4xl:gap-6 mb-8 4xl:mb-12">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-14 h-14 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20 rounded-full border-2 border-pub-accent/40 shrink-0" />
                    ) : (
                        <div className="w-14 h-14 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20 rounded-full bg-pub-raised border-2 border-pub-border shrink-0" />
                    )}
                    <div className="min-w-0">
                        <p className="font-mono text-xs 3xl:text-sm 4xl:text-base uppercase tracking-widest text-pub-accent-hi/80">
                            {t('songRequestPublic.title')}
                        </p>
                        <h1 className="text-2xl sm:text-3xl 3xl:text-4xl 4xl:text-5xl font-black text-ds-text truncate">
                            {displayName || channelName}
                        </h1>
                    </div>
                </header>

                {status === 'loading' && (
                    <p className="font-mono text-sm 3xl:text-base text-ds-soft animate-pulse">{t('songRequestPublic.loading')}</p>
                )}
                {status === 'notfound' && <Notice text={t('songRequestPublic.notFound', { channel: channelName })} tone="error" />}
                {status === 'error' && <Notice text={t('songRequestPublic.error')} tone="error" />}
                {status === 'disabled' && <Notice text={t('songRequestPublic.disabled')} />}

                {status === 'ok' && state && (
                    <>
                        {/* Estado */}
                        <div className="flex flex-wrap items-center gap-2 mb-6 4xl:mb-8 font-mono text-xs 3xl:text-sm 4xl:text-base">
                            <Chip tone={state.requestsOpen ? 'green' : 'red'}>
                                {state.requestsOpen ? t('songRequestPublic.open') : t('songRequestPublic.closed')}
                            </Chip>
                            {state.stopped
                                ? <Chip tone="amber">{t('songRequestPublic.stopped')}</Chip>
                                : state.paused && <Chip tone="amber">{t('songRequestPublic.paused')}</Chip>}
                            <span className={`flex items-center gap-1.5 ml-auto ${connected ? 'text-ds-ok' : 'text-ds-soft'}`}>
                                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-ds-ok animate-pulse' : 'bg-[#52525b]'}`} />
                                {t('songRequestPublic.live')}
                            </span>
                        </div>

                        {/* Pestañas */}
                        <nav role="tablist" className="flex mb-8 4xl:mb-12 border-b border-pub-border overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {TABS.map(id => (
                                <button
                                    key={id}
                                    role="tab"
                                    aria-selected={tab === id}
                                    onClick={() => setTab(id)}
                                    className={`shrink-0 px-2.5 sm:px-4 py-2.5 4xl:px-6 4xl:py-3.5 font-mono text-[11px] sm:text-xs 3xl:text-sm 4xl:text-base uppercase tracking-wider sm:tracking-widest border-b-2 -mb-px transition-colors ${tab === id
                                        ? 'border-pub-accent text-pub-accent-hi'
                                        : 'border-transparent text-ds-soft hover:text-ds-text'}`}
                                >
                                    {tabLabel[id]}
                                </button>
                            ))}
                        </nav>

                        {tab === 'stream' && <StreamTab state={state} onOpenGuide={() => setTab('guide')} />}
                        {tab === 'guide' && <GuideTab channel={channelName} state={state} />}
                        {tab === 'playlists' && <PlaylistsTab channel={channelName} activePlaylistId={state.activePlaylistId} />}
                        {tab === 'history' && <HistoryTab channel={channelName} currentId={state.current?.id ?? null} />}
                    </>
                )}

                <footer className="mt-16 pt-6 border-t border-pub-border font-mono text-xs 3xl:text-sm text-[#3f3f46] flex items-center justify-between flex-wrap gap-2">
                    <span>{t('songRequestPublic.footer')}</span>
                    <span className="text-pub-accent-hi/60">{window.location.host}</span>
                </footer>
            </div>

            <style>{`
                @keyframes srBar { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
                /* 4K sin escalado del sistema: el 4xl (2K) se queda chico, se agranda todo junto */
                @media (min-width: 3200px) { .sr-page { zoom: 1.6; } }
            `}</style>
        </div>
    );
}
