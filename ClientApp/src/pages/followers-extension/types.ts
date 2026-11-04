export type PlatformFilter = 'all' | 'twitch' | 'kick';
export type FollowersTab = 'guide' | 'list' | 'sync';

export interface FollowerStats {
    totalFollowers: number;
    activeFollowers: number;
    unfollowedCount: number;
    blockedCount: number;
    returnedCount: number;
}

/** Resultado del último intento de sincronización con Twitch (lo guarda el servidor). */
export interface SyncStatus {
    lastAttemptAt: string;
    lastSuccessAt?: string | null;
    source: 'manual' | 'auto';
    result: 'ok' | 'unfollows_skipped' | 'fetch_failed' | 'skipped_large';
    detail?: string | null;
    newFollowers?: number;
    returned?: number;
    unfollowed?: number;
    renamed?: number;
}

export interface AvailablePlatforms { twitch: boolean; kick: boolean }
export type PlatformCounts = Record<string, { active: number; total: number }>;
