import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as signalR from '@microsoft/signalr';
import api from '../services/api';
import { PlatformIcon } from './features/song-request-extension/components/PlatformIcon';

// Cola pública de song request: /sr/:channelName (.dev/plans/SONG_REQUEST_PLAN.md, fase 1).
// Se actualiza en vivo por /hubs/songrequest (grupo sr_{canal}).

interface QueueItem {
    id: number;
    position: number;
    source: string | null;
    url: string | null;
    title: string;
    artist: string;
    durationSeconds: number | null;
    thumbnailUrl: string | null;
    requestedBy: string;
    platform: string;
    isFallback?: boolean;
    originSource: string | null;
    originUrl: string | null;
}

interface QueueState {
    channel: string;
    enabled: boolean;
    requestsOpen: boolean;
    paused: boolean;
    current: QueueItem | null;
    queue: QueueItem[];
    totalDurationSeconds: number;
}

type Status = 'loading' | 'ok' | 'disabled' | 'notfound' | 'error';

const SOURCE_NAMES: Record<string, string> = { youtube: 'YouTube', spotify: 'Spotify' };

function formatDuration(seconds: number | null | undefined): string {
    if (!seconds || seconds <= 0) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
}

export default function SongRequestPublicPage() {
    const { channelName = '' } = useParams<{ channelName: string }>();
    const { t } = useTranslation('commands');
    const [status, setStatus] = useState<Status>('loading');
    const [state, setState] = useState<QueueState | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);

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

    const queue = state?.queue ?? [];
    const current = state?.current ?? null;

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-[#d4d4d8] relative overflow-x-hidden">
            <div
                className="pointer-events-none fixed inset-0 opacity-[0.04]"
                style={{
                    backgroundImage:
                        'linear-gradient(#39ff14 1px, transparent 1px), linear-gradient(90deg, #39ff14 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />

            <div className="sr-page relative max-w-3xl 3xl:max-w-5xl 4xl:max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 4xl:py-24">
                {/* Encabezado */}
                <header className="flex items-center gap-4 4xl:gap-6 mb-8 4xl:mb-12">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-14 h-14 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20 rounded-full border-2 border-[#39ff14]/40 shrink-0" />
                    ) : (
                        <div className="w-14 h-14 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20 rounded-full bg-[#18181b] border-2 border-[#27272a] shrink-0" />
                    )}
                    <div className="min-w-0">
                        <p className="font-mono text-xs 3xl:text-sm 4xl:text-base uppercase tracking-widest text-[#39ff14]/80">
                            {t('songRequestPublic.title')}
                        </p>
                        <h1 className="text-2xl sm:text-3xl 3xl:text-4xl 4xl:text-5xl font-black text-white truncate">
                            {displayName || channelName}
                        </h1>
                    </div>
                </header>

                {status === 'loading' && (
                    <p className="font-mono text-sm 3xl:text-base text-[#71717a] animate-pulse">{t('songRequestPublic.loading')}</p>
                )}
                {status === 'notfound' && <Notice text={t('songRequestPublic.notFound', { channel: channelName })} tone="error" />}
                {status === 'error' && <Notice text={t('songRequestPublic.error')} tone="error" />}
                {status === 'disabled' && <Notice text={t('songRequestPublic.disabled')} />}

                {status === 'ok' && state && (
                    <>
                        {/* Estado + cómo pedir */}
                        <div className="flex flex-wrap items-center gap-2 mb-6 4xl:mb-8 font-mono text-xs 3xl:text-sm 4xl:text-base">
                            <Chip tone={state.requestsOpen ? 'green' : 'red'}>
                                {state.requestsOpen ? t('songRequestPublic.open') : t('songRequestPublic.closed')}
                            </Chip>
                            {state.paused && <Chip tone="amber">{t('songRequestPublic.paused')}</Chip>}
                            <span className={`flex items-center gap-1.5 ml-auto ${connected ? 'text-[#39ff14]' : 'text-[#52525b]'}`}>
                                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[#39ff14] animate-pulse' : 'bg-[#52525b]'}`} />
                                {t('songRequestPublic.live')}
                            </span>
                        </div>

                        {state.requestsOpen && (
                            <div className="mb-8 4xl:mb-12 rounded-lg border border-[#27272a] bg-[#111114] px-4 py-3 4xl:px-6 4xl:py-4 text-sm 3xl:text-base 4xl:text-lg">
                                <span className="text-[#a1a1aa]">{t('songRequestPublic.howTo')} </span>
                                <code className="font-mono text-[#39ff14]">!sr</code>{' '}
                                <code className="font-mono text-[#71717a] break-words">{t('songRequestPublic.howToArg')}</code>
                            </div>
                        )}

                        {/* Sonando ahora */}
                        <SectionTitle>{t('songRequestPublic.nowPlaying')}</SectionTitle>
                        {current ? (
                            <NowPlaying item={current} paused={state.paused} openLabel={t('songRequestPublic.openOn', { source: SOURCE_NAMES[current.originSource ?? current.source ?? ''] ?? 'YouTube' })} requestedBy={current.isFallback ? t('songRequestPublic.fromPlaylist') : t('songRequestPublic.requestedBy', { user: current.requestedBy })} />
                        ) : (
                            <p className="mb-10 text-sm 3xl:text-base 4xl:text-lg text-[#71717a]">{t('songRequestPublic.nothingPlaying')}</p>
                        )}

                        {/* A continuación */}
                        <div className="flex items-baseline justify-between gap-3 flex-wrap">
                            <SectionTitle>{t('songRequestPublic.upNext')}</SectionTitle>
                            {queue.length > 0 && (
                                <span className="font-mono text-xs 3xl:text-sm 4xl:text-base text-[#71717a] mb-3">
                                    {t('songRequestPublic.songs', { count: queue.length })}
                                    {state.totalDurationSeconds > 0 && ` · ${t('songRequestPublic.totalDuration', { duration: formatDuration(state.totalDurationSeconds) })}`}
                                </span>
                            )}
                        </div>

                        {queue.length === 0 ? (
                            <p className="text-sm 3xl:text-base 4xl:text-lg text-[#71717a]">{t('songRequestPublic.empty')}</p>
                        ) : (
                            <ol className="divide-y divide-[#1f1f23] border-y border-[#1f1f23]">
                                {queue.map(item => (
                                    <li key={item.id}>
                                        <a
                                            href={item.originUrl ?? item.url ?? undefined}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 4xl:gap-5 py-3 4xl:py-4 px-2 -mx-2 rounded hover:bg-[#111114] transition-colors"
                                        >
                                            <span className="font-mono text-sm 3xl:text-base 4xl:text-lg text-[#52525b] w-7 4xl:w-10 text-right shrink-0">
                                                {item.position}
                                            </span>
                                            {item.thumbnailUrl ? (
                                                <img src={item.thumbnailUrl} alt="" loading="lazy" className="w-20 h-[45px] 3xl:w-24 3xl:h-[54px] 4xl:w-32 4xl:h-[72px] object-cover rounded shrink-0 bg-[#18181b]" />
                                            ) : (
                                                <div className="w-20 h-[45px] 3xl:w-24 3xl:h-[54px] 4xl:w-32 4xl:h-[72px] rounded shrink-0 bg-[#18181b]" />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-white font-semibold text-sm 3xl:text-base 4xl:text-xl truncate">{item.title}</p>
                                                <p className="text-xs 3xl:text-sm 4xl:text-base text-[#71717a] truncate">
                                                    {item.artist}
                                                    <span className="text-[#3f3f46]"> · </span>
                                                    <PlatformIcon platform={item.platform} className="w-3.5 h-3.5 3xl:w-4 3xl:h-4 4xl:w-5 4xl:h-5" />{' '}
                                                    {t('songRequestPublic.requestedBy', { user: item.requestedBy })}
                                                </p>
                                            </div>
                                            <span className="font-mono text-xs 3xl:text-sm 4xl:text-base text-[#71717a] shrink-0">
                                                {formatDuration(item.durationSeconds)}
                                            </span>
                                        </a>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </>
                )}

                <footer className="mt-16 pt-6 border-t border-[#27272a] font-mono text-xs 3xl:text-sm text-[#3f3f46] flex items-center justify-between flex-wrap gap-2">
                    <span>{t('songRequestPublic.footer')}</span>
                    <span className="text-[#39ff14]/60">{window.location.host}</span>
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

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="flex items-center gap-2 mb-3 font-mono text-xs 3xl:text-sm 4xl:text-base uppercase tracking-widest text-[#a1a1aa] font-bold">
            <span className="text-[#39ff14]">#</span>
            {children}
        </h2>
    );
}

function Chip({ tone, children }: { tone: 'green' | 'red' | 'amber'; children: React.ReactNode }) {
    const styles = {
        green: 'bg-[#39ff14]/10 text-[#39ff14] border-[#39ff14]/25',
        red: 'bg-red-500/10 text-red-400 border-red-500/25',
        amber: 'bg-amber-400/10 text-amber-300 border-amber-400/25',
    }[tone];
    return <span className={`px-2 py-0.5 rounded border uppercase tracking-wide ${styles}`}>{children}</span>;
}

function Notice({ text, tone }: { text: string; tone?: 'error' }) {
    return (
        <div className="rounded-lg border border-[#27272a] bg-[#111114] p-5 4xl:p-8">
            <p className={`text-sm 3xl:text-base 4xl:text-lg ${tone === 'error' ? 'text-red-400' : 'text-[#a1a1aa]'}`}>{text}</p>
        </div>
    );
}

function NowPlaying({ item, paused, openLabel, requestedBy }: { item: QueueItem; paused: boolean; openLabel: string; requestedBy: string }) {
    const link = item.originUrl ?? item.url;
    return (
        <div className="mb-10 4xl:mb-14 flex flex-col sm:flex-row gap-4 4xl:gap-6 rounded-xl border border-[#39ff14]/20 bg-[#111114] p-4 4xl:p-6">
            {item.thumbnailUrl && (
                <img src={item.thumbnailUrl} alt="" className="w-full sm:w-56 3xl:w-64 4xl:w-80 aspect-video object-cover rounded-lg shrink-0 bg-[#18181b]" />
            )}
            <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                <div className="flex items-end gap-[3px] h-4 4xl:h-6 mb-1" aria-hidden>
                    {[0, 1, 2, 3].map(i => (
                        <span
                            key={i}
                            className="w-[3px] 4xl:w-1 h-full bg-[#39ff14] origin-bottom rounded-sm"
                            style={paused ? { transform: 'scaleY(0.3)' } : { animation: `srBar 0.9s ease-in-out ${i * 0.15}s infinite` }}
                        />
                    ))}
                </div>
                <p className="text-white font-bold text-lg 3xl:text-xl 4xl:text-3xl leading-snug break-words">{item.title}</p>
                <p className="text-sm 3xl:text-base 4xl:text-xl text-[#a1a1aa] truncate">{item.artist}</p>
                <p className="text-xs 3xl:text-sm 4xl:text-base text-[#71717a]">
                    {!item.isFallback && <><PlatformIcon platform={item.platform} className="w-3.5 h-3.5 3xl:w-4 3xl:h-4 4xl:w-5 4xl:h-5" />{' '}</>}
                    {requestedBy}
                    {item.durationSeconds ? ` · ${formatDuration(item.durationSeconds)}` : ''}
                </p>
                {link && (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="mt-2 self-start font-mono text-xs 3xl:text-sm 4xl:text-base text-[#39ff14] hover:underline">
                        {openLabel} ↗
                    </a>
                )}
            </div>
        </div>
    );
}
