import type { CSSProperties, Ref } from 'react';
import type { AlertDesign, AlertEventType, AnimationStep, CardBackground, EventAlertData, TextElement, TextLine } from './types';
import { EVENT_EMOJIS } from './defaults';

// Dibuja UNA alerta de Event Alerts a su tamaño real (design.canvas). Lo usan el overlay de OBS, la vista previa
// y el editor, así que los tres se ven idénticos. El que lo muestra más chico lo escala desde afuera. Sin cola
// ni audio: eso queda en el overlay. Las configs viejas convertidas (convertLegacy.ts) se ven igual que el
// overlay viejo: por eso las medidas, sombras y animaciones copiadas tal cual.

export type Phase = 'enter' | 'exit' | 'static';

interface Props {
    /** Ya resuelto para esta alerta (resolveAlertDesign). */
    design: AlertDesign;
    data: EventAlertData | null;
    /** enter / exit corren la animación de entrada o salida; static, nada (editor, vista previa quieta). */
    phase: Phase;
    /** Vista previa y editor: el video va siempre sin sonido y, si la alerta no trae media, se marca su lugar. */
    preview?: boolean;
    /**
     * OBS: cada elemento con position: fixed, como el overlay viejo. Chrome pinta así cada uno en su propia capa y el
     * texto sale con el mismo suavizado (con absolute se ve más nítido y ya no es igual píxel a píxel). Solo sirve
     * con el renderer en la esquina de la página y sin nada escalado encima.
     */
    fixed?: boolean;
    videoRef?: Ref<HTMLVideoElement>;
    /** Vista previa reproduciendo: el video suena con este volumen (0-100); sin esto, mudo como siempre. */
    videoVolume?: number;
}

const TEXT_SHADOWS: Record<string, string> = {
    normal: '1px 1px 4px rgba(0,0,0,0.9)',
    strong: '2px 2px 8px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)',
};

function textShadowCss(shadow: string, color: string): string {
    if (shadow === 'glow') return `0 0 12px ${color}, 0 0 24px ${color}80`;
    return TEXT_SHADOWS[shadow] ?? 'none';
}

export function backgroundCss(bg: CardBackground): string {
    if (bg.type === 'transparent') return 'transparent';
    if (bg.type === 'gradient') return `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.color1}, ${bg.gradient.color2})`;
    if (bg.type === 'image' && bg.image) return `url(${bg.image}) center/cover no-repeat`;
    return bg.color;
}

/** El título de cada evento del overlay viejo (se usa con {title}). */
export function eventTitle(d: EventAlertData): string {
    switch (d.eventType) {
        case 'follow': return `¡${d.username} te siguió!`;
        case 'bits': return `¡${d.username} donó ${d.amount} bits!`;
        case 'subs': return `¡${d.username} se suscribió!`;
        case 'giftSubs': return `¡${d.username} regaló ${d.amount} subs!`;
        case 'raids': return `¡${d.username} raideó con ${d.viewers} viewers!`;
        case 'resubs': return `¡${d.username} renovó su sub! (${d.months} meses)`;
        case 'hypeTrain': return `¡Hype Train nivel ${d.level}!`;
        default: return `¡${d.username}!`;
    }
}

/** Nombre de cada evento para {event}. */
const EVENT_NAMES: Record<AlertEventType, string> = {
    follow: 'Follow', bits: 'Bits', subs: 'Sub', giftSubs: 'Subs regaladas', raids: 'Raid', resubs: 'Resub', hypeTrain: 'Hype Train',
};

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** Valor de cada variable (con los alias que acepta el backend en las plantillas). */
function variableValues(d: EventAlertData | null): Record<string, string> {
    if (!d) return {};
    const name = str(d.username), amount = str(d.amount);
    return {
        username: name, userName: name, user: name, name, donor: name, donorName: name,
        amount, formattedAmount: amount, bits: amount, subs: amount,
        viewers: str(d.viewers ?? d.amount),
        months: str(d.months ?? d.amount),
        level: str(d.level ?? d.amount),
        tier: str(d.tier),
        message: str(d.message),
        emoji: EVENT_EMOJIS[d.eventType as AlertEventType] ?? '🎉',
        title: eventTitle(d),
        event: EVENT_NAMES[d.eventType as AlertEventType] ?? '',
        time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('es'),
    };
}

