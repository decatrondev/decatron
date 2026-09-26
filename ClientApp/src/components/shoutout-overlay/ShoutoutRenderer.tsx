import type { CSSProperties, Ref } from 'react';
import type { Background, ShoutoutData, ShoutoutElement, ShoutoutLayout, ShowHideAnimation, TextBlock } from './types';
import { TEXT_VARIABLES } from './defaults';

// Dibuja el overlay de Shoutout a su tamaño real (layout.canvas). Lo usan el overlay de OBS, la vista previa
// y el editor, así que los tres se ven idénticos. El que lo muestra más chico lo escala desde afuera.
// Las configs viejas convertidas (convertLegacy.ts) se ven igual que el overlay viejo: por eso los valores
// "raros" (bordes que corren a los hijos, sombras, fondos con opacidad por color).

export type Phase = 'enter' | 'exit' | 'static';

interface Props {
    layout: ShoutoutLayout;
    data: ShoutoutData | null;
    /** enter / exit corren la animación de entrada o salida; static, nada (editor, vista previa quieta). */
    phase: Phase;
    /** Segundos que faltan (el contador). */
    remaining?: number;
    /** Segundos que dura este shoutout (la barra de tiempo se vacía en ese tiempo). */
    durationSec?: number;
    /** Sin video real: el clip se muestra como un cuadro de ejemplo (vista previa, editor). */
    preview?: boolean;
    videoRef?: Ref<HTMLVideoElement>;
    onVideoEnded?: () => void;
    /** Textos que dependen del idioma de la vista (el overlay de OBS usa los de fábrica). */
    labels?: { clip?: string; noGame?: string };
}

const TEXT_SHADOWS: Record<string, string> = {
    none: 'none',
    normal: '2px 2px 4px rgba(0,0,0,0.5)',
    strong: '3px 3px 6px rgba(0,0,0,0.8)',
    glow: '0 0 10px rgba(255,255,255,0.8)',
};

function hexToRgba(color: string, alpha: number): string {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
    const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function backgroundCss(bg: Background): string {
    const a = bg.opacity / 100;
    if (bg.type === 'transparent') return 'transparent';
    if (bg.type === 'solid') return hexToRgba(bg.solid, a);
    return `linear-gradient(${bg.angle}deg, ${hexToRgba(bg.color1, a)}, ${hexToRgba(bg.color2, a)})`;
}

const fmtNumber = (n: number | null | undefined) => (n === null || n === undefined ? '' : n.toLocaleString('es'));

/** Reemplaza las variables de una línea (todas las veces que aparezcan). */
export function fillVariables(text: string, d: ShoutoutData | null, noGame = 'Sin categoría'): string {
    if (!d) return text;
    const values: Record<(typeof TEXT_VARIABLES)[number], string> = {
        '@displayname': d.displayName || d.targetUser,
        '@username': d.targetUser,
        '@game': d.gameName || noGame,
        '@title': d.title ?? '',
        '@followers': fmtNumber(d.followers),
        '@clipTitle': d.clipTitle ?? '',
        '@clipViews': fmtNumber(d.clipViews),
        '@clipCreator': d.clipCreator ?? '',
    };
    return TEXT_VARIABLES.reduce((s, v) => s.split(v).join(values[v]), text);
}

const box = (e: ShoutoutElement): CSSProperties => ({ position: 'absolute', left: e.x, top: e.y, width: e.width, height: e.height, boxSizing: 'border-box' });

function lineStyle(t: TextBlock, fontSize: number, fontWeight: string): CSSProperties {
    return {
        fontSize, fontWeight: fontWeight as CSSProperties['fontWeight'],
        color: t.color,
        textShadow: TEXT_SHADOWS[t.shadow] ?? 'none',
        fontFamily: `'${t.fontFamily}', system-ui, sans-serif`,
        margin: 0,
        lineHeight: t.lineHeight,
        whiteSpace: 'nowrap',
        textTransform: t.uppercase ? 'uppercase' : undefined,
        letterSpacing: t.letterSpacing || undefined,
        ...(t.outline.enabled ? { WebkitTextStroke: `${t.outline.width}px ${t.outline.color}`, paintOrder: 'stroke fill' } : {}),
    };
}

function TextElement({ e, data, noGame }: { e: ShoutoutElement; data: ShoutoutData | null; noGame?: string }) {
    const t = e.text;
    if (!t) return null;
    const lines = t.lines.filter(l => l.enabled);
    const items = lines.map((l, i) => (
        <p key={i} style={{ ...lineStyle(t, l.fontSize, l.fontWeight), ...(t.anchor ? {} : { overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }) }}>
            {fillVariables(l.text, data, noGame)}
        </p>
    ));
    if (t.anchor) {
        // Como el viejo: anclado en x (o en su centro), del ancho de la línea más larga, sin cortar
        return (
            <div style={{
                position: 'absolute', top: e.y,
                left: t.align === 'center' ? e.x + e.width / 2 : e.x,
                textAlign: t.align,
                transform: t.align === 'center' ? 'translateX(-50%)' : 'none',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: `${t.gap}px` }}>{items}</div>
            </div>
        );
    }
    return (
        <div style={{
            ...box(e), display: 'flex', flexDirection: 'column', gap: `${t.gap}px`, justifyContent: 'center', overflow: 'hidden', textAlign: t.align,
            alignItems: t.align === 'center' ? 'center' : t.align === 'right' ? 'flex-end' : 'flex-start',
        }}>
            {items}
        </div>
    );
}

function PartnerBadge({ size }: { size: number }) {
    // La insignia de verificado de Twitch
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
            <path fill="#9146ff" d="M12.5 3.5 8 2 3.5 3.5 2 8l1.5 4.5L8 14l4.5-1.5L14 8l-1.5-4.5z" />
            <path fill="#fff" d="M7 11 4.5 8.5l1-1L7 9l3.5-3.5 1 1L7 11z" />
        </svg>
    );
}

