// MilestonesTab - Configure milestones within goals

import React, { useState } from 'react';
import { Plus, Trash2, Flag, ChevronDown, ChevronUp, Bell, Timer, Percent, Hash } from 'lucide-react';
import type { Goal, Milestone } from '../../types';

interface MilestonesTabProps {
    goals: Goal[];
    onAddMilestone: (goalId: string, milestone?: Partial<Milestone>) => string;
    onUpdateMilestone: (goalId: string, milestoneId: string, updates: Partial<Milestone>) => void;
    onDeleteMilestone: (goalId: string, milestoneId: string) => void;
}

export const MilestonesTab: React.FC<MilestonesTabProps> = ({
    goals,
    onAddMilestone,
    onUpdateMilestone,
    onDeleteMilestone
}) => {
    const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
    const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);

    const handleAddMilestone = (goalId: string) => {
        const id = onAddMilestone(goalId);
        setExpandedMilestoneId(id);
    };

    const handleDeleteMilestone = (goalId: string, milestoneId: string) => {
        if (window.confirm('¿Eliminar este milestone?')) {
            onDeleteMilestone(goalId, milestoneId);
        }
    };

    // Solo mostrar metas que tienen al menos una activa o todas si no hay ninguna
    const goalsWithContent = goals.filter(g => g.status === 'active' || goals.length <= 3);

    if (goals.length === 0) {
        return (
            <div className="bg-ds-surface rounded-lg border border-ds-border p-8 text-center">
                <Flag className="w-16 h-16 mx-auto text-ds-soft mb-4" />
                <h3 className="text-lg font-semibold text-ds-text mb-2">
                    No hay metas creadas
                </h3>
                <p className="text-ds-soft">
                    Primero crea una meta en la pestaña "Metas" para poder agregar milestones.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Info Card */}
            <div className="bg-ds-bg border border-ds-border rounded-lg p-4">
                <p className="text-sm text-ds-soft">
                    🏁 Los milestones son hitos intermedios dentro de una meta. Puedes configurar notificaciones
                    y bonus de tiempo cuando se alcanzan. Por ejemplo: al llegar al 50% de la meta, mostrar una alerta.
                </p>
            </div>

            {/* Goals with Milestones */}
            <div className="space-y-4">
                {goalsWithContent.map((goal) => {
                    const isExpanded = expandedGoalId === goal.id;

                    return (
                        <div
                            key={goal.id}
                            className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden"
                        >
                            {/* Goal Header */}
                            <button
                                onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-ds-bg transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{goal.icon}</span>
                                    <div className="text-left">
                                        <h3 className="font-semibold text-ds-text">
                                            {goal.name}
                                        </h3>
                                        <p className="text-sm text-ds-soft">
                                            {goal.milestones.length} milestone{goal.milestones.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                                {isExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-ds-soft" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-ds-soft" />
                                )}
                            </button>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div className="border-t border-ds-border p-4 space-y-4">
                                    {/* Add Milestone Button */}
                                    <button
                                        onClick={() => handleAddMilestone(goal.id)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-ds-bg hover:bg-ds-raised text-ds-soft rounded-lg transition-colors border-2 border-dashed border-ds-border"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Agregar Milestone
                                    </button>

                                    {/* Milestones List */}
                                    {goal.milestones.length === 0 ? (
                                        <p className="text-center text-sm text-ds-soft py-4">
                                            No hay milestones. Agrega uno para configurar hitos intermedios.
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {goal.milestones
                                                .sort((a, b) => a.targetValue - b.targetValue)
                                                .map((milestone) => {
                                                    const isMilestoneExpanded = expandedMilestoneId === milestone.id;

                                                    return (
                                                        <div
                                                            key={milestone.id}
                                                            className={`rounded-lg border-2 transition-all ${
                                                                milestone.completed
                                                                    ? 'border-ds-ok/40 bg-ds-ok/10 '
                                                                    : 'border-ds-border bg-ds-surface '
                                                            }`}
                                                        >
                                                            {/* Milestone Header */}
                                                            <div className="flex items-center justify-between p-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                                        milestone.completed
                                                                            ? 'bg-ds-accent text-ds-on-accent'
                                                                            : 'bg-ds-accent/10 text-ds-accent-text'
                                                                    }`}>
                                                                        <Flag className="w-4 h-4" />
                                                                    </div>
                                                                    <div>
                                                                        <input
                                                                            type="text"
                                                                            value={milestone.name}
                                                                            onChange={(e) => onUpdateMilestone(goal.id, milestone.id, { name: e.target.value })}
                                                                            className="font-medium text-ds-text bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                                                                            placeholder="Nombre del milestone"
                                                                        />
                                                                        <p className="text-xs text-ds-soft">
                                                                            {milestone.isPercentage ? `${milestone.targetValue}%` : milestone.targetValue} del objetivo
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => setExpandedMilestoneId(isMilestoneExpanded ? null : milestone.id)}
                                                                        className="p-1.5 text-ds-soft hover:bg-ds-bg rounded-lg"
                                                                    >
                                                                        {isMilestoneExpanded ? (
                                                                            <ChevronUp className="w-4 h-4" />
                                                                        ) : (
                                                                            <ChevronDown className="w-4 h-4" />
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteMilestone(goal.id, milestone.id)}
                                                                        className="p-1.5 text-ds-soft hover:text-ds-danger hover:bg-ds-danger/10 rounded-lg"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Milestone Expanded Content */}
                                                            {isMilestoneExpanded && (
                                                                <div className="border-t border-ds-border p-4 space-y-4">
                                                                    {/* Target Value */}
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-ds-soft mb-2">
                                                                            Valor objetivo
                                                                        </label>
                                                                        <div className="flex items-center gap-2">
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                max={milestone.isPercentage ? 100 : goal.targetValue}
                                                                                value={milestone.targetValue}
                                                                                onChange={(e) => onUpdateMilestone(goal.id, milestone.id, { targetValue: parseInt(e.target.value) || 1 })}
                                                                                className="w-24 px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text text-center"
                                                                            />
                                                                            <div className="flex rounded-lg overflow-hidden border border-ds-border">
                                                                                <button
                                                                                    onClick={() => onUpdateMilestone(goal.id, milestone.id, { isPercentage: true })}
                                                                                    className={`px-3 py-2 flex items-center gap-1 text-sm ${
                                                                                        milestone.isPercentage
                                                                                            ? 'bg-ds-accent text-ds-on-accent'
                                                                                            : 'bg-ds-surface text-ds-soft'
                                                                                    }`}
                                                                                >
                                                                                    <Percent className="w-3 h-3" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => onUpdateMilestone(goal.id, milestone.id, { isPercentage: false })}
                                                                                    className={`px-3 py-2 flex items-center gap-1 text-sm ${
                                                                                        !milestone.isPercentage
                                                                                            ? 'bg-ds-accent text-ds-on-accent'
                                                                                            : 'bg-ds-surface text-ds-soft'
                                                                                    }`}
                                                                                >
                                                                                    <Hash className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                            <span className="text-sm text-ds-soft">
                                                                                {milestone.isPercentage ? 'del total' : 'unidades'}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Notification */}
                                                                    <div>
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <label className="flex items-center gap-2 text-sm font-medium text-ds-soft">
                                                                                <Bell className="w-4 h-4" />
                                                                                Notificación
                                                                            </label>
                                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={milestone.notification.enabled}
                                                                                    onChange={(e) => onUpdateMilestone(goal.id, milestone.id, {
                                                                                        notification: { ...milestone.notification, enabled: e.target.checked }
                                                                                    })}
                                                                                    className="sr-only peer"
                                                                                />
                                                                                <div className="w-9 h-5 bg-ds-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
                                                                            </label>
                                                                        </div>
                                                                        {milestone.notification.enabled && (
                                                                            <input
                                                                                type="text"
                                                                                value={milestone.notification.message}
                                                                                onChange={(e) => onUpdateMilestone(goal.id, milestone.id, {
                                                                                    notification: { ...milestone.notification, message: e.target.value }
                                                                                })}
                                                                                placeholder="Mensaje de notificación"
                                                                                className="w-full px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text text-sm"
                                                                            />
                                                                        )}
                                                                    </div>

                                                                    {/* Timer Bonus */}
                                                                    <div>
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <label className="flex items-center gap-2 text-sm font-medium text-ds-soft">
                                                                                <Timer className="w-4 h-4" />
                                                                                Bonus de tiempo
                                                                            </label>
                                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={milestone.timerBonus?.enabled || false}
                                                                                    onChange={(e) => onUpdateMilestone(goal.id, milestone.id, {
                                                                                        timerBonus: {
                                                                                            enabled: e.target.checked,
                                                                                            seconds: milestone.timerBonus?.seconds || 60
                                                                                        }
                                                                                    })}
                                                                                    className="sr-only peer"
                                                                                />
                                                                                <div className="w-9 h-5 bg-ds-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
                                                                            </label>
                                                                        </div>
                                                                        {milestone.timerBonus?.enabled && (
                                                                            <div className="flex items-center gap-2">
                                                                                <input
                                                                                    type="number"
                                                                                    min="1"
                                                                                    value={milestone.timerBonus.seconds}
                                                                                    onChange={(e) => onUpdateMilestone(goal.id, milestone.id, {
                                                                                        timerBonus: {
                                                                                            enabled: true,
                                                                                            seconds: parseInt(e.target.value) || 60
                                                                                        }
                                                                                    })}
                                                                                    className="w-24 px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text text-center"
                                                                                />
                                                                                <span className="text-sm text-ds-soft">segundos al timer</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}

                                    {/* Visual Timeline */}
                                    {goal.milestones.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-ds-border">
                                            <p className="text-xs text-ds-soft mb-2">Vista previa de milestones:</p>
                                            <div className="relative h-8 bg-ds-bg rounded-lg overflow-hidden">
                                                {/* Progress bar background */}
                                                <div
                                                    className="absolute h-full bg-ds-accent/20"
                                                    style={{ width: `${(goal.currentValue / goal.targetValue) * 100}%` }}
                                                />
                                                {/* Milestone markers */}
                                                {goal.milestones.map((m) => {
                                                    const position = m.isPercentage
                                                        ? m.targetValue
                                                        : (m.targetValue / goal.targetValue) * 100;
                                                    return (
                                                        <div
                                                            key={m.id}
                                                            className={`absolute top-0 bottom-0 w-0.5 ${
                                                                m.completed ? 'bg-ds-accent' : 'bg-ds-accent'
                                                            }`}
                                                            style={{ left: `${position}%` }}
                                                            title={`${m.name} (${position}%)`}
                                                        >
                                                            <div className={`absolute -top-1 -left-1.5 w-3 h-3 rounded-full ${
                                                                m.completed ? 'bg-ds-accent' : 'bg-ds-accent'
                                                            }`} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MilestonesTab;
