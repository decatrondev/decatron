import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import ProgressBarHorizontal from '../components/timer/ProgressBarHorizontal';
import ProgressBarVertical from '../components/timer/ProgressBarVertical';
import ProgressBarCircular from '../components/timer/ProgressBarCircular';
import EventAlertPreview from '../components/timer/EventAlertPreview';

import { DEFAULT_ALERTS_CONFIG } from '../types/timer-alerts';
import type {
    AlertStyleConfig,
    AlertAnimationConfig,
    AlertMediaConfig,
    TimerEventAlertData
} from '../types/timer-alerts';

// ============================================================================
// STYLES & KEYFRAMES
// ============================================================================
const OVERLAY_STYLES = `
    /* Animaciones Generales */
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
    @keyframes rotateIn { from { opacity: 0; transform: rotate(-200deg) scale(0); } to { opacity: 1; transform: rotate(0) scale(1); } }
    @keyframes rotateOut { from { opacity: 1; transform: rotate(0) scale(1); } to { opacity: 0; transform: rotate(200deg) scale(0); } }

    /* Efectos de Pulso (Legacy) */
    @keyframes pulse-slow { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
    @keyframes pulse-normal { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
    @keyframes pulse-fast { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
    .pulse-slow { animation: pulse-slow 2s infinite; }
    .pulse-normal { animation: pulse-normal 1s infinite; }
    .pulse-fast { animation: pulse-fast 0.5s infinite; }

    /* MODO CRÍTICO (PANIC MODE) */
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
        50% { opacity: 0.5; background-color: rgba(255,0,0,0.3); box-shadow: inset 0 0 50px rgba(255,0,0,0.5); }
        100% { opacity: 1; }
    }
`;

// ============================================================================
// TYPES
// ============================================================================

interface TimeUnits {
    years: number; months: number; weeks: number; days: number;
    hours: number; minutes: number; seconds: number;
}
interface DisplayConfig {
    showYears: boolean; showMonths: boolean; showWeeks: boolean; showDays: boolean;
    showHours: boolean; showMinutes: boolean; showSeconds: boolean;
    showTitle: boolean; title: string; showPercentage: boolean; showElapsedTime: boolean;
}
interface ProgressBarConfig {
    type: 'horizontal' | 'vertical' | 'circular';
    orientation: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    backgroundType: string; backgroundColor: string; backgroundGradient: any; backgroundImage: string;
    fillType: string; fillColor: string; fillGradient: any; fillImage: string;
    indicatorEnabled: boolean; indicatorType: string; indicatorSize: number;
    indicatorColor: string; indicatorImage: string; indicatorRotate: boolean;
    borderEnabled: boolean; borderColor: string; borderWidth: number; borderRadius: number;
}
interface StyleConfig {
    fontFamily: string; textColor: string; textShadow: string;
    titleFontSize: number; timeFontSize: number; percentageFontSize: number;
    titlePosition: { x: number; y: number }; timePosition: { x: number; y: number };
    percentagePosition: { x: number; y: number }; elapsedTimePosition: { x: number; y: number };
}
interface AnimationConfig {
    entranceType: string; entranceSpeed: string;
    exitType: string; exitSpeed: string;
    runningEffect: string;
    pulseOnZero: boolean; pulseOnZeroTime: number; pulseOnZeroTimeUnit: string;
    pulseOnZeroDuration: number; pulseOnZeroSpeed: string;
    criticalMode?: {
        enabled: boolean;
        triggerTime: number; triggerTimeUnit: string;
        effectType: string; effectSpeed: string;
        soundEnabled: boolean; soundUrl: string; playlist?: string[];
        soundVolume: number; loopAudio: boolean;
    };
}
interface ThemeConfig {
    mode: string; containerBackground: string; containerOpacity: number;
}
interface TimerEventAlert {
    eventType: string; userName: string; amount?: number; tier?: string;
    level?: number; isPrime?: boolean; months?: number; secondsAdded: number;
    message: string; soundUrl?: string; soundVolume?: number;
    advancedMediaEnabled?: boolean; advancedMedia?: any;
    // TTS Fields
    ttsTemplateUrl?: string;
    ttsTemplateVolume?: number;
    ttsUserMessageUrl?: string;
    ttsUserMessageVolume?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TimerOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';

