import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ElementConfig, OverlayLayout, PlaybackProgress, QueueItem, TextStyle } from '../types';
import { ELEMENT_ORDER } from '../constants/defaults';
import { formatDuration, sourceName } from '../utils';

// Dibuja un overlay de song request a su tamaño real (layout.canvas). Lo usan el overlay de OBS,
// la vista previa y el editor, así que los tres se ven idénticos. El que lo muestra más chico
// lo escala desde afuera.

export interface OverlayLabels {
    requestedBy: string; // con {{user}}
    fallback: string; // lo puso la playlist de respaldo
    next: string;
    idle: string;
}

interface Props {
    layout: OverlayLayout;
    current: QueueItem | null;
    queue: QueueItem[];
    progress: PlaybackProgress | null;
    paused: boolean;
    labels: OverlayLabels;
    /** El iframe de YouTube (solo el reproductor). Queda fuera de la animación para no recargarse. */
    videoSlot?: ReactNode;
    /** En el editor: siempre visible aunque no haya canción. */
    alwaysVisible?: boolean;
}

const SHADOWS: Record<TextStyle['shadow'], string> = {
    none: 'none',
    soft: '0 1px 3px rgba(0,0,0,0.6)',
    strong: '0 2px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)',
    glow: '0 0 8px currentColor, 0 0 16px currentColor',
};

export function textCss(t: TextStyle | undefined): CSSProperties {
    if (!t) return {};
    return {
        fontFamily: `'${t.fontFamily}', system-ui, sans-serif`,
        fontSize: t.fontSize,
        fontWeight: t.fontWeight as CSSProperties['fontWeight'],
        color: t.color,
        textAlign: t.align,
        textShadow: SHADOWS[t.shadow] ?? 'none',
        textTransform: t.uppercase ? 'uppercase' : 'none',
        letterSpacing: t.letterSpacing,
        lineHeight: 1.2,
    };
}

export const box = (e: ElementConfig): CSSProperties => ({
    position: 'absolute', left: e.x, top: e.y, width: e.width, height: e.height,
});

