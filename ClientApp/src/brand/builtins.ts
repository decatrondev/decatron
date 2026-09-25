import decatronLockup from '../assets/decatron-lockup.png';
import decatronMascot from '../assets/decatron-mascot.png';
import decatronHero from '../assets/decatron-hero.png';
import type { ResolvedImage } from './types';

/** Ícono Bot de lucide como imagen, para que las vistas que hoy lo usan puedan partir de él. */
function botIcon(color: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Piezas que ya vienen con el front. Aparecen en la biblioteca del admin sin poder
 * borrarse, así cada lugar puede partir de lo que se ve hoy.
 */
export const BUILTIN_IMAGES: Record<string, ResolvedImage> = {
    lockup: { url: decatronLockup, width: 900, height: 455, name: 'Lockup (incorporado)' },
    'lockup-light': { url: '/brand/decatron-lockup-light.png', width: 900, height: 455, name: 'Lockup claro (incorporado)' },
    mascot: { url: decatronMascot, width: 160, height: 160, name: 'Mascota (incorporada)' },
    hero: { url: decatronHero, width: 1337, height: 1036, name: 'Hero de la landing (incorporado)' },
    favicon: { url: '/favicon-512.png', width: 512, height: 512, name: 'Favicon (incorporado)' },
    'bot-blue': { url: botIcon('#2563eb'), width: 24, height: 24, name: 'Ícono bot azul (incorporado)' },
    'bot-violet': { url: botIcon('#7B61FF'), width: 24, height: 24, name: 'Ícono bot violeta (incorporado)' },
};

export const FONT_STACKS: Record<string, string> = {
    display: '"Chakra Petch", system-ui, sans-serif',
    sans: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
};
