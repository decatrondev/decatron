import type { AlertDesign, Layout, PlacedLine, Rect, SoundAlertSettings, Styles, TextAlign, TextLine } from './types';
import {
    CANVAS_WIDTH, CANVAS_HEIGHT, FULL_CANVAS, DEFAULT_COOLDOWN_MS, DEFAULT_DURATION, DEFAULT_GLOBAL_VOLUME,
    DEFAULT_LAYOUT, DEFAULT_STYLES, DEFAULT_TEXT_LINES,
} from './constants/defaults';

// Modelo compartido por el overlay (/overlay/soundalerts), la vista previa y el editor.
// Lo guardado en la base puede venir de cualquier época: esto lo deja todo en el formato actual
// sin cambiar cómo se ve en OBS.

/** Las configs más viejas se guardaron con claves en PascalCase ("Text", "FontSize"…). */
function camelKeys(value: any): any {
    if (Array.isArray(value)) return value.map(camelKeys);
    if (value && typeof value === 'object') {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(value)) out[k.charAt(0).toLowerCase() + k.slice(1)] = camelKeys(v);
        return out;
    }
    return value;
}

function parse(value: unknown): any {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return null; }
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const isRect = (r: any) => r && typeof r.x === 'number' && typeof r.y === 'number';
const toAlign = (a: unknown): TextAlign => (a === 'left' || a === 'right' ? a : 'center');

/** Mismo criterio que tenía el overlay: sin `text.width` es un layout de 400×450 y se escala. */
export function normalizeLayout(raw: any): Layout & { panel: Rect } {
    const l = camelKeys(parse(raw));
    if (!l || !isRect(l.media) || !isRect(l.text)) {
        return {
            media: { x: 660, y: 190, width: 600, height: 400 },
            text: { x: 660, y: 640, width: 600, height: 200, align: 'center' },
            panel: { ...FULL_CANVAS },
        };
    }
    if (l.text.width === undefined || l.text.width === null) {
        const sx = CANVAS_WIDTH / 400;
        const sy = CANVAS_HEIGHT / 450;
        return {
            media: {
                x: Math.round((l.media.x || 0) * sx), y: Math.round((l.media.y || 0) * sy),
                width: Math.round((l.media.width || 200) * sx), height: Math.round((l.media.height || 200) * sy),
            },
            text: { x: Math.round((l.text.x || 0) * sx), y: Math.round((l.text.y || 0) * sy), width: 600, height: 200, align: l.text.align || 'center' },
            panel: isRect(l.panel) ? l.panel : { ...FULL_CANVAS },
        };
    }
    return {
        media: { x: l.media.x, y: l.media.y, width: num(l.media.width, 400), height: num(l.media.height, 400) },
        text: { x: l.text.x, y: l.text.y, width: num(l.text.width, 600), height: num(l.text.height, 200), align: l.text.align || 'center' },
        panel: isRect(l.panel) ? { x: l.panel.x, y: l.panel.y, width: num(l.panel.width, CANVAS_WIDTH), height: num(l.panel.height, CANVAS_HEIGHT) } : { ...FULL_CANVAS },
    };
}

// El texto de antes era una columna centrada en vertical dentro de layout.text, cada línea con
// line-height 1.2 y un margen de 0.4vw arriba y abajo (7.68 px en 1920 de ancho).
const LEGACY_MARGIN = CANVAS_WIDTH * 0.004;
export const LINE_HEIGHT = 1.2;

function stack(lines: TextLine[], box: Rect & { align: string }): PlacedLine[] {
    const outer = lines.map(l => l.fontSize * LINE_HEIGHT + 2 * LEGACY_MARGIN);
    const total = outer.reduce((a, b) => a + b, 0);
    let top = box.y + (box.height - total) / 2;
    return lines.map((l, i) => {
        const placed: PlacedLine = {
            ...l, x: box.x, y: Math.round(top + LEGACY_MARGIN), width: box.width,
            height: Math.round(l.fontSize * LINE_HEIGHT), align: toAlign(box.align),
        };
        top += outer[i];
        return placed;
    });
}

/**
 * Da a cada línea su propia caja. Si ya la tienen, se respeta. Si no (formato apilado),
 * las visibles quedan donde se veían; las ocultas se apilan debajo, así al activarlas aparecen
 * en el mismo bloque. Si todas están ocultas, se apilan todas juntas como se verían al activarlas.
 */
