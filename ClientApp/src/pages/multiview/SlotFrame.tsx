import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Maximize2, PanelTop, Volume2, VolumeX, X } from 'lucide-react';
import TwitchPlayer from './TwitchPlayer';
import KickPlayer from './KickPlayer';
import TranslationMenu from './TranslationMenu';
import TileCaptions from './TileCaptions';
import type { TrInfo } from './translation';
import type { QualityChoice, Slot } from './types';

interface Props {
    slot: Slot;
    index: number;
    style: React.CSSProperties;
    live: boolean | null;
    viewers: number | null;
    hasAudio: boolean;
    volume: number;
    quality: QualityChoice;
    isMain: boolean;
    stack: boolean;
    unlocked: boolean;
    /** Traducción en vivo del canal (solo Twitch) y el idioma elegido para los subtítulos */
    tr?: TrInfo;
    trLang: string | null;
    onTrLang: (lang: string | null) => void;
    dragging: boolean;
    onAudio: () => void;
    onVolume: (v: number) => void;
    onLive: (live: boolean) => void;
    onMakeMain: () => void;
    onRemove: () => void;
    onDragStart: () => void;
    onDragEnd: () => void;
    onDropOn: () => void;
}

const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-md text-white/90 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-accent-hi';

export default function SlotFrame(p: Props) {
    const { t } = useTranslation('multiview');
    const box = useRef<HTMLDivElement>(null);
    const isTwitch = p.slot.platform === 'twitch';

    const fullscreen = () => {
        const el = box.current;
        if (!el) return;
        if (document.fullscreenElement) void document.exitFullscreen();
        else void el.requestFullscreen?.().catch(() => { /* el navegador no lo permite */ });
    };

    return (
        <div
            ref={box}
            style={p.style}
            className={`group relative aspect-video overflow-hidden rounded-md border border-pub-border bg-black md:[grid-column:var(--mv-col)] md:[grid-row:var(--mv-row)] ${p.stack ? '' : 'md:aspect-auto'}`}
            data-slot={p.slot.id}
        >
            {isTwitch
                ? <TwitchPlayer channel={p.slot.channel} hasAudio={p.hasAudio} volume={p.volume} unlocked={p.unlocked} quality={p.quality} onLive={p.onLive} />
                : <KickPlayer channel={p.slot.channel} muted={!p.hasAudio} />}

            {isTwitch && p.trLang && <TileCaptions login={p.slot.channel} lang={p.trLang} />}

            {/* Mientras se arrastra, una capa recibe el soltar: los iframes se tragarían el evento. */}
            {p.dragging && (
                <div
                    className="absolute inset-0 z-20 flex items-center justify-center bg-pub-accent/20 text-sm font-bold text-white"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); p.onDropOn(); }}
                >
                    {t('slot.dropHere')}
                </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 to-transparent p-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                <div
                    className="pointer-events-auto flex min-w-0 items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 md:cursor-grab"
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', p.slot.id); e.dataTransfer.effectAllowed = 'move'; p.onDragStart(); }}
                    onDragEnd={p.onDragEnd}
                    title={t('slot.drag')}
                >
                    <GripVertical className="hidden h-4 w-4 flex-none text-white/60 md:block" />
                    <span className={`h-2 w-2 flex-none rounded-full ${p.live ? 'bg-ds-danger' : 'bg-[#52525b]'}`} aria-hidden />
                    <span className="truncate text-sm font-bold text-white">{p.slot.channel}</span>
                    <span className="flex-none text-[11px] font-semibold uppercase text-white/60">{isTwitch ? 'Twitch' : 'Kick'}</span>
                    {p.live === false && <span className="flex-none rounded bg-white/15 px-1.5 text-[11px] font-semibold text-white/80">{t('slot.offline')}</span>}
                    {p.live && p.viewers != null && <span className="flex-none text-[11px] tabular-nums text-white/70">{p.viewers.toLocaleString()}</span>}
                </div>

                <div className="pointer-events-auto flex flex-none items-center gap-0.5 rounded-md bg-black/55 p-0.5">
                    {isTwitch && p.hasAudio && (
                        <input
                            type="range" min={0} max={100} value={Math.round(p.volume * 100)}
                            onChange={e => p.onVolume(Number(e.target.value) / 100)}
                            aria-label={t('slot.volume')}
                            className="mx-1 hidden h-1 w-20 accent-[#6e94ed] md:block"
                        />
                    )}
                    {isTwitch && p.tr?.enabled && p.tr.languages.length > 0 && <TranslationMenu info={p.tr} lang={p.trLang} onLang={p.onTrLang} btn={iconBtn} />}
                    <button type="button" className={iconBtn} onClick={p.onAudio} aria-pressed={p.hasAudio} aria-label={p.hasAudio ? t('slot.mute') : t('slot.listen')} title={p.hasAudio ? t('slot.mute') : t('slot.listen')}>
                        {p.hasAudio ? <Volume2 className="h-4 w-4 text-pub-accent-hi" /> : <VolumeX className="h-4 w-4" />}
                    </button>
                    {!p.isMain && (
                        <button type="button" className={iconBtn} onClick={p.onMakeMain} aria-label={t('slot.makeMain')} title={t('slot.makeMain')}>
                            <PanelTop className="h-4 w-4" />
                        </button>
                    )}
                    <button type="button" className={iconBtn} onClick={fullscreen} aria-label={t('slot.fullscreen')} title={t('slot.fullscreen')}>
                        <Maximize2 className="h-4 w-4" />
                    </button>
                    <button type="button" className={iconBtn} onClick={p.onRemove} aria-label={t('slot.remove')} title={t('slot.remove')}>
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
