// Valores de diseño de Decatron. Fuente única: la librería `ds` solo lee variables CSS y estas salen de aquí.
// En la fase 4 este objeto se sustituye por los valores publicados desde admin (borrador / publicado / historial).

export type DsTheme = 'dark' | 'light';

export interface DsColors {
    bg: string; surface: string; raised: string; input: string;
    border: string; borderSoft: string;
    text: string; soft: string; faint: string;
    accent: string; accentHover: string; accentText: string; onAccent: string;
    ok: string; warn: string; danger: string; dangerSolid: string; dangerHover: string;
    /** Resaltado de código (editor de scripts): se pintan sobre el fondo de campos (`input`). */
    syntaxKeyword: string; syntaxString: string; syntaxNumber: string;
}

export const DS_COLORS: Record<DsTheme, DsColors> = {
    dark: {
        bg: '#0b0d12', surface: '#12151c', raised: '#171b24', input: '#0b0d12',
        border: '#222733', borderSoft: '#1b1f29',
        text: '#e6e9ef', soft: '#8b93a3', faint: '#7a8394',
        accent: '#3161d8', accentHover: '#2653c5', accentText: '#6e94ed', onAccent: '#ffffff',
        ok: '#34d399', warn: '#fbbf24', danger: '#f87171', dangerSolid: '#dc2626', dangerHover: '#b91c1c',
        syntaxKeyword: '#6e94ed', syntaxString: '#34d399', syntaxNumber: '#fbbf24',
    },
    light: {
        bg: '#f6f7fa', surface: '#ffffff', raised: '#ffffff', input: '#ffffff',
        border: '#dfe3ea', borderSoft: '#eceff4',
        text: '#12151c', soft: '#5b6475', faint: '#6b7385',
        accent: '#2f5fc6', accentHover: '#274fa5', accentText: '#2f5fc6', onAccent: '#ffffff',
        ok: '#047857', warn: '#b45309', danger: '#dc2626', dangerSolid: '#dc2626', dangerHover: '#b91c1c',
        syntaxKeyword: '#2f5fc6', syntaxString: '#047857', syntaxNumber: '#b45309',
    },
};

export interface DsShape {
    radius: number; radiusLg: number;
    sizes: Record<'sm' | 'md' | 'lg', { height: number; padX: number; font: number }>;
    weight: number; border: number;
    fontUi: DsFontName; fontMono: string;
    gridOpacity: number; glowOpacity: number;
}

/** Tipografías permitidas para la interfaz (solo las que el sitio ya carga). El servidor valida la misma lista. */
export const DS_FONTS = { Onest: "'Onest', system-ui, sans-serif", Barlow: "'Barlow', system-ui, sans-serif", 'system-ui': 'system-ui, sans-serif' } as const;
export type DsFontName = keyof typeof DS_FONTS;

/** Forma y tipografía de fábrica: iguales en claro y oscuro. Tres tamaños de control, un radio, un peso. */
export const DS_SHAPE: DsShape = {
    radius: 6, radiusLg: 8,
    sizes: {
        sm: { height: 32, padX: 12, font: 13 },
        md: { height: 40, padX: 16, font: 14 },
        lg: { height: 48, padX: 24, font: 15 },
    },
    weight: 700,
    border: 1,
    fontUi: 'Onest',
    fontMono: "'JetBrains Mono', ui-monospace, monospace",
    gridOpacity: 0.07,
    glowOpacity: 0.35,
};

// ── Valores publicados desde admin (editor de /admin/estilo) ───────────────
/** Solo lo que se cambió respecto a los valores de fábrica. Es lo que guarda el servidor (misma forma). */
export interface DesignOverrides {
    colors?: { dark?: Partial<DsColors>; light?: Partial<DsColors> };
    shape?: Partial<Omit<DsShape, 'sizes' | 'fontMono'>> & { sizes?: { [K in 'sm' | 'md' | 'lg']?: Partial<DsShape['sizes'][K]> } };
}
export interface ResolvedDesign { colors: Record<DsTheme, DsColors>; shape: DsShape }

// Conversión hex ↔ hsl para derivar los hover (el hover no se edita aparte salvo que se pida).
function hexToHsl(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const sat = d / (1 - Math.abs(2 * l - 1));
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, sat, l];
}
function hslToHex(h: number, s: number, l: number): string {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
/** Mueve la luminosidad de un color `delta` (negativo = más oscuro). */
export function shiftLightness(hex: string, delta: number): string {
    const [h, s, l] = hexToHsl(hex);
    return hslToHex(h, s, Math.min(1, Math.max(0, l + delta)));
}

/** Mezcla fábrica + lo editado. Si se cambia el azul de acción (o el rojo sólido) y no su hover, el hover se deriva solo. */
export function resolveDesign(ov?: DesignOverrides | null): ResolvedDesign {
    const colors = { dark: { ...DS_COLORS.dark, ...ov?.colors?.dark }, light: { ...DS_COLORS.light, ...ov?.colors?.light } };
    (['dark', 'light'] as const).forEach(t => {
        const o = ov?.colors?.[t];
        if (o?.accent && !o.accentHover) colors[t].accentHover = shiftLightness(o.accent, -0.07);
        if (o?.dangerSolid && !o.dangerHover) colors[t].dangerHover = shiftLightness(o.dangerSolid, -0.07);
    });
    const sh = ov?.shape;
    const sizes = { sm: { ...DS_SHAPE.sizes.sm, ...sh?.sizes?.sm }, md: { ...DS_SHAPE.sizes.md, ...sh?.sizes?.md }, lg: { ...DS_SHAPE.sizes.lg, ...sh?.sizes?.lg } };
    const { sizes: _s, ...flat } = sh ?? {};
    return { colors, shape: { ...DS_SHAPE, ...flat, sizes } };
}

const kebab = (s: string) => s.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);

