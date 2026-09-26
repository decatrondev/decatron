import type { ShoutoutElement, ShoutoutLayout, ShoutoutTheme, TextBlock, TextLine } from './types';
import { element, emptyLayout, textBlock } from './defaults';

// Diseños prearmados (dónde va cada cosa) y temas de color (cómo se ve). Se aplican desde la pestaña Tema.

export type PresetId = 'classic' | 'vertical' | 'clipTitle' | 'bar' | 'textOnly';

const line = (text: string, fontSize: number, fontWeight = 'bold'): TextLine => ({ text, fontSize, fontWeight, enabled: true });
const text = (lines: TextLine[], patch: Partial<TextBlock> = {}) => textBlock({ lines, gap: 4, shadow: 'normal', ...patch });

function build(canvas: { width: number; height: number }, elements: ShoutoutElement[], theme: Partial<ShoutoutTheme> = {}): ShoutoutLayout {
    const l = emptyLayout();
    l.canvas = canvas;
    l.elements = elements;
    l.theme = { ...l.theme, shadow: '0 10px 30px rgba(0, 0, 0, 0.35)', ...theme };
    l.animations = {
        enter: { type: 'slide', direction: 'left', durationMs: 600, easing: 'ease-out' },
        exit: { type: 'fade', direction: 'right', durationMs: 400, easing: 'ease-in' },
    };
    return l;
}

const timer = (x: number) => element('timer', 'timer', { x, y: 10, width: 160, height: 46 }, { enabled: false });

export const LAYOUT_PRESETS: { id: PresetId; build: () => ShoutoutLayout }[] = [
    {
        id: 'classic',
        build: () => build({ width: 1000, height: 300 }, [
            element('panel', 'panel', { x: 0, y: 0, width: 1000, height: 300 }),
            element('clip', 'clip', { x: 20, y: 20, width: 400, height: 260 }, { options: { radius: 14 } }),
            element('avatar', 'avatar', { x: 452, y: 36, width: 104, height: 104 }),
            element('text', 'text', { x: 576, y: 40, width: 400, height: 96 }, { text: text([line('@displayname', 38), line('🎮 @game', 22, '600')]) }),
            element('text-2', 'text', { x: 452, y: 168, width: 524, height: 70 }, { text: text([line('¡Pasen a seguirle y a dejarle mucho amor! 💜', 22, '600')], { shadow: 'normal' }) }),
            element('progress', 'progress', { x: 452, y: 262, width: 524, height: 8 }),
            timer(830),
        ]),
    },
    {
        id: 'vertical',
        build: () => build({ width: 420, height: 580 }, [
            element('panel', 'panel', { x: 0, y: 0, width: 420, height: 580 }),
            element('clip', 'clip', { x: 16, y: 16, width: 388, height: 218 }, { options: { radius: 14 } }),
            element('avatar', 'avatar', { x: 160, y: 190, width: 100, height: 100 }, { options: { borderWidth: 5, borderColor: '#ffffff' } }),
            element('text', 'text', { x: 16, y: 306, width: 388, height: 96 }, { text: text([line('@displayname', 34), line('🎮 @game', 20, '600')], { align: 'center' }) }),
            element('text-2', 'text', { x: 16, y: 420, width: 388, height: 80 }, { text: text([line('¡Vayan a seguirle!', 24), line('twitch.tv/@username', 18, '600')], { align: 'center', gap: 6 }) }),
            element('progress', 'progress', { x: 32, y: 546, width: 356, height: 8 }),
            timer(250),
        ]),
    },
    {
        id: 'clipTitle',
        build: () => build({ width: 800, height: 450 }, [
            element('panel', 'panel', { x: 0, y: 0, width: 800, height: 450 }, { enabled: false }),
            element('clip', 'clip', { x: 0, y: 0, width: 800, height: 450 }, { options: { radius: 18, shadow: true } }),
            element('shape', 'shape', { x: 0, y: 250, width: 800, height: 200 }, { options: { radius: '0px 0px 18px 18px' } }),
            element('avatar', 'avatar', { x: 28, y: 340, width: 84, height: 84 }, { options: { borderWidth: 3, borderColor: '#ffffff' } }),
            element('text', 'text', { x: 130, y: 338, width: 640, height: 88 }, { text: text([line('@displayname', 36), line('🎮 @game', 22, '600')], { shadow: 'strong' }) }),
            element('progress', 'progress', { x: 0, y: 444, width: 800, height: 6 }, { options: { radius: 0, track: 'rgba(255, 255, 255, 0.15)' } }),
            timer(630),
        ], { background: { type: 'transparent', color1: '#667eea', color2: '#764ba2', angle: 135, solid: '#000000', opacity: 100 }, shadow: '' }),
    },
    {
        id: 'bar',
        build: () => build({ width: 900, height: 120 }, [
            element('panel', 'panel', { x: 0, y: 0, width: 900, height: 120 }),
            element('avatar', 'avatar', { x: 12, y: 12, width: 96, height: 96 }, { options: { borderWidth: 3 } }),
            element('text', 'text', { x: 126, y: 16, width: 520, height: 76 }, { text: text([line('Sigan a @displayname', 30), line('🎮 @game', 20, '600')]) }),
            element('progress', 'progress', { x: 126, y: 98, width: 520, height: 6 }),
            element('clip', 'clip', { x: 668, y: 10, width: 178, height: 100 }, { options: { radius: 12 } }),
            timer(730),
        ], { radius: 60 }),
    },
    {
        id: 'textOnly',
        build: () => build({ width: 720, height: 170 }, [
            element('panel', 'panel', { x: 0, y: 0, width: 720, height: 170 }),
            element('avatar', 'avatar', { x: 20, y: 20, width: 130, height: 130 }, { options: { borderWidth: 5 } }),
            element('text', 'text', { x: 172, y: 26, width: 528, height: 100 }, { text: text([line('¡Sigan a @displayname!', 36), line('🎮 @game', 22, '600')]) }),
            element('progress', 'progress', { x: 172, y: 142, width: 500, height: 6 }),
            element('clip', 'clip', { x: 430, y: 20, width: 260, height: 130 }, { enabled: false }),
            timer(550),
        ], { radius: 85 }),
    },
];

