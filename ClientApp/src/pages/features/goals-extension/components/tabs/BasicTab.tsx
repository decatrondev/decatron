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
            <div className="bg-ds-bg border border-ds-border rounded-lg p-4">
                <p className="text-sm text-ds-soft">
                    🎯 Crea y gestiona tus metas aquí. Puedes tener múltiples metas activas simultáneamente.
                    Activa/desactiva metas para controlar cuáles aparecen en el overlay.
                </p>
            </div>

            {/* Add Goal Button */}
            <button
                onClick={handleAddGoal}
                className="ds-btn ds-btn--primary ds-btn--lg w-full"
            >
                <Plus className="w-5 h-5" />
                Crear Nueva Meta
            </button>

            {/* Goals List */}
            {goals.length === 0 ? (
                <div className="bg-ds-surface rounded-lg border border-ds-border p-8 text-center">
                    <Target className="w-16 h-16 mx-auto text-ds-soft mb-4" />
                    <h3 className="text-lg font-semibold text-ds-text mb-2">
                        No hay metas creadas
                    </h3>
                    <p className="text-ds-soft">
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
                                className={`bg-ds-surface rounded-lg border-2 transition-all ${
                                    isActive
                                        ? 'border-ds-accent '
                                        : 'border-ds-border '
                                }`}
                            >
                                {/* Goal Header */}
                                <div className="flex items-center gap-4 p-4">
                                    {/* Drag Handle */}
                                    <div className="cursor-grab text-ds-soft hover:text-ds-soft">
                                        <GripVertical className="w-5 h-5" />
                                    </div>

                                    {/* Icon & Color Indicator */}
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
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
                                                    className="ds-input flex-1"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleSaveName(goal.id)}
                                                    className="p-1 text-ds-ok hover:bg-ds-ok/10 rounded"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={handleCancelEditName}
                                                    className="p-1 text-ds-danger hover:bg-ds-danger/10 rounded"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-ds-text truncate">
                                                    {goal.name}
                                                </h3>
                                                <button
                                                    onClick={() => handleStartEditName(goal)}
                                                    className="p-1 text-ds-soft hover:text-ds-soft hover:bg-ds-bg rounded"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-sm text-ds-soft">
                                            {sourceTypeLabels[goal.type]} • {goal.currentValue}/{goal.targetValue}
                                        </p>
                                    </div>

                                    {/* Progress */}
                                    <div className="hidden sm:block w-32">
                                        <div className="h-2 bg-ds-raised rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{
                                                    width: `${Math.min(100, (goal.currentValue / goal.targetValue) * 100)}%`,
                                                    backgroundColor: goal.color
                                                }}
                                            />
                                        </div>
                                        <p className="text-xs text-center text-ds-soft mt-1">
                                            {Math.round((goal.currentValue / goal.targetValue) * 100)}%
                                        </p>
                                    </div>

                                    {/* Active Toggle */}
                                    <button
                                        onClick={() => onToggleGoalActive(goal.id)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                            isActive
                                                ? 'bg-ds-accent text-ds-on-accent'
                                                : 'bg-ds-bg text-ds-soft'
                                        }`}
                                    >
                                        {isActive ? 'Activa' : 'Inactiva'}
                                    </button>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => onDuplicateGoal(goal.id)}
                                            className="p-2 text-ds-soft hover:text-ds-accent-text hover:bg-ds-bg rounded-lg transition-colors"
                                            title="Duplicar"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteGoal(goal.id)}
                                            className="p-2 text-ds-soft hover:text-ds-danger hover:bg-ds-danger/10 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                                            className="p-2 text-ds-soft hover:text-ds-text hover:bg-ds-bg rounded-lg transition-colors"
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
                                    <div className="border-t border-ds-border p-4 space-y-6">
                                        {/* Type Selection */}
                                        <div>
                                            <label className="block text-sm font-medium text-ds-text mb-2">
                                                Tipo de Meta
                                            </label>
                                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                                {(Object.keys(sourceTypeLabels) as GoalSourceType[]).map((type) => (
                                                    <button
                                                        key={type}
                                                        onClick={() => onUpdateGoal(goal.id, { type })}
                                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                                                            goal.type === type
                                                                ? 'bg-ds-accent text-ds-on-accent border-ds-accent'
                                                                : 'bg-ds-bg text-ds-soft border-transparent hover:border-ds-accent'
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
                                                <label className="block text-sm font-medium text-ds-text mb-2">
                                                    Objetivo
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={goal.targetValue}
                                                    onChange={(e) => onUpdateGoal(goal.id, { targetValue: parseInt(e.target.value) || 1 })}
                                                    className="ds-input w-full"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-ds-text mb-2">
                                                    Valor Actual (para testing)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={goal.currentValue}
                                                    onChange={(e) => onUpdateGoal(goal.id, { currentValue: parseInt(e.target.value) || 0 })}
                                                    className="ds-input w-full"
                                                />
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <label className="block text-sm font-medium text-ds-text mb-2">
                                                Descripción (opcional)
                                            </label>
                                            <input
                                                type="text"
                                                value={goal.description || ''}
                                                onChange={(e) => onUpdateGoal(goal.id, { description: e.target.value })}
                                                placeholder="Ej: Meta para desbloquear el próximo juego"
                                                className="ds-input w-full"
                                            />
                                        </div>

                                        {/* Color & Icon */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-ds-text mb-2">
                                                    Color
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {GOAL_COLORS.map((color) => (
                                                        <button
                                                            key={color.value}
                                                            onClick={() => onUpdateGoal(goal.id, { color: color.value })}
                                                            className={`w-8 h-8 rounded-lg transition-all ${
                                                                goal.color === color.value
                                                                    ? 'ring-2 ring-offset-2 ring-ds-accent'
                                                                    : ''
                                                            }`}
                                                            style={{ backgroundColor: color.value }}
                                                            title={color.name}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-ds-text mb-2">
                                                    Icono
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {GOAL_ICONS.map((icon) => (
                                                        <button
                                                            key={icon}
                                                            onClick={() => onUpdateGoal(goal.id, { icon })}
                                                            className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${
                                                                goal.icon === icon
                                                                    ? 'bg-ds-accent ring-2 ring-offset-2 ring-ds-accent'
                                                                    : 'bg-ds-bg hover:bg-ds-raised '
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
                                                    <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
                                                </label>
                                                <span className="text-sm font-medium text-ds-text">
                                                    Fecha límite
                                                </span>
                                            </div>
                                            {goal.hasDeadline && (
                                                <input
                                                    type="datetime-local"
                                                    value={goal.deadline?.slice(0, 16) || ''}
                                                    onChange={(e) => onUpdateGoal(goal.id, { deadline: new Date(e.target.value).toISOString() })}
                                                    className="ds-input w-full"
                                                />
                                            )}
                                        </div>

                                        {/* On Complete Action */}
                                        <div>
                                            <label className="block text-sm font-medium text-ds-text mb-2">
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
                                                                ? 'bg-ds-accent text-ds-on-accent border-ds-accent'
                                                                : 'bg-ds-bg text-ds-soft border-transparent hover:border-ds-accent'
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
                <div className="bg-ds-bg border border-ds-border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-ds-soft">
                            {goals.length} meta{goals.length !== 1 ? 's' : ''} creada{goals.length !== 1 ? 's' : ''} • {activeGoalIds.length} activa{activeGoalIds.length !== 1 ? 's' : ''}
                        </span>
                        {activeGoalIds.length > 3 && (
                            <span className="text-sm text-ds-warn">
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
