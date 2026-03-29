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
    media: { x: number; y: number; width: number; height: number };
    text: { x: number; y: number; align: string };
}

interface SoundAlertData {
    type: string;
    redeemer: string;
    reward: string;
    fileUrl?: string;
    fileType: 'sound' | 'video' | 'image';
    imageUrl?: string; // Imagen opcional para archivos de audio
    volume: number;
    duration: number;
    textLines: string;
    styles: string;
    layout: string;
    animation: {
        type: string;
        speed: string;
    };
    textOutline: {
        enabled: boolean;
        color: string;
        width: number;
    };
}

export default function SoundAlertsOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';

    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [alertData, setAlertData] = useState<SoundAlertData | null>(null);
    const [duration, setDuration] = useState(10);
    const [globalVolume, setGlobalVolume] = useState(70);

    // Animation & Effects state
    const [animationType, setAnimationType] = useState('fade');
    const [animationSpeed, setAnimationSpeed] = useState('normal');
    const [textOutlineEnabled, setTextOutlineEnabled] = useState(false);
    const [textOutlineColor, setTextOutlineColor] = useState('#000000');
    const [textOutlineWidth, setTextOutlineWidth] = useState(2);
    const [textLines, setTextLines] = useState<TextLine[]>([
        { text: '@redeemer canjeó @reward', fontSize: 24, fontWeight: 'bold', enabled: true },
        { text: '¡Gracias por el apoyo!', fontSize: 18, fontWeight: '600', enabled: true }
    ]);
    const [styles, setStyles] = useState<StyleConfig>({
        fontFamily: 'Inter',
        textColor: '#ffffff',
        textShadow: 'normal',
        backgroundType: 'transparent',
        gradientColor1: '#667eea',
        gradientColor2: '#764ba2',
        gradientAngle: 135,
        solidColor: '#8b5cf6',
        backgroundOpacity: 100
    });
    const [layout, setLayout] = useState<LayoutConfig>({
        media: { x: 100, y: 20, width: 200, height: 200 },
        text: { x: 200, y: 300, align: 'center' }
    });

    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const durationRef = useRef(10);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout de seguridad
    const timerStartedRef = useRef(false); // Flag para evitar múltiples llamadas a startExitTimer
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [autoplayUnlocked, setAutoplayUnlocked] = useState(false);

    // Desbloquear autoplay con el primer clic
    useEffect(() => {
        const unlockAutoplay = () => {
            if (!autoplayUnlocked) {
                setAutoplayUnlocked(true);

                // Intentar reproducir si hay media esperando
                if (videoRef.current && videoRef.current.paused) {
                    videoRef.current.play().catch(() => {});
                }
                if (audioRef.current && audioRef.current.paused) {
                    audioRef.current.play().catch(() => {});
                }
            }
        };

        document.addEventListener('click', unlockAutoplay, { once: true });
        document.addEventListener('touchstart', unlockAutoplay, { once: true });
        document.addEventListener('keydown', unlockAutoplay, { once: true });

        return () => {
            document.removeEventListener('click', unlockAutoplay);
            document.removeEventListener('touchstart', unlockAutoplay);
            document.removeEventListener('keydown', unlockAutoplay);
        };
    }, [autoplayUnlocked]);

    // Aplicar volumen cuando cambie
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = globalVolume / 100;
        }
        if (videoRef.current) {
            videoRef.current.volume = globalVolume / 100;
        }
    }, [globalVolume]);

    useEffect(() => {
        loadConfiguration();
        setupSignalRConnection();

        return () => {
            if (connectionRef.current) {
                connectionRef.current.stop();
            }
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (videoRef.current) {
                videoRef.current.pause();
            }
        };
    }, [channel]);

    const loadConfiguration = async () => {
        if (!channel) {
            console.warn('No channel specified, using default configuration');
            return;
        }

        try {
            const res = await fetch(`/api/soundalerts/config/overlay/${channel}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.config) {
                    const config = data.config;
                    const newDuration = config.duration || 10;
                    setDuration(newDuration);
                    durationRef.current = newDuration;
                    setGlobalVolume(config.globalVolume || 70);

                    // Animation & Effects
                    setAnimationType(config.animationType || 'fade');
                    setAnimationSpeed(config.animationSpeed || 'normal');
                    setTextOutlineEnabled(config.textOutlineEnabled || false);
                    setTextOutlineColor(config.textOutlineColor || '#000000');
                    setTextOutlineWidth(config.textOutlineWidth || 2);

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
            console.warn('❌ [SOUNDALERT] No channel specified for SignalR connection');
            return;
        }

        try {
            const hubUrl = `${window.location.origin}/hubs/overlay`;
            const connection = new signalR.HubConnectionBuilder()
                .withUrl(hubUrl, {
                    withCredentials: false
                })
                .withAutomaticReconnect()
                .configureLogging(signalR.LogLevel.Information)
                .build();

            // CRÍTICO: Configurar listeners ANTES de conectar
            connection.on('ShowSoundAlert', (data) => {

                // Aplicar configuración del evento
                if (data.textLines) {
                    try {
                        const parsedTextLines = typeof data.textLines === 'string'
                            ? JSON.parse(data.textLines)
                            : data.textLines;
                        setTextLines(parsedTextLines);
                    } catch (e) {
                        console.error('Error parsing textLines:', e);
                    }
                }

                if (data.styles) {
                    try {
                        const parsedStyles = typeof data.styles === 'string'
                            ? JSON.parse(data.styles)
                            : data.styles;
                        setStyles(prev => ({ ...prev, ...parsedStyles }));
                    } catch (e) {
                        console.error('Error parsing styles:', e);
                    }
                }

                if (data.layout) {
                    try {
                        const parsedLayout = typeof data.layout === 'string'
                            ? JSON.parse(data.layout)
                            : data.layout;
                        setLayout(prev => ({ ...prev, ...parsedLayout }));
                    } catch (e) {
                        console.error('Error parsing layout:', e);
                    }
                }

                if (data.animation) {
                    setAnimationType(data.animation.type || 'fade');
                    setAnimationSpeed(data.animation.speed || 'normal');
                }

                if (data.textOutline) {
                    setTextOutlineEnabled(data.textOutline.enabled || false);
                    setTextOutlineColor(data.textOutline.color || '#000000');
                    setTextOutlineWidth(data.textOutline.width || 2);
                }

                if (data.volume !== undefined) {
                    setGlobalVolume(data.volume);
                }

                if (data.duration !== undefined) {
                    setDuration(data.duration);
                    durationRef.current = data.duration;
                }

                showSoundAlert(data);
            });

            // Ignorar mensajes del timer para evitar warnings en consola
            connection.on('TimerTick', () => {});
            connection.on('TimerStateUpdate', () => {});
            connection.on('TimerEventAlert', () => {});

            connection.on('ConfigurationChanged', () => {
                loadConfiguration();
            });

            connection.onreconnected(async (connectionId) => {
                try {
                    await loadConfiguration();
                    await connection.invoke('JoinChannel', channel);
                } catch (err) {
                    console.error('❌ [SOUNDALERT] Error al re-unirse al canal:', err);
                }
            });

            // Handler para cuando se está reconectando
            connection.onreconnecting((error) => {
                console.warn(`⚠️ [SOUNDALERT] SignalR intentando reconectar... Error: ${error?.message || 'Unknown'}`);
            });

            // Handler para cuando se cierra la conexión
            connection.onclose((error) => {
                console.error(`❌ [SOUNDALERT] SignalR desconectado. Error: ${error?.message || 'Unknown'}`);
                setTimeout(setupSignalRConnection, 5000);
            });

            await connection.start();

            await connection.invoke('JoinChannel', channel);

            connectionRef.current = connection;
        } catch (err) {
            console.error('❌ [SOUNDALERT] Error conectando SignalR:', err);
            setTimeout(setupSignalRConnection, 5000);
        }
    };

    const showSoundAlert = (data: SoundAlertData) => {
        const currentDuration = durationRef.current;

        // Limpiar TODOS los timeouts anteriores
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (cleanupTimeoutRef.current) {
            clearTimeout(cleanupTimeoutRef.current);
            cleanupTimeoutRef.current = null;
        }
        if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
        }

        // Resetear el flag del timer
        timerStartedRef.current = false;

        // Pausar audio/video anterior si existe
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }

        setAlertData(data);
        setIsVisible(true);
        setIsExiting(false);

        // Timeout de seguridad: limpiar automáticamente después de 30 segundos
        safetyTimeoutRef.current = setTimeout(() => {
            console.warn('⚠️ [SEGURIDAD] Overlay pegado detectado - Forzando limpieza después de 30s');
            forceCleanup();
        }, 30000);

        // NOTA: El timeout se configura en onPlay cuando el archivo empiece a reproducirse
        // Si no hay archivo de audio/video, se usa la duración configurada
        if (data.fileType === 'image' || !data.fileUrl) {
            startExitTimer(currentDuration);
        }
    };

    const forceCleanup = () => {
        // Limpiar todos los timeouts
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (cleanupTimeoutRef.current) {
            clearTimeout(cleanupTimeoutRef.current);
            cleanupTimeoutRef.current = null;
        }
        if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
        }

        // Detener y limpiar medios
        if (audioRef.current) {
            try {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current.src = '';
                audioRef.current.load();
            } catch (e) {
                console.error('Error en limpieza forzada de audio:', e);
            }
        }
        if (videoRef.current) {
            try {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
                videoRef.current.src = '';
                videoRef.current.load();
            } catch (e) {
                console.error('Error en limpieza forzada de video:', e);
            }
        }

        // Resetear estados
        setAlertData(null);
        setIsVisible(false);
        setIsExiting(false);
        timerStartedRef.current = false;

    };

    const startExitTimer = (durationInSeconds: number) => {
        // Evitar múltiples llamadas - solo iniciar el timer una vez por alerta
        if (timerStartedRef.current) {
            return;
        }

        timerStartedRef.current = true;

        // Limpiar timeouts anteriores si existen
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (cleanupTimeoutRef.current) {
            clearTimeout(cleanupTimeoutRef.current);
            cleanupTimeoutRef.current = null;
        }

        // Cuando expire el tiempo, iniciar animación de salida
        timeoutRef.current = setTimeout(() => {

            // Pausar medios inmediatamente
            if (audioRef.current) {
                try {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                    audioRef.current.volume = 0; // Silenciar inmediatamente
                } catch (e) {
                    console.error('Error pausando audio:', e);
                }
            }
            if (videoRef.current) {
                try {
                    videoRef.current.pause();
                    videoRef.current.currentTime = 0;
                    videoRef.current.volume = 0; // Silenciar inmediatamente
                } catch (e) {
                    console.error('Error pausando video:', e);
                }
            }

            setIsExiting(true);

            // Esperar a que la animación de salida termine + un pequeño buffer
            const exitAnimationDuration = getAnimationDurationMs();
            const cleanupDelay = exitAnimationDuration + 100; // +100ms buffer para asegurar que la animación termine

            cleanupTimeoutRef.current = setTimeout(() => {

                // Cancelar timeout de seguridad ya que la limpieza normal se ejecutó
                if (safetyTimeoutRef.current) {
                    clearTimeout(safetyTimeoutRef.current);
                    safetyTimeoutRef.current = null;
                }

                // Detener y limpiar completamente audio/video
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                    audioRef.current.src = '';
                    audioRef.current.load(); // Forzar descarga del recurso
                }
                if (videoRef.current) {
                    videoRef.current.pause();
                    videoRef.current.currentTime = 0;
                    videoRef.current.src = '';
                    videoRef.current.load();
                }

                // IMPORTANTE: Limpiar alertData DESPUÉS de detener medios
                setAlertData(null);
                setIsVisible(false);
                setIsExiting(false);

                // Limpiar refs de timeout
                timeoutRef.current = null;
                cleanupTimeoutRef.current = null;
                timerStartedRef.current = false;

            }, cleanupDelay);
        }, durationInSeconds * 1000);
    };

    const getBackgroundStyle = (): React.CSSProperties => {
        if (styles.backgroundType === 'transparent') {
            return { background: 'transparent' };
        } else if (styles.backgroundType === 'solid') {
            return {
                background: styles.solidColor,
                opacity: styles.backgroundOpacity / 100
            };
        } else {
            return {
                background: `linear-gradient(${styles.gradientAngle}deg, ${styles.gradientColor1}, ${styles.gradientColor2})`,
                opacity: styles.backgroundOpacity / 100
            };
        }
    };

    const getAnimationName = (entering: boolean): string => {
        if (animationType === 'none') return entering ? 'fadeIn' : 'fadeOut';
        if (animationType === 'slide') return entering ? 'slideIn' : 'slideOut';
        if (animationType === 'bounce') return entering ? 'bounceIn' : 'bounceOut';
        if (animationType === 'fade') return entering ? 'fadeIn' : 'fadeOut';
        if (animationType === 'zoom') return entering ? 'zoomIn' : 'zoomOut';
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
        if (!alertData) return text;
        return text
            .replace('@redeemer', alertData.redeemer)
            .replace('@reward', alertData.reward);
    };

    return (
        <div
            style={{
                width: '400px',
                height: '450px',
                overflow: 'hidden',
                position: 'relative',
                fontFamily: styles.fontFamily
            }}
        >
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @keyframes slideIn {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(0); }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); }
                    to { transform: translateX(-100%); }
                }
                @keyframes bounceIn {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes bounceOut {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(0); opacity: 0; }
                }
                @keyframes zoomIn {
                    from { transform: scale(0); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes zoomOut {
                    from { transform: scale(1); opacity: 1; }
                    to { transform: scale(0); opacity: 0; }
                }
            `}</style>

            {/* Sound Alert Box */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: alertData ? 'block' : 'none', // Solo mostrar si hay datos de alerta
                    borderRadius: '20px',
                    ...getBackgroundStyle(),
                    animation: !isExiting
                        ? `${getAnimationName(true)} ${getAnimationDuration()} ease-in-out`
                        : `${getAnimationName(false)} ${getAnimationDuration()} ease-in-out`
                }}
            >
                {/* Media Element */}
                {alertData?.fileUrl && (
                    <>
                        {/* Audio */}
                        {alertData.fileType === 'sound' && (
                            <>
                                <audio
                                    ref={audioRef}
                                    key={alertData.fileUrl}
                                    autoPlay
                                    style={{ display: 'none' }}
                                    onError={(e) => console.error('Error cargando audio:', e)}
                                    onLoadedData={() => {}}
                                    onCanPlay={() => {
                                        // Intentar reproducir cuando el audio esté listo
                                        if (audioRef.current && audioRef.current.paused) {
                                            audioRef.current.play().catch((err) => {
                                                console.error('Autoplay blocked:', err);
                                            });
                                        }
                                    }}
                                    onLoadedMetadata={() => {
                                        if (audioRef.current) {
                                            audioRef.current.volume = globalVolume / 100;
                                        }
                                    }}
                                    onPlay={() => {
                                        // Iniciar timer cuando realmente empiece a reproducirse
                                        if (audioRef.current && !timerStartedRef.current) {
                                            const audioDuration = audioRef.current.duration;
                                            if (audioDuration && !isNaN(audioDuration) && isFinite(audioDuration)) {
                                                startExitTimer(audioDuration);
                                            } else {
                                                // Audio duration not available, using configured duration
                                                startExitTimer(durationRef.current);
                                            }
                                        }
                                    }}
                                    onEnded={() => {
                                        // No hacer nada aquí, el timer ya manejará la limpieza
                                    }}
                                >
                                    <source src={alertData.fileUrl} type="audio/mpeg" />
                                </audio>

                                {/* Visualización para audio */}
                                {alertData.imageUrl ? (
                                    /* Imagen asociada al audio */
                                    <img
                                        src={alertData.imageUrl}
                                        alt="Audio visualization"
                                        style={{
                                            position: 'absolute',
                                            left: `${layout.media.x}px`,
                                            top: `${layout.media.y}px`,
                                            width: `${layout.media.width}px`,
                                            height: `${layout.media.height}px`,
                                            borderRadius: '12px',
                                            objectFit: 'cover'
                                        }}
                                        onError={(e) => console.error('Error cargando imagen:', e)}
                                    />
                                ) : (
                                    /* Icono por defecto si no hay imagen */
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: `${layout.media.x}px`,
                                            top: `${layout.media.y}px`,
                                            width: `${layout.media.width}px`,
                                            height: `${layout.media.height}px`,
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '120px'
                                        }}
                                    >
                                        🎵
                                    </div>
                                )}
                            </>
                        )}

                        {/* Video */}
                        {alertData.fileType === 'video' && (
                            <video
                                ref={videoRef}
                                key={alertData.fileUrl}
                                autoPlay
                                playsInline
                                muted={false}
                                style={{
                                    position: 'absolute',
                                    left: `${layout.media.x}px`,
                                    top: `${layout.media.y}px`,
                                    width: `${layout.media.width}px`,
                                    height: `${layout.media.height}px`,
                                    borderRadius: '12px',
                                    objectFit: 'cover',
                                    backgroundColor: '#000'
                                }}
                                onError={(e) => console.error('Error cargando video:', e)}
                                onLoadedData={() => {}}
                                onCanPlay={() => {
                                    // Intentar reproducir cuando el video esté listo
                                    if (videoRef.current && videoRef.current.paused) {
                                        videoRef.current.play().catch((err) => {
                                            console.error('Autoplay blocked:', err);
                                        });
                                    }
                                }}
                                onLoadedMetadata={() => {
                                    if (videoRef.current) {
                                        videoRef.current.volume = globalVolume / 100;
                                    }
                                }}
                                onPlay={() => {
                                    // Iniciar timer cuando realmente empiece a reproducirse
                                    if (videoRef.current && !timerStartedRef.current) {
                                        const videoDuration = videoRef.current.duration;
                                        if (videoDuration && !isNaN(videoDuration) && isFinite(videoDuration)) {
                                            startExitTimer(videoDuration);
                                        } else {
                                            startExitTimer(durationRef.current);
                                        }
                                    }
                                }}
                                onEnded={() => {
                                    // Timer handles cleanup
                                }}
                            >
                                <source src={alertData.fileUrl} type="video/mp4" />
                            </video>
                        )}

                        {/* Image */}
                        {alertData.fileType === 'image' && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: `${layout.media.x}px`,
                                    top: `${layout.media.y}px`,
                                    width: `${layout.media.width}px`,
                                    height: `${layout.media.height}px`,
                                    borderRadius: '12px',
                                    overflow: 'hidden'
                                }}
                            >
                                <img
                                    src={alertData.fileUrl}
                                    alt="Sound Alert"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                    onError={(e) => console.error('Error cargando imagen:', e)}
                                    onLoad={() => {}}
                                />
                            </div>
                        )}
                    </>
                )}

                {/* Text Lines */}
                <div
                    style={{
                        position: 'absolute',
                        left: `${layout.text.x}px`,
                        top: `${layout.text.y}px`,
                        textAlign: layout.text.align as 'left' | 'center' | 'right',
                        transform: layout.text.align === 'center'
                            ? 'translate(-50%, -50%)'
                            : layout.text.align === 'right'
                                ? 'translate(-100%, -50%)'
                                : 'translate(0, -50%)',
                        maxWidth: '80%'
                    }}
                >
                    {textLines.filter(l => l.enabled).map((line, idx) => (
                        <div
                            key={idx}
                            style={{
                                fontSize: `${line.fontSize}px`,
                                fontWeight: line.fontWeight,
                                color: styles.textColor,
                                textShadow: getTextShadowStyle(styles.textShadow),
                                fontFamily: styles.fontFamily,
                                margin: '8px 0',
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
                                ...getTextOutlineStyle()
                            }}
                        >
                            {replaceVariables(line.text)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