export interface ColorTheme {
    id: string;
    swatch: string[];
    theme: Partial<ShoutoutTheme>;
    /** Color del texto de todos los bloques. */
    textColor: string;
    textShadow: TextBlock['shadow'];
}

const bg = (type: 'gradient' | 'solid' | 'transparent', color1: string, color2: string, opacity = 100, angle = 135) =>
    ({ type, color1, color2, solid: color1, angle, opacity });

export const COLOR_THEMES: ColorTheme[] = [
    { id: 'twitch', swatch: ['#9146ff', '#5c16c5', '#ffffff'], textColor: '#ffffff', textShadow: 'normal',
        theme: { background: bg('gradient', '#9146ff', '#5c16c5'), borderEnabled: false, blur: 0, accent: '#e9d5ff', shadow: '0 10px 30px rgba(0, 0, 0, 0.35)' } },
    { id: 'night', swatch: ['#0f0f14', '#1f2937', '#9146ff'], textColor: '#f8fafc', textShadow: 'none',
        theme: { background: bg('solid', '#0f0f14', '#0f0f14', 92), borderEnabled: true, borderColor: '#ffffff1f', borderWidth: 1, blur: 0, accent: '#9146ff', shadow: '0 10px 30px rgba(0, 0, 0, 0.45)' } },
    { id: 'neon', swatch: ['#07070c', '#39ff14', '#00e5ff'], textColor: '#ffffff', textShadow: 'glow',
        theme: { background: bg('solid', '#07070c', '#07070c', 94), borderEnabled: true, borderColor: '#39ff14', borderWidth: 2, blur: 0, accent: '#39ff14', shadow: '0 0 24px rgba(57, 255, 20, 0.35)' } },
    { id: 'sunset', swatch: ['#f97316', '#db2777', '#ffffff'], textColor: '#ffffff', textShadow: 'normal',
        theme: { background: bg('gradient', '#f97316', '#db2777'), borderEnabled: false, blur: 0, accent: '#fde68a', shadow: '0 10px 30px rgba(0, 0, 0, 0.35)' } },
    { id: 'ice', swatch: ['#0ea5e9', '#6366f1', '#ffffff'], textColor: '#ffffff', textShadow: 'normal',
        theme: { background: bg('gradient', '#0ea5e9', '#6366f1'), borderEnabled: false, blur: 0, accent: '#bae6fd', shadow: '0 10px 30px rgba(0, 0, 0, 0.35)' } },
    { id: 'glass', swatch: ['#ffffff33', '#94a3b8', '#ffffff'], textColor: '#ffffff', textShadow: 'strong',
        theme: { background: bg('solid', '#ffffff', '#ffffff', 12), borderEnabled: true, borderColor: '#ffffff40', borderWidth: 1, blur: 14, accent: '#ffffff', shadow: '0 10px 30px rgba(0, 0, 0, 0.25)' } },
    { id: 'transparent', swatch: ['#00000000', '#ffffff', '#000000'], textColor: '#ffffff', textShadow: 'strong',
        theme: { background: bg('transparent', '#000000', '#000000'), borderEnabled: false, blur: 0, accent: '#ffffff', shadow: '' } },
];

export function applyColorTheme(layout: ShoutoutLayout, c: ColorTheme): ShoutoutLayout {
    return {
        ...layout,
        theme: { ...layout.theme, ...c.theme },
        elements: layout.elements.map(e => e.text ? { ...e, text: { ...e.text, color: c.textColor, shadow: c.textShadow } } : e),
    };
}

/**
 * Cambia a otro diseño conservando lo que eligió el streamer: colores del panel, fuente y color de los textos,
 * animaciones y si muestra el contador.
 */
export function applyLayoutPreset(current: ShoutoutLayout, next: ShoutoutLayout): ShoutoutLayout {
    const prevText = current.elements.find(e => e.kind === 'text')?.text;
    const timerOn = !!current.elements.find(e => e.kind === 'timer')?.enabled;
    return {
        ...next,
        theme: { ...current.theme, radius: next.theme.radius, ...(next.theme.background.type === 'transparent' ? { background: next.theme.background, shadow: '' } : {}) },
        animations: current.animations,
        elements: next.elements.map(e => {
            if (e.kind === 'timer') return { ...e, enabled: timerOn };
            if (e.text && prevText) return { ...e, text: { ...e.text, fontFamily: prevText.fontFamily, color: prevText.color, outline: prevText.outline, shadow: e.text.shadow === 'strong' ? 'strong' : prevText.shadow } };
            return e;
        }),
    };
}