export function placeLines(rawLines: unknown, textBox: Rect & { align: string }): PlacedLine[] {
    const parsed = camelKeys(parse(rawLines));
    const lines: TextLine[] = (Array.isArray(parsed) ? parsed : DEFAULT_TEXT_LINES).map((l: any) => ({
        text: typeof l?.text === 'string' ? l.text : '',
        fontSize: num(l?.fontSize, 24),
        fontWeight: String(l?.fontWeight ?? 'bold'),
        enabled: l?.enabled !== false,
        x: l?.x, y: l?.y, width: l?.width, height: l?.height, align: l?.align,
    }));

    if (lines.length > 0 && lines.every(l => typeof l.x === 'number' && typeof l.y === 'number')) {
        return lines.map(l => ({
            ...l, x: l.x!, y: l.y!, width: num(l.width, textBox.width),
            height: num(l.height, Math.round(l.fontSize * LINE_HEIGHT)), align: toAlign(l.align),
        }));
    }

    const visible = lines.filter(l => l.enabled);
    const group = visible.length > 0 ? visible : lines;
    const placed = new Map<TextLine, PlacedLine>(stack(group, textBox).map((p, i) => [group[i], p]));
    const last = [...placed.values()].reduce((m, p) => Math.max(m, p.y + p.height), textBox.y);
    let y = last + LEGACY_MARGIN * 2;
    for (const l of lines) {
        if (placed.has(l)) continue;
        const h = Math.round(l.fontSize * LINE_HEIGHT);
        placed.set(l, { ...l, x: textBox.x, y: Math.round(y), width: textBox.width, height: h, align: toAlign(textBox.align) });
        y += h + LEGACY_MARGIN * 2;
    }
    return lines.map(l => placed.get(l)!);
}

export function normalizeStyles(raw: unknown): Styles {
    const s = camelKeys(parse(raw));
    return { ...DEFAULT_STYLES, ...(s && typeof s === 'object' ? s : {}) };
}

/** Lo visual de la alerta a partir de la config del servidor o del aviso de SignalR. */
export function normalizeDesign(src: {
    textLines?: unknown; styles?: unknown; layout?: unknown;
    animation?: { type?: string; speed?: string }; animationType?: string; animationSpeed?: string;
    textOutline?: { enabled?: boolean; color?: string; width?: number };
    textOutlineEnabled?: boolean; textOutlineColor?: string; textOutlineWidth?: number;
}): AlertDesign {
    const layout = normalizeLayout(src.layout ?? DEFAULT_LAYOUT);
    return {
        layout,
        textLines: placeLines(src.textLines ?? DEFAULT_TEXT_LINES, layout.text),
        styles: normalizeStyles(src.styles),
        animation: {
            type: src.animation?.type || src.animationType || 'fade',
            speed: src.animation?.speed || src.animationSpeed || 'normal',
        },
        textOutline: {
            enabled: src.textOutline?.enabled ?? src.textOutlineEnabled ?? false,
            color: src.textOutline?.color || src.textOutlineColor || '#000000',
            width: src.textOutline?.width || src.textOutlineWidth || 2,
        },
    };
}

export function normalizeSettings(cfg: any): SoundAlertSettings {
    return {
        globalVolume: num(cfg?.globalVolume, DEFAULT_GLOBAL_VOLUME),
        globalEnabled: cfg?.globalEnabled !== false,
        duration: num(cfg?.duration, DEFAULT_DURATION),
        cooldownMs: num(cfg?.cooldownMs, DEFAULT_COOLDOWN_MS),
        design: normalizeDesign(cfg ?? {}),
    };
}

/** Lo que espera POST /soundalerts/config. */
export function toSaveRequest(s: SoundAlertSettings) {
    const d = s.design;
    return {
        globalVolume: s.globalVolume,
        globalEnabled: s.globalEnabled,
        duration: s.duration,
        cooldownMs: s.cooldownMs,
        textLines: d.textLines.map(l => ({
            text: l.text, fontSize: l.fontSize, fontWeight: l.fontWeight, enabled: l.enabled,
            x: Math.round(l.x), y: Math.round(l.y), width: Math.round(l.width), height: Math.round(l.height), align: l.align,
        })),
        styles: d.styles,
        layout: d.layout,
        animationType: d.animation.type,
        animationSpeed: d.animation.speed,
        textOutlineEnabled: d.textOutline.enabled,
        textOutlineColor: d.textOutline.color,
        textOutlineWidth: d.textOutline.width,
    };
}

/** Una línea nueva queda debajo de la última, con el ancho del bloque de texto. */
export function newLine(design: AlertDesign, text: string): PlacedLine {
    const box = design.layout.text;
    const bottom = design.textLines.reduce((m, l) => Math.max(m, l.y + l.height), box.y);
    const fontSize = 24;
    const height = Math.round(fontSize * LINE_HEIGHT);
    return {
        text, fontSize, fontWeight: '600', enabled: true,
        x: box.x, y: Math.min(CANVAS_HEIGHT - height, Math.round(bottom + 8)), width: box.width, height,
        align: toAlign(box.align),
    };
}

export function replaceVariables(text: string, content: { redeemer: string; reward: string }): string {
    return text.replace('@redeemer', content.redeemer).replace('@reward', content.reward);
}
