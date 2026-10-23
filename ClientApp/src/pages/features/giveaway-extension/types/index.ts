/**
 * Giveaway Extension - TypeScript Types
 * Sistema de sorteos/giveaways tipo Nightbot mejorado
 */

import { DEFAULT_APPEARANCE, mergeAppearance } from '../overlay/model';
import type { OverlayAppearance } from '../overlay/model';

// ============================================================================
// TAB TYPE
// ============================================================================
export type GiveawayTabType =
    | 'create'      // Crear/Gestionar giveaway
    | 'requirements' // Requisitos de entrada
    | 'weights'     // Pesos y multiplicadores
    | 'active'      // Estado activo
    | 'history'     // Historial
    | 'platforms'   // Dónde se puede participar y qué se verifica en cada plataforma
    | 'messages'    // Mensajes del bot y avisos de rechazo
    | 'overlay'     // Overlay de OBS: enlace y simulación
    | 'editor'      // Overlay: bloques sobre el lienzo
    | 'theme'       // Overlay: panel, bordes y colores
    | 'text'        // Overlay: fuente, colores y sombra del texto
    | 'animations'  // Overlay: entrada, salida y tiempos
    | 'sound'       // Overlay: sonidos y efectos
    | 'settings'    // Configuración general
    | 'debug';      // Herramientas de testing

// ============================================================================
// TIME UNIT
// ============================================================================
export type TimeUnit = 'days' | 'months' | 'years';

// ============================================================================
// REQUIREMENTS
// ============================================================================
export interface GiveawayRequirements {
    // Requisitos de seguimiento
    mustFollow: boolean;
    mustSubscribe: boolean;
    allowVips: boolean;
    allowModerators: boolean;

    // Tiempo mínimo viendo el stream (en minutos)
    minimumWatchTime: number;
    minimumWatchTimeEnabled: boolean;

    // Edad mínima de la cuenta (dinámico: días/meses/años)
    minimumAccountAge: number;
    minimumAccountAgeUnit: TimeUnit;
    minimumAccountAgeEnabled: boolean;

    // Tiempo mínimo siguiendo el canal (dinámico: días/meses/años)
    minimumFollowAge: number;
    minimumFollowAgeUnit: TimeUnit;
    minimumFollowAgeEnabled: boolean;

    // Actividad en chat
    minimumChatMessages: number;
    minimumChatMessagesEnabled: boolean;

    // Blacklist/Whitelist
    blacklistedUsers: string[];
    whitelistedUsers: string[];
    useWhitelist: boolean;

    // Anti-multi cuenta
    blockMultipleAccounts: boolean;
    checkIpDuplication: boolean;
}

// ============================================================================
// WEIGHTS (Multiplicadores de probabilidad)
// ============================================================================
export interface GiveawayWeights {
    // Multiplicadores por nivel de suscripción
    subTier1Multiplier: number;
    subTier2Multiplier: number;
    subTier3Multiplier: number;

    // Multiplicador para VIPs
    vipMultiplier: number;

    // Multiplicador por tiempo viendo
    watchTimeEnabled: boolean;
    watchTimeMultiplierPerHour: number; // Por cada hora viendo

    // Multiplicador por tiempo siguiendo
    followAgeEnabled: boolean;
    followAgeMultiplierPerMonth: number; // Por cada mes siguiendo

    // Multiplicador por bits donados
    bitsEnabled: boolean;
    bitsMultiplierPer100: number; // Por cada 100 bits

    // Multiplicador por racha de subs
    subStreakEnabled: boolean;
    subStreakMultiplierPerMonth: number; // Por cada mes de racha
}

// ============================================================================
// SETTINGS (opciones configurables sin columna propia; el servidor aplica el valor por defecto a lo que falte)
// ============================================================================
export interface GiveawaySettings {
    messages: {
        joined: string;
        cancelled: string;
        noParticipants: string;
        completed: string;
        winnerResponded: string;
        promoted: string;
    };
    rejections: {
        announceInChat: boolean;
        messages: Record<string, string>;
    };
    weightLimits: { maxPerFactor: number; maxTotal: number; min: number };
    reminders: { stopBeforeEndSeconds: number; maxAgeHours: number };
    multiAccount: { sameCreationDays: number; sameFollowDays: number; newAccountDays: number };
    roles: { streamerCanJoin: boolean; leadModCountsAsMod: boolean };
    platforms: GiveawayPlatformRules;
    overlay: OverlayAppearance;
    commands: GiveawayCommandRules;
}