function AffiliateBadge({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
            <circle cx="8" cy="8" r="7" fill="#9146ff" />
            <path fill="#fff" d="m8 3.8 1.25 2.55 2.8.4-2.02 1.97.48 2.8L8 10.2l-2.5 1.32.48-2.8L3.95 6.75l2.8-.4L8 3.8z" />
        </svg>
    );
}

function animationCss(a: ShowHideAnimation, entering: boolean): string | undefined {
    if (a.type === 'none') return undefined;
    const dir = ['slide', 'bounce', 'flip'].includes(a.type) ? `-${a.direction}` : '';
    // La entrada no se queda aplicada al terminar (como el viejo: un transform de más cambia el suavizado del texto);
    // la salida sí, para que no reaparezca antes de sacarlo
    return `so-${entering ? 'in' : 'out'}-${a.type}${dir} ${a.durationMs}ms ${a.easing} ${entering ? 'none' : 'forwards'}`;
}

export default function ShoutoutRenderer({ layout, data, phase, remaining = 0, durationSec = 0, preview, videoRef, onVideoEnded, labels }: Props) {
    const { theme, canvas, animations } = layout;
    const panel = layout.elements.find(e => e.kind === 'panel');
    const px = panel?.x ?? 0, py = panel?.y ?? 0, pw = panel?.width ?? canvas.width, ph = panel?.height ?? canvas.height;
    const anim = phase === 'static' ? undefined : animationCss(phase === 'enter' ? animations.enter : animations.exit, phase === 'enter');

    const renderElement = (e: ShoutoutElement) => {
        if (!e.enabled) return null;
        const o = e.options;
        switch (e.kind) {
            case 'panel':
                return (
                    <div key={e.id} style={{
                        ...box(e),
                        borderRadius: theme.radius,
                        border: theme.borderEnabled ? `${theme.borderWidth}px solid ${theme.borderColor}` : 'none',
                        boxShadow: theme.shadow || 'none',
                        background: backgroundCss(theme.background),
                        backdropFilter: theme.blur ? `blur(${theme.blur}px)` : undefined,
                    }} />
                );
            case 'clip': {
                const style: CSSProperties = {
                    ...box(e), borderRadius: o.radius, objectFit: 'cover', backgroundColor: '#000', display: 'block',
                    boxShadow: o.shadow ? '0 4px 12px rgba(0, 0, 0, 0.3)' : undefined,
                    border: o.borderWidth ? `${o.borderWidth}px solid ${o.borderColor}` : undefined,
                };
                if (!preview) {
                    if (!data?.clipUrl) return null;
                    return (
                        <video key={`${e.id}-${data.clipUrl}`} ref={videoRef} autoPlay playsInline style={style} onEnded={onVideoEnded}>
                            <source src={data.clipUrl} type="video/mp4" />
                        </video>
                    );
                }
                // Vista previa: un cuadro con el aspecto de un clip
                return (
                    <div key={e.id} style={{ ...style, overflow: 'hidden', background: `radial-gradient(circle at 30% 30%, ${theme.accent}66, #0b0b12 70%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: Math.min(e.width, e.height) * 0.28, height: Math.min(e.width, e.height) * 0.28, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 0, height: 0, marginLeft: '8%', borderTop: `${Math.min(e.width, e.height) * 0.07}px solid transparent`, borderBottom: `${Math.min(e.width, e.height) * 0.07}px solid transparent`, borderLeft: `${Math.min(e.width, e.height) * 0.11}px solid rgba(255,255,255,0.9)` }} />
                        </div>
                        {labels?.clip && <span style={{ position: 'absolute', left: 12, bottom: 10, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{labels.clip}</span>}
                    </div>
                );
            }
            case 'avatar': {
                if (!data?.profileImageUrl) return null;
                const radius = o.shape === 'circle' ? '50%' : o.shape === 'rounded' ? o.radius : 0;
                return (
                    <div key={e.id} style={{
                        ...box(e), borderRadius: radius, overflow: 'hidden',
                        border: o.borderWidth ? `${o.borderWidth}px solid ${o.borderColor}` : undefined,
                        boxShadow: o.shadow ? '0 4px 12px rgba(0, 0, 0, 0.3)' : undefined,
                    }}>
                        <img src={data.profileImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                );
            }
            case 'text':
                return <TextElement key={e.id} e={e} data={data} noGame={labels?.noGame} />;
            case 'badge': {
                const type = data?.broadcasterType;
                if (type !== 'partner' && !(type === 'affiliate' && o.showAffiliate)) return null;
                const size = Math.min(e.width, e.height);
                return <div key={e.id} style={box(e)}>{type === 'partner' ? <PartnerBadge size={size} /> : <AffiliateBadge size={size} />}</div>;
            }
            case 'live':
                if (!data?.isLive) return null;
                return (
                    <div key={e.id} style={{
                        ...box(e), borderRadius: o.radius, background: o.background, color: o.color,
                        fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: o.fontSize, letterSpacing: 0.5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: o.fontSize * 0.4, whiteSpace: 'nowrap', overflow: 'hidden',
                    }}>
                        <span style={{ width: o.fontSize * 0.45, height: o.fontSize * 0.45, borderRadius: '50%', background: o.color, animation: o.pulse ? 'so-pulse 1.4s ease-in-out infinite' : undefined }} />
                        {o.label}
                    </div>
                );
            case 'progress': {
                // Se vacía en lo que dura el shoutout; quieta, a medio camino
                const running = phase !== 'static' && durationSec > 0;
                return (
                    <div key={e.id} style={{ ...box(e), background: o.track, borderRadius: o.radius, overflow: 'hidden' }}>
                        <div style={{
                            width: '100%', height: '100%', background: o.fill || theme.accent, borderRadius: o.radius, transformOrigin: 'left',
                            transform: running ? undefined : 'scaleX(0.6)',
                            animation: running ? `so-progress ${durationSec}s linear both` : undefined,
                        }} />
                    </div>
                );
            }
            case 'timer':
                return (
                    <div key={e.id} style={{ ...box(e), display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', pointerEvents: 'none' }}>
                        <div style={{
                            backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 20,
                            fontWeight: 'bold', fontFamily: 'monospace', border: '2px solid rgba(255,255,255,0.3)', whiteSpace: 'nowrap', lineHeight: 1.5,
                        }}>
                            ⏱️ {remaining}s
                        </div>
                    </div>
                );
        }
    };

    return (
        <div style={{ position: 'relative', width: canvas.width, height: canvas.height, overflow: 'hidden' }}>
            <div style={{
                position: 'absolute', inset: 0, animation: anim,
                // Deslizar recorre el tamaño del panel y los giros o zooms salen de su centro
                ['--so-w' as any]: `${pw}px`, ['--so-h' as any]: `${ph}px`,
                transformOrigin: `${px + pw / 2}px ${py + ph / 2}px`,
            }}>
                {layout.elements.map(renderElement)}
            </div>
            <style>{SHOUTOUT_KEYFRAMES}</style>
        </div>
    );
}

const DIRS = ['left', 'right', 'top', 'bottom'] as const;

export const SHOUTOUT_KEYFRAMES = `
@keyframes so-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes so-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@keyframes so-in-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes so-out-fade { from { opacity: 1; } to { opacity: 0; } }
@keyframes so-in-fade-scale { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes so-out-fade-scale { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.9); } }
@keyframes so-in-pop { 0% { opacity: 0; transform: scale(0.3); } 50% { opacity: 1; transform: scale(1.05); } 70% { transform: scale(0.9); } 100% { transform: scale(1); } }
@keyframes so-out-pop { 0% { transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0; transform: scale(0.3); } }
@keyframes so-in-zoom { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
@keyframes so-out-zoom { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0); } }
@keyframes so-in-rotate { from { opacity: 0; transform: rotate(-200deg) scale(0); } to { opacity: 1; transform: rotate(0) scale(1); } }
@keyframes so-out-rotate { from { opacity: 1; transform: rotate(0) scale(1); } to { opacity: 0; transform: rotate(200deg) scale(0); } }
@keyframes so-in-glitch {
  0% { opacity: 0; transform: translate(-12px, 0) skewX(12deg); clip-path: inset(40% 0 35% 0); filter: hue-rotate(90deg); }
  15% { opacity: 1; transform: translate(10px, -2px) skewX(-8deg); clip-path: inset(10% 0 60% 0); }
  30% { transform: translate(-8px, 2px); clip-path: inset(70% 0 5% 0); filter: hue-rotate(-60deg); }
  45% { transform: translate(6px, 0) skewX(4deg); clip-path: inset(25% 0 30% 0); }
  60% { transform: translate(-4px, 1px); clip-path: inset(0 0 0 0); filter: hue-rotate(30deg); }
  75% { transform: translate(2px, 0); filter: none; }
  100% { opacity: 1; transform: none; clip-path: inset(0 0 0 0); filter: none; }
}
@keyframes so-out-glitch {
  0% { opacity: 1; transform: none; clip-path: inset(0 0 0 0); filter: none; }
  25% { transform: translate(4px, 0); clip-path: inset(0 0 0 0); filter: hue-rotate(30deg); }
  40% { transform: translate(-6px, 1px) skewX(6deg); clip-path: inset(25% 0 30% 0); }
  55% { transform: translate(8px, -2px); clip-path: inset(70% 0 5% 0); filter: hue-rotate(-60deg); }
  70% { opacity: 1; transform: translate(-10px, 2px) skewX(-8deg); clip-path: inset(10% 0 60% 0); }
  100% { opacity: 0; transform: translate(12px, 0) skewX(12deg); clip-path: inset(45% 0 45% 0); filter: hue-rotate(90deg); }
}
${DIRS.map(d => {
    const axis = d === 'left' || d === 'right' ? 'X' : 'Y';
    const size = axis === 'X' ? 'var(--so-w)' : 'var(--so-h)';
    const sign = d === 'left' || d === 'top' ? -1 : 1;
    const at = (f: number) => `translate${axis}(calc(${size} * ${sign * f}))`;
    const off = at(1), over = at(-0.1), back = at(0.05);
    // Giro 3D: de costado sobre el eje vertical (izquierda/derecha) o el horizontal (arriba/abajo)
    const flip = axis === 'X' ? `perspective(1200px) rotateY(${sign * 90}deg)` : `perspective(1200px) rotateX(${-sign * 90}deg)`;
    return `@keyframes so-in-slide-${d} { from { opacity: 0; transform: ${off}; } to { opacity: 1; transform: none; } }
@keyframes so-out-slide-${d} { from { opacity: 1; transform: none; } to { opacity: 0; transform: ${off}; } }
@keyframes so-in-bounce-${d} { 0% { opacity: 0; transform: ${off}; } 60% { opacity: 1; transform: ${over}; } 80% { transform: ${back}; } 100% { opacity: 1; transform: none; } }
@keyframes so-out-bounce-${d} { 0% { opacity: 1; transform: none; } 20% { transform: ${back}; } 40% { opacity: 1; transform: ${over}; } 100% { opacity: 0; transform: ${off}; } }
@keyframes so-in-flip-${d} { from { opacity: 0; transform: ${flip}; } to { opacity: 1; transform: none; } }
@keyframes so-out-flip-${d} { from { opacity: 1; transform: none; } to { opacity: 0; transform: ${flip}; } }`;
}).join('\n')}
`;