    // Estado Básico
    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [isPulsingZero, setIsPulsingZero] = useState(false);
    
    // Estado Timer
    const [targetSeconds, setTargetSeconds] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [initialTimeOffset, setInitialTimeOffset] = useState(0);

    // Estado Configuración (Defaults básicos)
    const [displayConfig, setDisplayConfig] = useState<DisplayConfig>({} as any);
    const [progressBarConfig, setProgressBarConfig] = useState<ProgressBarConfig>({} as any);
    const [styleConfig, setStyleConfig] = useState<StyleConfig>({} as any);
    const [animationConfig, setAnimationConfig] = useState<AnimationConfig>({} as any);
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>({} as any);
    const [alertsConfig, setAlertsConfig] = useState(DEFAULT_ALERTS_CONFIG);
    const [canvasWidth, setCanvasWidth] = useState(1000);
    const [canvasHeight, setCanvasHeight] = useState(300);

    // Estado Modo Crítico
    const [isCriticalMode, setIsCriticalMode] = useState(false);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

    // Estado Alertas Eventos
    const [currentAlert, setCurrentAlert] = useState<TimerEventAlert | null>(null);
    const [isAlertVisible, setIsAlertVisible] = useState(false);

    // Cleanup audio sequence when alert hides
    useEffect(() => {
        if (!isAlertVisible && audioSequenceRef.current) {
            audioSequenceRef.current.abort();
            audioSequenceRef.current = null;
            // Stop all alert audio elements
            [alertSoundRef, ttsTemplateRef, ttsUserMessageRef].forEach(ref => {
                if (ref.current) {
                    ref.current.pause();
                    ref.current.currentTime = 0;
                }
            });
        }
    }, [isAlertVisible]);

    // Media Refs
    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // TTS Audio Refs
    const alertSoundRef = useRef<HTMLAudioElement | null>(null);
    const ttsTemplateRef = useRef<HTMLAudioElement | null>(null);
    const ttsUserMessageRef = useRef<HTMLAudioElement | null>(null);
    const audioSequenceRef = useRef<AbortController | null>(null);

    // Refs para evitar closures estale en el ticker y handlers SignalR
    const targetSecondsRef = useRef(0);
    const elapsedSecondsRef = useRef(0);
    const isPausedRef = useRef(false);
    const isVisibleRef = useRef(false);
    const channelRef = useRef(channel);
    const lastServerTickRef = useRef<number>(0); // timestamp del último TimerTick recibido del servidor

    // Mantener refs sincronizados con el estado
    useEffect(() => { targetSecondsRef.current = targetSeconds; }, [targetSeconds]);
    useEffect(() => { elapsedSecondsRef.current = elapsedSeconds; }, [elapsedSeconds]);
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
    useEffect(() => { isVisibleRef.current = isVisible; }, [isVisible]);
    useEffect(() => { channelRef.current = channel; }, [channel]);

