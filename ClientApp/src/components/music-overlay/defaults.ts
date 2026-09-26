import type { ElementConfig, ElementId, OverlayAnimations, OverlayLayout, OverlayTheme, ShowHideAnimation, TextStyle, MusicTrack } from './types';

export const FONT_FAMILIES = [
    'Inter', 'Roboto', 'Montserrat', 'Poppins', 'Oswald', 'Bebas Neue', 'Rajdhani',
    'Exo 2', 'Space Grotesk', 'JetBrains Mono', 'Playfair Display', 'Press Start 2P', 'system-ui',
];

/** Orden en que se listan y se dibujan (lo de abajo queda encima). */
export const ELEMENT_ORDER: ElementId[] = [
    'panel', 'video', 'cover', 'equalizer', 'title', 'artist', 'album', 'requester',
    'progress', 'time', 'next', 'queue', 'source',
];

/** Elementos con texto (los que tienen tipografía propia). */
export const TEXT_ELEMENTS: ElementId[] = ['title', 'artist', 'album', 'requester', 'time', 'next', 'queue', 'source'];

export const text = (patch: Partial<TextStyle> = {}): TextStyle => ({
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '500',
    color: '#ffffff',
    align: 'left',
    shadow: 'soft',
    uppercase: false,
    letterSpacing: 0,
    marquee: false,
    ...patch,
});

const el = (enabled: boolean, x: number, y: number, width: number, height: number, extra: Partial<ElementConfig> = {}): ElementConfig => ({
    enabled, x, y, width, height, options: {}, ...extra,
});

export const DEFAULT_THEME: OverlayTheme = {
    panelBackground: 'rgba(10, 10, 15, 0.85)',
    panelBorderColor: 'rgba(57, 255, 20, 0.35)',
    panelBorderWidth: 1,
    panelRadius: 18,
    panelBlur: 8,
    panelShadow: true,
    accent: '#39ff14',
    coverRadius: 12,
};

/** Entrada y salida del overlay entero. Un fundido con la duración general es lo que hacía siempre. */
export const fadeShowHide = (durationMs: number): ShowHideAnimation => ({ type: 'fade', direction: 'left', durationMs, easing: 'ease' });

export const DEFAULT_ANIMATIONS: OverlayAnimations = {
    songChange: 'slide-up',
    durationMs: 600,
    hideWhenIdle: true,
    marqueeSpeed: 40,
    freezeWhenPaused: true,
    enter: fadeShowHide(600),
    exit: fadeShowHide(600),
};

/** Tarjeta horizontal: portada a la izquierda, datos a la derecha. */
export function cardLayout(): OverlayLayout {
    return {
        canvas: { width: 800, height: 200 },
        theme: { ...DEFAULT_THEME },
        animations: { ...DEFAULT_ANIMATIONS },
        elements: {
            panel: el(true, 0, 0, 800, 200),
            video: el(false, 20, 20, 284, 160),
            cover: el(true, 20, 20, 284, 160),
            equalizer: el(true, 324, 26, 36, 18, { options: { bars: 4 } }),
            title: el(true, 324, 50, 456, 40, { text: text({ fontSize: 26, fontWeight: '800', marquee: true }) }),
            artist: el(true, 324, 92, 456, 28, { text: text({ fontSize: 18, color: '#a1a1aa' }) }),
            album: el(false, 324, 122, 456, 24, { text: text({ fontSize: 14, color: '#71717a' }) }),
            requester: el(true, 324, 122, 456, 24, { text: text({ fontSize: 14, color: '#39ff14', fontWeight: '600' }), options: { label: '' } }),
            progress: el(true, 324, 160, 330, 8, { options: { fill: '#39ff14', track: 'rgba(255,255,255,0.15)', radius: 4 } }),
            time: el(true, 664, 151, 116, 26, { text: text({ fontSize: 13, color: '#a1a1aa', align: 'right', fontFamily: 'JetBrains Mono' }), options: { format: 'elapsed_total' } }),
            next: el(false, 324, 170, 456, 22, { text: text({ fontSize: 13, color: '#a1a1aa' }), options: { label: '' } }),
            queue: el(false, 20, 210, 760, 120, { text: text({ fontSize: 14, color: '#d4d4d8' }), options: { count: 3, showRequester: true } }),
            source: el(false, 700, 22, 80, 20, { text: text({ fontSize: 11, color: '#71717a', align: 'right', uppercase: true, letterSpacing: 2 }) }),
        },
    };
}

/** Barra delgada: todo en una línea. */
export function barLayout(): OverlayLayout {
    const l = cardLayout();
    l.canvas = { width: 900, height: 90 };
    l.theme = { ...l.theme, panelRadius: 45, coverRadius: 36 };
    Object.assign(l.elements, {
        panel: el(true, 0, 0, 900, 90),
        video: el(false, 12, 12, 118, 66),
        cover: el(true, 12, 12, 66, 66),
        equalizer: el(true, 94, 20, 26, 14, { options: { bars: 4 } }),
        title: el(true, 128, 12, 560, 34, { text: text({ fontSize: 22, fontWeight: '800', marquee: true }) }),
        artist: el(true, 94, 44, 360, 24, { text: text({ fontSize: 15, color: '#a1a1aa' }) }),
        requester: el(true, 460, 44, 300, 24, { text: text({ fontSize: 13, color: '#39ff14', fontWeight: '600', align: 'right' }), options: { label: '' } }),
        progress: el(true, 94, 72, 666, 5, { options: { fill: '#39ff14', track: 'rgba(255,255,255,0.15)', radius: 3 } }),
        time: el(true, 772, 32, 108, 26, { text: text({ fontSize: 14, color: '#a1a1aa', align: 'right', fontFamily: 'JetBrains Mono' }), options: { format: 'elapsed_total' } }),
    });
    return l;
}