/** Reemplaza las variables {nombre} de una plantilla; las desconocidas quedan como están. */
export function fillTemplate(template: string, values: Record<string, string>): string {
    return splitTemplate(template, values).join('');
}

/** La plantilla en trozos: cada texto fijo y cada variable por separado. */
function splitTemplate(template: string, values: Record<string, string>): string[] {
    return template.split(/(\{\w+\})/).filter(Boolean).map(part => {
        const key = /^\{(\w+)\}$/.exec(part)?.[1];
        return key && key in values ? values[key] : part;
    });
}

/** Nombre del keyframe viejo que llega en la alerta → tipo de animación ('bounceIn' si no llega, como el viejo). */
function fromEventName(name: string | undefined, entering: boolean): AnimationStep['type'] {
    const n = name ?? (entering ? 'bounceIn' : 'bounceOut');
    const suffix = entering ? 'In' : 'Out';
    if (!n.endsWith(suffix)) return 'none';
    const base = n.slice(0, -suffix.length);
    return base === 'fade' || base === 'slide' || base === 'bounce' || base === 'zoom' ? base : 'none';
}

function animationCss(s: AnimationStep, entering: boolean, data: EventAlertData | null): string | undefined {
    const type = s.type === 'event' ? fromEventName(entering ? data?.animationIn : data?.animationOut, entering) : s.type;
    if (type === 'none') return undefined;
    const withDir = type === 'slide' || type === 'slide-bounce' || type === 'flip';
    // La del evento con dirección configurada (General o el evento): entra y sale por ese lado
    const eventDir = s.type === 'event' && ['left', 'right', 'top', 'bottom'].includes(data?.animationDirection ?? '') ? data!.animationDirection! : null;
    const dir = eventDir ?? s.direction;
    const name = `ea-${type}-${entering ? 'in' : 'out'}${withDir ? `-${dir}` : ''}`;
    // La entrada no se queda aplicada al terminar (como el viejo); la salida sí, para que no reaparezca
    const fill = entering ? (s.delayMs > 0 ? 'backwards' : 'none') : 'forwards';
    return `${name} ${s.durationMs}ms ${s.easing} ${s.delayMs}ms ${fill}`;
}

/** Efecto de la tarjeta (solo el primero, como el viejo), después de la entrada. */
const EFFECTS: Record<string, string> = {
    shake: 'ea-shake 0.5s ease-in-out infinite',
    glow: 'ea-glow 2s ease-in-out infinite',
    float: 'ea-float 2s ease-in-out infinite',
    pulse: 'ea-pulse 1.5s ease-in-out infinite',
    confetti: 'ea-confetti 3s linear infinite',
};

function Line({ line, values }: { line: TextLine; values: Record<string, string> }) {
    if (line.requires && !values[line.requires]) return null;
    return (
        <div style={{
            fontSize: line.fontSize,
            fontWeight: line.fontWeight as CSSProperties['fontWeight'],
            lineHeight: line.lineHeight,
            opacity: line.opacity < 100 ? line.opacity / 100 : undefined,
            marginTop: line.marginTop || undefined,
        }}>
            {/* Un nodo de texto por trozo, como el viejo ({emoji} {title}): juntos cambia el suavizado de algunas letras */}
            {splitTemplate(line.template, values)}
        </div>
    );
}

function Text({ t, values, animation, position }: { t: TextElement; values: Record<string, string>; animation?: string; position: 'absolute' | 'fixed' }) {
    const cross = t.align === 'center' ? 'center' : t.align === 'right' ? 'flex-end' : 'flex-start';
    const main = t.verticalAlign === 'top' ? 'flex-start' : t.verticalAlign === 'bottom' ? 'flex-end' : 'center';
    return (
        <div style={{
            position, left: t.x, top: t.y, width: t.width, height: t.height, boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column', justifyContent: main, alignItems: cross,
            padding: t.padding,
            fontFamily: t.fontFamily,
            color: t.color,
            textShadow: textShadowCss(t.shadow, t.color),
            textAlign: t.align,
            background: t.background && t.background !== 'transparent' ? t.background : undefined,
            borderRadius: t.radius || undefined,
            animation,
        }}>
            {t.lines.map((l, i) => <Line key={i} line={l} values={values} />)}
        </div>
    );
}

