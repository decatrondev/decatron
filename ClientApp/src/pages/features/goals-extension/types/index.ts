// Types for Goals Extension System

// Tipos de fuentes que pueden alimentar una meta
export type GoalSourceType = 'subs' | 'bits' | 'follows' | 'raids' | 'combined';

// Estado de una meta
export type GoalStatus = 'active' | 'completed' | 'paused' | 'expired';

// Tipos de tabs disponibles
export type GoalsTabType = 'guide' | 'basic' | 'sources' | 'design' | 'milestones' | 'notifications' | 'timer-integration' | 'commands' | 'history' | 'media' | 'overlay';

// Configuración de una fuente individual
export interface SourceConfig {
    enabled: boolean;
    pointsPerUnit: number; // Cuántos puntos vale cada unidad (1 sub = X puntos)
    description?: string;
}

// Configuración de fuentes para metas combinadas
export interface CombinedSourcesConfig {
    subs: SourceConfig;
    bits: SourceConfig;
    follows: SourceConfig;
    raids: SourceConfig;
    giftedSubs: SourceConfig;
}

// Milestone (hito) dentro de una meta
export interface Milestone {
    id: string;
    name: string;
    targetValue: number; // Valor absoluto o porcentaje
    isPercentage: boolean; // true = 50%, false = 50 unidades
    notification: {
        enabled: boolean;
        message: string;
        sound?: string;
        animation?: string;
    };
    timerBonus?: {
        enabled: boolean;
        seconds: number;
    };
    completed: boolean;
    completedAt?: string;
}

// Una meta individual
export interface Goal {
    id: string;
    name: string;
    description?: string;
    type: GoalSourceType;
    targetValue: number;
    currentValue: number;
    status: GoalStatus;

    // Para metas combinadas
    combinedSources?: CombinedSourcesConfig;

    // Milestones
    milestones: Milestone[];

    // Límite de tiempo
    hasDeadline: boolean;
    deadline?: string; // ISO date string

    // Visual
    color: string;
    icon?: string;

    // Comportamiento al completar
    onComplete: {
        action: 'nothing' | 'reset' | 'deactivate' | 'next';
        nextGoalId?: string;
        notification: {
            enabled: boolean;
            message: string;
            sound?: string;
            animation?: string;
        };
        timerBonus?: {
            enabled: boolean;
            seconds: number;
        };
    };

    // Timestamps
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
}

// Configuración del diseño del overlay
export interface GoalsDesignConfig {
    // Layout
    layout: 'vertical' | 'horizontal' | 'grid';
    maxVisibleGoals: number;
    spacing: number;

    // Barra de progreso
    progressBar: {
        type: 'horizontal' | 'vertical' | 'circular';
        height: number;
        width: number;
        borderRadius: number;
        backgroundColor: string;
        fillColor: string;
        useGradient: boolean;
        gradientFrom?: string;
        gradientTo?: string;
        showPercentage: boolean;
        showValues: boolean; // "50/100"
        animated: boolean;
    };

    // Texto
    text: {
        fontFamily: string;
        goalNameSize: number;
        goalNameColor: string;
        valuesSize: number;
        valuesColor: string;
        showDescription: boolean;
        descriptionSize: number;
        descriptionColor: string;
    };

    // Contenedor
    container: {
        backgroundColor: string;
        backgroundOpacity: number;
        borderRadius: number;
        borderColor: string;
        borderWidth: number;
        padding: number;
        shadow: boolean;
    };

    // Animaciones
    animations: {
        progressAnimation: 'smooth' | 'bounce' | 'none';
        onMilestone: 'pulse' | 'shake' | 'glow' | 'none';
        onComplete: 'confetti' | 'flash' | 'scale' | 'none';
    };
}

// Configuración de notificaciones
export interface GoalsNotificationsConfig {
    onProgress: {
        enabled: boolean;
        minProgressPercent: number; // Notificar cada X%
        message: string;
        sound?: string;
    };
    onMilestone: {
        enabled: boolean;
        message: string;
        sound?: string;
        duration: number; // ms
    };
    onComplete: {
        enabled: boolean;
        message: string;
        sound?: string;
        duration: number;
    };
    chatAnnouncements: {
        enabled: boolean;
        onMilestone: boolean;
        onComplete: boolean;
    };
}

// Configuración de integración con Timer
export interface GoalsTimerIntegrationConfig {
    enabled: boolean;
    mode: 'per-progress' | 'per-milestone' | 'on-complete';

    // Modo per-progress: cada X% = Y segundos
    perProgress?: {
        percentThreshold: number;
        secondsToAdd: number;
    };

    // Modo per-milestone: usar bonus de cada milestone
    // (se configura en cada milestone)

    // Modo on-complete: bonus al completar meta
    onComplete?: {
        secondsToAdd: number;
    };
}

// Configuración de comandos de chat
export interface GoalsCommandsConfig {
    meta: {
        enabled: boolean;
        aliases: string[];
        cooldown: number;
        response: string;
    };
    metaReset: {
        enabled: boolean;
        allowedRoles: ('broadcaster' | 'moderator' | 'vip')[];
    };
    metaAdd: {
        enabled: boolean;
        allowedRoles: ('broadcaster' | 'moderator')[];
    };
    metaSet: {
        enabled: boolean;
        allowedRoles: ('broadcaster' | 'moderator')[];
    };
}

// Registro de historial
export interface GoalHistoryEntry {
    id: string;
    goalId: string;
    goalName: string;
    action: 'created' | 'started' | 'progress' | 'milestone' | 'completed' | 'reset' | 'expired';
    previousValue?: number;
    newValue?: number;
    milestoneId?: string;
    milestoneName?: string;
    source?: GoalSourceType;
    triggeredBy?: string; // username o 'system'
    timestamp: string;
}

// Posición individual de una meta en el overlay
export interface GoalPosition {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
}

// Configuración completa del sistema de Goals
export interface GoalsConfig {
    // Metas
    goals: Goal[];
    activeGoalIds: string[]; // IDs de metas activas (orden de display)

    // Fuentes por defecto (para nuevas metas)
    defaultSources: CombinedSourcesConfig;

    // Diseño
    design: GoalsDesignConfig;

    // Notificaciones
    notifications: GoalsNotificationsConfig;

    // Integración con timer
    timerIntegration: GoalsTimerIntegrationConfig;

    // Comandos
    commands: GoalsCommandsConfig;

    // Historial
    historyEnabled: boolean;
    historyRetentionDays: number;

    // Session
    resetOnStreamEnd: boolean;

    // Canvas del overlay
    canvasWidth: number;
    canvasHeight: number;

    // Posiciones individuales de metas en overlay
    goalPositions: Record<string, GoalPosition>;
}

// Props comunes para tabs
export interface GoalsTabProps {
    config: GoalsConfig;
    onConfigChange: (updates: Partial<GoalsConfig>) => void;
    onGoalChange: (goalId: string, updates: Partial<Goal>) => void;
    onGoalAdd: (goal: Goal) => void;
    onGoalDelete: (goalId: string) => void;
}
