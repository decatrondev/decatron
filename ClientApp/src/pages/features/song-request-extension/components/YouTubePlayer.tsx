import { useEffect, useRef } from 'react';

// Reproductor embebido de YouTube (IFrame Player API, sin key). Carga el video del pedido
// actual, respeta pausa y volumen, y avisa: terminó, error y avance (~1 por segundo).

declare global {
    interface Window {
        YT?: any;
        onYouTubeIframeAPIReady?: () => void;
    }
}

let apiPromise: Promise<any> | null = null;

function loadYouTubeApi(): Promise<any> {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise(resolve => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
    });
    return apiPromise;
}

export interface PlayerItem {
    id: number;
    videoId: string;
}

interface Props {
    item: PlayerItem | null;
    paused: boolean;
    volume: number;
    onEnded: (itemId: number) => void;
    onError: (itemId: number, code: number) => void;
    onProgress: (itemId: number, position: number, duration: number, playing: boolean) => void;
}

const STATE_ENDED = 0;
const STATE_PLAYING = 1;

export default function YouTubePlayer({ item, paused, volume, onEnded, onError, onProgress }: Props) {
    const host = useRef<HTMLDivElement>(null);
    const player = useRef<any>(null);
    const ready = useRef(false);
    const loadedItem = useRef<number | null>(null);
    // Lo último de las props, para los callbacks del reproductor (se crean una sola vez)
    const latest = useRef({ item, paused, volume, onEnded, onError, onProgress });
    latest.current = { item, paused, volume, onEnded, onError, onProgress };

    const sync = () => {
        const p = player.current;
        if (!p || !ready.current) return;
        const { item: it, paused: isPaused, volume: vol } = latest.current;
        p.setVolume?.(vol);
        if (!it) {
            if (loadedItem.current !== null) { p.stopVideo?.(); loadedItem.current = null; }
            return;
        }
        if (loadedItem.current !== it.id) {
            loadedItem.current = it.id;
            if (isPaused) p.cueVideoById?.(it.videoId);
            else p.loadVideoById?.(it.videoId);
            return;
        }
        const state = p.getPlayerState?.();
        if (isPaused && state === STATE_PLAYING) p.pauseVideo?.();
        if (!isPaused && state !== STATE_PLAYING && state !== STATE_ENDED) p.playVideo?.();
    };

    useEffect(() => {
        let destroyed = false;
        loadYouTubeApi().then(YT => {
            if (destroyed || !host.current) return;
            const mount = document.createElement('div');
            host.current.appendChild(mount);
            player.current = new YT.Player(mount, {
                width: '100%',
                height: '100%',
                playerVars: { autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0 },
                events: {
                    onReady: () => { ready.current = true; sync(); },
                    onStateChange: (e: any) => {
                        const it = latest.current.item;
                        if (e.data === STATE_ENDED && it && loadedItem.current === it.id) latest.current.onEnded(it.id);
                    },
                    onError: (e: any) => {
                        const it = latest.current.item;
                        if (it && loadedItem.current === it.id) latest.current.onError(it.id, Number(e.data) || 0);
                    },
                },
            });
        });

        const interval = window.setInterval(() => {
            const p = player.current;
            const it = latest.current.item;
            if (!p || !ready.current || !it || loadedItem.current !== it.id) return;
            const duration = p.getDuration?.() || 0;
            const position = p.getCurrentTime?.() || 0;
            latest.current.onProgress(it.id, position, duration, p.getPlayerState?.() === STATE_PLAYING);
        }, 1000);

        return () => {
            destroyed = true;
            window.clearInterval(interval);
            try { player.current?.destroy?.(); } catch { /* ya no existe */ }
            player.current = null;
            ready.current = false;
            loadedItem.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(sync, [item?.id, item?.videoId, paused, volume]);

    return <div ref={host} style={{ width: '100%', height: '100%' }} />;
}