/** Dónde caen las partículas: la tarjeta, o lo que ocupe la alerta si no hay tarjeta. */
function particleArea(d: AlertDesign): { x: number; y: number; width: number; height: number } {
    const rects = (d.card.enabled ? [d.card] : [d.media, ...d.texts]).filter(r => r.enabled);
    if (!rects.length) return { x: 0, y: 0, width: d.canvas.width, height: d.canvas.height };
    const x = Math.min(...rects.map(r => r.x)), y = Math.min(...rects.map(r => r.y));
    return { x, y, width: Math.max(...rects.map(r => r.x + r.width)) - x, height: Math.max(...rects.map(r => r.y + r.height)) - y };
}

/** Pseudoazar fijo (el mismo dibujo en OBS, la vista previa y el editor). */
const rand = (i: number, salt: number) => { const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return v - Math.floor(v); };
const CONFETTI_COLORS = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#facc15', '#14b8a6'];
const FIREWORK_COLORS = ['#fde047', '#f472b6', '#60a5fa', '#34d399', '#fb923c'];

/** Confeti que cae sobre la alerta y fuegos artificiales alrededor (arrancan con los efectos, a los 0,7 s). */
function Particles({ kinds, area, position, still }: { kinds: ('confetti' | 'fireworks')[]; area: { x: number; y: number; width: number; height: number }; position: 'absolute' | 'fixed'; still: boolean }) {
    const pad = 120;
    const box = { left: area.x - pad, top: area.y - pad, width: area.width + pad * 2, height: area.height + pad * 2 };
    const play = still ? 'paused' : 'running';
    return (
        <div style={{ position, ...box, pointerEvents: 'none', overflow: 'hidden' }}>
            {kinds.includes('confetti') && Array.from({ length: 48 }, (_, i) => {
                const w = 6 + rand(i, 1) * 6;
                return (
                    <span key={`c${i}`} style={{
                        position: 'absolute', left: `${rand(i, 2) * 100}%`, top: -20, width: w, height: w * 0.45 + 4,
                        background: CONFETTI_COLORS[i % CONFETTI_COLORS.length], borderRadius: 2, opacity: 0,
                        ['--ea-drift' as any]: `${(rand(i, 3) - 0.5) * 160}px`, ['--ea-fall' as any]: `${box.height + 40}px`, ['--ea-spin' as any]: `${360 + rand(i, 4) * 720}deg`,
                        animation: `ea-confetti-fall ${2.2 + rand(i, 5) * 1.8}s linear ${0.7 + rand(i, 6) * 2.4}s infinite`, animationPlayState: play,
                    }} />
                );
            })}
            {kinds.includes('fireworks') && Array.from({ length: 5 }, (_, b) => {
                const cx = 10 + rand(b, 7) * 80, cy = 8 + rand(b, 8) * 45, color = FIREWORK_COLORS[b % FIREWORK_COLORS.length], delay = 0.7 + b * 0.55;
                return Array.from({ length: 22 }, (_, i) => {
                    const ang = (i / 22) * Math.PI * 2, dist = 90 + rand(b * 22 + i, 9) * 70;
                    return (
                        <span key={`f${b}-${i}`} style={{
                            position: 'absolute', left: `${cx}%`, top: `${cy}%`, width: 8, height: 8, borderRadius: '50%', background: color,
                            boxShadow: `0 0 10px 2px ${color}`, opacity: 0,
                            ['--ea-dx' as any]: `${Math.cos(ang) * dist}px`, ['--ea-dy' as any]: `${Math.sin(ang) * dist}px`,
                            animation: `ea-firework 1.4s cubic-bezier(.15,.7,.3,1) ${delay}s infinite`, animationPlayState: play,
                        }} />
                    );
                });
            })}
        </div>
    );
}

