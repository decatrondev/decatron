/**
 * Auto-actualización de los overlays.
 *
 * Una fuente de navegador en OBS carga la página una vez y no la vuelve a cargar nunca:
 * puede quedarse meses con un bundle viejo mientras el panel ya va por otra versión. Eso
 * obligaba a pedirle al streamer que refrescara la fuente a mano cada vez que
 * desplegábamos, cosa que nadie va a hacer.
 *
 * El bundle lleva un hash en el nombre del archivo, distinto en cada build. Comparando el
 * que tiene cargado la página con el que anuncia el index.html del servidor se sabe si
 * hay versión nueva. nginx sirve index.html con no-store, así que la comprobación siempre
 * ve lo desplegado de verdad.
 */

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const BUNDLE_PATTERN = /\/assets\/index-[^"']+\.js/;

/** Ruta del bundle que esta página tiene cargado ahora mismo. */
function loadedBundle(): string | null {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    for (const s of scripts) {
        const src = s.getAttribute('src') ?? '';
        const match = src.match(BUNDLE_PATTERN);
        if (match) return match[0];
    }
    return null;
}

/** Ruta del bundle que el servidor está sirviendo. */
async function deployedBundle(): Promise<string | null> {
    try {
        const res = await fetch('/index.html', { cache: 'no-store' });
        if (!res.ok) return null;
        const html = await res.text();
        return html.match(BUNDLE_PATTERN)?.[0] ?? null;
    } catch {
        return null;
    }
}

/**
 * Recarga conservando los parámetros (channel y demás) y añadiendo uno de cache-busting,
 * porque el navegador de OBS es especialmente insistente con su caché.
 */
export function reloadOverlay(): void {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('_v', Date.now().toString(36));
        window.location.replace(url.toString());
    } catch {
        window.location.reload();
    }
}

// ── ¿Es buen momento para recargar? ─────────────────────────────────────────────────
//
// Recargar en mitad de un sonido o de una animación corta la alerta. Un overlay puede decir
// con precisión cuándo está ocupado (le pasa su propio canReload al vigilante); los que no lo
// hacen usan esta regla general: nada sonando y ninguna animación finita en curso.

/** Elementos de audio/video a los que se les ha pedido reproducir. Incluye los que nunca se agregan al DOM (new Audio()). */
const mediaSeen = new Set<HTMLMediaElement>();
let mediaTracking = false;

/** Anota cada reproducción de audio/video. No cambia lo que hace play(): solo apunta el elemento. */
function trackMedia(): void {
    if (mediaTracking || typeof HTMLMediaElement === 'undefined') return;
    mediaTracking = true;
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement, ...args: []) {
        try { mediaSeen.add(this); } catch { /* seguimiento opcional */ }
        return original.apply(this, args);
    };
}

function isMediaPlaying(): boolean {
    for (const m of Array.from(mediaSeen)) {
        if (m.ended || m.error) { mediaSeen.delete(m); continue; }
        if (!m.paused) return true;
        // En pausa y fuera del documento: nadie lo va a reanudar solo
        if (!m.isConnected) mediaSeen.delete(m);
    }
    return Array.from(document.querySelectorAll('audio,video')).some(el => {
        const media = el as HTMLMediaElement;
        return !media.paused && !media.ended;
    });
}

/** Hay alguna animación o transición CSS con final (las infinitas, como un latido de fondo, no cuentan). */
function isAnimating(): boolean {
    if (typeof document.getAnimations !== 'function') return false;
    return document.getAnimations().some(a => {
        if (a.playState !== 'running') return false;
        try { return a.effect?.getComputedTiming().iterations !== Infinity; } catch { return false; }
    });
}

/** Regla general de "no hay nada a medias": nada sonando y ninguna animación finita en curso. */
export function isOverlayIdle(): boolean {
    return !isMediaPlaying() && !isAnimating();
}

const RELOAD_GUARD_KEY = 'overlayReloadedAt';
const RELOAD_GUARD_MS = 2 * 60 * 1000;
const BUSY_RETRY_MS = 5000;

/** Evita un bucle de recargas si el servidor sirviera una copia vieja: como mucho una cada dos minutos. */
function reloadedRecently(): boolean {
    try {
        const at = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
        return Date.now() - at < RELOAD_GUARD_MS;
    } catch { return false; }
}

let watching = false;

/**
 * Vigila si hay una versión nueva y recarga cuando la haya.
 *
 * @param canReload Se consulta antes de recargar: sirve para no cortar una alerta a
 *                  medias. Si devuelve false se reintenta en el siguiente ciclo.
 */
export function startVersionWatcher(
    canReload: () => boolean = isOverlayIdle,
    intervalMs = DEFAULT_INTERVAL_MS,
): () => void {
    const current = loadedBundle();

    // En desarrollo no hay bundle con hash: no hay nada que vigilar.
    if (!current) return () => {};

    // Un solo vigilante por página: el primero que se pone gana, y los overlays que traen su propia
    // regla lo hacen antes que el vigilante general de App.
    if (watching) return () => {};
    watching = true;
    trackMedia();

    let retry: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
        clearTimeout(retry);
        const deployed = await deployedBundle();
        if (!deployed || deployed === current) return;

        // Hay versión nueva. Si ahora hay algo a medias se espera unos segundos, no otros cinco minutos.
        if (!canReload()) {
            retry = setTimeout(check, BUSY_RETRY_MS);
            return;
        }
        if (reloadedRecently()) return;

        console.log('[Overlay] Versión nueva detectada, recargando:', current, '→', deployed);
        try { sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now())); } catch { /* sin guarda */ }
        reloadOverlay();
    };

    const timer = setInterval(check, intervalMs);
    // Una comprobación temprana para el caso de que la fuente lleve días abierta
    const first = setTimeout(check, 20000);

    return () => {
        watching = false;
        clearInterval(timer);
        clearTimeout(first);
        clearTimeout(retry);
    };
}
