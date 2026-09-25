import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BrandLayoutView } from '../../../brand/BrandMark';
import type { BrandElement, BrandLayout, BrandTheme, ResolvedImage } from '../../../brand/types';

type Handle = 'nw' | 'ne' | 'sw' | 'se';

interface Drag {
    /** id del elemento, o 'box' para la caja */
    target: string;
    mode: 'move' | 'resize';
    handle?: Handle;
    startX: number;
    startY: number;
    start: BrandLayout;
}

interface Props {
    layout: BrandLayout;
    onChange: (next: BrandLayout) => void;
    theme: BrandTheme;
    background: string;
    zoom: number;
    selected: string | null;
    onSelect: (id: string | null) => void;
    resolve: (ref: string | null | undefined) => ResolvedImage | null;
}

const SNAP = 5;
const MIN = 4;

/** Imán hacia bordes y centro de la caja; devuelve la posición y la guía que se usó. */
function snap(pos: number, size: number, total: number, zoom: number): { v: number; guide: number | null } {
    const threshold = SNAP / zoom;
    for (const target of [0, (total - size) / 2, total - size]) {
        if (Math.abs(pos - target) <= threshold) {
            const v = Math.round(target);
            return { v, guide: target === 0 ? 0 : target === total - size ? total : total / 2 };
        }
    }
    return { v: Math.round(pos), guide: null };
}

export function elementLabel(el: BrandElement, index: number): string {
    if (el.type === 'text') return el.text ? `Texto "${el.text.length > 14 ? el.text.slice(0, 14) + '…' : el.text}"` : `Texto ${index + 1}`;
    return `Imagen ${index + 1}`;
}

/**
 * Lienzo del editor de marca: la caja del lugar a escala, con cada elemento arrastrable
 * y con esquinas para cambiar el tamaño (mismo gesto que el editor del timer).
 * Las coordenadas se guardan en px reales de la caja; el zoom es solo de vista.
 */
