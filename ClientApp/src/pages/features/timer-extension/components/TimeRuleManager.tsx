/**
 * Timer Extension - Time Rule Manager Component
 *
 * Componente para gestionar las reglas de tiempo (tiers) de eventos.
 * Permite añadir, editar y eliminar reglas específicas (ej: 100 bits -> 5 min).
 */

import { useState } from 'react';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Clock, AlertCircle } from 'lucide-react';
import { TIME_UNITS, convertSecondsToUnit, convertUnitToSeconds } from '../utils';
import type { EventRule, TimeUnit } from '../types';

interface TimeRuleManagerProps {
    rules: EventRule[];
    onChange: (rules: EventRule[]) => void;
    unitLabel: string; // ej: "bits", "meses", "viewers"
    timeUnitConfig?: TimeUnit; // Unidad de tiempo preferida para visualización inicial
}

export const TimeRuleManager: React.FC<TimeRuleManagerProps> = ({ 
    rules, 
    onChange, 
    unitLabel,
    timeUnitConfig = 'minutes'
}) => {
    // Estado para saber qué regla se está editando (null = ninguna)
    const [editingId, setEditingId] = useState<string | null>(null);

    // Estado para creación rápida
    const [isCreating, setIsCreating] = useState(false);
    const [newAmount, setNewAmount] = useState<number>(100);
    const [newTimeValue, setNewTimeValue] = useState<number>(5);
    const [newTimeUnit, setNewTimeUnit] = useState<TimeUnit>('minutes');
    const [newIsPerUnit, setNewIsPerUnit] = useState<boolean>(false);

    // Helper para detectar la mejor unidad de tiempo para una regla existente
    const getBestUnit = (seconds: number): TimeUnit => {
        if (seconds === 0) return 'seconds';
        if (seconds % 3600 === 0) return 'hours';
        if (seconds % 60 === 0) return 'minutes';
        return 'seconds';
    };

    const handleAddRule = () => {
        const seconds = convertUnitToSeconds(newTimeValue, newTimeUnit);
        
        const newRule: EventRule = {
            id: crypto.randomUUID(),
            minAmount: newAmount,
            timeAdded: seconds,
            exactAmount: false,
            isPerUnit: newIsPerUnit
        };

        const updatedRules = [...rules, newRule].sort((a, b) => a.minAmount - b.minAmount);
        onChange(updatedRules);
        
        // Reset y cerrar
        setIsCreating(false);
        setNewAmount(newAmount * 2); // Sugerir el doble para la siguiente
        setEditingId(newRule.id); // Abrir para editar detalles si quiere
        setNewIsPerUnit(false);
    };

    const handleUpdateRule = (id: string, updates: Partial<EventRule>) => {
        const updatedRules = rules.map(r => r.id === id ? { ...r, ...updates } : r);
        // Reordenar si cambió el amount
        if (updates.minAmount) {
            updatedRules.sort((a, b) => a.minAmount - b.minAmount);
        }
        onChange(updatedRules);
    };

    const handleDeleteRule = (id: string) => {
        if (confirm('¿Estás seguro de eliminar esta regla?')) {
            onChange(rules.filter(r => r.id !== id));
        }
    };

    return (
        <div className="space-y-4">
            {/* Header y Botón Añadir */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Reglas Avanzadas (Tiers)</h4>
                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                        Define tiempos especiales cuando se supera cierta cantidad.
                    </p>
                </div>
                
                {!isCreating ? (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                    >
                        <Plus className="w-3 h-3" /> Nueva Regla
                    </button>
                ) : (
                    <div className="flex flex-col gap-2 bg-white dark:bg-[#262626] p-3 rounded-lg border border-blue-200 dark:border-blue-800 animate-fade-in shadow-lg z-10">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#64748b] w-16">Min {unitLabel}:</span>
                            <input
                                type="number"
                                value={newAmount}
                                onChange={(e) => setNewAmount(Number(e.target.value))}
                                className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-transparent text-[#1e293b] dark:text-[#f8fafc]"
                                autoFocus
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#64748b] w-16">+Tiempo:</span>
                            <input
                                type="number"
                                value={newTimeValue}
                                onChange={(e) => setNewTimeValue(Number(e.target.value))}
                                className="w-12 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-transparent text-[#1e293b] dark:text-[#f8fafc]"
                            />
                            <select
                                value={newTimeUnit}
                                onChange={(e) => setNewTimeUnit(e.target.value as TimeUnit)}
                                className="px-1 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-transparent text-[#1e293b] dark:text-[#f8fafc]"
                            >
                                <option value="seconds">s</option>
                                <option value="minutes">m</option>
                                <option value="hours">h</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2 pl-1">
                            <input
                                type="checkbox"
                                checked={newIsPerUnit}
                                onChange={(e) => setNewIsPerUnit(e.target.checked)}
                                className="rounded text-blue-600"
                            />
                            <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                Multiplicar por cantidad (x{unitLabel})
                            </span>
                        </div>
                        <div className="flex gap-2 mt-1 justify-end">
                            <button
                                onClick={handleAddRule}
                                className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-bold"
                            >
                                Añadir Regla
                            </button>
                            <button
                                onClick={() => setIsCreating(false)}
                                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-bold"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Lista de Reglas */}
            <div className="space-y-3">
                {rules.length === 0 && (
                    <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-dashed border-[#e2e8f0] dark:border-[#374151] flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-gray-400" />
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                            No hay reglas especiales. Se usará siempre el cálculo base.
                        </p>
                    </div>
                )}

                {rules.map((rule) => {
                    const currentUnit = getBestUnit(rule.timeAdded);
                    const displayValue = convertSecondsToUnit(rule.timeAdded, currentUnit);

                    return (
                        <div 
                            key={rule.id}
                            className={`rounded-xl border transition-all ${
                                editingId === rule.id
                                    ? 'bg-white dark:bg-[#1B1C1D] border-blue-500 shadow-md ring-1 ring-blue-500'
                                    : 'bg-[#f8fafc] dark:bg-[#262626] border-[#e2e8f0] dark:border-[#374151] hover:border-blue-300 dark:hover:border-blue-700'
                            }`}
                        >
                            {/* Header de la Tarjeta */}
                            <div 
                                className="p-3 flex items-center justify-between cursor-pointer"
                                onClick={() => setEditingId(editingId === rule.id ? null : rule.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${rule.isPerUnit ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                                        <Clock className={`w-4 h-4 ${rule.isPerUnit ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`} />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                            <span>Mínimo {rule.minAmount} {unitLabel}</span>
                                            {rule.exactAmount && (
                                                <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] rounded border border-yellow-200 dark:border-yellow-800 font-bold">
                                                    EXACTO
                                                </span>
                                            )}
                                        </h5>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] flex items-center gap-1">
                                            Añade: <span className="font-mono font-bold text-[#1e293b] dark:text-[#f8fafc]">{displayValue} {TIME_UNITS[currentUnit].label}</span>
                                            {rule.isPerUnit ? (
                                                <span className="text-purple-600 dark:text-purple-400 font-bold ml-1">
                                                    (x cada {unitLabel})
                                                </span>
                                            ) : (
                                                <span className="text-blue-600 dark:text-blue-400 font-bold ml-1">
                                                    (Fijo / Total)
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteRule(rule.id); }}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    {editingId === rule.id ? (
                                        <ChevronUp className="w-4 h-4 text-blue-500" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    )}
                                </div>
                            </div>

                            {/* Cuerpo de Edición (Expandido) */}
                            {editingId === rule.id && (
                                <div className="p-4 border-t border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] rounded-b-xl space-y-4 animate-fade-in">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Columna 1: Condición */}
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1">
                                                Cantidad Mínima ({unitLabel})
                                            </label>
                                            <input
                                                type="number"
                                                value={rule.minAmount}
                                                onChange={(e) => handleUpdateRule(rule.id, { minAmount: Number(e.target.value) })}
                                                className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                            />
                                            <div className="mt-3 space-y-2">
                                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={rule.isPerUnit || false}
                                                        onChange={(e) => handleUpdateRule(rule.id, { isPerUnit: e.target.checked })}
                                                        className="rounded text-purple-600 focus:ring-purple-500"
                                                    />
                                                    <div>
                                                        <span className="text-xs font-bold text-[#1e293b] dark:text-[#f8fafc] block">
                                                            Modo Multiplicador
                                                        </span>
                                                        <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
                                                            Multiplica el tiempo por la cantidad (Ej: 10 subs x 2h = 20h)
                                                        </span>
                                                    </div>
                                                </label>

                                                <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={rule.exactAmount || false}
                                                        onChange={(e) => handleUpdateRule(rule.id, { exactAmount: e.target.checked })}
                                                        className="mt-1 rounded text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <div>
                                                        <span className="text-xs font-bold text-[#1e293b] dark:text-[#f8fafc] block">
                                                            Solo Cantidad Exacta
                                                        </span>
                                                        <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] block">
                                                            La regla no se activa si dan más.
                                                        </span>
                                                        {rule.exactAmount && (
                                                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-1">
                                                                ⚠️ CUIDADO: Si donan {rule.minAmount + 1} {unitLabel}, esta regla se IGNORA y el sistema usará el Tiempo Base por Defecto.
                                                            </span>
                                                        )}
                                                    </div>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Columna 2: Resultado */}
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1">
                                                Tiempo a Añadir {rule.isPerUnit ? '(por unidad)' : '(total)'}
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    value={displayValue}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value) || 0;
                                                        const seconds = convertUnitToSeconds(val, currentUnit);
                                                        handleUpdateRule(rule.id, { timeAdded: seconds });
                                                    }}
                                                    className="flex-1 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                                />
                                                <select
                                                    value={currentUnit}
                                                    onChange={(e) => {
                                                        const newUnit = e.target.value as TimeUnit;
                                                        const seconds = convertUnitToSeconds(displayValue, newUnit);
                                                        handleUpdateRule(rule.id, { timeAdded: seconds });
                                                    }}
                                                    className="w-24 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                                >
                                                    {Object.entries(TIME_UNITS).map(([k, { label }]) => (
                                                        <option key={k} value={k}>{label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            
                                            {/* Preview Calculadora */}
                                            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                                <p className="text-[10px] uppercase font-bold text-blue-500 mb-1">Ejemplo de cálculo</p>
                                                <p className="text-xs text-blue-800 dark:text-blue-300">
                                                    Si recibes <strong className={rule.exactAmount ? "text-amber-600" : ""}>
                                                        {rule.exactAmount ? "EXACTAMENTE" : "AL MENOS"} {rule.minAmount} {unitLabel}
                                                    </strong>:
                                                    <br/>
                                                    Se añadirán <strong className="text-lg">
                                                        {rule.isPerUnit 
                                                            ? `${rule.minAmount * displayValue} ${TIME_UNITS[currentUnit].label}`
                                                            : `${displayValue} ${TIME_UNITS[currentUnit].label}`
                                                        }
                                                    </strong>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
