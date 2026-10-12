import type { CSSProperties } from 'react';
import type { LayoutId } from './types';

// Reparto de las casillas. En pantallas medianas y grandes llena el alto de la ventana; en móvil se apilan
// con proporción 16:9 y la página se desplaza (las reglas md: están en Multiview.tsx).

const GRID_COLS: Record<number, number> = { 1: 1, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 4, 11: 4, 12: 4 };

export interface LayoutPlan {
    container: CSSProperties;
    item: (index: number) => CSSProperties;
}

type Vars = CSSProperties & Record<`--${string}`, string>;

export function planLayout(layout: LayoutId, n: number): LayoutPlan {
    if (layout === 'stack') {
        return {
            container: { '--mv-cols': '1fr', '--mv-rows': 'none' } as Vars,
            item: () => ({}) as Vars,
        };
    }

    if (layout === 'focus' && n > 1) {
        return {
            container: { '--mv-cols': 'minmax(0,3fr) minmax(0,1fr)', '--mv-rows': `repeat(${n - 1}, minmax(0,1fr))` } as Vars,
            item: i => (i === 0
                ? { '--mv-col': '1', '--mv-row': `1 / span ${n - 1}` }
                : { '--mv-col': '2', '--mv-row': String(i) }) as Vars,
        };
    }

    const cols = GRID_COLS[Math.min(Math.max(n, 1), 12)];
    const rows = Math.ceil(n / cols);
    // Si en la última fila queda una sola casilla, ocupa todo el ancho en lugar de dejar un hueco.
    const lastAlone = n > 1 && n % cols === 1;
    return {
        container: { '--mv-cols': `repeat(${cols}, minmax(0,1fr))`, '--mv-rows': `repeat(${rows}, minmax(0,1fr))` } as Vars,
        item: i => (lastAlone && i === n - 1
            ? { '--mv-col': '1 / -1', '--mv-row': 'auto' }
            : { '--mv-col': 'auto', '--mv-row': 'auto' }) as Vars,
    };
}
