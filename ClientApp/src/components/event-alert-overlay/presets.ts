import type { AlertDesign, CardElement, ElementAnimation, TextElement, TextLine, TextShadow } from './types';
import { step } from './defaults';

// Diseños prearmados (dónde va cada cosa) y temas de color (cómo se ve) para Event Alerts (fase 3). Se aplican al
// diseño que se está editando; los diseños conservan la fuente y los colores que ya tenía, y los temas solo pintan.

export type LayoutPresetId = 'classic' | 'banner' | 'side' | 'bigText' | 'corner';

const anim = (enterType: ElementAnimation['enter']['type'], exitType: ElementAnimation['exit']['type'], direction: ElementAnimation['enter']['direction'] = 'bottom', delayMs = 0): ElementAnimation => ({
    enter: step({ type: enterType, direction, durationMs: 600, easing: 'ease-out', delayMs }),
    exit: step({ type: exitType, direction, durationMs: 450, easing: 'ease-in' }),
});

const line = (template: string, fontSize: number, fontWeight?: string, extra: Partial<TextLine> = {}): TextLine =>
    ({ template, fontSize, fontWeight, lineHeight: 1.25, opacity: 100, marginTop: 0, ...extra });

function text(id: string, rect: { x: number; y: number; width: number; height: number }, lines: TextLine[], base: Pick<TextElement, 'fontFamily' | 'color' | 'shadow'>, patch: Partial<TextElement> = {}): TextElement {
    return {
        id, ...rect, enabled: true, lines, fontFamily: base.fontFamily, color: base.color, align: 'center', verticalAlign: 'center',
        shadow: base.shadow, background: 'transparent', padding: 0, radius: 0, animation: anim('fade', 'fade', 'bottom', 150), ...patch,
    };
}

/** Un diseño prearmado centrado en el lienzo, con la fuente, colores y tarjeta del diseño actual. */
export function buildLayoutPreset(id: LayoutPresetId, current: AlertDesign, anchor?: { x: number; y: number }): AlertDesign {
    const { width: W, height: H } = current.canvas;
    // Centro del diseño: la "posición por defecto" de General (hasta 100 = % del lienzo; más = píxeles), o el centro
    const ax = anchor ? (anchor.x <= 100 ? (anchor.x / 100) * W : anchor.x) : W / 2;
    const ay = anchor ? (anchor.y <= 100 ? (anchor.y / 100) * H : anchor.y) : H / 2;
    const main = current.texts[0];
    const base = { fontFamily: main?.fontFamily ?? "'Inter', sans-serif", color: main?.color ?? '#ffffff', shadow: (main?.shadow ?? 'normal') as TextShadow };
    const card = (rect: { x: number; y: number; width: number; height: number }, patch: Partial<CardElement> = {}): CardElement =>
        ({ ...current.card, ...rect, enabled: true, animation: anim('slide-bounce', 'fade', 'bottom'), ...patch });
    const media = (rect: { x: number; y: number; width: number; height: number }, enabled = true) =>
        ({ ...current.media, ...rect, enabled, animation: anim('zoom', 'fade', 'bottom', 100) });
    const clamp = (v: number, size: number, max: number) => Math.round(Math.max(0, Math.min(max - size, v)));
    const cx = (w: number) => clamp(ax - w / 2, w, W);
    const cy = (h: number) => clamp(ay - h / 2, h, H);

    switch (id) {
        case 'classic': {
            const w = 600, h = 500, x = cx(w), y = cy(h);
            return {
                ...current, followAlertStyle: false, animation: anim('none', 'none'),
                card: card({ x, y, width: w, height: h }, { radius: 24 }),
                media: media({ x: x + 30, y: y + 30, width: w - 60, height: 240 }),
                texts: [
                    text('main', { x: x + 30, y: y + 290, width: w - 60, height: 90 }, [line('{emoji} {title}', 30, 'bold')], base),
                    text('msg', { x: x + 30, y: y + 385, width: w - 60, height: 90 }, [line('{message}', 22, undefined, { opacity: 85, requires: 'message' })], base),
                ],
            };
        }
        case 'banner': {
            const w = 1100, h = 150, x = cx(w), y = anchor ? cy(h) : H - h - 60;
            return {
                ...current, followAlertStyle: false, animation: anim('none', 'none'),
                card: card({ x, y, width: w, height: h }, { radius: 75, animation: anim('slide-bounce', 'slide', 'bottom') }),
                media: media({ x: x + 15, y: y + 15, width: 120, height: 120 }),
                texts: [
                    text('main', { x: x + 160, y: y + 18, width: w - 190, height: 64 }, [line('{title}', 36, '800')], base, { align: 'left' }),
                    text('msg', { x: x + 160, y: y + 82, width: w - 190, height: 50 }, [line('{message}', 22, undefined, { opacity: 85, requires: 'message' })], base, { align: 'left' }),
                ],
            };
        }
        case 'side': {
            const w = 820, h = 280, x = cx(w), y = cy(h);
            return {
                ...current, followAlertStyle: false, animation: anim('none', 'none'),
                card: card({ x, y, width: w, height: h }, { radius: 20, animation: anim('slide', 'slide', 'left') }),
                media: media({ x: x + 20, y: y + 20, width: 340, height: h - 40 }),
                texts: [
                    text('event', { x: x + 380, y: y + 30, width: w - 400, height: 40 }, [line('{emoji} {event}', 22, '600', { opacity: 80 })], base, { align: 'left' }),
                    text('main', { x: x + 380, y: y + 80, width: w - 400, height: 90 }, [line('{username}', 44, '900')], base, { align: 'left' }),
                    text('msg', { x: x + 380, y: y + 175, width: w - 400, height: 80 }, [line('{message}', 22, undefined, { opacity: 85, requires: 'message' })], base, { align: 'left', verticalAlign: 'top' }),
                ],
            };
        }
        case 'bigText': {
            const w = 1200, h = 360, x = cx(w), y = cy(h);
            return {
                ...current, followAlertStyle: false, animation: anim('none', 'none'),
                card: card({ x, y, width: w, height: h }, { enabled: false }),
                media: media({ x: cx(220), y: y - 10, width: 220, height: 160 }),
                texts: [
                    text('main', { x, y: y + 160, width: w, height: 110 }, [line('{username}', 84, '900')], { ...base, shadow: 'strong' }, { animation: anim('slide-bounce', 'zoom', 'bottom') }),
                    text('msg', { x, y: y + 270, width: w, height: 70 }, [line('{title}', 34, '700')], { ...base, shadow: 'strong' }, { animation: anim('fade', 'fade', 'bottom', 250) }),
                ],
            };
        }
        case 'corner': {
            const w = 460, h = 140, x = W - w - 40, y = 40;
            return {
                ...current, followAlertStyle: false, animation: anim('none', 'none'),
                card: card({ x, y, width: w, height: h }, { radius: 18, animation: anim('slide', 'slide', 'right') }),
                media: media({ x: x + 12, y: y + 12, width: 116, height: 116 }),
                texts: [
                    text('main', { x: x + 140, y: y + 16, width: w - 156, height: 60 }, [line('{username}', 28, '800')], base, { align: 'left', animation: anim('fade', 'fade', 'right', 200) }),
                    text('msg', { x: x + 140, y: y + 76, width: w - 156, height: 48 }, [line('{emoji} {event}', 20, '600', { opacity: 85 })], base, { align: 'left', animation: anim('fade', 'fade', 'right', 300) }),
                ],
            };
        }
    }
}

export const LAYOUT_PRESET_IDS: LayoutPresetId[] = ['classic', 'banner', 'side', 'bigText', 'corner'];

export interface ColorTheme {
    id: string;
    swatch: string[];
    card: Partial<Pick<CardElement, 'opacity' | 'radius' | 'shadow'>> & { background: CardElement['background']; border: CardElement['border'] };
    textColor: string;
    textShadow: TextShadow;
}

const bg = (type: CardElement['background']['type'], color: string, c1 = color, c2 = color, angle = 135): CardElement['background'] =>
    ({ type, color, gradient: { color1: c1, color2: c2, angle }, image: '' });

export const COLOR_THEMES: ColorTheme[] = [
    { id: 'twitch', swatch: ['#9146ff', '#5c16c5', '#ffffff'], textColor: '#ffffff', textShadow: 'normal',
        card: { background: bg('gradient', '#9146ff', '#9146ff', '#5c16c5'), border: { enabled: false, color: '#ffffff', width: 2 }, opacity: 100, shadow: '0 12px 40px rgba(0,0,0,0.45)' } },
    { id: 'night', swatch: ['#0f0f14', '#1f2937', '#9146ff'], textColor: '#f8fafc', textShadow: 'none',
        card: { background: bg('color', 'rgba(15,15,20,0.92)'), border: { enabled: true, color: 'rgba(255,255,255,0.12)', width: 1 }, opacity: 100, shadow: '0 8px 32px rgba(0,0,0,0.5)' } },
    { id: 'neon', swatch: ['#07070c', '#39ff14', '#00e5ff'], textColor: '#ffffff', textShadow: 'glow',
        card: { background: bg('color', 'rgba(7,7,12,0.94)'), border: { enabled: true, color: '#39ff14', width: 2 }, opacity: 100, shadow: '0 0 28px rgba(57,255,20,0.35)' } },
    { id: 'sunset', swatch: ['#f97316', '#db2777', '#ffffff'], textColor: '#ffffff', textShadow: 'normal',
        card: { background: bg('gradient', '#f97316', '#f97316', '#db2777'), border: { enabled: false, color: '#ffffff', width: 2 }, opacity: 100, shadow: '0 12px 40px rgba(0,0,0,0.4)' } },
    { id: 'ice', swatch: ['#0ea5e9', '#6366f1', '#ffffff'], textColor: '#ffffff', textShadow: 'normal',
        card: { background: bg('gradient', '#0ea5e9', '#0ea5e9', '#6366f1'), border: { enabled: false, color: '#ffffff', width: 2 }, opacity: 100, shadow: '0 12px 40px rgba(0,0,0,0.4)' } },
    { id: 'glass', swatch: ['#ffffff33', '#94a3b8', '#ffffff'], textColor: '#ffffff', textShadow: 'strong',
        card: { background: bg('color', 'rgba(255,255,255,0.12)'), border: { enabled: true, color: 'rgba(255,255,255,0.3)', width: 1 }, opacity: 100, shadow: '0 8px 32px rgba(0,0,0,0.25)' } },
    { id: 'transparent', swatch: ['#00000000', '#ffffff', '#000000'], textColor: '#ffffff', textShadow: 'strong',
        card: { background: bg('transparent', 'transparent'), border: { enabled: false, color: '#ffffff', width: 2 }, opacity: 100, shadow: '' } },
];

export function applyColorTheme(d: AlertDesign, c: ColorTheme): AlertDesign {
    return {
        ...d,
        followAlertStyle: false,
        card: { ...d.card, ...c.card, background: { ...c.card.background }, border: { ...c.card.border } },
        texts: d.texts.map(t => ({ ...t, color: c.textColor, shadow: c.textShadow })),
    };
}
