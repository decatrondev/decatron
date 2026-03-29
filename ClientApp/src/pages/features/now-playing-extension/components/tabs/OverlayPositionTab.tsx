/**
 * Now Playing Extension - Overlay Position Tab (drag & drop canvas)
 */

import React, { useState, useRef } from 'react';
import type { ConfigJson, TierLimits } from '../../types';
import { CANVAS_PRESETS } from '../../constants/defaults';
import { Card, SectionTitle, Label, NumberInput, TierLock } from '../ui/SharedUI';

type DragElementId = 'card' | 'albumArt' | 'songTitle' | 'artist' | 'album' | 'progressBar' | 'timestamps' | 'providerIcon' | null;

const ELEMENT_COLORS: Record<string, { border: string; bg: string; text: string; label: string }> = {
    card:         { border: 'border-blue-500', bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Card' },
    albumArt:     { border: 'border-purple-500', bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'Album Art' },
    songTitle:    { border: 'border-green-500', bg: 'bg-green-500/15', text: 'text-green-400', label: 'Titulo' },
    artist:       { border: 'border-amber-500', bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Artista' },
    album:        { border: 'border-pink-500', bg: 'bg-pink-500/15', text: 'text-pink-400', label: 'Album' },
    progressBar:  { border: 'border-cyan-500', bg: 'bg-cyan-500/15', text: 'text-cyan-400', label: 'Progreso' },
    timestamps:   { border: 'border-orange-500', bg: 'bg-orange-500/15', text: 'text-orange-400', label: 'Tiempo' },
    providerIcon: { border: 'border-red-500', bg: 'bg-red-500/15', text: 'text-red-400', label: 'Icono' },
};

export const OverlayPositionTab: React.FC<{
    config: ConfigJson;
    onUpdate: (partial: Partial<ConfigJson>) => void;
    limits: TierLimits;
}> = ({ config, onUpdate, limits }) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [dragElement, setDragElement] = useState<DragElementId>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [resizeElement, setResizeElement] = useState<DragElementId>(null);
    const [resizeHandle, setResizeHandle] = useState<string | null>(null);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [snapToGrid, setSnapToGrid] = useState(true);
    const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set());
    // Lasso state
    const [isLassoing, setIsLassoing] = useState(false);
    const [lassoStart, setLassoStart] = useState({ x: 0, y: 0 });
    const [lassoEnd, setLassoEnd] = useState({ x: 0, y: 0 });
    // Multi-drag offsets
    const [multiDragOffsets, setMultiDragOffsets] = useState<Record<string, { dx: number; dy: number }>>({});

    const mode = config.overlay.mode || 'card';
    const els = mode === 'card' ? config.overlay.cardConfig : config.overlay.freeConfig;
    const canvasW = config.canvas.width;
    const canvasH = config.canvas.height;

    const previewMaxW = 700;
    const scale = previewMaxW / canvasW;
    const previewH = canvasH * scale;

    const snapValue = (v: number) => snapToGrid ? Math.round(v / 10) * 10 : Math.round(v);

    const updateCanvas = (partial: Partial<ConfigJson['canvas']>) => {
        onUpdate({ canvas: { ...config.canvas, ...partial } });
    };

    const configKey = mode === 'card' ? 'cardConfig' : 'freeConfig';

    const updateElement = (id: string, partial: Record<string, number>) => {
        onUpdate({
            overlay: {
                ...config.overlay,
                [configKey]: {
                    ...els,
                    [id]: { ...(els as any)[id], ...partial },
                },
            },
        });
    };

    const updateMultipleElements = (updates: Record<string, Record<string, number>>) => {
        const newEls = { ...els } as any;
        for (const [id, partial] of Object.entries(updates)) {
            newEls[id] = { ...newEls[id], ...partial };
        }
        onUpdate({ overlay: { ...config.overlay, [configKey]: newEls } });
    };

    const setMode = (m: 'card' | 'free') => {
        setSelectedElements(new Set());
        onUpdate({ overlay: { ...config.overlay, mode: m } });
    };

    // Get element rect in canvas coords
    const getElRect = (id: string): { x: number; y: number; w: number; h: number } => {
        const e = (els as any)[id];
        if (!e) return { x: 0, y: 0, w: 50, h: 20 };
        if (id === 'card') return { x: e.x, y: e.y, w: e.width, h: e.height };
        if (id === 'albumArt') return { x: e.x, y: e.y, w: e.size, h: e.size };
        if (id === 'progressBar') return { x: e.x, y: e.y, w: e.width, h: Math.max(e.height, 8) };
        if (id === 'providerIcon') return { x: e.x, y: e.y, w: e.size, h: e.size };
        if (id === 'songTitle' || id === 'artist' || id === 'album') return { x: e.x, y: e.y, w: e.maxWidth, h: 24 };
        if (id === 'timestamps') return { x: e.x, y: e.y, w: 120, h: 16 };
        return { x: 0, y: 0, w: 50, h: 20 };
    };

    const getVisibleElements = (): string[] => {
        if (mode === 'card') return ['card'];
        const visible: string[] = ['card'];
        if (config.layout.showAlbumArt) visible.push('albumArt');
        visible.push('songTitle');
        if (config.layout.showArtist) visible.push('artist');
        if (config.layout.showAlbum) visible.push('album');
        if (config.layout.showProgressBar) visible.push('progressBar');
        if (config.layout.showTimeStamps) visible.push('timestamps');
        if (config.layout.showProviderIcon) visible.push('providerIcon');
        return visible;
    };

    // Convert mouse to canvas coords
    const mouseToCanvas = (e: React.MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const r = canvasRef.current.getBoundingClientRect();
        return {
            x: ((e.clientX - r.left) / r.width) * canvasW,
            y: ((e.clientY - r.top) / r.height) * canvasH,
        };
    };

    // Element drag
    const handleElementMouseDown = (id: DragElementId, e: React.MouseEvent) => {
        if (!id) return;

        // In free mode, card passes clicks through to canvas (for lasso) unless already selected
        if (mode === 'free' && id === 'card' && !selectedElements.has('card')) {
            return; // Let it bubble to canvas → starts lasso
        }

        e.stopPropagation();
        const mouse = mouseToCanvas(e);
        const rect = getElRect(id);

        // If clicking a selected element in a multi-selection, start multi-drag
        if (selectedElements.has(id) && selectedElements.size > 1) {
            const offsets: Record<string, { dx: number; dy: number }> = {};
            selectedElements.forEach((elId) => {
                const r = getElRect(elId);
                offsets[elId] = { dx: mouse.x - r.x, dy: mouse.y - r.y };
            });
            setMultiDragOffsets(offsets);
            setDragElement(id);
            return;
        }

        // Single select + drag
        setSelectedElements(new Set([id]));
        setDragOffset({ x: mouse.x - rect.x, y: mouse.y - rect.y });
        setDragElement(id);
        setMultiDragOffsets({});
    };

    // Resize
    const handleResizeDown = (id: DragElementId, handle: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!id) return;
        const rect = getElRect(id);
        setResizeElement(id);
        setResizeHandle(handle);
        setResizeStart({ x: rect.x, y: rect.y, width: rect.w, height: rect.h });
        setSelectedElements(new Set([id]));
    };

    // Canvas background mousedown → start lasso
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        // Allow lasso from canvas background OR from card in free mode (card passes clicks through)
        const isCanvasBg = e.target === e.currentTarget;
        const isCardPassthrough = mode === 'free' && !isCanvasBg;
        if (!isCanvasBg && !isCardPassthrough) return;

        const mouse = mouseToCanvas(e);
        setIsLassoing(true);
        setLassoStart(mouse);
        setLassoEnd(mouse);
        setSelectedElements(new Set());
    };

    // Mouse move: drag, resize, or lasso
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!canvasRef.current) return;
        const mouse = mouseToCanvas(e);

        // Lasso
        if (isLassoing) {
            setLassoEnd(mouse);
            return;
        }

        // Multi-drag
        if (dragElement && Object.keys(multiDragOffsets).length > 0) {
            const updates: Record<string, Record<string, number>> = {};
            Object.entries(multiDragOffsets).forEach(([elId, offset]) => {
                const rect = getElRect(elId);
                let newX = snapValue(mouse.x - offset.dx);
                let newY = snapValue(mouse.y - offset.dy);
                newX = Math.max(0, Math.min(newX, canvasW - rect.w));
                newY = Math.max(0, Math.min(newY, canvasH - rect.h));
                updates[elId] = { x: newX, y: newY };
            });
            updateMultipleElements(updates);
            return;
        }

        // Single drag
        if (dragElement) {
            const rect = getElRect(dragElement);
            let newX = snapValue(mouse.x - dragOffset.x);
            let newY = snapValue(mouse.y - dragOffset.y);
            newX = Math.max(0, Math.min(newX, canvasW - rect.w));
            newY = Math.max(0, Math.min(newY, canvasH - rect.h));
            updateElement(dragElement, { x: newX, y: newY });
            return;
        }

        // Resize
        if (resizeElement && resizeHandle) {
            let newX = resizeStart.x, newY = resizeStart.y;
            let newW = resizeStart.width, newH = resizeStart.height;

            if (resizeHandle.includes('e')) newW = snapValue(mouse.x - resizeStart.x);
            if (resizeHandle.includes('w')) { newW = snapValue(resizeStart.width + (resizeStart.x - mouse.x)); newX = snapValue(mouse.x); }
            if (resizeHandle.includes('s')) newH = snapValue(mouse.y - resizeStart.y);
            if (resizeHandle.includes('n')) { newH = snapValue(resizeStart.height + (resizeStart.y - mouse.y)); newY = snapValue(mouse.y); }

            newW = Math.max(20, newW);
            newH = Math.max(4, newH);

            if (resizeElement === 'card') {
                updateElement('card', { x: newX, y: newY, width: newW, height: newH });
            } else if (resizeElement === 'albumArt' || resizeElement === 'providerIcon') {
                const size = Math.max(8, Math.max(newW, newH));
                updateElement(resizeElement, { x: newX, y: newY, size });
            } else if (resizeElement === 'progressBar') {
                updateElement('progressBar', { x: newX, y: newY, width: newW, height: Math.max(2, newH) });
            } else if (resizeElement === 'songTitle' || resizeElement === 'artist' || resizeElement === 'album') {
                updateElement(resizeElement, { x: newX, y: newY, maxWidth: newW });
            }
        }
    };

    // Mouse up: end drag/resize/lasso
    const handleMouseUp = () => {
        // Lasso: select elements inside rectangle
        if (isLassoing) {
            const lx = Math.min(lassoStart.x, lassoEnd.x);
            const ly = Math.min(lassoStart.y, lassoEnd.y);
            const lw = Math.abs(lassoEnd.x - lassoStart.x);
            const lh = Math.abs(lassoEnd.y - lassoStart.y);

            if (lw > 5 || lh > 5) { // Only if dragged enough
                const selected = new Set<string>();
                getVisibleElements().forEach((id) => {
                    const r = getElRect(id);
                    // Check overlap
                    if (r.x < lx + lw && r.x + r.w > lx && r.y < ly + lh && r.y + r.h > ly) {
                        selected.add(id);
                    }
                });
                setSelectedElements(selected);
            }
            setIsLassoing(false);
        }

        setDragElement(null);
        setResizeElement(null);
        setResizeHandle(null);
        setMultiDragOffsets({});
    };

    const resetPositions = () => {
        const baseX = 30;
        const baseY = canvasH - 270;
        if (mode === 'card') {
            updateElement('card', { x: baseX, y: baseY, width: 760, height: 220 });
        } else {
            const artSize = (config.albumArt.size || 86) * 2;
            const cardW = 760;
            const pad = 24;
            const textX = baseX + pad + artSize + 20;
            const textW = Math.max(cardW - artSize - pad * 2 - 40, 100);
            onUpdate({
                overlay: {
                    ...config.overlay,
                    freeConfig: {
                        card: { x: baseX, y: baseY, width: cardW, height: 220 },
                        albumArt: { x: baseX + pad, y: baseY + pad, size: artSize },
                        songTitle: { x: textX, y: baseY + pad, maxWidth: textW },
                        artist: { x: textX, y: baseY + pad + 56, maxWidth: textW },
                        album: { x: textX, y: baseY + pad + 100, maxWidth: textW },
                        progressBar: { x: textX, y: baseY + pad + 148, width: textW, height: 8 },
                        timestamps: { x: textX, y: baseY + pad + 164 },
                        providerIcon: { x: baseX + cardW - pad - 32, y: baseY + pad, size: 32 },
                    },
                },
            });
        }
    };

    const resizeHandlePositions = ['nw', 'ne', 'sw', 'se'] as const;
    const handleCursors: Record<string, string> = { nw: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', se: 'nwse-resize' };

    const canResize = (id: string) => ['card', 'albumArt', 'progressBar', 'songTitle', 'artist', 'album', 'providerIcon'].includes(id);

    const renderDraggableElement = (id: string) => {
        const rect = getElRect(id);
        const color = ELEMENT_COLORS[id] || ELEMENT_COLORS.card;
        const isActive = dragElement === id || resizeElement === id;
        const isSelected = selectedElements.has(id);
        const isIdle = !isActive && !isSelected;

        return (
            <div
                key={id}
                className={`absolute rounded transition-all duration-100 ${
                    isActive
                        ? `${color.border} ${color.bg} ring-2 ring-white/40 shadow-lg`
                        : isSelected
                            ? `${color.border} ${color.bg} ring-1 ring-white/20`
                            : `border-[#555] bg-white/5`
                }`}
                style={{
                    left: `${(rect.x / canvasW) * 100}%`,
                    top: `${(rect.y / canvasH) * 100}%`,
                    width: `${(rect.w / canvasW) * 100}%`,
                    height: `${(rect.h / canvasH) * 100}%`,
                    borderWidth: isIdle ? 1 : 2,
                    borderStyle: isIdle && id !== 'card' ? 'dashed' : 'solid',
                    cursor: isActive ? 'grabbing' : 'grab',
                    minWidth: '4px',
                    minHeight: '4px',
                    zIndex: id === 'card' ? 1 : isActive ? 20 : isSelected ? 15 : 3,
                    opacity: isIdle ? 0.4 : 1,
                }}
                onMouseDown={(e) => handleElementMouseDown(id as DragElementId, e)}
            >
                {/* Label — only when selected or active */}
                {(isSelected || isActive) && (
                    <div className={`absolute -top-4 left-0 text-[8px] font-bold ${color.text} bg-black/70 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none`}>
                        {color.label} ({rect.x},{rect.y})
                    </div>
                )}

                {/* Resize handles — only when selected (single) */}
                {canResize(id) && isSelected && selectedElements.size === 1 && resizeHandlePositions.map((handle) => (
                    <div
                        key={handle}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleResizeDown(id as DragElementId, handle, e);
                        }}
                        className={`absolute w-3 h-3 bg-white border-2 ${color.border} rounded-full hover:scale-150 transition-transform z-30`}
                        style={{
                            cursor: handleCursors[handle],
                            top: handle.includes('n') ? '-6px' : 'auto',
                            bottom: handle.includes('s') ? '-6px' : 'auto',
                            left: handle.includes('w') ? '-6px' : 'auto',
                            right: handle.includes('e') ? '-6px' : 'auto',
                        }}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-5">
            {/* Mode selector */}
            <Card>
                <SectionTitle>Modo de Posicionamiento</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setMode('card')}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                            mode === 'card' ? 'border-blue-500 bg-blue-500/10' : 'border-[#374151] bg-[#262626] hover:border-[#4b5563]'
                        }`}
                    >
                        <div className="font-bold text-[#f8fafc] text-sm">Card</div>
                        <div className="text-xs text-[#94a3b8] mt-0.5">Un solo bloque con layout automatico</div>
                    </button>
                    <TierLock allowed={limits.allowFreeMode} requiredTier="premium">
                        <button
                            onClick={() => setMode('free')}
                            className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                                mode === 'free' ? 'border-green-500 bg-green-500/10' : 'border-[#374151] bg-[#262626] hover:border-[#4b5563]'
                            }`}
                        >
                            <div className="font-bold text-[#f8fafc] text-sm">Libre</div>
                            <div className="text-xs text-[#94a3b8] mt-0.5">Cada elemento se posiciona individualmente</div>
                        </button>
                    </TierLock>
                </div>
            </Card>

            {/* Canvas Size */}
            <Card>
                <SectionTitle>Tamano del Canvas</SectionTitle>
                <div className="space-y-4">
                    <div>
                        <Label>Presets</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {CANVAS_PRESETS.map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => updateCanvas({ width: preset.width, height: preset.height })}
                                    className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                                        canvasW === preset.width && canvasH === preset.height
                                            ? 'border-blue-500 bg-blue-500/10 text-blue-400 font-medium'
                                            : 'border-[#374151] bg-[#262626] text-[#94a3b8] hover:border-[#4b5563]'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Ancho</Label>
                            <NumberInput value={canvasW} onChange={(v) => updateCanvas({ width: v })} min={640} max={7680} />
                        </div>
                        <div>
                            <Label>Alto</Label>
                            <NumberInput value={canvasH} onChange={(v) => updateCanvas({ height: v })} min={360} max={4320} />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Interactive Canvas */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <SectionTitle className="mb-0">Canvas</SectionTitle>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-[#94a3b8] cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={snapToGrid}
                                onChange={(e) => setSnapToGrid(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-[#374151] bg-[#262626] text-blue-500 focus:ring-0"
                            />
                            Grid
                        </label>
                        <button
                            onClick={resetPositions}
                            className="px-3 py-1 bg-[#262626] border border-[#374151] text-[#94a3b8] rounded-lg text-xs hover:bg-[#374151] transition-colors"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                <p className="text-xs text-[#64748b] mb-3">
                    Arrastra los elementos para moverlos. Clic para seleccionar y redimensionar con las esquinas.
                </p>

                {/* Element legend — clickable to select */}
                {mode === 'free' && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {getVisibleElements().map((id) => {
                            const color = ELEMENT_COLORS[id];
                            const isSel = selectedElements.has(id);
                            return (
                                <button
                                    key={id}
                                    onClick={() => {
                                        if (isSel) {
                                            const next = new Set(selectedElements);
                                            next.delete(id);
                                            setSelectedElements(next);
                                        } else {
                                            setSelectedElements(new Set([...selectedElements, id]));
                                        }
                                    }}
                                    className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-all ${
                                        isSel
                                            ? `${color.text} ${color.bg} ${color.border}`
                                            : 'text-[#64748b] bg-[#1B1C1D] border-[#374151] hover:border-[#555]'
                                    }`}
                                >
                                    {color.label}
                                </button>
                            );
                        })}
                        {selectedElements.size > 0 && (
                            <button
                                onClick={() => setSelectedElements(new Set())}
                                className="text-[10px] text-[#64748b] hover:text-[#94a3b8] px-2 py-0.5"
                            >
                                Deseleccionar
                            </button>
                        )}
                        <button
                            onClick={() => setSelectedElements(new Set(getVisibleElements()))}
                            className="text-[10px] text-[#64748b] hover:text-[#94a3b8] px-2 py-0.5"
                        >
                            Todos
                        </button>
                    </div>
                )}

                <div
                    ref={canvasRef}
                    className="relative mx-auto overflow-hidden rounded-lg border-2 border-[#374151] select-none"
                    style={{
                        width: `${previewMaxW}px`,
                        height: `${previewH}px`,
                        backgroundColor: '#0a0a0a',
                        backgroundImage: snapToGrid ? 'radial-gradient(circle, #333 1px, transparent 1px)' : 'none',
                        backgroundSize: '20px 20px',
                        cursor: isLassoing ? 'crosshair' : dragElement ? 'grabbing' : 'default',
                    }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {getVisibleElements().map((id) => renderDraggableElement(id))}

                    {/* Lasso rectangle */}
                    {isLassoing && (
                        <div
                            className="absolute border border-blue-400 bg-blue-400/10 pointer-events-none"
                            style={{
                                left: `${(Math.min(lassoStart.x, lassoEnd.x) / canvasW) * 100}%`,
                                top: `${(Math.min(lassoStart.y, lassoEnd.y) / canvasH) * 100}%`,
                                width: `${(Math.abs(lassoEnd.x - lassoStart.x) / canvasW) * 100}%`,
                                height: `${(Math.abs(lassoEnd.y - lassoStart.y) / canvasH) * 100}%`,
                                zIndex: 50,
                            }}
                        />
                    )}

                    {/* Selection count badge */}
                    {selectedElements.size > 1 && (
                        <div className="absolute top-2 left-2 text-[10px] font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded pointer-events-none z-50">
                            {selectedElements.size} seleccionados
                        </div>
                    )}

                    <span className="absolute bottom-1 right-2 text-[10px] text-[#64748b] font-mono pointer-events-none">
                        {canvasW}x{canvasH}
                    </span>
                </div>
            </Card>

            {/* Selected element details */}
            {selectedElements.size === 1 && (() => {
                const sel = Array.from(selectedElements)[0];
                return (
                    <Card>
                        <SectionTitle>{ELEMENT_COLORS[sel]?.label || sel} — Valores</SectionTitle>
                        <div className="grid grid-cols-4 gap-3">
                            <div>
                                <Label>X</Label>
                                <NumberInput value={getElRect(sel).x} onChange={(v) => updateElement(sel, { x: v })} min={0} max={canvasW} />
                            </div>
                            <div>
                                <Label>Y</Label>
                                <NumberInput value={getElRect(sel).y} onChange={(v) => updateElement(sel, { y: v })} min={0} max={canvasH} />
                            </div>
                            {(sel === 'albumArt' || sel === 'providerIcon') && (
                                <div>
                                    <Label>Tamano</Label>
                                    <NumberInput value={(els as any)[sel].size} onChange={(v) => updateElement(sel, { size: v })} min={8} max={400} />
                                </div>
                            )}
                            {(sel === 'songTitle' || sel === 'artist' || sel === 'album') && (
                                <div>
                                    <Label>Ancho max</Label>
                                    <NumberInput value={(els as any)[sel].maxWidth} onChange={(v) => updateElement(sel, { maxWidth: v })} min={50} max={canvasW} />
                                </div>
                            )}
                            {sel === 'progressBar' && (
                                <>
                                    <div>
                                        <Label>Ancho</Label>
                                        <NumberInput value={els.progressBar.width} onChange={(v) => updateElement('progressBar', { width: v })} min={20} max={canvasW} />
                                    </div>
                                    <div>
                                        <Label>Alto</Label>
                                        <NumberInput value={els.progressBar.height} onChange={(v) => updateElement('progressBar', { height: v })} min={2} max={50} />
                                    </div>
                                </>
                            )}
                            {sel === 'card' && (
                                <>
                                    <div>
                                        <Label>Ancho</Label>
                                        <NumberInput value={els.card.width} onChange={(v) => updateElement('card', { width: v })} min={100} max={canvasW} />
                                    </div>
                                    <div>
                                        <Label>Alto</Label>
                                        <NumberInput value={els.card.height} onChange={(v) => updateElement('card', { height: v })} min={50} max={canvasH} />
                                    </div>
                                </>
                            )}
                        </div>
                    </Card>
                );
            })()}

            {/* Card mode manual inputs (fallback when nothing selected) */}
            {selectedElements.size === 0 && mode === 'card' && (
                <Card>
                    <SectionTitle>Card — Valores</SectionTitle>
                    <div className="grid grid-cols-4 gap-3">
                        <div>
                            <Label>X</Label>
                            <NumberInput value={els.card.x} onChange={(v) => updateElement('card', { x: v })} min={0} max={canvasW} />
                        </div>
                        <div>
                            <Label>Y</Label>
                            <NumberInput value={els.card.y} onChange={(v) => updateElement('card', { y: v })} min={0} max={canvasH} />
                        </div>
                        <div>
                            <Label>Ancho</Label>
                            <NumberInput value={els.card.width} onChange={(v) => updateElement('card', { width: v })} min={100} max={canvasW} />
                        </div>
                        <div>
                            <Label>Alto</Label>
                            <NumberInput value={els.card.height} onChange={(v) => updateElement('card', { height: v })} min={50} max={canvasH} />
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};