/** Comandos de chat del giveaway (control para moderadores y comandos de los viewers). */
export interface GiveawayCommandRules {
    enabled: boolean;
    root: string;
    minRole: 'moderator' | 'lead_moderator' | 'broadcaster';
    /** Vacío = apagado */
    winnersCommand: string;
    viewerLeave: boolean;
    viewerStatus: boolean;
    /** Textos propios por clave; ausente o vacío = el de COMMAND_TEXTS */
    texts: Record<string, string>;
}

/** Textos por defecto de las respuestas de los comandos (mismos que el servidor) y para qué sirve cada uno. */
export const COMMAND_TEXTS: { key: string; label: string; text: string; vars: string }[] = [
    { key: 'usage', label: 'Ayuda del comando', text: 'ℹ️ Uso: {root} start [premio] [duración, ej. 10m o 1h] · end · cancel · reroll · pick <usuario> · status', vars: '{root}' },
    { key: 'no_config', label: 'Aún no hay giveaway configurado', text: '⚠️ Aún no hay un giveaway configurado: guárdalo una vez desde el panel.', vars: '' },
    { key: 'no_prize', label: 'Falta el premio', text: '⚠️ Falta el premio: {root} start <premio> [duración]', vars: '{root}' },
    { key: 'already_active', label: 'Ya hay uno en curso', text: '⚠️ Ya hay un giveaway en curso.', vars: '' },
    { key: 'none_active', label: 'No hay uno en curso', text: '⚠️ No hay un giveaway en curso.', vars: '' },
    { key: 'cancel_done', label: 'Cancelado desde el chat', text: '❌ Giveaway cancelado.', vars: '' },
    { key: 'no_one_to_reroll', label: 'Nadie para re-sortear', text: '⚠️ No hay participantes disponibles para un nuevo sorteo.', vars: '' },
    { key: 'pick_missing', label: 'Elegir sin indicar a quién', text: 'ℹ️ Indica a quién: {root} pick <usuario>', vars: '{root}' },
    { key: 'pick_not_found', label: 'La persona elegida no participa', text: '⚠️ {user} no está participando en el giveaway.', vars: '{user}' },
    { key: 'status_open', label: 'Estado: abierto', text: '🎁 «{prize}»: {count} participantes. {remaining} Para entrar escribe {command}', vars: '{prize} {count} {remaining} {command}' },
    { key: 'status_drawing', label: 'Estado: sorteando', text: '🎲 Sorteando «{prize}»: {count} participantes.', vars: '{prize} {count}' },
    { key: 'status_none', label: 'Estado: sin giveaway', text: 'No hay un giveaway en curso.', vars: '' },
    { key: 'remaining_timed', label: 'Tiempo restante', text: 'Quedan {minutes} min.', vars: '{minutes}' },
    { key: 'remaining_manual', label: 'Sin límite de tiempo', text: 'Sin límite de tiempo.', vars: '' },
    { key: 'leave_done', label: 'Viewer: salió', text: '👋 @{user}, saliste del giveaway.', vars: '{user}' },
    { key: 'leave_not_in', label: 'Viewer: no participaba', text: '@{user}, no estabas participando.', vars: '{user}' },
    { key: 'leave_closed', label: 'Viewer: ya no puede salir', text: '@{user}, ya no se puede salir: el giveaway se está sorteando.', vars: '{user}' },
    { key: 'me_in', label: 'Viewer: sí participa', text: '✅ @{user}, estás participando en «{prize}».', vars: '{user} {prize}' },
    { key: 'me_out', label: 'Viewer: aún no participa', text: '@{user}, aún no participas. Escribe {command} para entrar.', vars: '{user} {command}' },
    { key: 'winners', label: 'Últimos ganadores', text: '🏆 Últimos ganadores: {list}', vars: '{list}' },
    { key: 'winners_none', label: 'Sin ganadores todavía', text: 'Aún no hay ganadores registrados.', vars: '' },
];

