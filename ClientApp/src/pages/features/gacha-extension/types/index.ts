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
    coinPullsAvailable: number;
    coinsSpentTotal: number;
    cumulativeDonationProgress: number;
    cumulativeCoinsProgress: number;
    displayName?: string;
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
    coinProbability?: number;
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
    allowedPullTypes: 'all' | 'donation_only' | 'coins_only';
    coinMinSpent?: number;
    cumulativeDonationThreshold?: number;
    cumulativeCoinsThreshold?: number;
    cumulativeGuarantee: boolean;
    cumulativeProbability?: number;
    milestonePriority: number;
    item?: GachaItem;
}

export interface GachaPreference {
    id: number;
    channelName: string;
    itemId: number;
    participantId?: number;
    probabilityPercentage: number;
    coinProbabilityOverride?: number;
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
    coinPullInterval?: number;
    coinTimeInterval?: number;
    coinTimeUnit?: string;
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
    pullType: string;
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

export type GachaTabType = 'items' | 'restrictions' | 'preferences' | 'rarity' | 'rarity-restrictions' | 'banners' | 'participants' | 'overlay' | 'sounds' | 'integrations' | 'commands';

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

// ============================================================================
// SOUND CONFIG
// ============================================================================

export interface SoundEventConfig {
    enabled: boolean;
    volume: number;
    url: string | null;
    useDefault: boolean;
}

export type SoundEventKey =
    | 'drum_roll' | 'flash'
    | 'reveal_common' | 'reveal_uncommon' | 'reveal_rare' | 'reveal_epic' | 'reveal_legendary'
    | 'win' | 'ambient';

export type GachaSoundsMap = Record<SoundEventKey, SoundEventConfig>;

export interface GachaSoundConfig {
    id?: number;
    channelName?: string;
    masterVolume: number;
    enableSounds: boolean;
    soundsJson: string;
}

export const DEFAULT_SOUND_EVENT: SoundEventConfig = {
    enabled: true,
    volume: 80,
    url: null,
    useDefault: true,
};

export const SOUND_EVENT_KEYS: SoundEventKey[] = [
    'drum_roll', 'flash',
    'reveal_common', 'reveal_uncommon', 'reveal_rare', 'reveal_epic', 'reveal_legendary',
    'win', 'ambient',
];

export const DEFAULT_SOUND_URLS: Record<SoundEventKey, string> = {
    drum_roll: '/assets/gacha/sounds/drum_roll.mp3',
    flash: '/assets/gacha/sounds/flash.mp3',
    reveal_common: '/assets/gacha/sounds/reveal_common.mp3',
    reveal_uncommon: '/assets/gacha/sounds/reveal_uncommon.mp3',
    reveal_rare: '/assets/gacha/sounds/reveal_rare.mp3',
    reveal_epic: '/assets/gacha/sounds/reveal_epic.mp3',
    reveal_legendary: '/assets/gacha/sounds/reveal_legendary.mp3',
    win: '/assets/gacha/sounds/win.mp3',
    ambient: '/assets/gacha/sounds/ambient.mp3',
};

export const SOUND_EVENT_META: Record<SoundEventKey, { label: string; description: string; group: 'general' | 'reveal' }> = {
    drum_roll:          { label: 'Redoble',             description: 'Build-up al inicio de la animacion',       group: 'general' },
    flash:              { label: 'Flash / Impacto',     description: 'Destello (solo legendario/epico)',         group: 'general' },
    reveal_common:      { label: 'Reveal — Comun',      description: 'Al revelar carta comun',                   group: 'reveal' },
    reveal_uncommon:    { label: 'Reveal — Poco Comun',  description: 'Al revelar carta poco comun',              group: 'reveal' },
    reveal_rare:        { label: 'Reveal — Raro',       description: 'Al revelar carta rara',                    group: 'reveal' },
    reveal_epic:        { label: 'Reveal — Epico',      description: 'Al revelar carta epica',                   group: 'reveal' },
    reveal_legendary:   { label: 'Reveal — Legendario', description: 'Al revelar carta legendaria',              group: 'reveal' },
    win:                { label: 'Celebracion',         description: 'Extra para legendario/epico',              group: 'general' },
    ambient:            { label: 'Ambiente',            description: 'Sonido sutil durante la exhibicion',       group: 'general' },
};
