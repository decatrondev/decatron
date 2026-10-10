/**
 * WeightsTab - Tab para configurar pesos/multiplicadores de probabilidad
 */

import React from 'react';
import { Scale, Crown, Star, Clock, Heart, Zap } from 'lucide-react';
import type { GiveawayWeights } from '../../types';

interface WeightsTabProps {
    weights: GiveawayWeights;
    onUpdateWeights: (updates: Partial<GiveawayWeights>) => void;
}

export const WeightsTab: React.FC<WeightsTabProps> = ({ weights, onUpdateWeights }) => {
    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-ds-border">
                <div className="p-3 bg-ds-bg rounded-lg">
                    <Scale className="w-6 h-6 text-ds-soft" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-ds-text">
                        Pesos y Multiplicadores
                    </h2>
                    <p className="text-sm text-ds-soft">
                        Aumenta las probabilidades de ciertos usuarios
                    </p>
                </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-ds-surface border border-ds-border rounded-lg">
                <p className="text-sm text-ds-soft">
                    <strong>¿Cómo funcionan los pesos?</strong><br />
                    Un multiplicador de 2.0x significa que el usuario tiene el doble de probabilidad de ganar.
                    Los multiplicadores se acumulan (Ej: Sub Tier 3 + VIP = 6.0 × 1.5 = 9.0x)
                </p>
            </div>

            {/* Multiplicadores por Suscripción */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Crown className="w-5 h-5 text-ds-accent-text" />
                    Multiplicadores por Suscripción
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Tier 1 */}
                    <div className="p-4 bg-ds-surface rounded-lg border border-ds-border">
                        <div className="flex items-center gap-2 mb-3">
                            <Crown className="w-5 h-5 text-ds-accent-text" />
                            <p className="font-bold text-ds-text">Sub Tier 1</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={100}
                                step={0.1}
                                value={weights.subTier1Multiplier}
                                onChange={(e) => onUpdateWeights({ subTier1Multiplier: parseFloat(e.target.value) || 1 })}
                                className="ds-input flex-1"
                            />
                            <span className="text-ds-accent-text font-bold">×</span>
                        </div>
                    </div>

                    {/* Tier 2 */}
                    <div className="p-4 bg-ds-surface rounded-lg border border-ds-border">
                        <div className="flex items-center gap-2 mb-3">
                            <Crown className="w-5 h-5 text-ds-accent-text" />
                            <p className="font-bold text-ds-text">Sub Tier 2</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={100}
                                step={0.1}
                                value={weights.subTier2Multiplier}
                                onChange={(e) => onUpdateWeights({ subTier2Multiplier: parseFloat(e.target.value) || 1 })}
                                className="ds-input flex-1"
                            />
                            <span className="text-ds-accent-text font-bold">×</span>
                        </div>
                    </div>

                    {/* Tier 3 */}
                    <div className="p-4 bg-ds-surface rounded-lg border border-ds-border">
                        <div className="flex items-center gap-2 mb-3">
                            <Crown className="w-5 h-5 text-ds-accent-text" />
                            <p className="font-bold text-ds-text">Sub Tier 3</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={100}
                                step={0.1}
                                value={weights.subTier3Multiplier}
                                onChange={(e) => onUpdateWeights({ subTier3Multiplier: parseFloat(e.target.value) || 1 })}
                                className="ds-input flex-1"
                            />
                            <span className="text-ds-accent-text font-bold">×</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* VIP Multiplier */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Star className="w-5 h-5 text-ds-accent-text" />
                    Multiplicador VIP
                </h3>

                <div className="p-4 bg-ds-warn/10 rounded-lg border border-ds-warn/40">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-ds-warn">VIP Badge</p>
                            <p className="text-xs text-ds-warn">Multiplicador para usuarios VIP</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={100}
                                step={0.1}
                                value={weights.vipMultiplier}
                                onChange={(e) => onUpdateWeights({ vipMultiplier: parseFloat(e.target.value) || 1 })}
                                className="ds-input w-24"
                            />
                            <span className="text-ds-warn font-bold">×</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Watch Time Multiplier */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Clock className="w-5 h-5 text-ds-accent-text" />
                    Multiplicador por Tiempo Viendo
                </h3>

                <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-bold text-ds-text">Activar Multiplicador por Tiempo</p>
                            <p className="text-xs text-ds-soft">Más tiempo viendo = más probabilidad</p>
                        </div>
                        <button
                            onClick={() => onUpdateWeights({ watchTimeEnabled: !weights.watchTimeEnabled })}
                            className={weights.watchTimeEnabled ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {weights.watchTimeEnabled ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {weights.watchTimeEnabled && (
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">
                                Multiplicador por Hora Viendo
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    step={0.05}
                                    value={weights.watchTimeMultiplierPerHour}
                                    onChange={(e) => onUpdateWeights({ watchTimeMultiplierPerHour: parseFloat(e.target.value) || 1 })}
                                    className="ds-input flex-1"
                                />
                                <span className="text-ds-soft font-bold">× por hora</span>
                            </div>
                            <p className="text-xs text-ds-soft mt-2">
                                Ejemplo: Con 1.1×, alguien viendo 3 horas tendrá 1.331× probabilidad (1.1³)
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Follow Age Multiplier */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Heart className="w-5 h-5 text-ds-accent-text" />
                    Multiplicador por Antigüedad de Follow
                </h3>

                <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-bold text-ds-text">Activar Multiplicador por Follow Age</p>
                            <p className="text-xs text-ds-soft">Más tiempo siguiendo = más probabilidad</p>
                        </div>
                        <button
                            onClick={() => onUpdateWeights({ followAgeEnabled: !weights.followAgeEnabled })}
                            className={weights.followAgeEnabled ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {weights.followAgeEnabled ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {weights.followAgeEnabled && (
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">
                                Multiplicador por Mes Siguiendo
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    max={5}
                                    step={0.01}
                                    value={weights.followAgeMultiplierPerMonth}
                                    onChange={(e) => onUpdateWeights({ followAgeMultiplierPerMonth: parseFloat(e.target.value) || 1 })}
                                    className="ds-input flex-1"
                                />
                                <span className="text-ds-soft font-bold">× por mes</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bits Multiplier */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Zap className="w-5 h-5 text-ds-accent-text" />
                    Multiplicador por Bits Donados
                </h3>

                <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-bold text-ds-text">Activar Multiplicador por Bits</p>
                            <p className="text-xs text-ds-soft">Más bits donados = más probabilidad</p>
                        </div>
                        <button
                            onClick={() => onUpdateWeights({ bitsEnabled: !weights.bitsEnabled })}
                            className={weights.bitsEnabled ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {weights.bitsEnabled ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {weights.bitsEnabled && (
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">
                                Multiplicador por cada 100 Bits
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    step={0.1}
                                    value={weights.bitsMultiplierPer100}
                                    onChange={(e) => onUpdateWeights({ bitsMultiplierPer100: parseFloat(e.target.value) || 1 })}
                                    className="ds-input flex-1"
                                />
                                <span className="text-ds-soft font-bold">× por 100 bits</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sub Streak Multiplier */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Crown className="w-5 h-5 text-ds-accent-text" />
                    Multiplicador por Racha de Suscripción
                </h3>

                <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-bold text-ds-text">Activar Multiplicador por Racha</p>
                            <p className="text-xs text-ds-soft">Más meses suscrito = más probabilidad</p>
                        </div>
                        <button
                            onClick={() => onUpdateWeights({ subStreakEnabled: !weights.subStreakEnabled })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                weights.subStreakEnabled
                                    ? 'bg-ds-warn text-ds-on-accent'
                                    : 'bg-ds-raised text-ds-soft '
                            }`}
                        >
                            {weights.subStreakEnabled ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {weights.subStreakEnabled && (
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">
                                Multiplicador por Mes de Racha
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    max={5}
                                    step={0.01}
                                    value={weights.subStreakMultiplierPerMonth}
                                    onChange={(e) => onUpdateWeights({ subStreakMultiplierPerMonth: parseFloat(e.target.value) || 1 })}
                                    className="ds-input flex-1"
                                />
                                <span className="text-ds-soft font-bold">× por mes</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
