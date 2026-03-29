/**
 * Event Alerts Extension - Main Configuration Component
 *
 * Sistema modular para configurar alertas de eventos de Twitch (follows, bits, subs, raids, etc.)
 * Diseño idéntico al Timer Extensible
 */

import React, { useState, useEffect, useRef } from 'react';
import { Save, ArrowLeft, Check, Copy, Play, X, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useEventAlertsConfig } from './event-alerts-extension/hooks/useEventAlertsConfig';
import { useEventAlertsPersistence } from './event-alerts-extension/hooks/useEventAlertsPersistence';
import {
    GlobalTab,
    FollowTab,
    BitsTab,
    SubsTab,
    GiftSubsTab,
    RaidsTab,
    ResubsTab,
    HypeTrainTab,
    MediaTab,
    OverlayTab,
    OverlayEditorTab,
    TestingTab,
    StyleTab,
} from './event-alerts-extension/components/tabs';
import type {
    TabType,
    FollowAlertConfig,
    BitsAlertConfig,
    SubsAlertConfig,
    GiftSubsAlertConfig,
    RaidsAlertConfig,
    ResubsAlertConfig,
    HypeTrainAlertConfig,
    BaseAlertConfig,
} from './event-alerts-extension/types/index';

// ============================================================================
// HELPER: Extract media URLs from config
// ============================================================================
function extractMediaUrls(media: any): { videoUrl: string; audioUrl: string; imageUrl: string } {
    if (!media || !media.enabled) {
        return { videoUrl: '', audioUrl: '', imageUrl: '' };
    }

    // Simple mode
    if (media.mode === 'simple' && media.simple?.url) {
        const url = media.simple.url;
        const ext = url.split('.').pop()?.toLowerCase() || '';
        if (['mp4', 'webm', 'mov'].includes(ext)) {
            return { videoUrl: url, audioUrl: '', imageUrl: '' };
        }
        if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
            return { videoUrl: '', audioUrl: url, imageUrl: '' };
        }
        return { videoUrl: '', audioUrl: '', imageUrl: url };
    }

    // Advanced mode
    if (media.mode === 'advanced' && media.advanced) {
        return {
            videoUrl: media.advanced.video?.url || '',
            audioUrl: media.advanced.audio?.url || '',
            imageUrl: media.advanced.image?.url || '',
        };
    }

    // Legacy: direct url property
    if (media.url) {
        const url = media.url;
        const ext = url.split('.').pop()?.toLowerCase() || '';
        if (['mp4', 'webm', 'mov'].includes(ext)) {
            return { videoUrl: url, audioUrl: '', imageUrl: '' };
        }
        if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
            return { videoUrl: '', audioUrl: url, imageUrl: '' };
        }
        return { videoUrl: '', audioUrl: '', imageUrl: url };
    }

    return { videoUrl: '', audioUrl: '', imageUrl: '' };
}

// ============================================================================
// FULLSCREEN PREVIEW MODAL
// ============================================================================
interface FullscreenPreviewProps {
    alert: BaseAlertConfig;
    globalConfig: any;
    emoji: string;
    sampleMessage: string;
    onClose: () => void;
}

