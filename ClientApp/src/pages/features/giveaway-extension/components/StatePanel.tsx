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
        <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden sticky top-6">
            {/* Header */}
            <div className="p-6 bg-ds-raised border-b border-ds-border">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-ds-raised/50 backdrop-blur rounded-lg">
                        <Sparkles className="w-6 h-6 text-ds-text" />
                    </div>
                    <h3 className="text-xl font-black text-ds-text">Control de Giveaway</h3>
                </div>
                <p className="text-ds-soft text-sm">
                    {isActive ? 'Giveaway en curso' : 'Listo para iniciar'}
                </p>
            </div>

            <div className="p-6 space-y-6">
                {/* Status */}
                {!isActive ? (
                    <div className="text-center py-8">
                        <Trophy className="w-16 h-16 text-ds-soft mx-auto mb-4" />
                        <p className="text-lg font-bold text-ds-text mb-2">
                            {currentConfig.name}
                        </p>
                        <p className="text-sm text-ds-soft mb-1">
                            Premio: {currentConfig.prizeName}
                        </p>
                        <p className="text-xs text-ds-soft">
                            {currentConfig.durationType === 'timed'
                                ? `Duración: ${currentConfig.durationMinutes} min`
                                : 'Duración: Manual'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Active Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-ds-bg rounded-lg border border-ds-border">
                                <div className="flex items-center gap-2 mb-1">
                                    <Users className="w-4 h-4 text-ds-accent-text" />
                                    <p className="text-xs font-bold text-ds-soft">Participantes</p>
                                </div>
                                <p className="text-2xl font-black text-ds-text">
                                    {activeState?.totalParticipants || 0}
                                </p>
                            </div>

                            <div className="p-3 bg-ds-bg rounded-lg border border-ds-border">
                                <div className="flex items-center gap-2 mb-1">
                                    <Trophy className="w-4 h-4 text-ds-accent-text" />
                                    <p className="text-xs font-bold text-ds-soft">Ganadores</p>
                                </div>
                                <p className="text-2xl font-black text-ds-text">
                                    {activeState?.selectedWinners?.length || 0}/{currentConfig.numberOfWinners}
                                </p>
                            </div>
                        </div>

                        {/* Status Badge */}
                        <div className="text-center p-3 bg-ds-ok/10 border border-ds-ok/40 rounded-lg">
                            <p className="text-lg font-black text-ds-ok">
                                ✓ Giveaway Activo
                            </p>
                            <p className="text-xs text-ds-ok mt-1">
                                {activeState?.config.name}
                            </p>
                        </div>

                        {/* Winners List (if any) */}
                        {activeState && activeState.selectedWinners && activeState.selectedWinners.length > 0 && (
                            <div>
                                <p className="text-sm font-bold text-ds-soft mb-2">
                                    Ganadores:
                                </p>
                                <div className="space-y-2">
                                    {activeState.selectedWinners.map((winner) => (
                                        <div
                                            key={winner.position}
                                            className="p-2 bg-ds-warn/10 border border-ds-warn/40 rounded-lg"
                                        >
                                            <p className="text-sm font-bold text-ds-warn">
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
                            className="ds-btn ds-btn--primary ds-btn--lg w-full"
                        >
                            <Play className="w-6 h-6" />
                            {actionLoading ? 'Iniciando...' : 'Iniciar Giveaway'}
                        </button>
                    ) : activeState?.status === 'completed' || activeState?.status === 'cancelled' ? (
                        <div className="text-center py-4">
                            <p className={`text-lg font-bold ${
                                activeState?.status === 'completed' ? 'text-ds-ok' : 'text-ds-danger'
                            }`}>
                                {activeState?.status === 'completed' ? '✅ Giveaway Completado' : '❌ Giveaway Cancelado'}
                            </p>
                            <p className="text-sm text-ds-soft mt-2">
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
                                    className="w-full px-6 py-4 bg-ds-faint hover:bg-ds-raised text-ds-text rounded-lg font-black text-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Square className="w-6 h-6" />
                                    {actionLoading ? 'Finalizando...' : 'Finalizar y Sortear'}
                                </button>
                            )}

                            {activeState?.status === 'selecting_winners' && (
                                <div className="bg-ds-warn/10 border border-ds-warn/40 rounded-lg p-4 text-center">
                                    <p className="text-ds-warn font-bold">
                                        ⏳ Esperando respuestas de ganadores...
                                    </p>
                                    <p className="text-xs text-ds-warn mt-1">
                                        El giveaway se cerrará automáticamente cuando todos respondan o expiren
                                    </p>
                                </div>
                            )}

                            {activeState && activeState.selectedWinners && activeState.selectedWinners.length > 0 && activeState.status === 'selecting_winners' && (
                                <button
                                    onClick={handleReroll}
                                    disabled={actionLoading || loading}
                                    className="w-full px-4 py-3 bg-ds-warn hover:bg-ds-warn text-ds-on-accent rounded-lg font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                    Re-Sortear Ganador
                                </button>
                            )}

                            {(activeState?.status === 'active' || activeState?.status === 'selecting_winners') && (
                                <button
                                    onClick={() => setShowCancelModal(true)}
                                    disabled={actionLoading || loading}
                                    className="ds-btn ds-btn--primary ds-btn--lg w-full"
                                >
                                    <X className="w-5 h-5" />
                                    Cancelar Giveaway
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Info Box */}
                <div className="p-4 bg-ds-surface border border-ds-border rounded-lg">
                    <p className="text-xs text-ds-soft">
                        <strong>💡 Tip:</strong><br />
                        {!isActive
                            ? 'Configura todos los parámetros y presiona "Iniciar" para comenzar el sorteo.'
                            : 'El giveaway está activo. Los usuarios pueden participar con el comando configurado.'}
                    </p>
                </div>
            </div>

            {/* Cancel Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-ds-input/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6 max-w-md w-full">
                        <h3 className="text-xl font-black text-ds-text mb-4">
                            Cancelar Giveaway
                        </h3>
                        <p className="text-sm text-ds-soft mb-4">
                            ¿Estás seguro de que quieres cancelar el giveaway? Esta acción no se puede deshacer.
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-ds-soft mb-2">
                                Razón de cancelación (opcional)
                            </label>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Ej: Problemas técnicos"
                                rows={3}
                                className="ds-input w-full resize-none"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowCancelModal(false);
                                    setCancelReason('');
                                }}
                                className="flex-1 px-4 py-3 bg-ds-raised hover:bg-ds-raised text-ds-text rounded-lg font-bold transition-colors"
                            >
                                Volver
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={actionLoading}
                                className="ds-btn ds-btn--danger ds-btn--lg flex-1"
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