    // Limpieza de audio al desmontar (MOVIDO AQUI, DESPUES DE LAS REFS)
    // (Eliminado: La limpieza ahora se maneja en el Audio Engine Lifecycle useEffect)


    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================
    const loadConfiguration = async () => {
        if (!channel) return;
        try {
            const response = await fetch(`/api/timer/config/overlay/${channel}`);
            const data = await response.json();

            if (data.success) {
                if (data.config) {
                    setDisplayConfig(data.config.displayConfig || {});
                    setProgressBarConfig(data.config.progressBarConfig || {});
                    setStyleConfig(data.config.styleConfig || {});
                    setAnimationConfig(data.config.animationConfig || {});
                    setThemeConfig(data.config.themeConfig || {});
                    setAlertsConfig(data.config.alertsConfig || DEFAULT_ALERTS_CONFIG);
                    setCanvasWidth(data.config.canvasWidth || 1000);
                    setCanvasHeight(data.config.canvasHeight || 300);
                    if (data.config.advancedConfig?.initialTimeOffset) {
                        setInitialTimeOffset(data.config.advancedConfig.initialTimeOffset);
                    }
                }

                if (data.state) {
                    setTargetSeconds(data.state.targetSeconds);
                    setElapsedSeconds(data.state.elapsedSeconds);
                    setIsPaused(data.state.isPaused);
                    const status = data.state.status;
                    if (['running', 'paused', 'auto_paused', 'stream_paused'].includes(status)) setIsVisible(true);
                    else if (status === 'stopped') setIsVisible(false);
                }
            }
        } catch (err) {
            console.error('[OVERLAY] Error loading config:', err);
        }
    };

