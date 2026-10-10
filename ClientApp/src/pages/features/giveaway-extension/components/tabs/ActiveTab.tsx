/**
 * ActiveTab - Tab para ver y controlar el giveaway activo
 */

import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, Users, Trophy, Clock, X } from 'lucide-react';
import type { GiveawayState, GiveawayParticipant } from '../../types';

interface ActiveTabProps {
    activeState: GiveawayState | null;
    isActive: boolean;
    loading: boolean;
    onStart: () => Promise<any>;
    onEnd: () => Promise<any>;
    onCancel: (reason?: string) => Promise<any>;
    onReroll: (position?: number) => Promise<any>;
    onDisqualify: (username: string, reason?: string) => Promise<any>;
}

export const ActiveTab: React.FC<ActiveTabProps> = ({
    activeState,
    isActive,
    loading,
    onStart,
    onEnd,
    onCancel,
    onReroll,
    onDisqualify,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'username' | 'weight' | 'enteredAt'>('weight');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Calculate remaining time
    const [remainingTime, setRemainingTime] = useState<string>('--:--');

    useEffect(() => {
        if (activeState && activeState.endsAt && activeState.config.durationType === 'timed') {
            const interval = setInterval(() => {
                const now = new Date();
                const endsAt = new Date(activeState.endsAt!);
                const diff = endsAt.getTime() - now.getTime();

                if (diff <= 0) {
                    setRemainingTime('00:00');
                } else {
                    const minutes = Math.floor(diff / 60000);
                    const seconds = Math.floor((diff % 60000) / 1000);
                    setRemainingTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
                }
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [activeState]);

    // Filter and sort participants
    const filteredParticipants = activeState?.participants
        ?.filter((p) => p.username.toLowerCase().includes(searchTerm.toLowerCase()) || p.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
        ?.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'username') {
                comparison = a.username.localeCompare(b.username);
            } else if (sortBy === 'weight') {
                comparison = a.calculatedWeight - b.calculatedWeight;
            } else if (sortBy === 'enteredAt') {
                comparison = new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime();
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        }) || [];

    if (!isActive && !activeState) {
        return (
            <div className="bg-ds-surface rounded-lg border border-ds-border p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="p-6 bg-ds-bg rounded-full">
                        <Trophy className="w-16 h-16 text-ds-soft" />
                    </div>
                    <h3 className="text-2xl font-bold text-ds-soft">
                        No hay giveaway activo
                    </h3>
                    <p className="text-ds-soft">
                        Configura un giveaway y presiona "Iniciar" en el panel lateral
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-ds-raised rounded-lg p-6 text-ds-text border border-ds-border">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-black">🎉 {activeState?.config.name}</h2>
                        <p className="text-ds-soft text-lg">Premio: {activeState?.config.prizeName}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-full font-bold ${
                        activeState?.status === 'active' ? 'bg-ds-accent' :
                        activeState?.status === 'selecting_winners' ? 'bg-ds-warn' :
                        activeState?.status === 'completed' ? 'bg-ds-accent' :
                        activeState?.status === 'cancelled' ? 'bg-ds-danger-solid' :
                        'bg-ds-faint'
                    }`}>
                        {activeState?.status === 'active' ? '✓ Activo' :
                         activeState?.status === 'selecting_winners' ? '⏳ Esperando Respuestas' :
                         activeState?.status === 'completed' ? '✅ Completado' :
                         activeState?.status === 'cancelled' ? '❌ Cancelado' :
                         activeState?.status === 'selecting' ? '🎲 Seleccionando' :
                         '⏸️ Pausado'}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Participants */}
                    <div className="bg-ds-raised/50 backdrop-blur rounded-lg p-4 border border-ds-border">
                        <div className="flex items-center gap-2 mb-2 text-ds-soft">
                            <Users className="w-5 h-5" />
                            <p className="font-bold">Participantes</p>
                        </div>
                        <p className="text-3xl font-black">{activeState?.totalParticipants || 0}</p>
                    </div>

                    {/* Time Remaining */}
                    {activeState?.config.durationType === 'timed' && (
                        <div className="bg-ds-raised/50 backdrop-blur rounded-lg p-4 border border-ds-border">
                            <div className="flex items-center gap-2 mb-2 text-ds-soft">
                                <Clock className="w-5 h-5" />
                                <p className="font-bold">Tiempo Restante</p>
                            </div>
                            <p className="text-3xl font-black">{remainingTime}</p>
                        </div>
                    )}

                    {/* Winners */}
                    <div className="bg-ds-raised/50 backdrop-blur rounded-lg p-4 border border-ds-border">
                        <div className="flex items-center gap-2 mb-2 text-ds-soft">
                            <Trophy className="w-5 h-5" />
                            <p className="font-bold">Ganadores</p>
                        </div>
                        <p className="text-3xl font-black">{activeState?.config.numberOfWinners || 1}</p>
                    </div>
                </div>
            </div>

            {/* Winners Section (if any) */}
            {activeState && activeState.selectedWinners && activeState.selectedWinners.length > 0 && (
                <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                    <h3 className="text-xl font-bold text-ds-text mb-4 flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-ds-accent-text" />
                        Ganadores Seleccionados
                    </h3>
                    <div className="space-y-3">
                        {activeState.selectedWinners.map((winner, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between p-4 bg-ds-warn/10 rounded-lg border border-ds-warn/40"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-ds-warn text-ds-on-accent rounded-full font-black text-lg">
                                        #{winner.position}
                                    </div>
                                    <div>
                                        <p className="font-bold text-ds-text text-lg">
                                            {winner.participant.displayName}
                                        </p>
                                        <p className="text-sm text-ds-soft">
                                            @{winner.participant.username} • Peso: {winner.participant.calculatedWeight.toFixed(2)}×
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onDisqualify(winner.participant.username)}
                                        className="px-3 py-2 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg font-bold transition-colors"
                                    >
                                        Descalificar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Participants List */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-ds-text flex items-center gap-2">
                        <Users className="w-6 h-6 text-ds-accent-text" />
                        Participantes ({filteredParticipants.length})
                    </h3>

                    {/* Search and Sort */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Buscar usuario..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="px-4 py-2 bg-ds-bg border border-ds-border rounded-lg text-ds-text"
                        />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="px-4 py-2 bg-ds-bg border border-ds-border rounded-lg text-ds-text"
                        >
                            <option value="weight">Por Peso</option>
                            <option value="username">Por Nombre</option>
                            <option value="enteredAt">Por Entrada</option>
                        </select>
                        <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="px-4 py-2 bg-ds-bg border border-ds-border rounded-lg font-bold hover:bg-ds-raised transition-colors"
                        >
                            {sortOrder === 'asc' ? '↑' : '↓'}
                        </button>
                    </div>
                </div>

                {/* Participants Table */}
                <div className="overflow-x-auto">
                    <div className="max-h-96 overflow-y-auto">
                        <table className="w-full">
                            <thead className="bg-ds-bg sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-ds-soft">#</th>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-ds-soft">Usuario</th>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-ds-soft">Badges</th>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-ds-soft">Peso</th>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-ds-soft">Hora Entrada</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ds-border">
                                {filteredParticipants.map((participant, idx) => (
                                    <tr key={participant.userId} className="hover:bg-ds-bg transition-colors">
                                        <td className="px-4 py-3 text-ds-soft">{idx + 1}</td>
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-ds-text">{participant.displayName}</p>
                                            <p className="text-xs text-ds-soft">@{participant.username}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1">
                                                {participant.isSubscriber && (
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                        participant.subscriptionTier === 3
                                                            ? 'bg-ds-accent text-ds-on-accent'
                                                            : participant.subscriptionTier === 2
                                                            ? 'bg-ds-accent text-ds-on-accent'
                                                            : 'bg-ds-accent text-ds-on-accent'
                                                    }`}>
                                                        Tier {participant.subscriptionTier}
                                                    </span>
                                                )}
                                                {participant.isVip && (
                                                    <span className="px-2 py-1 bg-ds-warn text-ds-on-accent rounded text-xs font-bold">VIP</span>
                                                )}
                                                {participant.isModerator && (
                                                    <span className="px-2 py-1 bg-ds-accent text-ds-on-accent rounded text-xs font-bold">MOD</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-bold text-ds-text">
                                                {participant.calculatedWeight.toFixed(2)}×
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-ds-soft">
                                            {new Date(participant.enteredAt).toLocaleTimeString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
