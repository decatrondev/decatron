import { useEffect } from 'react';

// Página personal del streamer (decatron.net/@nombre). Plan: .dev/plans/pagina-personal/PLAN.md

export interface PersonalPageLink {
    id: string;
    kind: string; // clave de la red de la lista fija, o "custom"
    url: string;
    title: string;
    visible: boolean;
    /** Inventario: casilla 1×1, 2×1 o 2×2. Póster: chico, mediano o grande. Las demás plantillas lo ignoran. */
    size?: 'normal' | 'wide' | 'big' | string;
    /** Lleva a contenido para mayores de 18 (lo marca el dueño o lo fuerza la red o el dominio). */
    adult?: boolean;
}

export interface PersonalPageContent {
    displayName: string;
    bio: string;
    avatarUrl: string;
    template: string;
    theme: 'dark' | 'light' | string;
    accent: string;
    font: string;
    links: PersonalPageLink[];
    /** Toda la página es +18: el visitante confirma su edad al entrar. */
    adult?: boolean;
    /** Cabecera de Escena por capas (5.3). Sin esto o apagada, Escena usa el diseño clásico. */
    scene?: PersonalPageScene | null;
}

export type LayerKind = 'photo' | 'name' | 'bio' | 'sticker' | 'text';

/** Capa de la escena, en unidades del lienzo (SCENE_W × SCENE_H). El orden de la lista es el orden de dibujo. */
export interface PersonalPageLayer {
    id: string;
    kind: LayerKind | string;
    x: number; y: number; width: number; height: number;
    visible: boolean;
    mediaUrl?: string;
    text?: string;
    font?: string;
    color?: string;
    /** Tamaño de letra en unidades del lienzo (0 = el de cada tipo) */
    size?: number;
    align?: 'left' | 'center' | 'right' | string;
}

export interface PersonalPageScene {
    enabled: boolean;
    background: 'color' | 'pattern' | 'media' | string;
    bgColor?: string;
    bgMedia?: string;
    layers: PersonalPageLayer[];
}

/** Lienzo de la escena: 4:5, se escala como un overlay (igual que PersonalPageRules.SceneWidth/SceneHeight). */
export const SCENE_W = 1080;
export const SCENE_H = 1350;
/** Tamaño de letra por defecto de cada tipo de capa (unidades del lienzo). */
export const LAYER_SIZE: Record<string, number> = { name: 150, bio: 44, text: 72 };

/** Capas iniciales: reproducen el diseño clásico (foto arriba, nombre grande y bio abajo) para empezar desde ahí. */
export function defaultScene(): PersonalPageScene {
    return {
        enabled: true, background: 'pattern', bgColor: '', bgMedia: '',
        layers: [
            { id: 'photo', kind: 'photo', x: 60, y: 120, width: 320, height: 320, visible: true },
            { id: 'name', kind: 'name', x: 60, y: 860, width: 960, height: 240, visible: true, size: 150, align: 'left' },
            { id: 'bio', kind: 'bio', x: 60, y: 1110, width: 960, height: 180, visible: true, size: 44, align: 'left' },
        ],
    };
}

