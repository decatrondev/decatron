export interface PageConfig {
    enabled: boolean;
    title: string;
    tagline: string;
    description: string;
    monthlyGoal: number;
    monthlyRaised: number;
    showProgressBar: boolean;
    showSupportersWall: boolean;
    showFoundersSection: boolean;
    heroFrom: string;
    heroTo: string;
    tierDurations?: Record<TierId, TierDuration>;
}

export interface TierConfig {
    id: string;
    name: string;
    badgeEmoji: string;
    color: string;
    monthlyPrice: number | null;
    permanentPrice: number | null;
    benefits: string[];
    highlighted: boolean;
}

export interface Supporter {
    id: number;
    displayName: string;
    twitchLogin: string;
    tier: string;
    isPermanent: boolean;
    joinedAt: string;
    expiresAt: string | null;
    totalDonated: number;
}

export interface DiscountCode {
    id: number;
    code: string;
    discountType: 'fixed' | 'percent';
    discountValue: number;
    appliesTo: 'all' | 'supporter' | 'premium' | 'fundador';
    maxUses: number | null;
    usedCount: number;
    expiresAt: string | null;
    active: boolean;
    createdAt: string;
}

export type DurationUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';
export type TabType = 'general' | 'tiers' | 'supporters' | 'codes' | 'testing' | 'appearance' | 'cupos';

export interface SpotifySlotRequest {
    userId: number;
    displayName: string;
    login: string;
    spotifyEmail: string;
    tier: string;
    slotAssigned: boolean;
    slotAssignedAt: string | null;
    spotifyConnected: boolean;
    requestedAt: string;
}

export type TierDuration = { isPermanent: boolean; duration: number; unit: DurationUnit };
export type TierId = 'supporter' | 'premium' | 'fundador';
