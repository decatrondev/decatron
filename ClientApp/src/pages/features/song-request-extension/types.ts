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

// El diseño de los overlays es del motor compartido (components/music-overlay).
import type { OverlayLayout, SavedTemplate } from '../../../components/music-overlay/types';
export type {
    PlaybackProgress, ElementId, TextShadow, TextStyle, ElementConfig, OverlayTheme, SongChangeAnimation,
    OverlayAnimations, OverlayLayout, SavedTemplate, ShowHideAnimation, MusicTrack,
} from '../../../components/music-overlay/types';

/** Qué overlay se edita: el que suena (con el reproductor) o el que solo muestra. */
export type OverlayKind = 'player' | 'nowPlaying';

export interface SongRequestOverlayConfig {
    player: OverlayLayout;
    nowPlaying: OverlayLayout;
    templates: SavedTemplate[];
}

export type TabId =
    | 'guide' | 'queue' | 'basic' | 'filters' | 'blacklist' | 'fallback' | 'history' | 'downloads' | 'commands' | 'messages'
    | 'theme' | 'elements' | 'typography' | 'animations' | 'editor';
