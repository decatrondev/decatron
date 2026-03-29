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
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-8 text-center">
                <Flag className="w-16 h-16 mx-auto text-[#64748b] dark:text-[#94a3b8] mb-4" />
                <h3 className="text-lg font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                    No hay metas creadas
                </h3>
                <p className="text-[#64748b] dark:text-[#94a3b8]">
                    Primero crea una meta en la pestaña "Metas" para poder agregar milestones.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Info Card */}
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
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
                            className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden"
                        >
                            {/* Goal Header */}
                            <button
                                onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{goal.icon}</span>
                                    <div className="text-left">
                                        <h3 className="font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                            {goal.name}
                                        </h3>
                                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                            {goal.milestones.length} milestone{goal.milestones.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                                {isExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-[#64748b]" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-[#64748b]" />
                                )}
                            </button>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div className="border-t border-[#e2e8f0] dark:border-[#374151] p-4 space-y-4">
                                    {/* Add Milestone Button */}
                                    <button
                                        onClick={() => handleAddMilestone(goal.id)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] text-[#64748b] rounded-xl transition-colors border-2 border-dashed border-[#e2e8f0] dark:border-[#374151]"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Agregar Milestone
                                    </button>

                                    {/* Milestones List */}
                                    {goal.milestones.length === 0 ? (
                                        <p className="text-center text-sm text-[#94a3b8] py-4">
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
                                                            className={`rounded-xl border-2 transition-all ${
                                                                milestone.completed
                                                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                                                    : 'border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626]'
                                                            }`}
                                                        >
                                                            {/* Milestone Header */}
                                                            <div className="flex items-center justify-between p-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                                        milestone.completed
                                                                            ? 'bg-green-500 text-white'
                                                                            : 'bg-[#667eea]/10 text-[#667eea]'
                                                                    }`}>
                                                                        <Flag className="w-4 h-4" />
                                                                    </div>
                                                                    <div>
                                                                        <input
                                                                            type="text"
                                                                            value={milestone.name}
                                                                            onChange={(e) => onUpdateMilestone(goal.id, milestone.id, { name: e.target.value })}
                                                                            className="font-medium text-[#1e293b] dark:text-[#f8fafc] bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                                                                            placeholder="Nombre del milestone"
                                                                        />
                                                                        <p className="text-xs text-[#64748b]">
                                                                            {milestone.isPercentage ? `${milestone.targetValue}%` : milestone.targetValue} del objetivo
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => setExpandedMilestoneId(isMilestoneExpanded ? null : milestone.id)}
                                                                        className="p-1.5 text-[#64748b] hover:bg-[#f8fafc] dark:hover:bg-[#374151] rounded-lg"
                                                                    >
                                                                        {isMilestoneExpanded ? (
                                                                            <ChevronUp className="w-4 h-4" />
                                                                        ) : (
                                                                            <ChevronDown className="w-4 h-4" />
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteMilestone(goal.id, milestone.id)}
                                                                        className="p-1.5 text-[#64748b] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Milestone Expanded Content */}
                                                            {isMilestoneExpanded && (
                                                                <div className="border-t border-[#e2e8f0] dark:border-[#374151] p-4 space-y-4">
                                                                    {/* Target Value */}
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                                                            Valor objetivo
                                                                        </label>
                                                                        <div className="flex items-center gap-2">
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                max={milestone.isPercentage ? 100 : goal.targetValue}
                                                                                value={milestone.targetValue}
                                                                                onChange={(e) => onUpdateMilestone(goal.id, milestone.id, { targetValue: parseInt(e.target.value) || 1 })}
                                                                                className="w-24 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] text-center"
                                                                            />
                                                                            <div className="flex rounded-lg overflow-hidden border border-[#e2e8f0] dark:border-[#374151]">
                                                                                <button
                                                                                    onClick={() => onUpdateMilestone(goal.id, milestone.id, { isPercentage: true })}
                                                                                    className={`px-3 py-2 flex items-center gap-1 text-sm ${
                                                                                        milestone.isPercentage
                                                                                            ? 'bg-[#667eea] text-white'
                                                                                            : 'bg-white dark:bg-[#1B1C1D] text-[#64748b]'
                                                                                    }`}
                                                                                >
                                                                                    <Percent className="w-3 h-3" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => onUpdateMilestone(goal.id, milestone.id, { isPercentage: false })}
                                                                                    className={`px-3 py-2 flex items-center gap-1 text-sm ${
                                                                                        !milestone.isPercentage
                                                                                            ? 'bg-[#667eea] text-white'
                                                                                            : 'bg-white dark:bg-[#1B1C1D] text-[#64748b]'
                                                                                    }`}
                                                                                >
                                                                                    <Hash className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                            <span className="text-sm text-[#64748b]">
                                                                                {milestone.isPercentage ? 'del total' : 'unidades'}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Notification */}
                                                                    <div>
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <label className="flex items-center gap-2 text-sm font-medium text-[#64748b] dark:text-[#94a3b8]">
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
                                                                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-[#667eea]"></div>
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
                                                                                className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                                            />
                                                                        )}
                                                                    </div>

                                                                    {/* Timer Bonus */}
                                                                    <div>
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <label className="flex items-center gap-2 text-sm font-medium text-[#64748b] dark:text-[#94a3b8]">
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
                                                                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-[#667eea]"></div>
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
                                                                                    className="w-24 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] text-center"
                                                                                />
                                                                                <span className="text-sm text-[#64748b]">segundos al timer</span>
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
                                        <div className="mt-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                                            <p className="text-xs text-[#94a3b8] mb-2">Vista previa de milestones:</p>
                                            <div className="relative h-8 bg-[#f8fafc] dark:bg-[#262626] rounded-lg overflow-hidden">
                                                {/* Progress bar background */}
                                                <div
                                                    className="absolute h-full bg-[#667eea]/20"
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
                                                                m.completed ? 'bg-green-500' : 'bg-[#667eea]'
                                                            }`}
                                                            style={{ left: `${position}%` }}
                                                            title={`${m.name} (${position}%)`}
                                                        >
                                                            <div className={`absolute -top-1 -left-1.5 w-3 h-3 rounded-full ${
                                                                m.completed ? 'bg-green-500' : 'bg-[#667eea]'
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
