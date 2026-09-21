/**
 * Editor de canvas generico para overlays: dibuja un lienzo del tamaño real
 * (1920x1080, etc.) escalado para caber en el panel, con grilla y snap, y deja
 * arrastrar los items que recibe. No sabe nada del contenido: cada item es un
 * ReactNode con su posicion. Primer consumidor: Game Overlays; el timer sigue
 * con su editor propio (migrarlo es una tarea aparte, ver GAME_OVERLAYS_PLAN.md).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface CanvasItem {
    id: string;
    position: { x: number; y: number };
    node: React.ReactNode;
    locked?: boolean;
}

interface Props {
    width: number;
    height: number;
    items: CanvasItem[];
    onMove: (id: string, position: { x: number; y: number }) => void;
    snap?: number;          // 0 = sin snap
    showGrid?: boolean;
    background?: string;    // color base del lienzo (simula el juego detras)
    maxDisplayWidth?: number;
}

export function CanvasEditor({ width, height, items, onMove, snap = 10, showGrid = true, background = '#0b0d10', maxDisplayWidth = 960 }: Props) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.5);
    const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
    const [dragging, setDragging] = useState<string | null>(null);

    // Escala para que el canvas quepa en el ancho disponible.
    useEffect(() => {
        const compute = () => {
            const avail = Math.min(wrapRef.current?.clientWidth ?? maxDisplayWidth, maxDisplayWidth);
            setScale(Math.min(1, avail / width));
        };
        compute();
        window.addEventListener('resize', compute);
        return () => window.removeEventListener('resize', compute);
    }, [width, maxDisplayWidth]);

    const clamp = useCallback((x: number, y: number) => ({
        x: Math.max(0, Math.min(width - 20, x)),
        y: Math.max(0, Math.min(height - 20, y)),
    }), [width, height]);

    const onPointerDown = (item: CanvasItem) => (e: React.PointerEvent) => {
        if (item.locked) return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = { id: item.id, startX: e.clientX, startY: e.clientY, originX: item.position.x, originY: item.position.y };
        setDragging(item.id);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        let x = d.originX + (e.clientX - d.startX) / scale;
        let y = d.originY + (e.clientY - d.startY) / scale;
        if (snap > 0) { x = Math.round(x / snap) * snap; y = Math.round(y / snap) * snap; }
        onMove(d.id, clamp(x, y));
    };

    const onPointerUp = () => { dragRef.current = null; setDragging(null); };

    return (
        <div ref={wrapRef} className="w-full">
            <div
                style={{
                    width: width * scale,
                    height: height * scale,
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 8,
                    border: '1px solid #374151',
                    background,
                    backgroundImage: showGrid ? 'radial-gradient(circle, rgba(255,255,255,.12) 1px, transparent 1px)' : undefined,
                    backgroundSize: showGrid ? `${Math.max(8, snap || 20) * scale * 2}px ${Math.max(8, snap || 20) * scale * 2}px` : undefined,
                }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
            >
                {/* Lienzo real escalado: los hijos usan px reales. */}
                <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0 }}>
                    {items.map(item => (
                        <div
                            key={item.id}
                            onPointerDown={onPointerDown(item)}
                            style={{
                                position: 'absolute',
                                left: item.position.x,
                                top: item.position.y,
                                cursor: item.locked ? 'default' : dragging === item.id ? 'grabbing' : 'grab',
                                outline: dragging === item.id ? '2px dashed #60a5fa' : undefined,
                                outlineOffset: 4,
                                userSelect: 'none',
                                touchAction: 'none',
                            }}
                        >
                            {item.node}
                        </div>
                    ))}
                </div>
            </div>
            <div className="text-[11px] text-[#6b7280] mt-1.5">
                {width}×{height} · escala {Math.round(scale * 100)}% · arrastra la tarjeta para ubicarla{snap ? ` · snap ${snap}px` : ''}
            </div>
        </div>
    );
}
