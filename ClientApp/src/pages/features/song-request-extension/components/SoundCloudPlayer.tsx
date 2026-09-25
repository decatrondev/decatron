import { useEffect, useRef } from 'react';

// Reproductor embebido de SoundCloud (Widget API, sin key). Misma interfaz que YouTubePlayer:
// carga el tema del pedido actual, respeta pausa y volumen, y avisa: terminó, error y avance.

declare global {
    interface Window {
        SC?: any;
    }
}

let apiPromise: Promise<any> | null = null;

function loadWidgetApi(): Promise<any> {
    if (window.SC?.Widget) return Promise.resolve(window.SC);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://w.soundcloud.com/player/api.js';
        script.async = true;
        script.onload = () => resolve(window.SC);
        script.onerror = () => { apiPromise = null; reject(new Error('soundcloud_api')); };
        document.head.appendChild(script);
    });
    return apiPromise;
}

/** El id guardado es la ruta del tema ("artista/tema"). */
const trackUrl = (sourceId: string) => `https://soundcloud.com/${sourceId}`;

const WIDGET_OPTIONS = {
    visual: true, show_comments: false, hide_related: true, show_user: true, show_reposts: false,
    show_teaser: false, buying: false, sharing: false, download: false, show_playcount: false, show_artwork: true,
};

function widgetSrc(sourceId: string, autoPlay: boolean) {
    const params = new URLSearchParams({ url: trackUrl(sourceId), auto_play: String(autoPlay) });
    for (const [k, v] of Object.entries(WIDGET_OPTIONS)) params.set(k, String(v));
    return `https://w.soundcloud.com/player/?${params}`;
}

export interface SoundCloudItem {
    id: number;
    sourceId: string;
}

interface Props {
    item: SoundCloudItem | null;
    paused: boolean;
    volume: number;
    onEnded: (itemId: number) => void;
    onError: (itemId: number, code: number) => void;
    onProgress: (itemId: number, position: number, duration: number, playing: boolean) => void;
}

export default function SoundCloudPlayer({ item, paused, volume, onEnded, onError, onProgress }: Props) {
    const frame = useRef<HTMLIFrameElement>(null);
    const widget = useRef<any>(null);
    const ready = useRef(false);
    const loadedItem = useRef<number | null>(null);
    const playing = useRef(false);
    // Lo último de las props, para los callbacks del widget (se enlazan una sola vez)
    const latest = useRef({ item, paused, volume, onEnded, onError, onProgress });
    latest.current = { item, paused, volume, onEnded, onError, onProgress };

    const sync = () => {
        const w = widget.current;
        if (!w || !ready.current) return;
        const { item: it, paused: isPaused, volume: vol } = latest.current;
        w.setVolume(vol);
        if (!it) {
            if (loadedItem.current !== null) { w.pause(); loadedItem.current = null; }
            return;
        }
        if (loadedItem.current !== it.id) {
            loadedItem.current = it.id;
            ready.current = false; // hasta el READY del tema nuevo
            w.load(trackUrl(it.sourceId), { ...WIDGET_OPTIONS, auto_play: !isPaused, callback: () => { ready.current = true; sync(); } });
            return;
        }
        if (isPaused && playing.current) w.pause();
        if (!isPaused && !playing.current) w.play();
    };

    useEffect(() => {
        let destroyed = false;
        // TrackPlayer lo monta solo con un tema de SoundCloud: el primero va en el src y el widget arranca ya con él
        const it = latest.current.item;
        if (frame.current && it) {
            frame.current.src = widgetSrc(it.sourceId, !latest.current.paused);
            loadedItem.current = it.id;
        }

        loadWidgetApi().then(SC => {
            if (destroyed || !frame.current) return;
            const w = SC.Widget(frame.current);
            widget.current = w;
            const E = SC.Widget.Events;
            w.bind(E.READY, () => { ready.current = true; sync(); });
            w.bind(E.PLAY, () => { playing.current = true; });
            w.bind(E.PAUSE, () => { playing.current = false; });
            w.bind(E.FINISH, () => {
                playing.current = false;
                const current = latest.current.item;
                if (current && loadedItem.current === current.id) latest.current.onEnded(current.id);
            });
            w.bind(E.ERROR, () => {
                const current = latest.current.item;
                if (current && loadedItem.current === current.id) latest.current.onError(current.id, 0);
            });
        }).catch(() => {
            const current = latest.current.item;
            if (current) latest.current.onError(current.id, 0);
        });

        const interval = window.setInterval(() => {
            const w = widget.current;
            const current = latest.current.item;
            if (!w || !ready.current || !current || loadedItem.current !== current.id) return;
            w.getPosition((position: number) => w.getDuration((duration: number) => {
                if (loadedItem.current === current.id)
                    latest.current.onProgress(current.id, (position || 0) / 1000, (duration || 0) / 1000, playing.current);
            }));
        }, 1000);

        return () => {
            destroyed = true;
            window.clearInterval(interval);
            try { widget.current?.unbind?.(window.SC?.Widget?.Events?.FINISH); } catch { /* ya no existe */ }
            widget.current = null;
            ready.current = false;
            loadedItem.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(sync, [item?.id, item?.sourceId, paused, volume]);

    return (
        <iframe
            ref={frame}
            title="SoundCloud"
            allow="autoplay; encrypted-media"
            style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
    );
}
