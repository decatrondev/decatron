import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import ChatBox from '../components/chat-overlay/ChatRenderer';
import BubblesStage, { useBubbles } from '../components/chat-overlay/BubblesStage';
import { useChatFeed } from '../components/chat-overlay/useChatFeed';
import { DEFAULT_CHAT_CONFIG, normalizeChatConfig, type ChatMsg, type ChatOverlayConfig } from '../components/chat-overlay/types';
import { useGoogleFonts } from '../components/music-overlay/utils';

// Overlay de chat de OBS (.dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 1). Recibe los mensajes ya resueltos por el
// servidor (emotes, insignias, filtros, bots) y los dibuja con el mismo renderer que la vista previa del editor.
// ?channel=<login>  [&source=all|twitch|kick]
// El servidor emite siempre al grupo de la fila principal de la cuenta (.dev/plans/CHAT_UNIFICADO_PLAN.md, fase 2),
// así que al cargar se pregunta a qué clave unirse y qué mostraba ese enlace antes de unificar:
// sin source, un enlace viejo conserva su plataforma (login de Twitch = Twitch, kick_<id> = Kick);
// source=all muestra las dos y source=twitch|kick filtra.
//
// Resistente a reinicios del bot y fallos de la base: el overlay nunca empeora lo que ya muestra.
// - Guarda en el navegador de OBS la última configuración buena y la resolución del canal, y arranca con ellas.
// - Si pedir la configuración falla, reintenta hasta lograrlo; un error nunca la reemplaza por los valores por defecto.
// - La vuelve a pedir en cada conexión al hub (corta o de cero) y cada 2 min en silencio, por si se desincronizó.
// - Respuesta sin configuración = el canal nunca guardó nada (las filas no se borran): se conserva lo que haya.

const STORE_PREFIX = 'decatron.chat-overlay.';
const CHECK_MS = 120_000;

function readStored<T>(key: string): T | null {
    try {
        const raw = window.localStorage.getItem(STORE_PREFIX + key);
        return raw ? JSON.parse(raw) as T : null;
    } catch { return null; }
}

function writeStored(key: string, value: unknown) {
    try { window.localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value)); } catch { /* sin almacenamiento sigue funcionando, solo sin copia */ }
}

/** La configuración guardada de este enlace, ya normalizada; null si no hay o está dañada */
function storedConfig(channel: string): { raw: string; config: ChatOverlayConfig } | null {
    const raw = readStored<unknown>(`config:${channel.toLowerCase()}`);
    if (raw == null || typeof raw !== 'object') return null;
    try { return { raw: JSON.stringify(raw), config: normalizeChatConfig(raw) }; } catch { return null; }
}

