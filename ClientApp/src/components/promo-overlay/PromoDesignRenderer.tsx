import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { EVENT_ALERT_KEYFRAMES } from '../event-alert-overlay/EventAlertRenderer';
import type { AnimationStep } from '../event-alert-overlay/types';
import { PROMO_ICONS } from '../promo/icons';
import { textShadowCss } from './defaults';
import { nearestWeight, usePromoFonts } from './fonts';
import type {
    Fill, Glow, ImageElement, IconElement, Loop, PromoContent, PromoDesign, PromoElement, PromoVars, QrElement, ShapeElement, TextElement,
} from './types';

export type Phase = 'enter' | 'exit' | 'static';

/** Resuelve una imagen de la biblioteca ("asset:<id>" o "builtin:<clave>") a su dirección; en OBS sale de /api/brand. */
export type ResolveImage = (ref: string | null | undefined) => { url: string } | null;

/** Animaciones continuas (las de entrada y salida son las de Event Alerts, ea-*). */
export const PROMO_LOOP_KEYFRAMES = `
@keyframes pd-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@keyframes pd-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes pd-breathe { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
@keyframes pd-glow { 0%, 100% { filter: drop-shadow(0 0 2px var(--pd-glow)); } 50% { filter: drop-shadow(0 0 16px var(--pd-glow)); } }
@keyframes pd-sway { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@keyframes pd-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes pd-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`;

const fillCss = (f: Fill): string | undefined =>
    f.type === 'transparent' ? undefined : f.type === 'gradient' ? `linear-gradient(${f.gradient.angle}deg, ${f.gradient.color1}, ${f.gradient.color2})` : f.color;

/** Variables {{x}} de una plantilla; las desconocidas quedan como están. */
export function fillTemplate(template: string, values: Record<string, string>): string {
    return template.replace(/\{\{\s*([A-Za-z_]+)\s*\}\}/g, (all, key: string) => (key.toLowerCase() in values ? values[key.toLowerCase()] : all));
}

/** Los valores de las variables: título y texto de la pieza (ya con sus variables) más canal, comandos y enlace. */
export function templateValues(content: PromoContent, vars: PromoVars): Record<string, string> {
    return { title: fillTemplate(content.title, vars as unknown as Record<string, string>), body: fillTemplate(content.body, vars as unknown as Record<string, string>), channel: vars.channel, commands: vars.commands, link: vars.link };
}

function stepCss(s: AnimationStep, entering: boolean): string | undefined {
    if (s.type === 'none' || s.type === 'event') return undefined;
    const withDir = s.type === 'slide' || s.type === 'slide-bounce' || s.type === 'flip';
    const name = `ea-${s.type}-${entering ? 'in' : 'out'}${withDir ? `-${s.direction}` : ''}`;
    const fill = entering ? (s.delayMs > 0 ? 'backwards' : 'none') : 'forwards';
    return `${name} ${s.durationMs}ms ${s.easing} ${s.delayMs}ms ${fill}`;
}

const loopCss = (l: Loop): string | undefined => (l.type === 'none' ? undefined : `pd-${l.type} ${l.durationMs}ms ${l.type === 'spin' ? 'linear' : 'ease-in-out'} ${l.delayMs}ms infinite`);

function glowShadow(g: Glow): string | undefined { return g.enabled ? `0 0 ${g.blur}px ${g.color}` : undefined; }
/** drop-shadow() a partir de una sombra preset ("x y blur color") y del brillo. */
function imageFilter(shadow: string, g: Glow): string | undefined {
    const parts: string[] = [];
    if (shadow) parts.push(`drop-shadow(${shadow})`);
    if (g.enabled) parts.push(`drop-shadow(0 0 ${g.blur}px ${g.color})`);
    return parts.length ? parts.join(' ') : undefined;
}
function joinShadows(...s: (string | undefined)[]): string | undefined { const j = s.filter(Boolean).join(', '); return j || undefined; }

