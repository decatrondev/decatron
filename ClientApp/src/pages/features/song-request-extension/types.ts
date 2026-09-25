// Song Request (.dev/plans/SONG_REQUEST_PLAN.md, fase 2): tipos del dashboard, los overlays y el editor.

export type Role = 'everyone' | 'subscriber' | 'vip' | 'moderator' | 'lead_moderator' | 'broadcaster';

export interface SongRequestSettings {
    permissions: { request: Role; skip: Role; manage: Role };
    maxQueueSize: number;
    maxPerUser: number;
    skipVoteEnabled: boolean;
    skipVotesRequired: number;
    queuePreviewCount: number;
    maxDurationSeconds: number;
    allowUnknownDuration: boolean;
    minViews: number;
    noRepeatMinutes: number;
    fallbackEnabled: boolean;
    fallbackShuffle: boolean;
    messages: Record<string, string>;
}

export interface QueueItem {
    id: number;
    position: number;
    source: string | null;
    sourceId: string | null;
    url: string | null;
    title: string;
    artist: string;
    durationSeconds: number | null;
    thumbnailUrl: string | null;
    requestedBy: string;
    requestedByLogin?: string;
    platform: string;
    /** Lo puso la playlist de respaldo (no lo pidió nadie). */
    isFallback?: boolean;
    originSource: string | null;
    originUrl: string | null;
}

export interface QueueSnapshot {
    channel: string;
    enabled: boolean;
    requestsOpen: boolean;
    paused: boolean;
    volume: number;
    /** El reproductor corta aquí las canciones de duración desconocida (0 = no corta). */
    maxDurationSeconds?: number;
    /** Con la cola vacía suena la playlist de respaldo. */
    fallbackEnabled?: boolean;
    playerConnected: boolean;
    current: QueueItem | null;
    queue: QueueItem[];
    totalDurationSeconds: number;
}

export interface PlaybackProgress {
    itemId: number;
    position: number;
    duration: number;
    playing: boolean;
}

// ── Diseño de los overlays ───────────────────────────────────────────────

/** Qué overlay se edita: el que suena (con el reproductor) o el que solo muestra. */
export type OverlayKind = 'player' | 'nowPlaying';

export type ElementId =
    | 'panel' | 'video' | 'cover' | 'equalizer' | 'title' | 'artist' | 'requester'
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

export interface OverlayAnimations {
    songChange: SongChangeAnimation;
    durationMs: number;
    /** Sin canción: el overlay desaparece (con la misma animación). */
    hideWhenIdle: boolean;
    marqueeSpeed: number;
    /** Ecualizador y barra quietos cuando está en pausa. */
    freezeWhenPaused: boolean;
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

export interface SongRequestOverlayConfig {
    player: OverlayLayout;
    nowPlaying: OverlayLayout;
    templates: SavedTemplate[];
}

export type TabId =
    | 'guide' | 'queue' | 'basic' | 'filters' | 'blacklist' | 'fallback' | 'history' | 'downloads' | 'commands' | 'messages'
    | 'theme' | 'elements' | 'typography' | 'animations' | 'editor';
