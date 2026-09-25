import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Grid3x3, AlignHorizontalJustifyCenter } from 'lucide-react';
import { Card, Field, NumberInput, CHECKER_BG } from './ui';

export interface Rect { x: number; y: number; width: number; height: number }

export interface EditorElement extends Rect {
    id: string;
    label: string;
    enabled: boolean;
    /** Orden en el lienzo: los de número mayor quedan encima (por defecto 10). */
    zIndex?: number;
    /** false = siempre visible, sin el ojo para ocultarlo. */
    toggleable?: boolean;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se';

interface Props {
    canvas: { width: number; height: number };
    /** En el orden en que se listan. */
    elements: EditorElement[];
    onRectChange: (id: string, patch: Partial<Rect>) => void;
    /** Sin esto no se muestra el ojo para ocultar o mostrar. */
    onToggle?: (id: string, enabled: boolean) => void;
    /** El overlay dibujado al tamaño del lienzo: el mismo componente que sale en OBS. */
    children: ReactNode;
    title: string;
    description?: string;
    /** Avisos encima del lienzo. */
    notice?: ReactNode;
    initialSelected?: string;
    /** Controles extra del elemento elegido (debajo de X/Y/ancho/alto). */
    selectedExtra?: (id: string) => ReactNode;
    /** Botones junto al título de la lista de elementos (por ejemplo, agregar). */
    layersActions?: ReactNode;
    /** Sin esto el tamaño del lienzo es fijo y no se muestra su tarjeta. */
    onCanvasChange?: (size: { width: number; height: number }) => void;
}

const GRID = 10;
const MIN_SIZE = 8;
/** Alto en pantalla de la etiqueta de cada elemento. */
const LABEL_PX = 20;

/**
 * Editor visual compartido por los overlays: cada elemento se arrastra y se redimensiona
 * desde las esquinas sobre el lienzo, que es exactamente el overlay. Flechas = mover 1 px (Shift = 10).
 */
export default function OverlayCanvasEditor({
    canvas, elements, onRectChange, onToggle, children, title, description, notice,
    initialSelected, selectedExtra, layersActions, onCanvasChange,
}: Props) {
    const { t } = useTranslation('overlays');
    const host = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [selected, setSelected] = useState<string>(initialSelected ?? elements[0]?.id ?? '');
    const [snap, setSnap] = useState(true);
    const drag = useRef<{ id: string; handle: Handle | null; startX: number; startY: number; pxPerUnit: number; orig: Rect } | null>(null);
    const { width: cw, height: ch } = canvas;

    // Si el elegido desaparece (por ejemplo, se borró una línea), se elige el primero
    const sel = elements.find(e => e.id === selected) ?? elements[0];

    useEffect(() => {
        if (!host.current) return;
        const ro = new ResizeObserver(e => setScale(Math.min(1.5, e[0].contentRect.width / cw)));
        ro.observe(host.current);
        return () => ro.disconnect();
    }, [cw]);

    const round = useCallback((v: number) => (snap ? Math.round(v / GRID) * GRID : Math.round(v)), [snap]);

    useEffect(() => {
        const move = (e: PointerEvent) => {
            const d = drag.current;
            if (!d) return;
            const dx = (e.clientX - d.startX) / d.pxPerUnit;
            const dy = (e.clientY - d.startY) / d.pxPerUnit;
            const o = d.orig;
            if (!d.handle) {
                onRectChange(d.id, { x: round(o.x + dx), y: round(o.y + dy) });
                return;
            }
            let { x, y, width, height } = o;
            if (d.handle.includes('e')) width = o.width + dx;
            if (d.handle.includes('s')) height = o.height + dy;
            if (d.handle.includes('w')) { width = o.width - dx; x = o.x + dx; }
            if (d.handle.includes('n')) { height = o.height - dy; y = o.y + dy; }
            width = Math.max(MIN_SIZE, round(width));
            height = Math.max(MIN_SIZE, round(height));
            if (d.handle.includes('w')) x = o.x + o.width - width;
            if (d.handle.includes('n')) y = o.y + o.height - height;
            onRectChange(d.id, { x, y, width, height });
        };
        const up = () => { drag.current = null; };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    }, [round, onRectChange]);

    const startDrag = (el: EditorElement, handle: Handle | null) => (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setSelected(el.id);
        // Píxeles de pantalla por píxel del overlay: incluye la escala del lienzo y el zoom de la página (panel-scale)
        const shown = canvasRef.current?.getBoundingClientRect().width ?? cw * scale;
        drag.current = { id: el.id, handle, startX: e.clientX, startY: e.clientY, pxPerUnit: shown / cw || 1, orig: { x: el.x, y: el.y, width: el.width, height: el.height } };
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!sel) return;
        const step = e.shiftKey ? 10 : 1;
        const moves: Record<string, Partial<Rect>> = {
            ArrowLeft: { x: sel.x - step }, ArrowRight: { x: sel.x + step },
            ArrowUp: { y: sel.y - step }, ArrowDown: { y: sel.y + step },
        };
        if (moves[e.key]) { e.preventDefault(); onRectChange(sel.id, moves[e.key]); }
    };

