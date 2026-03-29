import React from 'react';
import { Monitor, Copy, ExternalLink } from 'lucide-react';
import type { TextLine, StyleConfig, LayoutConfig } from '../types';

interface PreviewPanelProps {
    previewRef: React.RefObject<HTMLDivElement | null>;
    styles: StyleConfig;
    layout: LayoutConfig;
    textLines: TextLine[];
    duration: number;
    cooldown: number;
    showDebugTimer: boolean;
    textOutlineEnabled: boolean;
    textOutlineColor: string;
    textOutlineWidth: number;
    containerBorderEnabled: boolean;
    containerBorderColor: string;
    containerBorderWidth: number;
    overlayUrl: string;
    handleCopyUrl: () => void;
    handleOpenBrowser: () => void;
}

export function PreviewPanel({
    previewRef, styles, layout, textLines,
    duration, cooldown, showDebugTimer,
    textOutlineEnabled, textOutlineColor, textOutlineWidth,
    containerBorderEnabled, containerBorderColor, containerBorderWidth,
    overlayUrl, handleCopyUrl, handleOpenBrowser
}: PreviewPanelProps) {

    const hexToRgb = (hex: string): string => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '139, 92, 246';
    };

    const getPreviewBackground = () => {
        if (styles.backgroundType === 'transparent') {
            return 'transparent';
        } else if (styles.backgroundType === 'solid') {
            return `rgba(${hexToRgb(styles.solidColor)}, ${styles.backgroundOpacity / 100})`;
        } else {
            return `linear-gradient(${styles.gradientAngle}deg, ${styles.gradientColor1}, ${styles.gradientColor2})`;
        }
    };

    const getTextShadowStyle = (shadow: string): string => {
        switch (shadow) {
            case 'normal': return '2px 2px 4px rgba(0,0,0,0.5)';
            case 'strong': return '3px 3px 6px rgba(0,0,0,0.8)';
            case 'glow': return '0 0 10px rgba(255,255,255,0.8)';
            default: return 'none';
        }
    };

    return (
        <div className="xl:col-span-1 space-y-4 sm:space-y-6">
            {/* Preview - Sticky solo en pantallas grandes */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 sm:p-6 shadow-lg xl:sticky xl:top-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">Vista Previa en Vivo</h3>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <Monitor className="w-5 h-5 text-[#2563eb]" />
                    </div>
                </div>

                <div
                    ref={previewRef}
                    className={`relative w-full aspect-[10/3] rounded-lg overflow-hidden ${containerBorderEnabled ? '' : 'border-2 border-[#e2e8f0] dark:border-[#374151]'}`}
                    style={{
                        background: getPreviewBackground(),
                        opacity: styles.backgroundType !== 'transparent' ? styles.backgroundOpacity / 100 : 1,
                        backgroundImage: styles.backgroundType === 'transparent'
                            ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                            : undefined,
                        backgroundSize: styles.backgroundType === 'transparent' ? '20px 20px' : undefined,
                        backgroundPosition: styles.backgroundType === 'transparent' ? '0 0, 0 10px, 10px -10px, -10px 0px' : undefined,
                        border: containerBorderEnabled ? `${containerBorderWidth}px solid ${containerBorderColor}` : undefined
                    }}
                >
                    {/* Clip Video Preview */}
                    <div
                        className="absolute bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white"
                        style={{
                            left: `${(layout.clip.x / 1000) * 100}%`,
                            top: `${(layout.clip.y / 300) * 100}%`,
                            width: `${(layout.clip.width / 1000) * 100}%`,
                            height: `${(layout.clip.height / 300) * 100}%`,
                            borderRadius: '8px',
                            border: '2px solid rgba(255,255,255,0.2)'
                        }}
                    >
                        <div className="text-center opacity-50">
                            <div className="text-2xl mb-1">🎬</div>
                            <div className="text-[8px] font-bold">VIDEO CLIP</div>
                        </div>
                    </div>

                    {/* Profile Image Preview */}
                    <div
                        className="absolute bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white rounded-full"
                        style={{
                            left: `${(layout.profile.x / 1000) * 100}%`,
                            top: `${(layout.profile.y / 300) * 100}%`,
                            width: `${(layout.profile.size / 1000) * 100}%`,
                            height: `${(layout.profile.size / 300) * 100}%`,
                            border: '3px solid rgba(255,255,255,0.3)'
                        }}
                    >
                        <div className="text-2xl">👤</div>
                    </div>

                    {/* Text Lines Preview */}
                    <div
                        className="absolute"
                        style={{
                            left: `${(layout.text.x / 1000) * 100}%`,
                            top: `${(layout.text.y / 300) * 100}%`,
                            textAlign: (layout.text.align as 'left' | 'center' | 'right'),
                            transform: layout.text.align === 'center' ? 'translate(-50%, -50%)' : layout.text.align === 'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
                            maxWidth: '80%'
                        }}
                    >
                        <div className="space-y-1">
                            {textLines.filter(l => l.enabled).map((line, idx) => (
                                <p
                                    key={idx}
                                    style={{
                                        fontSize: `${line.fontSize * 0.35}px`,
                                        fontWeight: line.fontWeight,
                                        color: styles.textColor,
                                        textShadow: getTextShadowStyle(styles.textShadow),
                                        fontFamily: styles.fontFamily,
                                        margin: 0,
                                        lineHeight: 1.2,
                                        whiteSpace: 'nowrap',
                                        WebkitTextStroke: textOutlineEnabled ? `${textOutlineWidth}px ${textOutlineColor}` : undefined,
                                        paintOrder: textOutlineEnabled ? 'stroke fill' : undefined
                                    }}
                                >
                                    {line.text.replace('@username', 'Usuario').replace('@game', 'Just Chatting')}
                                </p>
                            ))}
                        </div>
                    </div>

                    {/* Debug Timer Preview (if enabled) */}
                    {showDebugTimer && (
                        <div
                            className="absolute top-[3%] right-[2%] px-2 py-1 rounded text-white font-bold text-[8px] font-mono"
                            style={{
                                backgroundColor: 'rgba(0,0,0,0.8)',
                                border: '1px solid rgba(255,255,255,0.3)'
                            }}
                        >
                            ⏱️ {duration}s
                        </div>
                    )}
                </div>

                <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-[#64748b] dark:text-[#94a3b8]">Duración:</span>
                        <span className="text-[#2563eb] font-bold">{duration}s</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-[#64748b] dark:text-[#94a3b8]">Cooldown:</span>
                        <span className="text-purple-600 font-bold">{cooldown}s</span>
                    </div>
                    <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8] text-center pt-2 border-t border-[#e2e8f0] dark:border-[#374151]">
                        ✨ Los cambios se reflejan en tiempo real
                    </p>
                </div>
            </div>

            {/* Overlay URL */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    URL del Overlay
                </h3>

                <div className="space-y-3">
                    <div className="p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                        <p className="text-xs font-mono text-[#64748b] dark:text-[#94a3b8] break-all">
                            {overlayUrl}
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleCopyUrl}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all"
                        >
                            <Copy className="w-4 h-4" />
                            Copiar
                        </button>
                        <button
                            onClick={handleOpenBrowser}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Abrir
                        </button>
                    </div>
                </div>
            </div>

            {/* Tips */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-3">
                    💡 Tips
                </h3>
                <ul className="text-[#64748b] dark:text-[#94a3b8] text-xs space-y-2">
                    <li className="flex items-start gap-2">
                        <span className="text-[#2563eb] mt-0.5">•</span>
                        <span>Agrega esta URL como Browser Source en OBS</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-[#2563eb] mt-0.5">•</span>
                        <span>Dimensiones recomendadas: 1000x300</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 mt-0.5">⚡</span>
                        <span className="font-semibold text-green-700 dark:text-green-400">Después de guardar, actualiza el overlay en OBS para ver los cambios</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-[#2563eb] mt-0.5">•</span>
                        <span>Usa degradados para mejores efectos visuales</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-[#2563eb] mt-0.5">•</span>
                        <span>Las sombras mejoran la legibilidad del texto</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 mt-0.5">🎨</span>
                        <span>La Vista Previa muestra cambios en tiempo real mientras editas</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
