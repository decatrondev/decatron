import { useTranslation } from 'react-i18next';
import { PlatformIcon } from '../features/song-request-extension/components/PlatformIcon';
import { sourceName } from '../features/song-request-extension/utils';
import { SectionTitle, formatDuration, type QueueItem, type QueueState } from './shared';

const MODE_TONE = { open: 'bg-emerald-400', playlists: 'bg-cyan-400', review: 'bg-amber-300', closed: 'bg-red-400' } as const;

export default function StreamTab({ state, onOpenGuide }: { state: QueueState; onOpenGuide: () => void }) {
    const { t } = useTranslation('commands');
    const queue = state.queue ?? [];
    const current = state.current ?? null;
    const mode = state.mode ?? (state.requestsOpen ? 'open' : 'closed');

    return (
        <>
            {/* Sonando ahora */}
            <SectionTitle>{t('songRequestPublic.nowPlaying')}</SectionTitle>
            {current ? (
                <NowPlaying item={current} paused={state.paused} openLabel={t('songRequestPublic.openOn', { source: sourceName(current.originSource ?? current.source) })} requestedBy={current.isFallback ? t('songRequestPublic.fromPlaylist') : t('songRequestPublic.requestedBy', { user: current.requestedBy })} />
            ) : (
                <p className="mb-10 text-sm 3xl:text-base 4xl:text-lg text-[#71717a]">{t('songRequestPublic.nothingPlaying')}</p>
            )}

            {/* Lo que suena viene de una playlist pública: se puede escuchar entera en el navegador */}
            {current?.isFallback && state.activePlaylist && (
                <a
                    href={`/sr/${state.channel}/p/${state.activePlaylist.code}`}
                    className="-mt-6 mb-10 4xl:mb-14 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-pub-accent/30 font-mono text-xs 3xl:text-sm 4xl:text-base text-pub-accent-hi hover:bg-pub-accent/10 transition-colors"
                >
                    ▶ {t('songRequestPublic.listenThis')} · {state.activePlaylist.name} →
                </a>
            )}

            {/* Resumen de cómo pedir: la guía completa está en su pestaña */}
            <div className="mb-10 4xl:mb-14 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-pub-border bg-pub-surface px-4 py-3 4xl:px-6 4xl:py-4">
                <p className="flex items-start gap-2.5 text-white font-semibold text-sm 3xl:text-base 4xl:text-xl">
                    <span className={`mt-1.5 4xl:mt-2.5 w-2 h-2 rounded-full shrink-0 ${MODE_TONE[mode]}`} />
                    {t(`srGuide.public.mode.${mode}`)}
                </p>
                <button onClick={onOpenGuide} className="font-mono text-xs 3xl:text-sm 4xl:text-base text-pub-accent-hi hover:underline">
                    {t('songRequestPublic.tabs.howToRequestLink')} →
                </button>
            </div>

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
                <ol className="divide-y divide-pub-border-soft border-y border-pub-border-soft">
                    {queue.map(item => (
                        <li key={item.id}>
                            <a
                                href={item.originUrl ?? item.url ?? undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 4xl:gap-5 py-3 4xl:py-4 px-2 -mx-2 rounded hover:bg-pub-surface transition-colors"
                            >
                                <span className="font-mono text-sm 3xl:text-base 4xl:text-lg text-[#52525b] w-7 4xl:w-10 text-right shrink-0">
                                    {item.position}
                                </span>
                                {item.thumbnailUrl ? (
                                    <img src={item.thumbnailUrl} alt="" loading="lazy" className="w-20 h-[45px] 3xl:w-24 3xl:h-[54px] 4xl:w-32 4xl:h-[72px] object-cover rounded shrink-0 bg-pub-raised" />
                                ) : (
                                    <div className="w-20 h-[45px] 3xl:w-24 3xl:h-[54px] 4xl:w-32 4xl:h-[72px] rounded shrink-0 bg-pub-raised" />
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
    );
}

function NowPlaying({ item, paused, openLabel, requestedBy }: { item: QueueItem; paused: boolean; openLabel: string; requestedBy: string }) {
    const link = item.originUrl ?? item.url;
    return (
        <div className="mb-10 4xl:mb-14 flex flex-col sm:flex-row gap-4 4xl:gap-6 rounded-xl border border-pub-accent/20 bg-pub-surface p-4 4xl:p-6">
            {item.thumbnailUrl && (
                <img src={item.thumbnailUrl} alt="" className="w-full sm:w-56 3xl:w-64 4xl:w-80 aspect-video object-cover rounded-lg shrink-0 bg-pub-raised" />
            )}
            <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                <div className="flex items-end gap-[3px] h-4 4xl:h-6 mb-1" aria-hidden>
                    {[0, 1, 2, 3].map(i => (
                        <span
                            key={i}
                            className="w-[3px] 4xl:w-1 h-full bg-pub-accent origin-bottom rounded-sm"
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
                    <a href={link} target="_blank" rel="noopener noreferrer" className="mt-2 self-start font-mono text-xs 3xl:text-sm 4xl:text-base text-pub-accent-hi hover:underline">
                        {openLabel} ↗
                    </a>
                )}
            </div>
        </div>
    );
}
