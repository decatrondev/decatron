// Default values for Goals Extension System

import type {
    GoalsConfig,
    GoalsDesignConfig,
    GoalsNotificationsConfig,
    GoalsTimerIntegrationConfig,
    GoalsCommandsConfig,
    CombinedSourcesConfig,
    Goal,
    Milestone
} from '../types';

// Fuentes por defecto para metas combinadas
export const DEFAULT_COMBINED_SOURCES: CombinedSourcesConfig = {
    subs: {
        enabled: true,
        pointsPerUnit: 10,
        description: '1 sub = 10 puntos'
    },
    bits: {
        enabled: true,
        pointsPerUnit: 1, // 100 bits = 1 punto (se divide por 100)
        description: '100 bits = 1 punto'
    },
    follows: {
        enabled: false,
        pointsPerUnit: 1,
        description: '1 follow = 1 punto'
    },
    raids: {
        enabled: false,
        pointsPerUnit: 5,
        description: '1 raid = 5 puntos'
    },
    giftedSubs: {
        enabled: true,
        pointsPerUnit: 10,
        description: '1 sub regalado = 10 puntos'
    }
};

// Diseño por defecto
export const DEFAULT_DESIGN_CONFIG: GoalsDesignConfig = {
    layout: 'vertical',
    maxVisibleGoals: 3,
    spacing: 16,

    progressBar: {
        type: 'horizontal',
        height: 24,
        width: 300,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        fillColor: '#667eea',
        useGradient: true,
        gradientFrom: '#667eea',
        gradientTo: '#764ba2',
        showPercentage: true,
        showValues: true,
        animated: true
    },

    text: {
        fontFamily: 'Inter, sans-serif',
        goalNameSize: 18,
        goalNameColor: '#ffffff',
        valuesSize: 14,
        valuesColor: '#94a3b8',
        showDescription: false,
        descriptionSize: 12,
        descriptionColor: '#64748b'
    },

    container: {
        backgroundColor: '#1B1C1D',
        backgroundOpacity: 90,
        borderRadius: 16,
        borderColor: '#374151',
        borderWidth: 1,
        padding: 16,
        shadow: true
    },

    animations: {
        progressAnimation: 'smooth',
        onMilestone: 'pulse',
        onComplete: 'confetti'
    }
};

// Notificaciones por defecto
export const DEFAULT_NOTIFICATIONS_CONFIG: GoalsNotificationsConfig = {
    onProgress: {
        enabled: false,
        minProgressPercent: 10,
        message: '¡Meta {goalName} avanzó a {percentage}%!',
        sound: undefined
    },
    onMilestone: {
        enabled: true,
        message: '🎯 ¡Milestone alcanzado: {milestoneName}!',
        sound: undefined,
        duration: 5000
    },
    onComplete: {
        enabled: true,
        message: '🏆 ¡META COMPLETADA: {goalName}!',
        sound: undefined,
        duration: 8000
    },
    chatAnnouncements: {
        enabled: true,
        onMilestone: true,
        onComplete: true
    }
};

// Integración con timer por defecto
export const DEFAULT_TIMER_INTEGRATION_CONFIG: GoalsTimerIntegrationConfig = {
    enabled: false,
    mode: 'on-complete',
    perProgress: {
        percentThreshold: 25,
        secondsToAdd: 60
    },
    onComplete: {
        secondsToAdd: 300
    }
};

// Comandos por defecto
export const DEFAULT_COMMANDS_CONFIG: GoalsCommandsConfig = {
    meta: {
        enabled: true,
        aliases: ['!meta', '!goal', '!goals'],
        cooldown: 10,
        response: '📊 {goalName}: {current}/{target} ({percentage}%)'
    },
    metaReset: {
        enabled: true,
        allowedRoles: ['broadcaster', 'moderator']
    },
    metaAdd: {
        enabled: true,
        allowedRoles: ['broadcaster', 'moderator']
    },
    metaSet: {
        enabled: true,
        allowedRoles: ['broadcaster', 'moderator']
    }
};

// Configuración completa por defecto
export const DEFAULT_GOALS_CONFIG: GoalsConfig = {
    goals: [],
    activeGoalIds: [],
    defaultSources: DEFAULT_COMBINED_SOURCES,
    design: DEFAULT_DESIGN_CONFIG,
    notifications: DEFAULT_NOTIFICATIONS_CONFIG,
    timerIntegration: DEFAULT_TIMER_INTEGRATION_CONFIG,
    commands: DEFAULT_COMMANDS_CONFIG,
    historyEnabled: true,
    historyRetentionDays: 30,
    resetOnStreamEnd: true,
    canvasWidth: 1000,
    canvasHeight: 300,
    goalPositions: {}
};

// Template para crear una nueva meta
export const createDefaultGoal = (id: string, name: string = 'Nueva Meta'): Goal => ({
    id,
    name,
    description: '',
    type: 'subs',
    targetValue: 100,
    currentValue: 0,
    status: 'active',
    combinedSources: { ...DEFAULT_COMBINED_SOURCES },
    milestones: [],
    hasDeadline: false,
    deadline: undefined,
    color: '#667eea',
    icon: '🎯',
    onComplete: {
        action: 'nothing',
        notification: {
            enabled: true,
            message: '🏆 ¡META COMPLETADA: {goalName}!',
            sound: undefined,
            animation: 'confetti'
        },
        timerBonus: {
            enabled: false,
            seconds: 300
        }
    },
    createdAt: new Date().toISOString()
});

// Template para crear un nuevo milestone
export const createDefaultMilestone = (id: string, name: string = 'Nuevo Milestone'): Milestone => ({
    id,
    name,
    targetValue: 50,
    isPercentage: true,
    notification: {
        enabled: true,
        message: '🎯 ¡{milestoneName} alcanzado!',
        sound: undefined,
        animation: 'pulse'
    },
    timerBonus: {
        enabled: false,
        seconds: 60
    },
    completed: false
});

// Colores predefinidos para metas
export const GOAL_COLORS = [
    { name: 'Azul', value: '#667eea' },
    { name: 'Morado', value: '#764ba2' },
    { name: 'Rosa', value: '#f093fb' },
    { name: 'Rojo', value: '#ef4444' },
    { name: 'Naranja', value: '#f97316' },
    { name: 'Amarillo', value: '#eab308' },
    { name: 'Verde', value: '#22c55e' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Blanco', value: '#ffffff' }
];

// Iconos predefinidos para metas
export const GOAL_ICONS = [
    '🎯', '🏆', '⭐', '🔥', '💎', '👑', '🚀', '💪', '❤️', '🎮',
    '🎁', '✨', '🌟', '💰', '🎉', '🏅', '💫', '🌈', '⚡', '🎊'
];
