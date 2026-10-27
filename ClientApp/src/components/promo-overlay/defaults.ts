import { step } from '../event-alert-overlay/defaults';
import { DEFAULT_FONT } from './fonts';
import type {
    Border, ElementAnimation, Fill, Glow, IconElement, ImageElement, Loop, PromoDesign, PromoElement, PromoElementKind,
    QrElement, ShapeElement, TextElement, TextShadow,
} from './types';
import { PROMO_DESIGN_VERSION } from './types';

let counter = 0;
/** Identificador estable y corto de un elemento nuevo. */
export const newElementId = () => `e${Date.now().toString(36)}${(counter++).toString(36)}`;

export const noLoop = (): Loop => ({ type: 'none', durationMs: 2000, delayMs: 0 });

export const fadeAnimation = (enterMs = 500, exitMs = 350, delayMs = 0): ElementAnimation => ({
    enter: step({ type: 'fade', durationMs: enterMs, delayMs }), exit: step({ type: 'fade', direction: 'right', durationMs: exitMs, easing: 'ease-in' }),
});
export const noAnimation = (): ElementAnimation => ({ enter: step(), exit: step({ direction: 'right' }) });

export const solid = (color: string): Fill => ({ type: 'color', color, gradient: { color1: color, color2: color, angle: 135 } });
export const gradient = (color1: string, color2: string, angle = 135): Fill => ({ type: 'gradient', color: color1, gradient: { color1, color2, angle } });
export const clear = (): Fill => ({ type: 'transparent', color: '#000000', gradient: { color1: '#000000', color2: '#000000', angle: 135 } });
export const noBorder = (): Border => ({ enabled: false, color: '#ffffff', width: 1 });
export const border = (color: string, width = 1): Border => ({ enabled: true, color, width });
export const noGlow = (): Glow => ({ enabled: false, color: '#3b82f6', blur: 24 });
export const glow = (color: string, blur = 24): Glow => ({ enabled: true, color, blur });

/** Sombras de caja ('' = ninguna). */
export const BOX_SHADOWS: { id: string; css: string }[] = [
    { id: 'none', css: '' },
    { id: 'soft', css: '0 6px 20px rgba(0,0,0,0.35)' },
    { id: 'normal', css: '0 10px 32px rgba(0,0,0,0.5)' },
    { id: 'strong', css: '0 16px 48px rgba(0,0,0,0.7)' },
    { id: 'hard', css: '6px 6px 0 rgba(0,0,0,0.6)' },
];

export const TEXT_SHADOWS: TextShadow[] = ['none', 'soft', 'normal', 'strong', 'glow'];
export const LOOP_TYPES = ['none', 'pulse', 'float', 'breathe', 'glow', 'sway', 'spin', 'blink'] as const;
export const SHAPE_CUTS = ['none', 'slant-right', 'slant-left', 'slant-both', 'corners'] as const;

export function textShadowCss(shadow: TextShadow, glowColor: string): string | undefined {
    switch (shadow) {
        case 'soft': return '0 1px 4px rgba(0,0,0,0.45)';
        case 'normal': return '0 2px 8px rgba(0,0,0,0.65)';
        case 'strong': return '0 3px 14px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)';
        case 'glow': return `0 0 10px ${glowColor}, 0 0 22px ${glowColor}`;
        default: return undefined;
    }
}

const base = (name: string, rect: { x: number; y: number; width: number; height: number }, animation: ElementAnimation = fadeAnimation()) => ({
    id: newElementId(), name, enabled: true, ...rect, rotation: 0, opacity: 100, animation, loop: noLoop(),
});