export function isVideoUrl(url: string): boolean {
    return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

/** Listas de dominios que manda el servidor para marcar en el editor lo que va a exigir al guardar. */
export interface DomainPolicy { adult: string[]; blocked: string[]; shorteners: string[] }

/** El host es el dominio o un subdominio suyo (igual que PersonalPageRules.DomainMatches). */
export function domainMatches(host: string, domain: string): boolean {
    return !!host && !!domain && (host === domain || host.endsWith(`.${domain}`));
}

/** Host completo en minúsculas (sin quitar www), o vacío. */
export function fullHostOf(url: string): string {
    try { return new URL(url).hostname.toLowerCase().replace(/\.$/, ''); } catch { return ''; }
}

/** Qué va a decir el servidor de un enlace: +18 forzado, dominio bloqueado o acortador (solo enlaces propios). */
export function linkChecks(link: PersonalPageLink, policy: DomainPolicy | undefined) {
    const host = fullHostOf(link.url);
    const inList = (list?: string[]) => !!host && (list ?? []).some(d => domainMatches(host, d));
    return {
        forcedAdult: ADULT_KINDS.includes(link.kind) || inList(policy?.adult),
        blocked: inList(policy?.blocked),
        shortener: link.kind === 'custom' && inList(policy?.shorteners),
    };
}

export interface PlatformInfo { key: string; name: string; adult: boolean; example: string }

/** Tipografías permitidas: clave → familia de Google Fonts, parámetros y si tiene eje de ancho (para el nombre expandido). */
export const FONTS: Record<string, { family: string; query: string; wide: boolean }> = {
    'archivo': { family: 'Archivo', query: 'Archivo:wdth,wght@62..125,400..900', wide: true },
    'instrument-sans': { family: 'Instrument Sans', query: 'Instrument+Sans:wdth,wght@75..100,400..700', wide: false },
    'chivo': { family: 'Chivo', query: 'Chivo:ital,wght@0,400..900;1,700..900', wide: false },
    'saira': { family: 'Saira', query: 'Saira:wdth,wght@50..125,400..800', wide: true },
    'big-shoulders': { family: 'Big Shoulders Display', query: 'Big+Shoulders+Display:wght@600..900', wide: false },
    'source-sans-3': { family: 'Source Sans 3', query: 'Source+Sans+3:wght@400..800', wide: false },
    'atkinson': { family: 'Atkinson Hyperlegible', query: 'Atkinson+Hyperlegible:wght@400;700', wide: false },
    'literata': { family: 'Literata', query: 'Literata:opsz,wght@7..72,400..800', wide: false },
};

/** Carga una o varias tipografías de la lista (una sola etiqueta por familia, se reutiliza entre páginas). */
export function usePageFonts(keys: string[]) {
    const joined = keys.filter(k => FONTS[k]).sort().join(',');
    useEffect(() => {
        for (const key of joined.split(',').filter(Boolean)) {
            const id = `pp-font-${key}`;
            if (document.getElementById(id)) continue;
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${FONTS[key].query}&display=swap`;
            document.head.appendChild(link);
        }
    }, [joined]);
}

/** Texto oscuro o claro sobre el color de acento, el que más contraste dé. */
export function textOn(hex: string): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return '#0F1218';
    const n = parseInt(m[1], 16);
    const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    const lum = 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255);
    return lum > 0.32 ? '#0F1218' : '#FFFFFF';
}

/** Iniciales para la casilla de una red (sin logos de terceros). */
export const PLATFORM_INITIALS: Record<string, string> = {
    twitch: 'Tw', kick: 'K', youtube: 'Yt', tiktok: 'Tk', instagram: 'Ig', x: 'X', discord: 'Dc', facebook: 'Fb',
    threads: 'Th', bluesky: 'Bs', onlyfans: 'OF', fansly: 'Fy',
};

export const PLATFORM_NAMES: Record<string, string> = {
    twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', x: 'X', discord: 'Discord',
    facebook: 'Facebook', threads: 'Threads', bluesky: 'Bluesky', onlyfans: 'OnlyFans', fansly: 'Fansly',
};

export function newLinkId(): string {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function hostOf(url: string): string {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** Plantillas (mismo orden que las maquetas) y la tipografía que se propone al elegir cada una. */
export const TEMPLATES = ['scene', 'badge', 'channel', 'inventory', 'poster'] as const;
export const TEMPLATE_FONT: Record<string, string> = {
    scene: 'archivo', badge: 'instrument-sans', channel: 'chivo', inventory: 'saira', poster: 'big-shoulders',
};
/** Plantillas que usan el tamaño de cada enlace. */
export const TEMPLATES_WITH_SIZE = ['inventory', 'poster'];

export const ADULT_KINDS = ['onlyfans', 'fansly'];

/** Textos que dibujan las plantillas (vienen de personal-page.json → public.*). */
export interface PageLabels {
    madeWith: string;
    adult: string;
    opensIn: (host: string) => string;
    noLinks: string;
    flip: string;
    flipBack: string;
    whereToFind: string;
    nowWatching: string;
    guide: string;
    open: string;
    findMeAt: string;
    qrAlt: string;
    /** Título que reemplaza al de un enlace +18 propio hasta que el visitante confirma su edad */
    adultCovered: string;
}

export interface TemplateProps {
    content: PersonalPageContent;
    /** Foto del canal en Twitch/Kick, si la página no subió una propia */
    channelPhotoUrl?: string;
    labels: PageLabels;
    /** Nombre de la página (para el QR de la Credencial y el pie) */
    handle?: string;
    /** Dentro del panel: sin alto de pantalla completa ni letra que crece con la pantalla */
    embedded?: boolean;
}

/** Lo que todas las plantillas sacan del contenido: nombre, iniciales, foto, redes y enlaces visibles. */
export function pageParts(content: PersonalPageContent, channelPhotoUrl?: string) {
    const name = content.displayName || '';
    const links = (content.links ?? []).filter(l => l.visible !== false);
    return {
        name,
        initials: name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '·',
        photo: content.avatarUrl || channelPhotoUrl || '',
        accent: /^#[0-9a-f]{6}$/i.test(content.accent) ? content.accent : '#5B8CFF',
        font: FONTS[content.font] ?? FONTS.archivo,
        links,
        networks: links.filter(l => l.kind !== 'custom'),
        custom: links.filter(l => l.kind === 'custom'),
        labelOf: (l: PersonalPageLink) => l.title || PLATFORM_NAMES[l.kind] || l.kind,
        isAdult: (l: PersonalPageLink) => l.adult === true || ADULT_KINDS.includes(l.kind),
    };
}

export const LINK_REL = 'noopener noreferrer nofollow ugc';
