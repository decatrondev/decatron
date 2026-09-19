import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Enlace de descarga de Decatron Desktop para el sistema operativo del visitante.
 * Pide al backend la URL del asset del último release (GET /api/desktop/releases/latest);
 * mientras carga, o si falla, apunta a la página del release en GitHub para que el
 * botón nunca quede roto.
 */

export type DesktopPlatform = 'windows' | 'macos' | 'linux' | 'unknown';

const RELEASES_URL = 'https://github.com/decatrondev/decatron-desktop/releases/latest';

interface ReleaseInfo {
    version: string | null;
    releaseUrl: string;
    windows: string | null;
    macOs: string | null;
    linux: string | null;
}

let cached: ReleaseInfo | null = null;
let inflight: Promise<ReleaseInfo> | null = null;

function fetchRelease(): Promise<ReleaseInfo> {
    if (cached) return Promise.resolve(cached);
    if (!inflight) {
        inflight = fetch('/api/desktop/releases/latest', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((info: ReleaseInfo) => { cached = info; return info; })
            .finally(() => { inflight = null; });
    }
    return inflight;
}

export function detectPlatform(): DesktopPlatform {
    if (typeof navigator === 'undefined') return 'unknown';
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const p = (nav.userAgentData?.platform || navigator.platform || navigator.userAgent || '').toLowerCase();
    if (p.includes('win')) return 'windows';
    if (p.includes('mac')) return 'macos';
    if (p.includes('linux') || p.includes('x11')) return 'linux';
    return 'unknown';
}

export function useDesktopDownload() {
    const { t } = useTranslation('common');
    const [info, setInfo] = useState<ReleaseInfo | null>(cached);
    const platform = detectPlatform();

    useEffect(() => {
        let alive = true;
        fetchRelease().then(i => { if (alive) setInfo(i); }).catch(() => { /* queda el enlace genérico */ });
        return () => { alive = false; };
    }, []);

    const direct = info
        ? platform === 'windows' ? info.windows
            : platform === 'macos' ? info.macOs
                : platform === 'linux' ? info.linux
                    : null
        : null;

    return {
        platform,
        version: info?.version ?? null,
        /** Archivo directo para este SO; si no se conoce, la página del release. */
        url: direct ?? info?.releaseUrl ?? RELEASES_URL,
        /** Página del release, con todos los archivos. */
        releasesUrl: info?.releaseUrl ?? RELEASES_URL,
        /** "Descargar para Windows" / "Descargar" si no se reconoce el SO. */
        label: direct ? t(`desktopDownload.${platform}`) : t('desktopDownload.generic'),
        otherPlatformsLabel: t('desktopDownload.other'),
    };
}
