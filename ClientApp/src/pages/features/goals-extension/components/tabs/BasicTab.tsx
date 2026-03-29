// BasicTab - Create and manage goals

import React, { useState } from 'react';
import { Plus, Trash2, Copy, GripVertical, Target, ChevronDown, ChevronUp, Edit3, Check, X } from 'lucide-react';
import type { Goal, GoalSourceType } from '../../types';
import { GOAL_COLORS, GOAL_ICONS } from '../../constants/defaults';

interface BasicTabProps {
    goals: Goal[];
    activeGoalIds: string[];
    onAddGoal: (goal?: Partial<Goal>) => string;
    onUpdateGoal: (goalId: string, updates: Partial<Goal>) => void;
    onDeleteGoal: (goalId: string) => void;
    onDuplicateGoal: (goalId: string) => void;
    onToggleGoalActive: (goalId: string) => void;
}

export const BasicTab: React.FC<BasicTabProps> = ({
    goals,
    activeGoalIds,
    onAddGoal,
    onUpdateGoal,
    onDeleteGoal,
    onDuplicateGoal,
    onToggleGoalActive
}) => {
    const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const sourceTypeLabels: Record<GoalSourceType, string> = {
        subs: '📺 Suscriptores',
        bits: '💎 Bits',
        follows: '👥 Seguidores',
        raids: '🚀 Raids',
        combined: '🔗 Combinada'
    };

    const handleAddGoal = () => {
        const id = onAddGoal();
        setExpandedGoalId(id);
    };

    const handleStartEditName = (goal: Goal) => {
        setEditingNameId(goal.id);
        setEditingName(goal.name);
    };

    const handleSaveName = (goalId: string) => {
        if (editingName.trim()) {
            onUpdateGoal(goalId, { name: editingName.trim() });
        }
        setEditingNameId(null);
        setEditingName('');
    };

    const handleCancelEditName = () => {
        setEditingNameId(null);
        setEditingName('');
    };

    const handleDeleteGoal = (goalId: string) => {
        if (window.confirm('¿Estás seguro de eliminar esta meta?')) {
            onDeleteGoal(goalId);
            if (expandedGoalId === goalId) {
                setExpandedGoalId(null);
            }
        }
    };

    return (
        <div className="space-y-6">
            {/* Info Card */}
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                    🎯 Crea y gestiona tus metas aquí. Puedes tener múltiples metas activas simultáneamente.
                    Activa/desactiva metas para controlar cuáles aparecen en el overlay.
                </p>
            </div>

            {/* Add Goal Button */}
            <button
                onClick={handleAddGoal}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#5a6fd6] hover:to-[#6a4190] text-white font-semibold rounded-2xl transition-all shadow-lg hover:shadow-xl"
            >
                <Plus className="w-5 h-5" />
                Crear Nueva Meta
            </button>

            {/* Goals List */}
            {goals.length === 0 ? (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-8 text-center">
                    <Target className="w-16 h-16 mx-auto text-[#64748b] dark:text-[#94a3b8] mb-4" />
                    <h3 className="text-lg font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                        No hay metas creadas
                    </h3>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">
                        Crea tu primera meta para comenzar a trackear el progreso de tu stream.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {goals.map((goal) => {
                        const isExpanded = expandedGoalId === goal.id;
                        const isActive = activeGoalIds.includes(goal.id);
                        const isEditingName = editingNameId === goal.id;

                        return (
                            <div
                                key={goal.id}
                                className={`bg-white dark:bg-[#1B1C1D] rounded-2xl border-2 transition-all ${
                                    isActive
                                        ? 'border-[#667eea] shadow-lg'
                                        : 'border-[#e2e8f0] dark:border-[#374151]'
                                }`}
                            >
                                {/* Goal Header */}
                                <div className="flex items-center gap-4 p-4">
                                    {/* Drag Handle */}
                                    <div className="cursor-grab text-[#94a3b8] hover:text-[#64748b]">
                                        <GripVertical className="w-5 h-5" />
                                    </div>

                                    {/* Icon & Color Indicator */}
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                                        style={{ backgroundColor: `${goal.color}20`, color: goal.color }}
                                    >
                                        {goal.icon || '🎯'}
                                    </div>

                                    {/* Name */}
                                    <div className="flex-1 min-w-0">
                                        {isEditingName ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveName(goal.id);
                                                        if (e.key === 'Escape') handleCancelEditName();
                                                    }}
                                                    className="flex-1 px-3 py-1 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#667eea]"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleSaveName(goal.id)}
                                                    className="p-1 text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={handleCancelEditName}
                                                    className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-[#1e293b] dark:text-[#f8fafc] truncate">
                                                    {goal.name}
                                                </h3>
                                                <button
                                                    onClick={() => handleStartEditName(goal)}
                                                    className="p-1 text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f8fafc] dark:hover:bg-[#262626] rounded"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                            {sourceTypeLabels[goal.type]} • {goal.currentValue}/{goal.targetValue}
                                        </p>
                                    </div>

                                    {/* Progress */}
                                    <div className="hidden sm:block w-32">
                                        <div className="h-2 bg-[#e2e8f0] dark:bg-[#374151] rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{
                                                    width: `${Math.min(100, (goal.currentValue / goal.targetValue) * 100)}%`,
                                                    backgroundColor: goal.color
                                                }}
                                            />
                                        </div>
                                        <p className="text-xs text-center text-[#64748b] mt-1">
                                            {Math.round((goal.currentValue / goal.targetValue) * 100)}%
                                        </p>
                                    </div>

                                    {/* Active Toggle */}
                                    <button
                                        onClick={() => onToggleGoalActive(goal.id)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                            isActive
                                                ? 'bg-[#667eea] text-white'
                                                : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b]'
                                        }`}
                                    >
                                        {isActive ? 'Activa' : 'Inactiva'}
                                    </button>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => onDuplicateGoal(goal.id)}
                                            className="p-2 text-[#64748b] hover:text-[#667eea] hover:bg-[#f8fafc] dark:hover:bg-[#262626] rounded-lg transition-colors"
                                            title="Duplicar"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteGoal(goal.id)}
                                            className="p-2 text-[#64748b] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                                            className="p-2 text-[#64748b] hover:text-[#1e293b] dark:hover:text-[#f8fafc] hover:bg-[#f8fafc] dark:hover:bg-[#262626] rounded-lg transition-colors"
                                        >
                                            {isExpanded ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="border-t border-[#e2e8f0] dark:border-[#374151] p-4 space-y-6">
                                        {/* Type Selection */}
                                        <div>
                                            <label className="block text-sm font-medium text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                                Tipo de Meta
                                            </label>
                                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                                {(Object.keys(sourceTypeLabels) as GoalSourceType[]).map((type) => (
                                                    <button
                                                        key={type}
                                                        onClick={() => onUpdateGoal(goal.id, { type })}
                                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                                                            goal.type === type
                                                                ? 'bg-[#667eea] text-white border-[#667eea]'
                                                                : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] border-transparent hover:border-[#667eea]'
                                                        }`}
                                                    >
                                                        {sourceTypeLabels[type]}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Target Value */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                                    Objetivo
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={goal.targetValue}
                                                    onChange={(e) => onUpdateGoal(goal.id, { targetValue: parseInt(e.target.value) || 1 })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#667eea]"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                                    Valor Actual (para testing)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={goal.currentValue}
                                                    onChange={(e) => onUpdateGoal(goal.id, { currentValue: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#667eea]"
                                                />
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <label className="block text-sm font-medium text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                                Descripción (opcional)
                                            </label>
                                            <input
                                                type="text"
                                                value={goal.description || ''}
                                                onChange={(e) => onUpdateGoal(goal.id, { description: e.target.value })}
                                                placeholder="Ej: Meta para desbloquear el próximo juego"
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#667eea]"
                                            />
                                        </div>

                                        {/* Color & Icon */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                                    Color
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {GOAL_COLORS.map((color) => (
                                                        <button
                                                            key={color.value}
                                                            onClick={() => onUpdateGoal(goal.id, { color: color.value })}
                                                            className={`w-8 h-8 rounded-lg transition-all ${
                                                                goal.color === color.value
                                                                    ? 'ring-2 ring-offset-2 ring-[#667eea]'
                                                                    : ''
                                                            }`}
                                                            style={{ backgroundColor: color.value }}
                                                            title={color.name}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                                    Icono
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {GOAL_ICONS.map((icon) => (
                                                        <button
                                                            key={icon}
                                                            onClick={() => onUpdateGoal(goal.id, { icon })}
                                                            className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${
                                                                goal.icon === icon
                                                                    ? 'bg-[#667eea] ring-2 ring-offset-2 ring-[#667eea]'
                                                                    : 'bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                                            }`}
                                                        >
                                                            {icon}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Deadline */}
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={goal.hasDeadline}
                                                        onChange={(e) => onUpdateGoal(goal.id, { hasDeadline: e.target.checked })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#667eea]"></div>
                                                </label>
                                                <span className="text-sm font-medium text-[#1e293b] dark:text-[#f8fafc]">
                                                    Fecha límite
                                                </span>
                                            </div>
                                            {goal.hasDeadline && (
                                                <input
                                                    type="datetime-local"
                                                    value={goal.deadline?.slice(0, 16) || ''}
                                                    onChange={(e) => onUpdateGoal(goal.id, { deadline: new Date(e.target.value).toISOString() })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#667eea]"
                                                />
                                            )}
                                        </div>

                                        {/* On Complete Action */}
                                        <div>
                                            <label className="block text-sm font-medium text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                                Al Completar
                                            </label>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {[
                                                    { value: 'nothing', label: 'No hacer nada' },
                                                    { value: 'reset', label: 'Reiniciar a 0' },
                                                    { value: 'deactivate', label: 'Desactivar' },
                                                    { value: 'next', label: 'Siguiente meta' }
                                                ].map((action) => (
                                                    <button
                                                        key={action.value}
                                                        onClick={() => onUpdateGoal(goal.id, {
                                                            onComplete: { ...goal.onComplete, action: action.value as any }
                                                        })}
                                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                                                            goal.onComplete.action === action.value
                                                                ? 'bg-[#667eea] text-white border-[#667eea]'
                                                                : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] border-transparent hover:border-[#667eea]'
                                                        }`}
                                                    >
                                                        {action.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Summary */}
            {goals.length > 0 && (
                <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {goals.length} meta{goals.length !== 1 ? 's' : ''} creada{goals.length !== 1 ? 's' : ''} • {activeGoalIds.length} activa{activeGoalIds.length !== 1 ? 's' : ''}
                        </span>
                        {activeGoalIds.length > 3 && (
                            <span className="text-sm text-yellow-600 dark:text-yellow-400">
                                ⚠️ Recomendamos máximo 3 metas activas
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BasicTab;
