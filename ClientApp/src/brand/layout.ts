import type { BrandElement, BrandLayout, BrandSlotConfig } from './types';

export function newId(): string {
    return Math.random().toString(36).slice(2, 10);
}

export function newElement(type: BrandElement['type'], over: Partial<BrandElement> = {}): BrandElement {
    return {
        id: newId(), type, visible: true, x: 0, y: 0, w: type === 'text' ? 130 : 40, h: type === 'text' ? 34 : 40,
        ref: null, refDark: null, keepAspect: true,
        text: 'Decatron', font: 'sans', weight: 900, size: 24,
        color: '#2563eb', colorDark: '#2563eb', letterSpacing: 0,
        align: 'left', italic: false, uppercase: false,
        ...over,
    };
}

/**
 * Lee cualquier versión guardada: la v1 tenía una imagen y un texto fijos
 * (`image`/`text`/`textOnTop`); desde la v2 es una lista libre de elementos.
 */
export function normalizeLayout(raw: any): BrandLayout | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    if (Array.isArray(raw.elements)) return raw as BrandLayout;
    const els: BrandElement[] = [];
    if (raw.image) els.push(newElement('image', { ...raw.image, id: 'img' }));
    if (raw.text) els.push(newElement('text', { ...raw.text, id: 'txt' }));
    if (raw.textOnTop === false) els.reverse();
    return { visible: raw.visible !== false, width: raw.width ?? 0, height: raw.height ?? 0, elements: els.filter(e => e.visible) };
}

export function normalizeConfig(raw: BrandSlotConfig | undefined): BrandSlotConfig | undefined {
    if (!raw?.layouts) return raw;
    const layouts: Record<string, BrandLayout> = {};
    for (const [k, l] of Object.entries(raw.layouts)) { const n = normalizeLayout(l); if (n) layouts[k] = n; }
    return { ...raw, v: 2, layouts };
}

const GEO_POS: (keyof BrandElement)[] = ['x', 'y'];
const GEO_SIZE: (keyof BrandElement)[] = ['w', 'h', 'size', 'letterSpacing'];

/** Aplica a `o` el mismo cambio relativo que llevó `a` → `b` (10→15 hace 20→30). */
function scaleLike(o: number, a: number, b: number, fallbackScale: number): number {
    if (a === b) return o;
    if (a !== 0) return o * b / a;
    return o + (b - a) * fallbackScale;
}

const round = (n: number, decimals = 0) => { const f = 10 ** decimals; return Math.round(n * f) / f; };

/**
 * "Aplicar a todas las pantallas": lleva a otra variante el cambio que se hizo en la actual.
 * Las medidas cambian en proporción a los valores que esa variante ya tenía (no se copian);
 * todo lo demás (imagen, texto, colores, agregar/quitar/ordenar elementos) se copia igual.
 */
export function propagate(before: BrandLayout, after: BrandLayout, other: BrandLayout): BrandLayout {
    const sx = before.width > 0 ? other.width / before.width : 1;
    const sy = before.height > 0 ? other.height / before.height : 1;

    const elements = after.elements.map(el => {
        const prev = before.elements.find(e => e.id === el.id);
        const mine = other.elements.find(e => e.id === el.id);
        if (!mine || !prev) {
            // Elemento nuevo (o que esta variante no tenía): se ubica en la misma proporción de la caja.
            return { ...el, x: round(el.x * sx), y: round(el.y * sy), w: Math.max(1, round(el.w * sx)), h: Math.max(1, round(el.h * sy)), size: Math.max(1, round(el.size * sy)), letterSpacing: round(el.letterSpacing * sy, 1) };
        }
        const next: BrandElement = { ...el };
        for (const k of GEO_POS) {
            const s = k === 'x' ? sx : sy;
            (next as any)[k] = round((mine[k] as number) + ((el[k] as number) - (prev[k] as number)) * s);
        }
        for (const k of GEO_SIZE) {
            const s = k === 'w' ? sx : sy;
            const v = scaleLike(mine[k] as number, prev[k] as number, el[k] as number, s);
            (next as any)[k] = k === 'letterSpacing' ? round(v, 1) : Math.max(1, round(v));
        }
        return next;
    });

    return {
        visible: after.visible,
        width: Math.max(1, round(scaleLike(other.width, before.width, after.width, 1))),
        height: Math.max(1, round(scaleLike(other.height, before.height, after.height, 1))),
        elements,
    };
}