export default function ChatOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';
    const sourceParam = searchParams.get('source');

    // Arranca con la última buena de este enlace: si el bot está caído al abrir OBS, se ve igual que siempre
    const [initial] = useState(() => (channel ? storedConfig(channel) : null));
    const [config, setConfig] = useState<ChatOverlayConfig>(() => initial?.config ?? DEFAULT_CHAT_CONFIG);
    // Texto de la última aplicada: si llega igual no se toca el estado (no reinicia burbujas ni animaciones)
    const lastRaw = useRef<string | null>(initial?.raw ?? null);
    const feed = useChatFeed(config);
    const bubbles = useBubbles(config);
    // Los mensajes van al modo que esté activo; el otro no gasta nada
    const sink = useRef({ push: feed.push, remove: feed.remove, removeUser: feed.removeUser, clear: feed.clear });
    const active = config.mode === 'bubbles' ? bubbles : feed;
    sink.current = { push: active.push, remove: active.remove, removeUser: active.removeUser, clear: active.clear };
    const feedRef = sink;
    // Plataforma que deja pasar este overlay: null = todas. Se fija al resolver el canal
    const sourceRef = useRef<string | null>(null);

    useGoogleFonts([config.text.fontFamily], 'chat-fonts');

    // OBS muestra el fondo del documento: tiene que ser transparente
    useEffect(() => {
        const prev = { body: document.body.style.background, html: document.documentElement.style.background };
        document.body.style.background = 'transparent';
        document.documentElement.style.background = 'transparent';
        return () => { document.body.style.background = prev.body; document.documentElement.style.background = prev.html; };
    }, []);

    useEffect(() => {
        if (!channel) return;
        let closed = false;
        let connection: signalR.HubConnection | null = null;
        let retry: number | undefined;

        const storeKey = channel.toLowerCase();
        let configTimer: number | undefined;
        let configFailures = 0;
        let configSeq = 0;

        // Clave real del grupo: puede no ser la del enlace (kick_<id>, KickId) si la cuenta tiene otro canal principal.
        // Arranca con la última resolución buena; si el servidor no responde se conserva (no se pasa a mostrar todo)
        const cachedResolve = readStored<{ overlayKey?: string; variant?: string | null }>(`resolve:${storeKey}`);
        let overlayKey = cachedResolve?.overlayKey || channel;
        let legacyVariant: string | null = cachedResolve?.variant ?? null;

        const applySource = () => {
            const explicit = ['all', 'twitch', 'kick'].includes((sourceParam || '').toLowerCase()) ? (sourceParam as string).toLowerCase() : null;
            const variant = explicit ?? legacyVariant;
            sourceRef.current = variant && variant !== 'all' ? variant : null;
        };
        applySource();

        const resolveChannel = async () => {
            try {
                const res = await fetch(`/api/chat-overlay/resolve/${encodeURIComponent(channel)}`, { cache: 'no-store' });
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && json.found) {
                        overlayKey = json.overlayKey || channel;
                        legacyVariant = json.variant || null;
                        writeStored(`resolve:${storeKey}`, { overlayKey, variant: legacyVariant });
                    }
                }
            } catch { /* sin respuesta se conserva la última resolución (o el enlace tal cual, como antes) */ }
            applySource();
        };

        /** true si el servidor respondió bien (con o sin configuración); false si hay que reintentar */
        const loadConfiguration = async (): Promise<boolean> => {
            const seq = ++configSeq;
            try {
                const res = await fetch(`/api/chat-overlay/config/overlay/${encodeURIComponent(channel)}`, { cache: 'no-store' });
                if (!res.ok) return false;
                const json = await res.json();
                if (!json.success) return false;
                // Si mientras tanto salió otra petición más nueva, manda esa
                if (closed || seq !== configSeq) return true;
                // Sin configuración: el canal nunca guardó nada. Se queda con lo que muestra (la copia o los valores por defecto)
                if (json.config == null || typeof json.config !== 'object') return true;
                const raw = JSON.stringify(json.config);
                if (raw !== lastRaw.current) {
                    const next = normalizeChatConfig(json.config);
                    lastRaw.current = raw;
                    setConfig(next);
                    writeStored(`config:${storeKey}`, json.config);
                }
                return true;
            } catch { return false; }
        };

        // Pide la configuración ya y deja programada la siguiente: revisión tranquila si salió bien, reintento corto si no
        const refreshConfig = async () => {
            window.clearTimeout(configTimer);
            if (closed) return;
            const ok = await loadConfiguration();
            if (closed) return;
            configFailures = ok ? 0 : configFailures + 1;
            const wait = ok ? CHECK_MS : Math.min(30_000, 3_000 * 2 ** Math.min(configFailures - 1, 4));
            window.clearTimeout(configTimer);
            configTimer = window.setTimeout(refreshConfig, wait);
        };

        const join = async (c: signalR.HubConnection) => {
            await c.invoke('JoinChannel', overlayKey);
            // Sin esto el servidor no sabe que hay un overlay de chat y no manda nada
            await c.invoke('RegisterOverlay', overlayKey, 'chat');
            // Para que el panel muestre qué fuentes hay en OBS y avise si dos se pisan
            await c.invoke('SetOverlayVariant', sourceRef.current ?? 'all');
        };

        const connect = async () => {
            if (closed) return;
            try {
                // Cada conexión vuelve a preguntar: si el servidor cambió (reinicio, cuenta vinculada), la fuente de OBS se pone al día sola
                await resolveChannel();
                if (closed) return;
                connection = new signalR.HubConnectionBuilder()
                    .withUrl(`${window.location.origin}/hubs/overlay`, { withCredentials: false })
                    .withAutomaticReconnect()
                    .configureLogging(signalR.LogLevel.Warning)
                    .build();

                connection.on('ChatMessage', (msg: ChatMsg) => {
                    if (sourceRef.current && msg.platform !== sourceRef.current) return;
                    feedRef.current.push(msg);
                });
                connection.on('ChatMessageDeleted', (d: { id: string }) => feedRef.current.remove(d.id));
                connection.on('ChatUserCleared', (d: { login: string; channel: string }) => feedRef.current.removeUser(d.login, d.channel));
                connection.on('ChatCleared', () => feedRef.current.clear());
                connection.on('ConfigurationChanged', () => { refreshConfig(); });
                connection.onreconnected(async () => {
                    refreshConfig();
                    try { await join(connection!); } catch { /* el siguiente intento lo reintenta */ }
                });
                connection.onclose(() => { if (!closed) retry = window.setTimeout(connect, 5000); });

                await connection.start();
                await join(connection);
                // Conexión de cero (primera o tras perderla del todo): el bot pudo cambiar mientras no estaba
                refreshConfig();
            } catch {
                if (!closed) retry = window.setTimeout(connect, 5000);
            }
        };

        refreshConfig();
        connect();
        return () => {
            closed = true;
            window.clearTimeout(retry);
            window.clearTimeout(configTimer);
            connection?.stop();
        };
    }, [channel, sourceParam]);

    return config.mode === 'bubbles'
        ? <BubblesStage engine={bubbles} config={config} />
        : <ChatBox items={feed.items} config={config} />;
}
