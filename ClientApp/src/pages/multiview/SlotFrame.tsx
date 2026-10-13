import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, GripVertical, Maximize2, PanelTop, RotateCw, Volume2, VolumeX, X } from 'lucide-react';
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
    silenced: boolean;
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
    onToggleSound: () => void;
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
    // Recargar solo esta casilla: el player se vuelve a montar con otra clave, sin tocar las demás
    const [reloadKey, setReloadKey] = useState(0);

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
            className="group relative flex min-h-0 flex-col overflow-hidden rounded-md border border-pub-border bg-black md:[grid-column:var(--mv-col)] md:[grid-row:var(--mv-row)]"
            data-slot={p.slot.id}
        >
            {/* Nada se dibuja SOBRE el player: el de Twitch desactiva el autoplay y se pausa si algo lo tapa (barra, avisos, subtítulos).
                Por eso la barra de la casilla es una franja propia encima del video y los subtítulos van en otra debajo. */}
            <div className="relative flex min-w-0 flex-none items-center justify-between gap-2 border-b border-pub-border bg-[#0b0b0d] px-1.5 py-1">
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
                    <span className="hidden flex-none text-[11px] font-semibold uppercase text-white/60 sm:inline">{isTwitch ? 'Twitch' : 'Kick'}</span>
                    {p.live === false && <span className="hidden flex-none rounded bg-white/15 px-1.5 text-[11px] font-semibold text-white/80 sm:inline">{t('slot.offline')}</span>}
                    {p.live && p.viewers != null && <span className="flex-none text-[11px] tabular-nums text-white/70">{p.viewers.toLocaleString()}</span>}
                </div>

                {p.index === 0 && !p.unlocked && isTwitch
                    ? <span className="pointer-events-none hidden min-w-0 flex-1 truncate text-center text-xs text-white/70 sm:block">{t('hint.click')}</span>
                    : <span className="flex-1" />}

                <div className="pointer-events-auto flex flex-none items-center gap-0.5 rounded-md bg-black/55 p-0.5">
                    {isTwitch && (
                        <input
                            type="range" min={0} max={100} value={p.silenced ? 0 : Math.round(p.volume * 100)}
                            onChange={e => { const v = Number(e.target.value) / 100; p.onVolume(v); if (p.silenced && v > 0) p.onToggleSound(); }}
                            aria-label={t('slot.volume')}
                            className="mx-1 h-1 w-14 accent-[#6e94ed] sm:w-20"
                        />
                    )}
                    {/* El video embebido no suma rachas en Twitch: este botón abre el canal en una pestaña normal de twitch.tv, que la persona
                        cierra cuando quiera. Solo un enlace, sin extensión ni pestañas automáticas. */}
                    {isTwitch && (
                        <a href={`https://www.twitch.tv/${encodeURIComponent(p.slot.channel)}`} target="_blank" rel="noopener noreferrer"
                            className={iconBtn} aria-label={t('slot.streak')} title={t('slot.streakHint')}>
                            <Flame className="h-4 w-4" />
                        </a>
                    )}
                    <button type="button" className={`${iconBtn} hidden sm:flex`} onClick={() => setReloadKey(k => k + 1)} aria-label={t('slot.reload')} title={t('slot.reload')}>
                        <RotateCw className="h-4 w-4" />
                    </button>
                    {isTwitch && p.tr?.enabled && p.tr.languages.length > 0 && <TranslationMenu info={p.tr} lang={p.trLang} onLang={p.onTrLang} btn={iconBtn} />}
                    <button type="button" className={iconBtn} onClick={p.onToggleSound} aria-pressed={!p.silenced} aria-label={p.silenced ? t('slot.listen') : t('slot.mute')} title={p.silenced ? t('slot.listen') : t('slot.mute')}>
                        {p.silenced ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-pub-accent-hi" />}
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
            <div className={`relative min-h-0 w-full bg-black ${p.stack ? 'aspect-video' : 'aspect-video md:aspect-auto md:flex-1'}`}>
            {isTwitch
                ? <TwitchPlayer key={reloadKey} channel={p.slot.channel} silenced={p.silenced} volume={p.volume} unlocked={p.unlocked} quality={p.quality} onLive={p.onLive} />
                : <KickPlayer key={reloadKey} channel={p.slot.channel} muted={p.silenced} />}

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

            </div>
            {isTwitch && p.trLang && <div className="flex-none empty:hidden"><TileCaptions login={p.slot.channel} lang={p.trLang} /></div>}
        </div>
    );
}