function FullscreenPreviewModal({ alert, globalConfig, emoji, sampleMessage, onClose }: FullscreenPreviewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const { videoUrl, audioUrl, imageUrl } = extractMediaUrls(alert.media);
    const hasVideo = !!videoUrl;
    const hasAudio = !!audioUrl;
    const hasImage = !!imageUrl;
    const volume = alert.volume ?? 100;

    // Merge de estilos: global + alert-specific (filtrar undefined)
    const alertStyle = alert.style || {};
    const style = {
        ...globalConfig.defaultStyle,
        // Solo aplicar propiedades de alertStyle que no sean undefined
        ...Object.fromEntries(
            Object.entries(alertStyle).filter(([_, v]) => v !== undefined)
        ),
    };

    console.log('🎨 [FullscreenPreviewModal] Style debug:', {
        globalTextColor: globalConfig.defaultStyle?.textColor,
        alertTextColor: alertStyle?.textColor,
        mergedTextColor: style.textColor,
    });

    const card = globalConfig.overlayElements.card;
    const mediaEl = globalConfig.overlayElements.media;
    const textEl = globalConfig.overlayElements.text;

    // Scale for preview (fit in viewport)
    const canvasWidth = globalConfig.canvas.width;
    const canvasHeight = globalConfig.canvas.height;
    const maxWidth = Math.min(window.innerWidth * 0.9, 800);
    const scale = maxWidth / canvasWidth;
    const previewWidth = canvasWidth * scale;
    const previewHeight = canvasHeight * scale;

    const getBackgroundStyle = () => {
        if (style.backgroundType === 'transparent') return 'transparent';
        if (style.backgroundType === 'gradient' && style.backgroundGradient) {
            return `linear-gradient(${style.backgroundGradient.angle}deg, ${style.backgroundGradient.color1}, ${style.backgroundGradient.color2})`;
        }
        return style.backgroundColor || 'rgba(0,0,0,0.8)';
    };

    const getTextShadow = () => {
        switch (style.textShadow) {
            case 'normal': return '2px 2px 4px rgba(0,0,0,0.5)';
            case 'strong': return '3px 3px 6px rgba(0,0,0,0.8)';
            case 'glow': return '0 0 10px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.3)';
            default: return 'none';
        }
    };

    const handlePlay = () => {
        setIsPlaying(true);
        if (videoRef.current) {
            videoRef.current.volume = volume / 100;
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(console.error);
        }
        if (audioRef.current) {
            audioRef.current.volume = volume / 100;
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(console.error);
        }
    };

    const handleStop = () => {
        setIsPlaying(false);
        if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    };

    useEffect(() => {
        return () => handleStop();
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="relative">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                >
                    <X className="w-6 h-6 text-white" />
                </button>

                {/* Canvas Container - Exact overlay simulation */}
                <div
                    className="relative bg-black rounded-lg overflow-hidden"
                    style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
                >
                    {/* CARD - Background container */}
                    {card.enabled && (
                        <div
                            className="absolute"
                            style={{
                                left: `${card.x * scale}px`,
                                top: `${card.y * scale}px`,
                                width: `${card.width * scale}px`,
                                height: `${card.height * scale}px`,
                                background: getBackgroundStyle(),
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                border: style.borderEnabled ? `${Math.max(1, style.borderWidth * scale)}px solid ${style.borderColor}` : 'none',
                                borderRadius: `${style.borderRadius * scale}px`,
                                opacity: style.opacity / 100,
                            }}
                        />
                    )}

                    {/* MEDIA - Video/Image */}
                    {mediaEl.enabled && (
                        <div
                            className="absolute overflow-hidden"
                            style={{
                                left: `${mediaEl.x * scale}px`,
                                top: `${mediaEl.y * scale}px`,
                                width: `${mediaEl.width * scale}px`,
                                height: `${mediaEl.height * scale}px`,
                                borderRadius: `${4 * scale}px`,
                            }}
                        >
                            {hasVideo && (
                                <video
                                    ref={videoRef}
                                    src={videoUrl}
                                    className="w-full h-full"
                                    style={{ objectFit: style.mediaObjectFit || 'contain' }}
                                    loop
                                    playsInline
                                />
                            )}
                            {!hasVideo && hasImage && (
                                <img
                                    src={imageUrl}
                                    alt="Alert media"
                                    className="w-full h-full"
                                    style={{ objectFit: style.mediaObjectFit || 'contain' }}
                                />
                            )}
                            {!hasVideo && !hasImage && (
                                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                                    <span style={{ fontSize: `${Math.max(20, 40 * scale)}px` }}>🖼️</span>
                                </div>
                            )}

                            {/* Play overlay */}
                            {!isPlaying && (hasVideo || hasAudio) && (
                                <button
                                    onClick={handlePlay}
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors"
                                >
                                    <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                                        <Play className="w-8 h-8 text-white ml-1" />
                                    </div>
                                </button>
                            )}

                            {isPlaying && (
                                <button
                                    onClick={handleStop}
                                    className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full transition-colors shadow-lg"
                                >
                                    <X className="w-4 h-4 text-white" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* TEXT - Message */}
                    {textEl.enabled && (
                        <div
                            className="absolute flex flex-col justify-center"
                            style={{
                                left: `${textEl.x * scale}px`,
                                top: `${textEl.y * scale}px`,
                                width: `${textEl.width * scale}px`,
                                height: `${textEl.height * scale}px`,
                                textAlign: style.textAlign || 'center',
                                alignItems: style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'flex-end' : 'flex-start',
                                padding: `${4 * scale}px`,
                            }}
                        >
                            <div style={{ fontSize: `${Math.max(16, 32 * scale)}px`, marginBottom: `${6 * scale}px` }}>{emoji}</div>
                            <div
                                style={{
                                    fontFamily: style.fontFamily || 'Inter, sans-serif',
                                    fontSize: `${Math.max(12, style.fontSize * scale)}px`,
                                    fontWeight: style.fontWeight || 700,
                                    color: style.textColor || '#ffffff',
                                    textShadow: getTextShadow(),
                                    textAlign: style.textAlign || 'center',
                                    lineHeight: 1.3,
                                }}
                            >
                                {sampleMessage}
                            </div>
                        </div>
                    )}

                    {/* Hidden audio element */}
                    {hasAudio && <audio ref={audioRef} src={audioUrl} />}
                </div>

                {/* Info footer */}
                <div className="mt-4 flex items-center justify-center gap-4 text-sm text-white/70">
                    <span className="flex items-center gap-1">
                        <Volume2 className="w-4 h-4" />
                        {volume}%
                    </span>
                    <span>•</span>
                    <span>{alert.duration}s</span>
                    <span>•</span>
                    <span>{canvasWidth}×{canvasHeight}</span>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// ALERT PREVIEW COMPONENT
// ============================================================================

function getPreviewAlert(
    activeTab: TabType,
    followConfig: FollowAlertConfig,
    bitsConfig: BitsAlertConfig,
    subsConfig: SubsAlertConfig,
    giftSubsConfig: GiftSubsAlertConfig,
    raidsConfig: RaidsAlertConfig,
    resubsConfig: ResubsAlertConfig,
    hypeTrainConfig: HypeTrainAlertConfig,
): { alert: BaseAlertConfig | null; emoji: string; sampleMessage: string } {
    const sample = (msg: string, vars: Record<string, string>) =>
        Object.entries(vars).reduce((m, [k, v]) => m.replace(`{${k}}`, v), msg);

    switch (activeTab) {
        case 'follow':
            return {
                alert: followConfig.alert,
                emoji: '❤️',
                sampleMessage: sample(followConfig.alert.message, { username: 'StreamFan99' }),
            };
        case 'bits':
            return {
                alert: bitsConfig.baseAlert,
                emoji: '💎',
                sampleMessage: sample(bitsConfig.baseAlert.message, { username: 'StreamFan99', amount: '250' }),
            };
        case 'subs':
            return {
                alert: subsConfig.subTypes.tier1,
                emoji: '⭐',
                sampleMessage: sample(subsConfig.subTypes.tier1.message, { username: 'StreamFan99', tier: 'Tier 1' }),
            };
        case 'giftSubs':
            return {
                alert: giftSubsConfig.baseAlert,
                emoji: '🎁',
                sampleMessage: sample(giftSubsConfig.baseAlert.message, { username: 'StreamFan99', amount: '5' }),
            };
        case 'raids':
            return {
                alert: raidsConfig.baseAlert,
                emoji: '🚀',
                sampleMessage: sample(raidsConfig.baseAlert.message, { username: 'StreamFan99', viewers: '50' }),
            };
        case 'resubs':
            return {
                alert: resubsConfig.baseAlert,
                emoji: '🎉',
                sampleMessage: sample(resubsConfig.baseAlert.message, { username: 'StreamFan99', months: '6' }),
            };
        case 'hypeTrain':
            return {
                alert: hypeTrainConfig.levels[1],
                emoji: '🔥',
                sampleMessage: sample(hypeTrainConfig.levels[1].message ?? '¡Hype Train nivel {level}!', { level: '1' }),
            };
        default:
            return { alert: null, emoji: '🎉', sampleMessage: '' };
    }
}

interface AlertPreviewProps {
    activeTab: TabType;
    globalConfig: GlobalAlertsConfig;
    followConfig: FollowAlertConfig;
    bitsConfig: BitsAlertConfig;
    subsConfig: SubsAlertConfig;
    giftSubsConfig: GiftSubsAlertConfig;
    raidsConfig: RaidsAlertConfig;
    resubsConfig: ResubsAlertConfig;
    hypeTrainConfig: HypeTrainAlertConfig;
    overlayUrl: string;
}

function AlertPreview({
    activeTab,
    globalConfig,
    followConfig, bitsConfig, subsConfig, giftSubsConfig,
    raidsConfig, resubsConfig, hypeTrainConfig,
    overlayUrl,
}: AlertPreviewProps) {
    const [copied, setCopied] = React.useState(false);
    const [showFullPreview, setShowFullPreview] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(overlayUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const { alert, emoji, sampleMessage } = getPreviewAlert(
        activeTab, followConfig, bitsConfig, subsConfig,
        giftSubsConfig, raidsConfig, resubsConfig, hypeTrainConfig,
    );

    // Extract media URLs properly
    const { videoUrl, audioUrl, imageUrl } = alert ? extractMediaUrls(alert.media) : { videoUrl: '', audioUrl: '', imageUrl: '' };
    const hasMedia = !!(videoUrl || audioUrl || imageUrl);

    // Para tabs de configuración general, mostrar preview del estilo global
    const showGlobalStylePreview = ['global', 'style', 'overlay'].includes(activeTab);
    const noEventPreview = ['media', 'testing'].includes(activeTab);

    // Helper para generar background CSS
    const getBackgroundStyle = () => {
        const style = globalConfig.defaultStyle;
        if (style.backgroundType === 'transparent') {
            return 'transparent';
        } else if (style.backgroundType === 'gradient') {
            return `linear-gradient(${style.backgroundGradient.angle}deg, ${style.backgroundGradient.color1}, ${style.backgroundGradient.color2})`;
        } else if (style.backgroundType === 'image' && style.backgroundImage) {
            return `url('${style.backgroundImage}')`;
        } else {
            return style.backgroundColor;
        }
    };

    // Helper para text shadow
    const getTextShadow = () => {
        const type = globalConfig.defaultStyle.textShadow;
        switch (type) {
            case 'normal': return '2px 2px 4px rgba(0,0,0,0.5)';
            case 'strong': return '3px 3px 6px rgba(0,0,0,0.8)';
            case 'glow': return '0 0 10px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.3)';
            case 'none':
            default: return 'none';
        }
    };

    // Calcular escala para mantener aspect ratio
    const containerMaxWidth = 400; // ancho máximo del preview container
    const aspectRatio = globalConfig.canvas.width / globalConfig.canvas.height;
    const previewWidth = containerMaxWidth;
    const previewHeight = previewWidth / aspectRatio;
    const previewScale = previewWidth / globalConfig.canvas.width;

    if (noEventPreview) {
        return (
            <div className="space-y-3">
                <div
                    className="bg-black rounded-lg border border-[#374151] flex items-center justify-center mx-auto"
                    style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
                >
                    <p className="text-[#64748b] dark:text-[#94a3b8] text-sm text-center px-4">
                        Selecciona un tab de evento para ver el preview
                    </p>
                </div>
                {overlayUrl && (
                    <div className="p-3 bg-white dark:bg-[#1B1C1D] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">🔗 Link OBS</div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={overlayUrl}
                                readOnly
                                className="flex-1 px-2 py-1 text-xs border border-[#e2e8f0] dark:border-[#374151] rounded bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] font-mono"
                            />
                            <button
                                onClick={handleCopy}
                                className="px-2 py-1 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white rounded text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                            >
                                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copied ? '✓' : 'Copiar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (showGlobalStylePreview) {
        const style = globalConfig.defaultStyle;
        const card = globalConfig.overlayElements.card;
        const media = globalConfig.overlayElements.media;
        const text = globalConfig.overlayElements.text;

        return (
            <div className="space-y-3">
                {/* Canvas preview - ELEMENTOS INDEPENDIENTES */}
                <div
                    className="bg-black rounded-lg border border-[#374151] relative overflow-hidden mx-auto"
                    style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
                >
                    {/* CARD - Contenedor */}
                    {card.enabled && (
                        <div
                            className="absolute transition-all"
                            style={{
                                left: `${card.x * previewScale}px`,
                                top: `${card.y * previewScale}px`,
                                width: `${card.width * previewScale}px`,
                                height: `${card.height * previewScale}px`,
                                background: getBackgroundStyle(),
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                border: style.borderEnabled ? `${Math.max(1, style.borderWidth * previewScale)}px solid ${style.borderColor}` : 'none',
                                borderRadius: `${style.borderRadius * previewScale}px`,
                                opacity: style.opacity / 100,
                            }}
                        />
                    )}

                    {/* MEDIA - Imagen/Video */}
                    {media.enabled && (
                        <div
                            className="absolute bg-gradient-to-br from-purple-600 to-pink-600 rounded flex items-center justify-center transition-all"
                            style={{
                                left: `${media.x * previewScale}px`,
                                top: `${media.y * previewScale}px`,
                                width: `${media.width * previewScale}px`,
                                height: `${media.height * previewScale}px`,
                                borderRadius: `${4 * previewScale}px`,
                            }}
                        >
                            <div className="text-center">
                                <div style={{ fontSize: `${Math.max(12, 24 * previewScale)}px` }}>🖼️</div>
                                <div style={{ fontSize: `${Math.max(6, 10 * previewScale)}px` }} className="font-bold text-white">MEDIA</div>
                            </div>
                        </div>
                    )}

                    {/* TEXT - Mensaje */}
                    {text.enabled && (
                        <div
                            className="absolute flex flex-col justify-center transition-all"
                            style={{
                                left: `${text.x * previewScale}px`,
                                top: `${text.y * previewScale}px`,
                                width: `${text.width * previewScale}px`,
                                height: `${text.height * previewScale}px`,
                                textAlign: style.textAlign,
                                alignItems: style.textAlign === 'center' ? 'center' :
                                          style.textAlign === 'right' ? 'flex-end' : 'flex-start',
                                padding: `${2 * previewScale}px`,
                            }}
                        >
                            <div style={{ fontSize: `${Math.max(10, 28 * previewScale)}px`, marginBottom: `${4 * previewScale}px` }}>🎉</div>
                            <div
                                style={{
                                    fontFamily: style.fontFamily,
                                    fontSize: `${Math.max(8, style.fontSize * previewScale)}px`,
                                    fontWeight: style.fontWeight,
                                    color: style.textColor,
                                    textShadow: getTextShadow(),
                                    textAlign: style.textAlign,
                                    lineHeight: 1.3,
                                }}
                            >
                                ¡Gracias por el Follow!
                            </div>
                        </div>
                    )}

                    {/* Label de tamaño */}
                    <div className="absolute top-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] text-white font-bold">
                        {globalConfig.canvas.width}×{globalConfig.canvas.height}
                    </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-lg p-2 text-center">
                        <div className="text-[#64748b] dark:text-[#94a3b8]">CARD</div>
                        <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {card.width}×{card.height}
                        </div>
                    </div>
                    <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-lg p-2 text-center">
                        <div className="text-[#64748b] dark:text-[#94a3b8]">MEDIA</div>
                        <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {media.width}×{media.height}
                        </div>
                    </div>
                    <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-lg p-2 text-center">
                        <div className="text-[#64748b] dark:text-[#94a3b8]">TEXT</div>
                        <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {text.width}×{text.height}
                        </div>
                    </div>
                </div>

                {overlayUrl && (
                    <div className="p-3 bg-white dark:bg-[#1B1C1D] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">🔗 Link OBS</div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={overlayUrl}
                                readOnly
                                className="flex-1 px-2 py-1 text-xs border border-[#e2e8f0] dark:border-[#374151] rounded bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] font-mono"
                            />
                            <button
                                onClick={handleCopy}
                                className="px-2 py-1 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white rounded text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                            >
                                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copied ? '✓' : 'Copiar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Preview de evento específico
    if (!alert) {
        return (
            <div className="space-y-3">
                <div className="aspect-video bg-[#f8fafc] dark:bg-[#262626] rounded-lg border border-[#e2e8f0] dark:border-[#374151] flex items-center justify-center">
                    <p className="text-[#64748b] dark:text-[#94a3b8] text-sm text-center px-4">
                        No hay configuración de alerta disponible
                    </p>
                </div>
            </div>
        );
    }

    const animLabel = alert.animation?.type ?? 'fade';
    const hasTts = alert.tts?.enabled;
    const hasEffects = alert.effects?.enabled && (alert.effects?.effects?.length ?? 0) > 0;

    // Merge de estilo: global + específico del evento (filtrar undefined)
    const alertStyle = alert.style || {};
    const mergedStyle = {
        ...globalConfig.defaultStyle,
        ...Object.fromEntries(
            Object.entries(alertStyle).filter(([_, v]) => v !== undefined)
        ),
    };

    const card = globalConfig.overlayElements.card;
    const mediaEl = globalConfig.overlayElements.media;
    const textEl = globalConfig.overlayElements.text;

    const getBgStyle = () => {
        if (mergedStyle.backgroundType === 'transparent') return 'transparent';
        if (mergedStyle.backgroundType === 'gradient')
            return `linear-gradient(${mergedStyle.backgroundGradient.angle}deg, ${mergedStyle.backgroundGradient.color1}, ${mergedStyle.backgroundGradient.color2})`;
        if (mergedStyle.backgroundType === 'image' && mergedStyle.backgroundImage)
            return `url('${mergedStyle.backgroundImage}')`;
        return mergedStyle.backgroundColor;
    };

    return (
        <div className="space-y-3">
            {/* Canvas preview - ELEMENTOS INDEPENDIENTES */}
            <div
                className="bg-black rounded-lg border border-[#374151] relative overflow-hidden mx-auto"
                style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
            >
                {/* CARD - Contenedor con estilo */}
                {card.enabled && (
                    <div
                        className="absolute transition-all"
                        style={{
                            left: `${card.x * previewScale}px`,
                            top: `${card.y * previewScale}px`,
                            width: `${card.width * previewScale}px`,
                            height: `${card.height * previewScale}px`,
                            background: getBgStyle(),
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: mergedStyle.borderEnabled ? `${Math.max(1, mergedStyle.borderWidth * previewScale)}px solid ${mergedStyle.borderColor}` : 'none',
                            borderRadius: `${mergedStyle.borderRadius * previewScale}px`,
                            opacity: mergedStyle.opacity / 100,
                        }}
                    />
                )}

                {/* MEDIA - Imagen/Video REAL */}
                {mediaEl.enabled && (
                    <div
                        className="absolute rounded overflow-hidden transition-all"
                        style={{
                            left: `${mediaEl.x * previewScale}px`,
                            top: `${mediaEl.y * previewScale}px`,
                            width: `${mediaEl.width * previewScale}px`,
                            height: `${mediaEl.height * previewScale}px`,
                            borderRadius: `${4 * previewScale}px`,
                        }}
                    >
                        {videoUrl ? (
                            <video
                                src={videoUrl}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-full h-full"
                                style={{ objectFit: mergedStyle.mediaObjectFit || 'contain' }}
                            />
                        ) : imageUrl ? (
                            <img
                                src={imageUrl}
                                alt="Media"
                                className="w-full h-full"
                                style={{ objectFit: mergedStyle.mediaObjectFit || 'contain' }}
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                                <div className="text-center">
                                    <div style={{ fontSize: `${Math.max(12, 24 * previewScale)}px` }}>🖼️</div>
                                    <div style={{ fontSize: `${Math.max(6, 10 * previewScale)}px` }} className="font-bold text-white">MEDIA</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TEXT - Mensaje */}
                {textEl.enabled && (
                    <div
                        className="absolute flex flex-col justify-center transition-all"
                        style={{
                            left: `${textEl.x * previewScale}px`,
                            top: `${textEl.y * previewScale}px`,
                            width: `${textEl.width * previewScale}px`,
                            height: `${textEl.height * previewScale}px`,
                            textAlign: mergedStyle.textAlign,
                            alignItems: mergedStyle.textAlign === 'center' ? 'center' :
                                      mergedStyle.textAlign === 'right' ? 'flex-end' : 'flex-start',
                            padding: `${2 * previewScale}px`,
                        }}
                    >
                        <div style={{ fontSize: `${Math.max(10, 28 * previewScale)}px`, marginBottom: `${4 * previewScale}px` }}>{emoji}</div>
                        <div
                            style={{
                                fontFamily: mergedStyle.fontFamily,
                                fontSize: `${Math.max(8, mergedStyle.fontSize * previewScale)}px`,
                                fontWeight: mergedStyle.fontWeight,
                                color: mergedStyle.textColor,
                                textShadow: mergedStyle.textShadow === 'normal' ? '1px 1px 2px rgba(0,0,0,0.5)' :
                                           mergedStyle.textShadow === 'strong' ? '2px 2px 4px rgba(0,0,0,0.8)' :
                                           mergedStyle.textShadow === 'glow' ? '0 0 6px rgba(255,255,255,0.5)' : 'none',
                                textAlign: mergedStyle.textAlign,
                                lineHeight: 1.3,
                            }}
                        >
                            {sampleMessage || '¡Gracias StreamFan99!'}
                        </div>
                        <div style={{ fontSize: `${Math.max(6, 10 * previewScale)}px`, marginTop: `${4 * previewScale}px`, opacity: 0.7, color: mergedStyle.textColor }}>
                            {alert.duration}s · {animLabel}
                            {hasTts ? ' · TTS' : ''}
                        </div>
                    </div>
                )}

                {/* Label de canvas */}
                <div className="absolute top-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] text-white font-bold">
                    {globalConfig.canvas.width}×{globalConfig.canvas.height}
                </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-lg p-2 text-center">
                    <div className="text-[#64748b] dark:text-[#94a3b8]">Duración</div>
                    <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{alert.duration}s</div>
                </div>
                <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-lg p-2 text-center">
                    <div className="text-[#64748b] dark:text-[#94a3b8]">Animación</div>
                    <div className="font-bold text-[#1e293b] dark:text-[#f8fafc] capitalize">{animLabel}</div>
                </div>
                <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-lg p-2 text-center">
                    <div className="text-[#64748b] dark:text-[#94a3b8]">Volumen</div>
                    <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{alert.volume}%</div>
                </div>
            </div>

            {/* Enabled state */}
            <div className={`rounded-lg p-2 text-xs text-center font-bold ${
                alert.enabled
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            }`}>
                {alert.enabled ? '✅ Alerta activa' : '❌ Alerta desactivada'}
            </div>

            {/* Play Preview Button */}
            {hasMedia && (
                <button
                    onClick={() => setShowFullPreview(true)}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
                >
                    <Play className="w-5 h-5" />
                    Play Preview con Sonido
                </button>
            )}

            {overlayUrl && (
                <div className="p-3 bg-white dark:bg-[#1B1C1D] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">🔗 Link OBS</div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={overlayUrl}
                            readOnly
                            className="flex-1 px-2 py-1 text-xs border border-[#e2e8f0] dark:border-[#374151] rounded bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] font-mono"
                        />
                        <button
                            onClick={handleCopy}
                            className="px-2 py-1 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white rounded text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                        >
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? '✓' : 'Copiar'}
                        </button>
                    </div>
                </div>
            )}

            {/* Fullscreen Preview Modal */}
            {showFullPreview && alert && (
                <FullscreenPreviewModal
                    alert={alert}
                    globalConfig={globalConfig}
                    emoji={emoji}
                    sampleMessage={sampleMessage}
                    onClose={() => setShowFullPreview(false)}
                />
            )}
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Tabs que son eventos (para sincronizar con el editor)
const EVENT_TABS_SET = new Set(['follow', 'bits', 'subs', 'giftSubs', 'raids', 'resubs', 'hypeTrain']);

const EventAlertsConfig = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('global');
    const [lastEventTab, setLastEventTab] = useState<string>('follow'); // Último evento seleccionado
    const [channelName, setChannelName] = useState('');
    const [overlayUrl, setOverlayUrl] = useState('');

    // Actualizar lastEventTab cuando se selecciona un tab de evento
    const handleTabChange = (tabId: TabType) => {
        setActiveTab(tabId);
        if (EVENT_TABS_SET.has(tabId)) {
            setLastEventTab(tabId);
        }
    };

    // Hook principal de configuración
    const {
        globalConfig,
        followConfig,
        bitsConfig,
        subsConfig,
        giftSubsConfig,
        raidsConfig,
        resubsConfig,
        hypeTrainConfig,
        updateGlobalConfig,
        updateFollowConfig,
        updateBitsConfig,
        updateSubsConfig,
        updateGiftSubsConfig,
        updateRaidsConfig,
        updateResubsConfig,
        updateHypeTrainConfig,
        getCompleteConfig,
        loadConfig,
        resetToDefaults,
    } = useEventAlertsConfig();

    // Persistencia (cargar/guardar desde API)
    const { loading, saving, saveMessage, loadConfiguration, saveConfiguration } = useEventAlertsPersistence({
        onConfigLoaded: loadConfig,
    });

    useEffect(() => {
        loadConfiguration();
        loadFrontendInfo();
    }, []);

    const loadFrontendInfo = async () => {
        try {
            const res = await api.get('/settings/frontend-info');
            if (res.data.success) {
                const { frontendUrl, channel } = res.data;
                const channelLogin = channel?.login || '';
                setChannelName(channelLogin);
                setOverlayUrl(`${frontendUrl}/overlay/event-alerts?channel=${channelLogin}`);
            }
        } catch (error) {
            console.error('Error loading frontend info:', error);
            // Fallback URL
            setOverlayUrl(`${window.location.origin}/overlay/event-alerts?channel=tu-canal`);
        }
    };

    // Configuración de tabs
    // Orden: Global → Eventos → Editor (carga config de eventos) → Extras
    const tabs: { id: TabType; label: string; icon: string; disabled?: boolean }[] = [
        { id: 'global', label: 'Global', icon: '⚙️' },
        { id: 'follow', label: 'Follows', icon: '❤️' },
        { id: 'bits', label: 'Bits', icon: '💎' },
        { id: 'subs', label: 'Subs', icon: '⭐' },
        { id: 'giftSubs', label: 'Gift Subs', icon: '🎁' },
        { id: 'raids', label: 'Raids', icon: '🚀' },
        { id: 'resubs', label: 'Resubs', icon: '🎉' },
        { id: 'hypeTrain', label: 'Hype Train', icon: '🔥' },
        { id: 'overlay', label: 'Editor', icon: '🎨' }, // Editor carga config de los eventos
        { id: 'media', label: 'Media', icon: '📁' },
        { id: 'testing', label: 'Testing', icon: '🧪' },
        { id: 'style', label: 'Avanzado', icon: '⚡' },
    ];

    // Handlers
    const handleSave = async () => {
        const config = getCompleteConfig();
        await saveConfiguration(config);
    };

    const handleReset = () => {
        if (window.confirm('¿Estás seguro de resetear toda la configuración?')) {
            resetToDefaults();
            alert('Configuración reseteada a valores por defecto');
        }
    };

    const handleTestAlert = async (eventType: string, data?: any) => {
        try {
            await api.post('/eventalerts/test', { eventType, ...data });
        } catch (error) {
            console.error('❌ Error sending test alert:', error);
            alert('Error al enviar la alerta de prueba. Verifica que el overlay esté abierto.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8fafc] dark:bg-[#1B1C1D] flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl mb-4">🎉</div>
                    <p className="text-[#64748b] dark:text-[#94a3b8] font-bold">Cargando Event Alerts...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#1B1C1D] p-4 sm:p-6 lg:p-8">
            <div className="max-w-[1920px] mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/overlays')}
                            className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors shadow-lg"
                        >
                            <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                🎉 Event Alerts
                            </h1>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                                Configura alertas para follows, bits, subs, raids y más eventos de Twitch
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {saveMessage && (
                            <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                                saveMessage.type === 'success'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}>
                                {saveMessage.text}
                            </span>
                        )}
                        <button
                            onClick={handleReset}
                            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-xl transition-colors flex items-center gap-2 font-bold shadow-lg"
                        >
                            🔄 Reset
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-3 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-60 text-white rounded-xl transition-all flex items-center gap-2 font-bold shadow-lg"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>

                {/* Main Grid: 2/3 Editor + 1/3 Preview */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Column: Tabs + Content (2/3 en XL+) */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* Tabs Navigation - WRAPPING (No scroll) */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 shadow-lg">
                            <div className="flex flex-wrap gap-2">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => !tab.disabled && handleTabChange(tab.id)}
                                        disabled={tab.disabled}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                            activeTab === tab.id
                                                ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-lg'
                                                : tab.disabled
                                                ? 'bg-[#f8fafc] dark:bg-[#262626] text-[#94a3b8] dark:text-[#64748b] opacity-50 cursor-not-allowed'
                                                : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                        }`}
                                    >
                                        {tab.icon} {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div>
                            {activeTab === 'global' && (
                                <GlobalTab
                                    config={globalConfig}
                                    onConfigChange={updateGlobalConfig}
                                    overlayUrl={overlayUrl}
                                />
                            )}

                            {activeTab === 'style' && (
                                <StyleTab globalConfig={globalConfig} onGlobalConfigChange={updateGlobalConfig} />
                            )}

                            {activeTab === 'follow' && (
                                <FollowTab config={followConfig} onConfigChange={updateFollowConfig} />
                            )}

                            {activeTab === 'bits' && (
                                <BitsTab config={bitsConfig} onConfigChange={updateBitsConfig} />
                            )}

                            {activeTab === 'subs' && (
                                <SubsTab config={subsConfig} onConfigChange={updateSubsConfig} />
                            )}

                            {activeTab === 'giftSubs' && (
                                <GiftSubsTab config={giftSubsConfig} onConfigChange={updateGiftSubsConfig} />
                            )}

                            {activeTab === 'raids' && (
                                <RaidsTab config={raidsConfig} onConfigChange={updateRaidsConfig} />
                            )}

                            {activeTab === 'resubs' && (
                                <ResubsTab config={resubsConfig} onConfigChange={updateResubsConfig} />
                            )}

                            {activeTab === 'hypeTrain' && (
                                <HypeTrainTab config={hypeTrainConfig} onConfigChange={updateHypeTrainConfig} />
                            )}

                            {activeTab === 'testing' && (
                                <TestingTab onTest={handleTestAlert} />
                            )}

                            {activeTab === 'overlay' && (
                                <OverlayEditorTab
                                    overlayUrl={overlayUrl}
                                    globalConfig={globalConfig}
                                    onGlobalConfigChange={updateGlobalConfig}
                                    onSave={handleSave}
                                    followConfig={followConfig}
                                    bitsConfig={bitsConfig}
                                    subsConfig={subsConfig}
                                    giftSubsConfig={giftSubsConfig}
                                    raidsConfig={raidsConfig}
                                    resubsConfig={resubsConfig}
                                    parentActiveTab={lastEventTab}
                                    // Funciones para actualizar cada config
                                    onFollowConfigChange={updateFollowConfig}
                                    onBitsConfigChange={updateBitsConfig}
                                    onSubsConfigChange={updateSubsConfig}
                                    onGiftSubsConfigChange={updateGiftSubsConfig}
                                    onRaidsConfigChange={updateRaidsConfig}
                                    onResubsConfigChange={updateResubsConfig}
                                />
                            )}

                            {activeTab === 'media' && (
                                <MediaTab />
                            )}
                        </div>
                    </div>

                    {/* Right Column: Preview (1/3 en XL+) */}
                    <div className="xl:col-span-1">
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg sticky top-6">
                            <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                📺 Preview — {tabs.find(t => t.id === activeTab)?.label}
                            </h3>
                            <AlertPreview
                                activeTab={activeTab}
                                globalConfig={globalConfig}
                                followConfig={followConfig}
                                bitsConfig={bitsConfig}
                                subsConfig={subsConfig}
                                giftSubsConfig={giftSubsConfig}
                                raidsConfig={raidsConfig}
                                resubsConfig={resubsConfig}
                                hypeTrainConfig={hypeTrainConfig}
                                overlayUrl={overlayUrl}
                            />
                        </div>
                    </div>
                </div>

                {/* DEBUG INFO (solo desarrollo) */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="mt-6">
                        <details className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 shadow-lg">
                            <summary className="cursor-pointer font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                🔧 Debug Config
                            </summary>
                            <pre className="mt-4 text-xs overflow-auto text-[#64748b] dark:text-[#94a3b8] bg-[#f8fafc] dark:bg-[#262626] p-4 rounded-lg">
                                {JSON.stringify(getCompleteConfig(), null, 2)}
                            </pre>
                        </details>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventAlertsConfig;
