import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import MusicOverlayRenderer, { type OverlayLabels } from '../components/music-overlay/MusicOverlayRenderer';
import { useLayoutFonts } from '../components/music-overlay/utils';
import type { MusicTrack, OverlayLayout, PlaybackProgress } from '../components/music-overlay/types';
import { normalizeNowPlayingLayout } from './features/now-playing-extension/convertLegacy';
import { trackFromApi, type NowPlayingTrackData } from './features/now-playing-extension/liveTrack';

// Overlay de Now Playing para OBS (/overlay/now-playing?channel=X). Dibuja con el motor compartido
// (el mismo de la vista previa y el editor). Las configs viejas se convierten al leer y se ven igual.

const LABELS: OverlayLabels = { requestedBy: '', next: '', fallback: '', idle: '' };
/** Sin avisos del servidor en este tiempo, se oculta (como antes). */
const STALE_MS = 30000;

export default function NowPlayingOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';

    const [layout, setLayout] = useState<OverlayLayout>(() => normalizeNowPlayingLayout({}));
    const [enabled, setEnabled] = useState(true);
    const [current, setCurrent] = useState<MusicTrack | null>(null);
    const [progress, setProgress] = useState<PlaybackProgress | null>(null);
    const [hidden, setHidden] = useState(true);
    const [fading, setFading] = useState(false);
    const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
    useLayoutFonts([layout]);

    const layoutRef = useRef(layout);
    layoutRef.current = layout;
    const currentRef = useRef<MusicTrack | null>(null);
    const hiddenRef = useRef(true);
    const lastUpdateRef = useRef(0);
    const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const fetchConfig = useCallback(async () => {
        if (!channel) return;
        try {
            const res = await fetch(`/api/nowplaying/config/overlay/${channel}`);
            if (!res.ok) return;
            const data = (await res.json())?.config;
            if (!data) return;
            setEnabled(data.isEnabled ?? true);
            setLayout(normalizeNowPlayingLayout(data.config ?? {}));
        } catch (err) {
            console.error('[NowPlayingOverlay] Error cargando la config:', err);
        }
    }, [channel]);

    const stop = useCallback(() => {
        hiddenRef.current = true;
        setHidden(true);
        // Siempre visible: queda el mensaje de "nada sonando" en vez de la última canción
        if (!layoutRef.current.animations.hideWhenIdle) { currentRef.current = null; setCurrent(null); }
    }, []);

    const handleUpdate = useCallback((data: NowPlayingTrackData) => {
        lastUpdateRef.current = Date.now();
        if (!data?.isPlaying || !data.song) { stop(); return; }
        const { track, progress: p } = trackFromApi(data);
        const prev = currentRef.current;
        const isNew = !prev || prev.id !== track.id;
        const show = () => {
            currentRef.current = track;
            setCurrent(track);
            setProgress(p);
            hiddenRef.current = false;
            setHidden(false);
        };
        const a = layoutRef.current.animations;
        if (isNew && prev && !hiddenRef.current && a.songChangePanel && a.songChange !== 'none') {
            // Como el overlay viejo: primero se desvanece la canción anterior y después entra la nueva
            if (swapTimer.current) clearTimeout(swapTimer.current);
            setFading(true);
            swapTimer.current = setTimeout(() => { setFading(false); show(); }, a.durationMs);
            return;
        }
        show();
    }, [stop]);

    const fetchCurrent = useCallback(async () => {
        if (!channel) return;
        try {
            const res = await fetch(`/api/nowplaying/now/${channel}`);
            if (!res.ok) return;
            const data = (await res.json())?.data;
            if (data?.isPlaying && data.song) handleUpdate(data);
        } catch (err) {
            console.error('[NowPlayingOverlay] Error cargando la canción:', err);
        }
    }, [channel, handleUpdate]);

    // Sin avisos en 30 s: se oculta. Solo con Spotify, que avisa en cada consulta; Last.fm avisa solo
    // cuando cambia la canción (antes el overlay se ocultaba a los 30 s de cada canción con Last.fm)
    useEffect(() => {
        if (hidden || current?.source !== 'spotify') return;
        const id = setInterval(() => { if (Date.now() - lastUpdateRef.current > STALE_MS) stop(); }, 5000);
        return () => clearInterval(id);
    }, [hidden, current, stop]);

    useEffect(() => {
        if (!channel) return;
        fetchConfig();
        fetchCurrent();

        let stopped = false;
        let retry: ReturnType<typeof setTimeout> | null = null;
        let connection: signalR.HubConnection | null = null;

        const connect = async () => {
            if (stopped) return;
            connection = new signalR.HubConnectionBuilder()
                .withUrl('/hubs/overlay')
                .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
                .configureLogging(signalR.LogLevel.None)
                .build();
            connection.on('NowPlayingUpdate', handleUpdate);
            connection.on('NowPlayingStopped', stop);
            connection.on('NowPlayingConfigChanged', fetchConfig);
            // Mensajes de otros overlays del mismo canal
            for (const ev of ['TimerTick', 'TimerStateUpdate', 'TimerEventAlert', 'ShowEventAlert']) connection.on(ev, () => {});
            connection.onreconnected(async () => {
                try { await connection!.invoke('JoinChannel', channel); fetchCurrent(); } catch (err) { console.error('[NowPlayingOverlay] Error al volver a unirse:', err); }
            });
            connection.onclose(() => { if (!stopped) retry = setTimeout(connect, 5000); });
            try {
                await connection.start();
                if (stopped) { connection.stop(); return; }
                await connection.invoke('JoinChannel', channel);
            } catch (err) {
                if (!stopped) { console.error('[NowPlayingOverlay] Error conectando:', err); retry = setTimeout(connect, 5000); }
            }
        };
        connect();

        return () => {
            stopped = true;
            if (retry) clearTimeout(retry);
            if (swapTimer.current) clearTimeout(swapTimer.current);
            connection?.stop();
        };
    }, [channel, fetchConfig, fetchCurrent, handleUpdate, stop]);

    // La fuente de OBS de otro tamaño que el lienzo: como antes, el widget se ubica en proporción a la
    // fuente pero conserva su tamaño en píxeles (se corre todo lo que se corre su esquina, sin escalar).
    const shift = useMemo(() => {
        const { canvas, elements } = layout;
        if (viewport.width === canvas.width && viewport.height === canvas.height) return { x: 0, y: 0 };
        const on = Object.values(elements).filter(e => e.enabled);
        if (!on.length) return { x: 0, y: 0 };
        const ax = elements.panel.enabled ? elements.panel.x : Math.min(...on.map(e => e.x));
        const ay = elements.panel.enabled ? elements.panel.y : Math.min(...on.map(e => e.y));
        return { x: ax * (viewport.width / canvas.width) - ax, y: ay * (viewport.height / canvas.height) - ay };
    }, [layout, viewport]);

    if (!enabled) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <div style={{
                position: 'absolute', left: 0, top: 0, transform: `translate(${shift.x}px, ${shift.y}px)`,
                opacity: fading ? 0 : 1, transition: fading ? `opacity ${layout.animations.durationMs}ms ease` : 'none',
            }}>
                <MusicOverlayRenderer layout={layout} current={current} queue={[]} progress={progress} paused={false} labels={LABELS} hidden={hidden && layout.animations.hideWhenIdle} />
            </div>
        </div>
    );
}
