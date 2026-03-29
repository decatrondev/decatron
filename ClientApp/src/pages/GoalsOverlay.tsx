import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import type {
    Goal,
    GoalsDesignConfig,
    GoalPosition
} from './features/goals-extension/types';
import { DEFAULT_DESIGN_CONFIG, DEFAULT_GOALS_CONFIG } from './features/goals-extension/constants/defaults';

// ============================================================================
// STYLES & KEYFRAMES
// ============================================================================
const OVERLAY_STYLES = `
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    @keyframes glow {
        0%, 100% { box-shadow: 0 0 5px currentColor; }
        50% { box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
    }
    @keyframes confetti {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    @keyframes progressFill {
        from { width: 0%; }
    }
`;

// ============================================================================
// TYPES
// ============================================================================
interface OverlayConfig {
    goals: Goal[];
    activeGoalIds: string[];
    design: GoalsDesignConfig;
    canvasWidth: number;
    canvasHeight: number;
    goalPositions: Record<string, GoalPosition>;
}

interface GoalUpdate {
    goalId: string;
    previousValue: number;
    newValue: number;
    source: string;
    milestoneReached?: string;
    isCompleted?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================
export default function GoalsOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';

    // State
    const [config, setConfig] = useState<OverlayConfig>({
        goals: [],
        activeGoalIds: [],
        design: DEFAULT_DESIGN_CONFIG,
        canvasWidth: 1000,
        canvasHeight: 300,
        goalPositions: {}
    });
    const [isVisible, setIsVisible] = useState(false);
    const [animatingGoals, setAnimatingGoals] = useState<Set<string>>(new Set());
    const [completedGoals, setCompletedGoals] = useState<Set<string>>(new Set());

    // Refs
    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // ========================================================================
    // LOAD CONFIGURATION
    // ========================================================================
    const loadConfiguration = async () => {
        if (!channel) return;
        try {
            const response = await fetch(`/api/goals/config/overlay/${channel}`);
            const data = await response.json();

            if (data.success && data.config) {
                setConfig({
                    goals: data.config.goals || [],
                    activeGoalIds: data.config.activeGoalIds || [],
                    design: data.config.design || DEFAULT_DESIGN_CONFIG,
                    canvasWidth: data.config.canvasWidth || 1000,
                    canvasHeight: data.config.canvasHeight || 300,
                    goalPositions: data.config.goalPositions || {}
                });
                setIsVisible(true);
            }
        } catch (err) {
            console.error('[GOALS OVERLAY] Error loading config:', err);
        }
    };