/** Posición que avanza sola entre avisos del reproductor (llegan ~1 por segundo). */
function useLivePosition(progress: PlaybackProgress | null, running: boolean) {
    const [now, setNow] = useState(() => performance.now());
    const base = useRef({ at: performance.now(), position: progress?.position ?? 0 });

    useEffect(() => {
        base.current = { at: performance.now(), position: progress?.position ?? 0 };
    }, [progress]);

    useEffect(() => {
        if (!running) return;
        let raf = 0;
        const tick = () => { setNow(performance.now()); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [running]);

    if (!progress) return 0;
    const elapsed = running ? (now - base.current.at) / 1000 : 0;
    return Math.min(progress.duration || Infinity, base.current.position + elapsed);
}

function MarqueeText({ text, style, enabled, speed }: { text: string; style: CSSProperties; enabled: boolean; speed: number }) {
    const outer = useRef<HTMLDivElement>(null);
    const inner = useRef<HTMLSpanElement>(null);
    const [overflow, setOverflow] = useState(0);

    useLayoutEffect(() => {
        if (!enabled || !outer.current || !inner.current) { setOverflow(0); return; }
        const diff = inner.current.scrollWidth - outer.current.clientWidth;
        setOverflow(diff > 2 ? diff : 0);
    }, [text, enabled, style.fontSize, style.fontFamily, style.fontWeight]);

    const seconds = Math.max(4, (overflow + 80) / Math.max(10, speed)) * 2;
    return (
        <div ref={outer} style={{ ...style, overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
            <span
                ref={inner}
                style={overflow > 0
                    ? { display: 'inline-block', animation: `srMarquee ${seconds}s ease-in-out infinite`, ['--sr-shift' as any]: `-${overflow}px` }
                    : { display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}
            >
                {text}
            </span>
        </div>
    );
}

export default function SongOverlayRenderer({ layout, current, queue, progress, paused, labels, videoSlot, alwaysVisible }: Props) {
    const { elements: els, theme, animations } = layout;
    const visible = alwaysVisible || !!current || !animations.hideWhenIdle;
    const running = !!current && !paused && (progress?.playing ?? false);
    const position = useLivePosition(progress && current && progress.itemId === current.id ? progress : null, running);
    const duration = (progress && current && progress.itemId === current.id && progress.duration) || current?.durationSeconds || 0;
    const frozen = paused && animations.freezeWhenPaused;
    const next = queue[0] ?? null;
    const animName = animations.songChange === 'none' ? 'none' : `srIn-${animations.songChange}`;

    const songKey = current ? `song-${current.id}` : 'idle';
    const timeText = useMemo(() => {
        const fmt = els.time.options.format;
        if (!current) return '';
        if (fmt === 'remaining') return duration ? `-${formatDuration(Math.max(0, duration - position))}` : '';
        if (fmt === 'elapsed') return formatDuration(position) || '0:00';
        return duration ? `${formatDuration(position) || '0:00'} / ${formatDuration(duration)}` : formatDuration(position) || '0:00';
    }, [els.time.options.format, current, duration, position]);

    const textEl = (id: 'title' | 'artist' | 'requester' | 'time' | 'next' | 'source', value: string) => {
        const e = els[id];
        if (!e.enabled || !value) return null;
        return (
            <div key={id} style={box(e)}>
                <MarqueeText text={value} style={textCss(e.text)} enabled={!!e.text?.marquee} speed={animations.marqueeSpeed} />
            </div>
        );
    };

    const requesterLabel = els.requester.options.label || labels.requestedBy;
    const nextLabel = els.next.options.label || labels.next;
    const serviceName = sourceName(current?.originSource ?? current?.source);
    const fraction = duration > 0 ? Math.min(1, position / duration) : 0;

    return (
        <div style={{ position: 'relative', width: layout.canvas.width, height: layout.canvas.height, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: visible ? 1 : 0, transition: `opacity ${animations.durationMs}ms ease` }}>
                {els.panel.enabled && (
                    <div style={{
                        ...box(els.panel),
                        background: theme.panelBackground,
                        border: `${theme.panelBorderWidth}px solid ${theme.panelBorderColor}`,
                        borderRadius: theme.panelRadius,
                        backdropFilter: theme.panelBlur ? `blur(${theme.panelBlur}px)` : undefined,
                        boxShadow: theme.panelShadow ? '0 10px 30px rgba(0,0,0,0.35)' : undefined,
                        boxSizing: 'border-box',
                    }} />
                )}

                <div key={songKey} style={{ position: 'absolute', inset: 0, animation: animName === 'none' ? undefined : `${animName} ${animations.durationMs}ms cubic-bezier(.2,.8,.2,1) both` }}>
                    {els.cover.enabled && (
                        current?.thumbnailUrl
                            ? <img src={current.thumbnailUrl} alt="" style={{ ...box(els.cover), objectFit: 'cover', borderRadius: theme.coverRadius }} />
                            : <div style={{ ...box(els.cover), borderRadius: theme.coverRadius, background: `linear-gradient(135deg, ${theme.accent}33, transparent)` }} />
                    )}

                    {/* Sin reproductor (vista previa, editor): la miniatura ocupa el lugar del video, encima de la portada */}
                    {els.video.enabled && !videoSlot && current?.thumbnailUrl && (
                        <img src={current.thumbnailUrl} alt="" style={{ ...box(els.video), objectFit: 'cover', borderRadius: theme.coverRadius }} />
                    )}

                    {els.equalizer.enabled && current && (
                        <div style={{ ...box(els.equalizer), display: 'flex', alignItems: 'flex-end', gap: Math.max(2, els.equalizer.width / 16) }}>
                            {Array.from({ length: Math.max(2, Math.min(12, els.equalizer.options.bars ?? 4)) }).map((_, i) => (
                                <span key={i} style={{
                                    flex: 1, height: '100%', background: els.equalizer.options.color || theme.accent, borderRadius: 2,
                                    transformOrigin: 'bottom',
                                    transform: frozen ? 'scaleY(0.3)' : undefined,
                                    animation: frozen ? undefined : `srBar ${0.7 + (i % 3) * 0.15}s ease-in-out ${i * 0.12}s infinite`,
                                }} />
                            ))}
                        </div>
                    )}

                    {current
                        ? textEl('title', current.title)
                        : textEl('title', labels.idle)}
                    {current && textEl('artist', current.artist)}
                    {current && textEl('requester', current.isFallback ? labels.fallback : requesterLabel.replace('{{user}}', current.requestedBy))}
                    {current && textEl('time', timeText)}
                    {next && textEl('next', `${nextLabel} ${next.title}`)}
                    {current && textEl('source', serviceName)}

                    {els.progress.enabled && current && (
                        <div style={{ ...box(els.progress), background: els.progress.options.track, borderRadius: els.progress.options.radius ?? 4, overflow: 'hidden' }}>
                            <div style={{ width: `${fraction * 100}%`, height: '100%', background: els.progress.options.fill || theme.accent, borderRadius: els.progress.options.radius ?? 4 }} />
                        </div>
                    )}

                    {els.queue.enabled && queue.length > 0 && (
                        <div style={{ ...box(els.queue), ...textCss(els.queue.text), display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                            {queue.slice(0, Math.max(1, els.queue.options.count ?? 3)).map((q, i) => (
                                <div key={q.id} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    <span style={{ opacity: 0.6 }}>{i + 1}.</span> {q.title}
                                    {els.queue.options.showRequester && <span style={{ opacity: 0.6 }}> · {q.requestedBy}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* El video real va encima (si comparte lugar con la portada, la tapaba) y fuera de la capa
                    animada, así el iframe no se recarga en cada cambio de canción */}
                {els.video.enabled && videoSlot && (
                    <div style={{ ...box(els.video), borderRadius: theme.coverRadius, overflow: 'hidden', background: '#000' }}>
                        {videoSlot}
                    </div>
                )}
            </div>

            <style>{OVERLAY_KEYFRAMES}</style>
        </div>
    );
}

export const OVERLAY_KEYFRAMES = `
@keyframes srBar { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
@keyframes srMarquee { 0%, 15% { transform: translateX(0); } 85%, 100% { transform: translateX(var(--sr-shift)); } }
@keyframes srIn-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes srIn-slide-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes srIn-slide-left { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: none; } }
@keyframes srIn-zoom { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: none; } }
@keyframes srIn-flip { from { opacity: 0; transform: perspective(800px) rotateX(-70deg); } to { opacity: 1; transform: none; } }
`;

/** Orden de dibujo, por si alguien lo necesita afuera (editor). */
export const RENDER_ORDER = ELEMENT_ORDER;
