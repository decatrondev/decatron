import type { ElementConfig, ElementId, OverlayLayout } from '../../../components/music-overlay/types';
import { cardLayout } from '../../../components/music-overlay/defaults';
import { contentBounds } from '../../../components/music-overlay/utils';

// En Now Playing el lienzo es la pantalla entera y el widget ocupa una esquina, pero lo que está
// apagado se guarda con las coordenadas por defecto (arriba a la izquierda). Al prenderlo hay que
// traerlo al widget: si no, queda lejos, recortado por el panel y la vista previa se encoge.

type Box = { x: number; y: number; width: number; height: number };

const DEFAULTS = cardLayout().elements;
/** De arriba abajo: dónde va cada fila de la columna de datos. */
const ROWS: ElementId[] = ['title', 'artist', 'album', 'progress', 'time'];
const GAP = 4;

const intersects = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const atDefault = (id: ElementId, e: ElementConfig) => {
    const d = DEFAULTS[id];
    return e.x === d.x && e.y === d.y && e.width === d.width && e.height === d.height;
};
const others = (l: OverlayLayout, id: ElementId) =>
    (Object.keys(l.elements) as ElementId[]).filter(k => k !== id && k !== 'panel' && l.elements[k].enabled);

/** Dónde está el widget: el panel, o lo que esté prendido si no hay panel. */
function widgetArea(l: OverlayLayout, id: ElementId): Box | null {
    if (l.elements.panel.enabled) return l.elements.panel;
    const on = others(l, id);
    if (!on.length) return null;
    return contentBounds({ ...l, elements: { ...l.elements, [id]: { ...l.elements[id], enabled: false } } });
}

/** Cuánto más chico o grande es este widget que el diseño por defecto. */
function scaleOf(l: OverlayLayout, area: Box): number {
    const title = l.elements.title;
    const k = title.enabled && title.text ? title.text.fontSize / DEFAULTS.title.text!.fontSize : area.height / 200;
    return Math.max(0.4, Math.min(2, k));
}

function setEl(l: OverlayLayout, id: ElementId, patch: Partial<ElementConfig>): OverlayLayout {
    return { ...l, elements: { ...l.elements, [id]: { ...l.elements[id], ...patch } } };
}

const collides = (l: OverlayLayout, id: ElementId, b: Box) => others(l, id).some(k => intersects(b, l.elements[k]));

/** Un elemento chico (barras, icono): sobre el título, en un hueco, o al final de una fila achicándola. */
function placeSmall(l: OverlayLayout, id: ElementId, area: Box, width: number, height: number): OverlayLayout {
    const inner = Math.max(4, Math.round(height / 3));
    const fits = (b: Box) => b.x >= area.x && b.y >= area.y && b.x + b.width <= area.x + area.width && b.y + b.height <= area.y + area.height && !collides(l, id, b);
    const col = ROWS.map(k => l.elements[k]).find(e => e.enabled);

    if (col) {
        const above = { x: col.x, y: col.y - height - GAP, width, height };
        if (fits(above)) return setEl(l, id, above);
    }
    for (let y = area.y + inner; y + height <= area.y + area.height; y += 2) {
        for (let x = area.x + area.width - width - inner; x >= area.x; x -= 2) {
            if (fits({ x, y, width, height })) return setEl(l, id, { x, y, width, height });
        }
    }
    // Sin hueco: al final de una fila de texto, que se achica lo justo y lo recupera al apagarlo
    const row = (['artist', 'album', 'title'] as ElementId[]).find(k => l.elements[k].enabled && l.elements[k].width > width * 3);
    if (!row) return setEl(l, id, { x: area.x + area.width - width - inner, y: area.y + inner, width, height });
    const r = l.elements[row];
    const by = width + GAP * 2;
    const out = setEl(l, row, { width: r.width - by });
    return setEl(out, id, {
        x: r.x + r.width - width, y: r.y + Math.max(0, (r.height - height) / 2), width, height,
        options: { ...l.elements[id].options, narrowed: { id: row, by } },
    });
}