function clipPath(e: ShapeElement): string | undefined {
    const c = Math.min(e.cutSize, e.width / 2, e.height);
    switch (e.cut) {
        case 'slant-right': return `polygon(0 0, 100% 0, calc(100% - ${c}px) 100%, 0 100%)`;
        case 'slant-left': return `polygon(${c}px 0, 100% 0, 100% 100%, 0 100%)`;
        case 'slant-both': return `polygon(${c}px 0, 100% 0, calc(100% - ${c}px) 100%, 0 100%)`;
        case 'corners': return `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`;
        default: return undefined;
    }
}

function Qr({ e, link }: { e: QrElement; link: string }) {
    const [src, setSrc] = useState<string | null>(null);
    useEffect(() => {
        let alive = true;
        // Nivel L: el overlay es una imagen limpia (nada que corregir) y así el enlace corto del QR sigue en 25 módulos; con M pasaba a 29 y cada módulo salía más chico.
        QRCode.toDataURL(link, { margin: 0, width: 360, errorCorrectionLevel: 'L', color: { dark: e.color, light: e.background } })
            .then(u => { if (alive) setSrc(u); }).catch(() => { if (alive) setSrc(null); });
        return () => { alive = false; };
    }, [link, e.color, e.background]);
    return (
        <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding: e.padding, background: e.background, borderRadius: e.radius, border: e.border.enabled ? `${e.border.width}px solid ${e.border.color}` : undefined }}>
            {src && <img src={src} alt="" style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }} />}
        </div>
    );
}

interface ElementCtx { content: PromoContent; values: Record<string, string>; resolveImage: ResolveImage; editing: boolean }

/** El contenido de un elemento, sin posición ni animación. Devuelve null si no hay nada que dibujar. */
function renderBody(e: PromoElement, c: ElementCtx): ReactNode {
    switch (e.kind) {
        case 'shape': {
            const style: CSSProperties = {
                width: '100%', height: '100%', boxSizing: 'border-box', background: fillCss(e.fill), borderRadius: e.radius,
                border: e.border.enabled ? `${e.border.width}px solid ${e.border.color}` : undefined, boxShadow: joinShadows(e.shadow || undefined, glowShadow(e.glow)),
                backdropFilter: e.backdropBlur > 0 ? `blur(${e.backdropBlur}px)` : undefined, WebkitBackdropFilter: e.backdropBlur > 0 ? `blur(${e.backdropBlur}px)` : undefined,
                clipPath: clipPath(e),
            };
            return <div style={style} />;
        }
        case 'image': {
            const url = e.source === 'piece' ? c.content.imageUrl : c.resolveImage(e.ref)?.url ?? null;
            if (!url) return c.editing ? <Placeholder radius={e.radius} /> : null;
            // Con filter (y no box-shadow) el brillo y la sombra siguen la silueta de la imagen, no su caja: así sirven con PNG transparentes.
            return <img src={url} alt="" draggable={false} style={{
                width: '100%', height: '100%', display: 'block', objectFit: e.fit, borderRadius: e.radius, boxSizing: 'border-box',
                border: e.border.enabled ? `${e.border.width}px solid ${e.border.color}` : undefined, filter: imageFilter(e.shadow, e.glow),
            }} />;
        }
        case 'icon': {
            const name = e.source === 'piece' ? c.content.icon : e.icon;
            const Icon = name ? PROMO_ICONS[name] : undefined;
            if (!Icon) return c.editing ? <Placeholder radius={8} /> : null;
            return <Icon aria-hidden style={{ width: '100%', height: '100%', color: e.color, strokeWidth: e.strokeWidth, filter: e.glow.enabled ? `drop-shadow(0 0 ${e.glow.blur / 2}px ${e.glow.color})` : undefined }} />;
        }
        case 'text': {
            let text = fillTemplate(e.template, c.values).trim();
            if (!text) return null;
            if (/\{\{\s*[A-Za-z_]+\s*\}\}/.test(text) && !c.editing) text = text.replace(/\{\{\s*[A-Za-z_]+\s*\}\}/g, '').trim();
            if (!text) return null;
            return (
                <div style={{
                    width: '100%', height: '100%', boxSizing: 'border-box', display: 'flex', alignItems: e.verticalAlign === 'top' ? 'flex-start' : e.verticalAlign === 'bottom' ? 'flex-end' : 'center',
                    justifyContent: e.align === 'left' ? 'flex-start' : e.align === 'right' ? 'flex-end' : 'center', padding: e.padding, background: fillCss(e.fill), borderRadius: e.radius,
                    border: e.border.enabled ? `${e.border.width}px solid ${e.border.color}` : undefined,
                }}>
                    <div style={{
                        maxWidth: '100%', color: e.color, fontFamily: `'${e.fontFamily}', system-ui, sans-serif`, fontSize: e.fontSize, fontWeight: nearestWeight(e.fontFamily, e.fontWeight), lineHeight: e.lineHeight,
                        letterSpacing: e.letterSpacing || undefined, fontStyle: e.italic ? 'italic' : undefined, textTransform: e.uppercase ? 'uppercase' : undefined, textAlign: e.align,
                        textShadow: textShadowCss(e.shadow, e.glowColor), overflowWrap: 'anywhere',
                        ...(e.maxLines > 0 ? { display: '-webkit-box', WebkitBoxOrient: 'vertical' as const, WebkitLineClamp: e.maxLines, overflow: 'hidden' } : {}),
                    }}>{text}</div>
                </div>
            );
        }
        case 'qr': {
            const link = c.content.showQr ? (c.content.qrLink || c.content.link) : null;
            if (!link) return c.editing ? <Placeholder radius={e.radius} label="QR" /> : null;
            return <Qr e={e} link={link} />;
        }
    }
}