    // ========================================================================
    // SIGNALR CONNECTION
    // ========================================================================
    useEffect(() => {
        let isMounted = true;
        loadConfiguration();

        const connection = new signalR.HubConnectionBuilder()
            .withUrl('/hubs/overlay')
            .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
            .configureLogging(signalR.LogLevel.Error)
            .build();

        // Event Handlers
        connection.on('GoalsConfigChanged', () => {
            console.log('[GOALS] Config changed');
            loadConfiguration();
        });

        connection.on('GoalProgress', (update: GoalUpdate) => {
            console.log('[GOALS] Progress update:', update);

            // Update goal value
            setConfig(prev => ({
                ...prev,
                goals: prev.goals.map(goal =>
                    goal.id === update.goalId
                        ? { ...goal, currentValue: update.newValue }
                        : goal
                )
            }));

            // Trigger animation if milestone reached
            if (update.milestoneReached) {
                setAnimatingGoals(prev => new Set([...Array.from(prev), update.goalId]));
                setTimeout(() => {
                    setAnimatingGoals(prev => {
                        const next = new Set(prev);
                        next.delete(update.goalId);
                        return next;
                    });
                }, 2000);
            }

            // Mark as completed if finished
            if (update.isCompleted) {
                setCompletedGoals(prev => new Set([...Array.from(prev), update.goalId]));
                setTimeout(() => {
                    setCompletedGoals(prev => {
                        const next = new Set(prev);
                        next.delete(update.goalId);
                        return next;
                    });
                }, 3000);
            }
        });

        connection.on('GoalCompleted', (goalId: string) => {
            console.log('[GOALS] Goal completed:', goalId);
            setCompletedGoals(prev => new Set([...Array.from(prev), goalId]));
            setTimeout(() => {
                setCompletedGoals(prev => {
                    const next = new Set(prev);
                    next.delete(goalId);
                    return next;
                });
            }, 3000);
        });

        connection.on('GoalMilestone', (data: { goalId: string; milestoneName: string }) => {
            console.log('[GOALS] Milestone reached:', data);
            setAnimatingGoals(prev => new Set([...Array.from(prev), data.goalId]));
            setTimeout(() => {
                setAnimatingGoals(prev => {
                    const next = new Set(prev);
                    next.delete(data.goalId);
                    return next;
                });
            }, 2000);
        });

        // Connection Lifecycle
        connection.onreconnected(() => {
            if (channel) connection.invoke('JoinChannel', channel);
            loadConfiguration();
        });

        connection.onclose(error => {
            if (isMounted) {
                setTimeout(startConnection, 5000);
            }
        });

        // Start Connection
        const startConnection = async () => {
            await new Promise(r => setTimeout(r, 50));
            if (!isMounted || connection.state !== signalR.HubConnectionState.Disconnected) return;

            try {
                await connection.start();
                console.log('[GOALS] SignalR Connected');
                connectionRef.current = connection;
                if (channel) {
                    await connection.invoke('JoinChannel', channel);
                }
            } catch (err: any) {
                if (!isMounted) return;
                if (err.message?.includes('negotiation')) return;
                console.warn('[GOALS] Connection error, retrying in 5s');
                setTimeout(startConnection, 5000);
            }
        };

        startConnection();

        return () => {
            isMounted = false;
            connection.stop().catch(() => {});
        };
    }, [channel]);

