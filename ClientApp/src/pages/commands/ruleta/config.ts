import type { Permission } from '../../../components/dashboard/PermissionPicker';

export interface RuletaSettings {
    enabled: boolean;
    commandName: string;
    chancePercent: number;
    minTimeoutSeconds: number;
    maxTimeoutSeconds: number;
    globalCooldown: number;
    userCooldown: number;
    permission: Permission;
    allowSelfTarget: boolean;
    allowTargetModerators: boolean;
    protectedUsers: string[];
    blockedUsers: string[];
    hitMessages: string[];
    missMessages: string[];
    useSelfMessages: boolean;
    selfHitMessages: string[];
    selfMissMessages: string[];
}

export const DEFAULT_CONFIG: RuletaSettings = {
    enabled: true,
    commandName: '!ruleta',
    chancePercent: 17,
    minTimeoutSeconds: 60,
    maxTimeoutSeconds: 60,
    globalCooldown: 10,
    userCooldown: 30,
    permission: 'everyone',
    allowSelfTarget: true,
    allowTargetModerators: false,
    protectedUsers: [],
    blockedUsers: [],
    hitMessages: ['🔫💥 BANG! @{shooter} le disparó a @{target} — {seconds}s de timeout'],
    missMessages: ['🔫 *click* @{shooter} apuntó a @{target}... y sobrevivió'],
    useSelfMessages: true,
    selfHitMessages: ['🔫💥 @{shooter} se apuntó a sí mismo... BANG! {seconds}s de timeout'],
    selfMissMessages: ['🔫 @{shooter} se apuntó a sí mismo... *click* sobrevivió de milagro'],
};

export const MESSAGE_VARIABLES = ['{shooter}', '{target}', '{seconds}', '{chance}'];

export type VariantKey = 'hitMessages' | 'missMessages' | 'selfHitMessages' | 'selfMissMessages';
export type UserListKey = 'protectedUsers' | 'blockedUsers';

export function buildPreview(template: string, config: RuletaSettings): string {
    const avgSeconds = Math.round((config.minTimeoutSeconds + config.maxTimeoutSeconds) / 2);
    return template
        .replace('{shooter}', 'AnthonyDeca')
        .replace('{target}', 'Viewer123')
        .replace('{seconds}', String(avgSeconds))
        .replace('{chance}', String(config.chancePercent));
}

export function fromApi(apiConfig: any): RuletaSettings {
    return {
        enabled: apiConfig.enabled,
        commandName: apiConfig.commandName,
        chancePercent: apiConfig.chancePercent,
        minTimeoutSeconds: apiConfig.minTimeoutSeconds,
        maxTimeoutSeconds: apiConfig.maxTimeoutSeconds,
        globalCooldown: apiConfig.cooldownGlobal,
        userCooldown: apiConfig.cooldownUser,
        permission: apiConfig.permission,
        allowSelfTarget: apiConfig.allowSelfTarget,
        allowTargetModerators: apiConfig.allowTargetModerators,
        protectedUsers: apiConfig.protectedUsers ?? [],
        blockedUsers: apiConfig.blockedUsers ?? [],
        hitMessages: apiConfig.hitMessages?.length ? apiConfig.hitMessages : DEFAULT_CONFIG.hitMessages,
        missMessages: apiConfig.missMessages?.length ? apiConfig.missMessages : DEFAULT_CONFIG.missMessages,
        useSelfMessages: apiConfig.useSelfMessages,
        selfHitMessages: apiConfig.selfHitMessages?.length ? apiConfig.selfHitMessages : DEFAULT_CONFIG.selfHitMessages,
        selfMissMessages: apiConfig.selfMissMessages?.length ? apiConfig.selfMissMessages : DEFAULT_CONFIG.selfMissMessages,
    };
}

export function toApi(config: RuletaSettings) {
    return {
        enabled: config.enabled,
        commandName: config.commandName,
        chancePercent: config.chancePercent,
        minTimeoutSeconds: config.minTimeoutSeconds,
        maxTimeoutSeconds: config.maxTimeoutSeconds,
        cooldownGlobal: config.globalCooldown,
        cooldownUser: config.userCooldown,
        permission: config.permission,
        allowSelfTarget: config.allowSelfTarget,
        allowTargetModerators: config.allowTargetModerators,
        protectedUsers: config.protectedUsers,
        blockedUsers: config.blockedUsers,
        hitMessages: config.hitMessages,
        missMessages: config.missMessages,
        useSelfMessages: config.useSelfMessages,
        selfHitMessages: config.selfHitMessages,
        selfMissMessages: config.selfMissMessages,
    };
}

/** Mantiene mínimo ≤ máximo del timeout al mover cualquiera de los dos deslizadores. */
export function normalizeTimeouts(next: RuletaSettings, key: keyof RuletaSettings): RuletaSettings {
    if (key === 'minTimeoutSeconds' && next.minTimeoutSeconds > next.maxTimeoutSeconds) {
        next.maxTimeoutSeconds = next.minTimeoutSeconds;
    }
    if (key === 'maxTimeoutSeconds' && next.maxTimeoutSeconds < next.minTimeoutSeconds) {
        next.minTimeoutSeconds = next.maxTimeoutSeconds;
    }
    return next;
}
