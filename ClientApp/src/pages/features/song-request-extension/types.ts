// Song Request (.dev/plans/SONG_REQUEST_PLAN.md, fase 2): tipos del dashboard, los overlays y el editor.

export type Role = 'everyone' | 'subscriber' | 'vip' | 'moderator' | 'lead_moderator' | 'broadcaster';

export interface SongRequestSettings {
    permissions: { request: Role; skip: Role; manage: Role; review: Role };
    maxQueueSize: number;
    maxPerUser: number;
    /** Pedidos por usuario en la última hora (0 = sin límite). */
    maxPerUserPerHour: number;
    skipVoteEnabled: boolean;
    skipVotesRequired: number;
    queuePreviewCount: number;
    maxDurationSeconds: number;
    allowUnknownDuration: boolean;
    minViews: number;
    noRepeatMinutes: number;
    fallbackEnabled: boolean;
    /** Tarjeta de Decatron en los overlays: solo se apaga desde el plan Supporter. */
    showPromo: boolean;
    /** Los pedidos de !sr esperan aprobación (fase 3). */
    requestReview: boolean;
    /** any = cualquier canción; playlists = solo de playlists curadas (fase 4). */
    requestSource: 'any' | 'playlists';
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
    requestReview?: boolean;
    requestSource?: 'any' | 'playlists';
    /** El modo rápido que resulta: abiertos, solo playlist, solo revisión o cerrado (fase 5). */
    mode?: RequestMode;
    /** Cuántos esperan aprobación (cola y playlists). */
    pendingCount?: number;
    activePlaylistId?: number | null;
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
    | 'guide' | 'queue' | 'review' | 'basic' | 'filters' | 'blacklist' | 'playlists' | 'history' | 'downloads' | 'commands' | 'messages'
    | 'theme' | 'elements' | 'typography' | 'animations' | 'editor';

/** Límites del plan del dueño del canal (SONG_REQUEST_PLAYLISTS_PLAN.md). null = sin tope. */
export interface SongRequestLimits {
    tier: string;
    maxPlaylists: number;
    maxItemsPerPlaylist: number;
    historyDays: number | null;
    maxTemplates: number;
    canHidePromo: boolean;
}

export interface PlaylistRequirements {
    minRole: Role;
    minAccountAgeDays: number;
    minFollowAgeDays: number;
    maxPerUser: number;
    maxFromViewers: number;
    cooldownMinutes: number;
}

export interface Playlist {
    id: number;
    name: string;
    visibility: 'public' | 'private';
    /** owner: solo el streamer y los mods; open: viewers que cumplan los requisitos. */
    contribution: 'owner' | 'open' | 'review';
    requirements: PlaylistRequirements;
    /** Puesta a sonar: llena el silencio en vez de la de respaldo. */
    isActive: boolean;
    votingEnabled: boolean;
    sortByVotes: boolean;
    isFallback: boolean;
    shuffle: boolean;
    count: number;
}

export type RequestMode = 'open' | 'playlists' | 'review' | 'closed';
