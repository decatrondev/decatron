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

/**
 * Vigila si hay una versión nueva y recarga cuando la haya.
 *
 * @param canReload Se consulta antes de recargar: sirve para no cortar una alerta a
 *                  medias. Si devuelve false se reintenta en el siguiente ciclo.
 */
export function startVersionWatcher(
    canReload: () => boolean = () => true,
    intervalMs = DEFAULT_INTERVAL_MS,
): () => void {
    const current = loadedBundle();

    // En desarrollo no hay bundle con hash: no hay nada que vigilar.
    if (!current) return () => {};

    const check = async () => {
        const deployed = await deployedBundle();
        if (!deployed || deployed === current) return;

        if (!canReload()) return;

        console.log('[Overlay] Versión nueva detectada, recargando:', current, '→', deployed);
        reloadOverlay();
    };

    const timer = setInterval(check, intervalMs);
    // Una comprobación temprana para el caso de que la fuente lleve días abierta
    const first = setTimeout(check, 20000);

    return () => {
        clearInterval(timer);
        clearTimeout(first);
    };
}