/** Vertical: portada arriba, ideal para una columna al costado. */
export function verticalLayout(): OverlayLayout {
    const l = cardLayout();
    l.canvas = { width: 360, height: 560 };
    Object.assign(l.elements, {
        panel: el(true, 0, 0, 360, 560),
        video: el(false, 20, 20, 320, 180),
        cover: el(true, 20, 20, 320, 180),
        equalizer: el(true, 20, 216, 36, 18, { options: { bars: 4 } }),
        title: el(true, 20, 240, 320, 64, { text: text({ fontSize: 24, fontWeight: '800' }) }),
        artist: el(true, 20, 306, 320, 26, { text: text({ fontSize: 17, color: '#a1a1aa' }) }),
        requester: el(true, 20, 334, 320, 22, { text: text({ fontSize: 13, color: '#39ff14', fontWeight: '600' }), options: { label: '' } }),
        progress: el(true, 20, 370, 320, 6, { options: { fill: '#39ff14', track: 'rgba(255,255,255,0.15)', radius: 3 } }),
        time: el(true, 20, 380, 320, 22, { text: text({ fontSize: 12, color: '#a1a1aa', align: 'right', fontFamily: 'JetBrains Mono' }), options: { format: 'elapsed_total' } }),
        next: el(false, 20, 420, 320, 22, { text: text({ fontSize: 13, color: '#a1a1aa' }), options: { label: '' } }),
        queue: el(true, 20, 420, 320, 120, { text: text({ fontSize: 13, color: '#d4d4d8' }), options: { count: 4, showRequester: false } }),
    });
    return l;
}

/** Solo para el reproductor: el video de YouTube a la vista con los datos abajo. */
export function videoLayout(): OverlayLayout {
    const l = cardLayout();
    l.canvas = { width: 640, height: 470 };
    Object.assign(l.elements, {
        panel: el(true, 0, 0, 640, 470),
        video: el(true, 16, 16, 608, 342),
        cover: el(false, 16, 16, 608, 342),
        equalizer: el(true, 16, 378, 32, 18, { options: { bars: 4 } }),
        title: el(true, 56, 370, 568, 36, { text: text({ fontSize: 22, fontWeight: '800', marquee: true }) }),
        artist: el(true, 16, 408, 400, 26, { text: text({ fontSize: 16, color: '#a1a1aa' }) }),
        requester: el(true, 16, 434, 400, 22, { text: text({ fontSize: 13, color: '#39ff14', fontWeight: '600' }), options: { label: '' } }),
        progress: el(false, 16, 460, 608, 4, { options: { fill: '#39ff14', track: 'rgba(255,255,255,0.15)', radius: 2 } }),
        time: el(true, 424, 420, 200, 26, { text: text({ fontSize: 14, color: '#a1a1aa', align: 'right', fontFamily: 'JetBrains Mono' }), options: { format: 'elapsed_total' } }),
    });
    return l;
}

export const LAYOUT_PRESETS: { id: string; build: () => OverlayLayout; playerOnly?: boolean }[] = [
    { id: 'card', build: cardLayout },
    { id: 'bar', build: barLayout },
    { id: 'vertical', build: verticalLayout },
    { id: 'video', build: videoLayout, playerOnly: true },
];

/** Completa lo que falte (configs guardadas antes de agregar un elemento u opción nuevos). */
export function normalizeLayout(raw: any): OverlayLayout {
    const base = cardLayout();
    if (!raw || typeof raw !== 'object') return base;
    const elements = { ...base.elements };
    for (const id of ELEMENT_ORDER) {
        const saved = raw.elements?.[id];
        if (saved) {
            elements[id] = {
                ...base.elements[id],
                ...saved,
                text: base.elements[id].text ? { ...base.elements[id].text!, ...(saved.text ?? {}) } : saved.text,
                options: { ...base.elements[id].options, ...(saved.options ?? {}) },
            };
        }
    }
    const animations: OverlayAnimations = { ...base.animations, ...(raw.animations ?? {}) };
    // Guardado antes de que existieran entrada y salida: el fundido de siempre, con su duración
    animations.enter = { ...fadeShowHide(animations.durationMs), ...(raw.animations?.enter ?? {}) };
    animations.exit = { ...fadeShowHide(animations.durationMs), ...(raw.animations?.exit ?? {}) };
    return {
        canvas: { ...base.canvas, ...(raw.canvas ?? {}) },
        theme: { ...base.theme, ...(raw.theme ?? {}) },
        animations,
        elements,
    };
}

/** Canciones de ejemplo para la vista previa y el editor de los overlays que no tienen cola. */
export const SAMPLE_TRACKS: MusicTrack[] = [
    { id: 'sample-1', title: 'Never Gonna Give You Up', artist: 'Rick Astley', album: 'Whenever You Need Somebody', durationSeconds: 213, thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', source: 'spotify' },
    { id: 'sample-2', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', durationSeconds: 355, thumbnailUrl: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg', source: 'spotify' },
    { id: 'sample-3', title: 'Tití Me Preguntó', artist: 'Bad Bunny', album: 'Un Verano Sin Ti', durationSeconds: 243, thumbnailUrl: 'https://i.ytimg.com/vi/Cr8K88UcO0s/hqdefault.jpg', source: 'lastfm' },
];