export default function EventAlertRenderer({ design, data, phase, preview, fixed, videoRef, videoVolume }: Props) {
    const { canvas, card, media, texts } = design;
    const values = variableValues(data);
    const anim = (a: { enter: AnimationStep; exit: AnimationStep }) =>
        phase === 'static' ? undefined : phase === 'enter' ? animationCss(a.enter, true, data) : animationCss(a.exit, false, data);
    const position = fixed ? 'fixed' : 'absolute';
    // Quieto, el efecto queda en su primer cuadro (igual que el viejo antes de arrancar el efecto)
    // Efectos (todos los elegidos): uno de movimiento (sacudida, flotar o pulso), el brillo y las partículas
    const chosen = phase === 'exit' ? [] : (data?.effects ?? []);
    const motion = chosen.find(e => e === 'shake' || e === 'float' || e === 'pulse');
    const effect = [motion && EFFECTS[motion], chosen.includes('glow') && EFFECTS.glow].filter(Boolean).join(', ') || undefined;
    const particles = chosen.filter((e): e is 'confetti' | 'fireworks' => e === 'confetti' || e === 'fireworks');
    const hasMedia = !!(data?.mediaUrl && media.enabled);
    const mediaStyle: CSSProperties = { width: '100%', height: '100%', objectFit: media.fit };

    return (
        <div style={{ position: 'relative', width: canvas.width, height: canvas.height }}>
            <div style={{
                position: 'absolute', inset: 0, animation: anim(design.animation),
                // La alerta entera gira o crece desde el centro de la tarjeta
                transformOrigin: `${card.x + card.width / 2}px ${card.y + card.height / 2}px`,
            }}>
                {card.enabled && (
                    <div style={{ position, left: card.x, top: card.y, width: card.width, height: card.height, animation: anim(card.animation) }}>
                        <div style={{
                            width: '100%',
                            height: '100%',
                            background: backgroundCss(card.background),
                            opacity: card.opacity / 100,
                            borderRadius: card.radius,
                            border: card.border.enabled ? `${card.border.width}px solid ${card.border.color}` : 'none',
                            boxShadow: card.shadow || 'none',
                            overflow: 'hidden',
                            ...(effect ? { animation: effect, animationDelay: '0.7s', animationFillMode: 'both', animationPlayState: phase === 'static' ? 'paused' : undefined } : {}),
                        }} />
                    </div>
                )}

                {hasMedia && (
                    <div style={{
                        position, left: media.x, top: media.y, width: media.width, height: media.height,
                        overflow: 'hidden', borderRadius: media.radius,
                        opacity: media.opacity < 100 ? media.opacity / 100 : undefined,
                        animation: anim(media.animation),
                    }}>
                        {data!.mediaType === 'video' ? (
                            <video key={data!.mediaUrl} ref={preview ? undefined : videoRef} src={data!.mediaUrl} autoPlay loop muted={!videoVolume}
                                onLoadedMetadata={videoVolume ? e => { e.currentTarget.volume = Math.min(1, videoVolume / 100); } : undefined} style={mediaStyle} />
                        ) : (
                            <img src={data!.mediaUrl} alt="" style={mediaStyle} />
                        )}
                    </div>
                )}

                {preview && !hasMedia && media.enabled && (
                    <div style={{
                        position: 'absolute', left: media.x, top: media.y, width: media.width, height: media.height, boxSizing: 'border-box',
                        borderRadius: media.radius, border: '2px dashed rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.06)',
                        animation: anim(media.animation),
                    }} />
                )}

                {texts.map(t => t.enabled && <Text key={t.id} t={t} values={values} animation={anim(t.animation)} position={position} />)}

                {particles.length > 0 && <Particles kinds={particles} area={particleArea(design)} position={position} still={phase === 'static'} />}
            </div>
            <style>{EVENT_ALERT_KEYFRAMES}</style>
        </div>
    );
}

const DIRS = ['left', 'right', 'top', 'bottom'] as const;