    // ========================================================================
    // RENDER HELPERS
    // ========================================================================
    const hexToRgba = (hex: string, alpha: number) => {
        if (!hex || hex === 'transparent') return 'transparent';
        const clean = hex.startsWith('#') ? hex : `#${hex}`;
        const r = parseInt(clean.slice(1, 3), 16);
        const g = parseInt(clean.slice(3, 5), 16);
        const b = parseInt(clean.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const getAnimationClass = (goalId: string): string => {
        if (completedGoals.has(goalId)) {
            const anim = config.design.animations.onComplete;
            return anim !== 'none' ? `animation: ${anim} 0.5s ease-in-out infinite` : '';
        }
        if (animatingGoals.has(goalId)) {
            const anim = config.design.animations.onMilestone;
            return anim !== 'none' ? `animation: ${anim} 0.5s ease-in-out infinite` : '';
        }
        return '';
    };

    // Get active goals
    const activeGoals = config.activeGoalIds
        .map(id => config.goals.find(g => g.id === id))
        .filter((g): g is Goal => g !== undefined)
        .slice(0, config.design.maxVisibleGoals);

    // Container background
    const containerBg = hexToRgba(
        config.design.container.backgroundColor,
        config.design.container.backgroundOpacity / 100
    );

    // ========================================================================
    // RENDER PROGRESS BAR
    // ========================================================================
    const renderProgressBar = (goal: Goal) => {
        const percentage = Math.min(100, (goal.currentValue / goal.targetValue) * 100);
        const { progressBar } = config.design;

        const fillStyle: React.CSSProperties = {
            width: `${percentage}%`,
            height: '100%',
            borderRadius: progressBar.borderRadius,
            transition: progressBar.animated ? 'width 0.5s ease-out' : 'none',
            background: progressBar.useGradient
                ? `linear-gradient(90deg, ${progressBar.gradientFrom || goal.color}, ${progressBar.gradientTo || goal.color})`
                : goal.color
        };

        return (
            <div
                style={{
                    width: progressBar.width,
                    height: progressBar.height,
                    backgroundColor: progressBar.backgroundColor,
                    borderRadius: progressBar.borderRadius,
                    overflow: 'hidden'
                }}
            >
                <div style={fillStyle} />
            </div>
        );
    };

    // ========================================================================
    // RENDER GOAL (Standard Layout)
    // ========================================================================
    const renderGoal = (goal: Goal) => {
        const percentage = Math.round((goal.currentValue / goal.targetValue) * 100);
        const animStyle = getAnimationClass(goal.id);
        const isCompleted = completedGoals.has(goal.id);

        return (
            <div
                key={goal.id}
                style={{
                    fontFamily: config.design.text.fontFamily,
                    ...(animStyle ? { animation: animStyle.split(': ')[1] } : {})
                }}
            >
                {/* Goal Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: config.design.text.goalNameSize * 0.8 }}>
                            {goal.icon}
                        </span>
                        <span
                            style={{
                                fontSize: config.design.text.goalNameSize,
                                color: config.design.text.goalNameColor,
                                fontWeight: 600,
                                textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                            }}
                        >
                            {goal.name}
                        </span>
                    </div>
                    {config.design.progressBar.showPercentage && (
                        <span
                            style={{
                                fontSize: config.design.text.valuesSize,
                                color: isCompleted ? '#22c55e' : config.design.text.valuesColor,
                                fontWeight: isCompleted ? 700 : 400,
                                textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                            }}
                        >
                            {percentage}%{isCompleted && ' ✓'}
                        </span>
                    )}
                </div>

                {/* Progress Bar */}
                {renderProgressBar(goal)}

                {/* Values */}
                {config.design.progressBar.showValues && (
                    <div
                        style={{
                            fontSize: config.design.text.valuesSize,
                            color: config.design.text.valuesColor,
                            textAlign: 'center',
                            marginTop: 4,
                            textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                        }}
                    >
                        {goal.currentValue} / {goal.targetValue}
                    </div>
                )}

                {/* Description */}
                {config.design.text.showDescription && goal.description && (
                    <div
                        style={{
                            fontSize: config.design.text.descriptionSize,
                            color: config.design.text.descriptionColor,
                            marginTop: 4,
                            textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                        }}
                    >
                        {goal.description}
                    </div>
                )}
            </div>
        );
    };

    // ========================================================================
    // RENDER GOAL WITH POSITION (Overlay Editor Mode)
    // ========================================================================
    const renderGoalWithPosition = (goal: Goal, position: GoalPosition) => {
        const percentage = Math.round((goal.currentValue / goal.targetValue) * 100);
        const animStyle = getAnimationClass(goal.id);
        const isCompleted = completedGoals.has(goal.id);
        const isAnimating = animatingGoals.has(goal.id);

        return (
            <div
                key={goal.id}
                style={{
                    position: 'absolute',
                    left: position.x,
                    top: position.y,
                    width: position.width,
                    height: position.height,
                    transform: `rotate(${position.rotation}deg)`,
                    fontFamily: config.design.text.fontFamily,
                    backgroundColor: containerBg,
                    borderRadius: config.design.container.borderRadius,
                    border: config.design.container.borderWidth > 0
                        ? `${config.design.container.borderWidth}px solid ${config.design.container.borderColor}`
                        : 'none',
                    padding: config.design.container.padding,
                    boxShadow: config.design.container.shadow
                        ? '0 10px 25px rgba(0,0,0,0.3)'
                        : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    animation: isCompleted
                        ? `${config.design.animations.onComplete} 0.5s ease-in-out infinite`
                        : isAnimating
                        ? `${config.design.animations.onMilestone} 0.5s ease-in-out infinite`
                        : 'none'
                }}
            >
                {/* Goal Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: config.design.text.goalNameSize * 0.8 }}>
                            {goal.icon}
                        </span>
                        <span
                            style={{
                                fontSize: config.design.text.goalNameSize,
                                color: config.design.text.goalNameColor,
                                fontWeight: 600,
                                textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                            }}
                        >
                            {goal.name}
                        </span>
                    </div>
                    {config.design.progressBar.showPercentage && (
                        <span
                            style={{
                                fontSize: config.design.text.valuesSize,
                                color: isCompleted ? '#22c55e' : config.design.text.valuesColor,
                                fontWeight: isCompleted ? 700 : 400,
                                textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                            }}
                        >
                            {percentage}%{isCompleted && ' ✓'}
                        </span>
                    )}
                </div>

                {/* Progress Bar - Use remaining height */}
                <div
                    style={{
                        width: '100%',
                        height: config.design.progressBar.height,
                        backgroundColor: config.design.progressBar.backgroundColor,
                        borderRadius: config.design.progressBar.borderRadius,
                        overflow: 'hidden'
                    }}
                >
                    <div
                        style={{
                            width: `${Math.min(100, (goal.currentValue / goal.targetValue) * 100)}%`,
                            height: '100%',
                            borderRadius: config.design.progressBar.borderRadius,
                            transition: config.design.progressBar.animated ? 'width 0.5s ease-out' : 'none',
                            background: config.design.progressBar.useGradient
                                ? `linear-gradient(90deg, ${config.design.progressBar.gradientFrom || goal.color}, ${config.design.progressBar.gradientTo || goal.color})`
                                : goal.color
                        }}
                    />
                </div>

                {/* Values */}
                {config.design.progressBar.showValues && (
                    <div
                        style={{
                            fontSize: config.design.text.valuesSize,
                            color: config.design.text.valuesColor,
                            textAlign: 'center',
                            marginTop: 8,
                            textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                        }}
                    >
                        {goal.currentValue} / {goal.targetValue}
                    </div>
                )}
            </div>
        );
    };

    // ========================================================================
    // MAIN RENDER
    // ========================================================================
    if (!isVisible) return null;

    // Check if we have custom positions (from OverlayTab editor)
    const hasCustomPositions = Object.keys(config.goalPositions).length > 0;

    return (
        <>
            <style>{OVERLAY_STYLES}</style>
            <div
                style={{
                    width: config.canvasWidth,
                    height: config.canvasHeight,
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {hasCustomPositions ? (
                    // Render with custom positions
                    activeGoals.map(goal => {
                        const position = config.goalPositions[goal.id];
                        if (!position) return null;
                        return renderGoalWithPosition(goal, position);
                    })
                ) : (
                    // Render with standard layout
                    activeGoals.length > 0 && (
                        <div
                            style={{
                                position: 'absolute',
                                left: 20,
                                top: 20,
                                backgroundColor: containerBg,
                                borderRadius: config.design.container.borderRadius,
                                border: config.design.container.borderWidth > 0
                                    ? `${config.design.container.borderWidth}px solid ${config.design.container.borderColor}`
                                    : 'none',
                                padding: config.design.container.padding,
                                boxShadow: config.design.container.shadow
                                    ? '0 10px 25px rgba(0,0,0,0.3)'
                                    : 'none',
                                display: 'flex',
                                flexDirection: config.design.layout === 'horizontal' ? 'row' : 'column',
                                gap: config.design.spacing,
                                flexWrap: config.design.layout === 'grid' ? 'wrap' : 'nowrap',
                                animation: 'fadeIn 0.5s ease-out'
                            }}
                        >
                            {activeGoals.map(goal => renderGoal(goal))}
                        </div>
                    )
                )}

                {/* Empty state - hidden for OBS */}
                {activeGoals.length === 0 && (
                    <div style={{ display: 'none' }}>
                        No active goals
                    </div>
                )}
            </div>
        </>
    );
}
