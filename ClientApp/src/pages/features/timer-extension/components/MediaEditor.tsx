/**
 * Timer Extension - Media Editor Component (Smart Logic)
 *
 * Lógica Reactiva:
 * - Video con sonido -> No pide audio extra.
 * - Video Muteado -> Pide audio extra (reemplazo de audio).
 * - Imagen -> Pide audio extra (acompañamiento).
 * - Audio -> Pide visual extra (imagen/gif de fondo).
 */

import { useState, useEffect, useRef } from 'react';
import { Volume2, Image as ImageIcon, Video, Music, VolumeX, RefreshCw, FileAudio, Trash2, Play, X } from 'lucide-react';
import MediaInputWithSelector from '../../../../components/timer/MediaInputWithSelector';
import type { AlertMediaConfig } from '../../types/timer-alerts';

// ============================================================================
// ALERT CONTEXT TYPE (for full preview)
// ============================================================================
export interface AlertPreviewContext {
    message?: string;
    duration?: number;
    emoji?: string;
    style?: {
        backgroundColor?: string;
        backgroundType?: 'solid' | 'gradient' | 'transparent';
        backgroundGradient?: { angle: number; color1: string; color2: string };
        textColor?: string;
        fontFamily?: string;
        fontSize?: number;
        fontWeight?: number;
        textAlign?: 'left' | 'center' | 'right';
        textShadow?: 'none' | 'normal' | 'strong' | 'glow';
        borderEnabled?: boolean;
        borderColor?: string;
        borderWidth?: number;
        borderRadius?: number;
    };
}

// ============================================================================
// FULL ALERT PREVIEW MODAL COMPONENT
// ============================================================================
interface AlertPreviewModalProps {
    url: string;
    type: 'video' | 'audio' | 'image';
    volume: number;
    backingAudioUrl?: string;
    backingAudioVolume?: number;
    backingVisualUrl?: string;
    alertContext?: AlertPreviewContext;
    onClose: () => void;
}

