// Valores de diseño de Decatron. Fuente única: la librería `ds` solo lee variables CSS y estas salen de aquí.
// En la fase 4 este objeto se sustituye por los valores publicados desde admin (borrador / publicado / historial).

export type DsTheme = 'dark' | 'light';

export interface DsColors {
    bg: string; surface: string; raised: string; input: string;
    border: string; borderSoft: string;
    text: string; soft: string; faint: string;
    accent: string; accentHover: string; accentText: string; onAccent: string;
    ok: string; warn: string; danger: string; dangerSolid: string; dangerHover: string;
}

export const DS_COLORS: Record<DsTheme, DsColors> = {
    dark: {
        bg: '#0b0d12', surface: '#12151c', raised: '#171b24', input: '#0b0d12',
        border: '#222733', borderSoft: '#1b1f29',
        text: '#e6e9ef', soft: '#8b93a3', faint: '#7a8394',
        accent: '#2c66f5', accentHover: '#2557d6', accentText: '#5b8cff', onAccent: '#ffffff',
        ok: '#34d399', warn: '#fbbf24', danger: '#f87171', dangerSolid: '#dc2626', dangerHover: '#ef4444',
    },
    light: {
        bg: '#f6f7fa', surface: '#ffffff', raised: '#ffffff', input: '#ffffff',
        border: '#dfe3ea', borderSoft: '#eceff4',
        text: '#12151c', soft: '#5b6475', faint: '#6b7385',
        accent: '#2563eb', accentHover: '#1d4ed8', accentText: '#2563eb', onAccent: '#ffffff',
        ok: '#059669', warn: '#b45309', danger: '#dc2626', dangerSolid: '#dc2626', dangerHover: '#b91c1c',
    },
};

/** Forma y tipografía: iguales en claro y oscuro. Tres tamaños de control, un radio, un peso. */
export const DS_SHAPE = {
    radius: 6, radiusLg: 8,
    sizes: {
        sm: { height: 32, padX: 12, font: 13 },
        md: { height: 40, padX: 16, font: 14 },
        lg: { height: 48, padX: 24, font: 15 },
    },
    weight: 700,
    border: 1,
    fontUi: "'Onest', system-ui, sans-serif",
    fontMono: "'JetBrains Mono', ui-monospace, monospace",
    gridOpacity: 0.07,
    glowOpacity: 0.35,
} as const;

const kebab = (s: string) => s.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);

/** Convierte los valores en variables CSS para el contenedor `.ds-root`. */
export function dsVars(theme: DsTheme): React.CSSProperties {
    const v: Record<string, string> = {};
    Object.entries(DS_COLORS[theme]).forEach(([k, val]) => { v[`--ds-${kebab(k)}`] = val; });
    v['--ds-radius'] = `${DS_SHAPE.radius}px`;
    v['--ds-radius-lg'] = `${DS_SHAPE.radiusLg}px`;
    (Object.keys(DS_SHAPE.sizes) as (keyof typeof DS_SHAPE.sizes)[]).forEach(k => {
        const s = DS_SHAPE.sizes[k];
        v[`--ds-h-${k}`] = `${s.height}px`; v[`--ds-pad-${k}`] = `${s.padX}px`; v[`--ds-fs-${k}`] = `${s.font}px`;
    });
    v['--ds-weight'] = String(DS_SHAPE.weight);
    v['--ds-font-ui'] = DS_SHAPE.fontUi;
    v['--ds-font-mono'] = DS_SHAPE.fontMono;
    v['--ds-grid-opacity'] = String(DS_SHAPE.gridOpacity);
    v['--ds-glow-opacity'] = String(DS_SHAPE.glowOpacity);
    return v as React.CSSProperties;
}