/** Una fila de datos: en su lugar de la columna si hay espacio; si no, el widget crece para hacerle lugar. */
function placeRow(l: OverlayLayout, id: ElementId, area: Box, height: number): OverlayLayout {
    // La columna empieza donde lo hace la fila más a la izquierda (el título puede ir corrido por el ecualizador)
    const col = ROWS.map(k => l.elements[k]).filter(e => e.enabled).sort((a, b) => a.x - b.x || b.width - a.width)[0];
    const x = col?.x ?? area.x + GAP * 3;
    const width = col?.width ?? area.width - GAP * 6;
    const prev = ROWS.slice(0, ROWS.indexOf(id)).reverse().map(k => l.elements[k]).find(e => e.enabled);
    const next = ROWS.slice(ROWS.indexOf(id) + 1).map(k => l.elements[k]).find(e => e.enabled);
    const y = prev ? prev.y + prev.height + GAP : next ? next.y - height - GAP : area.y + GAP * 3;
    const box = { x, y, width, height };
    const inside = y >= area.y && y + height <= area.y + area.height;
    if (inside && !collides(l, id, box)) return setEl(l, id, box);

    // Sin espacio: se abre la fila bajando lo que queda debajo y agrandando el panel
    const push = height + GAP;
    const elements = { ...l.elements };
    for (const k of others(l, id)) if (k !== 'cover' && elements[k].y >= y - 1) elements[k] = { ...elements[k], y: elements[k].y + push };
    if (elements.panel.enabled) elements.panel = { ...elements.panel, height: elements.panel.height + push };
    elements[id] = { ...elements[id], ...box };
    // Si se sale de la pantalla por abajo, sube entero
    const bottom = Math.max(...[...others(l, id).map(k => elements[k]), elements[id], ...(elements.panel.enabled ? [elements.panel] : [])].map(e => e.y + e.height));
    const up = Math.min(Math.max(0, bottom - l.canvas.height), elements.panel.enabled ? elements.panel.y : y);
    if (up > 0) {
        for (const k of [...others(l, id), id, ...(elements.panel.enabled ? ['panel' as ElementId] : [])]) elements[k] = { ...elements[k], y: elements[k].y - up };
    }
    return { ...l, elements };
}

/** La portada: a la izquierda, a la altura del widget; lo demás se corre si no entra. */
function placeCover(l: OverlayLayout, area: Box, pad: number): OverlayLayout {
    if (!l.elements.panel.enabled) {
        const side = Math.round(area.height);
        const left = area.x - side - GAP * 3;
        const x = left >= 0 ? left : Math.min(area.x + area.width + GAP * 3, l.canvas.width - side);
        return setEl(l, 'cover', { x, y: area.y, width: side, height: side });
    }
    const side = Math.max(20, Math.round(area.height - pad * 2));
    const x = area.x + pad;
    const free = x + side + pad;
    let out = setEl(l, 'cover', { x, y: area.y + pad, width: side, height: side });
    // Lo de la izquierda se corre junto, sin cambiar sus distancias; lo que ya está a la derecha (el icono) se queda
    const middle = area.x + area.width / 2;
    const toMove = others(l, 'cover').filter(k => l.elements[k].x < middle);
    if (!toMove.length) return out;
    const delta = free - Math.min(...toMove.map(k => l.elements[k].x));
    if (delta <= 0) return out;
    const edge = area.x + area.width - pad;
    for (const k of toMove) {
        const e = out.elements[k];
        const x = e.x + delta;
        out = setEl(out, k, { x, width: Math.max(Math.min(e.width, 40), Math.min(e.width, edge - x)) });
    }
    return out;
}

function placePanel(l: OverlayLayout, pad: number): OverlayLayout {
    const on = others(l, 'panel');
    if (!on.length) return l;
    const bb = contentBounds({ ...l, elements: { ...l.elements, panel: { ...l.elements.panel, enabled: false } } });
    if (intersects(l.elements.panel, bb)) return l;
    const x = Math.max(0, bb.x - pad), y = Math.max(0, bb.y - pad);
    return setEl(l, 'panel', {
        x, y,
        width: Math.min(l.canvas.width - x, bb.x + bb.width + pad - x),
        height: Math.min(l.canvas.height - y, bb.y + bb.height + pad - y),
    });
}

