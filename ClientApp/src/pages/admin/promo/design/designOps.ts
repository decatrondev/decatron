import { newElementId } from '../../../../components/promo-overlay/defaults';
import type { PromoDesign, PromoElement } from '../../../../components/promo-overlay/types';

/** Cambia campos de un elemento. */
export function patchElement(d: PromoDesign, id: string, patch: Record<string, unknown>): PromoDesign {
    return { ...d, elements: d.elements.map(e => (e.id === id ? ({ ...e, ...patch } as PromoElement) : e)) };
}

export function addElement(d: PromoDesign, el: PromoElement): PromoDesign {
    return { ...d, elements: [...d.elements, el] };
}

/** Copia un elemento justo encima del original, un poco desplazada. */
export function duplicateElement(d: PromoDesign, id: string): { design: PromoDesign; newId: string | null } {
    const i = d.elements.findIndex(e => e.id === id);
    if (i < 0) return { design: d, newId: null };
    const src = d.elements[i];
    const copy = { ...JSON.parse(JSON.stringify(src)), id: newElementId(), name: `${src.name} 2`, x: src.x + 10, y: src.y + 10 } as PromoElement;
    const elements = [...d.elements];
    elements.splice(i + 1, 0, copy);
    return { design: { ...d, elements }, newId: copy.id };
}

export function removeElement(d: PromoDesign, id: string): PromoDesign {
    return { ...d, elements: d.elements.filter(e => e.id !== id) };
}

/** Sube (dir -1) o baja (dir +1) un elemento en el orden de dibujo: el último queda encima. */
export function moveElement(d: PromoDesign, id: string, dir: -1 | 1): PromoDesign {
    const i = d.elements.findIndex(e => e.id === id);
    const j = i + (dir === 1 ? 1 : -1);
    if (i < 0 || j < 0 || j >= d.elements.length) return d;
    const elements = [...d.elements];
    [elements[i], elements[j]] = [elements[j], elements[i]];
    return { ...d, elements };
}
