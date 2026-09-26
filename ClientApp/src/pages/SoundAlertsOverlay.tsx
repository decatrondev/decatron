import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import SoundAlertRenderer from './features/sound-alerts-extension/components/SoundAlertRenderer';
import { normalizeDesign } from './features/sound-alerts-extension/model';
import { ALERT_KEYFRAMES, alertAnimation, animationDurationMs } from './features/sound-alerts-extension/animations';
import type { AlertContent, AlertDesign } from './features/sound-alerts-extension/types';

interface SoundAlertData extends AlertContent {
    type: string;
    fileType: 'sound' | 'video' | 'image';
    volume: number;
    duration: number;
    textLines: string;
    styles: string;
    layout: string;
    animation: { type: string; speed: string };
    textOutline: { enabled: boolean; color: string; width: number };
}

/** Tope de canjes en espera: evita juntar horas de alertas si el overlay estuvo trabado. */
const MAX_QUEUE = 100;

export default function SoundAlertsOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';

    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [alertData, setAlertData] = useState<SoundAlertData | null>(null);
    const [duration, setDuration] = useState(10);
    const [globalVolume, setGlobalVolume] = useState(70);

    // Todo lo visual (textos, estilos, posiciones, animación) en el formato actual
    const [design, setDesign] = useState<AlertDesign>(() => normalizeDesign({}));
    const designRef = useRef(design);
    designRef.current = design;
    // El tamaño de letra se escala con el ancho de la fuente de OBS (antes era en vw)
    const [scale, setScale] = useState(() => window.innerWidth / 1920);
    useEffect(() => {
        const onResize = () => setScale(window.innerWidth / 1920);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const durationRef = useRef(10);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timeout de seguridad
    const timerStartedRef = useRef(false); // Flag para evitar múltiples llamadas a startExitTimer
    // Cola: los canjes que llegan mientras suena otra alerta esperan su turno, con el
    // cooldown como pausa mínima entre el final de una y el comienzo de la siguiente
    const queueRef = useRef<SoundAlertData[]>([]);
    const playingRef = useRef(false);
    const lastEndRef = useRef(0);
    const cooldownRef = useRef(500);
    const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
            if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
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
                    cooldownRef.current = typeof config.cooldownMs === 'number' ? Math.max(0, config.cooldownMs) : 500;

                    // Si una alerta está sonando, su diseño ya viene con el aviso; el nuevo se ve en la próxima
                    if (!playingRef.current) setDesign(normalizeDesign(config));
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
            connection.on('ShowSoundAlert', (data) => enqueue(data));

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

    const enqueue = (data: SoundAlertData) => {
        if (queueRef.current.length >= MAX_QUEUE) {
            console.warn(`⚠️ [SOUNDALERT] Cola llena (${MAX_QUEUE}), se descarta el canje de ${data.redeemer}`);
            return;
        }
        queueRef.current.push(data);
        scheduleNext();
    };

    /** Pasa a la siguiente alerta de la cola cuando termina la actual y se cumple el cooldown. */
    const scheduleNext = () => {
        if (playingRef.current || nextTimerRef.current || queueRef.current.length === 0) return;
        const wait = Math.max(0, lastEndRef.current + cooldownRef.current - Date.now());
        nextTimerRef.current = setTimeout(() => {
            nextTimerRef.current = null;
            const data = queueRef.current.shift();
            if (!data) return;
            playingRef.current = true;

            // El diseño, el volumen y la duración de cada alerta vienen con su aviso
            setDesign(normalizeDesign(data));
            if (data.volume !== undefined) setGlobalVolume(data.volume);
            if (data.duration !== undefined) {
                setDuration(data.duration);
                durationRef.current = data.duration;
            }
            showSoundAlert(data);
        }, wait);
    };

    const finishAlert = () => {
        playingRef.current = false;
        lastEndRef.current = Date.now();
        scheduleNext();
    };

    /** Un archivo que no carga termina la alerta enseguida para no trabar la cola. La limpieza vacía el src y
     *  eso también dispara "error": ese se ignora. */
    const onMediaError = (e: React.SyntheticEvent<HTMLMediaElement>) => {
        if (!e.currentTarget.getAttribute('src')) return;
        console.error('Error cargando el archivo de la alerta:', e.currentTarget.getAttribute('src'));
        startExitTimer(0);
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
        finishAlert();
    };

    const startExitTimer = (durationInSeconds: number) => {
        // Evitar múltiples llamadas - solo iniciar el timer una vez por alerta
        if (timerStartedRef.current) {
            return;
        }

        timerStartedRef.current = true;

        // Ya se sabe cuánto dura: el timeout de seguridad pasa a esa duración (antes cortaba los videos de más de 30 s)
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = setTimeout(() => {
            console.warn('⚠️ [SEGURIDAD] La alerta no terminó sola - Forzando limpieza');
            forceCleanup();
        }, durationInSeconds * 1000 + 5000);

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
            const { type, speed } = designRef.current.animation;
            const exitAnimationDuration = animationDurationMs(speed, type);
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
                finishAlert();
            }, cleanupDelay);
        }, durationInSeconds * 1000);
    };

    const { type: animType, speed: animSpeed } = design.animation;

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
            <style>{ALERT_KEYFRAMES}</style>

            {/* Caja de la alerta: la animación de entrada y salida mueve todo junto */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: alertData ? 'block' : 'none',
                    animation: alertAnimation(animType, animSpeed, !isExiting),
                }}
            >
                {alertData && (
                    <SoundAlertRenderer
                        design={design}
                        content={alertData}
                        scale={scale}
                        videoRef={videoRef}
                        videoProps={{
                            muted: false,
                            // Si el archivo no carga, termina enseguida para no trabar la cola
                            onError: onMediaError,
                            onCanPlay: () => {
                                // Intentar reproducir cuando el video esté listo
                                if (videoRef.current && videoRef.current.paused) {
                                    videoRef.current.play().catch((err) => console.error('Autoplay blocked:', err));
                                }
                            },
                            onLoadedMetadata: () => {
                                if (videoRef.current) videoRef.current.volume = globalVolume / 100;
                            },
                            onPlay: () => {
                                // Iniciar timer cuando realmente empiece a reproducirse
                                if (videoRef.current && !timerStartedRef.current) {
                                    const videoDuration = videoRef.current.duration;
                                    startExitTimer(videoDuration && isFinite(videoDuration) ? videoDuration : durationRef.current);
                                }
                            },
                        }}
                    >
                        {/* Audio: no se ve; la imagen o el icono los dibuja el renderizador */}
                        {alertData.fileUrl && alertData.fileType === 'sound' && (
                            <audio
                                ref={audioRef}
                                key={alertData.fileUrl}
                                src={alertData.fileUrl}
                                autoPlay
                                style={{ display: 'none' }}
                                onError={onMediaError}
                                onCanPlay={() => {
                                    // Intentar reproducir cuando el audio esté listo
                                    if (audioRef.current && audioRef.current.paused) {
                                        audioRef.current.play().catch((err) => console.error('Autoplay blocked:', err));
                                    }
                                }}
                                onLoadedMetadata={() => {
                                    if (audioRef.current) audioRef.current.volume = globalVolume / 100;
                                }}
                                onPlay={() => {
                                    // Iniciar timer cuando realmente empiece a reproducirse
                                    if (audioRef.current && !timerStartedRef.current) {
                                        const audioDuration = audioRef.current.duration;
                                        startExitTimer(audioDuration && isFinite(audioDuration) ? audioDuration : durationRef.current);
                                    }
                                }}
                            />
                        )}
                    </SoundAlertRenderer>
                )}
            </div>
        </div>
    );
}
