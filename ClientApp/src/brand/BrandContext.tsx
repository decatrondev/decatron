import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BUILTIN_IMAGES } from './builtins';
import type { BrandData, BrandRef, ResolvedImage } from './types';

/**
 * Lee los logos de /api/brand en vivo (.dev/plans/BRAND_LOGOS_PLAN.md): lo que el admin
 * guarda se ve al recargar, sin build ni reinicio. Se relee al volver a la pestaña y cada
 * 5 min porque los overlays de OBS quedan abiertos horas.
 */

const CACHE_KEY = 'decatron-brand-v1';
const REFRESH_MS = 5 * 60 * 1000;
/** Sin copia local, cuánto se espera a la API antes de mostrar el diseño de código. */
const FIRST_LOAD_GRACE_MS = 1500;

interface BrandContextValue {
    data: BrandData | null;
    /** true = ya se puede dibujar (llegó la API, había copia local o venció la espera). */
    ready: boolean;
    resolve: (ref: BrandRef | null | undefined) => ResolvedImage | null;
    reload: () => Promise<void>;
}

const BrandContext = createContext<BrandContextValue>({
    data: null, ready: true, resolve: () => null, reload: async () => {},
});

function readCache(): BrandData | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) as BrandData : null;
    } catch { return null; }
}

function writeCache(d: BrandData) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch { /* modo privado */ }
}

export function resolveBrandRef(data: BrandData | null, ref: BrandRef | null | undefined): ResolvedImage | null {
    if (!ref) return null;
    const [kind, id] = ref.split(':', 2);
    if (kind === 'builtin') return BUILTIN_IMAGES[id] ?? null;
    if (kind === 'asset') {
        const a = data?.assets.find(x => String(x.id) === id);
        return a ? { url: a.url, width: a.width, height: a.height, name: a.name } : null;
    }
    return null;
}

export function BrandProvider({ children }: { children: ReactNode }) {
    const [data, setData] = useState<BrandData | null>(() => readCache());
    const [ready, setReady] = useState<boolean>(() => readCache() !== null);

    const reload = useCallback(async () => {
        try {
            // fetch directo y no el cliente `api`: este pedido es anónimo y no tiene que
            // disparar la redirección al login si el token del usuario venció.
            const r = await fetch('/api/brand', { cache: 'no-cache' });
            if (!r.ok) return;
            const j = await r.json();
            if (!j?.success) return;
            const next: BrandData = { assets: j.assets ?? [], slots: j.slots ?? {}, updatedAt: j.updatedAt };
            setData(next);
            writeCache(next);
        } catch { /* sin red: queda la copia local o el diseño de código */ }
        finally { setReady(true); }
    }, []);

    useEffect(() => {
        reload();
        const grace = window.setTimeout(() => setReady(true), FIRST_LOAD_GRACE_MS);
        const timer = window.setInterval(reload, REFRESH_MS);
        const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.clearTimeout(grace);
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [reload]);

    // Favicon: se cambia en caliente sobre los <link> de index.html.
    const faviconUrl = resolveBrandRef(data, data?.slots?.favicon?.favicon)?.url ?? null;
    useEffect(() => {
        if (!faviconUrl) return;
        document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(l => {
            if (!l.dataset.brandOriginal) l.dataset.brandOriginal = l.href;
            l.href = faviconUrl;
            l.removeAttribute('type');
        });
    }, [faviconUrl]);

    const value = useMemo<BrandContextValue>(() => ({
        data, ready, reload,
        resolve: (ref) => resolveBrandRef(data, ref),
    }), [data, ready, reload]);

    return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export const useBrand = () => useContext(BrandContext);