export default function BrandCanvas({ layout, onChange, theme, background, zoom, selected, onSelect, resolve }: Props) {
    const [drag, setDrag] = useState<Drag | null>(null);
    const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
    const layoutRef = useRef(layout);
    layoutRef.current = layout;

    const begin = (e: ReactPointerEvent, target: string, mode: Drag['mode'], handle?: Handle) => {
        e.preventDefault();
        e.stopPropagation();
        if (target !== 'box') onSelect(target);
        setDrag({ target, mode, handle, startX: e.clientX, startY: e.clientY, start: JSON.parse(JSON.stringify(layoutRef.current)) });
    };

    const onMove = useCallback((e: PointerEvent) => {
        if (!drag) return;
        const dx = (e.clientX - drag.startX) / zoom;
        const dy = (e.clientY - drag.startY) / zoom;
        const s = drag.start;

        if (drag.target === 'box') {
            onChange({ ...layoutRef.current, width: Math.max(MIN, Math.round(s.width + dx)), height: Math.max(MIN, Math.round(s.height + dy)) });
            return;
        }

        const part = s.elements.find(el => el.id === drag.target);
        if (!part) return;
        const replace = (next: BrandElement) => onChange({ ...layoutRef.current, elements: layoutRef.current.elements.map(el => el.id === next.id ? next : el) });

        if (drag.mode === 'move') {
            const sx = e.shiftKey ? { v: Math.round(part.x + dx), guide: null } : snap(part.x + dx, part.w, s.width, zoom);
            const sy = e.shiftKey ? { v: Math.round(part.y + dy), guide: null } : snap(part.y + dy, part.h, s.height, zoom);
            setGuides({ x: sx.guide, y: sy.guide });
            replace({ ...part, x: sx.v, y: sy.v });
            return;
        }

        // Cambiar tamaño desde una esquina: la esquina opuesta queda fija.
        const h = drag.handle!;
        const signX = h.includes('e') ? 1 : -1;
        const signY = h.includes('s') ? 1 : -1;
        let w = part.w + dx * signX;
        let hh = part.h + dy * signY;

        const proportional = part.type === 'text' || part.keepAspect;
        if (proportional) {
            const ratio = part.h > 0 ? part.w / part.h : 1;
            // Manda el eje que más se movió.
            if (Math.abs(dx) * (part.h / Math.max(part.w, 1)) > Math.abs(dy)) hh = w / ratio;
            else w = hh * ratio;
        }
        w = Math.max(MIN, Math.round(w));
        hh = Math.max(MIN, Math.round(hh));
        const x = signX === 1 ? part.x : part.x + part.w - w;
        const y = signY === 1 ? part.y : part.y + part.h - hh;

        if (part.type === 'text') {
            // En un texto, agrandar el cuadro agranda la letra.
            const factor = part.h > 0 ? hh / part.h : 1;
            replace({ ...part, x, y, w, h: hh, size: Math.max(6, Math.round(part.size * factor)), letterSpacing: Math.round(part.letterSpacing * factor * 10) / 10 });
        } else {
            replace({ ...part, x, y, w, h: hh });
        }
    }, [drag, zoom, onChange]);

    const onUp = useCallback(() => { setDrag(null); setGuides({ x: null, y: null }); }, []);

    useEffect(() => {
        if (!drag) return;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    }, [drag, onMove, onUp]);

    // Flechas: mueven el elemento elegido 1 px (10 con Shift).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!selected) return;
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
            const step = e.shiftKey ? 10 : 1;
            const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
            if (!d) return;
            e.preventDefault();
            const l = layoutRef.current;
            onChange({ ...l, elements: l.elements.map(el => el.id === selected ? { ...el, x: el.x + d[0], y: el.y + d[1] } : el) });
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selected, onChange]);

    const W = layout.width * zoom;
    const H = layout.height * zoom;
    const PAD = 32;
    const tile = theme === 'dark' ? '#16181c' : '#e2e8f0';

    return (
        <div
            className="relative overflow-auto rounded-xl border border-[#e2e8f0] dark:border-[#374151] select-none"
            style={{
                backgroundColor: theme === 'dark' ? '#0b0c0e' : '#eef2f7',
                backgroundImage: `linear-gradient(45deg, ${tile} 25%, transparent 25%, transparent 75%, ${tile} 75%), linear-gradient(45deg, ${tile} 25%, transparent 25%, transparent 75%, ${tile} 75%)`,
                backgroundSize: '16px 16px', backgroundPosition: '0 0, 8px 8px',
                minHeight: 220,
            }}
            onPointerDown={() => onSelect(null)}
        >
            <div className="flex items-center justify-center" style={{ minWidth: W + PAD * 2 + 16, minHeight: Math.max(220, H + PAD * 2 + 16), padding: PAD }}>
                {/* Fondo real del lugar, un poco más grande que la caja para ver cómo respira */}
                <div className="relative rounded-md shadow-inner" style={{ background, padding: 16 * Math.min(zoom, 2) }}>
                    <div className="relative" style={{ width: W, height: H }}>
                        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: layout.width, height: layout.height }}>
                            <BrandLayoutView layout={layout} resolve={resolve} theme={theme} />
                        </div>
                        {/* Límite de la caja */}
                        <div className="absolute inset-0 pointer-events-none outline outline-1 outline-dashed outline-[#f59e0b]" />
                        {guides.x !== null && <div className="absolute top-0 bottom-0 w-px bg-[#ec4899] pointer-events-none" style={{ left: guides.x * zoom, zIndex: 900 }} />}
                        {guides.y !== null && <div className="absolute left-0 right-0 h-px bg-[#ec4899] pointer-events-none" style={{ top: guides.y * zoom, zIndex: 900 }} />}
                        {layout.elements.map((el, i) => {
                            if (!el.visible) return null;
                            const isSel = selected === el.id;
                            return (
                                <div
                                    key={el.id}
                                    data-el={el.id}
                                    onPointerDown={e => begin(e, el.id, 'move')}
                                    className={`absolute cursor-move rounded-sm ${isSel ? 'outline outline-2 outline-[#2563eb]' : 'outline outline-1 outline-dashed outline-[#94a3b8]/60 hover:outline-[#2563eb]/70'}`}
                                    style={{ left: el.x * zoom, top: el.y * zoom, width: el.w * zoom, height: el.h * zoom, zIndex: isSel ? 800 : 100 + i }}
                                    title={`${elementLabel(el, i)}: arrastra para mover`}
                                >
                                    <span className={`absolute -top-5 left-0 text-[10px] font-semibold px-1 rounded whitespace-nowrap ${isSel ? 'bg-[#2563eb] text-white' : 'bg-black/50 text-white'}`}>
                                        {elementLabel(el, i)}
                                    </span>
                                    {isSel && (['nw', 'ne', 'sw', 'se'] as Handle[]).map(h => (
                                        <span
                                            key={h}
                                            data-handle={h}
                                            onPointerDown={e => begin(e, el.id, 'resize', h)}
                                            className="absolute w-3 h-3 bg-white border-2 border-[#2563eb] rounded-sm"
                                            style={{
                                                left: h.includes('w') ? -6 : undefined, right: h.includes('e') ? -6 : undefined,
                                                top: h.includes('n') ? -6 : undefined, bottom: h.includes('s') ? -6 : undefined,
                                                cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize',
                                            }}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                        <span
                            onPointerDown={e => begin(e, 'box', 'resize', 'se')}
                            data-handle="box"
                            className="absolute w-3.5 h-3.5 bg-[#f59e0b] border-2 border-white rounded-sm cursor-nwse-resize"
                            style={{ right: -8, bottom: -8, zIndex: 950 }}
                            title="Tamaño de la caja"
                        />
                        <span className="absolute -bottom-6 right-0 text-[10px] font-mono text-[#f59e0b] whitespace-nowrap">{layout.width} × {layout.height}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
