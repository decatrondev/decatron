/**
 * Timer Extension - Default Configurations
 *
 * Valores por defecto para todas las configuraciones del timer.
 */

import type {
    DisplayConfig,
    ProgressBarConfig,
    StyleConfig,
    AnimationConfig,
    ThemeConfig,
    EventsConfig,
    CommandsConfig,
    InfoCommandConfig,
    GoalConfig,
    AdvancedConfig,
    HistoryConfig,
    TimeUnit
} from '../types';

// ============================================================================
// CONFIGURACIÓN BÁSICA
// ============================================================================

export const DEFAULT_DURATION = 300; // 5 minutos en segundos
export const DEFAULT_AUTO_START = false;

// ============================================================================
// CONFIGURACIÓN DE DISPLAY
// ============================================================================

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
    showYears: false,
    showMonths: false,
    showWeeks: false,
    showDays: false,
    showHours: true,
    showMinutes: true,
    showSeconds: true,
    showTitle: true,
    title: 'Próximo juego en:',
    showPercentage: true,
    showElapsedTime: false
};

// ============================================================================
// CONFIGURACIÓN DE BARRA DE PROGRESO
// ============================================================================

export const DEFAULT_PROGRESSBAR_CONFIG: ProgressBarConfig = {
    type: 'horizontal',
    orientation: 'left-to-right',
    position: { x: 50, y: 150 },
    size: { width: 900, height: 40 },
    backgroundType: 'color',
    backgroundColor: 'rgba(255,255,255,0.1)',
    backgroundGradient: { color1: '#667eea', color2: '#764ba2', angle: 135 },
    backgroundImage: '',
    fillType: 'gradient',
    fillColor: '#667eea',
    fillGradient: { color1: '#667eea', color2: '#764ba2', angle: 135 },
    fillImage: '',
    indicatorEnabled: true,
    indicatorType: 'circle',
    indicatorSize: 24,
    indicatorColor: '#ffffff',
    indicatorImage: '',
    indicatorRotate: false,
    borderEnabled: true,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderRadius: 20,
    animatedStripes: false
};

// ============================================================================
// CONFIGURACIÓN DE ESTILOS
// ============================================================================

export const DEFAULT_STYLE_CONFIG: StyleConfig = {
    fontFamily: 'Inter',
    fontWeight: 'normal',
    textColor: '#ffffff',
    textShadow: 'normal',
    titleFontSize: 32,
    timeFontSize: 48,
    percentageFontSize: 24,
    elapsedTimeFontSize: 24,
    titlePosition: { x: 500, y: 50 },
    timePosition: { x: 500, y: 100 },
    percentagePosition: { x: 500, y: 220 },
    elapsedTimePosition: { x: 500, y: 160 }
};

// ============================================================================
// CONFIGURACIÓN DE ANIMACIONES
// ============================================================================

export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
    entranceType: 'fade',
    entranceSpeed: 'normal',
    exitType: 'fade',
    exitSpeed: 'normal',
    runningEffect: 'pulse',
    pulseOnZero: true,
    pulseOnZeroTime: 0,
    pulseOnZeroTimeUnit: 'seconds',
    pulseOnZeroDuration: 10,
    pulseOnZeroSpeed: 'normal',
    criticalMode: {
        enabled: false,
        triggerTime: 60,
        triggerTimeUnit: 'seconds',
        effectType: 'pulse',
        effectSpeed: 'fast',
        soundEnabled: false,
        soundUrl: '',
        playlist: [],
        soundVolume: 100,
        loopAudio: true
    }
};

// ============================================================================
// CONFIGURACIÓN DE TEMA
// ============================================================================

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
    mode: 'dark',
    containerBackground: '#000000',
    containerOpacity: 80
};

// ============================================================================
// CONFIGURACIÓN DE EVENTOS
// ============================================================================