/** Dónde se puede participar y qué hacer con lo que una plataforma no permite comprobar. */
export interface GiveawayPlatformRules {
    twitch: boolean;
    kick: boolean;
    /** allow = el requisito se omite y puede entrar; reject = se rechaza al viewer */
    unverifiable: 'allow' | 'reject';
}

/** Lo que el servidor sabe comprobar en cada plataforma (GET /giveaway/platforms). */
export interface PlatformCapabilities {
    capabilities: string[];
    supported: Record<string, string[]>;
    linked: { twitch: boolean; kick: boolean };
}

export const CAPABILITY_LABELS: Record<string, { label: string; hint: string }> = {
    roles: { label: 'Roles (suscriptor, VIP, moderador, streamer)', hint: 'Llegan en el mensaje de chat' },
    follower: { label: 'Si sigue el canal', hint: 'Requisito «Debe seguir el canal»' },
    followAge: { label: 'Desde cuándo sigue', hint: 'Requisito «Antigüedad de seguidor»' },
    subTier: { label: 'Nivel de la suscripción', hint: 'Pesos por Tier 1, 2 y 3' },
    subMonths: { label: 'Meses de suscripción', hint: 'Peso por meses de sub' },
    accountAge: { label: 'Edad de la cuenta', hint: 'Requisito «Antigüedad de cuenta»' },
    watchTime: { label: 'Tiempo viendo el canal', hint: 'Requisito de tiempo mínimo' },
    chatMessages: { label: 'Mensajes en el chat', hint: 'Requisito de mensajes mínimos' },
};

export const PLATFORM_LABELS: Record<string, string> = { twitch: 'Twitch', kick: 'Kick' };

// ============================================================================
// GIVEAWAY CONFIG (Configuración de un sorteo)
// ============================================================================
export interface GiveawayConfig {
    // Identificación
    id?: string;
    name: string;
    prizeName: string;
    prizeDescription?: string;

    // Duración
    durationType: 'manual' | 'timed'; // Manual o con tiempo límite
    durationMinutes: number; // Si es timed

    // Participantes
    maxParticipants: number;
    maxParticipantsEnabled: boolean;
    allowMultipleEntries: boolean; // Un usuario puede entrar varias veces

    // Ganadores
    numberOfWinners: number;
    hasBackupWinners: boolean;
    numberOfBackupWinners: number;

    // Método de entrada
    entryCommand: string; // Default: !join
    allowAutoEntry: boolean; // Cualquiera que escriba en chat entra automáticamente

    // Requisitos y pesos
    requirements: GiveawayRequirements;
    weights: GiveawayWeights;
    settings: GiveawaySettings;

    // Cooldown
    winnerCooldownEnabled: boolean;
    winnerCooldownDays: number; // Días que debe esperar un ganador para volver a participar

    // Anuncios
    announceOnStart: boolean;
    announceReminders: boolean;
    reminderIntervalMinutes: number;
    announceParticipantCount: boolean;

    // Mensajes personalizados
    startMessage: string;
    reminderMessage: string;
    winnerMessage: string;
    noResponseMessage: string;

    // Timeout para ganador
    winnerResponseTimeout: number; // Segundos para que responda
    autoRerollOnTimeout: boolean;

    // Estado
    isActive?: boolean;
    createdAt?: string;
    startedAt?: string;
    endedAt?: string;
}

// ============================================================================
// PARTICIPANT (Participante)
// ============================================================================
export interface GiveawayParticipant {
    userId: string;
    username: string;
    displayName: string;

    // Metadata del usuario
    isFollower: boolean;
    isSubscriber: boolean;
    subscriptionTier?: 1 | 2 | 3;
    isVip: boolean;
    isModerator: boolean;

