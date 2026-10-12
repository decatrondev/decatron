export type LtTab = 'guide' | 'general' | 'access';

export interface AccessSettings {
    maxListenersTotal: number | null;
    maxListenersPerLanguage: number | null;
    maxActiveLanguages: number;
    maxConnectionsPerIp: number;
    paused: boolean;
}

export interface AccessView {
    tier: string;
    settings: AccessSettings;
    effective: { maxListenersTotal: number; maxListenersPerLanguage: number; maxActiveLanguages: number; maxConnectionsPerIp: number; paused: boolean };
    ceilings: { maxListeners: number; defaultListeners: number; maxLanguages: number; maxConnectionsPerIp: number };
    now: { listeners: number; byLanguage: Record<string, number> };
}
