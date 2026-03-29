/**
 * EventAlertsOverlay - Vista para OBS Browser Source
 * Recibe eventos vía SignalR y muestra alertas con media + TTS
 *
 * Sistema de cola:
 * - Cada canal tiene su propia instancia del overlay con cola independiente
 * - Las alertas se encolan y procesan secuencialmente (nunca se interrumpen)
 * - Configuración de queueSettings: maxQueueSize, delayBetweenAlerts, showQueueCounter
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';

// ============================================================================
// STYLES & ANIMATIONS
// ============================================================================
const OVERLAY_STYLES = `
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes slideIn { from { opacity: 0; transform: translateX(-100%); } to { opacity: 1; transform: translateX(0); } }
    @keyframes slideOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(100%); } }
    @keyframes bounceIn {
        0% { opacity: 0; transform: scale(0.3); }
        50% { opacity: 1; transform: scale(1.05); }
        70% { transform: scale(0.9); }
        100% { transform: scale(1); }
    }
    @keyframes bounceOut {
        0% { transform: scale(1); }
        50% { opacity: 1; transform: scale(1.1); }
        100% { opacity: 0; transform: scale(0.3); }
    }
    @keyframes zoomIn { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
    @keyframes zoomOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0); } }

    /* Visual effects - applied after entrance (0.7s delay) */
    @keyframes shakeEffect {
        0%, 100% { transform: translateX(0); }
        15%, 45%, 75% { transform: translateX(-8px); }
        30%, 60%, 90% { transform: translateX(8px); }
    }
    @keyframes glowEffect {
        0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
        50% { box-shadow: 0 0 40px rgba(255, 215, 0, 0.9), 0 0 80px rgba(255, 215, 0, 0.4); }
    }
    @keyframes floatEffect {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-12px); }
    }
    @keyframes pulseEffect {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.06); }
    }
    @keyframes confettiEffect {
        0% { background-position: 0% 0%; }
        100% { background-position: 0% 200%; }
    }
