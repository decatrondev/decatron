/**
 * StatePanel - Panel lateral para controlar el giveaway
 */

import React, { useState } from 'react';
import { Play, Square, RotateCcw, X, Trophy, Users, Clock, Sparkles } from 'lucide-react';
import type { GiveawayState, GiveawayConfig } from '../types';

interface StatePanelProps {
    activeState: GiveawayState | null;
    isActive: boolean;
    loading: boolean;
    currentConfig: GiveawayConfig;
    onStart: () => Promise<any>;
    onEnd: () => Promise<any>;
    onCancel: (reason?: string) => Promise<any>;
    onReroll: (position?: number) => Promise<any>;
}

export const StatePanel: React.FC<StatePanelProps> = ({
    activeState,
    isActive,
    loading,
    currentConfig,
    onStart,
    onEnd,
    onCancel,
    onReroll,
}) => {
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const handleStart = async () => {
        setActionLoading(true);
        await onStart();
        setActionLoading(false);
    };

    const handleEnd = async () => {
        if (window.confirm('¿Estás seguro de que quieres finalizar el giveaway y seleccionar ganadores?')) {
            setActionLoading(true);
            await onEnd();
            setActionLoading(false);
        }
    };

    const handleCancel = async () => {
        setActionLoading(true);
        await onCancel(cancelReason || undefined);
        setActionLoading(false);
        setShowCancelModal(false);
        setCancelReason('');
    };

    const handleReroll = async () => {
        if (window.confirm('¿Quieres seleccionar un nuevo ganador?')) {
            setActionLoading(true);
            await onReroll();
            setActionLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-lg overflow-hidden sticky top-6">
            {/* Header */}
            <div className="p-6 bg-slate-800 dark:bg-slate-900 border-b border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-slate-700/50 backdrop-blur rounded-lg">
                        <Sparkles className="w-6 h-6 text-slate-200" />
                    </div>
                    <h3 className="text-xl font-black text-white">Control de Giveaway</h3>
                </div>
                <p className="text-slate-300 text-sm">
                    {isActive ? 'Giveaway en curso' : 'Listo para iniciar'}
                </p>
            </div>

            <div className="p-6 space-y-6">
                {/* Status */}
                {!isActive ? (
                    <div className="text-center py-8">
                        <Trophy className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <p className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                            {currentConfig.name}
                        </p>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-1">
                            Premio: {currentConfig.prizeName}
                        </p>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                            {currentConfig.durationType === 'timed'
                                ? `Duración: ${currentConfig.durationMinutes} min`
                                : 'Duración: Manual'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Active Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                                <div className="flex items-center gap-2 mb-1">
                                    <Users className="w-4 h-4 text-blue-500" />
                                    <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Participantes</p>
                                </div>
                                <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                    {activeState?.totalParticipants || 0}
                                </p>
                            </div>

                            <div className="p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                                <div className="flex items-center gap-2 mb-1">
                                    <Trophy className="w-4 h-4 text-amber-500" />
                                    <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Ganadores</p>
                                </div>
                                <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                    {activeState?.selectedWinners?.length || 0}/{currentConfig.numberOfWinners}
                                </p>
                            </div>
                        </div>

                        {/* Status Badge */}
                        <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                                ✓ Giveaway Activo
                            </p>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                                {activeState?.config.name}
                            </p>
                        </div>

                        {/* Winners List (if any) */}
                        {activeState && activeState.selectedWinners && activeState.selectedWinners.length > 0 && (
                            <div>
                                <p className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                                    Ganadores:
                                </p>
                                <div className="space-y-2">
                                    {activeState.selectedWinners.map((winner) => (
                                        <div
                                            key={winner.position}
                                            className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
                                        >
                                            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                                                #{winner.position} {winner.participant.displayName}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                    {!isActive ? (
                        <button
                            onClick={handleStart}
                            disabled={actionLoading || loading}
                            className="w-full px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-lg transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Play className="w-6 h-6" />
                            {actionLoading ? 'Iniciando...' : 'Iniciar Giveaway'}
                        </button>
                    ) : activeState?.status === 'completed' || activeState?.status === 'cancelled' ? (
                        <div className="text-center py-4">
                            <p className={`text-lg font-bold ${
                                activeState?.status === 'completed' ? 'text-emerald-600' : 'text-red-600'
                            }`}>
                                {activeState?.status === 'completed' ? '✅ Giveaway Completado' : '❌ Giveaway Cancelado'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                {activeState?.status === 'cancelled' ?
                                    'Razón: ' + ((activeState as any).cancelReason || 'No especificada') :
                                    'Puedes crear un nuevo giveaway'
                                }
                            </p>
                        </div>
                    ) : (
                        <>
                            {activeState?.status === 'active' && (
                                <button
                                    onClick={handleEnd}
                                    disabled={actionLoading || loading}
                                    className="w-full px-6 py-4 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-black text-lg transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Square className="w-6 h-6" />
                                    {actionLoading ? 'Finalizando...' : 'Finalizar y Sortear'}
                                </button>
                            )}

                            {activeState?.status === 'selecting_winners' && (
                                <div className="bg-amber-100 dark:bg-amber-900/20 border border-amber-500 rounded-xl p-4 text-center">
                                    <p className="text-amber-700 dark:text-amber-300 font-bold">
                                        ⏳ Esperando respuestas de ganadores...
                                    </p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                        El giveaway se cerrará automáticamente cuando todos respondan o expiren
                                    </p>
                                </div>
                            )}

                            {activeState && activeState.selectedWinners && activeState.selectedWinners.length > 0 && activeState.status === 'selecting_winners' && (
                                <button
                                    onClick={handleReroll}
                                    disabled={actionLoading || loading}
                                    className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                    Re-Sortear Ganador
                                </button>
                            )}

                            {(activeState?.status === 'active' || activeState?.status === 'selecting_winners') && (
                                <button
                                    onClick={() => setShowCancelModal(true)}
                                    disabled={actionLoading || loading}
                                    className="w-full px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <X className="w-5 h-5" />
                                    Cancelar Giveaway
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Info Box */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                        <strong>💡 Tip:</strong><br />
                        {!isActive
                            ? 'Configura todos los parámetros y presiona "Iniciar" para comenzar el sorteo.'
                            : 'El giveaway está activo. Los usuarios pueden participar con el comando configurado.'}
                    </p>
                </div>
            </div>

            {/* Cancel Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                            Cancelar Giveaway
                        </h3>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                            ¿Estás seguro de que quieres cancelar el giveaway? Esta acción no se puede deshacer.
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Razón de cancelación (opcional)
                            </label>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Ej: Problemas técnicos"
                                rows={3}
                                className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] resize-none"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowCancelModal(false);
                                    setCancelReason('');
                                }}
                                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-bold transition-colors"
                            >
                                Volver
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {actionLoading ? 'Cancelando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