    return (
        <div className="space-y-4">
            {notice}
            <Card title={title} description={description}
                actions={
                    <button
                        onClick={() => setSnap(s => !s)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold ${snap ? 'bg-[#2563eb] text-white' : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]'}`}
                    >
                        <Grid3x3 className="w-4 h-4" /> {t('overlayEditor.snap')}
                    </button>
                }
            >
                <div
                    ref={host}
                    tabIndex={0}
                    onKeyDown={onKeyDown}
                    className="w-full rounded-xl border border-[#e2e8f0] dark:border-[#374151] outline-none focus:ring-2 focus:ring-[#2563eb]/40 overflow-hidden"
                    style={{ background: CHECKER_BG }}
                >
                    <div ref={canvasRef} style={{ width: cw * scale, height: ch * scale, position: 'relative', margin: '0 auto' }}>
                        <div style={{ width: cw, height: ch, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0 }}>
                            {children}
                            {snap && (
                                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)', backgroundSize: `${GRID * 2}px ${GRID * 2}px` }} />
                            )}
                            {elements.filter(e => e.enabled).map(e => {
                                const isSel = e.id === sel?.id;
                                return (
                                    <div
                                        key={e.id}
                                        onPointerDown={startDrag(e, null)}
                                        style={{ position: 'absolute', left: e.x, top: e.y, width: e.width, height: e.height, cursor: 'move', zIndex: isSel ? 50 : e.zIndex ?? 10 }}
                                        className={`group ${isSel ? 'outline outline-2 outline-[#3b82f6]' : 'outline outline-1 outline-dashed outline-white/40 hover:outline-white/80'}`}
                                    >
                                        {/* La etiqueta va encima de la caja si hay lugar; la de los no elegidos solo al pasar el mouse, para que no tapen a otros */}
                                        <span
                                            className={`absolute left-0 px-1.5 py-0.5 text-[11px] font-bold pointer-events-none whitespace-nowrap ${isSel ? 'bg-[#3b82f6] text-white' : 'bg-black/60 text-white/80 opacity-0 group-hover:opacity-100'} ${e.y * scale >= LABEL_PX ? 'rounded-t' : 'rounded-br'}`}
                                            style={e.y * scale >= LABEL_PX
                                                ? { bottom: '100%', transform: `scale(${1 / scale})`, transformOrigin: 'bottom left' }
                                                : { top: 0, transform: `scale(${1 / scale})`, transformOrigin: 'top left' }}
                                        >
                                            {e.label}
                                        </span>
                                        {isSel && (['nw', 'ne', 'sw', 'se'] as Handle[]).map(h => (
                                            <span
                                                key={h}
                                                onPointerDown={startDrag(e, h)}
                                                className="absolute bg-white border-2 border-[#3b82f6] rounded-sm"
                                                style={{
                                                    width: 12 / scale, height: 12 / scale,
                                                    left: h.includes('w') ? -6 / scale : undefined, right: h.includes('e') ? -6 / scale : undefined,
                                                    top: h.includes('n') ? -6 / scale : undefined, bottom: h.includes('s') ? -6 / scale : undefined,
                                                    cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize',
                                                }}
                                            />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <p className="text-xs 3xl:text-sm text-[#94a3b8] mt-2">{t('overlayEditor.keyboardHint')}</p>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title={t('overlayEditor.layers')} actions={layersActions}>
                    <div className="space-y-1">
                        {elements.map(e => (
                            <div key={e.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${e.id === sel?.id ? 'bg-[#eff6ff] dark:bg-[#1e3a8a]/30' : 'hover:bg-[#f8fafc] dark:hover:bg-[#262626]'}`}>
                                {onToggle && e.toggleable !== false && (
                                    <button
                                        onClick={() => onToggle(e.id, !e.enabled)}
                                        className="p-1 text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-white"
                                        title={e.enabled ? t('overlayEditor.hide') : t('overlayEditor.show')}
                                    >
                                        {e.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 opacity-50" />}
                                    </button>
                                )}
                                <button onClick={() => setSelected(e.id)} className={`flex-1 min-w-0 truncate text-left text-sm 3xl:text-base ${e.enabled ? 'text-[#1e293b] dark:text-[#f8fafc] font-semibold' : 'text-[#94a3b8]'}`}>
                                    {e.label}
                                </button>
                                <span className="font-mono text-[11px] 3xl:text-xs text-[#94a3b8] shrink-0">{e.x},{e.y} · {e.width}×{e.height}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="space-y-4">
                    {sel && (
                        <Card title={sel.label}>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="X"><NumberInput value={sel.x} onChange={v => onRectChange(sel.id, { x: v })} /></Field>
                                <Field label="Y"><NumberInput value={sel.y} onChange={v => onRectChange(sel.id, { y: v })} /></Field>
                                <Field label={t('overlayEditor.width')}><NumberInput value={sel.width} min={MIN_SIZE} onChange={v => onRectChange(sel.id, { width: v })} /></Field>
                                <Field label={t('overlayEditor.height')}><NumberInput value={sel.height} min={MIN_SIZE} onChange={v => onRectChange(sel.id, { height: v })} /></Field>
                            </div>
                            <button
                                onClick={() => onRectChange(sel.id, { x: Math.round((cw - sel.width) / 2) })}
                                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                            >
                                <AlignHorizontalJustifyCenter className="w-4 h-4" /> {t('overlayEditor.centerH')}
                            </button>
                            {selectedExtra && <div className="mt-4">{selectedExtra(sel.id)}</div>}
                        </Card>
                    )}

                    {onCanvasChange && (
                        <Card title={t('overlayEditor.canvas')} description={t('overlayEditor.canvasHint')}>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label={t('overlayEditor.width')}>
                                    <NumberInput value={cw} min={100} max={3840} onChange={v => onCanvasChange({ width: v, height: ch })} />
                                </Field>
                                <Field label={t('overlayEditor.height')}>
                                    <NumberInput value={ch} min={40} max={2160} onChange={v => onCanvasChange({ width: cw, height: v })} />
                                </Field>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
