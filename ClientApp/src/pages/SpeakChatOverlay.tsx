/**
 * SpeakChatOverlay - OBS Browser Source
 * URL: /overlay/speak-chat?channel=channelname
 *
 * El servidor manda siempre un MP3, lo genere Piper (voz estándar) o Polly (premium).
 * Aquí solo se reproduce: no hay síntesis en el navegador. La había, con la Web Speech
 * API, y no sonaba dentro de OBS porque ese audio lo produce el motor del sistema y
 * nunca entra en la captura de la fuente.
 *
 * Arquitectura: todo por refs para evitar re-renders que destruyan la conexión SignalR
 * o dupliquen la cola de audio.
 */

import { useEffect, useRef, useState } from 'react';
import { startVersionWatcher, reloadOverlay } from '../utils/overlayVersion';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';

// ===================== TYPES =====================

interface OverlayDisplayConfig {
    showBubble: boolean;
    position: 'top-left' | 'top-right' | 'top-center' | 'bottom-left' | 'bottom-right' | 'bottom-center';
    fontSize: number;
    backgroundColor: string;
    textColor: string;
    duration: number;
}

interface SpeakChatMessage {
    username: string;
    message: string;
    audioUrl?: string;
    /** Turno de voz del canal: al terminar el audio se avisa al servidor para que suene la siguiente */
    audioTurnId?: string | null;
    volume: number;
    /** "none" = el servidor no pudo generar audio; el mensaje sale solo como burbuja */
    ttsEngine: 'polly' | 'piper' | 'none';
    voice: string;
    languageCode: string;
    overlay?: Partial<OverlayDisplayConfig>;
    timestamp: string;
    isTest?: boolean;
    /** De qué plataforma llegó el mensaje */
    platform?: 'twitch' | 'kick';
}

interface QueueItem extends SpeakChatMessage {
    id: string;
}

const DEFAULT_CONFIG: OverlayDisplayConfig = {
    showBubble: true,
    position: 'bottom-left',
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    textColor: '#ffffff',
    duration: 5000,
};

