/**
 * Timer Extension - Type Definitions
 *
 * Este archivo contiene todas las interfaces y tipos TypeScript
 * utilizados en la configuración del Timer Extensible.
 */

import type { AlertsConfig, AlertTemplate, TimerEventType } from '../../../../types/timer-alerts';

// Re-export tipos de timer-alerts para fácil acceso
export type { AlertsConfig, AlertTemplate, TimerEventType };

// ============================================================================
// CONFIGURACIÓN DE DISPLAY
// ============================================================================

export interface DisplayConfig {
    showYears: boolean;
    showMonths: boolean;
    showWeeks: boolean;
    showDays: boolean;
    showHours: boolean;
    showMinutes: boolean;
    showSeconds: boolean;
    timeFormat?: string; // Formato personalizado (ej: "HH:mm:ss")
    showTitle: boolean;
    title: string;
    showPercentage: boolean;
    showElapsedTime: boolean;
}

// ============================================================================
// CONFIGURACIÓN DE BARRA DE PROGRESO
// ============================================================================

export interface ProgressBarConfig {
    type: 'horizontal' | 'vertical' | 'circular';
    orientation: 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top' | 'clockwise' | 'counterclockwise';
    position: { x: number; y: number };
    size: { width: number; height: number };
    backgroundType: 'color' | 'gradient' | 'image' | 'gif';
    backgroundColor: string;
    backgroundGradient: { color1: string; color2: string; angle: number };
    backgroundImage: string;
    fillType: 'color' | 'gradient' | 'image' | 'gif';
    fillColor: string;
    fillGradient: { color1: string; color2: string; angle: number };
    fillImage: string;
    animatedStripes: boolean; // Nuevo: Efecto Candy Stripes
    indicatorEnabled: boolean;
    indicatorType: 'circle' | 'image' | 'gif';
    indicatorSize: number;
    indicatorColor: string;
    indicatorImage: string;
    indicatorRotate: boolean;
    followerIcon?: string; // Nuevo: Icono que sigue la punta (Emoji o URL)
    followerSize?: number; // Nuevo: Tamaño del icono seguidor
    borderEnabled: boolean;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
}

// ============================================================================
// CONFIGURACIÓN DE ESTILOS
// ============================================================================

export interface StyleConfig {
    fontFamily: string;
    fontWeight: string; // 'normal', 'bold', '100'-'900'
    textColor: string;
    textShadow: 'none' | 'normal' | 'strong' | 'glow';
    titleFontSize: number;
    timeFontSize: number;
    elapsedTimeFontSize: number; // Nuevo: Tamaño independiente para transcurrido
    percentageFontSize: number;
    titlePosition: { x: number; y: number };
    timePosition: { x: number; y: number };
    percentagePosition: { x: number; y: number };
    elapsedTimePosition: { x: number; y: number };
}

// ============================================================================
// CONFIGURACIÓN DE ANIMACIONES
// ============================================================================

export interface AnimationConfig {
    entranceType: 'none' | 'fade' | 'slide' | 'bounce' | 'zoom' | 'rotate';
    entranceSpeed: 'slow' | 'normal' | 'fast';
    exitType: 'none' | 'fade' | 'slide' | 'bounce' | 'zoom' | 'rotate';
    exitSpeed: 'slow' | 'normal' | 'fast';
    runningEffect: 'none' | 'pulse' | 'glow' | 'shake';
    pulseOnZero: boolean;
    pulseOnZeroTime: number; // Cantidad de tiempo para activar el pulso
    pulseOnZeroTimeUnit: 'seconds' | 'minutes' | 'hours'; // Unidad de tiempo
    pulseOnZeroDuration: number;
    pulseOnZeroSpeed: 'slow' | 'normal' | 'fast';
    // Modo Crítico (Panic Mode)
    criticalMode?: {
        enabled: boolean;
        triggerTime: number;
        triggerTimeUnit: 'seconds' | 'minutes' | 'hours';
        effectType: 'pulse' | 'shake' | 'flash' | 'none';
        effectSpeed: 'slow' | 'normal' | 'fast';
        soundEnabled: boolean;
        soundUrl: string; // Legacy/Single support
        playlist?: string[]; // Nueva lista de reproducción
        soundVolume: number;
        loopAudio: boolean;
    };
    // Efectos de Donación (+Tiempo)
    donationEffect?: {
        enabled: boolean;
        type: 'float-up' | 'pop' | 'shake' | 'glow';
        color: string; // 'auto' (color del evento) o HEX
        duration: number; // Duración en segundos
    };
}

