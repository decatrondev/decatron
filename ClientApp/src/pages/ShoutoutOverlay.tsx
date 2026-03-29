import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';

interface TextLine {
    text: string;
    fontSize: number;
    fontWeight: string;
    enabled: boolean;
}

interface StyleConfig {
    fontFamily: string;
    textColor: string;
    textShadow: 'none' | 'normal' | 'strong' | 'glow';
    backgroundType: 'gradient' | 'solid' | 'transparent';
    gradientColor1: string;
    gradientColor2: string;
    gradientAngle: number;
    solidColor: string;
    backgroundOpacity: number;
}

interface LayoutConfig {
    clip: { x: number; y: number; width: number; height: number };
    text: { x: number; y: number; align: string };
    profile: { x: number; y: number; size: number };
}

interface ShoutoutData {
    targetUser: string;
    clipUrl?: string;
    gameName?: string;
    profileImageUrl?: string;
}

export default function ShoutoutOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';

    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [shoutoutData, setShoutoutData] = useState<ShoutoutData | null>(null);
    const [duration, setDuration] = useState(10);
    const [showDebugTimer, setShowDebugTimer] = useState(false);
    const [remainingTime, setRemainingTime] = useState(0);

    // Animation & Effects state
    const [animationType, setAnimationType] = useState('none');
    const [animationSpeed, setAnimationSpeed] = useState('normal');
    const [textOutlineEnabled, setTextOutlineEnabled] = useState(false);
    const [textOutlineColor, setTextOutlineColor] = useState('#000000');
    const [textOutlineWidth, setTextOutlineWidth] = useState(2);
    const [containerBorderEnabled, setContainerBorderEnabled] = useState(false);
    const [containerBorderColor, setContainerBorderColor] = useState('#ffffff');
    const [containerBorderWidth, setContainerBorderWidth] = useState(3);
    const [textLines, setTextLines] = useState<TextLine[]>([
        { text: '🔥 ¡Sigan a @username! 🔥', fontSize: 32, fontWeight: 'bold', enabled: true },
        { text: 'Jugando: @game', fontSize: 24, fontWeight: '600', enabled: true }
    ]);
    const [styles, setStyles] = useState<StyleConfig>({
        fontFamily: 'Inter',
        textColor: '#ffffff',
        textShadow: 'normal',
        backgroundType: 'gradient',
        gradientColor1: '#667eea',
        gradientColor2: '#764ba2',
        gradientAngle: 135,
        solidColor: '#8b5cf6',
        backgroundOpacity: 100
    });
    const [layout, setLayout] = useState<LayoutConfig>({
        clip: { x: 20, y: 20, width: 400, height: 260 },
        text: { x: 699, y: 82, align: 'center' },
        profile: { x: 660, y: 173, size: 90 }
    });

    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const durationRef = useRef(10); // Ref para capturar el valor actual de duration en callbacks
    const intervalRef = useRef<NodeJS.Timeout | null>(null); // Ref para limpiar interval anterior
    const timeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref para limpiar timeout anterior
    const videoRef = useRef<HTMLVideoElement | null>(null); // Ref para controlar el video

    useEffect(() => {
        loadConfiguration();
        setupSignalRConnection();

        return () => {
            if (connectionRef.current) {
                connectionRef.current.stop();
            }
        };
    }, [channel]);

    const loadConfiguration = async () => {
        if (!channel) {
            console.warn('No channel specified, using default configuration');
            return;
        }

        try {
            console.log(`Cargando configuración para canal: ${channel}`);
            const res = await fetch(`/api/shoutout/config/overlay/${channel}`);
            if (res.ok) {
                const data = await res.json();
                console.log('Configuración cargada:', data);
                if (data.success && data.config) {
                    const config = data.config;
                    const newDuration = config.duration || 10;
                    setDuration(newDuration);
                    durationRef.current = newDuration; // Actualizar ref para callbacks
                    setShowDebugTimer(config.showDebugTimer || false);

                    // Animation & Effects
                    setAnimationType(config.animationType || 'none');
                    setAnimationSpeed(config.animationSpeed || 'normal');
                    setTextOutlineEnabled(config.textOutlineEnabled || false);
                    setTextOutlineColor(config.textOutlineColor || '#000000');
                    setTextOutlineWidth(config.textOutlineWidth || 2);
                    setContainerBorderEnabled(config.containerBorderEnabled || false);
                    setContainerBorderColor(config.containerBorderColor || '#ffffff');
                    setContainerBorderWidth(config.containerBorderWidth || 3);

                    if (config.textLines) setTextLines(config.textLines);
                    if (config.styles) setStyles(prev => ({ ...prev, ...config.styles }));
                    if (config.layout) setLayout(prev => ({ ...prev, ...config.layout }));
                }
            } else {
                console.error('Error en respuesta del servidor:', res.status);
            }
        } catch (err) {
            console.error('Error loading overlay config:', err);
        }
    };

    const setupSignalRConnection = async () => {
        if (!channel) {
            return;
        }

        try {
            // Usar el origen actual para que funcione tanto en dev como en producción
            const hubUrl = `${window.location.origin}/hubs/overlay`;
            const connection = new signalR.HubConnectionBuilder()
                .withUrl(hubUrl, {
                    withCredentials: false
                })
                .withAutomaticReconnect()
                .configureLogging(signalR.LogLevel.Information)
                .build();

            // CRÍTICO: Configurar listeners ANTES de conectar
            connection.on('ShowShoutout', (data) => {
                showShoutout({
                    targetUser: data.targetUser,
                    gameName: data.gameName,
                    clipUrl: data.clipUrl,
                    profileImageUrl: data.profileImageUrl
                });
            });

            connection.on('ConfigurationChanged', () => {
                loadConfiguration();
            });

            // Handler para cuando SignalR se reconecta automáticamente
            connection.onreconnected(async (connectionId) => {
                try {
                    // Recargar configuración para obtener fuente y estilos actualizados
                    await loadConfiguration();

                    // Re-unirse al grupo del canal
                    await connection.invoke('JoinChannel', channel);
                } catch (err) {
                    console.error('❌ [SHOUTOUT] Error al re-unirse al canal:', err);
                }
            });

            // Handler para cuando se está reconectando
            connection.onreconnecting((error) => {
            });

            // Handler para cuando se cierra la conexión
            connection.onclose((error) => {
                setTimeout(setupSignalRConnection, 5000);
            });

            await connection.start();
            // Unirse al grupo del canal
            await connection.invoke('JoinChannel', channel);

            connectionRef.current = connection;
        } catch (err) {
            // Reintentar después de 5 segundos
            setTimeout(setupSignalRConnection, 5000);
        }
    };

    const showShoutout = (data: ShoutoutData) => {
        const currentDuration = durationRef.current; // Usar el valor actual del ref

        // Limpiar timers anteriores si existen
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        setShoutoutData(data);
        setIsVisible(true);
        setIsExiting(false); // Reset exiting state
        setRemainingTime(currentDuration);

        // Countdown timer
        intervalRef.current = setInterval(() => {
            setRemainingTime((prev) => {
                if (prev <= 1) {
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Timeout máximo - cierra el shoutout si el tiempo configurado se cumple
        timeoutRef.current = setTimeout(() => {
            console.log('⏰ Tiempo máximo alcanzado, cerrando shoutout');
            closeShoutout();
        }, currentDuration * 1000);
    };

    // Función centralizada para cerrar el shoutout
    const closeShoutout = () => {
        // Evitar cerrar múltiples veces
        if (isExiting || !isVisible) return;

        // Limpiar timers
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        // Pausar video inmediatamente para que no siga sonando
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }

        // Activar animación de salida
        setIsExiting(true);

        // Esperar a que la animación de salida termine antes de ocultar
        const exitAnimationDuration = getAnimationDurationMs();
        setTimeout(() => {
            setIsVisible(false);
            setIsExiting(false);
            setShoutoutData(null);
            setRemainingTime(0);
        }, exitAnimationDuration);
    };

    // Cuando el clip termina (si dura menos que el tiempo configurado)
    const handleVideoEnded = () => {
        closeShoutout();
    };

    const hexToRgba = (hex: string, alpha: number): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const getBackgroundStyle = (): React.CSSProperties => {
        const opacity = styles.backgroundOpacity / 100;

        if (styles.backgroundType === 'transparent') {
            return { background: 'transparent' };
        } else if (styles.backgroundType === 'solid') {
            return {
                background: hexToRgba(styles.solidColor, opacity)
            };
        } else {
            // Para gradientes, necesitamos aplicar la opacidad a cada color
            const color1 = hexToRgba(styles.gradientColor1, opacity);
            const color2 = hexToRgba(styles.gradientColor2, opacity);
            return {
                background: `linear-gradient(${styles.gradientAngle}deg, ${color1}, ${color2})`
            };
        }
    };

    const getAnimationName = (entering: boolean): string => {
        if (animationType === 'none') return entering ? 'fadeIn' : 'fadeOut';
        if (animationType === 'slide') return entering ? 'slideIn' : 'slideOut';
        if (animationType === 'bounce') return entering ? 'bounceIn' : 'bounceOut';
        if (animationType === 'fade') return entering ? 'fadeIn' : 'fadeOut';
        if (animationType === 'zoom') return entering ? 'zoomIn' : 'zoomOut';
        if (animationType === 'rotate') return entering ? 'rotateIn' : 'rotateOut';
        return entering ? 'fadeIn' : 'fadeOut';
    };

    const getAnimationDuration = (): string => {
        if (animationSpeed === 'slow') return '1s';
        if (animationSpeed === 'fast') return '0.3s';
        return '0.5s'; // normal
    };

    const getAnimationDurationMs = (): number => {
        if (animationSpeed === 'slow') return 1000;
        if (animationSpeed === 'fast') return 300;
        return 500; // normal
    };

    const getTextOutlineStyle = (): React.CSSProperties => {
        if (!textOutlineEnabled) return {};
        return {
            WebkitTextStroke: `${textOutlineWidth}px ${textOutlineColor}`,
            paintOrder: 'stroke fill'
        };
    };

    const getTextShadowStyle = (shadow: string): string => {
        switch (shadow) {
            case 'normal': return '2px 2px 4px rgba(0,0,0,0.5)';
            case 'strong': return '3px 3px 6px rgba(0,0,0,0.8)';
            case 'glow': return '0 0 10px rgba(255,255,255,0.8)';
            default: return 'none';
        }
    };

    const replaceVariables = (text: string): string => {
        if (!shoutoutData) return text;
        return text
            .replace('@username', shoutoutData.targetUser)
            .replace('@game', shoutoutData.gameName || 'Sin categoría');
    };

    return (
        <div
            style={{
                width: '1000px',
                height: '300px',
                overflow: 'hidden',
                position: 'relative',
                fontFamily: styles.fontFamily
            }}
        >
            {/* Shoutout Box */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: (isVisible || isExiting) ? 'block' : 'none',
                    borderRadius: '20px',
                    border: containerBorderEnabled ? `${containerBorderWidth}px solid ${containerBorderColor}` : 'none',
                    boxShadow: containerBorderEnabled ? '0 8px 24px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(0, 0, 0, 0.2)',
                    ...getBackgroundStyle(),
                    animation: !isExiting
                        ? `${getAnimationName(true)} ${getAnimationDuration()} ease-in-out`
                        : `${getAnimationName(false)} ${getAnimationDuration()} ease-in-out`
                }}
            >
                {/* Clip Video Element */}
                {shoutoutData?.clipUrl && (
                    <video
                        ref={videoRef}
                        key={shoutoutData.clipUrl}
                        autoPlay
                        playsInline
                        style={{
                            position: 'absolute',
                            left: `${layout.clip.x}px`,
                            top: `${layout.clip.y}px`,
                            width: `${layout.clip.width}px`,
                            height: `${layout.clip.height}px`,
                            borderRadius: '12px',
                            objectFit: 'cover',
                            backgroundColor: '#000',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                        }}
                        onError={(e) => console.error('Error cargando video:', e)}
                        onLoadedData={() => console.log('Video cargado:', shoutoutData.clipUrl)}
                        onEnded={handleVideoEnded}
                    >
                        <source src={shoutoutData.clipUrl} type="video/mp4" />
                    </video>
                )}

                {/* Profile Image */}
                {shoutoutData?.profileImageUrl && (
                    <div
                        style={{
                            position: 'absolute',
                            left: `${layout.profile.x}px`,
                            top: `${layout.profile.y}px`,
                            width: `${layout.profile.size}px`,
                            height: `${layout.profile.size}px`,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '4px solid rgba(255, 255, 255, 0.4)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                        }}
                    >
                        <img
                            src={shoutoutData.profileImageUrl}
                            alt={shoutoutData.targetUser}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                    </div>
                )}

                {/* Debug Timer */}
                {showDebugTimer && isVisible && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            color: '#fff',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontSize: '20px',
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            border: '2px solid rgba(255,255,255,0.3)',
                            zIndex: 9999
                        }}
                    >
                        ⏱️ {remainingTime}s
                    </div>
                )}

                {/* Text Lines */}
                <div
                    style={{
                        position: 'absolute',
                        left: `${layout.text.x}px`,
                        top: `${layout.text.y}px`,
                        textAlign: (layout.text.align as 'left' | 'center' | 'right'),
                        transform: layout.text.align === 'center' ? 'translateX(-50%)' : 'none'
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {textLines.filter(l => l.enabled).map((line, idx) => (
                            <p
                                key={idx}
                                style={{
                                    fontSize: `${line.fontSize}px`,
                                    fontWeight: line.fontWeight,
                                    color: styles.textColor,
                                    textShadow: getTextShadowStyle(styles.textShadow),
                                    fontFamily: styles.fontFamily,
                                    margin: 0,
                                    lineHeight: 1.2,
                                    whiteSpace: 'nowrap',
                                    ...getTextOutlineStyle()
                                }}
                            >
                                {replaceVariables(line.text)}
                            </p>
                        ))}
                    </div>
                </div>
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                @keyframes fadeOut {
                    from {
                        opacity: 1;
                        transform: scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(-100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes slideOut {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }

                @keyframes bounceIn {
                    0% {
                        opacity: 0;
                        transform: scale(0.3);
                    }
                    50% {
                        opacity: 1;
                        transform: scale(1.05);
                    }
                    70% {
                        transform: scale(0.9);
                    }
                    100% {
                        transform: scale(1);
                    }
                }

                @keyframes bounceOut {
                    0% {
                        transform: scale(1);
                    }
                    50% {
                        opacity: 1;
                        transform: scale(1.1);
                    }
                    100% {
                        opacity: 0;
                        transform: scale(0.3);
                    }
                }

                @keyframes zoomIn {
                    from {
                        opacity: 0;
                        transform: scale(0);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                @keyframes zoomOut {
                    from {
                        opacity: 1;
                        transform: scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: scale(0);
                    }
                }

                @keyframes rotateIn {
                    from {
                        opacity: 0;
                        transform: rotate(-200deg) scale(0);
                    }
                    to {
                        opacity: 1;
                        transform: rotate(0) scale(1);
                    }
                }

                @keyframes rotateOut {
                    from {
                        opacity: 1;
                        transform: rotate(0) scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: rotate(200deg) scale(0);
                    }
                }
            `}</style>
        </div>
    );
}