export const DEFAULT_EVENTS_CONFIG: EventsConfig = {
    bits: { enabled: false, time: 60, perBits: 100 }, // 1min cada 100 bits
    follow: { enabled: false, time: 30, cooldown: 86400 }, // 30 segundos, cooldown 24 horas
    subPrime: { enabled: false, time: 300 }, // 5 minutos (Prime Gaming)
    subTier1: { enabled: false, time: 300 }, // 5 minutos (Tier 1 pagada)
    subTier2: { enabled: false, time: 600 }, // 10 minutos
    subTier3: { enabled: false, time: 900 }, // 15 minutos
    giftSub: { enabled: false, time: 300 }, // 5 minutos
    raid: { enabled: false, time: 60, timePerParticipant: 1 }, // 1min base + 1seg por persona
    hypeTrain: { enabled: false, time: 600 }, // 10 minutos
    tips: { enabled: false, time: 60, perCurrency: 1, currency: 'USD' } // 1min cada $1 USD
};

export const DEFAULT_EVENT_TIME_UNITS: {
    bits: TimeUnit;
    follow: TimeUnit;
    subPrime: TimeUnit;
    subTier1: TimeUnit;
    subTier2: TimeUnit;
    subTier3: TimeUnit;
    giftSub: TimeUnit;
    raidBase: TimeUnit;
    raidPerParticipant: TimeUnit;
    hypeTrain: TimeUnit;
    tips: TimeUnit;
    followCooldown: TimeUnit;
} = {
    bits: 'minutes',
    follow: 'seconds',
    subPrime: 'minutes',
    subTier1: 'minutes',
    subTier2: 'minutes',
    subTier3: 'minutes',
    giftSub: 'minutes',
    raidBase: 'minutes',
    raidPerParticipant: 'seconds',
    hypeTrain: 'minutes',
    tips: 'minutes',
    followCooldown: 'hours'
};

// ============================================================================
// CONFIGURACIÓN DE COMANDOS
// ============================================================================

const DEFAULT_INFO_COMMAND = (template: string, cooldown = 30): InfoCommandConfig => ({
    enabled: true,
    template,
    cooldown,
    permissionLevel: 'everyone',
    blacklist: [],
    whitelist: []
});

export const DEFAULT_COMMANDS_CONFIG: CommandsConfig = {
    play: { enabled: true, blacklist: [], whitelist: [] },
    pause: { enabled: true, blacklist: [], whitelist: [] },
    reset: { enabled: true, blacklist: [], whitelist: [] },
    stop: { enabled: true, blacklist: [], whitelist: [] },
    addTime: { enabled: true, blacklist: [], whitelist: [] },
    removeTime: { enabled: true, blacklist: [], whitelist: [] },
    // Comandos informativos
    dtiempo: DEFAULT_INFO_COMMAND('⏱ Al extensible le quedan {tiempo}'),
    dcuando: DEFAULT_INFO_COMMAND('📅 El extensible de {streamer} terminaría el {fecha} a las {hora}'),
    dstats:  DEFAULT_INFO_COMMAND('📊 Esta sesión: Subs {subs} · Bits {bits} · Raids {raids} · Total {total}'),
    drecord: DEFAULT_INFO_COMMAND('🏆 El récord del extensible de {streamer} es {record}', 60),
    dtop:    DEFAULT_INFO_COMMAND('🥇 Top contribuidores: {top}', 60)
};

// ============================================================================
// CONFIGURACIÓN DE OBJETIVOS
// ============================================================================

export const DEFAULT_GOAL_CONFIG: GoalConfig = {
    enabled: false,
    goalTime: 86400, // 24 horas por defecto
    showProgress: true,
    showPercentage: true,
    goalText: 'Meta: 24 horas',
    position: { x: 500, y: 270 },
    fontSize: 20,
    textColor: '#ffffff',
    progressBarColor: '#667eea',
    showLiveStats: true,
    statsPosition: 'overlay',
    statsConfig: {
        showBitsTotal: true,
        showSubsTotal: true,
        showRaidsTotal: true,
        showFollowsTotal: true,
        showOthersTotal: true
    }
};

