import React, { useEffect, useRef } from 'react';
import type { AlertStyleConfig, AlertAnimationConfig, TimerEventType, AlertMediaConfig } from '../../types/timer-alerts';
import { formatTimeProfessional } from '../../pages/features/timer-extension/utils/timeConversions';

interface EventAlertPreviewProps {
    eventType: TimerEventType;
    userName?: string;
    amount?: number;
    secondsAdded?: number;
    message: string;
    icon?: string;
    customIcon?: string | null;
    media?: AlertMediaConfig; // Nueva prop de media avanzada
    style: AlertStyleConfig;
    animation: AlertAnimationConfig;
    isVisible: boolean;
    position: { x: number; y: number };
    size: { width: number; height: number };
}

/**
 * Componente para preview de alertas de eventos
 * Soporta Video de fondo, Audio independiente e Imágenes superpuestas.
 */
export default function EventAlertPreview({
    eventType,
    userName = 'TestUser',
    amount = 100,
    secondsAdded = 300,
    message,
    icon = '🎉',
    customIcon,
    media,
    style,
    animation,
    isVisible,
    position,
    size
}: EventAlertPreviewProps) {
    // Refs para control de media
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Reemplazar variables en el mensaje
    const processedMessage = message
        .replace('{userName}', userName)
        .replace('{amount}', amount.toString())
        .replace('{time}', formatTimeProfessional(secondsAdded || 0));

    // Extracción segura de media avanzada
    const advancedMedia = media?.mode === 'advanced' ? media.advanced : null;
    
    // Si estamos en modo simple, convertimos al vuelo para usar la misma lógica
    const simpleMedia = media?.mode === 'simple' && media.simple ? media.simple : null;
    
    // Determinar qué mostrar
    const videoSrc = advancedMedia?.video?.url || (simpleMedia?.type === 'video' ? simpleMedia.url : null);
    const videoVol = (advancedMedia?.video?.volume ?? (simpleMedia?.type === 'video' ? simpleMedia.volume : 100)) / 100;
    const videoLoop = advancedMedia?.video?.loop ?? false;

    const audioSrc = advancedMedia?.audio?.url || (simpleMedia?.type === 'audio' ? simpleMedia.url : null);
    const audioVol = (advancedMedia?.audio?.volume ?? (simpleMedia?.type === 'audio' ? simpleMedia.volume : 100)) / 100;
    const audioLoop = advancedMedia?.audio?.loop ?? false;

    const imageSrc = advancedMedia?.image?.url || customIcon;

    // Efecto para controlar reproducción y volumen
    useEffect(() => {
        if (isVisible) {
            if (videoRef.current && videoSrc) {
                videoRef.current.volume = videoVol;
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(e => console.log("Autoplay video blocked", e));
            }
            if (audioRef.current && audioSrc) {
                audioRef.current.volume = audioVol;
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.log("Autoplay audio blocked", e));
            }
        } else {
            // Stop/Pause cuando se oculta
            if (videoRef.current) videoRef.current.pause();
            if (audioRef.current) audioRef.current.pause();
        }
    }, [isVisible, videoSrc, audioSrc, videoVol, audioVol]);

    // Generar estilos CSS
    const containerStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // padding: '20px', // Quitamos padding del contenedor para que el video llene todo
        boxSizing: 'border-box',
        zIndex: 110,
        opacity: isVisible ? (style.opacity / 100) : 0,
        transition: `opacity ${getAnimationDuration(animation.speed)} ease-in-out`,
        pointerEvents: 'none',
        // Fondo (Si hay video, el fondo es transparente o fallback)
        background: videoSrc ? 'transparent' : getBackgroundStyle(style),
        // Bordes
        border: style.borderEnabled ? `${style.borderWidth}px solid ${style.borderColor}` : 'none',
        borderRadius: `${style.borderRadius}px`,
        overflow: 'hidden' // Importante para recortar el video/imagen
    };

    const contentWrapperStyle: React.CSSProperties = {
        position: 'relative',
        zIndex: 2, // Texto encima de media
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px', // Padding interno para el texto
    };

    const textStyle: React.CSSProperties = {
        color: style.textColor,
        fontSize: `${style.fontSize}px`,
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        textShadow: getTextShadowStyle(style.textShadow),
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column', // Icono arriba o al lado según prefieras, columna es más seguro para imgs grandes
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px'
    };

    const mediaBackgroundStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover', // Video llena el contenedor
        zIndex: 0,
        opacity: 1
    };

    const imageOverlayStyle: React.CSSProperties = {
        // Si es "Imagen Overlay", ¿la ponemos de fondo o como icono grande?
        // El diseño "Avanzado" suele usar la imagen como contenido principal visual.
        // La pondremos como elemento visual principal pero detrás del texto si es background, 
        // o como elemento inline si es pequeña. 
        // Para máxima flexibilidad en este modo, si hay video, la imagen flota.
        // Si NO hay video, la imagen puede actuar como fondo o icono.
        // Asumiremos comportamiento de "Icono Grande" o "Imagen Principal"
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
        marginBottom: '10px',
        zIndex: 2
    };

    return (
        <div style={containerStyle}>
            {/* VIDEO BACKGROUND */}
            {videoSrc && (
                <video
                    ref={videoRef}
                    src={videoSrc}
                    style={mediaBackgroundStyle}
                    loop={videoLoop}
                    muted={videoVol === 0} // Mute real si volumen es 0
                />
            )}

            {/* AUDIO HIDDEN */}
            {audioSrc && (
                <audio
                    ref={audioRef}
                    src={audioSrc}
                    loop={audioLoop}
                />
            )}

            {/* CONTENT */}
            <div style={contentWrapperStyle}>
                <div style={textStyle}>
                    {/* IMAGEN / ICONO */}
                    {imageSrc ? (
                        <img
                            src={imageSrc}
                            alt="alert visual"
                            style={{
                                width: videoSrc ? '150px' : 'auto', // Si hay video, limitamos tamaño
                                maxHeight: videoSrc ? '150px' : '200px',
                                objectFit: 'contain'
                            }}
                        />
                    ) : (
                        <span style={{ fontSize: `${style.fontSize * 1.5}px` }}>{icon}</span>
                    )}
                    
                    {/* TEXTO */}
                    <span>{processedMessage}</span>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Genera el estilo de fondo según la configuración
 */
function getBackgroundStyle(style: AlertStyleConfig): string {
    switch (style.backgroundType) {
        case 'color':
            return style.backgroundColor;

        case 'gradient':
            return `linear-gradient(${style.gradient.angle}deg, ${style.gradient.color1}, ${style.gradient.color2})`;

        case 'image':
        case 'gif':
            return style.backgroundImage
                ? `url(${style.backgroundImage})`
                : style.backgroundColor;

        default:
            return style.backgroundColor;
    }
}

/**
 * Genera el estilo de sombra de texto
 */
function getTextShadowStyle(shadow: string): string {
    switch (shadow) {
        case 'none':
            return 'none';
        case 'normal':
            return '2px 2px 4px rgba(0, 0, 0, 0.5)';
        case 'strong':
            return '3px 3px 6px rgba(0, 0, 0, 0.8)';
        case 'glow':
            return '0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(255, 255, 255, 0.5)';
        default:
            return 'none';
    }
}

/**
 * Obtiene la duración de la animación
 */
function getAnimationDuration(speed: string): string {
    switch (speed) {
        case 'slow':
            return '1.2s';
        case 'fast':
            return '0.5s';
        case 'normal':
        default:
            return '0.8s';
    }
}

