// Hook for managing Goals configuration state

import { useState, useCallback } from 'react';
import type {
    GoalsConfig,
    Goal,
    Milestone,
    GoalsDesignConfig,
    GoalsNotificationsConfig,
    GoalsTimerIntegrationConfig,
    GoalsCommandsConfig,
    CombinedSourcesConfig,
    GoalPosition
} from '../types';
import {
    DEFAULT_GOALS_CONFIG,
    createDefaultGoal,
    createDefaultMilestone
} from '../constants/defaults';

export const useGoalsConfig = () => {
    // Estado principal
    const [goals, setGoals] = useState<Goal[]>([]);
    const [activeGoalIds, setActiveGoalIds] = useState<string[]>([]);
    const [defaultSources, setDefaultSources] = useState<CombinedSourcesConfig>(
        DEFAULT_GOALS_CONFIG.defaultSources
    );
    const [design, setDesign] = useState<GoalsDesignConfig>(
        DEFAULT_GOALS_CONFIG.design
    );
    const [notifications, setNotifications] = useState<GoalsNotificationsConfig>(
        DEFAULT_GOALS_CONFIG.notifications
    );
    const [timerIntegration, setTimerIntegration] = useState<GoalsTimerIntegrationConfig>(
        DEFAULT_GOALS_CONFIG.timerIntegration
    );
    const [commands, setCommands] = useState<GoalsCommandsConfig>(
        DEFAULT_GOALS_CONFIG.commands
    );
    const [historyEnabled, setHistoryEnabled] = useState(DEFAULT_GOALS_CONFIG.historyEnabled);
    const [historyRetentionDays, setHistoryRetentionDays] = useState(DEFAULT_GOALS_CONFIG.historyRetentionDays);
    const [resetOnStreamEnd, setResetOnStreamEnd] = useState(DEFAULT_GOALS_CONFIG.resetOnStreamEnd);
    const [canvasWidth, setCanvasWidth] = useState(DEFAULT_GOALS_CONFIG.canvasWidth);
    const [canvasHeight, setCanvasHeight] = useState(DEFAULT_GOALS_CONFIG.canvasHeight);
    const [goalPositions, setGoalPositions] = useState<Record<string, GoalPosition>>(
        DEFAULT_GOALS_CONFIG.goalPositions
    );

    // ==================== GOAL MANAGEMENT ====================

    // Agregar una nueva meta
    const addGoal = useCallback((goal?: Partial<Goal>) => {
        const id = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newGoal = {
            ...createDefaultGoal(id),
            ...goal
        };
        setGoals(prev => [...prev, newGoal]);
        setActiveGoalIds(prev => [...prev, id]);
        return id;
    }, []);

    // Actualizar una meta
    const updateGoal = useCallback((goalId: string, updates: Partial<Goal>) => {
        setGoals(prev => prev.map(goal =>
            goal.id === goalId ? { ...goal, ...updates } : goal
        ));
    }, []);

    // Eliminar una meta
    const deleteGoal = useCallback((goalId: string) => {
        setGoals(prev => prev.filter(goal => goal.id !== goalId));
        setActiveGoalIds(prev => prev.filter(id => id !== goalId));
    }, []);

    // Duplicar una meta
    const duplicateGoal = useCallback((goalId: string) => {
        const goalToDuplicate = goals.find(g => g.id === goalId);
        if (!goalToDuplicate) return null;

        const newId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newGoal: Goal = {
            ...goalToDuplicate,
            id: newId,
            name: `${goalToDuplicate.name} (copia)`,
            currentValue: 0,
            status: 'active',
            createdAt: new Date().toISOString(),
            startedAt: undefined,
            completedAt: undefined,
            milestones: goalToDuplicate.milestones.map(m => ({
                ...m,
                id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                completed: false,
                completedAt: undefined
            }))
        };

        setGoals(prev => [...prev, newGoal]);
        return newId;
    }, [goals]);

    // Reordenar metas activas
    const reorderActiveGoals = useCallback((newOrder: string[]) => {
        setActiveGoalIds(newOrder);
    }, []);

    // Activar/desactivar una meta
    const toggleGoalActive = useCallback((goalId: string) => {
        setActiveGoalIds(prev => {
            if (prev.includes(goalId)) {
                return prev.filter(id => id !== goalId);
            } else {
                return [...prev, goalId];
            }
        });
    }, []);

    // ==================== MILESTONE MANAGEMENT ====================

    // Agregar milestone a una meta
    const addMilestone = useCallback((goalId: string, milestone?: Partial<Milestone>) => {
        const id = `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newMilestone = {
            ...createDefaultMilestone(id),
            ...milestone
        };

        setGoals(prev => prev.map(goal => {
            if (goal.id === goalId) {
                return {
                    ...goal,
                    milestones: [...goal.milestones, newMilestone]
                };
            }
            return goal;
        }));

        return id;
    }, []);

    // Actualizar milestone
    const updateMilestone = useCallback((goalId: string, milestoneId: string, updates: Partial<Milestone>) => {
        setGoals(prev => prev.map(goal => {
            if (goal.id === goalId) {
                return {
                    ...goal,
                    milestones: goal.milestones.map(m =>
                        m.id === milestoneId ? { ...m, ...updates } : m
                    )
                };
            }
            return goal;
        }));
    }, []);

    // Eliminar milestone
    const deleteMilestone = useCallback((goalId: string, milestoneId: string) => {
        setGoals(prev => prev.map(goal => {
            if (goal.id === goalId) {
                return {
                    ...goal,
                    milestones: goal.milestones.filter(m => m.id !== milestoneId)
                };
            }
            return goal;
        }));
    }, []);

    // ==================== CONFIG UPDATES ====================

    const updateDesign = useCallback((updates: Partial<GoalsDesignConfig>) => {
        setDesign(prev => ({ ...prev, ...updates }));
    }, []);

    const updateDesignProgressBar = useCallback((updates: Partial<GoalsDesignConfig['progressBar']>) => {
        setDesign(prev => ({
            ...prev,
            progressBar: { ...prev.progressBar, ...updates }
        }));
    }, []);

    const updateDesignText = useCallback((updates: Partial<GoalsDesignConfig['text']>) => {
        setDesign(prev => ({
            ...prev,
            text: { ...prev.text, ...updates }
        }));
    }, []);

    const updateDesignContainer = useCallback((updates: Partial<GoalsDesignConfig['container']>) => {
        setDesign(prev => ({
            ...prev,
            container: { ...prev.container, ...updates }
        }));
    }, []);

    const updateDesignAnimations = useCallback((updates: Partial<GoalsDesignConfig['animations']>) => {
        setDesign(prev => ({
            ...prev,
            animations: { ...prev.animations, ...updates }
        }));
    }, []);

    const updateNotifications = useCallback((updates: Partial<GoalsNotificationsConfig>) => {
        setNotifications(prev => ({ ...prev, ...updates }));
    }, []);

    const updateTimerIntegration = useCallback((updates: Partial<GoalsTimerIntegrationConfig>) => {
        setTimerIntegration(prev => ({ ...prev, ...updates }));
    }, []);

    const updateCommands = useCallback((updates: Partial<GoalsCommandsConfig>) => {
        setCommands(prev => ({ ...prev, ...updates }));
    }, []);

    const updateDefaultSources = useCallback((updates: Partial<CombinedSourcesConfig>) => {
        setDefaultSources(prev => ({ ...prev, ...updates }));
    }, []);

    // ==================== LOAD / GET COMPLETE CONFIG ====================

    // Cargar configuración desde la base de datos
    const loadConfig = useCallback((config: GoalsConfig) => {
        setGoals(config.goals || []);
        setActiveGoalIds(config.activeGoalIds || []);
        setDefaultSources(config.defaultSources || DEFAULT_GOALS_CONFIG.defaultSources);
        setDesign(config.design || DEFAULT_GOALS_CONFIG.design);
        setNotifications(config.notifications || DEFAULT_GOALS_CONFIG.notifications);
        setTimerIntegration(config.timerIntegration || DEFAULT_GOALS_CONFIG.timerIntegration);
        setCommands(config.commands || DEFAULT_GOALS_CONFIG.commands);
        setHistoryEnabled(config.historyEnabled ?? DEFAULT_GOALS_CONFIG.historyEnabled);
        setHistoryRetentionDays(config.historyRetentionDays ?? DEFAULT_GOALS_CONFIG.historyRetentionDays);
        setResetOnStreamEnd(config.resetOnStreamEnd ?? DEFAULT_GOALS_CONFIG.resetOnStreamEnd);
        setCanvasWidth(config.canvasWidth || DEFAULT_GOALS_CONFIG.canvasWidth);
        setCanvasHeight(config.canvasHeight || DEFAULT_GOALS_CONFIG.canvasHeight);
        setGoalPositions(config.goalPositions || DEFAULT_GOALS_CONFIG.goalPositions);
    }, []);

    // Obtener configuración completa para guardar
    const getCompleteConfig = useCallback((): GoalsConfig => {
        return {
            goals,
            activeGoalIds,
            defaultSources,
            design,
            notifications,
            timerIntegration,
            commands,
            historyEnabled,
            historyRetentionDays,
            resetOnStreamEnd,
            canvasWidth,
            canvasHeight,
            goalPositions
        };
    }, [
        goals,
        activeGoalIds,
        defaultSources,
        design,
        notifications,
        timerIntegration,
        commands,
        historyEnabled,
        historyRetentionDays,
        resetOnStreamEnd,
        canvasWidth,
        canvasHeight,
        goalPositions
    ]);

    // Reset a valores por defecto
    const resetToDefaults = useCallback(() => {
        loadConfig(DEFAULT_GOALS_CONFIG);
    }, [loadConfig]);

    return {
        // Estado
        goals,
        activeGoalIds,
        defaultSources,
        design,
        notifications,
        timerIntegration,
        commands,
        historyEnabled,
        historyRetentionDays,
        resetOnStreamEnd,
        canvasWidth,
        canvasHeight,
        goalPositions,

        // Setters directos
        setHistoryEnabled,
        setHistoryRetentionDays,
        setResetOnStreamEnd,
        setCanvasWidth,
        setCanvasHeight,
        setGoalPositions,

        // Goal management
        addGoal,
        updateGoal,
        deleteGoal,
        duplicateGoal,
        reorderActiveGoals,
        toggleGoalActive,

        // Milestone management
        addMilestone,
        updateMilestone,
        deleteMilestone,

        // Config updates
        updateDesign,
        updateDesignProgressBar,
        updateDesignText,
        updateDesignContainer,
        updateDesignAnimations,
        updateNotifications,
        updateTimerIntegration,
        updateCommands,
        updateDefaultSources,

        // Load/Get
        loadConfig,
        getCompleteConfig,
        resetToDefaults
    };
};

export type UseGoalsConfigReturn = ReturnType<typeof useGoalsConfig>;