/** Variables de forma y tipografía (iguales en claro y oscuro). */
function shapeVars(sh: DsShape): Record<string, string> {
    const v: Record<string, string> = {};
    v['--ds-radius'] = `${sh.radius}px`;
    v['--ds-radius-lg'] = `${sh.radiusLg}px`;
    (Object.keys(sh.sizes) as (keyof DsShape['sizes'])[]).forEach(k => {
        const s = sh.sizes[k];
        v[`--ds-h-${k}`] = `${s.height}px`; v[`--ds-pad-${k}`] = `${s.padX}px`; v[`--ds-fs-${k}`] = `${s.font}px`;
    });
    v['--ds-weight'] = String(sh.weight);
    v['--ds-border-w'] = `${sh.border}px`;
    v['--ds-font-ui'] = DS_FONTS[sh.fontUi] ?? DS_FONTS.Onest;
    v['--ds-font-mono'] = sh.fontMono;
    v['--ds-grid-opacity'] = String(sh.gridOpacity);
    v['--ds-glow-opacity'] = String(sh.glowOpacity);
    return v;
}

function colorVars(c: DsColors): Record<string, string> {
    const v: Record<string, string> = {};
    Object.entries(c).forEach(([k, val]) => { v[`--ds-${kebab(k)}`] = val; });
    return v;
}

/** Los mismos colores en canales "r g b" (--dc-*) para las clases `ds-*` de Tailwind: bg-ds-surface, text-ds-soft/80… */
function channelVars(c: DsColors): Record<string, string> {
    const v: Record<string, string> = {};
    Object.entries(c).forEach(([k, val]) => { v[`--dc-${kebab(k)}`] = hexChannels(val); });
    return v;
}

/** Variables de un tema para el contenedor `.ds-root` (vista previa de la guía y del editor). */
export function dsVars(theme: DsTheme, design: ResolvedDesign): React.CSSProperties {
    return { ...colorVars(design.colors[theme]), ...channelVars(design.colors[theme]), ...shapeVars(design.shape) } as React.CSSProperties;
}

// ── CSS global (fuente única) ─────────────────────────────────────────────
// Todo el sitio lee estas variables: la librería `ds` (--ds-*), las clases `ds-*` de Tailwind (--dc-*) y las
// `pub-*` (--pub-*), estas dos en canales "r g b" para que funcione la opacidad: bg-pub-accent/40.
// Los valores publicados desde admin se mezclan sobre los de fábrica con resolveDesign() antes de generar este CSS.

/** "#3161d8" → "49 97 216" (canales para rgb(var(--x) / alfa)). */
export function hexChannels(hex: string): string {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Relación nombre `pub-*` → clave de DS_COLORS. Las vistas públicas son SIEMPRE oscuras (no siguen el tema). */
export const PUB_MAP = {
    bg: 'bg', surface: 'surface', raised: 'raised',
    border: 'border', 'border-soft': 'borderSoft',
    accent: 'accent', 'accent-hi': 'accentText', 'accent-hover': 'accentHover',
} as const;

const decl = (vars: Record<string, string>) => Object.entries(vars).map(([k, v]) => `${k}:${v};`).join('');

export function designTokensCss(design: ResolvedDesign): string {
    const pub: Record<string, string> = {};
    (Object.keys(PUB_MAP) as (keyof typeof PUB_MAP)[]).forEach(k => { pub[`--pub-${k}`] = hexChannels(design.colors.dark[PUB_MAP[k]]); });
    const light = design.colors.light, dark = design.colors.dark;
    return `:root{${decl(colorVars(light))}${decl(channelVars(light))}${decl(shapeVars(design.shape))}${decl(pub)}}.dark{${decl(colorVars(dark))}${decl(channelVars(dark))}}`;
}

/** Inserta el CSS global en <head>. Se llama al arrancar, antes de dibujar (sin parpadeo). */
export function installDesignTokens(design: ResolvedDesign): void {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('design-tokens') as HTMLStyleElement | null;
    if (!el) { el = document.createElement('style'); el.id = 'design-tokens'; document.head.prepend(el); }
    el.textContent = designTokensCss(design);
}
