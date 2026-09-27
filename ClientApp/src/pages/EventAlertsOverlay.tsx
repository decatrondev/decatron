/**
 * EventAlertsOverlay - Vista para OBS Browser Source
 * Recibe eventos vía SignalR y muestra alertas con media + TTS
 *
 * Sistema de cola:
 * - Cada canal tiene su propia instancia del overlay con cola independiente
 * - Las alertas se encolan y procesan secuencialmente (nunca se interrumpen)
 * - Configuración de queueSettings: maxQueueSize, delayBetweenAlerts, showQueueCounter
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { startVersionWatcher, reloadOverlay } from '../utils/overlayVersion';
import EventAlertRenderer from '../components/event-alert-overlay/EventAlertRenderer';
import { applyPartialStyle, designFromAlert, exitDurationMs, normalizeEventAlertsDesign, resolveAlertDesign } from '../components/event-alert-overlay/convertLegacy';
import type { AlertDesign, EventAlertData as RenderAlertData, LegacyAlertStyle, LegacyOverlayElements } from '../components/event-alert-overlay/types';

// ============================================================================
// TYPES
// ============================================================================

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
    // Fallback de voz del navegador cuando no hay créditos para Polly
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
    style?: Partial<LegacyAlertStyle>;
    overlayElements?: LegacyOverlayElements; // Posiciones independientes
    /** Diseño guardado (general y por evento); sin él se dibuja con style y overlayElements, como siempre. */
    design?: unknown;
    /** El `style` propio del evento, nivel o variante (sin el global). */
    partialStyle?: Partial<LegacyAlertStyle> | null;
    /** Cooldowns de General (segundos): tiempo mínimo entre alertas, esperado en la cola. */
    cooldownSettings?: { globalCooldown?: number; perEventCooldown?: number };
    /** Dirección de la animación del evento (left/right/top/bottom; 'center' = la de siempre). */
    animationDirection?: string;
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
    /** Cuándo empezó la última alerta (cualquiera y por evento), para los cooldowns de General. */
    const lastStartRef = useRef<{ any: number; byEvent: Record<string, number> }>({ any: 0, byEvent: {} });

    // Diseño de la alerta en pantalla: el guardado (el del evento o el general, con el estilo propio del nivel o
    // variante); sin diseño guardado, el de siempre armado con style y overlayElements (se resuelve al dibujar)
    const alertDesign = useMemo<AlertDesign | null>(() => {
        if (!currentAlert?.design) return null;
        try {
            const all = normalizeEventAlertsDesign({ design: currentAlert.design });
            const resolved = resolveAlertDesign(all, currentAlert as unknown as RenderAlertData, currentAlert.style, currentAlert.overlayElements);
            return applyPartialStyle(resolved, currentAlert.partialStyle);
        } catch (err) {
            console.error('[EventAlertsOverlay] Diseño inválido, se usa el de siempre:', err);
            return null;
        }
    }, [currentAlert]);
    /** Cuánto esperar la salida antes de sacar la alerta (siempre fueron 600 ms). */
    const exitMsRef = useRef(600);
    exitMsRef.current = alertDesign ? exitDurationMs(alertDesign) : 600;

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

            connection.on('RefreshOverlay', () => reloadOverlay());

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

    // La fuente de OBS nunca se recarga sola: sin esto se queda con el bundle viejo
    // para siempre. El vigilante compara el hash del bundle con el desplegado.
    useEffect(() => startVersionWatcher(), []);


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

            // Cooldowns de General: tiempo mínimo entre el comienzo de dos alertas (cualquiera, y del mismo evento).
            // Se esperan en la cola, así ninguna se pierde
            const cds = nextAlert.cooldownSettings;
            if (cds) {
                const now = Date.now();
                const sinceAny = now - lastStartRef.current.any;
                const sinceSame = now - (lastStartRef.current.byEvent[nextAlert.eventType] ?? 0);
                const wait = Math.max(0, (cds.globalCooldown ?? 0) * 1000 - sinceAny, (cds.perEventCooldown ?? 0) * 1000 - sinceSame);
                if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
            }
            lastStartRef.current.any = Date.now();
            lastStartRef.current.byEvent[nextAlert.eventType] = Date.now();

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

            // Iniciar animación de salida (la más larga del diseño)
            setIsExiting(true);
            setTimeout(() => {
                setIsVisible(false);
                setIsExiting(false);
                setCurrentAlert(null);
                resolve();
            }, exitMsRef.current);
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
        // [1/4] Sonido de alerta y [2/4] audio del video. Con "esperar al sonido" apagado (waitForSound: false) la voz
        // arranca a la vez; si no, en orden, como siempre
        const sounds = (async () => {
            if (data.soundUrl && alertIdRef.current === alertId) {
                console.log('[EventAlertsOverlay] [1/4] #' + alertId + ' soundUrl...');
                await playAudio(data.soundUrl, data.soundVolume ?? 80);
                console.log('[EventAlertsOverlay] [1/4] #' + alertId + ' soundUrl terminado');
            }
            if (data.playVideoAudio && data.mediaType === 'video' && alertIdRef.current === alertId) {
                console.log('[EventAlertsOverlay] [2/4] #' + alertId + ' videoAudio starting...');
                await playVideoAudio(data.videoVolume ?? 80);
                console.log('[EventAlertsOverlay] [2/4] #' + alertId + ' videoAudio terminado');
            }
        })();
        if (data.waitForSound !== false) await sounds;

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
        // La alerta no termina antes que el sonido
        await sounds;
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

    return (
        <>
            {/* La alerta: el mismo renderer que la vista previa y el editor (fixed = cada elemento en su capa, como siempre) */}
            <EventAlertRenderer
                design={alertDesign ?? designFromAlert(currentAlert.style, currentAlert.overlayElements)}
                data={currentAlert as unknown as RenderAlertData}
                phase={isExiting ? 'exit' : 'enter'}
                fixed
                videoRef={videoRef}
            />

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
