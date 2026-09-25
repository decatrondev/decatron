import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Grid3x3, AlignHorizontalJustifyCenter } from 'lucide-react';
import SongOverlayRenderer, { type OverlayLabels } from './SongOverlayRenderer';
import { Card, Field, NumberInput, CHECKER_BG } from './ui';
import { ELEMENT_ORDER, SAMPLE_SONGS } from '../constants/defaults';
import type { ElementConfig, ElementId, OverlayKind, OverlayLayout } from '../types';
import { toggleElement } from '../utils';
import VideoCoverNotice from './VideoCoverNotice';

type Handle = 'nw' | 'ne' | 'sw' | 'se';

interface Props {
    kind: OverlayKind;
    layout: OverlayLayout;
    onChange: (layout: OverlayLayout) => void;
    labels: OverlayLabels;
}

const GRID = 10;
const MIN_SIZE = 8;

/**
 * Editor visual: cada elemento se arrastra y se redimensiona desde las esquinas sobre el lienzo,
 * que es exactamente el overlay (mismo componente que en OBS). Flechas = mover 1 px (Shift = 10).
 */
export default function OverlayCanvasEditor({ kind, layout, onChange, labels }: Props) {
    const { t } = useTranslation('overlays');
    const host = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [selected, setSelected] = useState<ElementId>('title');
    const [snap, setSnap] = useState(true);
    const [coverHidden, setCoverHidden] = useState(false);
    const drag = useRef<{ id: ElementId; handle: Handle | null; startX: number; startY: number; pxPerUnit: number; orig: ElementConfig } | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const layoutRef = useRef(layout);
    layoutRef.current = layout;

    const ids = ELEMENT_ORDER.filter(id => kind === 'player' || id !== 'video');
    const { width: cw, height: ch } = layout.canvas;

    useEffect(() => {
        if (!host.current) return;
        const ro = new ResizeObserver(e => setScale(Math.min(1.5, e[0].contentRect.width / cw)));
        ro.observe(host.current);
        return () => ro.disconnect();
    }, [cw]);

    const setElement = useCallback((id: ElementId, patch: Partial<ElementConfig>) => {
        const l = layoutRef.current;
        onChange({ ...l, elements: { ...l.elements, [id]: { ...l.elements[id], ...patch } } });
    }, [onChange]);

    const round = (v: number) => (snap ? Math.round(v / GRID) * GRID : Math.round(v));

    useEffect(() => {
        const move = (e: PointerEvent) => {
            const d = drag.current;
            if (!d) return;
            const dx = (e.clientX - d.startX) / d.pxPerUnit;
            const dy = (e.clientY - d.startY) / d.pxPerUnit;
            const o = d.orig;
            if (!d.handle) {
                setElement(d.id, { x: round(o.x + dx), y: round(o.y + dy) });
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
            setElement(d.id, { x, y, width, height });
        };
        const up = () => { drag.current = null; };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scale, snap, setElement]);

    const startDrag = (id: ElementId, handle: Handle | null) => (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setSelected(id);
        // Píxeles de pantalla por píxel del overlay: incluye la escala del lienzo y el zoom de la página (panel-scale)
        const shown = canvasRef.current?.getBoundingClientRect().width ?? cw * scale;
        drag.current = { id, handle, startX: e.clientX, startY: e.clientY, pxPerUnit: shown / cw || 1, orig: layoutRef.current.elements[id] };
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        const step = e.shiftKey ? 10 : 1;
        const el = layout.elements[selected];
        const moves: Record<string, Partial<ElementConfig>> = {
            ArrowLeft: { x: el.x - step }, ArrowRight: { x: el.x + step },
            ArrowUp: { y: el.y - step }, ArrowDown: { y: el.y + step },
        };
        if (moves[e.key]) { e.preventDefault(); setElement(selected, moves[e.key]); }
    };

    const sel = layout.elements[selected];

    return (
        <div className="space-y-4">
            <VideoCoverNotice layout={layout} coverHidden={coverHidden} onDismiss={() => setCoverHidden(false)} />
            <Card title={t('songRequest.editor.title')} description={t('songRequest.editor.description')}
                actions={
                    <button
                        onClick={() => setSnap(s => !s)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold ${snap ? 'bg-[#2563eb] text-white' : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]'}`}
                    >
                        <Grid3x3 className="w-4 h-4" /> {t('songRequest.editor.snap')}
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
                            <SongOverlayRenderer
                                layout={{ ...layout, animations: { ...layout.animations, songChange: 'none' } }}
                                current={SAMPLE_SONGS[0]}
                                queue={SAMPLE_SONGS.slice(1)}
                                progress={{ itemId: SAMPLE_SONGS[0].id, position: 80, duration: SAMPLE_SONGS[0].durationSeconds ?? 200, playing: false }}
                                paused={false}
                                labels={labels}
                                alwaysVisible
                            />
                            {snap && (
                                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)', backgroundSize: `${GRID * 2}px ${GRID * 2}px` }} />
                            )}
                            {ids.filter(id => layout.elements[id].enabled).map(id => {
                                const e = layout.elements[id];
                                const isSel = id === selected;
                                return (
                                    <div
                                        key={id}
                                        onPointerDown={startDrag(id, null)}
                                        style={{ position: 'absolute', left: e.x, top: e.y, width: e.width, height: e.height, cursor: 'move', zIndex: isSel ? 50 : id === 'panel' ? 1 : 10 }}
                                        className={isSel ? 'outline outline-2 outline-[#3b82f6]' : 'outline outline-1 outline-dashed outline-white/40 hover:outline-white/80'}
                                    >
                                        <span
                                            className={`absolute left-0 -top-0 px-1.5 py-0.5 text-[11px] font-bold rounded-br pointer-events-none ${isSel ? 'bg-[#3b82f6] text-white' : 'bg-black/60 text-white/80'}`}
                                            style={{ transform: `scale(${1 / scale})`, transformOrigin: 'top left' }}
                                        >
                                            {t(`songRequest.elements.${id}`)}
                                        </span>
                                        {isSel && (['nw', 'ne', 'sw', 'se'] as Handle[]).map(h => (
                                            <span
                                                key={h}
                                                onPointerDown={startDrag(id, h)}
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
                <p className="text-xs 3xl:text-sm text-[#94a3b8] mt-2">{t('songRequest.editor.keyboardHint')}</p>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title={t('songRequest.editor.layers')}>
                    <div className="space-y-1">
                        {ids.map(id => {
                            const e = layout.elements[id];
                            return (
                                <div key={id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${id === selected ? 'bg-[#eff6ff] dark:bg-[#1e3a8a]/30' : 'hover:bg-[#f8fafc] dark:hover:bg-[#262626]'}`}>
                                    <button
                                        onClick={() => { const r = toggleElement(layoutRef.current, id, !e.enabled); onChange(r.layout); setCoverHidden(r.coverHidden); }}
                                        className="p-1 text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-white"
                                        title={e.enabled ? t('songRequest.editor.hide') : t('songRequest.editor.show')}
                                    >
                                        {e.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 opacity-50" />}
                                    </button>
                                    <button onClick={() => setSelected(id)} className={`flex-1 text-left text-sm 3xl:text-base ${e.enabled ? 'text-[#1e293b] dark:text-[#f8fafc] font-semibold' : 'text-[#94a3b8]'}`}>
                                        {t(`songRequest.elements.${id}`)}
                                    </button>
                                    <span className="font-mono text-[11px] 3xl:text-xs text-[#94a3b8]">{e.x},{e.y} · {e.width}×{e.height}</span>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                <div className="space-y-4">
                    <Card title={t(`songRequest.elements.${selected}`)}>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="X"><NumberInput value={sel.x} onChange={v => setElement(selected, { x: v })} /></Field>
                            <Field label="Y"><NumberInput value={sel.y} onChange={v => setElement(selected, { y: v })} /></Field>
                            <Field label={t('songRequest.editor.width')}><NumberInput value={sel.width} min={MIN_SIZE} onChange={v => setElement(selected, { width: v })} /></Field>
                            <Field label={t('songRequest.editor.height')}><NumberInput value={sel.height} min={MIN_SIZE} onChange={v => setElement(selected, { height: v })} /></Field>
                        </div>
                        <button
                            onClick={() => setElement(selected, { x: Math.round((cw - sel.width) / 2) })}
                            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                        >
                            <AlignHorizontalJustifyCenter className="w-4 h-4" /> {t('songRequest.editor.centerH')}
                        </button>
                    </Card>

                    <Card title={t('songRequest.editor.canvas')} description={t('songRequest.editor.canvasHint')}>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t('songRequest.editor.width')}>
                                <NumberInput value={cw} min={100} max={3840} onChange={v => onChange({ ...layout, canvas: { ...layout.canvas, width: v } })} />
                            </Field>
                            <Field label={t('songRequest.editor.height')}>
                                <NumberInput value={ch} min={40} max={2160} onChange={v => onChange({ ...layout, canvas: { ...layout.canvas, height: v } })} />
                            </Field>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