function Placeholder({ radius, label }: { radius: number; label?: string }) {
    return <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', border: '2px dashed rgba(255,255,255,0.35)', borderRadius: radius, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'system-ui' }}>{label}</div>;
}

const glowColorOf = (e: PromoElement): string => ('glow' in e && e.glow.color) || '#3b82f6';

interface Props {
    design: PromoDesign;
    content: PromoContent;
    vars: PromoVars;
    resolveImage: ResolveImage;
    phase?: Phase;
    /** Editor: lo que no tiene dato (imagen, icono, QR) se dibuja como un marcador en vez de desaparecer. */
    editing?: boolean;
}

/**
 * Dibuja un diseño a su tamaño real (el lienzo es la ficha). Cada elemento va en tres capas para que sus transformaciones no se
 * pisen: la de fuera hace la entrada/salida, la del medio la animación continua y la de dentro la rotación fija.
 */
export default function PromoDesignRenderer({ design, content, vars, resolveImage, phase = 'static', editing = false }: Props) {
    usePromoFonts(design);
    const values = templateValues(content, vars);
    const ctx: ElementCtx = { content, values, resolveImage, editing };
    const anim = (a: { enter: AnimationStep; exit: AnimationStep }) => (phase === 'static' ? undefined : phase === 'enter' ? stepCss(a.enter, true) : stepCss(a.exit, false));
    const animate = phase !== 'exit';

    return (
        <div style={{ position: 'relative', width: design.canvas.width, height: design.canvas.height, animation: anim(design.animation) }}>
            <style>{`${EVENT_ALERT_KEYFRAMES}\n${PROMO_LOOP_KEYFRAMES}`}</style>
            {design.elements.map(e => {
                if (!e.enabled) return null;
                const body = renderBody(e, ctx);
                if (body === null) return null;
                return (
                    <div key={e.id} style={{ position: 'absolute', left: e.x, top: e.y, width: e.width, height: e.height, opacity: e.opacity < 100 ? e.opacity / 100 : undefined, animation: anim(e.animation) }}>
                        <div style={{ width: '100%', height: '100%', animation: animate ? loopCss(e.loop) : undefined, ['--pd-glow' as string]: glowColorOf(e) }}>
                            <div style={{ width: '100%', height: '100%', transform: e.rotation ? `rotate(${e.rotation}deg)` : undefined }}>{body}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