const AlertPreviewModal: React.FC<AlertPreviewModalProps> = ({
    url,
    type,
    volume,
    backingAudioUrl,
    backingAudioVolume = 100,
    backingVisualUrl,
    alertContext,
    onClose,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const backingAudioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const style = alertContext?.style || {};
    const message = alertContext?.message || '';
    const emoji = alertContext?.emoji || '🎉';
    const duration = alertContext?.duration || 5;

    // Get background style
    const getBackgroundStyle = () => {
        if (style.backgroundType === 'transparent') return 'transparent';
        if (style.backgroundType === 'gradient' && style.backgroundGradient) {
            return `linear-gradient(${style.backgroundGradient.angle}deg, ${style.backgroundGradient.color1}, ${style.backgroundGradient.color2})`;
        }
        return style.backgroundColor || 'rgba(0,0,0,0.8)';
    };

    // Get text shadow
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
        if (type === 'video' && videoRef.current) {
            videoRef.current.volume = volume / 100;
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(console.error);
        }
        if (type === 'audio' && audioRef.current) {
            audioRef.current.volume = volume / 100;
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(console.error);
        }
        if (backingAudioUrl && backingAudioRef.current) {
            backingAudioRef.current.volume = backingAudioVolume / 100;
            backingAudioRef.current.currentTime = 0;
            backingAudioRef.current.play().catch(console.error);
        }
    };

    const handleStop = () => {
        setIsPlaying(false);
        if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        if (backingAudioRef.current) { backingAudioRef.current.pause(); backingAudioRef.current.currentTime = 0; }
    };

    useEffect(() => {
        return () => {
            handleStop();
        };
    }, []);

    // Determine what visual to show
    const visualUrl = type === 'audio' ? backingVisualUrl : url;
    const isVideoMedia = type === 'video';
    const isImageMedia = type === 'image' || (type === 'audio' && backingVisualUrl);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
            <div
                className="relative max-w-lg w-full mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                >
                    <X className="w-6 h-6 text-white" />
                </button>

                {/* Alert Preview Container - Simulates overlay */}
                <div
                    className="relative rounded-2xl overflow-hidden shadow-2xl"
                    style={{
                        background: getBackgroundStyle(),
                        border: style.borderEnabled ? `${style.borderWidth || 2}px solid ${style.borderColor || '#ffffff'}` : 'none',
                        borderRadius: `${style.borderRadius || 16}px`,
                    }}
                >
                    {/* Media Section */}
                    <div className="relative aspect-video bg-black/50 flex items-center justify-center overflow-hidden">
                        {/* Video */}
                        {isVideoMedia && (
                            <video
                                ref={videoRef}
                                src={url}
                                className="w-full h-full object-contain"
                                loop
                                onEnded={() => setIsPlaying(false)}
                            />
                        )}

                        {/* Image/GIF */}
                        {isImageMedia && visualUrl && (
                            <img
                                src={visualUrl}
                                alt="Alert media"
                                className="w-full h-full object-contain"
                            />
                        )}

                        {/* Audio only (no visual) */}
                        {type === 'audio' && !backingVisualUrl && (
                            <div className="flex flex-col items-center justify-center text-white/50">
                                <Music className="w-20 h-20 mb-2" />
                                <span className="text-sm">Solo Audio</span>
                            </div>
                        )}

                        {/* Play/Stop overlay button */}
                        {!isPlaying && (
                            <button
                                onClick={handlePlay}
                                className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors group"
                            >
                                <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <Play className="w-10 h-10 text-white ml-1" />
                                </div>
                            </button>
                        )}

                        {isPlaying && (
                            <button
                                onClick={handleStop}
                                className="absolute top-3 right-3 p-2 bg-red-500 hover:bg-red-600 rounded-full transition-colors shadow-lg"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        )}
                    </div>

                    {/* Text Section */}
                    {message && (
                        <div
                            className="p-4"
                            style={{
                                textAlign: style.textAlign || 'center',
                            }}
                        >
                            <div className="text-3xl mb-2">{emoji}</div>
                            <p
                                style={{
                                    fontFamily: style.fontFamily || 'Inter, sans-serif',
                                    fontSize: `${style.fontSize || 24}px`,
                                    fontWeight: style.fontWeight || 700,
                                    color: style.textColor || '#ffffff',
                                    textShadow: getTextShadow(),
                                    lineHeight: 1.3,
                                }}
                            >
                                {message}
                            </p>
                        </div>
                    )}

                    {/* Hidden audio elements */}
                    {type === 'audio' && (
                        <audio ref={audioRef} src={url} />
                    )}
                    {backingAudioUrl && (
                        <audio ref={backingAudioRef} src={backingAudioUrl} />
                    )}
                </div>

                {/* Info footer */}
                <div className="mt-4 flex items-center justify-center gap-4 text-xs text-white/60">
                    <span className="flex items-center gap-1">
                        <Volume2 className="w-3 h-3" />
                        {volume}%
                    </span>
                    <span>•</span>
                    <span>{duration}s</span>
                    {backingAudioUrl && (
                        <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <FileAudio className="w-3 h-3" />
                                Audio: {backingAudioVolume}%
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// MEDIA EDITOR PROPS
// ============================================================================
interface MediaEditorProps {
    config: AlertMediaConfig;
    onChange: (updates: AlertMediaConfig) => void;
    /** Optional alert context for full preview */
    alertContext?: AlertPreviewContext;
}

// Helper extendido para detectar tipo (incluyendo imágenes)
const getMediaType = (url: string): 'video' | 'audio' | 'image' => {
    if (!url) return 'audio'; // Default fallback

    const lowerUrl = url.toLowerCase();

    // Quitar query params para obtener extensión real
    const urlWithoutParams = lowerUrl.split('?')[0];
    const ext = urlWithoutParams.split('.').pop();

    // Detectar por extensión
    if (['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext || '')) return 'video';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext || '')) return 'image';
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext || '')) return 'audio';

    // Detectar por dominios conocidos de GIFs
    if (lowerUrl.includes('tenor.com') ||
        lowerUrl.includes('giphy.com') ||
        lowerUrl.includes('gfycat.com') ||
        lowerUrl.includes('imgur.com/') && lowerUrl.includes('.gif')) {
        return 'image';
    }

    // Detectar por parámetros de URL (Tenor usa format=gif)
    if (lowerUrl.includes('format=gif') || lowerUrl.includes('type=gif')) {
        return 'image';
    }

    // Detectar CDNs de video
    if (lowerUrl.includes('youtube.com') ||
        lowerUrl.includes('youtu.be') ||
        lowerUrl.includes('vimeo.com') ||
        lowerUrl.includes('twitch.tv/clips')) {
        return 'video';
    }

    return 'audio'; // Default fallback
};

export const MediaEditor: React.FC<MediaEditorProps> = ({ config, onChange, alertContext }) => {
    // 1. Determinar el archivo principal actual (puede venir de video, audio o image en la config avanzada)
    const initialMainUrl =
        config.mode === 'simple' ? config.simple?.url :
        (config.advanced?.video?.url || config.advanced?.audio?.url || config.advanced?.image?.url || '');

    const [mainUrl, setMainUrl] = useState<string>(initialMainUrl || '');
    const detectedType = getMediaType(mainUrl);

    // Estado para el modal de preview
    const [showPreview, setShowPreview] = useState(false);

    // 2. Estados de control
    const [mainVolume, setMainVolume] = useState<number>(
        config.mode === 'simple' ? (config.simple?.volume ?? 100) :
        (detectedType === 'video' ? config.advanced?.video?.volume : config.advanced?.audio?.volume) ?? 100
    );

    const [mainLoop, setMainLoop] = useState<boolean>(
        config.mode === 'simple' ? false :
        (detectedType === 'video' ? config.advanced?.video?.loop : config.advanced?.audio?.loop) ?? false
    );

    // 3. Audio de Acompañamiento (Para Imagen o Video Muteado)
    const [backingAudioUrl, setBackingAudioUrl] = useState<string>(
        (detectedType !== 'audio' && config.advanced?.audio?.url) ? config.advanced?.audio?.url : ''
    );
    const [backingAudioVolume, setBackingAudioVolume] = useState<number>(
        config.advanced?.audio?.volume ?? 100
    );

    // 4. Visual de Acompañamiento (Para Audio)
    const [backingVisualUrl, setBackingVisualUrl] = useState<string>(
        detectedType === 'audio' ? (config.advanced?.image?.url || '') : ''
    );

    // Lógica para saber si debemos mostrar el input de audio secundario
    const needsBackingAudio =
        (detectedType === 'image') ||
        (detectedType === 'video' && mainVolume === 0);

    // Lógica para mostrar el input visual secundario
    const needsBackingVisual = detectedType === 'audio';

    // Efecto constructor de configuración
    useEffect(() => {
        const type = getMediaType(mainUrl);

        // Si no hay URL principal, deshabilitar media
        if (!mainUrl || mainUrl.trim() === '') {
            onChange({
                enabled: false,
                mode: 'simple',
            });
            return;
        }

        const newConfig: AlertMediaConfig = {
            enabled: true,
            mode: 'advanced',
            advanced: {}
        };

        if (type === 'video') {
            newConfig.advanced!.video = {
                url: mainUrl,
                volume: mainVolume,
                loop: mainLoop
            };
            if (mainVolume === 0 && backingAudioUrl) {
                newConfig.advanced!.audio = {
                    url: backingAudioUrl,
                    volume: backingAudioVolume,
                    loop: false
                };
            }
        } else if (type === 'image') {
            newConfig.advanced!.image = {
                url: mainUrl
            };
            if (backingAudioUrl) {
                newConfig.advanced!.audio = {
                    url: backingAudioUrl,
                    volume: backingAudioVolume,
                    loop: false
                };
            }
        } else {
            newConfig.advanced!.audio = {
                url: mainUrl,
                volume: mainVolume,
                loop: mainLoop
            };
            if (backingVisualUrl) {
                newConfig.advanced!.image = {
                    url: backingVisualUrl
                };
            }
        }

        onChange(newConfig);
    }, [mainUrl, mainVolume, mainLoop, backingAudioUrl, backingAudioVolume, backingVisualUrl]);

    return (
        <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-4 space-y-6 transition-all">

            {/* === ARCHIVO PRINCIPAL === */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] flex items-center gap-2 uppercase">
                        {detectedType === 'video' && <><Video className="w-4 h-4 text-purple-500" /> Video Principal</>}
                        {detectedType === 'image' && <><ImageIcon className="w-4 h-4 text-pink-500" /> Imagen Principal</>}
                        {detectedType === 'audio' && <><Music className="w-4 h-4 text-blue-500" /> Audio Principal</>}
                    </label>
                </div>

                <div className="flex gap-2">
                    <div className="flex-1">
                        <MediaInputWithSelector
                            value={mainUrl}
                            onChange={setMainUrl}
                            label=""
                            placeholder="Sube Video, Imagen o Audio..."
                            allowedTypes={['audio', 'video', 'image']}
                        />
                    </div>
                    {/* Botón Play para Preview */}
                    {mainUrl && (
                        <button
                            onClick={() => setShowPreview(true)}
                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg transition-all font-bold text-sm flex items-center gap-2 shadow-lg hover:shadow-xl"
                            title="Reproducir preview de la alerta"
                        >
                            <Play className="w-4 h-4" />
                            Play
                        </button>
                    )}
                </div>

                {/* Controles */}
                {mainUrl && detectedType !== 'image' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white dark:bg-[#1B1C1D] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                        {/* Volumen */}
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] flex items-center gap-2">
                                    {mainVolume === 0 ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                                    Volumen
                                </label>
                                <span className="text-xs font-mono text-[#2563eb]">{mainVolume}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={mainVolume}
                                onChange={(e) => setMainVolume(Number(e.target.value))}
                                className="w-full accent-[#2563eb]"
                            />
                        </div>

                        {/* Opciones */}
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={mainLoop}
                                    onChange={(e) => setMainLoop(e.target.checked)}
                                    className="rounded text-[#2563eb] focus:ring-[#2563eb]"
                                />
                                <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3" /> Loop
                                </span>
                            </label>

                            {/* Botón Mutear Especial para Video */}
                            {detectedType === 'video' && (
                                <button
                                    onClick={() => setMainVolume(mainVolume === 0 ? 100 : 0)}
                                    className={`text-xs font-bold px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                                        mainVolume === 0
                                            ? 'bg-red-50 text-red-600 border border-red-200'
                                            : 'text-[#64748b] hover:bg-gray-100'
                                    }`}
                                >
                                    {mainVolume === 0 ? 'Video Muteado' : 'Mutear Video'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* === VISUAL DE ACOMPAÑAMIENTO (Para Audio) === */}
            {needsBackingVisual && mainUrl && (
                <div className="animate-fade-in border-t border-dashed border-[#e2e8f0] dark:border-[#374151] pt-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-pink-500" />
                            <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                Visual de Fondo (Opcional)
                            </h4>
                        </div>
                        {backingVisualUrl && (
                            <button
                                onClick={() => setBackingVisualUrl('')}
                                className="text-[#ef4444] hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded transition-colors"
                                title="Eliminar visual"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="pl-6 border-l-2 border-pink-500/20 space-y-3">
                        <MediaInputWithSelector
                            value={backingVisualUrl}
                            onChange={setBackingVisualUrl}
                            label=""
                            placeholder="Selecciona imagen o GIF de fondo..."
                            allowedTypes={['image', 'video']}
                        />
                    </div>
                </div>
            )}

            {/* === AUDIO DE ACOMPAÑAMIENTO (Condicional) === */}
            {needsBackingAudio && mainUrl && (
                <div className="animate-fade-in border-t border-dashed border-[#e2e8f0] dark:border-[#374151] pt-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <FileAudio className="w-4 h-4 text-green-500" />
                            <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                {detectedType === 'image' ? 'Audio para la Imagen' : 'Audio de Reemplazo'}
                            </h4>
                        </div>
                        {backingAudioUrl && (
                            <button
                                onClick={() => { setBackingAudioUrl(''); setBackingAudioVolume(100); }}
                                className="text-[#ef4444] hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded transition-colors"
                                title="Eliminar audio"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="pl-6 border-l-2 border-green-500/20 space-y-3">
                        <MediaInputWithSelector
                            value={backingAudioUrl}
                            onChange={setBackingAudioUrl}
                            label=""
                            placeholder="Selecciona la música o sonido..."
                            allowedTypes={['audio']}
                        />

                        {backingAudioUrl && (
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex justify-between mb-1">
                                        <label className="text-[10px] font-bold text-[#64748b]">Volumen Audio</label>
                                        <span className="text-[10px] font-mono text-green-600">{backingAudioVolume}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={backingAudioVolume}
                                        onChange={(e) => setBackingAudioVolume(Number(e.target.value))}
                                        className="w-full accent-green-500 h-1"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Preview con contexto de alerta */}
            {showPreview && mainUrl && (
                <AlertPreviewModal
                    url={mainUrl}
                    type={detectedType}
                    volume={mainVolume}
                    backingAudioUrl={needsBackingAudio ? backingAudioUrl : undefined}
                    backingAudioVolume={backingAudioVolume}
                    backingVisualUrl={needsBackingVisual ? backingVisualUrl : undefined}
                    alertContext={alertContext}
                    onClose={() => setShowPreview(false)}
                />
            )}
        </div>
    );
};
