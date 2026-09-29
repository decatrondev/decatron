// Tokens de color de la vista publica de torneos (rediseño "gráfico de transmisión",
// .dev/torneos/16-rediseno-publico.md). Todo sale de la apariencia que elige el
// streamer (color principal, secundario y fondo claro/oscuro): el fondo lleva un
// tinte de su color y el texto sobre sus colores se elige solo para que se lea.
// Dos colores fijos con significado: rojo "en vivo" y dorado para el 1.° / campeón.

export interface Appearance {
    primaryColor?: string | null;
    secondaryColor?: string | null;
    theme?: string | null;
    logoUrl?: string | null;
    bannerUrl?: string | null;
}

export const DEFAULT_PRIMARY = '#2F6BFF';
export const DEFAULT_SECONDARY = '#18C8E8';

type Rgb = [number, number, number];

const HEX = /^#[0-9a-fA-F]{6}$/;

function toRgb(hex: string): Rgb {
    const h = HEX.test(hex) ? hex : DEFAULT_PRIMARY;
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function toHex([r, g, b]: Rgb): string {
    return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Mezcla a con b: t = 0 es a, t = 1 es b. */
export function mix(a: string, b: string, t: number): string {
    const x = toRgb(a);
    const y = toRgb(b);
    return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function luminance(hex: string): number {
    const [r, g, b] = toRgb(hex).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
}

/** Texto que se lee sobre un fondo de ese color (casi blanco o casi negro). */
export function readableOn(bg: string): string {
    return contrast('#FFFFFF', bg) >= contrast('#0A0D14', bg) ? '#FFFFFF' : '#0A0D14';
}

/** El mismo color, aclarado u oscurecido hasta que se lea sobre el fondo (texto y bordes finos). */
export function ensureContrast(color: string, bg: string, min = 4.5): string {
    const towards = luminance(bg) < 0.4 ? '#FFFFFF' : '#000000';
    let c = color;
    for (let i = 1; i <= 20 && contrast(c, bg) < min; i++) c = mix(color, towards, i * 0.05);
    return c;
}

export interface TournamentTokens {
    isDark: boolean;
    // Colores tal cual los eligio el streamer (portada sin imagen).
    brandPrimary: string;
    brandSecondary: string;
    // Los mismos, aclarados u oscurecidos lo justo para que se distingan del fondo
    // (3:1, el minimo para barras, botones y bordes). Si el color ya se ve, no cambia.
    primary: string;
    secondary: string;
    // true si hubo que ajustar el principal (la pestaña Apariencia lo avisa).
    primaryAdjusted: boolean;
    onPrimary: string;
    onSecondary: string;
    // Version del principal que se lee como texto sobre el fondo.
    accent: string;
    bg: string;
    surface: string;
    surfaceRaised: string;
    line: string;
    ink: string;
    muted: string;
    live: string;
    gold: string;
}

export function buildTokens(a: Appearance): TournamentTokens {
    const brandPrimary = a.primaryColor && HEX.test(a.primaryColor) ? a.primaryColor.toUpperCase() : DEFAULT_PRIMARY;
    const brandSecondary = a.secondaryColor && HEX.test(a.secondaryColor) ? a.secondaryColor.toUpperCase() : DEFAULT_SECONDARY;
    const isDark = a.theme !== 'light';

    const bg = isDark ? mix('#080B12', brandPrimary, 0.07) : mix('#F3F5F9', brandPrimary, 0.04);
    const surface = isDark ? mix('#0F141F', brandPrimary, 0.08) : '#FFFFFF';
    const surfaceRaised = isDark ? mix('#161D2B', brandPrimary, 0.1) : mix('#EEF1F6', brandPrimary, 0.05);
    const primary = ensureContrast(brandPrimary, surfaceRaised, 3);
    const secondary = ensureContrast(brandSecondary, surfaceRaised, 3);
    const ink = isDark ? '#F2F5FA' : '#0E1320';
    const muted = isDark ? '#9AA4B6' : '#566072';

    return {
        isDark,
        brandPrimary,
        brandSecondary,
        primary,
        secondary,
        primaryAdjusted: primary !== brandPrimary,
        onPrimary: readableOn(primary),
        onSecondary: readableOn(secondary),
        accent: ensureContrast(primary, surface),
        bg,
        surface,
        surfaceRaised,
        line: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(14,19,32,0.1)',
        ink,
        muted,
        live: '#FF3355',
        gold: isDark ? '#FFC53D' : '#B7791F',
    };
}

/** Variables CSS para pintar un contenedor con los tokens (style={cssVars(tokens)}). */
export function cssVars(t: TournamentTokens): Record<string, string> {
    return {
        '--t-primary': t.primary,
        '--t-secondary': t.secondary,
        '--t-on-primary': t.onPrimary,
        '--t-on-secondary': t.onSecondary,
        '--t-accent': t.accent,
        '--t-bg': t.bg,
        '--t-surface': t.surface,
        '--t-surface-raised': t.surfaceRaised,
        '--t-line': t.line,
        '--t-ink': t.ink,
        '--t-muted': t.muted,
        '--t-live': t.live,
        '--t-gold': t.gold,
    };
}
