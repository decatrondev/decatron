// Carga única del script oficial del player de Twitch (API de iframe: silenciar, volumen, calidad, eventos).

export interface TwitchQuality { name: string; height?: number; framerate?: number }

export interface TwitchPlayerApi {
    setMuted(v: boolean): void;
    setVolume(v: number): void;
    setQuality(q: string): void;
    play(): void;
    isPaused(): boolean;
    getMuted(): boolean;
    getVolume(): number;
    getQualities(): Array<string | TwitchQuality>;
    addEventListener(ev: string, cb: () => void): void;
    destroy?: () => void;
}

interface TwitchGlobal {
    Player: {
        new (el: string | HTMLElement, opts: Record<string, unknown>): TwitchPlayerApi;
        READY: string; ONLINE: string; OFFLINE: string; PLAYING: string; PAUSE: string;
    };
}

declare global { interface Window { Twitch?: TwitchGlobal } }

let loading: Promise<TwitchGlobal> | null = null;

export function loadTwitchEmbed(): Promise<TwitchGlobal> {
    if (window.Twitch?.Player) return Promise.resolve(window.Twitch);
    if (!loading) {
        loading = new Promise<TwitchGlobal>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://player.twitch.tv/js/embed/v1.js';
            s.async = true;
            s.onload = () => (window.Twitch?.Player ? resolve(window.Twitch) : reject(new Error('Twitch embed')));
            s.onerror = () => { loading = null; reject(new Error('Twitch embed')); };
            document.head.appendChild(s);
        });
    }
    return loading;
}

/** Elige la calidad más cercana por debajo (o igual) a la alturas pedida; con 60 fps y 30 fps prefiere 30 para ahorrar. */
export function pickQuality(list: Array<string | TwitchQuality>, target: number): string | null {
    const items = list
        .map(q => (typeof q === 'string' ? { name: q } : q))
        .map(q => {
            const m = q.name.match(/^(\d{3,4})p(\d+)?/);
            return { name: q.name, height: q.height ?? (m ? Number(m[1]) : NaN), fps: q.framerate ?? (m?.[2] ? Number(m[2]) : 30) };
        })
        .filter(q => Number.isFinite(q.height));
    if (!items.length) return null;
    const under = items.filter(q => q.height <= target);
    const pool = under.length ? under : [items.reduce((a, b) => (a.height <= b.height ? a : b))];
    const best = Math.max(...pool.map(q => q.height));
    return pool.filter(q => q.height === best).sort((a, b) => a.fps - b.fps)[0].name;
}
