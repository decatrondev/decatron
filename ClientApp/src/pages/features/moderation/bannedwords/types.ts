export type SeverityLevel = 'leve' | 'medio' | 'severo';
export type ImmunityLevel = 'total' | 'escalamiento';
export type StrikeAction = 'warning' | 'delete' | 'timeout_30s' | 'timeout_1m' | 'timeout_5m' | 'timeout_10m' | 'timeout_30m' | 'timeout_1h' | 'ban';
export type StrikeExpiration = '5min' | '10min' | '15min' | '30min' | '1hour' | 'never';

export interface BannedWord {
    id: number;
    word: string;
    severity: SeverityLevel;
    detections: number;
    createdAt: string;
}

export interface ModerationConfig {
    vipImmunity: ImmunityLevel;
    subImmunity: ImmunityLevel;
    whitelistUsers: string[];
    warningMessage: string;
    deleteMessage: string;
    timeoutMessage: string;
    banMessage: string;
    severoMessage: string;
    strikeExpiration: StrikeExpiration;
    strike1Action: StrikeAction;
    strike2Action: StrikeAction;
    strike3Action: StrikeAction;
    strike4Action: StrikeAction;
    strike5Action: StrikeAction;
}

export interface ModerationStats {
    totalWords: number;
    detectionsToday: number;
    usersSanctionedToday: number;
}

export interface TestResult {
    hasMatch: boolean;
    filterEnabled?: boolean;
    matchedWord?: string;
    severity?: SeverityLevel;
    actionNormal?: StrikeAction;
    actionEscalamiento?: StrikeAction;
}

export const getActionLabel = (action: StrikeAction) => {
    const labels: Record<StrikeAction, string> = {
        'warning': 'Advertencia',
        'delete': 'Borrar mensaje',
        'timeout_30s': 'Timeout 30seg',
        'timeout_1m': 'Timeout 1min',
        'timeout_5m': 'Timeout 5min',
        'timeout_10m': 'Timeout 10min',
        'timeout_30m': 'Timeout 30min',
        'timeout_1h': 'Timeout 1hora',
        'ban': 'Ban permanente'
    };
    return labels[action];
};
