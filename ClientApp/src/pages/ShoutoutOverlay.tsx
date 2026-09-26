import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import ShoutoutRenderer, { type Phase } from '../components/shoutout-overlay/ShoutoutRenderer';
import { normalizeShoutoutLayout } from '../components/shoutout-overlay/convertLegacy';
import { useGoogleFonts } from '../components/music-overlay/utils';
import type { ShoutoutData, ShoutoutLayout } from '../components/shoutout-overlay/types';

// Overlay de OBS del !so (.dev/plans/SHOUTOUT_REDESIGN_PLAN.md, fase 1). Dibuja con el mismo renderer que la
// vista previa y el editor. Tiempos como siempre: sin clip, como mucho 5 s; con clip, la duración configurada
// o hasta que termina el clip; y un cierre de seguridad por si algo falla.

/** Con clip, cuánto más que la duración espera el cierre de seguridad (el viejo cortaba a los 30 s justos). */
const SAFETY_EXTRA_MS = 5000;
const NO_CLIP_MAX_S = 5;

export default function ShoutoutOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';

    const [layout, setLayout] = useState<ShoutoutLayout>(() => normalizeShoutoutLayout({}));
    const [data, setData] = useState<ShoutoutData | null>(null);
    const [phase, setPhase] = useState<Phase>('enter');
    const [remaining, setRemaining] = useState(0);
    const [effective, setEffective] = useState(0);
    const [showId, setShowId] = useState(0);

    const layoutRef = useRef(layout);
    layoutRef.current = layout;
    const durationRef = useRef(10);
    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const timers = useRef<{ interval?: number; close?: number; safety?: number; exit?: number }>({});
    const state = useRef({ visible: false, exiting: false });

    useGoogleFonts(layout.elements.map(e => e.text?.fontFamily), 'so-fonts');

    const clearTimers = () => {
        const t = timers.current;
        window.clearInterval(t.interval);
        window.clearTimeout(t.close);
        window.clearTimeout(t.safety);
        window.clearTimeout(t.exit);
        timers.current = {};
    };

    const stopVideo = () => {
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    const hide = () => {
        clearTimers();
        stopVideo();
        state.current = { visible: false, exiting: false };
        setData(null);
        setRemaining(0);
    };

    const close = () => {
        if (state.current.exiting || !state.current.visible) return;
        const t = timers.current;
        window.clearInterval(t.interval);
        window.clearTimeout(t.close);
        stopVideo();
        state.current.exiting = true;
        const exit = layoutRef.current.animations.exit;
        const ms = exit.type === 'none' ? 0 : exit.durationMs;
        setPhase('exit');
        t.exit = window.setTimeout(hide, ms);
    };

    const show = (d: ShoutoutData) => {
        clearTimers();
        const seconds = d.clipUrl ? durationRef.current : Math.min(durationRef.current, NO_CLIP_MAX_S);
        state.current = { visible: true, exiting: false };
        setData(d);
        setPhase('enter');
        setShowId(n => n + 1);
        setRemaining(seconds);
        setEffective(seconds);
        const t = timers.current;
        t.interval = window.setInterval(() => setRemaining(r => {
            if (r <= 1) { window.clearInterval(timers.current.interval); return 0; }
            return r - 1;
        }), 1000);
        t.close = window.setTimeout(close, seconds * 1000);
        // Por si el cierre normal falla: siempre se va
        t.safety = window.setTimeout(hide, Math.max(30000, seconds * 1000 + SAFETY_EXTRA_MS));
    };

    const loadConfiguration = async () => {
        if (!channel) return;
        try {
            const res = await fetch(`/api/shoutout/config/overlay/${channel}`);
            if (!res.ok) return;
            const json = await res.json();
            if (json.success && json.config) {
                durationRef.current = json.config.duration || 10;
                setLayout(normalizeShoutoutLayout(json.config));
            }
        } catch (err) {
            console.error('Error loading overlay config:', err);
        }
    };

    const connect = async () => {
        if (!channel) return;
        try {
            const connection = new signalR.HubConnectionBuilder()
                .withUrl(`${window.location.origin}/hubs/overlay`, { withCredentials: false })
                .withAutomaticReconnect()
                .configureLogging(signalR.LogLevel.Warning)
                .build();

            // Los listeners antes de conectar
            connection.on('ShowShoutout', (d: any) => show({
                targetUser: d.targetUser,
                displayName: d.displayName,
                gameName: d.gameName,
                clipUrl: d.clipUrl,
                profileImageUrl: d.profileImageUrl,
                title: d.title,
                tags: d.tags,
                broadcasterType: d.broadcasterType,
                isLive: d.isLive,
                followers: d.followers,
                clipTitle: d.clipTitle,
                clipViews: d.clipViews,
                clipCreator: d.clipCreator,
            }));
            connection.on('ConfigurationChanged', () => { loadConfiguration(); });
            connection.onreconnected(async () => {
                try {
                    await loadConfiguration();
                    await connection.invoke('JoinChannel', channel);
                } catch (err) {
                    console.error('[SHOUTOUT] Error al re-unirse al canal:', err);
                }
            });
            connection.onclose(() => { window.setTimeout(connect, 5000); });

            await connection.start();
            await connection.invoke('JoinChannel', channel);
            connectionRef.current = connection;
        } catch {
            window.setTimeout(connect, 5000);
        }
    };

    useEffect(() => {
        loadConfiguration();
        connect();
        return () => {
            clearTimers();
            connectionRef.current?.stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channel]);

    if (!data) return null;
    return (
        <ShoutoutRenderer
            key={showId}
            layout={layout}
            data={data}
            phase={phase}
            remaining={remaining}
            durationSec={effective}
            videoRef={videoRef}
            onVideoEnded={close}
        />
    );
}
