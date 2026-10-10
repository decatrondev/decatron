import type { Permission } from '../../../components/dashboard/PermissionPicker';

export type TimeFormat = 'minutes' | 'hours_minutes' | 'full';

export interface WatchtimeSettings {
    enabled: boolean;
    commandName: string;
    globalCooldown: number;
    userCooldown: number;
    permission: Permission;
    trackLurkers: boolean;
    minMinutesToRespond: number;
    timeFormat: TimeFormat;
    showPosition: boolean;
    onlyWhenLive: boolean;
    customMessage: string;
    useFirstTimeMessage: boolean;
    firstTimeMessage: string;
    useNotEnoughTimeMessage: boolean;
    notEnoughTimeMessage: string;
    useOfflineMessage: boolean;
    offlineMessage: string;
}

export const DEFAULT_CONFIG: WatchtimeSettings = {
    enabled: true,
    commandName: '!watchtime',
    globalCooldown: 5,
    userCooldown: 30,
    permission: 'everyone',
    trackLurkers: true,
    minMinutesToRespond: 0,
    timeFormat: 'full',
    showPosition: true,
    onlyWhenLive: false,
    customMessage: '@{user} llevas {hours} hora(s) {minutes} minuto(s) viendo el stream',
    useFirstTimeMessage: true,
    firstTimeMessage: '@{user} ¡es tu primera vez en el stream! Ya llevas {hours} hora(s) {minutes} minuto(s) — ¡bienvenido/a!',
    useNotEnoughTimeMessage: true,
    notEnoughTimeMessage: '@{user} aún llevas muy poco tiempo, ¡sigue viendo el stream!',
    useOfflineMessage: false,
    offlineMessage: '@{user} el stream no está en vivo ahora mismo',
};

export const TIME_FORMAT_OPTIONS: { value: TimeFormat; label: string; example: string }[] = [
    { value: 'minutes', label: 'Solo minutos', example: 'ej: 90 minutos' },
    { value: 'hours_minutes', label: 'Horas y minutos', example: 'ej: 1 hora 30 minutos' },
    { value: 'full', label: 'Completo', example: 'ej: 1 hora 30 minutos 45 segundos' },
];

export const MESSAGE_VARIABLES = ['{user}', '{hours}', '{minutes}', '{seconds}', '{total_minutes}', '{position}'];

export function buildPreview(config: WatchtimeSettings): string {
    const sample = config.customMessage
        .replace('{user}', 'AnthonyDeca')
        .replace('{hours}', '1')
        .replace('{minutes}', '23')
        .replace('{seconds}', '45')
        .replace('{total_minutes}', '83')
        .replace('{position}', '#2');
    return sample;
}

export function fromApi(apiConfig: any): WatchtimeSettings {
    return {
        enabled: apiConfig.enabled,
        commandName: apiConfig.commandName,
        globalCooldown: apiConfig.cooldownGlobal,
        userCooldown: apiConfig.cooldownUser,
        permission: apiConfig.permission,
        trackLurkers: apiConfig.trackLurkers,
        minMinutesToRespond: apiConfig.minMinutesToRespond,
        timeFormat: apiConfig.timeFormat,
        showPosition: apiConfig.showPosition,
        onlyWhenLive: apiConfig.onlyWhenLive,
        customMessage: apiConfig.customMessage,
        useFirstTimeMessage: apiConfig.useFirstTimeMessage,
        firstTimeMessage: apiConfig.firstTimeMessage,
        useNotEnoughTimeMessage: apiConfig.useNotEnoughTimeMessage,
        notEnoughTimeMessage: apiConfig.notEnoughTimeMessage,
        useOfflineMessage: apiConfig.useOfflineMessage,
        offlineMessage: apiConfig.offlineMessage,
    };
}

export function toApi(config: WatchtimeSettings) {
    return {
        enabled: config.enabled,
        commandName: config.commandName,
        cooldownGlobal: config.globalCooldown,
        cooldownUser: config.userCooldown,
        permission: config.permission,
        trackLurkers: config.trackLurkers,
        minMinutesToRespond: config.minMinutesToRespond,
        timeFormat: config.timeFormat,
        showPosition: config.showPosition,
        onlyWhenLive: config.onlyWhenLive,
        customMessage: config.customMessage,
        useFirstTimeMessage: config.useFirstTimeMessage,
        firstTimeMessage: config.firstTimeMessage,
        useNotEnoughTimeMessage: config.useNotEnoughTimeMessage,
        notEnoughTimeMessage: config.notEnoughTimeMessage,
        useOfflineMessage: config.useOfflineMessage,
        offlineMessage: config.offlineMessage,
    };
}