    // Tiempos
    accountCreatedAt: string;
    followedAt?: string;
    watchTimeMinutes: number;

    // Actividad
    chatMessagesCount: number;
    bitsTotal: number;
    subStreak: number;

    // Entrada al giveaway
    enteredAt: string;
    entryCount: number; // Si allow multiple entries

    // Cálculo de peso
    calculatedWeight: number;

    // IP (para detección de multi-cuenta)
    ipHash?: string;
}

// ============================================================================
// GIVEAWAY STATE (Estado activo del giveaway)
// ============================================================================
export interface GiveawayState {
    giveawayId: string;
    config: GiveawayConfig;

    // Estado actual
    status: 'idle' | 'active' | 'selecting' | 'selecting_winners' | 'completed' | 'cancelled';

    // Participantes
    participants: GiveawayParticipant[];
    totalParticipants: number;
    totalWeight: number;

    // Tiempo
    startedAt?: string;
    endsAt?: string;
    remainingSeconds?: number;

    // Ganadores
    selectedWinners: GiveawayWinner[];
    backupWinners: GiveawayWinner[];
}

// ============================================================================
// WINNER (Ganador)
// ============================================================================
export interface GiveawayWinner {
    participant: GiveawayParticipant;
    position: number; // 1st, 2nd, 3rd, etc.
    selectedAt: string;
    isBackup: boolean;

    // Respuesta del ganador
    hasResponded: boolean;
    respondedAt?: string;
    wasDisqualified: boolean;
    disqualificationReason?: string;
}

// ============================================================================
// HISTORY ENTRY (Entrada de historial)
// ============================================================================
export interface GiveawayHistoryEntry {
    id: string;
    config: GiveawayConfig;

    // Métricas
    totalParticipants: number;
    totalWeight: number;

    // Timing
    startedAt: string;
    endedAt: string;
    durationMinutes: number;

    // Ganadores
    winners: GiveawayWinner[];
    backupWinners: GiveawayWinner[];

    // Resultado
    status: 'completed' | 'cancelled';
    cancelReason?: string;
}

// ============================================================================
// STATISTICS (Estadísticas generales)
// ============================================================================
export interface GiveawayStatistics {
    totalGiveaways: number;
    totalParticipations: number;
    totalWinners: number;
    averageParticipantsPerGiveaway: number;

    // Top ganadores
    topWinners: {
        username: string;
        winCount: number;
    }[];

