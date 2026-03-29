/**
 * HistoryTab - Tab para ver el historial de giveaways
 */

import React, { useState, useEffect } from 'react';
import { History, Download, Trash2, Trophy, Users, Clock, TrendingUp } from 'lucide-react';
import type { GiveawayHistoryEntry, GiveawayStatistics } from '../../types';

interface HistoryTabProps {
    onLoadHistory: (limit: number) => Promise<GiveawayHistoryEntry[]>;
    onLoadStatistics: () => Promise<GiveawayStatistics | null>;
    onDeleteEntry: (id: string) => Promise<any>;
    onExportHistory: (format: 'csv' | 'json') => Promise<any>;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
    onLoadHistory,
    onLoadStatistics,
    onDeleteEntry,
    onExportHistory,
}) => {
    const [history, setHistory] = useState<GiveawayHistoryEntry[]>([]);
    const [statistics, setStatistics] = useState<GiveawayStatistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [historyData, statsData] = await Promise.all([
            onLoadHistory(50),
            onLoadStatistics(),
        ]);
        setHistory(historyData);
        setStatistics(statsData);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar esta entrada?')) {
            const result = await onDeleteEntry(id);
            if (result.success) {
                setHistory(history.filter((entry) => entry.id !== id));
            }
        }
    };

    const handleExport = async (format: 'csv' | 'json') => {
        await onExportHistory(format);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">Cargando historial...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Statistics Cards */}
            {statistics && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Total Giveaways */}
                    <div className="bg-[#f1f5f9] dark:bg-[#262626] border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-slate-600 dark:text-slate-400">
                            <Trophy className="w-5 h-5" />
                            <p className="font-bold">Total Giveaways</p>
                        </div>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{statistics.totalGiveaways}</p>
                    </div>

                    {/* Total Participations */}
                    <div className="bg-[#f1f5f9] dark:bg-[#262626] border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400">
                            <Users className="w-5 h-5" />
                            <p className="font-bold">Participaciones</p>
                        </div>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{statistics.totalParticipations}</p>
                    </div>

                    {/* Total Winners */}
                    <div className="bg-[#f1f5f9] dark:bg-[#262626] border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-500">
                            <Trophy className="w-5 h-5" />
                            <p className="font-bold">Ganadores</p>
                        </div>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{statistics.totalWinners}</p>
                    </div>

                    {/* Average Participants */}
                    <div className="bg-[#f1f5f9] dark:bg-[#262626] border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-emerald-600 dark:text-emerald-500">
                            <TrendingUp className="w-5 h-5" />
                            <p className="font-bold">Promedio</p>
                        </div>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{statistics.averageParticipantsPerGiveaway.toFixed(0)}</p>
                    </div>
                </div>
            )}

            {/* Top Winners */}
            {statistics && statistics.topWinners && statistics.topWinners.length > 0 && (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                    <h3 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-amber-500" />
                        Top Ganadores
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {statistics.topWinners.slice(0, 3).map((winner, idx) => (
                            <div
                                key={winner.username}
                                className={`p-4 rounded-xl border ${
                                    idx === 0
                                        ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30'
                                        : idx === 1
                                        ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700'
                                        : 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/30'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{winner.username}</p>
                                    <p className="text-2xl font-black">{winner.winCount}</p>
                                </div>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    {idx === 0 ? '🥇 Primer lugar' : idx === 1 ? '🥈 Segundo lugar' : '🥉 Tercer lugar'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Export Buttons */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">Exportar Historial</h3>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Descarga tu historial en diferentes formatos</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleExport('csv')}
                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-colors flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            CSV
                        </button>
                        <button
                            onClick={() => handleExport('json')}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-colors flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            JSON
                        </button>
                    </div>
                </div>
            </div>

            {/* History List */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <History className="w-6 h-6 text-purple-500" />
                    Historial de Giveaways ({history.length})
                </h3>

                {history.length === 0 ? (
                    <div className="text-center py-12">
                        <Trophy className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-[#64748b] dark:text-[#94a3b8]">No hay giveaways en el historial</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((entry) => (
                            <div
                                key={entry.id}
                                className="border border-[#e2e8f0] dark:border-[#374151] rounded-xl overflow-hidden"
                            >
                                {/* Entry Header */}
                                <div
                                    className="p-4 bg-[#f8fafc] dark:bg-[#262626] cursor-pointer hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors"
                                    onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h4 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                                    {entry.config.name}
                                                </h4>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                    entry.status === 'completed'
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                                }`}>
                                                    {entry.status === 'completed' ? 'Completado' : 'Cancelado'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                                Premio: {entry.config.prizeName}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-6 mr-4">
                                            <div className="text-center">
                                                <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">{entry.totalParticipants}</p>
                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Participantes</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">{entry.winners.length}</p>
                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Ganadores</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">
                                                    {new Date(entry.startedAt).toLocaleDateString()}
                                                </p>
                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                                    {new Date(entry.startedAt).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(entry.id);
                                            }}
                                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedEntry === entry.id && (
                                    <div className="p-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <p className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">Duración</p>
                                                <p className="text-[#1e293b] dark:text-[#f8fafc]">{entry.durationMinutes} minutos</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">Peso Total</p>
                                                <p className="text-[#1e293b] dark:text-[#f8fafc]">{entry.totalWeight.toFixed(2)}×</p>
                                            </div>
                                        </div>

                                        {/* Winners */}
                                        <div>
                                            <p className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">Ganadores:</p>
                                            <div className="space-y-2">
                                                {entry.winners.map((winner, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center gap-3 p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-lg"
                                                    >
                                                        <div className="p-2 bg-yellow-500 text-white rounded-full font-black">
                                                            #{winner.position}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                                                {winner.participant.displayName}
                                                            </p>
                                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                                                @{winner.participant.username}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                                                {winner.participant.calculatedWeight.toFixed(2)}×
                                                            </p>
                                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">peso</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Cancel Reason */}
                                        {entry.status === 'cancelled' && entry.cancelReason && (
                                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                                <p className="text-sm font-bold text-red-700 dark:text-red-300 mb-1">Razón de cancelación:</p>
                                                <p className="text-sm text-red-600 dark:text-red-400">{entry.cancelReason}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
