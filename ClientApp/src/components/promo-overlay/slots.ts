// Ajustes que el streamer puede cambiar de una plantilla (colores, textos fijos y tipografía). El dueño los declara en el diseño
// (`slots`) y dice a qué propiedad de qué elemento llega cada uno; el streamer guarda solo un valor por ajuste y aquí se aplica sobre
// una copia del diseño. El servidor valida el mismo contrato (PromoSlots.cs). Plan: .dev/plans/overlay-promo/PLAN.md §3.3c.
import type { PromoDesign, PromoElement, PromoElementKind } from './types';

export type SlotKind = 'color' | 'text' | 'font';
export interface SlotTarget { elementId: string; prop: string }
export interface Slot {
    id: string;
    kind: SlotKind;
    labelEs: string;
    labelEn: string;
    /** Solo texto: largo máximo que puede escribir el streamer. */
    maxLength: number;
    targets: SlotTarget[];
}

/** Valores del streamer: id del ajuste → valor. Solo trae los que cambió. */
export type SlotValues = Record<string, string>;

export const MAX_SLOTS = 12;
export const MAX_TARGETS = 8;

/** Qué propiedad puede recibir cada tipo de ajuste, por tipo de elemento (misma tabla en PromoSlots.cs). */
export const SLOT_PROPS: Record<SlotKind, Partial<Record<PromoElementKind, string[]>>> = {
    color: {
        shape: ['fill.color', 'fill.gradient.color1', 'fill.gradient.color2', 'border.color', 'glow.color'],
        image: ['border.color', 'glow.color'],
        icon: ['color', 'glow.color'],
        text: ['color', 'glowColor', 'fill.color', 'border.color'],
        qr: ['color', 'background', 'border.color'],
    },
    text: { text: ['template'] },
    font: { text: ['fontFamily'] },
};

export const propsFor = (kind: SlotKind, element: PromoElementKind): string[] => SLOT_PROPS[kind][element] ?? [];

const getPath = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((a, k) => (a && typeof a === 'object' ? (a as Record<string, unknown>)[k] : undefined), o);

function setPath(o: Record<string, unknown>, path: string, value: string) {
    const keys = path.split('.');
    let cur: Record<string, unknown> = o;
    for (let i = 0; i < keys.length - 1; i++) {
        const next = cur[keys[i]];
        if (!next || typeof next !== 'object') return;
        cur = next as Record<string, unknown>;
    }
    cur[keys[keys.length - 1]] = value;
}

/** El valor que tiene hoy el diseño en el primer destino del ajuste (lo que ve el streamer si no cambió nada). */
export function slotDefault(design: PromoDesign, slot: Slot): string {
    const t = slot.targets[0];
    const el = t && design.elements.find(e => e.id === t.elementId);
    const v = el ? getPath(el, t.prop) : undefined;
    return typeof v === 'string' ? v : '';
}

export const slotLabel = (slot: Slot, lang: string) => (lang === 'en' && slot.labelEn) || slot.labelEs || slot.id;

/** Copia del diseño con los valores del streamer puestos. Lo que no sea de un ajuste existente se ignora. */
export function applySlotValues(design: PromoDesign, values: SlotValues | null | undefined): PromoDesign {
    const slots = design.slots;
    if (!slots?.length || !values) return design;
    const copy = JSON.parse(JSON.stringify(design)) as PromoDesign;
    for (const slot of slots) {
        const v = values[slot.id];
        if (typeof v !== 'string') continue;
        for (const t of slot.targets) {
            const el = copy.elements.find((e: PromoElement) => e.id === t.elementId);
            if (el) setPath(el as unknown as Record<string, unknown>, t.prop, v);
        }
    }
    return copy;
}

export const newSlotId = () => `s${Math.random().toString(36).slice(2, 8)}`;

export const emptySlot = (kind: SlotKind): Slot => ({ id: newSlotId(), kind, labelEs: '', labelEn: '', maxLength: 40, targets: [] });

const hexRgb = (c: string): [number, number, number] | null => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(c.trim());
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const luminance = ([r, g, b]: [number, number, number]) => {
    const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** Aviso (no bloqueo): algún texto del diseño, ya con los valores del streamer, queda con poco contraste contra el primer fondo sólido. */
export function hasLowContrast(design: PromoDesign): boolean {
    const bg = design.elements.find(e => e.kind === 'shape' && e.enabled && e.fill.type !== 'transparent');
    if (!bg || bg.kind !== 'shape') return false;
    const bgRgb = hexRgb(bg.fill.type === 'gradient' ? bg.fill.gradient.color1 : bg.fill.color);
    if (!bgRgb) return false;
    const lb = luminance(bgRgb);
    return design.elements.some(e => {
        if (e.kind !== 'text' || !e.enabled) return false;
        const rgb = hexRgb(e.color);
        if (!rgb) return false;
        const lt = luminance(rgb);
        return (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05) < 3;
    });
}
