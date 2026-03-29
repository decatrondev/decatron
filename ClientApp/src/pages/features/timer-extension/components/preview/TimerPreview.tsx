/**
 * Timer Extension - TimerPreview Component
 *
 * Componente de vista previa en vivo del timer.
 * Renderiza una réplica exacta del overlay usando escalado CSS.
 * 
 * UPDATE CRÍTICO:
 * - Implementación de Playlist Real (Secuencial: A -> B -> C -> Loop A).
 * - Control de Volumen forzado antes de cada reproducción.
 * - Separación de capas (Scaler vs Animator) mantenida.
 */

import { Monitor, Play, Pause, StopCircle, Type, Palette, Clock, Activity, Zap, Volume2, VolumeX, SkipForward } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import ProgressBarHorizontal from '../../../../../components/timer/ProgressBarHorizontal';
import ProgressBarVertical from '../../../../../components/timer/ProgressBarVertical';
import ProgressBarCircular from '../../../../../components/timer/ProgressBarCircular';
import { hexToRgba } from '../../utils';
import type { DisplayConfig, ProgressBarConfig, StyleConfig, ThemeConfig, AnimationConfig } from '../../types';

interface TimerPreviewProps {
    displayConfig: DisplayConfig;
    progressBarConfig: ProgressBarConfig;
    styleConfig: StyleConfig;
    themeConfig: ThemeConfig;
    animationConfig?: AnimationConfig;
    canvasWidth?: number;
    canvasHeight?: number;
    previewTimeRemaining: number;
    previewTotalDuration: number;
    previewIsRunning: boolean;
    previewRef: React.RefObject<HTMLDivElement>;
    onTogglePreview: () => void;
    onResetPreview: () => void;
    onPlayPreview?: () => void;
    onPausePreview?: () => void;
    onStopPreview?: () => void;
    initialTimeOffset?: number;
}