export function newShape(patch: Partial<ShapeElement> = {}): ShapeElement {
    return {
        ...base('Forma', { x: 20, y: 20, width: 160, height: 80 }), kind: 'shape', fill: solid('#1b2236'), border: noBorder(), radius: 16, cut: 'none', cutSize: 24,
        shadow: '', glow: noGlow(), backdropBlur: 0, ...patch,
    };
}
export function newImage(patch: Partial<ImageElement> = {}): ImageElement {
    return { ...base('Imagen', { x: 20, y: 20, width: 96, height: 96 }), kind: 'image', source: 'piece', ref: '', fit: 'contain', radius: 0, border: noBorder(), shadow: '', glow: noGlow(), ...patch };
}
export function newIcon(patch: Partial<IconElement> = {}): IconElement {
    return { ...base('Icono', { x: 20, y: 20, width: 56, height: 56 }), kind: 'icon', source: 'piece', icon: 'megaphone', color: '#ffffff', strokeWidth: 2, glow: noGlow(), ...patch };
}
export function newText(patch: Partial<TextElement> = {}): TextElement {
    return {
        ...base('Texto', { x: 20, y: 20, width: 280, height: 48 }), kind: 'text', template: '{{title}}', fontFamily: DEFAULT_FONT, fontSize: 28, fontWeight: 700, color: '#ffffff',
        align: 'left', verticalAlign: 'center', lineHeight: 1.15, letterSpacing: 0, italic: false, uppercase: false, maxLines: 0, shadow: 'none', glowColor: '#3b82f6',
        fill: clear(), border: noBorder(), radius: 0, padding: 0, ...patch,
    };
}
export function newQr(patch: Partial<QrElement> = {}): QrElement {
    return { ...base('QR', { x: 20, y: 20, width: 96, height: 96 }), kind: 'qr', color: '#06080e', background: '#ffffff', radius: 12, padding: 6, border: noBorder(), ...patch };
}

export function newElement(kind: PromoElementKind): PromoElement {
    return { shape: newShape, image: newImage, icon: newIcon, text: newText, qr: newQr }[kind]();
}

/** Un diseño vacío del tamaño pedido. */
export function emptyDesign(width = 420, height = 130): PromoDesign {
    return { version: PROMO_DESIGN_VERSION, canvas: { width, height }, elements: [], animation: noAnimation() };
}

/**
 * Punto de partida de una plantilla nueva (fondo, imagen, título y texto), para tener algo que editar. No es el diseño
 * final: los de fábrica se arman en el editor.
 */
export function starterDesign(zone: 'corner' | 'banner' = 'corner'): PromoDesign {
    const wide = zone === 'banner';
    const w = wide ? 1200 : 420, h = wide ? 100 : 130;
    const d = emptyDesign(w, h);
    d.animation = { enter: step({ type: 'slide', direction: wide ? 'bottom' : 'right', durationMs: 600 }), exit: step({ type: 'fade', direction: 'right', durationMs: 400, easing: 'ease-in' }) };
    d.elements = [
        newShape({ name: 'Fondo', x: 0, y: 0, width: w, height: h, radius: wide ? h / 2 : 20, fill: gradient('#1d2740', '#0b1020'), border: border('rgba(120,160,255,0.35)', 1), shadow: BOX_SHADOWS[2].css }),
        newImage({ name: 'Imagen', x: wide ? 14 : 16, y: wide ? 14 : 16, width: wide ? 72 : 98, height: wide ? 72 : 98, radius: wide ? 36 : 16 }),
        newText({ name: 'Título', template: '{{title}}', x: wide ? 108 : 132, y: wide ? 14 : 20, width: wide ? 520 : 272, height: wide ? 72 : 44, fontSize: wide ? 34 : 26, fontWeight: 800 }),
        newText({ name: 'Texto', template: '{{body}}', x: wide ? 640 : 132, y: wide ? 14 : 66, width: wide ? 440 : 272, height: wide ? 72 : 48, fontSize: wide ? 20 : 15, fontWeight: 500, color: '#b9c6e4', verticalAlign: wide ? 'center' : 'top', maxLines: 2 }),
        newQr({ name: 'QR', x: wide ? 1100 : 320, y: wide ? 12 : 16, width: wide ? 76 : 84, height: wide ? 76 : 84 }),
    ];
    return d;
}
