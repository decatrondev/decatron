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
                    <h4 className="text-sm font-bold text-ds-text">Reglas Avanzadas (Tiers)</h4>
                    <p className="text-xs text-ds-soft">
                        Define tiempos especiales cuando se supera cierta cantidad.
                    </p>
                </div>
                
                {!isCreating ? (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-3 py-1.5 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                        <Plus className="w-3 h-3" /> Nueva Regla
                    </button>
                ) : (
                    <div className="flex flex-col gap-2 bg-ds-surface p-3 rounded-lg border border-ds-accent animate-fade-in z-10">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ds-soft w-16">Min {unitLabel}:</span>
                            <input
                                type="number"
                                value={newAmount}
                                onChange={(e) => setNewAmount(Number(e.target.value))}
                                className="w-16 px-2 py-1 text-xs border border-ds-border rounded bg-transparent text-ds-text"
                                autoFocus
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ds-soft w-16">+Tiempo:</span>
                            <input
                                type="number"
                                value={newTimeValue}
                                onChange={(e) => setNewTimeValue(Number(e.target.value))}
                                className="w-12 px-2 py-1 text-xs border border-ds-border rounded bg-transparent text-ds-text"
                            />
                            <select
                                value={newTimeUnit}
                                onChange={(e) => setNewTimeUnit(e.target.value as TimeUnit)}
                                className="px-1 py-1 text-xs border border-ds-border rounded bg-transparent text-ds-text"
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
                                className="rounded text-ds-accent-text"
                            />
                            <span className="text-xs text-ds-soft">
                                Multiplicar por cantidad (x{unitLabel})
                            </span>
                        </div>
                        <div className="flex gap-2 mt-1 justify-end">
                            <button
                                onClick={handleAddRule}
                                className="px-3 py-1 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded text-xs font-bold"
                            >
                                Añadir Regla
                            </button>
                            <button
                                onClick={() => setIsCreating(false)}
                                className="px-3 py-1 bg-ds-raised text-ds-soft rounded text-xs font-bold"
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
                    <div className="p-4 bg-ds-bg rounded-lg border border-dashed border-ds-border flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-ds-soft" />
                        <p className="text-xs text-ds-soft">
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
                            className={`rounded-lg border transition-all ${
                                editingId === rule.id
                                    ? 'bg-ds-surface border-ds-accent ring-1 ring-ds-accent'
                                    : 'bg-ds-bg border-ds-border hover:border-ds-accent '
                            }`}
                        >
                            {/* Header de la Tarjeta */}
                            <div 
                                className="p-3 flex items-center justify-between cursor-pointer"
                                onClick={() => setEditingId(editingId === rule.id ? null : rule.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${rule.isPerUnit ? 'bg-ds-accent/10 ' : 'bg-ds-accent/10 '}`}>
                                        <Clock className={`w-4 h-4 ${rule.isPerUnit ? 'text-ds-accent-text ' : 'text-ds-accent-text '}`} />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-ds-text flex items-center gap-2">
                                            <span>Mínimo {rule.minAmount} {unitLabel}</span>
                                            {rule.exactAmount && (
                                                <span className="px-1.5 py-0.5 bg-ds-warn/10 text-ds-warn text-[10px] rounded border border-ds-warn/40 font-bold">
                                                    EXACTO
                                                </span>
                                            )}
                                        </h5>
                                        <p className="text-xs text-ds-soft flex items-center gap-1">
                                            Añade: <span className="font-mono font-bold text-ds-text">{displayValue} {TIME_UNITS[currentUnit].label}</span>
                                            {rule.isPerUnit ? (
                                                <span className="text-ds-accent-text font-bold ml-1">
                                                    (x cada {unitLabel})
                                                </span>
                                            ) : (
                                                <span className="text-ds-accent-text font-bold ml-1">
                                                    (Fijo / Total)
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteRule(rule.id); }}
                                        className="p-1.5 text-ds-soft hover:text-ds-danger hover:bg-ds-danger/10 rounded transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    {editingId === rule.id ? (
                                        <ChevronUp className="w-4 h-4 text-ds-accent-text" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-ds-soft" />
                                    )}
                                </div>
                            </div>

                            {/* Cuerpo de Edición (Expandido) */}
                            {editingId === rule.id && (
                                <div className="p-4 border-t border-ds-border bg-ds-surface rounded-b-xl space-y-4 animate-fade-in">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Columna 1: Condición */}
                                        <div>
                                            <label className="text-xs font-bold text-ds-soft block mb-1">
                                                Cantidad Mínima ({unitLabel})
                                            </label>
                                            <input
                                                type="number"
                                                value={rule.minAmount}
                                                onChange={(e) => handleUpdateRule(rule.id, { minAmount: Number(e.target.value) })}
                                                className="w-full px-3 py-2 border border-ds-border rounded-lg bg-ds-bg text-sm text-ds-text"
                                            />
                                            <div className="mt-3 space-y-2">
                                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-ds-surface transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={rule.isPerUnit || false}
                                                        onChange={(e) => handleUpdateRule(rule.id, { isPerUnit: e.target.checked })}
                                                        className="rounded text-ds-accent-text focus:ring-ds-accent"
                                                    />
                                                    <div>
                                                        <span className="text-xs font-bold text-ds-text block">
                                                            Modo Multiplicador
                                                        </span>
                                                        <span className="text-[10px] text-ds-soft">
                                                            Multiplica el tiempo por la cantidad (Ej: 10 subs x 2h = 20h)
                                                        </span>
                                                    </div>
                                                </label>

                                                <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-ds-surface transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={rule.exactAmount || false}
                                                        onChange={(e) => handleUpdateRule(rule.id, { exactAmount: e.target.checked })}
                                                        className="mt-1 rounded text-ds-accent-text focus:ring-ds-accent"
                                                    />
                                                    <div>
                                                        <span className="text-xs font-bold text-ds-text block">
                                                            Solo Cantidad Exacta
                                                        </span>
                                                        <span className="text-[10px] text-ds-soft block">
                                                            La regla no se activa si dan más.
                                                        </span>
                                                        {rule.exactAmount && (
                                                            <span className="text-[10px] text-ds-warn font-bold block mt-1">
                                                                ⚠️ CUIDADO: Si donan {rule.minAmount + 1} {unitLabel}, esta regla se IGNORA y el sistema usará el Tiempo Base por Defecto.
                                                            </span>
                                                        )}
                                                    </div>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Columna 2: Resultado */}
                                        <div>
                                            <label className="text-xs font-bold text-ds-soft block mb-1">
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
                                                    className="flex-1 px-3 py-2 border border-ds-border rounded-lg bg-ds-bg text-sm text-ds-text"
                                                />
                                                <select
                                                    value={currentUnit}
                                                    onChange={(e) => {
                                                        const newUnit = e.target.value as TimeUnit;
                                                        const seconds = convertUnitToSeconds(displayValue, newUnit);
                                                        handleUpdateRule(rule.id, { timeAdded: seconds });
                                                    }}
                                                    className="w-24 px-3 py-2 border border-ds-border rounded-lg bg-ds-bg text-sm text-ds-text"
                                                >
                                                    {Object.entries(TIME_UNITS).map(([k, { label }]) => (
                                                        <option key={k} value={k}>{label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            
                                            {/* Preview Calculadora */}
                                            <div className="mt-4 p-3 bg-ds-accent/10 rounded-lg border border-ds-accent">
                                                <p className="text-[10px] uppercase font-bold text-ds-accent-text mb-1">Ejemplo de cálculo</p>
                                                <p className="text-xs text-ds-accent-text">
                                                    Si recibes <strong className={rule.exactAmount ? "text-ds-warn" : ""}>
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
