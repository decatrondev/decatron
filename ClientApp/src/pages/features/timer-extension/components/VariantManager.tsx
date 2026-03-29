/**
 * Timer Extension - Variant Manager Component
 *
 * Componente para gestionar las variantes (tiers) de alertas.
 * Permite añadir, editar y eliminar reglas específicas (ej: 100 bits, 1000 bits).
 */

import { useState } from 'react';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { MediaEditor } from './MediaEditor';
import type { AlertVariant, TimerEventType } from '../types';

interface VariantManagerProps {
    eventType: TimerEventType;
    variants: AlertVariant[];
    onChange: (variants: AlertVariant[]) => void;
}

export const VariantManager: React.FC<VariantManagerProps> = ({ eventType, variants, onChange }) => {
    // Estado para saber qué variante se está editando (null = ninguna)
    const [editingId, setEditingId] = useState<string | null>(null);

    // Estado temporal para nueva variante
    const [isCreating, setIsCreating] = useState(false);
    const [newVariantThreshold, setNewVariantThreshold] = useState<number>(100);

    // Helpers
    const getUnitLabel = () => {
        if (eventType === 'bits') return 'bits';
        if (eventType === 'raid') return 'viewers';
        if (eventType === 'gift') return 'subs';
        if (eventType === 'hypetrain') return 'nivel';
        if (eventType === 'sub') return 'meses'; // Asumimos meses para subs acumulados
        return 'cantidad';
    };

    const handleAddVariant = () => {
        const newVariant: AlertVariant = {
            id: crypto.randomUUID(),
            enabled: true,
            condition: 'min',
            threshold: newVariantThreshold,
            message: `¡ALERTA ESPECIAL! +{time} por ${newVariantThreshold} ${getUnitLabel()}!`,
            media: {
                enabled: true,
                mode: 'simple',
                simple: { url: '', type: 'audio', volume: 100 }
            },
            useGlobalStyle: true
        };

        const updatedVariants = [...variants, newVariant].sort((a, b) => a.threshold - b.threshold);
        onChange(updatedVariants);
        setIsCreating(false);
        setEditingId(newVariant.id); // Abrir edición inmediatamente
    };

    const handleUpdateVariant = (id: string, updates: Partial<AlertVariant>) => {
        const updatedVariants = variants.map(v => v.id === id ? { ...v, ...updates } : v);
        // Reordenar si cambió el threshold
        if (updates.threshold) {
            updatedVariants.sort((a, b) => a.threshold - b.threshold);
        }
        onChange(updatedVariants);
    };

    const handleDeleteVariant = (id: string) => {
        if (confirm('¿Estás seguro de eliminar esta variante?')) {
            onChange(variants.filter(v => v.id !== id));
        }
    };

    return (
        <div className="space-y-4">
            {/* Header y Botón Añadir */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Lista de Variantes</h4>
                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                        Las reglas se evalúan de mayor a menor cantidad.
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
                    <div className="flex items-center gap-2 bg-white dark:bg-[#262626] p-1.5 rounded-lg border border-blue-200 dark:border-blue-800 animate-fade-in">
                        <span className="text-xs font-bold text-[#64748b] pl-2">Mínimo:</span>
                        <input
                            type="number"
                            value={newVariantThreshold}
                            onChange={(e) => setNewVariantThreshold(Number(e.target.value))}
                            className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-transparent text-[#1e293b] dark:text-[#f8fafc]"
                            autoFocus
                        />
                        <button
                            onClick={handleAddVariant}
                            className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-bold"
                        >
                            Crear
                        </button>
                        <button
                            onClick={() => setIsCreating(false)}
                            className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-bold"
                        >
                            X
                        </button>
                    </div>
                )}
            </div>

            {/* Lista de Variantes */}
            <div className="space-y-3">
                {variants.length === 0 && (
                    <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-dashed border-[#e2e8f0] dark:border-[#374151] text-center">
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                            No hay variantes configuradas. Se usará siempre la alerta por defecto.
                        </p>
                    </div>
                )}

                {variants.map((variant) => (
                    <div 
                        key={variant.id}
                        className={`rounded-xl border transition-all ${
                            editingId === variant.id
                                ? 'bg-white dark:bg-[#1B1C1D] border-blue-500 shadow-md ring-1 ring-blue-500'
                                : 'bg-[#f8fafc] dark:bg-[#262626] border-[#e2e8f0] dark:border-[#374151] hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                    >
                        {/* Header de la Tarjeta */}
                        <div 
                            className="p-3 flex items-center justify-between cursor-pointer"
                            onClick={() => setEditingId(editingId === variant.id ? null : variant.id)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-8 rounded-full ${variant.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                <div>
                                    <h5 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                        Mínimo {variant.threshold} {getUnitLabel()}
                                    </h5>
                                    <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8] truncate max-w-[200px]">
                                        {variant.message}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteVariant(variant.id); }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                {editingId === variant.id ? (
                                    <ChevronUp className="w-4 h-4 text-blue-500" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                            </div>
                        </div>

                        {/* Cuerpo de Edición (Expandido) */}
                        {editingId === variant.id && (
                            <div className="p-4 border-t border-[#e2e8f0] dark:border-[#374151] space-y-4 animate-fade-in">
                                {/* Fila 1: Configuración Básica */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1">
                                            Cantidad Mínima
                                        </label>
                                        <input
                                            type="number"
                                            value={variant.threshold}
                                            onChange={(e) => handleUpdateVariant(variant.id, { threshold: Number(e.target.value) })}
                                            className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-sm"
                                        />
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={variant.enabled}
                                                onChange={(e) => handleUpdateVariant(variant.id, { enabled: e.target.checked })}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                                Variante Activa
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                {/* Fila 2: Mensaje */}
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1">
                                        Mensaje Personalizado
                                    </label>
                                    <input
                                        type="text"
                                        value={variant.message}
                                        onChange={(e) => handleUpdateVariant(variant.id, { message: e.target.value })}
                                        className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-sm"
                                    />
                                </div>

                                {/* Fila 3: Media Editor */}
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Multimedia Específica
                                    </label>
                                    <MediaEditor
                                        config={variant.media}
                                        onChange={(media) => handleUpdateVariant(variant.id, { media })}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
