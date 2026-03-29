/**
 * Timer Extension - Events Tab Component
 *
 * Configuración de tiempo agregado automáticamente por eventos de Twitch.
 * Ahora utiliza el sistema universal de Reglas (Tiers) para todos los eventos.
 */

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { TimeRuleManager } from '../TimeRuleManager';
import type { EventsConfig, TimeUnit, EventRule } from '../../types';
import { TIME_UNITS, convertSecondsToUnit, convertUnitToSeconds } from '../../utils';

interface EventsTabProps {
    eventsConfig: EventsConfig;
    eventTimeUnits: {
        bits: TimeUnit;
        follow: TimeUnit;
        subPrime: TimeUnit;
        subTier1: TimeUnit;
        subTier2: TimeUnit;
        subTier3: TimeUnit;
        giftSub: TimeUnit;
        raidBase: TimeUnit;
        raidPerParticipant: TimeUnit;
        hypeTrain: TimeUnit;
        tips: TimeUnit;
        followCooldown: TimeUnit;
    };
    onEventsConfigChange: (updates: Partial<EventsConfig>) => void;
    onEventTimeUnitsChange: (updates: any) => void;
}

type EventCategory = 'bits' | 'follow' | 'subs' | 'giftSub' | 'raid' | 'hypeTrain' | 'tips';

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#94a3b8] dark:peer-focus:ring-[#64748b] rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#64748b]"></div>
    </label>
);