// ============================================================================
// CONFIGURACIÓN DE SORTEOS
// ============================================================================

export const DEFAULT_RAFFLES_CONFIG: import('../types').RafflesConfig = {
    enabled: false,
    autoStartWithTimer: false,
    autoCloseWithTimer: true,
    
    methods: {
        chatCommand: {
            enabled: true,
            command: '!sorteo',
            ticketLimit: 1
        },
        automatic: {
            enabled: false,
            ticketLimit: 1
        },
        bits: {
            enabled: false,
            minAmount: 100,
            multiplier: 1, // 100 bits = 1 ticket
            ticketLimit: 0 // Ilimitado
        },
        subscription: {
            enabled: false,
            tier1Tickets: 1,
            tier2Tickets: 3,
            tier3Tickets: 5,
            ticketLimit: 0
        },
        giftSubscription: {
            enabled: false,
            multiplier: 1, // 1 ticket por regalo
            ticketLimit: 0
        },
        follow: {
            enabled: true,
            ticketLimit: 1
        }
    },

    requirements: {
        minAccountAge: 7, // 1 semana
        minFollowDuration: 0,
        requireChatActivity: false,
        chatActivityMinutes: 10,
        excludeMods: true,
        excludeVips: true,
        excludeBroadcaster: true,
        excludePreviousWinners: false
    },

    animations: {
        drawAnimation: 'roulette',
        duration: 5
    }
};

// ============================================================================
// CONFIGURACIÓN AVANZADA
// ============================================================================

export const DEFAULT_ADVANCED_CONFIG: AdvancedConfig = {
    templates: {
        speedrun: {
            name: 'Speedrun',
            description: 'Timer simple para speedruns',
            config: {
                defaultDuration: 0,
                displayConfig: { showTitle: false, showPercentage: false },
                progressBarConfig: { type: 'horizontal' },
                styleConfig: { timeFontSize: 64 }
            }
        },
        subathon: {
            name: 'Subathon',
            description: 'Timer con objetivo de tiempo largo',
            config: {
                defaultDuration: 86400, // 24h
                displayConfig: { showDays: true, showHours: true, showMinutes: true },
                progressBarConfig: { type: 'horizontal' },
                styleConfig: { timeFontSize: 48 }
            }
        },
        gamingMarathon: {
            name: 'Gaming Marathon',
            description: 'Timer para maratones de gaming',
            config: {
                defaultDuration: 43200, // 12h
                displayConfig: { showHours: true, showMinutes: true, showSeconds: true },
                progressBarConfig: { type: 'horizontal' },
                styleConfig: { timeFontSize: 56 }
            }
        },
        custom: []
    },
    activeTemplate: null,
    initialTimeOffset: 0,
    autoPause: {
        enabled: false,
        schedules: []
    },
    happyHour: {
        enabled: false,
        startTime: '20:00',
        endTime: '22:00',
        multiplier: 2,
        daysOfWeek: [false, false, false, false, false, true, true] // Solo fin de semana
    },
    autoPlayOnStreamOnline: false,
    autoStopOnStreamOffline: false,
};

// ============================================================================
// CONFIGURACIÓN DE HISTORIAL
// ============================================================================

export const DEFAULT_HISTORY_CONFIG: HistoryConfig = {
    enabled: false,
    maxEntries: 100,
    showInOverlay: false,
    logPosition: 'bottom-right',
    analytics: {
        totalTimeAdded: 0,
        byEventType: {
            bits: 0,
            follows: 0,
            subs: 0,
            raids: 0,
            hypeTrain: 0,
            tips: 0,
            commands: 0
        }
    },
    logs: []
};

// ============================================================================
// CONFIGURACIÓN DE PREVIEW
// ============================================================================

export const DEFAULT_PREVIEW_TIME = 150; // 2:30 default
export const DEFAULT_PREVIEW_RUNNING = true;
