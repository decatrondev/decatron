import React from 'react';
import {
    LayoutIcon as Layout, Type, Video
} from 'lucide-react';
import type { Layout as LayoutType, DragElement } from '../../types';

interface LayoutTabProps {
    layout: LayoutType;
    setLayout: React.Dispatch<React.SetStateAction<LayoutType>>;
    canvasRef: React.RefObject<HTMLDivElement>;
    dragElement: DragElement;
    handleMouseDown: (element: DragElement, e: React.MouseEvent) => void;
    handleMouseMove: (e: React.MouseEvent) => void;
    handleMouseUp: () => void;
}

export function LayoutTab({
    layout,
    setLayout,
    canvasRef,
    dragElement,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
}: LayoutTabProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-lg overflow-hidden">
            {/* Header compacto */}
            <div className="px-4 py-3 border-b border-[#e2e8f0] dark:border-[#374151] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Layout className="w-4 h-4 text-[#2563eb]" />
                    Editor Visual
                </h3>
                <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    400 × 450
                </span>
            </div>

            {/* Canvas compacto */}
            <div className="p-4">
                <div
                    ref={canvasRef}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className="relative bg-black rounded-lg overflow-hidden cursor-crosshair mx-auto"
                    style={{
                        width: '100%',
                        maxWidth: '320px',
                        aspectRatio: '400 / 450',
                    }}
                >
                    {/* Grid overlay */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-10"
                        style={{
                            backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
                            backgroundSize: '10% 10%',
                        }}
                    />

                    {/* Media Element */}
                    {layout?.media && (
                        <div
                            onMouseDown={(e) => handleMouseDown('media', e)}
                            className={`absolute cursor-move transition-all ${
                                dragElement === 'media'
                                    ? 'ring-2 ring-white ring-offset-1 ring-offset-black z-50'
                                    : 'hover:ring-1 hover:ring-white/50 z-40'
                            }`}
                            style={{
                                left: `${(layout.media.x / 400) * 100}%`,
                                top: `${(layout.media.y / 450) * 100}%`,
                                width: `${(layout.media.width / 400) * 100}%`,
                                height: `${(layout.media.height / 450) * 100}%`,
                                border: '2px solid #9333ea',
                                backgroundColor: 'rgba(147, 51, 234, 0.2)',
                            }}
                        >
                            <div className="absolute -top-4 left-0 text-[9px] font-bold px-1.5 py-0.5 rounded text-white bg-purple-600 whitespace-nowrap">
                                🎬 MEDIA
                            </div>
                            <div className="w-full h-full flex items-center justify-center text-purple-400/60">
                                <Video className="w-6 h-6" />
                            </div>
                        </div>
                    )}

                    {/* Text Element */}
                    {layout?.text && (
                        <div
                            onMouseDown={(e) => handleMouseDown('text', e)}
                            className={`absolute cursor-move transition-all ${
                                dragElement === 'text'
                                    ? 'ring-2 ring-white ring-offset-1 ring-offset-black z-50'
                                    : 'hover:ring-1 hover:ring-white/50 z-40'
                            }`}
                            style={{
                                left: `${(layout.text.x / 400) * 100}%`,
                                top: `${(layout.text.y / 450) * 100}%`,
                                width: '50%',
                                height: '12%',
                                border: '2px solid #22c55e',
                                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                transform: layout.text.align === 'center'
                                    ? 'translate(-50%, -50%)'
                                    : layout.text.align === 'right'
                                        ? 'translate(-100%, -50%)'
                                        : 'translate(0, -50%)'
                            }}
                        >
                            <div className="absolute -top-4 left-0 text-[9px] font-bold px-1.5 py-0.5 rounded text-white bg-green-600 whitespace-nowrap">
                                📝 TEXTO
                            </div>
                            <div className="w-full h-full flex items-center justify-center text-green-400/60">
                                <Type className="w-4 h-4" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Controles compactos */}
            <div className="px-4 pb-4 space-y-3">
                {/* Media */}
                {layout?.media && (
                    <div className="flex items-center gap-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <span className="text-xs font-bold text-purple-700 dark:text-purple-300 w-16">🎬 Media</span>
                        <div className="flex items-center gap-2 flex-1">
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-500">X</span>
                                <input
                                    type="number"
                                    value={layout.media.x}
                                    onChange={(e) => setLayout({ ...layout, media: { ...layout.media, x: parseInt(e.target.value) || 0 } })}
                                    className="w-12 px-1 py-0.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-center"
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-500">Y</span>
                                <input
                                    type="number"
                                    value={layout.media.y}
                                    onChange={(e) => setLayout({ ...layout, media: { ...layout.media, y: parseInt(e.target.value) || 0 } })}
                                    className="w-12 px-1 py-0.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-center"
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-500">W</span>
                                <input
                                    type="number"
                                    value={layout.media.width}
                                    onChange={(e) => setLayout({ ...layout, media: { ...layout.media, width: parseInt(e.target.value) || 100 } })}
                                    className="w-12 px-1 py-0.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-center"
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-500">H</span>
                                <input
                                    type="number"
                                    value={layout.media.height}
                                    onChange={(e) => setLayout({ ...layout, media: { ...layout.media, height: parseInt(e.target.value) || 100 } })}
                                    className="w-12 px-1 py-0.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-center"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Text */}
                {layout?.text && (
                    <div className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <span className="text-xs font-bold text-green-700 dark:text-green-300 w-16">📝 Texto</span>
                        <div className="flex items-center gap-2 flex-1">
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-500">X</span>
                                <input
                                    type="number"
                                    value={layout.text.x}
                                    onChange={(e) => setLayout({ ...layout, text: { ...layout.text, x: parseInt(e.target.value) || 0 } })}
                                    className="w-12 px-1 py-0.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-center"
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-500">Y</span>
                                <input
                                    type="number"
                                    value={layout.text.y}
                                    onChange={(e) => setLayout({ ...layout, text: { ...layout.text, y: parseInt(e.target.value) || 0 } })}
                                    className="w-12 px-1 py-0.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-center"
                                />
                            </div>
                            <select
                                value={layout.text.align || 'center'}
                                onChange={(e) => setLayout({ ...layout, text: { ...layout.text, align: e.target.value } })}
                                className="px-2 py-0.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded"
                            >
                                <option value="left">Izq</option>
                                <option value="center">Centro</option>
                                <option value="right">Der</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
