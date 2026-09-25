import type { BrandLayout, BrandSlotConfig, BrandTheme } from './types';
import { newElement } from './layout';

/**
 * Cada lugar donde aparece la marca. Los valores por defecto copian cómo se ve hoy
 * en el código (el JSX sigue ahí como respaldo mientras el lugar no tenga config),
 * así el editor arranca desde lo actual y no desde cero.
 */

export interface SlotVariant {
    key: string;
    label: string;
    /** Ancho de ventana desde el que aplica (px). Sin minWidth = variante por formato, la elige la vista. */
    minWidth?: number;
}

export interface SlotDef {
    key: string;
    name: string;
    description: string;
    group: 'Páginas públicas' | 'Panel' | 'Overlays' | 'Navegador';
    kind: 'mark' | 'favicon';
    /** 'dark' = el lugar siempre es oscuro (no depende del tema del usuario). */
    themes: BrandTheme[];
    variants: SlotVariant[];
    /** Fondo real del lugar, para que el lienzo del editor se vea como la vista. */
    background: Partial<Record<BrandTheme, string>>;
    defaults: Record<string, BrandLayout>;
    previewUrl?: string;
}

// Anchos de ventana de tailwind.config.js (3xl/4xl/5xl son propios del proyecto).
const V = {
    base: { key: 'base', label: 'Móvil', minWidth: 0 },
    md: { key: 'md', label: 'Tablet', minWidth: 768 },
    lg: { key: 'lg', label: 'Laptop', minWidth: 1024 },
    xl: { key: 'xl', label: 'Escritorio', minWidth: 1280 },
    '3xl': { key: '3xl', label: 'Full HD', minWidth: 1920 },
    '4xl': { key: '4xl', label: '2K', minWidth: 2560 },
    '5xl': { key: '5xl', label: '4K', minWidth: 3840 },
} satisfies Record<string, SlotVariant>;

/** Una imagen sola ocupando toda la caja (lockup, hero, mascota). */
function imageOnly(ref: string, w: number, h: number, refDark: string | null = null): BrandLayout {
    return { visible: true, width: w, height: h, elements: [newElement('image', { id: 'img', x: 0, y: 0, w, h, ref, refDark })] };
}

/** Ícono + palabra "Decatron", como el `<Bot/> <span>Decatron</span>` de las páginas públicas. */
function iconAndText(ref: string, icon: number, fontSize: number, color: string, gap = 8): BrandLayout {
    const lineH = Math.round(fontSize * 1.4);
    const textW = Math.ceil(fontSize * 5.4);
    const h = Math.max(icon, lineH);
    return {
        visible: true, width: icon + gap + textW, height: h,
        elements: [
            newElement('image', { id: 'img', x: 0, y: Math.round((h - icon) / 2), w: icon, h: icon, ref }),
            newElement('text', { id: 'txt', x: icon + gap, y: Math.round((h - lineH) / 2), w: textW, h: lineH, size: fontSize, color, colorDark: color }),
        ],
    };
}

// Oculto pero con medidas reales, para que "aplicar a todas las pantallas" tenga una proporción de la que partir.
const hidden = (): BrandLayout => ({ ...imageOnly('builtin:hero', 420, heroH(420)), visible: false });

const LOCKUP_H = 40;
const LOCKUP_W = Math.round(LOCKUP_H * 900 / 455);
const heroH = (w: number) => Math.round(w * 1036 / 1337);

function same(variants: SlotVariant[], make: () => BrandLayout): Record<string, BrandLayout> {
    return Object.fromEntries(variants.map(v => [v.key, make()]));
}

const publicWidths = [V.base, V.md, V['3xl'], V['4xl'], V['5xl']];
const galleryWidths = [V.base, V.md, V['4xl'], V['5xl']];

