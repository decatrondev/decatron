// ============================================================================
// GACHA SYSTEM — TypeScript Types
// ============================================================================

export interface GachaItem {
    id: number;
    channelName: string;
    name: string;
    rarity: RarityType;
    image?: string;
    available: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface GachaParticipant {
    id: number;
    channelName: string;
    name: string;
    twitchUserId?: string;
    donationAmount: number;
    effectiveDonation: number;
    pulls: number;
    createdAt: string;
    updatedAt: string;
}

export interface GachaInventory {
    id: number;
    channelName: string;
    participantId: number;
    itemId: number;
    quantity: number;
    isRedeemed: boolean;
    lastWonAt: string;
    createdAt: string;
    item?: GachaItem;
    participant?: GachaParticipant;
}

export interface GachaRarityConfig {
    id: number;
    channelName: string;
    rarity: string;
    probability: number;
}

export interface GachaItemRestriction {
    id: number;
    channelName: string;
    itemId: number;
    minDonationRequired: number;
    totalQuantity?: number;
    isUnique: boolean;
    cooldownPeriod: string;
    cooldownValue: number;
    item?: GachaItem;
}

export interface GachaPreference {
    id: number;
    channelName: string;
    itemId: number;
    participantId?: number;
    probabilityPercentage: number;
    isActive: boolean;
    item?: GachaItem;
    participant?: GachaParticipant;
}

export interface GachaRarityRestriction {
    id: number;
    channelName: string;
    itemId?: number;
    participantId?: number;
    rarity?: string;
    pullInterval?: number;
    timeInterval?: number;
    timeUnit?: string;
    isActive: boolean;
    item?: GachaItem;
    participant?: GachaParticipant;
}

export interface GachaBanner {
    id: number;
    channelName: string;
    bannerUrl: string;
    isActive: boolean;
    createdAt: string;
}

export interface GachaOverlayConfig {
    id: number;
    channelName: string;
    overlaySize: string;
    customWidth?: number;
    customHeight?: number;
    animationSpeed: number;
    enableDebug: boolean;
    enableSounds: boolean;
}

export interface GachaPullLog {
    id: number;
    channelName: string;
    participantId: number;
    itemId: number;
    action: string;
    amount?: number;
    occurredAt: string;
    item?: GachaItem;
}

export interface GachaCollectionStats {
    uniqueCards: number;
    totalCards: number;
    totalAvailable: number;
    byRarity: Record<string, number>;
}

export interface GachaPullResult {
    id: number;
    name: string;
    rarity: RarityType;
    image?: string;
}

export type RarityType = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type GachaTabType = 'items' | 'restrictions' | 'preferences' | 'rarity' | 'rarity-restrictions' | 'banners' | 'participants' | 'overlay' | 'integrations';

// ============================================================================
// RARITY HELPERS
// ============================================================================

export const RARITY_CONFIG: Record<RarityType, { label: string; color: string; bg: string; border: string; stars: number }> = {
    common:    { label: 'Comun',      color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: '#94a3b8', stars: 1 },
    uncommon:  { label: 'Poco Comun', color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: '#22c55e', stars: 2 },
    rare:      { label: 'Raro',       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   border: '#3b82f6', stars: 3 },
    epic:      { label: 'Epico',      color: '#a855f7', bg: 'rgba(168,85,247,0.1)',   border: '#a855f7', stars: 4 },
    legendary: { label: 'Legendario', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: '#f59e0b', stars: 5 },
};

export const RARITY_ORDER: RarityType[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

export const getRarityStars = (rarity: RarityType): string => '★'.repeat(RARITY_CONFIG[rarity]?.stars ?? 1);