// Las mismas curvas que el overlay viejo (fadeIn, slideIn, bounceIn, zoomIn, sus Out y los efectos)
export const EVENT_ALERT_KEYFRAMES = `
@keyframes ea-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ea-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes ea-bounce-in { 0% { opacity: 0; transform: scale(0.3); } 50% { opacity: 1; transform: scale(1.05); } 70% { transform: scale(0.9); } 100% { transform: scale(1); } }
@keyframes ea-bounce-out { 0% { transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0; transform: scale(0.3); } }
@keyframes ea-zoom-in { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
@keyframes ea-zoom-out { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0); } }
@keyframes ea-shake { 0%, 100% { transform: translateX(0); } 15%, 45%, 75% { transform: translateX(-8px); } 30%, 60%, 90% { transform: translateX(8px); } }
@keyframes ea-glow { 0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,0.5); } 50% { box-shadow: 0 0 40px rgba(255, 215, 0, 0.9), 0 0 80px rgba(255, 215, 0, 0.4); } }
@keyframes ea-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
@keyframes ea-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@keyframes ea-confetti { 0% { background-position: 0% 0%; } 100% { background-position: 0% 200%; } }
@keyframes ea-confetti-fall { 0% { opacity: 1; transform: translate(0, 0) rotate(0deg); } 85% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--ea-drift), var(--ea-fall)) rotate(var(--ea-spin)); } }
@keyframes ea-firework { 0% { opacity: 0; transform: translate(0, 0) scale(0.6); } 8% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--ea-dx), calc(var(--ea-dy) + 30px)) scale(0.3); } }
@keyframes ea-rotate-in { from { opacity: 0; transform: rotate(-200deg) scale(0); } to { opacity: 1; transform: rotate(0) scale(1); } }
@keyframes ea-rotate-out { from { opacity: 1; transform: rotate(0) scale(1); } to { opacity: 0; transform: rotate(200deg) scale(0); } }
@keyframes ea-glitch-in {
  0% { opacity: 0; transform: translate(-12px, 0) skewX(12deg); clip-path: inset(40% 0 35% 0); filter: hue-rotate(90deg); }
  15% { opacity: 1; transform: translate(10px, -2px) skewX(-8deg); clip-path: inset(10% 0 60% 0); }
  30% { transform: translate(-8px, 2px); clip-path: inset(70% 0 5% 0); filter: hue-rotate(-60deg); }
  45% { transform: translate(6px, 0) skewX(4deg); clip-path: inset(25% 0 30% 0); }
  60% { transform: translate(-4px, 1px); clip-path: inset(0 0 0 0); filter: hue-rotate(30deg); }
  100% { opacity: 1; transform: none; clip-path: inset(0 0 0 0); filter: none; }
}
@keyframes ea-glitch-out {
  0% { opacity: 1; transform: none; clip-path: inset(0 0 0 0); filter: none; }
  40% { transform: translate(-6px, 1px) skewX(6deg); clip-path: inset(25% 0 30% 0); }
  55% { transform: translate(8px, -2px); clip-path: inset(70% 0 5% 0); filter: hue-rotate(-60deg); }
  70% { opacity: 1; transform: translate(-10px, 2px) skewX(-8deg); clip-path: inset(10% 0 60% 0); }
  100% { opacity: 0; transform: translate(12px, 0) skewX(12deg); clip-path: inset(45% 0 45% 0); filter: hue-rotate(90deg); }
}
${DIRS.map(d => {
    const axis = d === 'left' || d === 'right' ? 'X' : 'Y';
    const off = `translate${axis}(${d === 'left' || d === 'top' ? '-' : ''}100%)`;
    const sign = d === 'left' || d === 'top' ? '-' : '';
    const over = `translate${axis}(${sign ? '' : '-'}8%)`, back = `translate${axis}(${sign}3%)`;
    const flip = axis === 'X' ? `perspective(1200px) rotateY(${sign ? '-' : ''}90deg)` : `perspective(1200px) rotateX(${sign ? '' : '-'}90deg)`;
    return `@keyframes ea-slide-in-${d} { from { opacity: 0; transform: ${off}; } to { opacity: 1; transform: translate${axis}(0); } }
@keyframes ea-slide-out-${d} { from { opacity: 1; transform: translate${axis}(0); } to { opacity: 0; transform: ${off}; } }
@keyframes ea-slide-bounce-in-${d} { 0% { opacity: 0; transform: ${off}; } 60% { opacity: 1; transform: ${over}; } 80% { transform: ${back}; } 100% { opacity: 1; transform: none; } }
@keyframes ea-slide-bounce-out-${d} { 0% { opacity: 1; transform: none; } 20% { transform: ${back}; } 40% { opacity: 1; transform: ${over}; } 100% { opacity: 0; transform: ${off}; } }
@keyframes ea-flip-in-${d} { from { opacity: 0; transform: ${flip}; } to { opacity: 1; transform: none; } }
@keyframes ea-flip-out-${d} { from { opacity: 1; transform: none; } to { opacity: 0; transform: ${flip}; } }`;
}).join('\n')}
`;
