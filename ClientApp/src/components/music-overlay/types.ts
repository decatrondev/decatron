// Motor compartido de overlays de música (Song Request y Now Playing): el diseño por elementos,
// el renderer, el editor de lienzo y las pestañas de diseño. Ver .dev/plans/NOW_PLAYING_REDESIGN_PLAN.md (fase 0).

/** La canción que se dibuja. El QueueItem de Song Request encaja tal cual. */
export interface MusicTrack {
    id: number | string;
    title: string;
    artist: string;
    album?: string | null;
    durationSeconds: number | null;
    thumbnailUrl: string | null;
    /** Song Request: quién la pidió. */
    requestedBy?: string;
    /** Song Request: la puso la playlist de respaldo. */
    isFallback?: boolean;
    /** Servicio del audio (youtube, spotify, lastfm…). */
    source?: string | null;
    /** Servicio del link original, si es otro (Song Request: link de Spotify que suena por YouTube). */
    originSource?: string | null;
}

export interface PlaybackProgress {
    itemId: number | string;
    position: number;
    duration: number;
    playing: boolean;
}

export type ElementId =
    | 'panel' | 'video' | 'cover' | 'equalizer' | 'title' | 'artist' | 'album' | 'requester'
    | 'progress' | 'time' | 'next' | 'queue' | 'source';

export type TextShadow = 'none' | 'soft' | 'strong' | 'glow';

export interface TextStyle {
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    color: string;
    align: 'left' | 'center' | 'right';
    shadow: TextShadow;
    uppercase: boolean;
    letterSpacing: number;
    /** Texto largo: se desplaza en vez de cortarse con "…". */
    marquee: boolean;
}

export interface ElementConfig {
    enabled: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    text?: TextStyle;
    /** Propio de cada elemento (colores de la barra, cantidad de la cola, etiquetas…). */
    options: Record<string, any>;
}

export interface OverlayTheme {
    panelBackground: string;
    panelBorderColor: string;
    panelBorderWidth: number;
    panelRadius: number;
    panelBlur: number;
    panelShadow: boolean;
    accent: string;
    coverRadius: number;
}

export type SongChangeAnimation = 'none' | 'fade' | 'slide-up' | 'slide-left' | 'zoom' | 'flip';

export type Direction = 'left' | 'right' | 'top' | 'bottom';
export type Easing = 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';

/** Cómo aparece o desaparece el overlay entero (al empezar a sonar música o al quedar sin canción). */
export interface ShowHideAnimation {
    type: 'none' | 'fade' | 'slide' | 'bounce' | 'zoom';
    /** Desde dónde entra o hacia dónde sale (slide y bounce). */
    direction: Direction;
    durationMs: number;
    easing: Easing;
}

export interface OverlayAnimations {
    songChange: SongChangeAnimation;
    durationMs: number;
    /** Sin canción: el overlay desaparece con la animación de salida. */
    hideWhenIdle: boolean;
    marqueeSpeed: number;
    /** Ecualizador y barra quietos cuando está en pausa. */
    freezeWhenPaused: boolean;
    enter: ShowHideAnimation;
    exit: ShowHideAnimation;
}

export interface OverlayLayout {
    canvas: { width: number; height: number };
    theme: OverlayTheme;
    elements: Record<ElementId, ElementConfig>;
    animations: OverlayAnimations;
}

export interface SavedTemplate {
    id: string;
    name: string;
    icon: string;
    layout: OverlayLayout;
    createdAt: string;
}
