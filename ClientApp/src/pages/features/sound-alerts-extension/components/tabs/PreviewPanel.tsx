import React from 'react';
import {
    Monitor, Copy, ExternalLink
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Styles, Layout, TextLine } from '../../types';

interface PreviewPanelProps {
    previewRef: React.RefObject<HTMLDivElement>;
    styles: Styles;
    layout: Layout;
    textLines: TextLine[];
    textOutlineEnabled: boolean;
    textOutlineColor: string;
    textOutlineWidth: number;
    getPreviewBackground: () => string;
    getTextShadowStyle: (shadow: string) => string;
    overlayUrl: string;
    handleCopyUrl: () => Promise<void>;
    handleOpenBrowser: () => void;
}

export function PreviewPanel({
    previewRef,
    styles,
    layout,
    textLines,
    textOutlineEnabled,
    textOutlineColor,
    textOutlineWidth,
    getPreviewBackground,
    getTextShadowStyle,
    overlayUrl,
    handleCopyUrl,
    handleOpenBrowser,
}: PreviewPanelProps) {
    const { t } = useTranslation('features');
    return (
        <div className="space-y-6">
            {/* Preview */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg sticky top-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">
                        {t('soundAlertsTabs.preview')}
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <Monitor className="w-5 h-5 text-[#2563eb]" />
                    </div>
                </div>

                <div
                    ref={previewRef}
                    className="relative w-full rounded-lg overflow-hidden border-2 border-[#e2e8f0] dark:border-[#374151]"
                    style={{
                        aspectRatio: '1920 / 1080',
                        background: getPreviewBackground(),
                        opacity: styles.backgroundType !== 'transparent' ? (styles.backgroundOpacity || 100) / 100 : 1,
                        backgroundImage: styles.backgroundType === 'transparent'
                            ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                            : undefined,
                        backgroundSize: styles.backgroundType === 'transparent' ? '20px 20px' : undefined,
                        backgroundPosition: styles.backgroundType === 'transparent' ? '0 0, 0 10px, 10px -10px, -10px 0px' : undefined
                    }}
                >
                    {/* Media Preview */}
                    {layout?.media && (
                        <div
                            className="absolute bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white rounded-lg"
                            style={{
                                left: `${(layout.media.x / 1920) * 100}%`,
                                top: `${(layout.media.y / 1080) * 100}%`,
                                width: `${(layout.media.width / 1920) * 100}%`,
                                height: `${(layout.media.height / 1080) * 100}%`,
                                border: '2px solid rgba(255,255,255,0.2)'
                            }}
                        >
                            <div className="text-center opacity-50">
                                <div className="text-2xl mb-1">🎬</div>
                                <div className="text-[8px] font-bold">MEDIA</div>
                            </div>
                        </div>
                    )}

                    {/* Text Preview */}
                    {layout?.text && (
                        <div
                            className="absolute flex flex-col justify-center overflow-hidden"
                            style={{
                                left: `${(layout.text.x / 1920) * 100}%`,
                                top: `${(layout.text.y / 1080) * 100}%`,
                                width: `${((layout.text.width || 600) / 1920) * 100}%`,
                                height: `${((layout.text.height || 200) / 1080) * 100}%`,
                                textAlign: (layout.text.align as 'left' | 'center' | 'right'),
                            }}
                        >
                        <div className="space-y-1">
                            {textLines && textLines.filter(l => l && l.enabled && l.text).map((line, idx) => (
                                <p
                                    key={idx}
                                    style={{
                                        fontSize: `${line.fontSize * 0.25}px`,
                                        fontWeight: line.fontWeight,
                                        color: styles.textColor,
                                        textShadow: getTextShadowStyle(styles.textShadow),
                                        fontFamily: styles.fontFamily,
                                        margin: 0,
                                        lineHeight: 1.2,
                                        WebkitTextStroke: textOutlineEnabled ? `${textOutlineWidth * 0.25}px ${textOutlineColor}` : undefined,
                                        paintOrder: textOutlineEnabled ? 'stroke fill' : undefined
                                    }}
                                >
                                    {line.text.replace('@redeemer', 'Usuario').replace('@reward', 'Recompensa')}
                                </p>
                            ))}
                        </div>
                    </div>
                    )}
                </div>

                <div className="mt-3 space-y-2">
                    <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8] text-center">
                        {t('soundAlertsTabs.changesRealtime')}
                    </p>
                </div>
            </div>

            {/* Overlay URL */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    {t('soundAlertsTabs.overlayUrl')}
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
                            {t('soundAlertsTabs.copy')}
                        </button>
                        <button
                            onClick={handleOpenBrowser}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all"
                        >
                            <ExternalLink className="w-4 h-4" />
                            {t('soundAlertsTabs.open')}
                        </button>
                    </div>
                </div>
            </div>

            {/* OBS Setup */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border border-amber-200 dark:border-amber-700/50 p-6 shadow-lg">
                <h3 className="text-lg font-black text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                    Configurar en OBS
                </h3>
                <ol className="text-amber-900 dark:text-amber-200 text-xs space-y-2 list-decimal list-inside">
                    <li>Agregar fuente <span className="font-bold">Navegador (Browser Source)</span></li>
                    <li>Pegar la URL del overlay</li>
                    <li>Configurar <span className="font-bold">Ancho: 1920</span> y <span className="font-bold">Alto: 1080</span></li>
                    <li>Hacer clic en el overlay una vez para desbloquear el audio</li>
                </ol>
                <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                        El Browser Source DEBE ser 1920x1080 para que las alertas se vean correctamente.
                    </p>
                </div>
            </div>

            {/* Tips */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-3">
                    {t('soundAlertsTabs.tips')}
                </h3>
                <ul className="text-[#64748b] dark:text-[#94a3b8] text-xs space-y-2">
                    <li className="flex items-start gap-2">
                        <span className="text-[#2563eb] mt-0.5">•</span>
                        <span>{t('soundAlertsTabs.tipObs')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-[#2563eb] mt-0.5">•</span>
                        <span>{t('soundAlertsTabs.tipDimensions')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                        <span className="font-semibold text-green-700 dark:text-green-400">{t('soundAlertsTabs.tipAutoActivate')}</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
