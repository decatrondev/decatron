import api from '../../../services/api';
import { GameId, GameOverlayInstance, GameVisualConfig, OverlayState, PromoCatalog } from './types';

export interface ProviderCapabilities {
    hasRank: boolean; hasExactPoints: boolean; hasRecentMatches: boolean; hasKda: boolean;
    hasLiveGame: boolean; isManualOnly: boolean; requiresVerification: boolean; requiresRegion: boolean;
    supportedQueues: string[];
}
export interface CatalogEntry { game: GameId; provider: string; hasApi: boolean; capabilities: ProviderCapabilities; }

export interface LinkedAccount {
    id: number; game: GameId; provider: string; displayName: string; externalName: string; externalTag?: string | null;
    fullName: string; region?: string | null; verified: boolean; verificationPending: boolean;
    verificationChallengeIconId?: number | null; manualRank?: { tier: string; division?: string | null; points?: number | null } | null;
    sortOrder: number; isActive: boolean; createdAt: string; hasApi: boolean;
}

export interface TierLimits {
    maxAccountsPerGame: number; maxInstances: number | null; allowedRotationModes: string[];
    pollingIntervalSeconds: number; maxRecentMatches: number; sessionHistoryDays: number | null;
    canHidePromo: boolean;
}

export interface Detection { categoryId?: string | null; categoryName?: string | null; detectedGame?: GameId | null; overrideGame?: GameId | null; }

export interface PanelData {
    channel: { id: number; login: string; platform: 'twitch' | 'kick'; displayName: string };
    tier: string;
    limits: TierLimits;
    catalog: CatalogEntry[];
    accounts: LinkedAccount[];
    instances: GameOverlayInstance[];
    detection?: Detection | null;
    overlayUrlTemplate: string;
}

export const gameOverlaysApi = {
    panel: () => api.get<PanelData & { success: boolean }>('/game-overlays').then(r => r.data),
    createInstance: (body: { slug?: string; name?: string }) => api.post('/game-overlays', body).then(r => r.data),
    updateInstance: (slug: string, body: {
        name?: string; isEnabled?: boolean; detectionMode?: string; forcedGame?: string | null; idleBehavior?: string;
        canvas?: { width: number; height: number }; games?: Partial<Record<GameId, Partial<GameVisualConfig>>>;
    }) => api.put<{ success: boolean; instance: GameOverlayInstance; adjustments: string[]; message?: string }>(`/game-overlays/${slug}`, body).then(r => r.data),
    deleteInstance: (slug: string) => api.delete(`/game-overlays/${slug}`).then(r => r.data),
    forceGame: (game: string | null) => api.post('/game-overlays/force-game', { game: game ?? 'auto' }).then(r => r.data),
    preview: (slug: string, game: GameId) => api.get<{ success: boolean; state: OverlayState }>(`/game-overlays/${slug}/preview?game=${game}`).then(r => r.data),
    /** Anuncios de Decatron activos (catálogo del admin), para el preview del editor. */
    promos: (lang: 'es' | 'en') => api.get<{ success: boolean; promos: PromoCatalog }>(`/game-overlays/promos?lang=${lang}`).then(r => r.data.promos),

    accounts: () => api.get<{ success: boolean; accounts: LinkedAccount[]; catalog: CatalogEntry[] }>('/me/game-accounts').then(r => r.data),
    link: (body: { game: GameId; name: string; tag?: string; region?: string; displayName?: string }) =>
        api.post<{ success: boolean; account?: LinkedAccount; message?: string }>('/me/game-accounts', body).then(r => r.data),
    verify: (id: number) => api.post<{ success: boolean; message: string }>(`/me/game-accounts/${id}/verify`).then(r => r.data),
    updateAccount: (id: number, body: { displayName?: string; sortOrder?: number; isActive?: boolean; manualRank?: { tier: string; division?: string | null; points?: number | null }; clearManualRank?: boolean }) =>
        api.put<{ success: boolean; account: LinkedAccount }>(`/me/game-accounts/${id}`, body).then(r => r.data),
    deleteAccount: (id: number) => api.delete(`/me/game-accounts/${id}`).then(r => r.data),
};

export function errorMessage(err: any, fallback = 'Ocurrió un error'): string {
    return err?.response?.data?.message || err?.message || fallback;
}
