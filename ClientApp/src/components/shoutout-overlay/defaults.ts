import type { ShoutoutData, ShoutoutElement, ShoutoutLayout, TextBlock, ElementKind } from './types';

export const LAYOUT_VERSION = 2 as const;

/** Variables que se reemplazan en las líneas de texto (en este orden: las más largas primero). */
export const TEXT_VARIABLES = ['@displayname', '@username', '@game', '@title', '@followers', '@clipTitle', '@clipViews', '@clipCreator'] as const;

export const FONT_OPTIONS = [
    'Inter', 'Poppins', 'Roboto', 'Montserrat', 'Open Sans', 'Lato', 'Nunito', 'Rubik', 'Oswald', 'Raleway',
    'Bebas Neue', 'Anton', 'Bangers', 'Press Start 2P', 'Orbitron', 'Russo One', 'Fredoka', 'Comfortaa', 'Pacifico', 'Permanent Marker',
];

export function textBlock(patch: Partial<TextBlock> = {}): TextBlock {
    return {
        lines: [],
        fontFamily: 'Inter',
        color: '#ffffff',
        shadow: 'normal',
        align: 'left',
        gap: 12,
        lineHeight: 1.2,
        outline: { enabled: false, width: 2, color: '#000000' },
        uppercase: false,
        letterSpacing: 0,
        ...patch,
    };
}

/** Valores de fábrica de cada tipo de elemento (lo que no trae una config la completa con esto). */
export const KIND_OPTIONS: Record<ElementKind, Record<string, any>> = {
    panel: {},
    clip: { radius: 12, shadow: true, borderWidth: 0, borderColor: '#ffffff' },
    avatar: { shape: 'circle', radius: 16, borderWidth: 4, borderColor: 'rgba(255, 255, 255, 0.4)', shadow: true },
    text: {},
    badge: { showAffiliate: true },
    live: { label: 'EN VIVO', background: '#e91916', color: '#ffffff', pulse: true, radius: 6, fontSize: 18 },
    progress: { track: 'rgba(255, 255, 255, 0.2)', fill: '', radius: 4 },
    timer: {},
    /** Franja o forma decorativa (fondo CSS: color o degradado). */
    shape: { background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 100%)', radius: '0px' },
};

export function element(id: string, kind: ElementKind, rect: { x: number; y: number; width: number; height: number }, patch: Partial<ShoutoutElement> = {}): ShoutoutElement {
    return { id, kind, enabled: true, ...rect, ...patch, options: { ...KIND_OPTIONS[kind], ...(patch.options ?? {}) } };
}

/** El overlay de siempre (1000×300): lo que ven los canales que nunca configuraron nada. */
export const LEGACY = {
    textLines: [
        { text: '🔥 ¡Sigan a @username! 🔥', fontSize: 32, fontWeight: 'bold', enabled: true },
        { text: 'Jugando: @game', fontSize: 24, fontWeight: '600', enabled: true },
    ],
    styles: {
        fontFamily: 'Inter', textColor: '#ffffff', textShadow: 'normal', backgroundType: 'gradient',
        gradientColor1: '#667eea', gradientColor2: '#764ba2', gradientAngle: 135, solidColor: '#8b5cf6', backgroundOpacity: 100,
    },
    layout: {
        clip: { x: 20, y: 20, width: 400, height: 260 },
        text: { x: 699, y: 82, align: 'center' },
        profile: { x: 660, y: 173, size: 90 },
    },
    width: 1000,
    height: 300,
};

/** Datos de ejemplo para la vista previa y el editor. */
export const SAMPLE_SHOUTOUT: ShoutoutData = {
    targetUser: 'streamer_amigo',
    displayName: 'Streamer_Amigo',
    gameName: 'Just Chatting',
    profileImageUrl: 'https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-300x300.png',
    /** En la vista previa cualquier valor muestra el cuadro de ejemplo. */
    clipUrl: 'sample',
    title: '¡Jugando con la comunidad! Pasa a saludar',
    tags: ['Español', 'Chill'],
    broadcasterType: 'affiliate',
    isLive: true,
    followers: 12480,
    clipTitle: 'La jugada del año',
    clipViews: 3210,
    clipCreator: 'un_moderador',
};

export function emptyLayout(): ShoutoutLayout {
    return {
        version: LAYOUT_VERSION,
        canvas: { width: LEGACY.width, height: LEGACY.height },
        theme: {
            background: { type: 'gradient', color1: '#667eea', color2: '#764ba2', angle: 135, solid: '#8b5cf6', opacity: 100 },
            borderEnabled: false, borderColor: '#ffffff', borderWidth: 3, radius: 20,
            shadow: '0 4px 16px rgba(0, 0, 0, 0.2)', blur: 0, accent: '#9146ff',
        },
        elements: [],
        animations: {
            enter: { type: 'fade-scale', direction: 'left', durationMs: 500, easing: 'ease-in-out' },
            exit: { type: 'fade-scale', direction: 'right', durationMs: 500, easing: 'ease-in-out' },
        },
    };
}
