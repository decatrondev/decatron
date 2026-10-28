import type { PromoDesign } from '../../../components/promo-overlay/types';

export type PromoKind = 'commands' | 'module' | 'qr' | 'news' | 'credits' | 'community' | 'emergency';
export type PromoPlatforms = 'all' | 'twitch' | 'kick';
export type PromoStatus = 'draft' | 'published';

export interface PromoPiece {
    id: number; kind: PromoKind; origin: 'bot' | 'tercero';
    titleEs: string; titleEn: string; bodyEs: string; bodyEn: string;
    linkUrl: string | null; showQr: boolean; imageUrl: string | null; icon: string | null;
    /** Clave de una zona. */
    templateId: number | null; zone: string; priority: number; weight: number; durationSeconds: number; isPinned: boolean;
    startsAt: string | null; endsAt: string | null; platforms: PromoPlatforms; onlyChannels: string | null;
    status: PromoStatus; sortOrder: number;
}

export interface PromoTemplate {
    id: number; key: string; nameEs: string; nameEn: string;
    /** Clave de la zona donde se pone por defecto. */
    zone: string;
    isEnabled: boolean; sortOrder: number;
    design: PromoDesign;
}

export type Anchor = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface PromoZone {
    id: number; key: string; nameEs: string; nameEn: string; anchor: Anchor; marginX: number; marginY: number; isEnabled: boolean; sortOrder: number;
}

export interface PromoLimits {
    minGapSeconds: number; hourlyCapSeconds: number;
    minDurationSeconds: number; maxDurationSeconds: number; minScalePercent: number; maxScalePercent: number; maxZoneMargin: number; botPerOwn: number; ownMinIntervalMinutes: number; oneAtATime: boolean;
}

export interface PromoOptions {
    kinds: PromoKind[]; origins: string[]; anchors: Anchor[]; platforms: PromoPlatforms[]; variables: string[]; icons: string[];
    textVariables: string[]; boxShadows: string[]; fonts: { family: string; weights: number[] }[];
}

export interface PromoOverview {
    pieces: PromoPiece[];
    /** Entregas al overlay por pieza (todos los canales): últimos 7 y 30 días y total. */
    views: Record<string, { last7: number; last30: number; total: number }>;
    templates: { template: PromoTemplate; pieceCount: number }[];
    zones: { zone: PromoZone; pieceCount: number; templateCount: number }[];
    limits: PromoLimits;
    options: PromoOptions;
}

export const EMPTY_PIECE: PromoPiece = {
    id: 0, kind: 'news', origin: 'bot', titleEs: '', titleEn: '', bodyEs: '', bodyEn: '',
    linkUrl: null, showQr: false, imageUrl: null, icon: null, templateId: null, zone: 'corner',
    priority: 0, weight: 1, durationSeconds: 8, isPinned: false, startsAt: null, endsAt: null, platforms: 'all', onlyChannels: null,
    status: 'draft', sortOrder: 0,
};

export const EMPTY_ZONE: PromoZone = { id: 0, key: '', nameEs: '', nameEn: '', anchor: 'top-right', marginX: 96, marginY: 54, isEnabled: true, sortOrder: 0 };

/** Tarjeta propia de un streamer, vista por el dueño. */
export interface PromoOwnCardAdmin {
    id: number; userId: number; login: string; tenantId: number; title: string; body: string; icon: string | null; linkUrl: string | null;
    showQr: boolean; zone: string; isEnabled: boolean; hiddenByAdmin: boolean; createdAt: string; imageUrl: string | null;
}