export const BRAND_SLOTS: SlotDef[] = [
    {
        key: 'public-nav',
        name: 'Header público',
        description: 'Arriba de la landing, el login y la traducción pública.',
        group: 'Páginas públicas', kind: 'mark', themes: ['light', 'dark'],
        variants: publicWidths,
        background: { light: '#ffffff', dark: '#1B1C1D' },
        defaults: same(publicWidths, () => imageOnly('builtin:lockup', LOCKUP_W, LOCKUP_H)),
        previewUrl: '/',
    },
    {
        key: 'landing-hero',
        name: 'Hero de la landing',
        description: 'La imagen grande al lado de la terminal en la portada.',
        group: 'Páginas públicas', kind: 'mark', themes: ['light', 'dark'],
        variants: [V.base, V.lg, V.xl, V['3xl'], V['4xl'], V['5xl']],
        background: { light: '#ffffff', dark: '#1B1C1D' },
        defaults: {
            base: hidden(),
            lg: imageOnly('builtin:hero', 420, heroH(420)),
            xl: imageOnly('builtin:hero', 520, heroH(520)),
            '3xl': imageOnly('builtin:hero', 600, heroH(600)),
            '4xl': imageOnly('builtin:hero', 720, heroH(720)),
            '5xl': imageOnly('builtin:hero', 720, heroH(720)),
        },
        previewUrl: '/',
    },
    {
        key: 'legal-header',
        name: 'Header de páginas legales',
        description: 'Términos, privacidad, devoluciones y libro de reclamaciones.',
        group: 'Páginas públicas', kind: 'mark', themes: ['light', 'dark'],
        variants: galleryWidths,
        background: { light: '#ffffff', dark: '#1B1C1D' },
        defaults: same(galleryWidths, () => iconAndText('builtin:bot-blue', 32, 24, '#2563eb')),
        previewUrl: '/terminos',
    },
    {
        key: 'supporters-header',
        name: 'Header de Supporters',
        description: 'Arriba de /supporters.',
        group: 'Páginas públicas', kind: 'mark', themes: ['light', 'dark'],
        variants: galleryWidths,
        background: { light: '#ffffff', dark: '#1B1C1D' },
        defaults: same(galleryWidths, () => iconAndText('builtin:bot-blue', 28, 20, '#2563eb')),
        previewUrl: '/supporters',
    },
    {
        key: 'supporters-footer',
        name: 'Footer de Supporters',
        description: 'Abajo de /supporters, sobre los enlaces legales.',
        group: 'Páginas públicas', kind: 'mark', themes: ['light', 'dark'],
        variants: galleryWidths,
        background: { light: '#ffffff', dark: '#1B1C1D' },
        defaults: same(galleryWidths, () => iconAndText('builtin:bot-blue', 20, 16, '#2563eb')),
        previewUrl: '/supporters',
    },
    {
        key: 'sprites-header',
        name: 'Header de la galería de sprites',
        description: 'Arriba de /sprites (siempre oscuro).',
        group: 'Páginas públicas', kind: 'mark', themes: ['dark'],
        variants: galleryWidths,
        background: { dark: '#0A0C14' },
        defaults: same(galleryWidths, () => iconAndText('builtin:bot-violet', 24, 20, '#7B61FF')),
        previewUrl: '/sprites',
    },
    {
        key: 'spirits-header',
        name: 'Header de la colección de spirits',
        description: 'Arriba de la colección pública de spirits (siempre oscuro).',
        group: 'Páginas públicas', kind: 'mark', themes: ['dark'],
        variants: galleryWidths,
        background: { dark: '#0A0C14' },
        defaults: same(galleryWidths, () => iconAndText('builtin:bot-violet', 24, 20, '#7B61FF')),
    },
    {
        key: 'oauth-authorize',
        name: 'Autorizar aplicación (OAuth)',
        description: 'El logo de Decatron al lado del ícono de la app que pide acceso (siempre oscuro).',
        group: 'Páginas públicas', kind: 'mark', themes: ['dark'],
        variants: [V.base],
        background: { dark: '#1f2937' },
        defaults: { base: imageOnly('builtin:mascot', 64, 64) },
    },
    {
        key: 'panel-sidebar',
        name: 'Sidebar del panel',
        description: 'Arriba del menú lateral del dashboard. Ya escala solo en pantallas grandes.',
        group: 'Panel', kind: 'mark', themes: ['light', 'dark'],
        variants: [V.base],
        background: { light: '#f8fafc', dark: '#1B1C1D' },
        defaults: { base: imageOnly('builtin:lockup', LOCKUP_W, LOCKUP_H) },
        previewUrl: '/dashboard',
    },
    {
        key: 'games-promo',
        name: 'Anuncio en la tarjeta de Games',
        description: 'El logo del anuncio de Decatron que tapa la tarjeta de rango en OBS. Si un anuncio tiene imagen propia, manda esa.',
        group: 'Overlays', kind: 'mark', themes: ['dark'],
        variants: [{ key: 'bar', label: 'Barra / compacto' }, { key: 'card', label: 'Tarjeta' }],
        background: { dark: '#0f1115' },
        defaults: {
            bar: imageOnly('builtin:lockup-light', LOCKUP_W, LOCKUP_H),
            card: imageOnly('builtin:lockup-light', 200, Math.round(200 * 455 / 900)),
        },
        previewUrl: '/admin/game-overlay-promos',
    },
    {
        key: 'favicon',
        name: 'Favicon',
        description: 'El ícono de la pestaña del navegador y del acceso directo en el celular.',
        group: 'Navegador', kind: 'favicon', themes: ['light'],
        variants: [],
        background: {},
        defaults: {},
    },
];

export const SLOT_BY_KEY: Record<string, SlotDef> = Object.fromEntries(BRAND_SLOTS.map(s => [s.key, s]));

export type BrandSlotKey = typeof BRAND_SLOTS[number]['key'];

/** Config inicial del editor para un lugar sin guardar: todas las variantes con sus valores de hoy. */
export function defaultConfig(slot: SlotDef): BrandSlotConfig {
    return {
        v: 2,
        layouts: JSON.parse(JSON.stringify(slot.defaults)),
        ...(slot.kind === 'favicon' ? { favicon: 'builtin:favicon' } : {}),
    };
}

/**
 * Variante que aplica a un ancho de ventana: la de mayor minWidth que entre, entre las
 * que tienen config (igual que las clases responsive de Tailwind).
 */
export function pickVariant(slot: SlotDef, config: BrandSlotConfig, viewportWidth: number): string | null {
    const withWidth = slot.variants.filter(v => v.minWidth !== undefined && config.layouts[v.key]);
    if (withWidth.length === 0) return null;
    const sorted = [...withWidth].sort((a, b) => (b.minWidth ?? 0) - (a.minWidth ?? 0));
    return (sorted.find(v => (v.minWidth ?? 0) <= viewportWidth) ?? sorted[sorted.length - 1]).key;
}