// ============================================================================
// CONFIGURACIÓN DE TEMA
// ============================================================================

export interface ThemeConfig {
    mode: 'light' | 'dark' | 'transparent';
    containerBackground: string;
    containerOpacity: number;
}


// ============================================================================
// CONFIGURACIÓN DE EVENTOS
// ============================================================================

/**
 * Regla universal para eventos (Tiers)
 * Permite definir tiempos específicos basados en cantidades (bits, meses, viewers, etc.)
 */
export interface EventRule {
    id: string;
    minAmount: number; // Umbral (Bits, Meses, Nivel Hype, Viewers Raid, Cantidad Gift)
    timeAdded: number; // Tiempo a añadir en segundos
    isPerUnit?: boolean; // True = Multiplicar por cantidad (ej: 2h * 10 subs). False = Tiempo fijo (ej: 2h total).
    exactAmount?: boolean; // Si es true, solo activa con la cantidad exacta (Easter Egg)
}

export interface EventConfig {
    enabled: boolean;
    time: number; // Tiempo base por unidad (en segundos)
    cooldown?: number; // en segundos (0 = desactivado)
    rules?: EventRule[]; // Lista de reglas avanzadas (Tiers)
}

// Deprecated: BitTier se reemplaza por EventRule
export type BitTier = EventRule; 

export interface EventsConfig {
    bits: EventConfig & {
        perBits: number; // Legacy: Cada X bits (se mantiene por compatibilidad)
    };
    follow: EventConfig;
    subPrime: EventConfig; // Prime Gaming subs (Tier 1)
    subTier1: EventConfig; // Tier 1 pagadas
    subTier2: EventConfig;
    subTier3: EventConfig;
    giftSub: EventConfig;
    raid: EventConfig & { timePerParticipant: number };
    hypeTrain: EventConfig;
    tips: EventConfig & {
        perCurrency: number; // Cada X unidades de moneda (ej: 1 = $1 USD)
        currency: string; // Moneda configurada (USD, EUR, etc.)
    };
}


// ============================================================================
// CONFIGURACIÓN DE COMANDOS
// ============================================================================

export interface CommandConfig {
    enabled: boolean;
    blacklist: string[]; // usernames
    whitelist: string[]; // usernames
}

export type InfoCommandPermissionLevel = 'everyone' | 'subs' | 'vips' | 'mods';

export interface InfoCommandConfig {
    enabled: boolean;
    template: string;
    cooldown: number;   // segundos entre usos
    /** Jerarquía acumulativa: mods ⊂ vips ⊂ subs ⊂ everyone */
    permissionLevel: InfoCommandPermissionLevel;
    blacklist: string[];
    whitelist: string[];
}

export interface CommandsConfig {
    play: CommandConfig;
    pause: CommandConfig;
    reset: CommandConfig;
    stop: CommandConfig;
    addTime: CommandConfig;
    removeTime: CommandConfig;
    // Comandos informativos
    dtiempo: InfoCommandConfig;
    dcuando: InfoCommandConfig;
    dstats: InfoCommandConfig;
    drecord: InfoCommandConfig;
    dtop: InfoCommandConfig;
}

// ============================================================================
// CONFIGURACIÓN DE SONIDOS
// ============================================================================

export interface SoundConfig {
    enabled: boolean;
    soundType: 'default' | 'custom' | 'none';
    soundUrl: string;
    volume: number; // 0-100
}

// ============================================================================
// CONFIGURACIÓN DE OBJETIVOS (GOALS)
// ============================================================================

export interface GoalConfig {
    enabled: boolean;
    goalTime: number; // segundos
    showProgress: boolean;
    showPercentage: boolean;
    goalText: string; // ej: "Meta: 24 horas"
    position: { x: number; y: number };
    fontSize: number;
    textColor: string;
    progressBarColor: string;
    // Stats en vivo
    showLiveStats: boolean;
    statsPosition: 'overlay' | 'separate-panel';
    statsConfig: {
        showBitsTotal: boolean;
        showSubsTotal: boolean;
        showRaidsTotal: boolean;
        showFollowsTotal: boolean;
        showOthersTotal: boolean;
    };
}

// ============================================================================
// CONFIGURACIÓN DE SORTEOS (RAFFLES)
// ============================================================================

export interface RaffleMethodConfig {
    enabled: boolean;
    // Para bits
    minAmount?: number;
    multiplier?: number; // Más cantidad = más tickets?
    // Para subs
    tier1Tickets?: number;
    tier2Tickets?: number;
    tier3Tickets?: number;
    // General
    ticketLimit?: number; // 0 = ilimitado
}