function getPositionStyle(position: OverlayDisplayConfig['position']): React.CSSProperties {
    const base: React.CSSProperties = { position: 'fixed', maxWidth: 380, zIndex: 100 };
    switch (position) {
        case 'top-left':      return { ...base, top: 16, left: 16 };
        case 'top-center':    return { ...base, top: 16, left: '50%', transform: 'translateX(-50%)' };
        case 'top-right':     return { ...base, top: 16, right: 16 };
        case 'bottom-left':   return { ...base, bottom: 16, left: 16 };
        case 'bottom-center': return { ...base, bottom: 16, left: '50%', transform: 'translateX(-50%)' };
        case 'bottom-right':  return { ...base, bottom: 16, right: 16 };
        default:              return { ...base, bottom: 16, left: 16 };
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===================== COMPONENT =====================

export default function SpeakChatOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') ?? '';
    // ?source=all|twitch|kick: qué plataformas lee este overlay (sin él, lo que mostraba ese enlace antes)
    const sourceParam = searchParams.get('source');
    // Clave real del grupo: puede no ser la del enlace (kick_<id>, KickId) si la cuenta tiene otro canal principal
    const overlayKeyRef = useRef(channel);
    // Plataforma que deja pasar este overlay: null = todas
    const sourceRef = useRef<string | null>(null);

    // UI state — solo para render
    const [currentMsg, setCurrentMsg] = useState<QueueItem | null>(null);
    const [visible, setVisible] = useState(false);
    // Aviso de diagnóstico: SOLO se muestra en mensajes de prueba, nunca en vivo
    const [testWarning, setTestWarning] = useState<string | null>(null);

    // Config en ref para acceder siempre al valor actual sin recrear callbacks
    const configRef = useRef<OverlayDisplayConfig>({ ...DEFAULT_CONFIG });

    // Cola y estado de procesamiento
    const queueRef = useRef<QueueItem[]>([]);
    const isProcessingRef = useRef(false);
    const connectionRef = useRef<signalR.HubConnection | null>(null);

    // ===================== AUDIO CONTEXT UNLOCK =====================
    useEffect(() => {
        const unlock = () => {
            try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                if (ctx.state === 'suspended') ctx.resume();
            } catch {}
        };
        // OBS: intentar inmediatamente y también en interacción
        unlock();
        document.addEventListener('click', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
    }, []);

    // ===================== CARGAR CONFIG =====================
    const loadConfig = () => {
        if (!channel) return;
        fetch(`/api/speakchat/config/overlay/${channel}`)
            .then(r => r.json())
            .then(data => {
                if (data?.config?.overlay) {
                    configRef.current = { ...DEFAULT_CONFIG, ...data.config.overlay };
                }
            })
            .catch(() => {});
    };

    // ===================== PLAY AUDIO =====================
    const playAudio = (item: QueueItem): Promise<void> => {
        return new Promise(resolve => {
            if (!item.audioUrl) {
                resolve();
                return;
            }

            console.log('[SpeakChat] ▶️', item.ttsEngine, item.audioUrl);
            const audio = new Audio(item.audioUrl);
            audio.volume = Math.max(0, Math.min(1, (item.volume ?? 80) / 100));

            let resolved = false;
            const done = () => { if (!resolved) { resolved = true; resolve(); } };

            // Timeout de seguridad: si el audio nunca termina, la cola no se queda colgada
            const t = setTimeout(done, 30000);
            audio.onended = () => { clearTimeout(t); done(); };
            audio.onerror = (e) => { console.error('[SpeakChat] ❌ Error de audio:', e); clearTimeout(t); done(); };
            audio.play().catch(done);
        });
    };

    /**
     * Devuelve el motivo por el que un mensaje no va a sonar, o null si todo bien.
     * Solo se usa para mensajes de prueba.
     */
    const diagnoseSilence = (item: QueueItem): string | null => {
        if (item.audioUrl) return null;

        return item.ttsEngine === 'polly'
            ? 'No se generó la voz: puede que te hayas quedado sin créditos premium.'
            : 'No se generó la voz estándar. Revisa tu saldo del mes o inténtalo de nuevo.';
    };

    // ===================== QUEUE PROCESSOR =====================
    const processQueue = async () => {
        if (isProcessingRef.current || queueRef.current.length === 0) return;
        isProcessingRef.current = true;

        const item = queueRef.current.shift()!;
        console.log('[SpeakChat] 🔊 Procesando:', { engine: item.ttsEngine, audioUrl: item.audioUrl, voice: item.voice, lang: item.languageCode, msg: item.message });
        const cfg = { ...configRef.current, ...(item.overlay ?? {}) };

        // Diagnóstico solo en pruebas: si esto no va a sonar, decir por qué.
        // Nunca en mensajes reales — el overlay está en pantalla durante el directo.
        const warning = item.isTest ? diagnoseSilence(item) : null;
        setTestWarning(warning);

        // Mostrar burbuja. Con la burbuja desactivada igual se muestra si hay que
        // avisar de un problema, porque si no la prueba sería muda y sin explicación.
        if (cfg.showBubble || warning) {
            setCurrentMsg(item);
            setVisible(true);
        }

        // Reproducir audio
        await playAudio(item);
        // Avisar que la voz terminó, sin esperar a que se oculte la burbuja (si no, la siguiente voz del canal esperaría de más)
        if (item.audioTurnId && overlayKeyRef.current) {
            connectionRef.current?.invoke('AudioTurnEnded', overlayKeyRef.current, item.audioTurnId).catch(() => {});
        }

        // Esperar duración mínima visible
        await sleep(Math.max((cfg.duration ?? 5000), 500));

        // Ocultar
        setVisible(false);
        await sleep(350);
        setCurrentMsg(null);
        setTestWarning(null);

        isProcessingRef.current = false;

        // Siguiente en cola
        if (queueRef.current.length > 0) {
            processQueue();
        }
    };

    const enqueue = (data: SpeakChatMessage) => {
        console.log('[SpeakChat] ➕ Enqueue:', data.username, '|', data.ttsEngine, '|', data.audioUrl ?? 'sin audio');
        if (queueRef.current.length >= 10) return; // límite de cola
        const item: QueueItem = { ...data, id: `${Date.now()}-${Math.random()}` };
        queueRef.current.push(item);
        if (!isProcessingRef.current) {
            processQueue();
        }
    };

    // ===================== SIGNALR — se configura una sola vez =====================
    useEffect(() => {
        if (!channel) return;

        loadConfig();

        const connection = new signalR.HubConnectionBuilder()
            .withUrl('/hubs/overlay')
            .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
            .configureLogging(signalR.LogLevel.Error) // Silencia warnings de métodos no registrados
            .build();
        connectionRef.current = connection;

        // Registrar handlers para TODOS los eventos del hub para evitar spam en consola
        connection.on('SpeakChatMessage', (data) => {
            // Este overlay solo lee una plataforma: el resto lo atiende otro (o nadie, y el servidor ya soltó el turno)
            if (sourceRef.current && data?.platform && data.platform !== sourceRef.current) return;
            console.log('[SpeakChat] 📨 Mensaje recibido:', JSON.stringify(data, null, 2));
            enqueue(data);
        });
        connection.on('SpeakChatConfigChanged', loadConfig);
        // Silenciar eventos de otros sistemas que llegan al mismo grupo
        connection.on('ShowEventAlert', () => {});
        connection.on('EventAlertsConfigChanged', () => {});
        connection.on('ShowShoutout', () => {});
        connection.on('TimerTick', () => {});
        connection.on('timertick', () => {});
        connection.on('ConfigurationChanged', () => {});
        connection.on('RefreshOverlay', () => reloadOverlay());
        connection.on('ShowSoundAlert', () => {});

        // SignalR reconecta solo, pero NO vuelve a meterte en tu grupo: eso hay que
        // pedirlo otra vez. Sin esto, cada reinicio del backend dejaba el overlay
        // conectado y mudo para siempre, sin un solo error en consola, hasta que alguien
        // recargaba la fuente en OBS a mano. Los otros nueve overlays ya lo hacían.
        connection.onreconnected(async () => {
            try {
                await resolveChannel();
                await join();
                console.log('[SpeakChat] 🔄 Reconectado y reincorporado al canal:', overlayKeyRef.current);
            } catch (err) {
                console.error('[SpeakChat] ❌ Error al reincorporarse al canal:', err);
            }
        });

        // A qué grupo unirse y qué plataformas lee: el enlace puede traer el login de Twitch, kick_<id> o el id de
        // Kick, pero el servidor emite siempre al grupo de la cuenta. Se pregunta en cada conexión.
        const resolveChannel = async () => {
            let legacyVariant: string | null = null;
            try {
                const res = await fetch(`/api/speakchat/resolve/${encodeURIComponent(channel)}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && json.found) {
                        overlayKeyRef.current = json.overlayKey || channel;
                        legacyVariant = json.variant || null;
                    }
                }
            } catch { /* sin respuesta se usa el enlace tal cual, como antes */ }
            const explicit = ['all', 'twitch', 'kick'].includes((sourceParam || '').toLowerCase()) ? (sourceParam as string).toLowerCase() : null;
            const variant = explicit ?? legacyVariant;
            sourceRef.current = variant && variant !== 'all' ? variant : null;
        };

        const join = async () => {
            await connection.invoke('JoinChannel', overlayKeyRef.current);
            // Identificarse permite que el servidor avise en los registros cuando genera audio para un canal
            // sin este overlay puesto. Si el backend es viejo y no conoce el método, el overlay funciona igual.
            await connection.invoke('RegisterOverlay', overlayKeyRef.current, 'speak_chat').catch(() => {});
            await connection.invoke('SetOverlayVariant', sourceRef.current ?? 'all').catch(() => {});
        };

        const start = async () => {
            try {
                await resolveChannel();
                await connection.start();
                await join();
                console.log('[SpeakChat] ✅ SignalR conectado al canal:', overlayKeyRef.current);
            } catch (e) {
                console.error('[SpeakChat] ❌ Error SignalR:', e);
                setTimeout(start, 5000);
            }
        };

        start();

        return () => { connection.stop(); };
    }, [channel, sourceParam]); // Solo depende del enlace — no se recrea por cambios de config

    // ===================== AUTO-ACTUALIZACIÓN =====================
    // La fuente de OBS nunca se recarga sola: sin esto se queda con el bundle viejo
    // para siempre. No recarga en mitad de un mensaje.
    useEffect(() => startVersionWatcher(
        () => !isProcessingRef.current && queueRef.current.length === 0,
    ), []);

    // ===================== RENDER =====================
    const cfg = currentMsg
        ? { ...configRef.current, ...(currentMsg.overlay ?? {}) }
        : configRef.current;

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'transparent', position: 'relative' }}>
            <style>{`
                @keyframes scIn  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(10px); } }
                .sc-in  { animation: scIn  0.3s ease forwards; }
                .sc-out { animation: scOut 0.3s ease forwards; }
            `}</style>

            {currentMsg && (cfg.showBubble || testWarning) && (
                <div
                    style={getPositionStyle(cfg.position)}
                    className={visible ? 'sc-in' : 'sc-out'}
                >
                    <div style={{
                        backgroundColor: cfg.backgroundColor,
                        borderRadius: 12,
                        padding: '10px 16px',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                    }}>
                        <p style={{
                            color: cfg.textColor,
                            fontSize: Math.max(10, (cfg.fontSize ?? 16) * 0.8),
                            fontWeight: 700,
                            margin: 0,
                            lineHeight: 1.2,
                            fontFamily: 'Inter, system-ui, sans-serif',
                            opacity: 0.8,
                        }}>
                            {currentMsg.username}
                        </p>
                        <p style={{
                            color: cfg.textColor,
                            fontSize: cfg.fontSize ?? 16,
                            margin: '3px 0 0',
                            lineHeight: 1.5,
                            wordBreak: 'break-word',
                            fontFamily: 'Inter, system-ui, sans-serif',
                        }}>
                            {currentMsg.message}
                        </p>

                        {/* Diagnóstico — solo aparece en mensajes de prueba */}
                        {testWarning && (
                            <div style={{
                                marginTop: 10,
                                paddingTop: 10,
                                borderTop: '1px solid rgba(255,255,255,0.2)',
                            }}>
                                <p style={{
                                    color: '#fbbf24',
                                    fontSize: Math.max(10, (cfg.fontSize ?? 16) * 0.72),
                                    margin: 0,
                                    lineHeight: 1.4,
                                    fontWeight: 600,
                                    fontFamily: 'Inter, system-ui, sans-serif',
                                }}>
                                    ⚠️ {testWarning}
                                </p>
                                <p style={{
                                    color: '#fbbf24',
                                    fontSize: Math.max(9, (cfg.fontSize ?? 16) * 0.62),
                                    margin: '4px 0 0',
                                    opacity: 0.75,
                                    fontFamily: 'Inter, system-ui, sans-serif',
                                }}>
                                    Solo visible en pruebas — tus viewers no ven esto.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