`;

// ============================================================================
// TYPES
// ============================================================================

interface AlertStyle {
    width: number;
    height: number;
    backgroundType: 'color' | 'gradient' | 'image' | 'transparent';
    backgroundColor: string;
    backgroundGradient: { color1: string; color2: string; angle: number };
    backgroundImage: string;
    opacity: number;
    borderEnabled: boolean;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    padding: number;
    mediaLayout: 'top' | 'bottom' | 'left' | 'right' | 'background' | 'hidden';
    mediaObjectFit: 'cover' | 'contain';
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    textColor: string;
    textShadow: 'none' | 'normal' | 'strong' | 'glow';
    textAlign: 'left' | 'center' | 'right';
}

const DEFAULT_STYLE: AlertStyle = {
    width: 600,
    height: 500,
    backgroundType: 'color',
    backgroundColor: 'rgba(0,0,0,0.85)',
    backgroundGradient: { color1: '#1a1a2e', color2: '#16213e', angle: 135 },
    backgroundImage: '',
    opacity: 100,
    borderEnabled: true,
    borderColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderRadius: 24,
    padding: 30,
    mediaLayout: 'top',
    mediaObjectFit: 'contain',
    fontFamily: 'Inter, sans-serif',
    fontSize: 26,
    fontWeight: 'bold',
    textColor: '#ffffff',
    textShadow: 'normal',
    textAlign: 'center',
};

interface OverlayElements {
    card: { x: number; y: number; width: number; height: number; enabled: boolean };
    media: { x: number; y: number; width: number; height: number; enabled: boolean };
    text: { x: number; y: number; width: number; height: number; enabled: boolean };
}

interface QueueSettings {
    enabled: boolean;
    maxQueueSize: number;
    delayBetweenAlerts: number; // ms
    showQueueCounter: boolean;
}

const DEFAULT_QUEUE_SETTINGS: QueueSettings = {
    enabled: true,
    maxQueueSize: 10,
    delayBetweenAlerts: 1000,
    showQueueCounter: false,
};

interface EventAlertData {
    eventType: 'follow' | 'bits' | 'subs' | 'giftSubs' | 'raids' | 'resubs' | 'hypeTrain';
    username: string;
    amount?: number;
    tier?: string;
    months?: number;
    viewers?: number;
    level?: number;
    message?: string;

    // Media
    mediaType?: 'image' | 'video' | 'gif';
    mediaUrl?: string;

    // [1/4] Sonido de alerta (efecto de sonido configurado)
    soundUrl?: string;
    soundVolume?: number;

    // [2/4] Audio del video (si playVideoAudio=true)
    playVideoAudio?: boolean;  // Si reproducir el audio del video
    videoVolume?: number;      // 0-100

    // [3/4] TTS del template ("¡Gracias {username}!")
    ttsTemplateUrl?: string;
    ttsTemplateVolume?: number;

    // [4/4] TTS del mensaje del usuario (bits, subs con mensaje)
    ttsUserMessageUrl?: string;
    ttsUserMessageVolume?: number;

    // Legacy TTS (compatibilidad hacia atrás)
    ttsUrl?: string;
    ttsVolume?: number;
    waitForSound?: boolean;
    // Config
    duration?: number;
    animationIn?: string;
    animationOut?: string;
    effects?: string[];
    style?: Partial<AlertStyle>;
    overlayElements?: OverlayElements; // Posiciones independientes
    queueSettings?: QueueSettings; // Configuración de cola
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function EventAlertsOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';

    const [currentAlert, setCurrentAlert] = useState<EventAlertData | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [audioUnlocked, setAudioUnlocked] = useState(false);
    const [queueCount, setQueueCount] = useState(0);

    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isVisibleRef = useRef(false);
    // Identificador incremental para evitar que una alerta antigua interfiera con la nueva
    const alertIdRef = useRef(0);

    // ============================================================================
    // QUEUE SYSTEM - Cola de alertas independiente por canal
    // ============================================================================
    const alertQueueRef = useRef<EventAlertData[]>([]);
    const isProcessingRef = useRef(false);
    const queueSettingsRef = useRef<QueueSettings>(DEFAULT_QUEUE_SETTINGS);
    const enqueueAlertRef = useRef<(data: EventAlertData) => void>(() => {});

    // ============================================================================
    // AUDIO CONTEXT (desbloquea autoplay en OBS Browser Source)
    // ============================================================================

    useEffect(() => {
        const ctx = new AudioContext();
        audioContextRef.current = ctx;

        const tryUnlock = async () => {
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }
            if (ctx.state === 'running') {
                setAudioUnlocked(true);
                console.log('[EventAlertsOverlay] AudioContext desbloqueado');
            }
        };

        // Intentar sin gesto (funciona en OBS)
        tryUnlock().catch(() => {});

        // Si falla, desbloquear en cualquier interacción (browser normal)
        const unlock = () => { tryUnlock().catch(() => {}); };
        document.addEventListener('click', unlock);
        document.addEventListener('keydown', unlock);

        return () => {
            document.removeEventListener('click', unlock);
            document.removeEventListener('keydown', unlock);
            ctx.close();
        };
    }, []);

    // ============================================================================
    // SIGNALR CONNECTION - Con reconexión infinita
    // ============================================================================

    useEffect(() => {
        if (!channel) {
            console.error('[EventAlertsOverlay] No channel provided');
            return;
        }

        let stopped = false;
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

        const setupSignalRConnection = async () => {
            if (stopped) return;

            const connection = new signalR.HubConnectionBuilder()
                .withUrl('/hubs/overlay')
                .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
                .configureLogging(signalR.LogLevel.None)
                .build();

            connection.on('ShowEventAlert', (data: EventAlertData) => {
                console.log('[EventAlertsOverlay] Recibido evento:', data.eventType);
                console.log('[EventAlertsOverlay] Media:', {
                    mediaType: data.mediaType,
                    mediaUrl: data.mediaUrl,
                    playVideoAudio: data.playVideoAudio,
                    videoVolume: data.videoVolume,
                    soundUrl: data.soundUrl,
                    soundVolume: data.soundVolume,
                });
                console.log('[EventAlertsOverlay] Queue settings:', data.queueSettings);
                enqueueAlertRef.current(data);
            });

            // Reconectar al canal después de una reconexión automática
            // Ignorar mensajes del timer para evitar warnings en consola
            connection.on('TimerTick', () => {});
            connection.on('TimerStateUpdate', () => {});
            connection.on('TimerEventAlert', () => {});

            connection.onreconnected(async () => {
                try {
                    await connection.invoke('JoinChannel', channel);
                } catch (err) {
                    console.error('[EventAlertsOverlay] Error re-uniéndose al canal:', err);
                }
            });

            // Si la conexión se cierra completamente, intentar reconectar después de 5 segundos
            connection.onclose((error) => {
                if (stopped) return;
                reconnectTimeout = setTimeout(setupSignalRConnection, 5000);
            });

            try {
                await connection.start();
                if (stopped) {
                    connection.stop();
                    return;
                }
                await connection.invoke('JoinChannel', channel);
                connectionRef.current = connection;
            } catch (err) {
                if (!stopped) {
                    reconnectTimeout = setTimeout(setupSignalRConnection, 5000);
                }
            }
        };

        setupSignalRConnection();

        return () => {
            stopped = true;
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            // Limpiar cola
            alertQueueRef.current = [];
            isProcessingRef.current = false;
            setQueueCount(0);
            // Limpiar timers y audio
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (audioSourceRef.current) {
                try { audioSourceRef.current.stop(); } catch {}
                audioSourceRef.current = null;
            }
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            connectionRef.current?.stop();
        };
    }, [channel]);

    // ============================================================================
    // QUEUE MANAGEMENT - Encolar alertas y procesar secuencialmente
    // ============================================================================

    /**
     * Encola una alerta. Si no hay procesamiento activo, inicia el procesador.
     * Respeta maxQueueSize: si la cola está llena, descarta las más antiguas.
     */
    const enqueueAlert = useCallback((data: EventAlertData) => {
        // Actualizar configuración de cola si viene en la alerta
        if (data.queueSettings) {
            queueSettingsRef.current = { ...DEFAULT_QUEUE_SETTINGS, ...data.queueSettings };
        }

        const settings = queueSettingsRef.current;
        const queue = alertQueueRef.current;

        // Si la cola no está habilitada, mostrar directamente (comportamiento legacy)
        if (!settings.enabled) {
            console.log('[Queue] Cola deshabilitada, mostrando alerta directamente');
            displayAlertNow(data);
            return;
        }

        // Si la cola está llena, descartar la más antigua
        if (queue.length >= settings.maxQueueSize) {
            const discarded = queue.shift();
            console.log('[Queue] Cola llena, descartando alerta más antigua:', discarded?.eventType);
        }

        // Agregar a la cola
        queue.push(data);
        setQueueCount(queue.length);
        console.log('[Queue] Alerta encolada:', data.eventType, '| Cola:', queue.length);

        // Si no hay procesamiento activo, iniciar
        if (!isProcessingRef.current) {
            processQueue();
        }
    }, []);

    // Mantener ref actualizada para evitar stale closure en SignalR handler
    enqueueAlertRef.current = enqueueAlert;

    /**
     * Procesa la cola de alertas secuencialmente.
     * Espera a que cada alerta termine completamente antes de mostrar la siguiente.
     */
    const processQueue = useCallback(async () => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        console.log('[Queue] Iniciando procesamiento de cola');

        while (alertQueueRef.current.length > 0) {
            const nextAlert = alertQueueRef.current.shift()!;
            setQueueCount(alertQueueRef.current.length);

            console.log('[Queue] Procesando alerta:', nextAlert.eventType, '| Restantes:', alertQueueRef.current.length);

            // Mostrar la alerta y esperar a que termine completamente
            await displayAlertAndWait(nextAlert);

            // Delay entre alertas (si hay más en cola)
            if (alertQueueRef.current.length > 0) {
                const delay = queueSettingsRef.current.delayBetweenAlerts;
                console.log('[Queue] Esperando', delay, 'ms antes de la siguiente alerta');
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        console.log('[Queue] Cola vacía, procesamiento terminado');
        isProcessingRef.current = false;
    }, []);

    /**
     * Muestra una alerta y retorna una Promise que se resuelve cuando termina completamente
     * (incluyendo audio y animación de salida).
     */
    const displayAlertAndWait = async (data: EventAlertData): Promise<void> => {
        const myId = ++alertIdRef.current;

        console.log('[Alert #' + myId + '] Iniciando:', data.eventType, '— sound:', data.soundUrl || '(none)');
        isVisibleRef.current = true;
        setCurrentAlert(data);
        setIsVisible(true);
        setIsExiting(false);

        const minDuration = data.duration ?? 5000;
        const startTime = Date.now();

        // Reproducir secuencia completa de audio
        await playAudioSequence(data, myId);

        // Esperar el tiempo mínimo restante
        const elapsed = Date.now() - startTime;
        const remaining = minDuration - elapsed;
        if (remaining > 0) {
            await new Promise<void>(resolve => {
                timeoutRef.current = setTimeout(resolve, remaining);
            });
        }

        // Animación de salida
        await hideAlertWithAnimation();

        console.log('[Alert #' + myId + '] Terminada completamente');
    };

    /**
     * Muestra alerta inmediatamente (modo legacy sin cola).
     * Interrumpe cualquier alerta activa.
     */
    const displayAlertNow = (data: EventAlertData) => {
        if (isVisibleRef.current) {
            // Forzar ocultado rápido
            stopAllAudio();
            setIsVisible(false);
            setIsExiting(false);
            setCurrentAlert(null);
            isVisibleRef.current = false;
        }

        // Mostrar después de un pequeño delay
        setTimeout(() => {
            displayAlertAndWait(data);
        }, 100);
    };

    /**
     * Oculta la alerta actual con animación.
     * Retorna Promise que se resuelve cuando la animación termina.
     */
    const hideAlertWithAnimation = (): Promise<void> => {
        return new Promise(resolve => {
            isVisibleRef.current = false;

            // Cancelar timer de espera si está activo
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            // Detener audio
            stopAllAudio();

            // Iniciar animación de salida
            setIsExiting(true);
            setTimeout(() => {
                setIsVisible(false);
                setIsExiting(false);
                setCurrentAlert(null);
                resolve();
            }, 600);
        });
    };

    /**
     * Detiene todo el audio inmediatamente.
     */
    const stopAllAudio = () => {
        if (audioSourceRef.current) {
            try { audioSourceRef.current.stop(); } catch {}
            audioSourceRef.current = null;
        }
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    };

    // Legacy: mantener hideAlert para compatibilidad (no se usa en el flujo de cola)
    const hideAlert = () => {
        hideAlertWithAnimation();
    };

    // Reproduce un audio via AudioContext; resuelve cuando termina (o si falla)
    const playAudio = async (url: string, volume: number): Promise<void> => {
        const ctx = audioContextRef.current;
        if (ctx) {
            try {
                if (ctx.state === 'suspended') await ctx.resume();
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                const source = ctx.createBufferSource();
                const gain = ctx.createGain();
                gain.gain.value = volume / 100;
                source.buffer = audioBuffer;
                source.connect(gain);
                gain.connect(ctx.destination);
                audioSourceRef.current = source;
                return new Promise<void>((resolve) => {
                    source.onended = () => resolve();
                    source.start(0);
                });
            } catch (err) {
                console.error('[EventAlertsOverlay] AudioContext error:', err);
                // No relanzar: continuar con el siguiente audio de la secuencia
            }
        }
        // Fallback: HTMLAudioElement
        return new Promise<void>((resolve) => {
            const audio = new Audio(url);
            audio.volume = volume / 100;
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.play().catch(() => resolve());
            audioRef.current = audio;
        });
    };

    /**
     * Reproduce el audio del video elemento.
     * Espera a que el video esté renderizado, luego reproduce una vez completa.
     */
    const playVideoAudio = async (volume: number): Promise<void> => {
        // Esperar hasta que el video esté renderizado (máximo 2 segundos)
        let video = videoRef.current;
        let attempts = 0;
        while (!video && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            video = videoRef.current;
            attempts++;
        }

        if (!video) {
            console.warn('[EventAlertsOverlay] Video ref not found after waiting');
            return;
        }

        // Esperar a que el video tenga duración (esté cargado)
        if (!video.duration || !isFinite(video.duration)) {
            await new Promise<void>((resolve) => {
                const onLoaded = () => {
                    video!.removeEventListener('loadedmetadata', onLoaded);
                    resolve();
                };
                video!.addEventListener('loadedmetadata', onLoaded);
                // Timeout de seguridad
                setTimeout(resolve, 3000);
            });
        }

        console.log('[EventAlertsOverlay] Video ready: duration=' + video.duration + 's, currentTime=' + video.currentTime);

        return new Promise<void>((resolve) => {
            video!.muted = false;
            video!.volume = volume / 100;

            const duration = video!.duration;
            const currentTime = video!.currentTime;

            // Calcular tiempo restante para completar una reproducción
            const remaining = duration - currentTime;
            const waitTime = Math.max(remaining, 0.5) * 1000; // mínimo 0.5s

            console.log('[EventAlertsOverlay] Playing video audio for ' + (waitTime/1000).toFixed(1) + 's');

            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.muted = true;
                }
                resolve();
            }, waitTime);
        });
    };

    /**
     * Jerarquía estricta de audio (NUNCA simultáneo):
     *   1. soundUrl         → sonido de alerta (efecto MP3 configurado)
     *   2. videoAudio       → audio del video (si playVideoAudio=true)
     *   3. ttsTemplateUrl   → TTS del template ("¡Gracias {username}!")
     *   4. ttsUserMessageUrl → TTS del mensaje del usuario (bits, subs con mensaje)
     *
     * Cada paso verifica alertIdRef: si una nueva alerta tomó el control,
     * cancela el resto de la secuencia antes de iniciar el siguiente audio.
     *
     * Compatibilidad: si ttsUrl existe pero no hay ttsTemplateUrl, usa ttsUrl (legacy).
     */
    const playAudioSequence = async (data: EventAlertData, alertId: number): Promise<void> => {
        // [1/4] Sonido de alerta
        if (data.soundUrl && alertIdRef.current === alertId) {
            console.log('[EventAlertsOverlay] [1/4] #' + alertId + ' soundUrl...');
            await playAudio(data.soundUrl, data.soundVolume ?? 80);
            console.log('[EventAlertsOverlay] [1/4] #' + alertId + ' soundUrl terminado');
        }

        // [2/4] Audio del video
        console.log('[EventAlertsOverlay] [2/4] Check: playVideoAudio=' + data.playVideoAudio + ', mediaType=' + data.mediaType + ', videoVolume=' + data.videoVolume);
        if (data.playVideoAudio && data.mediaType === 'video' && alertIdRef.current === alertId) {
            console.log('[EventAlertsOverlay] [2/4] #' + alertId + ' videoAudio starting...');
            await playVideoAudio(data.videoVolume ?? 80);
            console.log('[EventAlertsOverlay] [2/4] #' + alertId + ' videoAudio terminado');
        } else {
            console.log('[EventAlertsOverlay] [2/4] SKIPPED - condition not met');
        }

        // [3/4] TTS del template
        const templateUrl = data.ttsTemplateUrl || data.ttsUrl; // fallback a legacy
        const templateVolume = data.ttsTemplateVolume ?? data.ttsVolume ?? 80;
        if (templateUrl && alertIdRef.current === alertId) {
            console.log('[EventAlertsOverlay] [3/4] #' + alertId + ' ttsTemplate...');
            await playAudio(templateUrl, templateVolume);
            console.log('[EventAlertsOverlay] [3/4] #' + alertId + ' ttsTemplate terminado');
        }

        // [4/4] TTS del mensaje del usuario
        if (data.ttsUserMessageUrl && alertIdRef.current === alertId) {
            console.log('[EventAlertsOverlay] [4/4] #' + alertId + ' ttsUserMessage...');
            await playAudio(data.ttsUserMessageUrl, data.ttsUserMessageVolume ?? 80);
            console.log('[EventAlertsOverlay] [4/4] #' + alertId + ' ttsUserMessage terminado');
        }
    };

    // ============================================================================
    // RENDER
    // ============================================================================

    if (!currentAlert || !isVisible) {
        // Mostrar indicador de desbloqueo de audio solo si no está desbloqueado
        if (!audioUnlocked) {
            return (
                <div
                    style={{
                        position: 'fixed', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: 'transparent', cursor: 'pointer', zIndex: 1,
                    }}
                    title="Haz clic para activar audio (o usa Interact en OBS)"
                />
            );
        }
        return null;
    }

    const animationIn = currentAlert.animationIn ?? 'bounceIn';
    const animationOut = currentAlert.animationOut ?? 'bounceOut';
    const effects = currentAlert.effects ?? [];

    // Merge incoming style with defaults
    const style: AlertStyle = { ...DEFAULT_STYLE, ...currentAlert.style };

    // Posiciones independientes de elementos (con fallbacks)
    const DEFAULT_ELEMENTS: OverlayElements = {
        card: { x: 660, y: 290, width: 600, height: 500, enabled: true },
        media: { x: 690, y: 320, width: 540, height: 220, enabled: true },
        text: { x: 690, y: 560, width: 540, height: 200, enabled: true },
    };
    const elements = currentAlert.overlayElements ?? DEFAULT_ELEMENTS;

    const hasMedia = !!(currentAlert.mediaUrl && elements.media.enabled);

    // Effect animations
    const effectAnimation = effects.length > 0 ? (() => {
        const effect = effects[0];
        const anim = effect === 'shake' ? 'shakeEffect 0.5s ease-in-out infinite'
            : effect === 'glow' ? 'glowEffect 2s ease-in-out infinite'
            : effect === 'float' ? 'floatEffect 2s ease-in-out infinite'
            : effect === 'pulse' ? 'pulseEffect 1.5s ease-in-out infinite'
            : effect === 'confetti' ? 'confettiEffect 3s linear infinite'
            : null;
        return anim ?? undefined;
    })() : undefined;

    // Background CSS value
    const getBg = () => {
        if (style.backgroundType === 'transparent') return 'transparent';
        if (style.backgroundType === 'gradient')
            return `linear-gradient(${style.backgroundGradient.angle}deg, ${style.backgroundGradient.color1}, ${style.backgroundGradient.color2})`;
        if (style.backgroundType === 'image' && style.backgroundImage)
            return `url(${style.backgroundImage}) center/cover no-repeat`;
        return style.backgroundColor;
    };

    // Text shadow CSS value
    const getTextShadow = () => {
        switch (style.textShadow) {
            case 'normal': return '1px 1px 4px rgba(0,0,0,0.9)';
            case 'strong': return '2px 2px 8px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)';
            case 'glow':   return `0 0 12px ${style.textColor}, 0 0 24px ${style.textColor}80`;
            default:       return 'none';
        }
    };

    return (
        <>
            <style>{OVERLAY_STYLES}</style>

            {/* CARD — contenedor principal, posición independiente */}
            {elements.card.enabled && (
                <div
                    style={{
                        position: 'fixed',
                        left: elements.card.x,
                        top: elements.card.y,
                        width: elements.card.width,
                        height: elements.card.height,
                        animation: isExiting
                            ? `${animationOut} 0.6s ease-out forwards`
                            : `${animationIn} 0.6s ease-out`,
                        zIndex: 9999,
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            background: getBg(),
                            opacity: style.opacity / 100,
                            borderRadius: style.borderRadius,
                            border: style.borderEnabled
                                ? `${style.borderWidth}px solid ${style.borderColor}`
                                : 'none',
                            boxShadow: style.backgroundType !== 'transparent'
                                ? '0 8px 32px rgba(0,0,0,0.5)'
                                : 'none',
                            overflow: 'hidden',
                            ...(effectAnimation && !isExiting
                                ? { animation: effectAnimation, animationDelay: '0.7s', animationFillMode: 'both' }
                                : {}),
                        }}
                    />
                </div>
            )}

            {/* MEDIA — imagen, GIF o video, posición independiente */}
            {hasMedia && (
                <div
                    style={{
                        position: 'fixed',
                        left: elements.media.x,
                        top: elements.media.y,
                        width: elements.media.width,
                        height: elements.media.height,
                        zIndex: 10000,
                        overflow: 'hidden',
                        borderRadius: 8,
                        animation: isExiting
                            ? `${animationOut} 0.6s ease-out forwards`
                            : `${animationIn} 0.6s ease-out`,
                    }}
                >
                    {currentAlert.mediaType === 'video' ? (
                        <video
                            ref={videoRef}
                            src={currentAlert.mediaUrl!}
                            autoPlay
                            loop
                            muted={true}
                            style={{ width: '100%', height: '100%', objectFit: style.mediaObjectFit }}
                        />
                    ) : (
                        <img
                            src={currentAlert.mediaUrl!}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: style.mediaObjectFit }}
                        />
                    )}
                </div>
            )}

            {/* TEXT — título + mensaje, posición independiente */}
            {elements.text.enabled && (
                <div
                    style={{
                        position: 'fixed',
                        left: elements.text.x,
                        top: elements.text.y,
                        width: elements.text.width,
                        height: elements.text.height,
                        zIndex: 10001,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: style.textAlign === 'center' ? 'center'
                            : style.textAlign === 'right' ? 'flex-end'
                            : 'flex-start',
                        padding: style.padding,
                        fontFamily: style.fontFamily,
                        color: style.textColor,
                        textShadow: getTextShadow(),
                        textAlign: style.textAlign,
                        animation: isExiting
                            ? `${animationOut} 0.6s ease-out forwards`
                            : `${animationIn} 0.6s ease-out`,
                    }}
                >
                    <div style={{ fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: 1.3 }}>
                        {getEventEmoji(currentAlert.eventType)} {getEventTitle(currentAlert)}
                    </div>
                    {currentAlert.message && (
                        <div style={{
                            fontSize: Math.max(style.fontSize - 4, 12),
                            opacity: 0.85,
                            marginTop: 8,
                            lineHeight: 1.4,
                        }}>
                            "{currentAlert.message}"
                        </div>
                    )}
                </div>
            )}

            {/* QUEUE COUNTER — mostrar cantidad de alertas en cola */}
            {queueSettingsRef.current.showQueueCounter && queueCount > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 20,
                        right: 20,
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        padding: '8px 16px',
                        borderRadius: 20,
                        fontSize: 14,
                        fontFamily: 'Inter, sans-serif',
                        zIndex: 10002,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <span style={{ opacity: 0.7 }}>En cola:</span>
                    <span style={{ fontWeight: 'bold' }}>{queueCount}</span>
                </div>
            )}
        </>
    );
}

// ============================================================================
// HELPERS
// ============================================================================

function getEventEmoji(eventType: string): string {
    const emojis: Record<string, string> = {
        follow: '❤️',
        bits: '💎',
        subs: '⭐',
        giftSubs: '🎁',
        raids: '🚀',
        resubs: '🎉',
        hypeTrain: '🔥',
    };
    return emojis[eventType] ?? '🎉';
}

function getEventTitle(alert: EventAlertData): string {
    switch (alert.eventType) {
        case 'follow':
            return `¡${alert.username} te siguió!`;
        case 'bits':
            return `¡${alert.username} donó ${alert.amount} bits!`;
        case 'subs':
            return `¡${alert.username} se suscribió!`;
        case 'giftSubs':
            return `¡${alert.username} regaló ${alert.amount} subs!`;
        case 'raids':
            return `¡${alert.username} raideó con ${alert.viewers} viewers!`;
        case 'resubs':
            return `¡${alert.username} renovó su sub! (${alert.months} meses)`;
        case 'hypeTrain':
            return `¡Hype Train nivel ${alert.level}!`;
        default:
            return `¡${alert.username}!`;
    }
}