    // Engagement
    averageEngagementRate: number; // % de viewers que participan
    peakParticipationTime: string; // Mejor hora para hacer giveaways
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================
export const DEFAULT_REQUIREMENTS: GiveawayRequirements = {
    mustFollow: true,
    mustSubscribe: false,
    allowVips: true,
    allowModerators: true,

    minimumWatchTime: 10,
    minimumWatchTimeEnabled: true,

    minimumAccountAge: 7,
    minimumAccountAgeUnit: 'days',
    minimumAccountAgeEnabled: true,

    minimumFollowAge: 0,
    minimumFollowAgeUnit: 'days',
    minimumFollowAgeEnabled: false,

    minimumChatMessages: 1,
    minimumChatMessagesEnabled: false,

    blacklistedUsers: [],
    whitelistedUsers: [],
    useWhitelist: false,

    blockMultipleAccounts: true,
    checkIpDuplication: true,
};

export const DEFAULT_WEIGHTS: GiveawayWeights = {
    subTier1Multiplier: 2,
    subTier2Multiplier: 4,
    subTier3Multiplier: 6,

    vipMultiplier: 1.5,

    watchTimeEnabled: true,
    watchTimeMultiplierPerHour: 1.1,

    followAgeEnabled: false,
    followAgeMultiplierPerMonth: 1.05,

    bitsEnabled: false,
    bitsMultiplierPer100: 1.2,

    subStreakEnabled: false,
    subStreakMultiplierPerMonth: 1.02,
};

// Textos por defecto del servidor (GiveawayMessages / GiveawayRejections): sirven de guía en los campos vacíos
export const DEFAULT_SETTINGS_TEXTS = {
    joined: '✅ {user} se ha unido al giveaway! Total de participantes: {count}',
    cancelled: '❌ El giveaway ha sido cancelado: {reason}',
    noParticipants: '❌ El giveaway ha sido cancelado: {reason}',
    completed: '🎉 Giveaway completado. {responded} de {total} ganadores respondieron.',
    winnerResponded: '✅ ¡Perfecto @{winner}! Tu respuesta ha sido registrada. ¡Felicidades por tu premio!',
    promoted: '🎉 ¡Felicidades @{winner}! Has sido promovido de respaldo a ganador principal. Tienes {timeout} segundos para responder.',
};

export const REJECTION_REASONS: { code: string; label: string; text: string }[] = [
    { code: 'not_follower', label: 'No sigue el canal', text: '@{user}, para entrar al giveaway tienes que seguir el canal.' },
    { code: 'not_subscriber', label: 'No es suscriptor', text: '@{user}, este giveaway es solo para suscriptores.' },
    { code: 'watch_time', label: 'Poco tiempo viendo', text: '@{user}, aún no tienes el tiempo mínimo viendo el canal para entrar.' },
    { code: 'account_age', label: 'Cuenta muy nueva', text: '@{user}, tu cuenta es demasiado nueva para este giveaway.' },
    { code: 'follow_age', label: 'Sigue hace poco', text: '@{user}, llevas muy poco tiempo siguiendo el canal para entrar.' },
    { code: 'chat_messages', label: 'Pocos mensajes en el chat', text: '@{user}, aún no tienes los mensajes mínimos en el chat para entrar.' },
    { code: 'cooldown', label: 'Ganó hace poco (cooldown)', text: '@{user}, ganaste hace poco y todavía no puedes participar de nuevo.' },
    { code: 'blacklisted', label: 'En la lista negra', text: '@{user}, no puedes participar en este giveaway.' },
    { code: 'not_in_whitelist', label: 'Fuera de la lista blanca', text: '@{user}, este giveaway es solo para personas invitadas.' },
    { code: 'vip_not_allowed', label: 'VIP bloqueado', text: '@{user}, los VIP no pueden participar en este giveaway.' },
    { code: 'mod_not_allowed', label: 'Moderador bloqueado', text: '@{user}, los moderadores no pueden participar en este giveaway.' },
    { code: 'streamer_not_allowed', label: 'Streamer bloqueado', text: '@{user}, el streamer no participa en su propio giveaway.' },
    { code: 'full', label: 'Giveaway lleno', text: '@{user}, el giveaway ya alcanzó el máximo de participantes.' },
    { code: 'platform_disabled', label: 'Plataforma no habilitada', text: '@{user}, este giveaway no está abierto en tu plataforma.' },
    { code: 'unverifiable_follower', label: 'Seguidor no verificable', text: '@{user}, este giveaway exige seguir el canal y en tu plataforma no se puede comprobar.' },
    { code: 'unverifiable_follow_age', label: 'Antigüedad de seguidor no verificable', text: '@{user}, este giveaway exige una antigüedad de seguidor que en tu plataforma no se puede comprobar.' },
    { code: 'unverifiable_account_age', label: 'Edad de cuenta no verificable', text: '@{user}, este giveaway exige una antigüedad de cuenta que en tu plataforma no se puede comprobar.' },
    { code: 'unverifiable_watch_time', label: 'Tiempo viendo no verificable', text: '@{user}, este giveaway exige un tiempo mínimo viendo el canal que en tu plataforma no se puede comprobar.' },
    { code: 'unverifiable_chat_messages', label: 'Mensajes no verificables', text: '@{user}, este giveaway exige un mínimo de mensajes que en tu plataforma no se puede comprobar.' },
    { code: 'multi_account', label: 'Posible cuenta duplicada', text: '@{user}, tu cuenta no pasó la verificación contra cuentas duplicadas.' },
];

/** Nombre legible de un código de rechazo (para el panel). */
export const rejectionLabel = (code: string): string =>
    REJECTION_REASONS.find((r) => r.code === code)?.label
    ?? ({ account_age_unknown: 'Edad de cuenta desconocida', follow_age_unknown: 'Fecha de follow desconocida', duplicate_ip: 'IP duplicada', error: 'Error al validar' } as Record<string, string>)[code]
    ?? code;

export const DEFAULT_SETTINGS: GiveawaySettings = {
    messages: { joined: '', cancelled: '', noParticipants: '', completed: '', winnerResponded: '', promoted: '' },
    rejections: { announceInChat: false, messages: {} },
    weightLimits: { maxPerFactor: 1000, maxTotal: 10000, min: 1 },
    reminders: { stopBeforeEndSeconds: 30, maxAgeHours: 24 },
    multiAccount: { sameCreationDays: 1, sameFollowDays: 1, newAccountDays: 30 },
    roles: { streamerCanJoin: true, leadModCountsAsMod: true },
    platforms: { twitch: true, kick: false, unverifiable: 'allow' },
    overlay: DEFAULT_APPEARANCE,
    commands: { enabled: true, root: '!giveaway', minRole: 'moderator', winnersCommand: '!ganadores', viewerLeave: true, viewerStatus: true, texts: {} },
};

/** Mezcla lo que llegó del servidor (puede venir vacío o incompleto) con los valores por defecto. */
export const mergeSettings = (loaded?: Partial<GiveawaySettings> | null): GiveawaySettings => ({
    messages: { ...DEFAULT_SETTINGS.messages, ...(loaded?.messages ?? {}) },
    rejections: {
        announceInChat: loaded?.rejections?.announceInChat ?? DEFAULT_SETTINGS.rejections.announceInChat,
        messages: { ...(loaded?.rejections?.messages ?? {}) },
    },
    weightLimits: { ...DEFAULT_SETTINGS.weightLimits, ...(loaded?.weightLimits ?? {}) },
    reminders: { ...DEFAULT_SETTINGS.reminders, ...(loaded?.reminders ?? {}) },
    multiAccount: { ...DEFAULT_SETTINGS.multiAccount, ...(loaded?.multiAccount ?? {}) },
    roles: { ...DEFAULT_SETTINGS.roles, ...(loaded?.roles ?? {}) },
    platforms: { ...DEFAULT_SETTINGS.platforms, ...(loaded?.platforms ?? {}) },
    overlay: mergeAppearance(loaded?.overlay),
    commands: { ...DEFAULT_SETTINGS.commands, ...(loaded?.commands ?? {}), texts: { ...(loaded?.commands?.texts ?? {}) } },
});

export const DEFAULT_GIVEAWAY_CONFIG: GiveawayConfig = {
    name: 'Nuevo Giveaway',
    prizeName: 'Premio Sorpresa',
    prizeDescription: '',

    durationType: 'timed',
    durationMinutes: 10,

    maxParticipants: 1000,
    maxParticipantsEnabled: false,
    allowMultipleEntries: false,

    numberOfWinners: 1,
    hasBackupWinners: true,
    numberOfBackupWinners: 2,

    entryCommand: '!join',
    allowAutoEntry: false,

    requirements: DEFAULT_REQUIREMENTS,
    weights: DEFAULT_WEIGHTS,
    settings: DEFAULT_SETTINGS,

    winnerCooldownEnabled: true,
    winnerCooldownDays: 7,

    announceOnStart: true,
    announceReminders: true,
    reminderIntervalMinutes: 3,
    announceParticipantCount: true,

    startMessage: '🎉 ¡GIVEAWAY INICIADO! Usa {command} para participar y ganar: {prize}',
    reminderMessage: '🎁 Recordatorio: Usa {command} para participar en el giveaway de {prize}. Participantes actuales: {count}',
    winnerMessage: '🏆 ¡FELICIDADES @{winner}! Has ganado: {prize}. Tienes {timeout} segundos para responder.',
    noResponseMessage: '⏱️ @{winner} no respondió a tiempo. Seleccionando nuevo ganador...',

    winnerResponseTimeout: 60,
    autoRerollOnTimeout: true,

    isActive: false,
};
