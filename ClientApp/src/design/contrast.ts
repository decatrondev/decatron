import type { DsColors, ResolvedDesign, DsTheme } from '../components/ds/tokens';

// Contraste WCAG 2.x. El editor no deja publicar si algún par de texto baja de AA (4.5).

function lum(hex: string) {
    const c = hex.replace('#', '').match(/.{2}/g)!.map(h => parseInt(h, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrastRatio(a: string, b: string): number {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}

export const AA = 4.5;

type Side = keyof DsColors | `#${string}`;
/** [descripción, texto, fondo] */
export const CONTRAST_PAIRS: [string, Side, Side][] = [
    ['Texto sobre fondo', 'text', 'bg'],
    ['Texto sobre superficie', 'text', 'surface'],
    ['Texto sobre superficie elevada', 'text', 'raised'],
    ['Texto de apoyo sobre fondo', 'soft', 'bg'],
    ['Texto de apoyo sobre superficie', 'soft', 'surface'],
    ['Texto tenue sobre campos', 'faint', 'input'],
    ['Azul (texto y enlaces) sobre fondo', 'accentText', 'bg'],
    ['Azul (texto y enlaces) sobre superficie', 'accentText', 'surface'],
    ['Texto del botón principal', 'onAccent', 'accent'],
    ['Texto del botón principal (hover)', 'onAccent', 'accentHover'],
    ['Estado correcto sobre superficie', 'ok', 'surface'],
    ['Aviso sobre superficie', 'warn', 'surface'],
    ['Error sobre superficie', 'danger', 'surface'],
    ['Texto del botón de error', '#ffffff', 'dangerSolid'],
    ['Texto del botón de error (hover)', '#ffffff', 'dangerHover'],
];

export interface ContrastRow { theme: DsTheme; label: string; ratio: number; ok: boolean }

export function contrastReport(d: ResolvedDesign): ContrastRow[] {
    const rows: ContrastRow[] = [];
    (['dark', 'light'] as const).forEach(theme => {
        const c = d.colors[theme];
        CONTRAST_PAIRS.forEach(([label, fg, bg]) => {
            const f = fg.startsWith('#') ? fg : c[fg as keyof DsColors];
            const b = bg.startsWith('#') ? bg : c[bg as keyof DsColors];
            const ratio = contrastRatio(f, b);
            rows.push({ theme, label, ratio, ok: ratio >= AA });
        });
    });
    return rows;
}