export interface RafflesConfig {
    enabled: boolean;
    autoStartWithTimer: boolean;
    autoCloseWithTimer: boolean;
    
    // Métodos de entrada (Globales para todos los sorteos por defecto)
    methods: {
        chatCommand: RaffleMethodConfig & { command: string };
        automatic: RaffleMethodConfig; // Entran todos los elegibles
        bits: RaffleMethodConfig;
        subscription: RaffleMethodConfig;
        giftSubscription: RaffleMethodConfig; // Nueva opción
        follow: RaffleMethodConfig; // Nueva opción
    };

    // Requisitos / Validaciones (Constraints)
    requirements: {
        minAccountAge: number; // Días
        minFollowDuration: number; // Días
        requireChatActivity: boolean;
        chatActivityMinutes: number; // Minutos recientes
        excludeMods: boolean;
        excludeVips: boolean;
        excludeBroadcaster: boolean;
        excludePreviousWinners: boolean;
    };

    // Animaciones
    animations: {
        drawAnimation: 'none' | 'roulette' | 'scroll' | 'confetti';
        duration: number; // Segundos
    };
}

// ============================================================================
// CONFIGURACIÓN DE PLANTILLAS
// ============================================================================

export interface Template {
    name: string;
    description: string;
    config: {
        defaultDuration: number;
        displayConfig: Partial<DisplayConfig>;
        progressBarConfig: Partial<ProgressBarConfig>;
        styleConfig: Partial<StyleConfig>;
    };
}

export interface HappyHourConfig {
    enabled: boolean;
    startTime: string; // HH:MM formato 24h
    endTime: string; // HH:MM formato 24h
    multiplier: number; // ej: 2 = 2x tiempo
    daysOfWeek: boolean[]; // [dom, lun, mar, mie, jue, vie, sab]
}

export interface AdvancedConfig {
    // Plantillas
    templates: {
        speedrun: Template;
        subathon: Template;
        gamingMarathon: Template;
        custom: Template[];
    };
    activeTemplate: string | null;
    // Tiempo base importado de otros sistemas (en segundos)
    initialTimeOffset: number; 
    // Auto-pause
    autoPause: {
        enabled: boolean;
        schedules: Array<{
            id: string;
            startTime: string; // HH:MM
            endTime: string; // HH:MM
            daysOfWeek: boolean[]; // [dom, lun, mar, mie, jue, vie, sab]
            reason: string;
        }>;
    };
    // Happy Hour
    happyHour: HappyHourConfig;
    // Stream detection
    autoPlayOnStreamOnline: boolean;
    autoStopOnStreamOffline: boolean;
}

// ============================================================================
// CONFIGURACIÓN DE HISTORIAL
// ============================================================================

export interface EventLogEntry {
    id: string;
    timestamp: string;
    eventType: 'bits' | 'follow' | 'sub' | 'gift' | 'raid' | 'hypetrain' | 'tips' | 'command';
    username: string;
    timeAdded: number; // segundos (puede ser negativo)
    details: string;
}

export interface HistoryConfig {
    enabled: boolean;
    maxEntries: number;
    showInOverlay: boolean;
    logPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    // Analytics
    analytics: {
        totalTimeAdded: number;
        byEventType: {
            bits: number;
            follows: number;
            subs: number;
            raids: number;
            hypeTrain: number;
            tips: number;
            commands: number;
        };
    };
    logs: EventLogEntry[];
}

// ============================================================================
// CONFIGURACIÓN DE MEDIA
// ============================================================================

export interface MediaFile {
    id: string;
    fileName: string;
    fileType: 'sound' | 'image' | 'gif' | 'video';
    fileUrl: string;
    fileSize: number; // bytes
    uploadedAt: string;
    duration?: number; // Para sonidos/videos
}

// ============================================================================
// TIPOS AUXILIARES
// ============================================================================

export type TabType =
    | 'guide'
    | 'basic'
    | 'display'
    | 'typography'
    | 'progressbar'
    | 'visual'
    | 'layout'
    | 'animations'
    | 'events'
    | 'commands'
    | 'info-commands'
    | 'alerts'
    | 'goal'
    | 'raffles'
    | 'advanced'
    | 'history'
    | 'media'
    | 'overlay'
    | 'theme';

export type DragElement = 'title' | 'time' | 'percentage' | 'progressbar' | 'elapsed' | null;

export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export type SaveMessageType = {
    type: 'success' | 'error';
    text: string;
} | null;

export type AlertsSubTab = 'template' | 'style' | 'events' | 'sounds';