export const EventsTab: React.FC<EventsTabProps> = ({
    eventsConfig,
    eventTimeUnits,
    onEventsConfigChange,
    onEventTimeUnitsChange
}) => {
    const [selectedCategory, setSelectedCategory] = useState<EventCategory>('bits');
    const [selectedSubTier, setSelectedSubTier] = useState<'subPrime' | 'subTier1' | 'subTier2' | 'subTier3'>('subPrime');

    const categories = [
        { key: 'bits' as EventCategory, icon: '💎', label: 'Bits' },
        { key: 'follow' as EventCategory, icon: '❤️', label: 'Follow' },
        { key: 'subs' as EventCategory, icon: '⭐', label: 'Suscripciones' },
        { key: 'giftSub' as EventCategory, icon: '🎁', label: 'Gift Sub' },
        { key: 'raid' as EventCategory, icon: '🚀', label: 'Raid' },
        { key: 'hypeTrain' as EventCategory, icon: '🔥', label: 'Hype Train' },
        { key: 'tips' as EventCategory, icon: '💰', label: 'Donaciones' }
    ];

    const subTiers = [
        { key: 'subPrime' as const, icon: '👑', label: 'Prime Sub', desc: 'Amazon Prime' },
        { key: 'subTier1' as const, icon: '⭐', label: 'Tier 1', desc: 'Pagada' },
        { key: 'subTier2' as const, icon: '⭐⭐', label: 'Tier 2' },
        { key: 'subTier3' as const, icon: '⭐⭐⭐', label: 'Tier 3' }
    ];

    // Get current event based on selected category
    const getCurrentEventKey = (): keyof EventsConfig => {
        if (selectedCategory === 'subs') return selectedSubTier;
        return selectedCategory as keyof EventsConfig;
    };

    const currentEventKey = getCurrentEventKey();
    const currentEvent = eventsConfig[currentEventKey] as any;
    const currentUnitKey = selectedCategory === 'subs' ? selectedSubTier :
                          selectedCategory === 'raid' ? 'raidBase' :
                          selectedCategory as keyof typeof eventTimeUnits;
    const currentTimeUnit = eventTimeUnits[currentUnitKey];

    // Helper para obtener la etiqueta de unidad correcta para el TimeRuleManager
    const getUnitLabel = (): string => {
        switch (selectedCategory) {
            case 'bits': return 'bits';
            case 'raid': return 'viewers';
            case 'giftSub': return 'subs'; // Cantidad de subs regaladas juntas
            case 'hypeTrain': return 'nivel';
            case 'subs': return 'meses'; // Meses acumulados
            case 'tips': return '$'; // Cantidad en moneda
            default: return 'cantidad';
        }
    };

    // Helper para actualizar reglas
    const handleRulesUpdate = (newRules: EventRule[]) => {
        onEventsConfigChange({
            [currentEventKey]: { ...currentEvent, rules: newRules }
        } as any);
    };

    return (
        <div className="space-y-6">
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                    ℹ️ Configura cuánto tiempo se agregará automáticamente al timer cuando ocurran eventos de Twitch.
                </p>
            </div>

            {/* Event Category Selector */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">🎯 Seleccionar Tipo de Evento</h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {categories.map((category) => (
                        <button
                            key={category.key}
                            onClick={() => setSelectedCategory(category.key)}
                            className={`px-4 py-3 rounded-lg text-sm font-bold transition-all border-2 ${
                                selectedCategory === category.key
                                    ? 'bg-[#64748b] text-white border-[#64748b] shadow-lg'
                                    : 'bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] border-transparent hover:border-[#94a3b8]'
                            }`}
                        >
                            {category.icon} {category.label}
                        </button>
                    ))}
                </div>

                {/* Sub-tier selector for subscriptions */}
                {selectedCategory === 'subs' && (
                    <div className="mt-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-3">
                            Seleccionar Tier de Suscripción:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {subTiers.map((tier) => (
                                <button
                                    key={tier.key}
                                    onClick={() => setSelectedSubTier(tier.key)}
                                    className={`px-3 py-2 rounded text-xs font-bold transition-all border ${
                                        selectedSubTier === tier.key
                                            ? 'bg-[#64748b] text-white border-[#64748b]'
                                            : 'bg-white dark:bg-[#1B1C1D] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151] hover:border-[#94a3b8]'
                                    }`}
                                >
                                    <div>{tier.icon}</div>
                                    <div>{tier.label}</div>
                                    {tier.desc && <div className="text-[10px] opacity-75">{tier.desc}</div>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Event Configuration */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    ⚙️ Configuración para {categories.find(c => c.key === selectedCategory)?.label}
                    {selectedCategory === 'subs' && ` - ${subTiers.find(t => t.key === selectedSubTier)?.label}`}
                </h3>

                <div className="space-y-6">
                    {/* Enable/Disable */}
                    <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] block">
                                Activar Evento
                            </label>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                Agregar tiempo automáticamente cuando ocurra este evento
                            </p>
                        </div>
                        <ToggleSwitch
                            checked={currentEvent.enabled}
                            onChange={(checked) => onEventsConfigChange({ [currentEventKey]: { ...currentEvent, enabled: checked } } as any)}
                        />
                    </div>

                    {currentEvent.enabled && (
                        <>
                            {/* --- CONFIGURACIÓN BASE --- */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        {selectedCategory === 'raid' ? 'Tiempo Base (Mínimo por Raid)' : 
                                         selectedCategory === 'hypeTrain' ? 'Tiempo por Nivel (Base)' :
                                         selectedCategory === 'giftSub' ? 'Tiempo por Sub Regalada (Base)' :
                                         selectedCategory === 'bits' ? 'Tiempo Base (Respaldo Global)' :
                                         'Tiempo a Agregar (Base)'}
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="number"
                                            value={convertSecondsToUnit(currentEvent.time, currentTimeUnit)}
                                            onChange={(e) => {
                                                const newTime = convertUnitToSeconds(Number(e.target.value) || 0, currentTimeUnit);
                                                onEventsConfigChange({ [currentEventKey]: { ...currentEvent, time: newTime } } as any);
                                            }}
                                            className="w-24 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                            min="0"
                                        />
                                        <select
                                            value={currentTimeUnit}
                                            onChange={(e) => onEventTimeUnitsChange({ ...eventTimeUnits, [currentUnitKey]: e.target.value as TimeUnit })}
                                            className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                        >
                                            {Object.entries(TIME_UNITS).map(([k, { label }]) => (
                                                <option key={k} value={k}>{label}</option>
                                            ))}
                                        </select>
                                        
                                        {/* PER BITS CONFIGURATOR */}
                                        {selectedCategory === 'bits' && (
                                            <div className="flex items-center gap-2 ml-2 bg-blue-50 dark:bg-blue-900/40 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
                                                <span className="text-xs font-bold text-blue-800 dark:text-blue-200">por cada</span>
                                                <input
                                                    type="number"
                                                    value={currentEvent.perBits || 100}
                                                    onChange={(e) => {
                                                        const val = Math.max(1, Number(e.target.value));
                                                        onEventsConfigChange({ [currentEventKey]: { ...currentEvent, perBits: val } } as any);
                                                    }}
                                                    className="w-16 px-2 py-1 text-center border border-blue-200 dark:border-blue-700 rounded bg-white dark:bg-black text-sm font-bold text-gray-900 dark:text-white"
                                                    min="1"
                                                />
                                                <span className="text-xs font-bold text-blue-800 dark:text-blue-200">bits</span>
                                            </div>
                                        )}

                                        {/* PER CURRENCY CONFIGURATOR (TIPS) */}
                                        {selectedCategory === 'tips' && (
                                            <div className="flex items-center gap-2 ml-2 bg-green-50 dark:bg-green-900/40 px-3 py-2 rounded-lg border border-green-100 dark:border-green-800">
                                                <span className="text-xs font-bold text-green-800 dark:text-green-200">por cada</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={currentEvent.perCurrency || 1}
                                                    onChange={(e) => {
                                                        const val = Math.max(0.01, Number(e.target.value));
                                                        onEventsConfigChange({ [currentEventKey]: { ...currentEvent, perCurrency: val } } as any);
                                                    }}
                                                    className="w-16 px-2 py-1 text-center border border-green-200 dark:border-green-700 rounded bg-white dark:bg-black text-sm font-bold text-gray-900 dark:text-white"
                                                    min="0.01"
                                                />
                                                <select
                                                    value={currentEvent.currency || 'USD'}
                                                    onChange={(e) => onEventsConfigChange({ [currentEventKey]: { ...currentEvent, currency: e.target.value } } as any)}
                                                    className="px-2 py-1 border border-green-200 dark:border-green-700 rounded bg-white dark:bg-black text-xs font-bold text-gray-900 dark:text-white"
                                                >
                                                    <option value="USD">USD</option>
                                                    <option value="EUR">EUR</option>
                                                    <option value="GBP">GBP</option>
                                                    <option value="MXN">MXN</option>
                                                    <option value="BRL">BRL</option>
                                                    <option value="ARS">ARS</option>
                                                    <option value="CLP">CLP</option>
                                                    <option value="COP">COP</option>
                                                    <option value="PEN">PEN</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8] mt-2">
                                        {selectedCategory === 'bits' 
                                            ? 'Se usa para cualquier donación (min 1) que NO cumpla una Regla Avanzada. Ej: Si tienes regla para 100 bits, esto se usa de 1 a 99.' 
                                            : 'Este tiempo se aplicará SOLO si la donación no cumple ninguna de las reglas especiales de abajo.'}
                                    </p>
                                </div>

                                {/* Opciones específicas adicionales */}
                                {selectedCategory === 'raid' && (
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            Tiempo por Participante
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={convertSecondsToUnit(currentEvent.timePerParticipant, eventTimeUnits.raidPerParticipant)}
                                                onChange={(e) => {
                                                    const newTime = convertUnitToSeconds(Number(e.target.value) || 0, eventTimeUnits.raidPerParticipant);
                                                    onEventsConfigChange({ [currentEventKey]: { ...currentEvent, timePerParticipant: newTime } } as any);
                                                }}
                                                className="w-24 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                                min="0"
                                            />
                                            <select
                                                value={eventTimeUnits.raidPerParticipant}
                                                onChange={(e) => onEventTimeUnitsChange({ ...eventTimeUnits, raidPerParticipant: e.target.value as TimeUnit })}
                                                className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                            >
                                                {Object.entries(TIME_UNITS).map(([k, { label }]) => (
                                                    <option key={k} value={k}>{label}</option>
                                                ))}
                                            </select>
                                            <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">/viewer</span>
                                        </div>
                                    </div>
                                )}

                                {selectedCategory === 'follow' && (
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            🛡️ Anti-Spam Cooldown
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={convertSecondsToUnit(currentEvent.cooldown || 0, eventTimeUnits.followCooldown)}
                                                onChange={(e) => {
                                                    const newTime = convertUnitToSeconds(Number(e.target.value) || 0, eventTimeUnits.followCooldown);
                                                    onEventsConfigChange({ [currentEventKey]: { ...currentEvent, cooldown: newTime } } as any);
                                                }}
                                                className="w-24 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                                min="0"
                                            />
                                            <select
                                                value={eventTimeUnits.followCooldown}
                                                onChange={(e) => onEventTimeUnitsChange({ ...eventTimeUnits, followCooldown: e.target.value as TimeUnit })}
                                                className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                            >
                                                {Object.entries(TIME_UNITS).map(([k, { label }]) => (
                                                    <option key={k} value={k}>{label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* --- SECCIÓN DE REGLAS AVANZADAS (Universal) --- */}
                            {selectedCategory !== 'follow' && (
                                <div className="mt-8 pt-6 border-t border-[#e2e8f0] dark:border-[#374151]">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                            <Layers className="w-4 h-4" /> Reglas Avanzadas para {categories.find(c => c.key === selectedCategory)?.label}
                                        </h4>
                                    </div>

                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4 flex items-start gap-3">
                                        <span className="text-lg">⚠️</span>
                                        <div>
                                            <p className="text-xs font-bold text-amber-800 dark:text-amber-400">
                                                ORDEN DE PRIORIDAD:
                                            </p>
                                            <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                                                1. El sistema busca primero una <strong>Regla Avanzada</strong> que coincida.
                                                <br/>
                                                2. Si encuentra una, el <strong>Tiempo Base</strong> se ignora por completo.
                                                <br/>
                                                3. Si NO encuentra ninguna regla, entonces usa el <strong>Tiempo Base</strong>.
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-gray-50 dark:bg-[#262626]/50 rounded-xl p-4 mb-4 text-xs text-[#64748b] dark:text-[#94a3b8]">
                                        <p>
                                            <strong>¿Cómo funciona?</strong> Puedes definir tiempos especiales cuando se supera cierta cantidad.
                                            El sistema siempre buscará la regla más alta que coincida.
                                        </p>
                                        <ul className="list-disc pl-4 mt-1 space-y-1">
                                            <li>Ej: Si defines "Min 10 subs: 1 hora", al recibir 10 subs se sumará 1 hora exacta en lugar del cálculo base.</li>
                                            <li>Si no hay regla para la cantidad recibida, se usa el cálculo base configurado arriba.</li>
                                        </ul>
                                    </div>

                                    <TimeRuleManager 
                                        rules={currentEvent.rules || []}
                                        onChange={handleRulesUpdate}
                                        unitLabel={getUnitLabel()}
                                        timeUnitConfig={currentTimeUnit}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventsTab;