/** Trae un elemento al widget si quedó lejos. Lo que ya está en el widget no se toca. */
export function placeElement(l: OverlayLayout, id: ElementId): OverlayLayout {
    const e = l.elements[id];
    const area = widgetArea(l, id);
    if (!area) return l;
    const k = scaleOf(l, area);
    const pad = Math.max(6, Math.round(12 * k));
    if (id === 'panel') return placePanel(l, pad);

    const stale = atDefault(id, e) && (!intersects(e, area) || collides(l, id, e));
    if (intersects(e, area) && !stale) return l;

    const d = DEFAULTS[id];
    const artist = l.elements.artist.enabled ? l.elements.artist.text : l.elements.title.text;
    const styled = (fontSize: number): Partial<ElementConfig> => (e.text ? {
        text: { ...e.text, fontFamily: artist?.fontFamily ?? e.text.fontFamily, color: artist?.color ?? e.text.color, fontSize: Math.max(10, Math.round(fontSize * k)), align: 'left' },
    } : {});

    let out = l;
    if (id === 'equalizer') {
        // Con el color de la barra, si no se eligió otro (en las tarjetas viejas el acento quedó en el verde por defecto)
        const color = e.options.color || (l.elements.progress.enabled ? l.elements.progress.options.fill : undefined);
        out = placeSmall(setEl(l, id, { options: { ...e.options, ...(color ? { color } : {}) } }), id, area, Math.round(d.width * k), Math.round(d.height * k));
    } else if (id === 'source') {
        const size = Math.max(14, Math.round(24 * k));
        out = placeSmall(setEl(l, id, { options: { display: 'icon', opacity: 0.8, ...e.options } }), id, area, size, size);
    } else if (id === 'cover') {
        out = placeCover(l, area, pad);
    } else if (id === 'progress') {
        out = placeRow(setEl(l, id, { options: { ...e.options, fill: l.theme.accent } }), id, area, Math.max(3, Math.round(d.height * k)));
    } else if (ROWS.includes(id)) {
        const fontSize = d.text?.fontSize ?? 14;
        out = placeRow(setEl(l, id, styled(fontSize)), id, area, Math.max(12, Math.round(d.height * k)));
    }
    return out;
}

/** Prender y apagar en Now Playing: al prender se ubica; al apagar, la fila que se achicó recupera su ancho. */
export function toggleNowPlayingElement(l: OverlayLayout, id: ElementId, enabled: boolean): { layout: OverlayLayout; coverHidden: boolean } {
    const e = l.elements[id];
    if (enabled) {
        const placed = placeElement(setEl(l, id, { enabled: false }), id);
        return { layout: setEl(placed, id, { enabled: true }), coverHidden: false };
    }
    let out = setEl(l, id, { enabled: false });
    const narrowed = e.options?.narrowed as { id: ElementId; by: number } | undefined;
    if (narrowed && out.elements[narrowed.id]) {
        const { narrowed: _gone, ...options } = e.options;
        out = setEl(out, narrowed.id, { width: out.elements[narrowed.id].width + narrowed.by });
        out = setEl(out, id, { options });
    }
    return { layout: out, coverHidden: false };
}

/** Diseños ya guardados con un elemento prendido y olvidado en su lugar por defecto, fuera de la tarjeta. */
export function repairStrayElements(l: OverlayLayout): OverlayLayout {
    if (!l.elements.panel.enabled) return l;
    let out = l;
    for (const id of Object.keys(l.elements) as ElementId[]) {
        const e = out.elements[id];
        if (id === 'panel' || !e.enabled || !atDefault(id, e) || intersects(e, out.elements.panel)) continue;
        out = setEl(placeElement(setEl(out, id, { enabled: false }), id), id, { enabled: true });
    }
    return out;
}
