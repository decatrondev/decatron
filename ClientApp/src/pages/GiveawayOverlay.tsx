import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import GiveawayStage, { showHideCss } from './features/giveaway-extension/overlay/GiveawayStage';
import { OVERLAY_CANVAS, mergeAppearance, parseUtc } from './features/giveaway-extension/overlay/model';
import type { OverlaySnapshot } from './features/giveaway-extension/overlay/model';

/**
 * Overlay del giveaway para OBS. El servidor manda la foto completa del sorteo (fase, ganador, tiempos) y este componente
 * solo la dibuja. Patrón multiplataforma: .dev/plans/MULTIPLATAFORMA_PATRON.md (pregunta la clave al conectar y en cada
 * reconexión, un solo grupo overlay_{clave}, ?source=all|twitch|kick filtra la lista de entradas).
 */
export default function GiveawayOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';
    const sourceParam = (searchParams.get('source') || '').toLowerCase();

    const [snapshot, setSnapshot] = useState<OverlaySnapshot | null>(null);
    // Lo que se dibuja: al terminar el giveaway se conserva la última foto mientras corre la animación de salida
    const [shown, setShown] = useState<OverlaySnapshot | null>(null);
    const [leaving, setLeaving] = useState(false);
    const [clockOffset, setClockOffset] = useState(0);
    const [scale, setScale] = useState(() => Math.min(window.innerWidth / OVERLAY_CANVAS.width, window.innerHeight / OVERLAY_CANVAS.height));

    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const sourceRef = useRef<'all' | 'twitch' | 'kick'>('all');

    useEffect(() => {
        const onResize = () => setScale(Math.min(window.innerWidth / OVERLAY_CANVAS.width, window.innerHeight / OVERLAY_CANVAS.height));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (!channel) return;
        let disposed = false;
        let retry: ReturnType<typeof setTimeout> | null = null;
        let groupKey = channel;

        // UN solo reintento pendiente: un arranque fallido dispara a la vez el catch y onclose, y sin esta guarda cada
        // fallo duplicaba los reintentos (16 conexiones tras un reinicio del servidor)
        const scheduleRetry = () => {
            if (disposed || retry) return;
            retry = setTimeout(() => { retry = null; connect(); }, 5000);
        };

        const accept = (raw: OverlaySnapshot) => {
            const snap = { ...raw, appearance: mergeAppearance(raw.appearance) };
            setClockOffset(parseUtc(raw.serverNow) - Date.now());
            setSnapshot(snap);
        };

        // A qué grupo unirse y qué mostraba este enlace antes; también trae la foto actual
        const resolve = async () => {
            const res = await fetch(`/api/giveaway-overlay/${encodeURIComponent(channel)}`);
            const data = await res.json();
            if (data?.found) {
                groupKey = data.overlayKey;
                const variant = ['all', 'twitch', 'kick'].includes(sourceParam) ? sourceParam : data.variant;
                sourceRef.current = (['all', 'twitch', 'kick'].includes(variant) ? variant : 'all') as 'all' | 'twitch' | 'kick';
                if (data.snapshot) accept(data.snapshot);
            }
        };

        const join = async (connection: signalR.HubConnection) => {
            await resolve();
            await connection.invoke('JoinChannel', groupKey);
            await connection.invoke('RegisterOverlay', groupKey, 'giveaway');
            await connection.invoke('SetOverlayVariant', sourceRef.current);
        };

        const connect = async () => {
            if (disposed) return;
            connectionRef.current?.stop().catch(() => undefined);
            connectionRef.current = null;
            try {
                const connection = new signalR.HubConnectionBuilder()
                    .withUrl(`${window.location.origin}/hubs/overlay`, { withCredentials: false })
                    .withAutomaticReconnect()
                    .configureLogging(signalR.LogLevel.Warning)
                    .build();

                connection.on('GiveawayState', (snap: OverlaySnapshot) => accept(snap));
                connection.onreconnected(async () => {
                    try { await join(connection); } catch (err) { console.error('[GIVEAWAY] Error al volver a unirse:', err); }
                });
                connection.onclose(() => scheduleRetry());

                connectionRef.current = connection;
                await connection.start();
                await join(connection);
            } catch (err) {
                console.error('[GIVEAWAY] Error de conexión:', err);
                scheduleRetry();
            }
        };

        connect();
        return () => {
            disposed = true;
            if (retry) clearTimeout(retry);
            connectionRef.current?.stop();
        };
    }, [channel, sourceParam]);

    useEffect(() => {
        if (!snapshot) return;
        if (snapshot.phase !== 'idle') {
            setShown(snapshot);
            setLeaving(false);
            return;
        }
        if (!shown) return;
        setLeaving(true);
        const exit = shown.appearance.exit;
        const id = setTimeout(() => { setShown(null); setLeaving(false); }, exit.type === 'none' ? 0 : exit.durationMs);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [snapshot]);

    if (!shown) return <div style={{ width: '100vw', height: '100vh' }} />;

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'transparent' }}>
            <div style={{ width: OVERLAY_CANVAS.width, height: OVERLAY_CANVAS.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <div style={{
                    width: OVERLAY_CANVAS.width, height: OVERLAY_CANVAS.height,
                    animation: leaving ? showHideCss(shown.appearance.exit, false) : undefined,
                    ['--mo-w' as string]: `${OVERLAY_CANVAS.width}px`, ['--mo-h' as string]: `${OVERLAY_CANVAS.height}px`,
                }}>
                    <GiveawayStage snapshot={shown} clockOffsetMs={clockOffset} source={sourceRef.current} audio />
                </div>
            </div>
        </div>
    );
}
