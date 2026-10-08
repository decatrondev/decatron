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

export default function ChatOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';
    const sourceParam = searchParams.get('source');

    const [config, setConfig] = useState<ChatOverlayConfig>(DEFAULT_CHAT_CONFIG);
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

        // Clave real del grupo: puede no ser la del enlace (kick_<id>, KickId) si la cuenta tiene otro canal principal
        let overlayKey = channel;

        const resolveChannel = async () => {
            let legacyVariant: string | null = null;
            try {
                const res = await fetch(`/api/chat-overlay/resolve/${encodeURIComponent(channel)}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && json.found) {
                        overlayKey = json.overlayKey || channel;
                        legacyVariant = json.variant || null;
                    }
                }
            } catch { /* sin respuesta se usa el enlace tal cual, como antes */ }
            const explicit = ['all', 'twitch', 'kick'].includes((sourceParam || '').toLowerCase()) ? (sourceParam as string).toLowerCase() : null;
            const variant = explicit ?? legacyVariant;
            sourceRef.current = variant && variant !== 'all' ? variant : null;
        };

        const loadConfiguration = async () => {
            try {
                const res = await fetch(`/api/chat-overlay/config/overlay/${encodeURIComponent(channel)}`);
                if (!res.ok) return;
                const json = await res.json();
                if (json.success) setConfig(normalizeChatConfig(json.config));
            } catch { /* se queda con la última */ }
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
                connection.on('ConfigurationChanged', () => { loadConfiguration(); });
                connection.onreconnected(async () => {
                    try { await loadConfiguration(); await join(connection!); } catch { /* el siguiente intento lo reintenta */ }
                });
                connection.onclose(() => { if (!closed) retry = window.setTimeout(connect, 5000); });

                await connection.start();
                await join(connection);
            } catch {
                if (!closed) retry = window.setTimeout(connect, 5000);
            }
        };

        loadConfiguration();
        connect();
        return () => {
            closed = true;
            window.clearTimeout(retry);
            connection?.stop();
        };
    }, [channel, sourceParam]);

    return config.mode === 'bubbles'
        ? <BubblesStage engine={bubbles} config={config} />
        : <ChatBox items={feed.items} config={config} />;
}
