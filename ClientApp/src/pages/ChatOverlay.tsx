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
// ?channel=<login>  [&source=twitch|kick]  El source deja pasar solo los mensajes de esa plataforma.

export default function ChatOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';
    const source = searchParams.get('source');

    const [config, setConfig] = useState<ChatOverlayConfig>(DEFAULT_CHAT_CONFIG);
    const feed = useChatFeed(config);
    const bubbles = useBubbles(config);
    // Los mensajes van al modo que esté activo; el otro no gasta nada
    const sink = useRef({ push: feed.push, remove: feed.remove, removeUser: feed.removeUser, clear: feed.clear });
    const active = config.mode === 'bubbles' ? bubbles : feed;
    sink.current = { push: active.push, remove: active.remove, removeUser: active.removeUser, clear: active.clear };
    const feedRef = sink;
    const sourceRef = useRef(source);
    sourceRef.current = source;

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

        const loadConfiguration = async () => {
            try {
                const res = await fetch(`/api/chat-overlay/config/overlay/${encodeURIComponent(channel)}`);
                if (!res.ok) return;
                const json = await res.json();
                if (json.success) setConfig(normalizeChatConfig(json.config));
            } catch { /* se queda con la última */ }
        };

        const join = async (c: signalR.HubConnection) => {
            await c.invoke('JoinChannel', channel);
            // Sin esto el servidor no sabe que hay un overlay de chat y no manda nada
            await c.invoke('RegisterOverlay', channel, 'chat');
        };

        const connect = async () => {
            if (closed) return;
            try {
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
    }, [channel]);

    return config.mode === 'bubbles'
        ? <BubblesStage engine={bubbles} config={config} />
        : <ChatBox items={feed.items} config={config} />;
}
