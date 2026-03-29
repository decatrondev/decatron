/**
 * Giveaway Extension - TypeScript Types
 * Sistema de sorteos/giveaways tipo Nightbot mejorado
 */

// ============================================================================
// TAB TYPE
// ============================================================================
export type GiveawayTabType =
    | 'create'      // Crear/Gestionar giveaway
    | 'requirements' // Requisitos de entrada
    | 'weights'     // Pesos y multiplicadores
    | 'active'      // Estado activo
    | 'history'     // Historial
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
    status: 'idle' | 'active' | 'selecting' | 'completed' | 'cancelled';

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
