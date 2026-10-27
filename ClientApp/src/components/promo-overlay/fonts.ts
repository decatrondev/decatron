import { useEffect } from 'react';
import type { PromoDesign } from './types';

/**
 * Tipografías disponibles para las fichas, con los pesos que cada una REALMENTE tiene en Google Fonts (pedir un peso que no
 * existe hace que Google rechace todo el pedido). La misma lista la valida el servidor (PromoDesignValidator.cs) y una
 * prueba comprueba que no se desfasen.
 */
export interface PromoFont { family: string; weights: number[]; /** Para agrupar en el selector. */ group: 'display' | 'sans' | 'tech' | 'fun' | 'mono' }

export const PROMO_FONTS: PromoFont[] = [
    { family: 'Onest', weights: [400, 500, 600, 700, 800], group: 'sans' },
    { family: 'Inter', weights: [400, 500, 600, 700, 800], group: 'sans' },
    { family: 'Poppins', weights: [400, 500, 600, 700, 800], group: 'sans' },
    { family: 'Montserrat', weights: [400, 500, 600, 700, 800], group: 'sans' },
    { family: 'Roboto', weights: [400, 500, 700], group: 'sans' },
    { family: 'Open Sans', weights: [400, 500, 600, 700, 800], group: 'sans' },
    { family: 'Lato', weights: [400, 700], group: 'sans' },
    { family: 'Nunito', weights: [400, 600, 700, 800], group: 'sans' },
    { family: 'Rubik', weights: [400, 500, 600, 700, 800], group: 'sans' },
    { family: 'Raleway', weights: [400, 500, 600, 700, 800], group: 'sans' },
    { family: 'Outfit', weights: [400, 500, 600, 700, 800], group: 'sans' },
    { family: 'Manrope', weights: [400, 500, 600, 700, 800], group: 'sans' },
    { family: 'DM Sans', weights: [400, 500, 700], group: 'sans' },
    { family: 'Sora', weights: [400, 600, 700, 800], group: 'sans' },
    { family: 'Bricolage Grotesque', weights: [400, 500, 600, 700, 800], group: 'sans' },
    { family: 'Syne', weights: [400, 500, 600, 700, 800], group: 'sans' },
    { family: 'Kanit', weights: [400, 500, 600, 700, 800], group: 'sans' },
    { family: 'Big Shoulders Display', weights: [400, 600, 700, 800, 900], group: 'display' },
    { family: 'Barlow Condensed', weights: [400, 500, 600, 700, 800], group: 'display' },
    { family: 'Barlow', weights: [400, 500, 600, 700, 800], group: 'sans' },
    { family: 'Oswald', weights: [400, 500, 600, 700], group: 'display' },
    { family: 'Teko', weights: [400, 500, 600, 700], group: 'display' },
    { family: 'Saira Condensed', weights: [400, 500, 600, 700, 800], group: 'display' },
    { family: 'Bebas Neue', weights: [400], group: 'display' },
    { family: 'Anton', weights: [400], group: 'display' },
    { family: 'Staatliches', weights: [400], group: 'display' },
    { family: 'Archivo Black', weights: [400], group: 'display' },
    { family: 'Passion One', weights: [400, 700], group: 'display' },
    { family: 'Chakra Petch', weights: [400, 500, 600, 700], group: 'tech' },
    { family: 'Rajdhani', weights: [400, 500, 600, 700], group: 'tech' },
    { family: 'Exo 2', weights: [400, 500, 600, 700, 800], group: 'tech' },
    { family: 'Orbitron', weights: [400, 500, 600, 700, 800], group: 'tech' },
    { family: 'Russo One', weights: [400], group: 'tech' },
    { family: 'Audiowide', weights: [400], group: 'tech' },
    { family: 'Black Ops One', weights: [400], group: 'tech' },
    { family: 'Unbounded', weights: [400, 500, 600, 700, 800], group: 'tech' },
    { family: 'Press Start 2P', weights: [400], group: 'tech' },
    { family: 'Righteous', weights: [400], group: 'fun' },
    { family: 'Titan One', weights: [400], group: 'fun' },
    { family: 'Lilita One', weights: [400], group: 'fun' },
    { family: 'Fredoka', weights: [400, 500, 600, 700], group: 'fun' },
    { family: 'Comfortaa', weights: [400, 500, 600, 700], group: 'fun' },
    { family: 'Bangers', weights: [400], group: 'fun' },
    { family: 'Pacifico', weights: [400], group: 'fun' },
    { family: 'Permanent Marker', weights: [400], group: 'fun' },
    { family: 'JetBrains Mono', weights: [400, 500, 700], group: 'mono' },
];

export const DEFAULT_FONT = 'Onest';

export const fontByFamily = (family: string): PromoFont | undefined => PROMO_FONTS.find(f => f.family === family);

/** El peso más cercano que la tipografía realmente tiene. */
export function nearestWeight(family: string, weight: number): number {
    const w = fontByFamily(family)?.weights ?? [400];
    return w.reduce((best, c) => (Math.abs(c - weight) < Math.abs(best - weight) ? c : best), w[0]);
}

/** Dirección del CSS de Google Fonts con solo las tipografías (y pesos) que usa el diseño. */
export function fontsHref(design: PromoDesign): string | null {
    const used = new Map<string, Set<number>>();
    for (const e of design.elements) {
        if (e.kind !== 'text') continue;
        const f = fontByFamily(e.fontFamily);
        if (!f) continue;
        const set = used.get(f.family) ?? new Set<number>();
        set.add(nearestWeight(f.family, e.fontWeight));
        used.set(f.family, set);
    }
    if (!used.size) return null;
    const fams = [...used.entries()].map(([family, weights]) => {
        const ws = [...weights].sort((a, b) => a - b);
        return `family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${ws.join(';')}`;
    });
    return `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`;
}

/** Carga las tipografías del diseño (el overlay de OBS y el editor las necesitan antes de dibujar). */
export function usePromoFonts(design: PromoDesign | null) {
    const href = design ? fontsHref(design) : null;
    useEffect(() => {
        if (!href) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
        return () => { link.remove(); };
    }, [href]);
}
