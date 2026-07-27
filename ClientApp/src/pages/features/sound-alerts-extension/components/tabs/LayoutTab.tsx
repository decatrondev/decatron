import React, { useState, useRef, useCallback } from 'react';
import {
    LayoutIcon as Layout, Type, Video, Move, RotateCcw, Eye
} from 'lucide-react';
import type { Layout as LayoutType, SelectedElement, SoundFile, TextLine, Styles } from '../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, DEFAULT_LAYOUT } from '../../constants/defaults';

interface LayoutTabProps {
    layout: LayoutType;
    setLayout: React.Dispatch<React.SetStateAction<LayoutType>>;
    files: SoundFile[];
    channelName: string;
    textLines: TextLine[];
    styles: Styles;
    textOutlineEnabled: boolean;
    textOutlineColor: string;
    textOutlineWidth: number;
}

export function LayoutTab({
    layout, setLayout,
    files, channelName, textLines, styles,
    textOutlineEnabled, textOutlineColor, textOutlineWidth,
}: LayoutTabProps) {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [selectedElement, setSelectedElement] = useState<SelectedElement>(null);
    const [previewFileId, setPreviewFileId] = useState<number | null>(null);

    // Drag state
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Resize state
    const [isResizing, setIsResizing] = useState(false);
    const [resizeHandle, setResizeHandle] = useState<string | null>(null);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0, ex: 0, ey: 0 });

    // ============================================
    // PREVIEW
    // ============================================

    const previewFile = files.find(f => f.id === previewFileId);

    const getFileUrl = (file: SoundFile): string => {
        if (file.fileName.startsWith('/system-files/') || file.fileName.startsWith('system-files/')) {
            return `/${file.fileName.replace(/^\//, '')}`;
        }
        return `/uploads/soundalerts/${channelName}/${file.fileName}`;
    };

    const getTextShadowStyle = (shadow: string): string => {
        switch (shadow) {
            case 'normal': return '2px 2px 4px rgba(0,0,0,0.5)';
            case 'strong': return '3px 3px 6px rgba(0,0,0,0.8)';
            case 'glow': return '0 0 10px rgba(255,255,255,0.8)';
            default: return 'none';
        }
    };

    // ============================================
    // HELPERS
    // ============================================

    const getCanvasScale = useCallback(() => {
        if (!canvasRef.current) return { scaleX: 1, scaleY: 1 };
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            scaleX: CANVAS_WIDTH / rect.width,
            scaleY: CANVAS_HEIGHT / rect.height,
        };
    }, []);

    const getMousePos = useCallback((e: React.MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const { scaleX, scaleY } = getCanvasScale();
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    }, [getCanvasScale]);

    const snap = (v: number) => Math.round(v / 10) * 10;

    // ============================================
    // DRAG & DROP
    // ============================================

    const handleMouseDown = useCallback((e: React.MouseEvent, type: 'media' | 'text') => {
        e.stopPropagation();
        setSelectedElement({ type });

        const element = type === 'media' ? layout.media : layout.text;
        const mouse = getMousePos(e);

        setDragOffset({ x: mouse.x - element.x, y: mouse.y - element.y });
        setIsDragging(true);
    }, [layout, getMousePos]);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent, type: 'media' | 'text', handle: string) => {
        e.stopPropagation();
        setSelectedElement({ type });

        const element = type === 'media' ? layout.media : layout.text;
        const mouse = getMousePos(e);

        setResizeStart({
            x: element.x,
            y: element.y,
            w: element.width,
            h: element.height,
            ex: mouse.x,
            ey: mouse.y,
        });
        setResizeHandle(handle);
        setIsResizing(true);
    }, [layout, getMousePos]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!canvasRef.current || !selectedElement) return;
        const mouse = getMousePos(e);

        if (isDragging) {
            let newX = snap(mouse.x - dragOffset.x);
            let newY = snap(mouse.y - dragOffset.y);

            const element = selectedElement.type === 'media' ? layout.media : layout.text;
            newX = Math.max(0, Math.min(newX, CANVAS_WIDTH - element.width));
            newY = Math.max(0, Math.min(newY, CANVAS_HEIGHT - element.height));

            if (selectedElement.type === 'media') {
                setLayout(prev => ({ ...prev, media: { ...prev.media, x: newX, y: newY } }));
            } else {
                setLayout(prev => ({ ...prev, text: { ...prev.text, x: newX, y: newY } }));
            }
        }

        if (isResizing && resizeHandle) {
            const dx = mouse.x - resizeStart.ex;
            const dy = mouse.y - resizeStart.ey;

            let newX = resizeStart.x;
            let newY = resizeStart.y;
            let newW = resizeStart.w;
            let newH = resizeStart.h;

            if (resizeHandle.includes('e')) newW = Math.max(100, resizeStart.w + dx);
            if (resizeHandle.includes('w')) {
                newW = Math.max(100, resizeStart.w - dx);
                newX = resizeStart.x + (resizeStart.w - newW);
            }
            if (resizeHandle.includes('s')) newH = Math.max(50, resizeStart.h + dy);
            if (resizeHandle.includes('n')) {
                newH = Math.max(50, resizeStart.h - dy);
                newY = resizeStart.y + (resizeStart.h - newH);
            }

            newX = snap(newX);
            newY = snap(newY);
            newW = snap(newW);
            newH = snap(newH);

            if (selectedElement.type === 'media') {
                setLayout(prev => ({ ...prev, media: { ...prev.media, x: newX, y: newY, width: newW, height: newH } }));
            } else {
                setLayout(prev => ({ ...prev, text: { ...prev.text, x: newX, y: newY, width: newW, height: newH } }));
            }
        }
    }, [isDragging, isResizing, selectedElement, dragOffset, resizeHandle, resizeStart, layout, getMousePos]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsResizing(false);
        setResizeHandle(null);
    }, []);

    const handleReset = () => {
        setLayout(DEFAULT_LAYOUT);
        setSelectedElement(null);
    };

    // ============================================
    // RENDER CANVAS ELEMENT
    // ============================================

    const renderResizeHandles = (type: 'media' | 'text', color: string) => (
        ['nw', 'ne', 'sw', 'se'].map((handle) => (
            <div
                key={handle}
                onMouseDown={(e) => handleResizeMouseDown(e, type, handle)}
                className="absolute w-4 h-4 bg-white border-2 rounded-full cursor-nwse-resize hover:scale-125 transition-transform z-50"
                style={{
                    borderColor: color,
                    top: handle.includes('n') ? '-8px' : 'auto',
                    bottom: handle.includes('s') ? '-8px' : 'auto',
                    left: handle.includes('w') ? '-8px' : 'auto',
                    right: handle.includes('e') ? '-8px' : 'auto',
                }}
            />
        ))
    );

    const isPreviewMode = previewFile != null;

    // ============================================
    // PROPERTIES PANEL
    // ============================================

    const renderProperties = () => {
        if (!selectedElement) {
            return (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    <Move className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Selecciona un elemento en el canvas para editar sus propiedades</p>
                </div>
            );
        }

        const isMedia = selectedElement.type === 'media';
        const element = isMedia ? layout.media : layout.text;
        const color = isMedia ? '#9333ea' : '#22c55e';
        const label = isMedia ? 'Media (Video/Imagen)' : 'Texto';
        const Icon = isMedia ? Video : Type;

        return (
            <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" style={{ color }} />
                    <span className="font-bold text-[#1e293b] dark:text-white">{label}</span>
                </div>

                {/* Position & Size */}
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { label: 'X', key: 'x', value: element.x },
                        { label: 'Y', key: 'y', value: element.y },
                        { label: 'Ancho', key: 'width', value: element.width },
                        { label: 'Alto', key: 'height', value: element.height },
                    ].map(({ label: lbl, key, value }) => (
                        <div key={key}>
                            <label className="text-xs text-gray-500 block mb-1">{lbl}</label>
                            <input
                                type="number"
                                value={value}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    if (isMedia) {
                                        setLayout(prev => ({ ...prev, media: { ...prev.media, [key]: val } }));
                                    } else {
                                        setLayout(prev => ({ ...prev, text: { ...prev.text, [key]: val } }));
                                    }
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                        </div>
                    ))}
                </div>

                {/* Text alignment */}
                {!isMedia && (
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Alineacion</label>
                        <select
                            value={layout.text.align || 'center'}
                            onChange={(e) => setLayout(prev => ({ ...prev, text: { ...prev.text, align: e.target.value } }))}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                            <option value="left">Izquierda</option>
                            <option value="center">Centro</option>
                            <option value="right">Derecha</option>
                        </select>
                    </div>
                )}
            </div>
        );
    };

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="space-y-4">
            {/* Canvas Card */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-lg overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-[#e2e8f0] dark:border-[#374151] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                        <Layout className="w-4 h-4 text-[#2563eb]" />
                        Editor Visual
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <RotateCcw className="w-3 h-3" />
                            Reset
                        </button>
                        <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {CANVAS_WIDTH} x {CANVAS_HEIGHT}
                        </span>
                    </div>
                </div>

                {/* Preview selector */}
                <div className="px-4 pt-3 flex items-center gap-3">
                    <Eye className="w-4 h-4 text-purple-500 shrink-0" />
                    <select
                        value={previewFileId ?? ''}
                        onChange={(e) => setPreviewFileId(e.target.value ? parseInt(e.target.value) : null)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                        <option value="">Sin preview (solo cajas)</option>
                        {files.map(f => (
                            <option key={f.id} value={f.id}>
                                {f.rewardTitle} — {f.fileName} ({f.fileType})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Canvas */}
                <div className="p-4">
                    <div
                        ref={canvasRef}
                        className="relative bg-black rounded-xl overflow-hidden select-none cursor-crosshair mx-auto"
                        style={{
                            width: '100%',
                            aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setSelectedElement(null);
                            }
                        }}
                    >
                        {/* Grid overlay */}
                        {!isPreviewMode && (
                            <div
                                className="absolute inset-0 pointer-events-none opacity-10"
                                style={{
                                    backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
                                    backgroundSize: `${100 / 19.2}% ${100 / 10.8}%`,
                                }}
                            />
                        )}

                        {/* ====== MEDIA ELEMENT ====== */}
                        {layout?.media && (
                            <div
                                onMouseDown={(e) => handleMouseDown(e, 'media')}
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute cursor-move ${
                                    selectedElement?.type === 'media'
                                        ? 'ring-4 ring-white ring-offset-2 ring-offset-black z-50'
                                        : 'hover:ring-2 hover:ring-white/50 z-40'
                                }`}
                                style={{
                                    left: `${(layout.media.x / CANVAS_WIDTH) * 100}%`,
                                    top: `${(layout.media.y / CANVAS_HEIGHT) * 100}%`,
                                    width: `${(layout.media.width / CANVAS_WIDTH) * 100}%`,
                                    height: `${(layout.media.height / CANVAS_HEIGHT) * 100}%`,
                                    border: isPreviewMode ? 'none' : '2px solid #9333ea',
                                    backgroundColor: isPreviewMode ? 'transparent' : 'rgba(147, 51, 234, 0.1)',
                                }}
                            >
                                {/* Label */}
                                <div
                                    className="absolute -top-6 left-0 text-xs font-bold px-2 py-1 rounded-t text-white whitespace-nowrap"
                                    style={{ backgroundColor: '#9333ea' }}
                                >
                                    {previewFile ? `🎬 ${previewFile.rewardTitle}` : '🎬 MEDIA'}
                                </div>

                                {/* Content: preview real o placeholder */}
                                {previewFile ? (
                                    <div className="w-full h-full overflow-hidden rounded-sm">
                                        {previewFile.fileType === 'video' ? (
                                            <video
                                                src={getFileUrl(previewFile)}
                                                className="w-full h-full"
                                                style={{ objectFit: 'contain' }}
                                                muted
                                                loop
                                                autoPlay
                                                playsInline
                                            />
                                        ) : previewFile.fileType === 'image' ? (
                                            <img
                                                src={getFileUrl(previewFile)}
                                                className="w-full h-full"
                                                style={{ objectFit: 'contain' }}
                                                alt="Preview"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-pink-900/50">
                                                <span className="text-4xl">🎵</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center" style={{ color: '#9333ea80' }}>
                                        <Video className="w-8 h-8" />
                                    </div>
                                )}

                                {/* Dimensions */}
                                <div className="absolute bottom-1 right-1 text-[9px] text-white/70 font-mono bg-black/50 px-1 rounded">
                                    {layout.media.width} x {layout.media.height}
                                </div>

                                {/* Resize handles */}
                                {selectedElement?.type === 'media' && renderResizeHandles('media', '#9333ea')}
                            </div>
                        )}

                        {/* ====== TEXT ELEMENT ====== */}
                        {layout?.text && (
                            <div
                                onMouseDown={(e) => handleMouseDown(e, 'text')}
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute cursor-move ${
                                    selectedElement?.type === 'text'
                                        ? 'ring-4 ring-white ring-offset-2 ring-offset-black z-50'
                                        : 'hover:ring-2 hover:ring-white/50 z-40'
                                }`}
                                style={{
                                    left: `${(layout.text.x / CANVAS_WIDTH) * 100}%`,
                                    top: `${(layout.text.y / CANVAS_HEIGHT) * 100}%`,
                                    width: `${(layout.text.width / CANVAS_WIDTH) * 100}%`,
                                    height: `${(layout.text.height / CANVAS_HEIGHT) * 100}%`,
                                    border: isPreviewMode ? '1px dashed rgba(34, 197, 94, 0.4)' : '2px solid #22c55e',
                                    backgroundColor: isPreviewMode ? 'transparent' : 'rgba(34, 197, 94, 0.1)',
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Label */}
                                {!isPreviewMode && (
                                    <div
                                        className="absolute -top-6 left-0 text-xs font-bold px-2 py-1 rounded-t text-white whitespace-nowrap"
                                        style={{ backgroundColor: '#22c55e' }}
                                    >
                                        📝 TEXTO
                                    </div>
                                )}

                                {/* Content: preview real o placeholder */}
                                {isPreviewMode ? (
                                    <div
                                        className="w-full h-full flex flex-col justify-center"
                                        style={{ textAlign: layout.text.align as 'left' | 'center' | 'right' }}
                                    >
                                        {textLines.filter(l => l.enabled).map((line, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    fontSize: `${Math.max(line.fontSize * 0.4, 8)}px`,
                                                    fontWeight: line.fontWeight,
                                                    color: styles.textColor,
                                                    textShadow: getTextShadowStyle(styles.textShadow),
                                                    fontFamily: styles.fontFamily,
                                                    lineHeight: 1.3,
                                                    margin: '2px 0',
                                                    WebkitTextStroke: textOutlineEnabled ? `${textOutlineWidth * 0.3}px ${textOutlineColor}` : undefined,
                                                    paintOrder: textOutlineEnabled ? 'stroke fill' : undefined,
                                                } as React.CSSProperties}
                                            >
                                                {line.text.replace('@redeemer', 'Usuario').replace('@reward', previewFile?.rewardTitle || 'Recompensa')}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center" style={{ color: '#22c55e80' }}>
                                        <Type className="w-6 h-6" />
                                    </div>
                                )}

                                {/* Dimensions */}
                                <div className="absolute bottom-1 right-1 text-[9px] text-white/70 font-mono bg-black/50 px-1 rounded">
                                    {layout.text.width} x {layout.text.height}
                                </div>

                                {/* Resize handles */}
                                {selectedElement?.type === 'text' && renderResizeHandles('text', '#22c55e')}
                            </div>
                        )}

                        {/* Canvas info */}
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white/70">
                            {CANVAS_WIDTH} x {CANVAS_HEIGHT}
                        </div>
                    </div>
                </div>
            </div>

            {/* Properties Panel */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e2e8f0] dark:border-[#374151]">
                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                        🎯 Propiedades
                    </h3>
                </div>
                {renderProperties()}
            </div>
        </div>
    );
}
