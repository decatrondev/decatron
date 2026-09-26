import type { SongRequestOverlayConfig, SongRequestSettings, QueueItem } from '../types';
import { cardLayout, normalizeLayout } from '../../../../components/music-overlay/defaults';

// El diseño de los overlays (elementos, diseños prearmados, normalización) es del motor compartido.
export {
    FONT_FAMILIES, ELEMENT_ORDER, TEXT_ELEMENTS, text, DEFAULT_THEME, DEFAULT_ANIMATIONS,
    cardLayout, barLayout, verticalLayout, videoLayout, LAYOUT_PRESETS, normalizeLayout,
} from '../../../../components/music-overlay/defaults';

export const ROLES = ['everyone', 'subscriber', 'vip', 'moderator', 'lead_moderator', 'broadcaster'] as const;

export const DEFAULT_SETTINGS: SongRequestSettings = {
    permissions: { request: 'everyone', skip: 'moderator', manage: 'lead_moderator' },
    maxQueueSize: 50,
    maxPerUser: 3,
    skipVoteEnabled: false,
    skipVotesRequired: 3,
    queuePreviewCount: 3,
    maxDurationSeconds: 0,
    allowUnknownDuration: true,
    minViews: 0,
    noRepeatMinutes: 0,
    fallbackEnabled: false,
    fallbackShuffle: false,
    messages: {},
};

export function defaultOverlayConfig(): SongRequestOverlayConfig {
    return { player: cardLayout(), nowPlaying: cardLayout(), templates: [] };
}

export function normalizeOverlayConfig(raw: any): SongRequestOverlayConfig {
    return {
        player: normalizeLayout(raw?.player),
        nowPlaying: normalizeLayout(raw?.nowPlaying),
        templates: Array.isArray(raw?.templates) ? raw.templates : [],
    };
}

/** Canciones de ejemplo para la vista previa y el editor. */
export const SAMPLE_SONGS: QueueItem[] = [
    {
        id: -1, position: 0, source: 'youtube', sourceId: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)', artist: 'Rick Astley',
        durationSeconds: 213, thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        requestedBy: 'viewer_uno', platform: 'twitch', originSource: null, originUrl: null,
    },
    {
        id: -2, position: 1, source: 'youtube', sourceId: 'kJQP7kiw5Fk', url: 'https://youtu.be/kJQP7kiw5Fk',
        title: 'Luis Fonsi - Despacito ft. Daddy Yankee', artist: 'Luis Fonsi',
        durationSeconds: 282, thumbnailUrl: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
        requestedBy: 'LaMejorFan', platform: 'twitch', originSource: null, originUrl: null,
    },
    {
        id: -3, position: 2, source: 'youtube', sourceId: 'fJ9rUzIMcZQ', url: 'https://youtu.be/fJ9rUzIMcZQ',
        title: 'Queen – Bohemian Rhapsody (Official Video Remastered)', artist: 'Queen',
        durationSeconds: 360, thumbnailUrl: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg',
        requestedBy: 'Mod_Pedro', platform: 'twitch', originSource: null, originUrl: null,
    },
    {
        id: -4, position: 3, source: 'youtube', sourceId: 'Cr8K88UcO0s', url: 'https://youtu.be/Cr8K88UcO0s',
        title: 'Bad Bunny - Tití Me Preguntó (Official Video) | Un Verano Sin Ti', artist: 'Bad Bunny',
        durationSeconds: 291, thumbnailUrl: 'https://i.ytimg.com/vi/Cr8K88UcO0s/hqdefault.jpg',
        requestedBy: 'xX_Gamer_Xx', platform: 'twitch', originSource: null, originUrl: null,
    },
];
