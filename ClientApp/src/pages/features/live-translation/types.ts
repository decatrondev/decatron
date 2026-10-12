export type LtTab = 'guide' | 'general' | 'access';

export interface AccessSettings {
    maxListenersTotal: number | null;
    maxListenersPerLanguage: number | null;
    maxActiveLanguages: number;
    maxConnectionsPerIp: number;
    paused: boolean;
    mode: AccessMode;
    minFollowDays: number;
    minSubTier: number;
    allowList: string;
    blockList: string;
    creditBudgetPerSession: number | null;
}

export type AccessMode = 'everyone' | 'logged_in' | 'followers' | 'subscribers' | 'vip' | 'mods' | 'list';

export interface AccessView {
    tier: string;
    settings: AccessSettings;
    effective: { maxListenersTotal: number; maxListenersPerLanguage: number; maxActiveLanguages: number; maxConnectionsPerIp: number; paused: boolean };
    ceilings: { maxListeners: number; defaultListeners: number; maxLanguages: number; maxConnectionsPerIp: number };
    now: { listeners: number; byLanguage: Record<string, number> };
    cost: { perSpeechHour: number | null; sessions: number };
    abuse: AbuseInfo | null;
    levels: { hasTwitch: boolean; tokenValid: boolean; missing: Record<string, string[]> };
}

export interface AbuseInfo { since: string; until: string; reason: 'probe' | 'flood'; attempts: number; rejections: number }
export interface ListenerRow { id: string; lang: string; login: string | null; ip: string; since: string }