export const TimerPreview: React.FC<TimerPreviewProps> = ({
    displayConfig,
    progressBarConfig,
    styleConfig,
    themeConfig,
    animationConfig,
    canvasWidth = 1000,
    canvasHeight = 300,
    previewTimeRemaining,
    previewTotalDuration,
    previewIsRunning,
    onTogglePreview,
    onResetPreview,
    onPlayPreview,
    onPausePreview,
    onStopPreview,
    initialTimeOffset = 0
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [scale, setScale] = useState(1);
    const [isCriticalMode, setIsCriticalMode] = useState(false);
    
    // Estado para controlar qué canción de la playlist suena
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    // Estado para mutear la previsualización (solo local)
    const [previewMuted, setPreviewMuted] = useState(false);

    // ========================================================================
    // 1. INICIALIZACIÓN DE AUDIO
    // ========================================================================
    useEffect(() => {
        audioRef.current = new Audio();
        // Desactivamos el loop nativo porque lo gestionaremos manualmente para playlists
        audioRef.current.loop = false; 
        
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
                audioRef.current = null;
            }
        };
    }, []);

    // ========================================================================
    // 2. LOGICA CRÍTICA (DETECTAR ESTADO)
    // ========================================================================
    useEffect(() => {
        if (!animationConfig?.criticalMode?.enabled) {
            setIsCriticalMode(false);
            return;
        }
        const { triggerTime, triggerTimeUnit } = animationConfig.criticalMode;
        let triggerSeconds = triggerTime;
        if (triggerTimeUnit === 'minutes') triggerSeconds *= 60;
        if (triggerTimeUnit === 'hours') triggerSeconds *= 3600;

        const isCritical = previewTimeRemaining <= triggerSeconds && previewTimeRemaining > 0;
        
        // Si entramos en modo crítico, reseteamos el índice de la playlist
        if (isCritical && !isCriticalMode) {
            setCurrentTrackIndex(0);
        }
        
        setIsCriticalMode(isCritical);
    }, [previewTimeRemaining, animationConfig?.criticalMode]);

    // ========================================================================
    // 3. MOTOR DE AUDIO (PLAYLIST & VOLUMEN)
    // ========================================================================
    
    // Derivar playlist para uso compartido
    const activePlaylist = (() => {
        const config = animationConfig?.criticalMode;
        if (config?.playlist && config.playlist.length > 0) return config.playlist;
        if (config?.soundUrl) return [config.soundUrl];
        return [];
    })();

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const config = animationConfig?.criticalMode;
        
        // 3.1. CONDICIONES DE PARADA
        if (!isCriticalMode || !config?.enabled || !config.soundEnabled || !previewIsRunning) {
            audio.pause();
            if (!isCriticalMode) {
                audio.currentTime = 0;
            }
            return;
        }

        if (activePlaylist.length === 0) return;

        // 3.2. SELECCIÓN DE PISTA (Con Modulo Seguro)
        // Usamos modulo aquí para asegurar que el index siempre sea válido para leer la URL
        const safeIndex = currentTrackIndex % activePlaylist.length;
        const trackUrl = activePlaylist[safeIndex];

        // 3.3. CONFIGURACIÓN DE AUDIO (Volumen y Mute)
        // Usamos .muted nativo para silenciar efectivamente
        audio.muted = previewMuted;
        
        const baseVolume = (config.soundVolume ?? 100) / 100;
        audio.volume = Math.max(0, Math.min(1, baseVolume));

        // 3.4. REPRODUCCIÓN PROTEGIDA
        if (trackUrl) {
            // Solo cambiamos source si es diferente
            if (audio.src !== trackUrl && !audio.src.endsWith(trackUrl)) {
                audio.src = trackUrl;
                audio.load();
            }

            // Manejador de fin de pista
            audio.onended = () => {
                // Lógica de Siguiente Pista
                // Si es la última pista y no hay loop, paramos.
                const isLastTrack = safeIndex === activePlaylist.length - 1;
                
                if (isLastTrack && !config.loopAudio) {
                    // Fin de playlist sin bucle
                    return; 
                }

                // Avanzar (el modulo en la próxima renderización manejará el índice)
                setCurrentTrackIndex(prev => prev + 1);
                
                // Si solo hay una pista y estamos en bucle, forzamos replay
                if (activePlaylist.length === 1 && config.loopAudio) {
                    audio.currentTime = 0;
                    audio.play().catch(() => {});
                }
            };

            // Intentar reproducir si está pausado y tenemos URL válida
            if (audio.paused && audio.src) {
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {});
                }
            }
        } else {
            audio.pause();
        }

    }, [isCriticalMode, previewIsRunning, animationConfig?.criticalMode, currentTrackIndex, previewMuted, activePlaylist]);

    // ========================================================================
    // 4. ESCALADO RESPONSIVE
    // ========================================================================
    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                const newScale = containerWidth / canvasWidth;
                setScale(newScale);
            }
        };
        updateScale();
        const resizeObserver = new ResizeObserver(updateScale);
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [canvasWidth, canvasHeight]);

    // ========================================================================
    // 5. DATOS VISUALES & RENDER
    // ========================================================================
    const totalWithOffset = previewTotalDuration + initialTimeOffset;
    const elapsedWithOffset = (previewTotalDuration - previewTimeRemaining) + initialTimeOffset;
    const progress = totalWithOffset > 0 ? (elapsedWithOffset / totalWithOffset) * 100 : 0;

    // Helpers Texto
    const formatTimeDetailed = (seconds: number) => {
        let remaining = seconds;
        const years = Math.floor(remaining / (365 * 24 * 60 * 60));
        remaining -= years * 365 * 24 * 60 * 60;
        const months = Math.floor(remaining / (30 * 24 * 60 * 60));
        remaining -= months * 30 * 24 * 60 * 60;
        const weeks = Math.floor(remaining / (7 * 24 * 60 * 60));
        remaining -= weeks * 7 * 24 * 60 * 60;
        const days = Math.floor(remaining / (24 * 60 * 60));
        remaining -= days * 24 * 60 * 60;
        const hours = Math.floor(remaining / (60 * 60));
        remaining -= hours * 60 * 60;
        const minutes = Math.floor(remaining / 60);
        remaining -= minutes * 60;
        return { years, months, weeks, days, hours, minutes, seconds: remaining };
    };

    const getTimeString = (seconds: number): string => {
        const timeUnits = formatTimeDetailed(seconds);
        const parts: string[] = [];
        if (displayConfig.showYears && timeUnits.years > 0) parts.push(`${timeUnits.years}a`);
        if (displayConfig.showMonths && timeUnits.months > 0) parts.push(`${timeUnits.months}m`);
        if (displayConfig.showWeeks && timeUnits.weeks > 0) parts.push(`${timeUnits.weeks}w`);
        if (displayConfig.showDays && timeUnits.days > 0) parts.push(`${timeUnits.days}d`);
        const hasHigherUnits = parts.length > 0;
        if (displayConfig.showHours && (timeUnits.hours > 0 || hasHigherUnits)) parts.push(`${String(timeUnits.hours).padStart(2, '0')}h`);
        if (displayConfig.showMinutes && (timeUnits.minutes > 0 || hasHigherUnits || displayConfig.showHours)) parts.push(`${String(timeUnits.minutes).padStart(2, '0')}m`);
        if (displayConfig.showSeconds && (timeUnits.seconds > 0 || hasHigherUnits || displayConfig.showMinutes)) parts.push(`${String(timeUnits.seconds).padStart(2, '0')}s`);
        if (parts.length === 0) {
            if (displayConfig.showMinutes && displayConfig.showSeconds) return '00:00';
            return '00s';
        }
        return parts.join(' ');
    };

    const getTextShadowStyle = (shadow: string): string => {
        switch (shadow) {
            case 'normal': return '2px 2px 4px rgba(0,0,0,0.5)';
            case 'strong': return '3px 3px 6px rgba(0,0,0,0.8)';
            case 'glow': return '0 0 10px rgba(255,255,255,0.8)';
            default: return 'none';
        }
    };

    const timeString = getTimeString(previewTimeRemaining);
    const elapsedTimeString = getTimeString((previewTotalDuration - previewTimeRemaining) + initialTimeOffset);

    // ========================================================================
    // 6. ESTILOS DE CAPAS (ANIMACIÓN TOTAL)
    // ========================================================================

    const isBgImage = themeConfig.containerBackground?.trim().startsWith('url(');

    // CAPA 1: SCALER (Fija)
    const scalerStyle: React.CSSProperties = {
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        position: 'absolute',
        top: 0,
        left: 0,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        overflow: 'hidden',
        fontFamily: styleConfig.fontFamily
    };

    // CAPA 2: ANIMATOR (Movimiento)
    let animationStyle = {};
    if (isCriticalMode && animationConfig?.criticalMode?.enabled) {
        const { effectType, effectSpeed } = animationConfig.criticalMode;
        if (effectType !== 'none') {
            const durationMap = { slow: '2s', normal: '1s', fast: '0.5s' };
            const duration = durationMap[effectSpeed] || '1s';
            animationStyle = { animation: `${effectType}Animation ${duration} infinite` };
        }
    }

    const animatorStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        position: 'relative',
        ...animationStyle // AQUI aplicamos la animación a TODO el contenido
    };

    // Fondo (en el animator para que se mueva con todo)
    if (themeConfig.containerBackground === 'transparent') {
        animatorStyle.backgroundColor = 'transparent';
        animatorStyle.backgroundImage = 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)';
        animatorStyle.backgroundSize = '20px 20px';
        animatorStyle.backgroundPosition = '0 0, 0 10px, 10px -10px, -10px 0px';
    } else if (isBgImage) {
        animatorStyle.backgroundImage = themeConfig.containerBackground;
        animatorStyle.backgroundColor = 'transparent'; 
        animatorStyle.backgroundSize = 'cover';
        animatorStyle.backgroundPosition = 'center';
    } else {
        animatorStyle.backgroundColor = hexToRgba(themeConfig.containerBackground, themeConfig.containerOpacity / 100);
    }

    return (
        <div className="space-y-4 xl:sticky xl:top-6">
            
            {/* KEYFRAMES */}
            <style>{`
                @keyframes pulseAnimation {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                    100% { transform: scale(1); }
                }
                @keyframes shakeAnimation {
                    0% { transform: translate(1px, 1px) rotate(0deg); }
                    10% { transform: translate(-1px, -2px) rotate(-1deg); }
                    20% { transform: translate(-3px, 0px) rotate(1deg); }
                    30% { transform: translate(3px, 2px) rotate(0deg); }
                    40% { transform: translate(1px, -1px) rotate(1deg); }
                    50% { transform: translate(-1px, 2px) rotate(-1deg); }
                    60% { transform: translate(-3px, 1px) rotate(0deg); }
                    70% { transform: translate(3px, 1px) rotate(-1deg); }
                    80% { transform: translate(-1px, -1px) rotate(1deg); }
                    90% { transform: translate(1px, 2px) rotate(0deg); }
                    100% { transform: translate(1px, -2px) rotate(-1deg); }
                }
                @keyframes flashAnimation {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; background-color: rgba(255,0,0,0.5); }
                    100% { opacity: 1; }
                }
            `}</style>

            {/* MONITOR */}
            <div className={`bg-[#1e293b] rounded-2xl border transition-colors shadow-2xl overflow-hidden ${isCriticalMode ? 'border-red-500 shadow-red-500/20' : 'border-[#334155]'}`}>
                
                {/* Header */}
                <div className={`px-4 py-3 flex items-center justify-between border-b transition-colors ${isCriticalMode ? 'bg-red-900/20 border-red-500/30' : 'bg-[#0f172a] border-[#334155]'}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${previewIsRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isCriticalMode ? 'text-red-400' : 'text-gray-300'}`}>
                            {isCriticalMode ? <Zap className="w-3 h-3 animate-bounce" /> : <Monitor className="w-3 h-3" />}
                            {isCriticalMode ? 'CRITICAL MODE ACTIVE' : 'OBS Preview'}
                        </span>
                    </div>
                    
                    {/* Controles de Audio en Preview (Solo Critical Mode) */}
                    {isCriticalMode && animationConfig?.criticalMode?.soundEnabled && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 text-xs text-red-400 font-mono animate-pulse mr-2">
                                {previewMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                                <span>Track {(currentTrackIndex % (activePlaylist.length || 1)) + 1}</span>
                            </div>
                            
                            {/* Botones de Control de Audio */}
                            <div className="flex bg-black/20 rounded-lg p-0.5 border border-red-500/30">
                                <button 
                                    onClick={() => setPreviewMuted(!previewMuted)}
                                    className="p-1 hover:bg-white/10 rounded transition-colors text-red-300"
                                    title={previewMuted ? "Activar Sonido" : "Silenciar Preview"}
                                >
                                    {previewMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                                </button>
                                <div className="w-px bg-red-500/20 mx-0.5"></div>
                                <button 
                                    onClick={() => setCurrentTrackIndex(prev => prev + 1)}
                                    className="p-1 hover:bg-white/10 rounded transition-colors text-red-300"
                                    title="Siguiente Pista"
                                >
                                    <SkipForward className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {!isCriticalMode && (
                        <span className="text-[10px] text-gray-500 font-mono bg-[#1e293b] px-2 py-0.5 rounded">
                            {canvasWidth}x{canvasHeight} • {(scale * 100).toFixed(1)}%
                        </span>
                    )}
                </div>

                {/* Área Visual */}
                <div 
                    className="w-full relative bg-[url('https://upload.wikimedia.org/wikipedia/commons/5/5d/Checker-16x16.png')] bg-repeat overflow-hidden"
                    ref={containerRef}
                    style={{ height: canvasHeight * scale }} 
                >
                    {/* Capa Scaler */}
                    <div style={scalerStyle}>
                        {/* Capa Animator (Contiene TODO) */}
                        <div style={animatorStyle}>
                            
                            {/* Título */}
                            {displayConfig.showTitle && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: `${styleConfig.titlePosition.x}px`,
                                        top: `${styleConfig.titlePosition.y}px`,
                                        fontSize: `${styleConfig.titleFontSize}px`,
                                        fontWeight: 'bold',
                                        color: styleConfig.textColor,
                                        textShadow: getTextShadowStyle(styleConfig.textShadow),
                                        transform: 'translateX(-50%)',
                                        whiteSpace: 'nowrap',
                                        zIndex: 10
                                    }}
                                >
                                    {displayConfig.title}
                                </div>
                            )}

                            {/* Tiempo */}
                            <div
                                style={{
                                    position: 'absolute',
                                    left: `${styleConfig.timePosition.x}px`,
                                    top: `${styleConfig.timePosition.y}px`,
                                    transform: 'translateX(-50%)',
                                    textAlign: 'center',
                                    zIndex: 10
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: `${styleConfig.timeFontSize}px`,
                                        fontWeight: 'bold',
                                        color: isCriticalMode ? '#ff4444' : styleConfig.textColor,
                                        fontFamily: 'monospace',
                                        whiteSpace: 'nowrap',
                                        textShadow: isCriticalMode ? '0 0 20px red' : getTextShadowStyle(styleConfig.textShadow),
                                        transition: 'color 0.3s, text-shadow 0.3s'
                                    }}
                                >
                                    {timeString}
                                </div>
                            </div>

                            {/* +Tiempo */}
                            {displayConfig.showElapsedTime && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: `${styleConfig.elapsedTimePosition?.x || 500}px`,
                                        top: `${styleConfig.elapsedTimePosition?.y || 160}px`,
                                        transform: 'translateX(-50%)',
                                        fontSize: `${styleConfig.elapsedTimeFontSize || styleConfig.timeFontSize * 0.35}px`,
                                        fontWeight: '600',
                                        color: styleConfig.textColor,
                                        textShadow: getTextShadowStyle(styleConfig.textShadow),
                                        fontFamily: 'monospace',
                                        opacity: 0.7,
                                        whiteSpace: 'nowrap',
                                        zIndex: 10
                                    }}
                                >
                                    +{elapsedTimeString}
                                </div>
                            )}

                            {/* Porcentaje */}
                            {displayConfig.showPercentage && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: `${styleConfig.percentagePosition.x}px`,
                                        top: `${styleConfig.percentagePosition.y}px`,
                                        fontSize: `${styleConfig.percentageFontSize}px`,
                                        fontWeight: '600',
                                        color: styleConfig.textColor,
                                        textShadow: getTextShadowStyle(styleConfig.textShadow),
                                        transform: 'translateX(-50%)',
                                        whiteSpace: 'nowrap',
                                        zIndex: 10
                                    }}
                                >
                                    {Math.round(progress)}%
                                </div>
                            )}

                            {/* Barra de Progreso */}
                            <div style={{ position: 'absolute', inset: 0 }}>
                                {progressBarConfig.type === 'horizontal' && (
                                    <ProgressBarHorizontal
                                        progress={progress}
                                        orientation={progressBarConfig.orientation as any}
                                        position={progressBarConfig.position}
                                        size={progressBarConfig.size}
                                        backgroundType={progressBarConfig.backgroundType}
                                        backgroundColor={progressBarConfig.backgroundColor}
                                        backgroundGradient={progressBarConfig.backgroundGradient}
                                        backgroundImage={progressBarConfig.backgroundImage}
                                        fillType={progressBarConfig.fillType}
                                        fillColor={progressBarConfig.fillColor}
                                        fillGradient={progressBarConfig.fillGradient}
                                        fillImage={progressBarConfig.fillImage}
                                        indicatorEnabled={progressBarConfig.indicatorEnabled}
                                        indicatorType={progressBarConfig.indicatorType}
                                        indicatorSize={progressBarConfig.indicatorSize}
                                        indicatorColor={progressBarConfig.indicatorColor}
                                        indicatorImage={progressBarConfig.indicatorImage}
                                        indicatorRotate={progressBarConfig.indicatorRotate}
                                        borderEnabled={progressBarConfig.borderEnabled}
                                        borderColor={progressBarConfig.borderColor}
                                        borderWidth={progressBarConfig.borderWidth}
                                        borderRadius={progressBarConfig.borderRadius}
                                        isPulsing={isCriticalMode}
                                        pulseSpeed={animationConfig?.criticalMode?.effectSpeed || "normal"}
                                    />
                                )}
                                {progressBarConfig.type === 'vertical' && (
                                    <ProgressBarVertical
                                        progress={progress}
                                        orientation={progressBarConfig.orientation as any}
                                        position={progressBarConfig.position}
                                        size={progressBarConfig.size}
                                        backgroundType={progressBarConfig.backgroundType}
                                        backgroundColor={progressBarConfig.backgroundColor}
                                        backgroundGradient={progressBarConfig.backgroundGradient}
                                        backgroundImage={progressBarConfig.backgroundImage}
                                        fillType={progressBarConfig.fillType}
                                        fillColor={progressBarConfig.fillColor}
                                        fillGradient={progressBarConfig.fillGradient}
                                        fillImage={progressBarConfig.fillImage}
                                        indicatorEnabled={progressBarConfig.indicatorEnabled}
                                        indicatorType={progressBarConfig.indicatorType}
                                        indicatorSize={progressBarConfig.indicatorSize}
                                        indicatorColor={progressBarConfig.indicatorColor}
                                        indicatorImage={progressBarConfig.indicatorImage}
                                        indicatorRotate={progressBarConfig.indicatorRotate}
                                        borderEnabled={progressBarConfig.borderEnabled}
                                        borderColor={progressBarConfig.borderColor}
                                        borderWidth={progressBarConfig.borderWidth}
                                        borderRadius={progressBarConfig.borderRadius}
                                        isPulsing={isCriticalMode}
                                        pulseSpeed={animationConfig?.criticalMode?.effectSpeed || "normal"}
                                    />
                                )}
                                {progressBarConfig.type === 'circular' && (
                                    <ProgressBarCircular
                                        progress={progress}
                                        orientation={progressBarConfig.orientation as any}
                                        position={progressBarConfig.position}
                                        size={progressBarConfig.size}
                                        backgroundType={progressBarConfig.backgroundType}
                                        backgroundColor={progressBarConfig.backgroundColor}
                                        backgroundGradient={progressBarConfig.backgroundGradient}
                                        backgroundImage={progressBarConfig.backgroundImage}
                                        fillType={progressBarConfig.fillType}
                                        fillColor={progressBarConfig.fillColor}
                                        fillGradient={progressBarConfig.fillGradient}
                                        fillImage={progressBarConfig.fillImage}
                                        indicatorEnabled={progressBarConfig.indicatorEnabled}
                                        indicatorType={progressBarConfig.indicatorType}
                                        indicatorSize={progressBarConfig.indicatorSize}
                                        indicatorColor={progressBarConfig.indicatorColor}
                                        indicatorImage={progressBarConfig.indicatorImage}
                                        indicatorRotate={progressBarConfig.indicatorRotate}
                                        borderEnabled={progressBarConfig.borderEnabled}
                                        borderColor={progressBarConfig.borderColor}
                                        borderWidth={progressBarConfig.borderWidth}
                                        borderRadius={progressBarConfig.borderRadius}
                                        isPulsing={isCriticalMode}
                                        pulseSpeed={animationConfig?.criticalMode?.effectSpeed || "normal"}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="bg-[#1e293b] p-3 flex justify-center gap-4 border-t border-[#334155]">
                    <button
                        onClick={onPlayPreview || onTogglePreview}
                        disabled={previewIsRunning}
                        className={`p-2 rounded-full transition-all ${
                            previewIsRunning
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-green-500/30'
                        }`}
                        title="Iniciar"
                    >
                        <Play className="w-5 h-5 fill-current" />
                    </button>
                    <button
                        onClick={onPausePreview || onTogglePreview}
                        disabled={!previewIsRunning}
                        className={`p-2 rounded-full transition-all ${
                            !previewIsRunning
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-yellow-500 hover:bg-yellow-400 text-white shadow-lg hover:shadow-yellow-500/30'
                        }`}
                        title="Pausar"
                    >
                        <Pause className="w-5 h-5 fill-current" />
                    </button>
                    <button
                        onClick={onStopPreview || onResetPreview}
                        className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-full transition-all shadow-lg hover:shadow-red-500/30"
                        title="Reiniciar"
                    >
                        <StopCircle className="w-5 h-5 fill-current" />
                    </button>
                </div>
            </div>

            {/* Inspector (Sin cambios) */}
            <div className="grid grid-cols-2 gap-3">
                <div className={`bg-white dark:bg-[#1B1C1D] p-3 rounded-xl border flex flex-col justify-center transition-colors ${isCriticalMode ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-[#374151]'}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className={`w-3 h-3 ${isCriticalMode ? 'text-red-500' : 'text-blue-500'}`} />
                        <span className={`text-xs font-bold uppercase ${isCriticalMode ? 'text-red-600' : 'text-gray-500'}`}>En Pantalla</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200 truncate" title={timeString}>
                        {timeString}
                    </span>
                </div>
                {/* ... Resto de paneles inspector (sin cambios) ... */}
                <div className="bg-white dark:bg-[#1B1C1D] p-3 rounded-xl border border-gray-200 dark:border-[#374151] flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-3 h-3 text-purple-500" />
                        <span className="text-xs font-bold text-gray-500 uppercase">Progreso</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200">{Math.round(progress)}%</span>
                        <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                </div>
                <div className="col-span-2 bg-white dark:bg-[#1B1C1D] p-3 rounded-xl border border-gray-200 dark:border-[#374151]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                            <Type className="w-3 h-3" /> Fuente
                        </span>
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                            {styleConfig.fontFamily}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                            <Palette className="w-3 h-3" /> Colores
                        </span>
                        <div className="flex gap-1">
                            <div className="w-4 h-4 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: styleConfig.textColor }} title="Texto"></div>
                            <div className="w-4 h-4 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: progressBarConfig.fillColor }} title="Barra"></div>
                            <div className="w-4 h-4 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: progressBarConfig.backgroundColor }} title="Fondo"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimerPreview;