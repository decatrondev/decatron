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
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-12 shadow-lg text-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-full">
                        <Trophy className="w-16 h-16 text-gray-400 dark:text-gray-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-[#64748b] dark:text-[#94a3b8]">
                        No hay giveaway activo
                    </h3>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">
                        Configura un giveaway y presiona "Iniciar" en el panel lateral
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-slate-800 dark:bg-slate-900 rounded-2xl p-6 shadow-lg text-white border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-black">🎉 {activeState?.config.name}</h2>
                        <p className="text-slate-300 text-lg">Premio: {activeState?.config.prizeName}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-full font-bold ${
                        activeState?.status === 'active' ? 'bg-emerald-600' :
                        activeState?.status === 'selecting_winners' ? 'bg-amber-600' :
                        activeState?.status === 'completed' ? 'bg-green-600' :
                        activeState?.status === 'cancelled' ? 'bg-red-600' :
                        'bg-slate-600'
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
                    <div className="bg-slate-700/50 backdrop-blur rounded-xl p-4 border border-slate-600">
                        <div className="flex items-center gap-2 mb-2 text-slate-300">
                            <Users className="w-5 h-5" />
                            <p className="font-bold">Participantes</p>
                        </div>
                        <p className="text-3xl font-black">{activeState?.totalParticipants || 0}</p>
                    </div>

                    {/* Time Remaining */}
                    {activeState?.config.durationType === 'timed' && (
                        <div className="bg-slate-700/50 backdrop-blur rounded-xl p-4 border border-slate-600">
                            <div className="flex items-center gap-2 mb-2 text-slate-300">
                                <Clock className="w-5 h-5" />
                                <p className="font-bold">Tiempo Restante</p>
                            </div>
                            <p className="text-3xl font-black">{remainingTime}</p>
                        </div>
                    )}

                    {/* Winners */}
                    <div className="bg-slate-700/50 backdrop-blur rounded-xl p-4 border border-slate-600">
                        <div className="flex items-center gap-2 mb-2 text-slate-300">
                            <Trophy className="w-5 h-5" />
                            <p className="font-bold">Ganadores</p>
                        </div>
                        <p className="text-3xl font-black">{activeState?.config.numberOfWinners || 1}</p>
                    </div>
                </div>
            </div>

            {/* Winners Section (if any) */}
            {activeState && activeState.selectedWinners && activeState.selectedWinners.length > 0 && (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                    <h3 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-amber-500" />
                        Ganadores Seleccionados
                    </h3>
                    <div className="space-y-3">
                        {activeState.selectedWinners.map((winner, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800/30"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500 text-white rounded-full font-black text-lg">
                                        #{winner.position}
                                    </div>
                                    <div>
                                        <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-lg">
                                            {winner.participant.displayName}
                                        </p>
                                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                            @{winner.participant.username} • Peso: {winner.participant.calculatedWeight.toFixed(2)}×
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onDisqualify(winner.participant.username)}
                                        className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition-colors"
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
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                        <Users className="w-6 h-6 text-blue-500" />
                        Participantes ({filteredParticipants.length})
                    </h3>

                    {/* Search and Sort */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Buscar usuario..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="px-4 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]"
                        />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="px-4 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]"
                        >
                            <option value="weight">Por Peso</option>
                            <option value="username">Por Nombre</option>
                            <option value="enteredAt">Por Entrada</option>
                        </select>
                        <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="px-4 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg font-bold hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors"
                        >
                            {sortOrder === 'asc' ? '↑' : '↓'}
                        </button>
                    </div>
                </div>

                {/* Participants Table */}
                <div className="overflow-x-auto">
                    <div className="max-h-96 overflow-y-auto">
                        <table className="w-full">
                            <thead className="bg-[#f8fafc] dark:bg-[#262626] sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">#</th>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Usuario</th>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Badges</th>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Peso</th>
                                    <th className="px-4 py-3 text-left text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Hora Entrada</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                                {filteredParticipants.map((participant, idx) => (
                                    <tr key={participant.userId} className="hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors">
                                        <td className="px-4 py-3 text-[#64748b] dark:text-[#94a3b8]">{idx + 1}</td>
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{participant.displayName}</p>
                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">@{participant.username}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1">
                                                {participant.isSubscriber && (
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                        participant.subscriptionTier === 3
                                                            ? 'bg-pink-500 text-white'
                                                            : participant.subscriptionTier === 2
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-purple-500 text-white'
                                                    }`}>
                                                        Tier {participant.subscriptionTier}
                                                    </span>
                                                )}
                                                {participant.isVip && (
                                                    <span className="px-2 py-1 bg-yellow-500 text-white rounded text-xs font-bold">VIP</span>
                                                )}
                                                {participant.isModerator && (
                                                    <span className="px-2 py-1 bg-green-500 text-white rounded text-xs font-bold">MOD</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                                {participant.calculatedWeight.toFixed(2)}×
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">
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