    // ========================================================================
    // 2. TICK DEL TIMER (Engine) - Usa refs para evitar closures estale
    // Un único interval estable: no se recrea cada segundo
    // ========================================================================
    useEffect(() => {
        const tick = () => {
            if (!isVisibleRef.current || isPausedRef.current || targetSecondsRef.current <= 0) return;

            // Si el servidor está enviando ticks activamente (último hace menos de 2s), no contar localmente
            const msSinceLastServerTick = Date.now() - lastServerTickRef.current;
            if (msSinceLastServerTick < 2000) return;

            const next = elapsedSecondsRef.current + 1;

            if (next >= targetSecondsRef.current) {
                elapsedSecondsRef.current = targetSecondsRef.current;
                setElapsedSeconds(targetSecondsRef.current);
                handleTimerReachedZero();
                return;
            }

            elapsedSecondsRef.current = next;
            setElapsedSeconds(next);
        };

        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Un único interval para toda la vida del componente

    // ========================================================================
    // 3. MODO CRÍTICO (Full Logic)
    // ========================================================================
    
    // 3.1 Detección
    const remainingSeconds = Math.max(0, targetSeconds - elapsedSeconds);
    
    useEffect(() => {
        if (!animationConfig?.criticalMode?.enabled || !isVisible || isPaused || remainingSeconds <= 0) {
            setIsCriticalMode(false);
            return;
        }

        const { triggerTime, triggerTimeUnit } = animationConfig.criticalMode;
        let triggerSeconds = triggerTime;
        if (triggerTimeUnit === 'minutes') triggerSeconds *= 60;
        if (triggerTimeUnit === 'hours') triggerSeconds *= 3600;

        const isCritical = remainingSeconds <= triggerSeconds && remainingSeconds > 0;
        
        if (isCritical && !isCriticalMode) {
            setCurrentTrackIndex(0); // Reset playlist al entrar
        }
        setIsCriticalMode(isCritical);

    }, [remainingSeconds, animationConfig?.criticalMode, isVisible, isPaused]);

    // 3.2 Audio Engine (Refactored for Singleton Stability)
    
    // A) Lifecycle: Crear/Destruir instancia única
    useEffect(() => {
        const audio = new Audio();
        audio.loop = false;
        audioRef.current = audio;

        return () => {
            if (audio) {
                audio.pause();
                audio.src = "";
                audio.onended = null;
                audioRef.current = null;
            }
        };
    }, []);

    // B) TTS Audio Elements Lifecycle
    useEffect(() => {
        alertSoundRef.current = new Audio();
        ttsTemplateRef.current = new Audio();
        ttsUserMessageRef.current = new Audio();

        return () => {
            [alertSoundRef, ttsTemplateRef, ttsUserMessageRef].forEach(ref => {
                if (ref.current) {
                    ref.current.pause();
                    ref.current.src = "";
                    ref.current = null;
                }
            });
        };
    }, []);

    // C) Audio Sequence Player for Event Alerts
    const playAlertAudioSequence = async (alert: TimerEventAlert) => {
        console.log('[TimerOverlay] playAlertAudioSequence called with:', {
            eventType: alert.eventType,
            soundUrl: alert.soundUrl,
            ttsTemplateUrl: alert.ttsTemplateUrl,
            ttsUserMessageUrl: alert.ttsUserMessageUrl,
            advancedMedia: alert.advancedMedia
        });

        // Cancel any ongoing sequence
        if (audioSequenceRef.current) {
            audioSequenceRef.current.abort();
        }
        audioSequenceRef.current = new AbortController();
        const signal = audioSequenceRef.current.signal;

        const playAudio = (audioEl: HTMLAudioElement | null, url: string, volume: number): Promise<void> => {
            console.log('[TimerOverlay] playAudio attempting:', { url, volume, hasAudioEl: !!audioEl });
            return new Promise((resolve) => {
                if (!audioEl || !url || signal.aborted) {
                    resolve();
                    return;
                }

                audioEl.src = url;
                audioEl.volume = Math.max(0, Math.min(1, volume / 100));

                const onEnded = () => {
                    audioEl.removeEventListener('ended', onEnded);
                    audioEl.removeEventListener('error', onError);
                    resolve();
                };

                const onError = () => {
                    console.warn('[OVERLAY] Audio playback error:', url);
                    audioEl.removeEventListener('ended', onEnded);
                    audioEl.removeEventListener('error', onError);
                    resolve();
                };

                audioEl.addEventListener('ended', onEnded);
                audioEl.addEventListener('error', onError);

                audioEl.play().catch(err => {
                    console.warn('[OVERLAY] Audio play failed:', err);
                    resolve();
                });
            });
        };

        try {
            // 1. Alert Sound (from simple media or soundUrl)
            const soundUrl = alert.soundUrl || alert.advancedMedia?.audio?.url;
            const soundVolume = alert.soundVolume ?? alert.advancedMedia?.audio?.volume ?? 80;
            if (soundUrl && alertSoundRef.current) {
                await playAudio(alertSoundRef.current, soundUrl, soundVolume);
                if (signal.aborted) return;
            }

            // 2. TTS Template (configured message like "¡Gracias {userName}!")
            if (alert.ttsTemplateUrl && ttsTemplateRef.current) {
                await playAudio(ttsTemplateRef.current, alert.ttsTemplateUrl, alert.ttsTemplateVolume ?? 80);
                if (signal.aborted) return;
            }

            // 3. TTS User Message (user's custom message from bits/subs/tips)
            if (alert.ttsUserMessageUrl && ttsUserMessageRef.current) {
                await playAudio(ttsUserMessageRef.current, alert.ttsUserMessageUrl, alert.ttsUserMessageVolume ?? 80);
            }
        } catch (err) {
            console.error('[OVERLAY] Audio sequence error:', err);
        }
    };

    // D) Playback Logic: Controlar qué suena
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const config = animationConfig?.criticalMode;

        // Reset/Stop conditions
        if (!isCriticalMode || !config?.enabled || !config.soundEnabled) {
            audio.pause();
            if (!isCriticalMode) {
                audio.currentTime = 0;
                // No reseteamos src para evitar recargas innecesarias si volvemos a entrar
            }
            return;
        }

        // Playlist Setup
        let activePlaylist: string[] = [];
        if (config.playlist && config.playlist.length > 0) activePlaylist = config.playlist;
        else if (config.soundUrl) activePlaylist = [config.soundUrl];

        if (activePlaylist.length === 0) return;

        // Track Selection
        const trackIndex = currentTrackIndex >= activePlaylist.length ? 0 : currentTrackIndex;
        const trackUrl = activePlaylist[trackIndex];

        // Volume
        const volume = Math.max(0, Math.min(1, (config.soundVolume ?? 100) / 100));
        audio.volume = volume;

        if (trackUrl) {
            // Solo cargar si cambió la fuente
            if (audio.src !== trackUrl && !audio.src.endsWith(trackUrl)) {
                audio.src = trackUrl;
                audio.load();
            }

            // Actualizar handler onended
            audio.onended = () => {
                const nextIndex = trackIndex + 1;
                if (nextIndex < activePlaylist.length) {
                    setCurrentTrackIndex(nextIndex);
                } else if (config.loopAudio) {
                    setCurrentTrackIndex(0);
                    // Si solo hay un track, forzamos replay manual porque el index no cambia
                    if (activePlaylist.length === 1) {
                        audio.currentTime = 0;
                        audio.play().catch(e => console.warn("Replay blocked:", e));
                    }
                }
            };

            // Intentar reproducir si está pausado o si acabamos de cambiar de track (implicitamente por cambio de index)
            // Nota: audio.play() devuelve promesa, manejamos error
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    // Auto-play policy error o interrupción normal
                    if (e.name !== 'AbortError') console.log("Audio play error:", e);
                });
            }
        }
    }, [isCriticalMode, animationConfig?.criticalMode, currentTrackIndex]);

    // ========================================================================
    // 4. SIGNALR & HANDLERS
    // ========================================================================
    const handleTimerReachedZero = () => {
        console.log('[TIMER] Zero reached');
        fetch(`/api/timer/overlay/${channel}/complete`, { method: 'POST' }).catch(console.error);

        if (animationConfig.pulseOnZero && animationConfig.pulseOnZeroDuration > 0) {
            setIsPulsingZero(true);
            pulseTimeoutRef.current = setTimeout(() => {
                setIsPulsingZero(false);
                handleStopTimer();
            }, animationConfig.pulseOnZeroDuration * 1000);
        } else {
            handleStopTimer();
        }
    };

    const handleStopTimer = () => {
        setIsExiting(true);
        setIsPulsingZero(false);
        setIsCriticalMode(false);
        
        const exitDuration = animationConfig.exitSpeed === 'slow' ? 1000 : (animationConfig.exitSpeed === 'fast' ? 300 : 500);
        setTimeout(() => {
            setIsVisible(false);
            setIsExiting(false);
            setElapsedSeconds(0);
            setTargetSeconds(0);
            setIsPaused(false);
        }, exitDuration);
    };

    useEffect(() => {
        let isMounted = true;
        loadConfiguration();
        
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("/hubs/overlay")
            .withAutomaticReconnect([0, 2000, 5000, 10000, 20000]) // Custom retry intervals
            .configureLogging(signalR.LogLevel.Error)
            .build();

        connection.on("StartTimer", () => loadConfiguration());
        connection.on("PauseTimer", () => loadConfiguration());
        connection.on("ResumeTimer", () => loadConfiguration());
        connection.on("ResetTimer", () => loadConfiguration());
        connection.on("StopTimer", () => handleStopTimer());
        connection.on("ConfigurationChanged", () => loadConfiguration());

        // TimerTick: sincronización en tiempo real desde el servidor (cada segundo)
        // Mientras lleguen ticks del servidor, el setInterval local queda en standby
        connection.on("TimerTick", (data: { remainingSeconds: number }) => {
            if (typeof data?.remainingSeconds === 'number') {
                lastServerTickRef.current = Date.now();
                const target = targetSecondsRef.current;
                const elapsed = Math.max(0, target - data.remainingSeconds);
                elapsedSecondsRef.current = elapsed;
                setElapsedSeconds(elapsed);
            }
        });

        // AddTime: actualiza DIRECTAMENTE desde el payload (evita re-fetch y latencia)
        // También hace re-fetch para sincronizar por si se perdió algún evento
        connection.on("AddTime", (data: { seconds: number }) => {
            if (data?.seconds && data.seconds > 0) {
                const newTarget = targetSecondsRef.current + data.seconds;
                targetSecondsRef.current = newTarget;
                setTargetSeconds(newTarget);
            }
            // Sync secundario para garantizar coherencia en caso de pérdida de eventos
            loadConfiguration();
        });
        
        // Event Alerts
        connection.on("TimerEventAlert", (data: TimerEventAlert) => {
            console.log('[TimerOverlay] TimerEventAlert received:', JSON.stringify(data, null, 2));
            if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
            setCurrentAlert(data);
            setIsAlertVisible(true);

            // Play audio sequence (sound -> TTS template -> TTS user message)
            playAlertAudioSequence(data);

            // Get duration from alert or use default
            const alertDuration = alertsConfig?.global?.duration || 5000;

            alertTimeoutRef.current = setTimeout(() => {
                setIsAlertVisible(false);
            }, alertDuration);
        });

        // Connection Lifecycle
        connection.onreconnecting(error => {
            console.log(`Connection lost due to error "${error}". Reconnecting.`);
        });

        connection.onreconnected(connectionId => {
            console.log(`Connection reestablished. Connected with connectionId "${connectionId}".`);
            if (channel) connection.invoke("JoinChannel", channel);
            loadConfiguration(); // Reload config on reconnect
        });

        connection.onclose(error => {
            // Reintentar conexión después de 5 segundos
            if (isMounted) {
                setTimeout(() => {
                    if (isMounted) startConnection();
                }, 5000);
            }
        });

        // Start Connection with Retry
        const startConnection = async () => {
            // Anti-Pattern fix: Esperar un poco para evitar race-conditions en React StrictMode
            await new Promise(r => setTimeout(r, 50));
            
            if (!isMounted || !connection) return;
            if (connection.state !== signalR.HubConnectionState.Disconnected) return;

            try {
                await connection.start();
                console.log("SignalR Connected");
                if (isMounted) {
                    connectionRef.current = connection;
                    if (channel) {
                        try {
                            await connection.invoke("JoinChannel", channel);
                        } catch (joinErr) {
                            console.error("Error joining channel:", joinErr);
                        }
                    }
                }
            } catch (err: any) {
                if (!isMounted) return;
                // Ignorar errores de negociación interrumpida (común al recargar/desmontar)
                if (err.message && err.message.includes("negotiation")) return;

                console.warn("SignalR Connection Error (Retrying in 5s):", err.message);
                // Retry after 5 seconds if still mounted
                setTimeout(() => {
                    if (isMounted) startConnection();
                }, 5000);
            }
        };

        startConnection();

        // Sync periódico cada 30s como fallback para OBS
        // (OBS puede throttlear SignalR; esto garantiza coherencia)
        const periodicSync = setInterval(() => {
            if (isMounted && channelRef.current) {
                loadConfiguration();
            }
        }, 30000);

        return () => {
            isMounted = false;
            clearInterval(periodicSync);
            // Graceful shutdown
            if (connection) {
                connection.stop().catch(e => {
                    // Silent catch for stop errors
                });
            }
        };
    }, [channel]);


    // ========================================================================
    // 5. RENDER PREPARATION (Values & Styles)
    // ========================================================================
    
    // Helpers Texto
    const formatTimeDetailed = (seconds: number) => {
        let remaining = seconds;
        const years = Math.floor(remaining / (365 * 24 * 60 * 60)); remaining -= years * 365 * 24 * 60 * 60;
        const months = Math.floor(remaining / (30 * 24 * 60 * 60)); remaining -= months * 30 * 24 * 60 * 60;
        const weeks = Math.floor(remaining / (7 * 24 * 60 * 60)); remaining -= weeks * 7 * 24 * 60 * 60;
        const days = Math.floor(remaining / (24 * 60 * 60)); remaining -= days * 24 * 60 * 60;
        const hours = Math.floor(remaining / (60 * 60)); remaining -= hours * 60 * 60;
        const minutes = Math.floor(remaining / 60); remaining -= minutes * 60;
        return { years, months, weeks, days, hours, minutes, seconds: remaining };
    };

    const getTimeString = (seconds: number): string => {
        if (!displayConfig) return '00:00';
        const t = formatTimeDetailed(seconds);
        const parts: string[] = [];
        if (displayConfig.showYears && t.years > 0) parts.push(`${t.years}a`);
        if (displayConfig.showMonths && t.months > 0) parts.push(`${t.months}m`);
        if (displayConfig.showWeeks && t.weeks > 0) parts.push(`${t.weeks}w`);
        if (displayConfig.showDays && t.days > 0) parts.push(`${t.days}d`);
        const hasHigh = parts.length > 0;
        if (displayConfig.showHours && (t.hours > 0 || hasHigh)) parts.push(`${String(t.hours).padStart(2,'0')}h`);
        if (displayConfig.showMinutes && (t.minutes > 0 || hasHigh || displayConfig.showHours)) parts.push(`${String(t.minutes).padStart(2,'0')}m`);
        if (displayConfig.showSeconds && (t.seconds > 0 || hasHigh || displayConfig.showMinutes)) parts.push(`${String(t.seconds).padStart(2,'0')}s`);
        if (parts.length === 0) return (displayConfig.showMinutes && displayConfig.showSeconds) ? '00:00' : '00s';
        return parts.join(' ');
    };

    const getTextShadowStyle = (shadow: string) => {
        switch(shadow) {
            case 'normal': return '2px 2px 4px rgba(0,0,0,0.5)';
            case 'strong': return '3px 3px 6px rgba(0,0,0,0.8)';
            case 'glow': return '0 0 10px rgba(255,255,255,0.8)';
            default: return 'none';
        }
    };

    const hexToRgba = (hex: string, alpha: number) => {
        if (!hex || hex === 'transparent') return 'transparent';
        const clean = hex.startsWith('#') ? hex : `#${hex}`;
        const r = parseInt(clean.slice(1,3), 16);
        const g = parseInt(clean.slice(3,5), 16);
        const b = parseInt(clean.slice(5,7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const remainingTimeString = getTimeString(remainingSeconds);
    const elapsedTimeString = getTimeString(elapsedSeconds + initialTimeOffset);
    const totalDuration = targetSeconds + initialTimeOffset;
    const progress = totalDuration > 0 ? ((elapsedSeconds + initialTimeOffset) / totalDuration) * 100 : 0;

    // --- CAPAS & ANIMACIONES ---
    
    // 1. Entrance/Exit Animation
    const animName = isVisible ? (animationConfig.entranceType === 'none' ? 'fadeIn' : animationConfig.entranceType) 
                               : (animationConfig.exitType === 'none' ? 'fadeOut' : animationConfig.exitType);
    const animDuration = isVisible ? animationConfig.entranceSpeed : animationConfig.exitSpeed;
    const animDurationMs = animDuration === 'slow' ? '1s' : (animDuration === 'fast' ? '0.3s' : '0.5s');
    
    const visibilityAnimation = (isVisible || isExiting) 
        ? `${animName || 'fadeIn'} ${animDurationMs} ease-in-out forwards` 
        : 'none';

    // 2. Critical Mode Animation
    let criticalAnimation = {};
    if (isCriticalMode && animationConfig.criticalMode?.enabled) {
        const { effectType, effectSpeed } = animationConfig.criticalMode;
        if (effectType !== 'none') {
            const d = effectSpeed === 'slow' ? '2s' : (effectSpeed === 'fast' ? '0.5s' : '1s');
            criticalAnimation = { animation: `${effectType}Animation ${d} infinite` };
        }
    }

    // 3. Container Styles
    const isBgImage = themeConfig.containerBackground?.trim().startsWith('url(');
    
    // Wrapper Style
    const wrapperStyle: React.CSSProperties = {
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        position: 'relative',
        display: (isVisible || isExiting) ? 'block' : 'none',
        animation: !isPulsingZero ? visibilityAnimation : 'none',
        fontFamily: styleConfig.fontFamily
    };

    // Animator Style
    const animatorStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        position: 'relative',
        borderRadius: '20px',
        overflow: 'hidden',
        ...criticalAnimation
    };

    if (themeConfig.mode === 'transparent' || themeConfig.containerBackground === 'transparent') {
        animatorStyle.backgroundColor = 'transparent';
    } else if (isBgImage) {
        animatorStyle.backgroundImage = themeConfig.containerBackground;
        animatorStyle.backgroundColor = 'transparent'; 
        animatorStyle.backgroundSize = 'cover';
        animatorStyle.backgroundPosition = 'center';
    } else {
        animatorStyle.backgroundColor = hexToRgba(themeConfig.containerBackground, themeConfig.containerOpacity / 100);
    }

    if (!displayConfig.showTitle) return null;

    return (
        <>
        <style>{OVERLAY_STYLES}</style>
        <div style={wrapperStyle}>
            {/* ALERTAS */}
            {isAlertVisible && currentAlert && (
                 <EventAlertPreview 
                    eventType={currentAlert.eventType as any}
                    userName={currentAlert.userName}
                    amount={currentAlert.amount}
                    secondsAdded={currentAlert.secondsAdded}
                    message={currentAlert.message}
                    icon="✨"
                    // Media Mapping - usar 'advanced' si hay advancedMedia con contenido
                    media={{
                        mode: (currentAlert.advancedMediaEnabled || currentAlert.advancedMedia) ? 'advanced' : 'simple',
                        advanced: currentAlert.advancedMedia,
                        simple: {
                            type: 'audio',
                            url: currentAlert.soundUrl || '',
                            volume: currentAlert.soundVolume || 100
                        }
                    }}
                    // Style & Animation
                    style={alertsConfig.global.style}
                    animation={{
                        entrance: 'fade',
                        exit: 'fade',
                        speed: 'normal'
                    } as any} // Default animation
                    
                    isVisible={true}
                    position={alertsConfig.global.position}
                    size={alertsConfig.global.size}
                 />
            )}

            {/* CONTENIDO TIMER */}
            <div style={animatorStyle}>
                 
                 {/* Title */}
                 {displayConfig.showTitle && (
                    <div style={{
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
                    }}>
                        {displayConfig.title}
                    </div>
                 )}

                 {/* Time */}
                 <div style={{
                        position: 'absolute',
                        left: `${styleConfig.timePosition.x}px`,
                        top: `${styleConfig.timePosition.y}px`,
                        transform: 'translateX(-50%)',
                        textAlign: 'center',
                        zIndex: 10
                 }}>
                    <div style={{
                        fontSize: `${styleConfig.timeFontSize}px`,
                        fontWeight: 'bold',
                        color: isCriticalMode ? '#ff4444' : styleConfig.textColor,
                        textShadow: isCriticalMode ? '0 0 20px red' : getTextShadowStyle(styleConfig.textShadow),
                        fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                        transition: 'color 0.3s'
                    }}>
                        {remainingTimeString}
                    </div>
                 </div>

                 {/* Elapsed */}
                 {displayConfig.showElapsedTime && (
                    <div style={{
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
                    }}>
                        +{elapsedTimeString}
                    </div>
                 )}

                 {/* Percentage */}
                 {displayConfig.showPercentage && (
                    <div style={{
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
                    }}>
                        {Math.round(progress)}%
                    </div>
                 )}

                 {/* Progress Bar */}
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
                            isPulsing={isPulsingZero || isCriticalMode}
                            pulseSpeed={isCriticalMode ? (animationConfig.criticalMode?.effectSpeed || 'fast') : animationConfig.pulseOnZeroSpeed}
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
                            isPulsing={isPulsingZero || isCriticalMode}
                            pulseSpeed={isCriticalMode ? (animationConfig.criticalMode?.effectSpeed || 'fast') : animationConfig.pulseOnZeroSpeed}
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
                            isPulsing={isPulsingZero || isCriticalMode}
                            pulseSpeed={isCriticalMode ? (animationConfig.criticalMode?.effectSpeed || 'fast') : animationConfig.pulseOnZeroSpeed}
                        />
                    )}
                 </div>
            </div>
        </div>
        </>
    );
}