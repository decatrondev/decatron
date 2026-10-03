import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { loadYouTubeApi } from '../features/song-request-extension/components/YouTubePlayer';
import { formatDuration } from './shared';
import type { PublicPlaylistItem } from './PlaylistPanel';

// El reproductor del viewer en /sr/{canal}/p/{código} (SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 2).
// Es del navegador de quien escucha: no toca el stream ni la cola. Embed de YouTube (IFrame API, sin key).

export type Repeat = 'off' | 'all' | 'one';

const STATE_ENDED = 0;
const STATE_PLAYING = 1;
const STATE_PAUSED = 2;
/** 100 = no existe o es privado; 101 y 150 = el dueño no deja reproducirlo fuera de YouTube. */
const BLOCKED_ERRORS = [100, 101, 150];

interface Saved { trackId?: number; position?: number; shuffle?: boolean; repeat?: Repeat }

const VOLUME_KEY = 'sr_listen_volume';
const VISITOR_KEY = 'sr_listen_visitor';
/** Segundos escuchados de una canción para que cuente como una escucha. */
const LISTEN_AFTER = 30;
/** Cada cuánto se avisa que se sigue escuchando (el servidor pide al menos 20 s entre señales). */
const BEAT_EVERY = 30;

/** Un id aleatorio de este navegador: sin cuenta, sin IP, nada que identifique a la persona (fase 4: estadísticas anónimas). */
function visitorId(): string {
    try {
        let id = localStorage.getItem(VISITOR_KEY);
        if (!id) {
            id = (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.()
                ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
            localStorage.setItem(VISITOR_KEY, id);
        }
        return id;
    } catch { return ''; }
}
const saveKey = (channel: string, code: string) => `sr_listen_v1_${channel.toLowerCase()}_${code}`;

function readJson<T>(key: string): T | null {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
function writeJson(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* modo privado o sin espacio: no se recuerda */ }
}

/** Solo YouTube se reproduce acá: el resto se resolvió a YouTube al importar o se abre en su servicio. */
export const isPlayable = (item: PublicPlaylistItem) => item.track.source === 'youtube' && !!item.track.sourceId;

function shuffled(ids: number[], first: number | null): number[] {
    const rest = ids.filter(id => id !== first);
    for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return first != null && ids.includes(first) ? [first, ...rest] : rest;
}

export function useListenPlayer(channel: string, code: string, items: PublicPlaylistItem[] | null) {
    // El contenedor aparece cuando carga la lista: el reproductor se crea recién ahí
    const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
    const player = useRef<any>(null);
    const ready = useRef(false);
    const loadedTrack = useRef<number | null>(null);
    const restored = useRef(false);
    /** Dónde retomar si la canción guardada se eligió antes de que el reproductor estuviera listo. */
    const pendingStart = useRef(0);

    const [now, setNow] = useState<PublicPlaylistItem | null>(null);
    const [playing, setPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolumeState] = useState(() => {
        const raw = readJson<number>(VOLUME_KEY);
        return typeof raw === 'number' && raw >= 0 && raw <= 100 ? raw : 80;
    });
    const [shuffle, setShuffle] = useState(false);
    const [repeat, setRepeat] = useState<Repeat>('off');
    /** Canciones que YouTube no deja reproducir acá (por trackId): se saltan y quedan marcadas. */
    const [blocked, setBlocked] = useState<Set<number>>(new Set());
    const [order, setOrder] = useState<number[]>([]);

    // Lo último, para los callbacks del reproductor (se crean una sola vez)
    const latest = useRef({ items, now, order, repeat, blocked, volume });
    latest.current = { items, now, order, repeat, blocked, volume };

    // Estadísticas anónimas: lo que se escucha de verdad (no hay nada sin reproducir)
    const stats = useRef({ unreported: 0, trackPlayed: 0, listenSent: false });
    const reportRef = useRef<(event: 'beat' | 'stop' | 'listen' | 'unplayable', trackId?: number, seconds?: number) => void>(() => undefined);
    const report = useCallback((event: 'beat' | 'stop' | 'listen' | 'unplayable', trackId?: number, seconds = 0) => {
        const id = visitorId();
        if (!id) return;
        const url = `/api/public/song-request/${encodeURIComponent(channel.toLowerCase())}/playlists/${encodeURIComponent(code)}/listen`;
        const body = JSON.stringify({ visitorId: id, event, trackId, seconds: Math.min(70, Math.round(seconds)) });
        try {
            // sendBeacon sobrevive al cierre de la pestaña; sin él, fetch con keepalive
            if (!navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' })))
                fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
        } catch { /* una estadística que falla no molesta a quien escucha */ }
    }, [channel, code]);
    reportRef.current = report;

    const playable = useCallback((item: PublicPlaylistItem) => isPlayable(item) && !latest.current.blocked.has(item.track.trackId), []);

    // El orden de reproducción: el de la playlist, o al azar con la que suena primero
    // (la clave son los ids: un voto cambia el objeto de la lista pero no el orden)
    const idsKey = (items ?? []).map(i => i.id).join(',');
    useEffect(() => {
        const ids = (items ?? []).map(i => i.id);
        setOrder(shuffle ? shuffled(ids, now?.id ?? null) : ids);
        // La lista cambia en vivo: se rehace el orden sin tocar lo que suena
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey, shuffle]);

    const load = useCallback((item: PublicPlaylistItem, autoplay: boolean, startSeconds = 0) => {
        const p = player.current;
        setNow(item);
        setPosition(startSeconds);
        setDuration(item.track.durationSeconds ?? 0);
        if (!p || !ready.current) { pendingStart.current = startSeconds; return; }
        loadedTrack.current = item.track.trackId;
        const args = { videoId: item.track.sourceId, startSeconds };
        if (autoplay) p.loadVideoById?.(args); else p.cueVideoById?.(args);
    }, []);

    /** La siguiente que se pueda reproducir, según el orden y el modo de repetición. null = se acabó. */
    const pickNext = useCallback((from: PublicPlaylistItem | null, direction: 1 | -1, automatic: boolean): PublicPlaylistItem | null => {
        const { items: list, order: seq, repeat: rep } = latest.current;
        if (!list || seq.length === 0) return null;
        const byId = new Map(list.map(i => [i.id, i]));
        const start = from ? seq.indexOf(from.id) : -1;
        for (let step = 1; step <= seq.length; step++) {
            let idx = (start === -1 ? (direction === 1 ? -1 : 0) : start) + direction * step;
            const wrapped = idx >= seq.length || idx < 0;
            // Sin repetir, al final de la lista la reproducción se detiene (a mano sí se puede volver al principio)
            if (wrapped && rep !== 'all' && automatic) return null;
            idx = (idx + seq.length) % seq.length;
            const candidate = byId.get(seq[idx]);
            if (candidate && playable(candidate)) return candidate;
        }
        return null;
    }, [playable]);

    const next = useCallback((automatic = false) => {
        const target = pickNext(latest.current.now, 1, automatic);
        if (target) load(target, true); else if (automatic) setPlaying(false);
    }, [pickNext, load]);

    const prev = useCallback(() => {
        const p = player.current;
        if (p && ready.current && (p.getCurrentTime?.() ?? 0) > 3) { p.seekTo?.(0, true); return; }
        const target = pickNext(latest.current.now, -1, false);
        if (target) load(target, true);
        else p?.seekTo?.(0, true);
    }, [pickNext, load]);

    const toggle = useCallback(() => {
        const p = player.current;
        if (!p || !ready.current) return;
        if (!latest.current.now) {
            const first = pickNext(null, 1, false);
            if (first) load(first, true);
            return;
        }
        if (p.getPlayerState?.() === STATE_PLAYING) p.pauseVideo?.(); else p.playVideo?.();
    }, [pickNext, load]);

    const play = useCallback((item: PublicPlaylistItem) => { if (playable(item)) load(item, true); }, [playable, load]);
    const seek = useCallback((seconds: number) => { player.current?.seekTo?.(seconds, true); setPosition(seconds); }, []);
    const setVolume = useCallback((v: number) => {
        setVolumeState(v);
        writeJson(VOLUME_KEY, v);
        player.current?.setVolume?.(v);
        if (v > 0) player.current?.unMute?.();
    }, []);

    // El reproductor se crea una vez
    useEffect(() => {
        if (!hostEl) return;
        let destroyed = false;
        loadYouTubeApi().then(YT => {
            if (destroyed) return;
            const mount = document.createElement('div');
            hostEl.appendChild(mount);
            player.current = new YT.Player(mount, {
                width: '100%',
                height: '100%',
                playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0 },
                events: {
                    onReady: () => {
                        ready.current = true;
                        player.current.setVolume?.(latest.current.volume);
                        // Si ya había una elegida (guardada) mientras cargaba el reproductor, se deja lista
                        const current = latest.current.now;
                        if (current && loadedTrack.current !== current.track.trackId) {
                            loadedTrack.current = current.track.trackId;
                            player.current.cueVideoById?.({ videoId: current.track.sourceId, startSeconds: pendingStart.current });
                        }
                    },
                    onStateChange: (e: any) => {
                        if (e.data === STATE_PLAYING) setPlaying(true);
                        else if (e.data === STATE_PAUSED) setPlaying(false);
                        else if (e.data === STATE_ENDED) {
                            setPlaying(false);
                            // Si se repite la misma, la próxima vuelta es otra escucha
                            stats.current.trackPlayed = 0;
                            stats.current.listenSent = false;
                            if (latest.current.repeat === 'one') { player.current?.seekTo?.(0, true); player.current?.playVideo?.(); }
                            else next(true);
                        }
                    },
                    onError: (e: any) => {
                        const cur = latest.current.now;
                        if (!cur) return;
                        // El que falla se marca y se pasa a la siguiente (si todas fallan, se detiene sola: pickNext no repite)
                        if (BLOCKED_ERRORS.includes(Number(e.data))) {
                            reportRef.current('unplayable', cur.track.trackId);
                            setBlocked(prev => new Set(prev).add(cur.track.trackId));
                            latest.current.blocked = new Set(latest.current.blocked).add(cur.track.trackId);
                        }
                        next(true);
                    },
                },
            });
        });

        const interval = window.setInterval(() => {
            const p = player.current;
            if (!p || !ready.current || !latest.current.now) return;
            const d = p.getDuration?.() || 0;
            setPosition(p.getCurrentTime?.() || 0);
            if (d > 0) setDuration(d);
        }, 500);

        return () => {
            destroyed = true;
            window.clearInterval(interval);
            try { player.current?.destroy?.(); } catch { /* ya no existe */ }
            player.current = null;
            ready.current = false;
            loadedTrack.current = null;
            hostEl.replaceChildren();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hostEl]);

    // Recuerda por playlist: dónde iba, aleatorio y repetir (la primera vez que llega la lista)
    useEffect(() => {
        if (restored.current || !items || items.length === 0) return;
        restored.current = true;
        const saved = readJson<Saved>(saveKey(channel, code));
        if (!saved) return;
        if (saved.shuffle) setShuffle(true);
        if (saved.repeat === 'all' || saved.repeat === 'one') setRepeat(saved.repeat);
        const item = items.find(i => i.track.trackId === saved.trackId);
        if (item && isPlayable(item)) load(item, false, Math.max(0, Math.floor(saved.position ?? 0)));
    }, [items, channel, code, load]);

    // Se guarda cada 5 s mientras suena, y al pausar o cambiar de canción
    useEffect(() => {
        const save = () => {
            const cur = latest.current.now;
            if (!cur) return;
            writeJson(saveKey(channel, code), {
                trackId: cur.track.trackId,
                position: Math.floor(player.current?.getCurrentTime?.() ?? 0),
                shuffle,
                repeat,
            } satisfies Saved);
        };
        save();
        if (!playing) return;
        const id = window.setInterval(save, 5000);
        return () => window.clearInterval(id);
    }, [channel, code, now?.track.trackId, playing, shuffle, repeat]);

    // Estadísticas: mientras suena, cada segundo suma; cada 30 s se avisa, y a los 30 s de una canción cuenta una escucha
    const trackId = now?.track.trackId;
    useEffect(() => {
        stats.current.trackPlayed = 0;
        stats.current.listenSent = false;
    }, [trackId]);
    useEffect(() => {
        if (!playing || trackId == null) return;
        report('beat', trackId, 0);
        const id = window.setInterval(() => {
            const st = stats.current;
            st.unreported += 1;
            st.trackPlayed += 1;
            if (!st.listenSent && st.trackPlayed >= LISTEN_AFTER) {
                st.listenSent = true;
                report('listen', trackId);
            }
            if (st.unreported >= BEAT_EVERY) {
                report('beat', trackId, st.unreported);
                st.unreported = 0;
            }
        }, 1000);
        return () => {
            window.clearInterval(id);
            // Pausa o cambio de canción: lo que falta por avisar se manda con el cierre
            report('stop', trackId, stats.current.unreported);
            stats.current.unreported = 0;
        };
    }, [playing, trackId, report]);
    useEffect(() => {
        const leave = () => { if (stats.current.unreported > 0 || latest.current.now) { report('stop', latest.current.now?.track.trackId, stats.current.unreported); stats.current.unreported = 0; } };
        window.addEventListener('pagehide', leave);
        return () => window.removeEventListener('pagehide', leave);
    }, [report]);

    // Controles del sistema: pantalla de bloqueo y teclas multimedia (Media Session)
    useEffect(() => {
        if (!('mediaSession' in navigator) || !now) return;
        const ms = navigator.mediaSession;
        try {
            ms.metadata = new MediaMetadata({
                title: now.track.title,
                artist: now.track.artist,
                artwork: now.track.thumbnailUrl ? [{ src: now.track.thumbnailUrl, sizes: '480x360', type: 'image/jpeg' }] : [],
            });
            ms.playbackState = playing ? 'playing' : 'paused';
            ms.setActionHandler('play', () => player.current?.playVideo?.());
            ms.setActionHandler('pause', () => player.current?.pauseVideo?.());
            ms.setActionHandler('previoustrack', () => prev());
            ms.setActionHandler('nexttrack', () => next(false));
            ms.setActionHandler('seekto', d => { if (d.seekTime != null) seek(d.seekTime); });
        } catch { /* navegador sin soporte completo */ }
    }, [now, playing, prev, next, seek]);
    useEffect(() => {
        if (!('mediaSession' in navigator) || !now || duration <= 0) return;
        try { navigator.mediaSession.setPositionState({ duration, position: Math.min(position, duration), playbackRate: 1 }); } catch { /* sin soporte */ }
    }, [now, duration, Math.floor(position / 5)]); // eslint-disable-line react-hooks/exhaustive-deps

    const cycleRepeat = () => setRepeat(r => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'));
    const blockedIds = useMemo(() => blocked, [blocked]);

    return { host: setHostEl, now, playing, position, duration, volume, shuffle, repeat, blocked: blockedIds, toggle, next: () => next(false), prev, play, seek, setVolume, toggleShuffle: () => setShuffle(v => !v), cycleRepeat };
}

type ListenController = ReturnType<typeof useListenPlayer>;

const iconBtn = 'p-2.5 4xl:p-3 rounded-full text-[#d4d4d8] hover:text-white hover:bg-[#18181b] transition-colors disabled:opacity-40';

/** El reproductor con sus controles (la lista de canciones va aparte). */
export function ListenPlayerView({ controller, hasPlayable }: { controller: ListenController; hasPlayable: boolean }) {
    const { t } = useTranslation('commands');
    const c = controller;
    const isMobile = useMemo(() => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent), []);
    const volumeBeforeMute = useRef(80);

    return (
        <div className="mb-6 4xl:mb-10 rounded-xl border border-[#27272a] bg-[#111114] overflow-hidden">
            <div className="aspect-video w-full bg-black max-h-[60vh] mx-auto">
                <div ref={c.host} className="w-full h-full" />
            </div>

            <div className="p-4 4xl:p-6 space-y-3 4xl:space-y-4">
                <div className="min-w-0">
                    <p className="text-white font-bold text-base 3xl:text-lg 4xl:text-2xl break-words">
                        {c.now ? c.now.track.title : (hasPlayable ? t('songRequestPublic.listen.pressPlay') : t('songRequestPublic.listen.nothingToPlay'))}
                    </p>
                    {c.now && <p className="text-sm 3xl:text-base 4xl:text-xl text-[#a1a1aa] truncate">{c.now.track.artist}</p>}
                </div>

                {/* Progreso */}
                <div className="flex items-center gap-3 font-mono text-xs 3xl:text-sm 4xl:text-base text-[#71717a]">
                    <span className="w-12 text-right tabular-nums">{formatDuration(Math.floor(c.position)) || '0:00'}</span>
                    <input
                        type="range"
                        min={0}
                        max={Math.max(1, Math.floor(c.duration))}
                        value={Math.min(Math.floor(c.position), Math.max(1, Math.floor(c.duration)))}
                        onChange={e => c.seek(Number(e.target.value))}
                        disabled={!c.now}
                        aria-label={t('songRequestPublic.listen.progress')}
                        className="flex-1 accent-[#39ff14]"
                    />
                    <span className="w-12 tabular-nums">{formatDuration(Math.floor(c.duration)) || '0:00'}</span>
                </div>

                {/* Botones */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                        <button className={`${iconBtn} ${c.shuffle ? '!text-[#39ff14]' : ''}`} onClick={c.toggleShuffle} title={t('songRequestPublic.listen.shuffle')} aria-pressed={c.shuffle}>
                            <Shuffle className="w-5 h-5 4xl:w-6 4xl:h-6" />
                        </button>
                        <button className={iconBtn} onClick={c.prev} title={t('songRequestPublic.listen.prev')} disabled={!hasPlayable}>
                            <SkipBack className="w-5 h-5 4xl:w-6 4xl:h-6" />
                        </button>
                        <button
                            className="p-3 4xl:p-4 rounded-full bg-[#39ff14] text-black hover:bg-[#6bff4d] transition-colors disabled:opacity-40"
                            onClick={c.toggle}
                            disabled={!hasPlayable}
                            title={c.playing ? t('songRequestPublic.listen.pause') : t('songRequestPublic.listen.play')}
                        >
                            {c.playing ? <Pause className="w-6 h-6 4xl:w-8 4xl:h-8" /> : <Play className="w-6 h-6 4xl:w-8 4xl:h-8" />}
                        </button>
                        <button className={iconBtn} onClick={c.next} title={t('songRequestPublic.listen.next')} disabled={!hasPlayable}>
                            <SkipForward className="w-5 h-5 4xl:w-6 4xl:h-6" />
                        </button>
                        <button className={`${iconBtn} ${c.repeat !== 'off' ? '!text-[#39ff14]' : ''}`} onClick={c.cycleRepeat} title={t(`songRequestPublic.listen.repeat.${c.repeat}`)}>
                            {c.repeat === 'one' ? <Repeat1 className="w-5 h-5 4xl:w-6 4xl:h-6" /> : <Repeat className="w-5 h-5 4xl:w-6 4xl:h-6" />}
                        </button>
                    </div>

                    <div className="flex items-center gap-2 w-40 4xl:w-56">
                        <button className={iconBtn} onClick={() => {
                            if (c.volume > 0) { volumeBeforeMute.current = c.volume; c.setVolume(0); } else c.setVolume(volumeBeforeMute.current || 80);
                        }} title={t('songRequestPublic.listen.volume')}>
                            {c.volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={c.volume}
                            onChange={e => c.setVolume(Number(e.target.value))}
                            aria-label={t('songRequestPublic.listen.volume')}
                            className="flex-1 accent-[#39ff14]"
                        />
                    </div>
                </div>

                {isMobile && <p className="text-xs 3xl:text-sm text-amber-300">{t('songRequestPublic.listen.mobileNote')}</p>}
            </div>
        </div>
    );
}
