import { useEffect, useId, useRef, useState } from 'react';
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
    // Mientras reproduce, el ratón no llega al iframe de Twitch: al pasar por encima el player reacciona (se detiene y carga de
    // nuevo) y aquí no hay controles que usar. Si se pausa o falla, vuelve a recibir el ratón (botón de play, avisos de Twitch).
    const [playing, setPlaying] = useState(false);
    // Reanudaciones automáticas: con límite y espera, para no interrumpir un anuncio o la carga del player con play() repetidos.
    const lastPlay = useRef(0);
    const playTries = useRef(0);
    const autoPlay = (why: string) => {
        const p = player.current;
        if (!p || !ready.current || document.hidden || !online.current) return;
        const now = Date.now();
        if (now - lastPlay.current < 12_000 || playTries.current >= 3) return;
        try {
            if (p.isPaused()) { lastPlay.current = now; playTries.current += 1; p.play(); mvLog(`${channel} play (${why})`); }
        } catch { /* el player aún no responde */ }
    };
    // Antes del primer gesto del usuario el navegador solo permite autoplay en silencio. Después, una casilla sin
    // audio queda con el sonido activo pero en volumen 0: un video «silenciado» es el que Chrome pausa al salir de
    // vista o al cambiar de pestaña.
    const muted = !unlocked;
    // Las casillas sin audio quedan en un volumen casi inaudible (1%) en lugar de 0: con 0 el player de Twitch las trata como
    // silenciadas y las pausa al cambiar de pestaña.
    const effVolume = hasAudio ? volume : 0.01;
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
            p.addEventListener(T.Player.OFFLINE, () => { online.current = false; setPlaying(false); onLiveRef.current(false); });
            p.addEventListener(T.Player.PLAYING, () => { playTries.current = 0; setPlaying(true); onLiveRef.current(true); applyQuality(); mvLog(`${channel} PLAYING (${document.visibilityState})`); });
            // Nadie pausa a mano (no hay botón de pausa): si Twitch pausa con la pestaña a la vista, se reanuda con calma.
            p.addEventListener(T.Player.PAUSE, () => {
                mvLog(`${channel} PAUSE (${document.visibilityState})`);
                setPlaying(false);
                window.setTimeout(() => autoPlay('pausa'), 1500);
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
    const kick = autoPlay;
    useEffect(() => { if (unlocked) kick('primer gesto'); }, [unlocked]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        const id = window.setInterval(() => kick('vigilante'), 4000);
        return () => window.clearInterval(id);
    }, [channel]); // eslint-disable-line react-hooks/exhaustive-deps

    // Si el navegador pausó la casilla mientras la pestaña estaba oculta, se reanuda al volver.
    useEffect(() => {
        const resume = () => {
            if (document.hidden || !ready.current) return;
            // Al volver a la pestaña se da un momento a que el player (y un posible anuncio) se acomoden antes de pedir play
            playTries.current = 0;
            window.setTimeout(() => autoPlay('volvió a la vista'), 2000);
        };
        document.addEventListener('visibilitychange', resume);
        window.addEventListener('focus', resume);
        return () => { document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); };
    }, []);
    useEffect(() => { applyQuality(); }, [quality]);

    return <div id={domId} className={`absolute inset-0 [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:h-full [&>iframe]:w-full ${playing ? '[&>iframe]:pointer-events-none' : ''}`} />;
}
