import { useEffect } from 'react';
import type { OverlayLayout } from './types';
import { TEXT_ELEMENTS } from './constants/defaults';

export function formatDuration(seconds: number | null | undefined): string {
    if (!seconds || seconds <= 0) return '';
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
}

const SINGLE_WEIGHT = ['Press Start 2P', 'Bebas Neue'];

/** Carga de Google Fonts las fuentes que usan los layouts (una sola etiqueta <link>). */
export function useLayoutFonts(layouts: (OverlayLayout | null | undefined)[]) {
    const families = Array.from(new Set(
        layouts.flatMap(l => l ? TEXT_ELEMENTS.map(id => l.elements[id]?.text?.fontFamily) : [])
            .filter((f): f is string => !!f && f !== 'system-ui'),
    )).sort();
    const key = families.join('|');

    useEffect(() => {
        if (!families.length) return;
        const id = 'sr-fonts';
        let link = document.getElementById(id) as HTMLLinkElement | null;
        if (!link) {
            link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        // Pedir un peso que la fuente no tiene hace fallar toda la petición
        link.href = `https://fonts.googleapis.com/css2?${families
            .map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}${SINGLE_WEIGHT.includes(f) ? '' : ':wght@400;500;600;700;800'}`)
            .join('&')}&display=swap`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
}
