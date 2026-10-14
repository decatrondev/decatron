// ¿Esta carga es del dominio de la plataforma (decatron.top) y no del bot (decatron.net)?
// Un solo build sirve a los dos dominios; el Host decide qué árbol de rutas se dibuja
// (.dev/plans/PLATAFORMA_PLAN.md, decisión 14).
const PLATFORM_HOSTS = ['decatron.top', 'www.decatron.top'];

const DEV_FLAG = 'decatron.platformPreview';

export function isPlatformHost(): boolean {
    if (typeof window === 'undefined') return false;
    if (PLATFORM_HOSTS.includes(window.location.hostname.toLowerCase())) return true;

    // Solo en desarrollo: ?platform=1 activa la vista de la plataforma en localhost (?platform=0 la apaga).
    if (import.meta.env.DEV) {
        try {
            const q = new URLSearchParams(window.location.search).get('platform');
            if (q === '1') sessionStorage.setItem(DEV_FLAG, '1');
            if (q === '0') sessionStorage.removeItem(DEV_FLAG);
            return sessionStorage.getItem(DEV_FLAG) === '1';
        } catch { return false; }
    }
    return false;
}

/** Dirección del sitio del bot, para los enlaces que no existen en la plataforma (legales, Decatron). */
export const BOT_SITE = 'https://decatron.net';
