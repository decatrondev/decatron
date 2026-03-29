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
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <Scale className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                        Pesos y Multiplicadores
                    </h2>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                        Aumenta las probabilidades de ciertos usuarios
                    </p>
                </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-xl">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                    <strong>¿Cómo funcionan los pesos?</strong><br />
                    Un multiplicador de 2.0x significa que el usuario tiene el doble de probabilidad de ganar.
                    Los multiplicadores se acumulan (Ej: Sub Tier 3 + VIP = 6.0 × 1.5 = 9.0x)
                </p>
            </div>

            {/* Multiplicadores por Suscripción */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Crown className="w-5 h-5 text-indigo-500" />
                    Multiplicadores por Suscripción
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Tier 1 */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-3">
                            <Crown className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            <p className="font-bold text-slate-900 dark:text-slate-200">Sub Tier 1</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={100}
                                step={0.1}
                                value={weights.subTier1Multiplier}
                                onChange={(e) => onUpdateWeights({ subTier1Multiplier: parseFloat(e.target.value) || 1 })}
                                className="flex-1 px-3 py-2 bg-white dark:bg-[#1B1C1D] border border-slate-300 dark:border-slate-700 rounded-lg text-[#1e293b] dark:text-[#f8fafc] font-bold"
                            />
                            <span className="text-indigo-700 dark:text-indigo-300 font-bold">×</span>
                        </div>
                    </div>

                    {/* Tier 2 */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-3">
                            <Crown className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            <p className="font-bold text-slate-900 dark:text-slate-200">Sub Tier 2</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={100}
                                step={0.1}
                                value={weights.subTier2Multiplier}
                                onChange={(e) => onUpdateWeights({ subTier2Multiplier: parseFloat(e.target.value) || 1 })}
                                className="flex-1 px-3 py-2 bg-white dark:bg-[#1B1C1D] border border-slate-300 dark:border-slate-700 rounded-lg text-[#1e293b] dark:text-[#f8fafc] font-bold"
                            />
                            <span className="text-indigo-700 dark:text-indigo-300 font-bold">×</span>
                        </div>
                    </div>

                    {/* Tier 3 */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-3">
                            <Crown className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            <p className="font-bold text-slate-900 dark:text-slate-200">Sub Tier 3</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={100}
                                step={0.1}
                                value={weights.subTier3Multiplier}
                                onChange={(e) => onUpdateWeights({ subTier3Multiplier: parseFloat(e.target.value) || 1 })}
                                className="flex-1 px-3 py-2 bg-white dark:bg-[#1B1C1D] border border-slate-300 dark:border-slate-700 rounded-lg text-[#1e293b] dark:text-[#f8fafc] font-bold"
                            />
                            <span className="text-indigo-700 dark:text-indigo-300 font-bold">×</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* VIP Multiplier */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    Multiplicador VIP
                </h3>

                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-amber-900 dark:text-amber-200">VIP Badge</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">Multiplicador para usuarios VIP</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={100}
                                step={0.1}
                                value={weights.vipMultiplier}
                                onChange={(e) => onUpdateWeights({ vipMultiplier: parseFloat(e.target.value) || 1 })}
                                className="w-24 px-3 py-2 bg-white dark:bg-[#1B1C1D] border border-amber-300 dark:border-amber-700 rounded-lg text-[#1e293b] dark:text-[#f8fafc] font-bold"
                            />
                            <span className="text-amber-700 dark:text-amber-300 font-bold">×</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Watch Time Multiplier */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    Multiplicador por Tiempo Viendo
                </h3>

                <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Activar Multiplicador por Tiempo</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Más tiempo viendo = más probabilidad</p>
                        </div>
                        <button
                            onClick={() => onUpdateWeights({ watchTimeEnabled: !weights.watchTimeEnabled })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                weights.watchTimeEnabled
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {weights.watchTimeEnabled ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {weights.watchTimeEnabled && (
                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
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
                                    className="flex-1 px-4 py-3 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] font-bold"
                                />
                                <span className="text-[#64748b] dark:text-[#94a3b8] font-bold">× por hora</span>
                            </div>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                                Ejemplo: Con 1.1×, alguien viendo 3 horas tendrá 1.331× probabilidad (1.1³)
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Follow Age Multiplier */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Heart className="w-5 h-5 text-rose-500" />
                    Multiplicador por Antigüedad de Follow
                </h3>

                <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Activar Multiplicador por Follow Age</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Más tiempo siguiendo = más probabilidad</p>
                        </div>
                        <button
                            onClick={() => onUpdateWeights({ followAgeEnabled: !weights.followAgeEnabled })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                weights.followAgeEnabled
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {weights.followAgeEnabled ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {weights.followAgeEnabled && (
                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
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
                                    className="flex-1 px-4 py-3 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] font-bold"
                                />
                                <span className="text-[#64748b] dark:text-[#94a3b8] font-bold">× por mes</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bits Multiplier */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Zap className="w-5 h-5 text-indigo-500" />
                    Multiplicador por Bits Donados
                </h3>

                <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Activar Multiplicador por Bits</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Más bits donados = más probabilidad</p>
                        </div>
                        <button
                            onClick={() => onUpdateWeights({ bitsEnabled: !weights.bitsEnabled })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                weights.bitsEnabled
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {weights.bitsEnabled ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {weights.bitsEnabled && (
                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
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
                                    className="flex-1 px-4 py-3 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] font-bold"
                                />
                                <span className="text-[#64748b] dark:text-[#94a3b8] font-bold">× por 100 bits</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sub Streak Multiplier */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Crown className="w-5 h-5 text-orange-500" />
                    Multiplicador por Racha de Suscripción
                </h3>

                <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Activar Multiplicador por Racha</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Más meses suscrito = más probabilidad</p>
                        </div>
                        <button
                            onClick={() => onUpdateWeights({ subStreakEnabled: !weights.subStreakEnabled })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                weights.subStreakEnabled
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {weights.subStreakEnabled ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {weights.subStreakEnabled && (
                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
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
                                    className="flex-1 px-4 py-3 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] font-bold"
                                />
                                <span className="text-[#64748b] dark:text-[#94a3b8] font-bold">× por mes</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
