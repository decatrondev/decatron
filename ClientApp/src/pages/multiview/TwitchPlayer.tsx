import { useEffect, useId, useRef } from 'react';
import { loadTwitchEmbed, pickQuality, type TwitchPlayerApi } from './twitchEmbed';
import { mvLog } from './debug';
import type { QualityChoice } from './types';

interface Props {
    channel: string;
    /** Si esta casilla tiene el audio. Las demás no se silencian: se dejan en volumen 0 (ver `unlocked`). */
    hasAudio: boolean;
    volume: number;
    /** El usuario ya tocó la página: desde ahí el navegador deja reproducir con audio activo. */
    unlocked: boolean;
    quality: QualityChoice;
    onLive: (live: boolean) => void;
}

/** Player de Twitch con la API oficial: silencio, volumen y calidad se controlan desde la barra de la casilla. */
export default function TwitchPlayer({ channel, hasAudio, volume, unlocked, quality, onLive }: Props) {
    const domId = 'mv-tw-' + useId().replace(/:/g, '');
    const player = useRef<TwitchPlayerApi | null>(null);
    const ready = useRef(false);
    const resumes = useRef<number[]>([]);
    const online = useRef(true);
    // Antes del primer gesto del usuario el navegador solo permite autoplay en silencio. Después, una casilla sin
    // audio queda con el sonido activo pero en volumen 0: un video «silenciado» es el que Chrome pausa al salir de
    // vista o al cambiar de pestaña.
    const muted = !unlocked;
    const effVolume = hasAudio ? volume : 0;
    const latest = useRef({ muted, volume: effVolume, quality });
    latest.current = { muted, volume: effVolume, quality };
    const onLiveRef = useRef(onLive);
    onLiveRef.current = onLive;

    const applyQuality = () => {
        const p = player.current;
        if (!p || !ready.current) return;
        try {
            const q = latest.current.quality;
            if (q === 'auto') { p.setQuality('auto'); return; }
            const name = pickQuality(p.getQualities(), Number(q));
            if (name) p.setQuality(name);
        } catch { /* el player aún no tiene la lista de calidades */ }
    };

    useEffect(() => {
        let cancelled = false;
        ready.current = false;
        loadTwitchEmbed().then(T => {
            if (cancelled) return;
            const p = new T.Player(domId, {
                channel,
                parent: [window.location.hostname],
                width: '100%',
                height: '100%',
                autoplay: true,
                muted: true,
                controls: false,
            });
            player.current = p;
            p.addEventListener(T.Player.READY, () => { ready.current = true; p.setMuted(latest.current.muted); p.setVolume(latest.current.volume); });
            p.addEventListener(T.Player.ONLINE, () => { online.current = true; onLiveRef.current(true); });
            p.addEventListener(T.Player.OFFLINE, () => { online.current = false; onLiveRef.current(false); });
            p.addEventListener(T.Player.PLAYING, () => { onLiveRef.current(true); applyQuality(); mvLog(`${channel} PLAYING (${document.visibilityState})`); });
            // Nadie pausa a mano (no hay botón de pausa): si Twitch pausa con la pestaña a la vista, se reanuda.
            // Tope de 5 por medio minuto para no pelear con el player si insiste.
            p.addEventListener(T.Player.PAUSE, () => {
                mvLog(`${channel} PAUSE (${document.visibilityState})`);
                const now = Date.now();
                resumes.current = resumes.current.filter(t => now - t < 30_000);
                if (document.hidden || resumes.current.length >= 5) return;
                resumes.current.push(now);
                window.setTimeout(() => { try { if (!document.hidden && player.current?.isPaused()) { player.current.play(); mvLog(`${channel} reanudada`); } } catch { /* sin respuesta */ } }, 400);
            });
        }).catch(() => { /* sin script de Twitch: la casilla queda vacía y el aviso lo da la barra */ });
        return () => {
            cancelled = true;
            try { player.current?.destroy?.(); } catch { /* ya destruido */ }
            player.current = null;
            const el = document.getElementById(domId);
            if (el) el.innerHTML = '';
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channel, domId]);

    useEffect(() => {
        if (!ready.current) return;
        player.current?.setMuted(muted);
        player.current?.setVolume(effVolume);
    }, [muted, effVolume]);

    // El player de Twitch puede quedarse detenido sin avisar (autoplay bloqueado: se ve borroso con un botón de play,
    // o pausado por el navegador). Un vigilante lo arranca si la pestaña está a la vista y el canal está en vivo.
    const kick = (why: string) => {
        const p = player.current;
        if (!p || !ready.current || document.hidden || !online.current) return;
        try { if (p.isPaused()) { p.play(); mvLog(`${channel} play (${why})`); } } catch { /* el player aún no responde */ }
    };
    useEffect(() => { if (unlocked) kick('primer gesto'); }, [unlocked]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        const id = window.setInterval(() => kick('vigilante'), 4000);
        return () => window.clearInterval(id);
    }, [channel]); // eslint-disable-line react-hooks/exhaustive-deps

    // Si el navegador pausó la casilla mientras la pestaña estaba oculta, se reanuda al volver.
    useEffect(() => {
        const resume = () => {
            if (document.hidden || !ready.current) return;
            try { if (player.current?.isPaused()) player.current.play(); } catch { /* el player aún no responde */ }
        };
        document.addEventListener('visibilitychange', resume);
        window.addEventListener('focus', resume);
        return () => { document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); };
    }, []);
    useEffect(() => { applyQuality(); }, [quality]);

    return <div id={domId} className="absolute inset-0 [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:h-full [&>iframe]:w-full" />;
}
