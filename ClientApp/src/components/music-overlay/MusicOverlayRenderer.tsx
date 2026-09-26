import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ElementConfig, MusicTrack, OverlayLayout, PlaybackProgress, ShowHideAnimation, TextStyle } from './types';
import { ELEMENT_ORDER } from './defaults';
import { formatDuration, sourceName } from './utils';
import ServiceIcon, { hasServiceIcon } from './ServiceIcon';

// Dibuja un overlay de música (Song Request o Now Playing) a su tamaño real (layout.canvas). Lo usan
// el overlay de OBS, la vista previa y el editor, así que los tres se ven idénticos. El que lo muestra
// más chico lo escala desde afuera.

export interface OverlayLabels {
    requestedBy: string; // con {{user}}
    fallback: string; // lo puso la playlist de respaldo
    next: string;
    idle: string;
}

interface Props {
    layout: OverlayLayout;
    current: MusicTrack | null;
    queue: MusicTrack[];
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
        lineHeight: t.lineHeight ?? 1.2,
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

function MarqueeText({ text, style, enabled, speed, loop, gap = 40 }: { text: string; style: CSSProperties; enabled: boolean; speed: number; loop?: boolean; gap?: number }) {
    const outer = useRef<HTMLDivElement>(null);
    const inner = useRef<HTMLSpanElement>(null);
    const [overflow, setOverflow] = useState(0);

    useLayoutEffect(() => {
        if (!enabled || !outer.current || !inner.current) { setOverflow(0); return; }
        const diff = inner.current.scrollWidth - outer.current.clientWidth;
        setOverflow(diff > 2 ? diff : 0);
    }, [text, enabled, style.fontSize, style.fontFamily, style.fontWeight]);

    const seconds = Math.max(4, (overflow + 80) / Math.max(10, speed)) * 2;
    if (loop && overflow > 0) {
        // Bucle continuo: el texto dos veces seguidas y se corre la mitad, sin salto
        // Recorre medio ancho (un texto + el espacio) a `speed` px/s
        const width = (inner.current?.scrollWidth ?? 0) + gap;
        return (
            <div ref={outer} style={{ ...style, overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
                <span ref={inner} style={{ display: 'inline-block', animation: `moMarqueeLoop ${Math.max(4, width / 2 / Math.max(10, speed))}s linear infinite` }}>
                    {text}<span style={{ paddingLeft: gap }}>{text}</span>
                </span>
            </div>
        );
    }
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

/** Recorte con la forma del panel por dentro del borde (solo con theme.clipToPanel). */
function panelClip(layout: OverlayLayout): string | undefined {
    const { theme, canvas, elements: { panel } } = layout;
    if (!theme.clipToPanel || !panel.enabled) return undefined;
    const b = theme.panelBorderWidth;
    const top = panel.y + b, left = panel.x + b;
    const right = canvas.width - (panel.x + panel.width) + b, bottom = canvas.height - (panel.y + panel.height) + b;
    return `inset(${top}px ${right}px ${bottom}px ${left}px round ${Math.max(0, theme.panelRadius - b)}px)`;
}

/** Animación CSS de entrada o salida del overlay entero. */
function showHideCss(a: ShowHideAnimation, entering: boolean): string | undefined {
    if (a.type === 'none') return undefined;
    const dir = a.type === 'slide' || a.type === 'bounce' ? `-${a.direction}` : '';
    return `mo-${entering ? 'in' : 'out'}-${a.type}${dir} ${a.durationMs}ms ${a.easing} both`;
}

/**
 * Entrada y salida al aparecer o desaparecer. Al montar no anima (así estaba siempre); después,
 * cada cambio alterna el nombre de la animación, lo que la reinicia sin volver a montar nada
 * (el iframe del video no se recarga).
 */
function useShowHide(visible: boolean, enter: ShowHideAnimation, exit: ShowHideAnimation): string | undefined {
    const [changed, setChanged] = useState(false);
    const prev = useRef(visible);
    useEffect(() => {
        if (prev.current !== visible) { prev.current = visible; setChanged(true); }
    }, [visible]);
    if (!changed) return undefined;
    return showHideCss(visible ? enter : exit, visible);
}

export default function MusicOverlayRenderer({ layout, current, queue, progress, paused, labels, videoSlot, alwaysVisible }: Props) {
    const { elements: els, theme, animations } = layout;
    const visible = alwaysVisible || !!current || !animations.hideWhenIdle;
    const running = !!current && !paused && (progress?.playing ?? false);
    const position = useLivePosition(progress && current && progress.itemId === current.id ? progress : null, running);
    const duration = (progress && current && progress.itemId === current.id && progress.duration) || current?.durationSeconds || 0;
    const frozen = paused && animations.freezeWhenPaused;
    const next = queue[0] ?? null;
    const animName = animations.songChange === 'none' ? 'none' : `srIn-${animations.songChange}`;
    const showHide = useShowHide(visible, animations.enter, animations.exit);

    const songKey = current ? `song-${current.id}` : 'idle';
    const timeText = useMemo(() => {
        const fmt = els.time.options.format;
        if (!current) return '';
        if (fmt === 'remaining') return duration ? `-${formatDuration(Math.max(0, duration - position))}` : '';
        if (fmt === 'elapsed') return formatDuration(position) || '0:00';
        if (fmt === 'split' || fmt === 'spaced') return '';
        return duration ? `${formatDuration(position) || '0:00'} / ${formatDuration(duration)}` : formatDuration(position) || '0:00';
    }, [els.time.options.format, current, duration, position]);

    const textEl = (id: 'title' | 'artist' | 'album' | 'requester' | 'time' | 'next', value: string) => {
        const e = els[id];
        if (!e.enabled || !value) return null;
        return (
            <div key={id} style={box(e)}>
                <MarqueeText text={value} style={textCss(e.text)} enabled={!!e.text?.marquee} speed={animations.marqueeSpeed} loop={animations.marqueeMode === 'loop'} gap={e.text?.marqueeGap} />
            </div>
        );
    };

    const requesterLabel = els.requester.options.label || labels.requestedBy;
    const nextLabel = els.next.options.label || labels.next;
    const serviceKey = current?.originSource ?? current?.source ?? null;
    const serviceName = sourceName(serviceKey);
    const sourceDisplay: 'text' | 'icon' | 'both' = els.source.options.display ?? 'text';
    const fraction = duration > 0 ? Math.min(1, position / duration) : 0;

    const panelNode = els.panel.enabled && (
        <div style={{
            ...box(els.panel),
            background: theme.panelBackground,
            border: `${theme.panelBorderWidth}px solid ${theme.panelBorderColor}`,
            borderRadius: theme.panelRadius,
            backdropFilter: theme.panelBlur ? `blur(${theme.panelBlur}px)` : undefined,
            boxShadow: theme.panelShadow ? theme.panelShadowCss ?? '0 10px 30px rgba(0,0,0,0.35)' : undefined,
            boxSizing: 'border-box',
        }} />
    );

    return (
        <div style={{ position: 'relative', width: layout.canvas.width, height: layout.canvas.height, overflow: 'hidden' }}>
            <div style={{
                position: 'absolute', inset: 0, opacity: visible ? 1 : 0, animation: showHide,
                // Deslizar y rebotar recorren el tamaño del panel y el zoom sale de su centro (no del lienzo entero)
                ['--mo-w' as any]: `${els.panel.width}px`, ['--mo-h' as any]: `${els.panel.height}px`,
                transformOrigin: `${els.panel.x + els.panel.width / 2}px ${els.panel.y + els.panel.height / 2}px`,
            }}>
                {!animations.songChangePanel && panelNode}

                <div key={songKey} style={{ position: 'absolute', inset: 0, transformOrigin: `${els.panel.x + els.panel.width / 2}px ${els.panel.y + els.panel.height / 2}px`, animation: animName === 'none' ? undefined : `${animName} ${animations.durationMs}ms ${animations.songChange === 'crossfade' ? 'ease' : 'cubic-bezier(.2,.8,.2,1)'} both` }}>
                    {/* El Now Playing viejo animaba la tarjeta entera, fondo incluido */}
                    {animations.songChangePanel && panelNode}
                    <div style={{ position: 'absolute', inset: 0, clipPath: panelClip(layout) }}>
                    {els.cover.enabled && (
                        current?.thumbnailUrl
                            ? <img src={current.thumbnailUrl} alt="" style={{ ...box(els.cover), objectFit: 'cover', borderRadius: theme.coverRadius, boxShadow: els.cover.options.shadow ? '0 4px 12px rgba(0,0,0,0.5)' : undefined }} />
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
                    {current && current.album && textEl('album', current.album)}
                    {current && (current.isFallback || current.requestedBy) && textEl('requester', current.isFallback ? labels.fallback : requesterLabel.replace('{{user}}', current.requestedBy ?? ''))}
                    {current && !['split', 'spaced'].includes(els.time.options.format) && textEl('time', timeText)}
                    {current && els.time.enabled && ['split', 'spaced'].includes(els.time.options.format) && duration > 0 && (
                        // Como el Now Playing viejo: split = transcurrido a la izquierda y total a la derecha;
                        // spaced = "1:23 / 3:33" con 8 px entre las partes
                        <div key="time" style={{ ...box(els.time), ...textCss(els.time.text), display: 'flex', alignItems: 'center', justifyContent: els.time.options.format === 'split' ? 'space-between' : 'flex-start', gap: els.time.options.format === 'spaced' ? 8 : undefined, whiteSpace: 'nowrap' }}>
                            <span>{formatDuration(position) || '0:00'}</span>
                            {els.time.options.format === 'spaced' && <span>/</span>}
                            <span>{formatDuration(duration)}</span>
                        </div>
                    )}
                    {next && textEl('next', `${nextLabel} ${next.title}`)}
                    {current && els.source.enabled && (() => {
                        // Icono solo para los servicios que lo tienen; si no, el nombre
                        const icon = sourceDisplay !== 'text' && hasServiceIcon(serviceKey);
                        const style = textCss(els.source.text);
                        return (
                            <div key="source" style={{ ...box(els.source), ...style, opacity: els.source.options.opacity ?? 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'flex-end' : 'flex-start', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                {icon && <ServiceIcon service={serviceKey} size={Math.min(els.source.height, els.source.width)} />}
                                {(!icon || sourceDisplay === 'both') && <span>{serviceName}</span>}
                            </div>
                        );
                    })()}

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
@keyframes srIn-crossfade { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
@keyframes srIn-flip { from { opacity: 0; transform: perspective(800px) rotateX(-70deg); } to { opacity: 1; transform: none; } }
@keyframes moMarqueeLoop { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes mo-in-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes mo-out-fade { from { opacity: 1; } to { opacity: 0; } }
@keyframes mo-in-zoom { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
@keyframes mo-out-zoom { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0); } }
${(['left', 'right', 'top', 'bottom'] as const).map(d => {
    const axis = d === 'left' || d === 'right' ? 'X' : 'Y';
    const size = axis === 'X' ? 'var(--mo-w)' : 'var(--mo-h)';
    const sign = d === 'left' || d === 'top' ? -1 : 1;
    const at = (f: number) => `translate${axis}(calc(${size} * ${sign * f}))`;
    const off = at(1), over = at(-0.1), back = at(0.05);
    return `@keyframes mo-in-slide-${d} { from { opacity: 0; transform: ${off}; } to { opacity: 1; transform: none; } }
@keyframes mo-out-slide-${d} { from { opacity: 1; transform: none; } to { opacity: 0; transform: ${off}; } }
@keyframes mo-in-bounce-${d} { 0% { opacity: 0; transform: ${off}; } 60% { opacity: 1; transform: ${over}; } 80% { transform: ${back}; } 100% { opacity: 1; transform: none; } }
@keyframes mo-out-bounce-${d} { 0% { opacity: 1; transform: none; } 20% { transform: ${back}; } 40% { opacity: 1; transform: ${over}; } 100% { opacity: 0; transform: ${off}; } }`;
}).join('\n')}
`;

/** Orden de dibujo, por si alguien lo necesita afuera (editor). */
export const RENDER_ORDER = ELEMENT_ORDER;
