/**
 * HistoryTab - Tab para ver el historial de giveaways
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation('features', { keyPrefix: 'giveaway' });
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
        if (window.confirm(t('history.confirmDelete'))) {
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ds-accent mx-auto mb-4"></div>
                    <p className="text-ds-soft">{t('history.loading')}</p>
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
                    <div className="bg-ds-raised border border-ds-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2 text-ds-soft">
                            <Trophy className="w-5 h-5" />
                            <p className="font-bold">{t('history.total')}</p>
                        </div>
                        <p className="text-3xl font-black text-ds-text">{statistics.totalGiveaways}</p>
                    </div>

                    {/* Total Participations */}
                    <div className="bg-ds-raised border border-ds-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2 text-ds-accent-text">
                            <Users className="w-5 h-5" />
                            <p className="font-bold">{t('history.participations')}</p>
                        </div>
                        <p className="text-3xl font-black text-ds-text">{statistics.totalParticipations}</p>
                    </div>

                    {/* Total Winners */}
                    <div className="bg-ds-raised border border-ds-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2 text-ds-warn">
                            <Trophy className="w-5 h-5" />
                            <p className="font-bold">{t('history.winners')}</p>
                        </div>
                        <p className="text-3xl font-black text-ds-text">{statistics.totalWinners}</p>
                    </div>

                    {/* Average Participants */}
                    <div className="bg-ds-raised border border-ds-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2 text-ds-ok">
                            <TrendingUp className="w-5 h-5" />
                            <p className="font-bold">{t('history.average')}</p>
                        </div>
                        <p className="text-3xl font-black text-ds-text">{statistics.averageParticipantsPerGiveaway.toFixed(0)}</p>
                    </div>
                </div>
            )}

            {/* Top Winners */}
            {statistics && statistics.topWinners && statistics.topWinners.length > 0 && (
                <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                    <h3 className="text-xl font-bold text-ds-text mb-4 flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-ds-accent-text" />
                        {t('history.top')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {statistics.topWinners.slice(0, 3).map((winner, idx) => (
                            <div
                                key={winner.username}
                                className={`p-4 rounded-lg border ${
                                    idx === 0
                                        ? 'bg-ds-warn/10 border-ds-warn/40 '
                                        : idx === 1
                                        ? 'bg-ds-surface border-ds-border '
                                        : 'bg-ds-warn/10 border-ds-warn/40 '
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <p className="font-bold text-ds-text">{winner.username}</p>
                                    <p className="text-2xl font-black">{winner.winCount}</p>
                                </div>
                                <p className="text-xs text-ds-soft mt-1">
                                    {idx === 0 ? t('history.first') : idx === 1 ? t('history.second') : t('history.third')}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Export Buttons */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-ds-text">{t('history.export')}</h3>
                        <p className="text-sm text-ds-soft">{t('history.exportHint')}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleExport('csv')}
                            className="ds-btn ds-btn--primary"
                        >
                            <Download className="w-4 h-4" />
                            CSV
                        </button>
                        <button
                            onClick={() => handleExport('json')}
                            className="ds-btn ds-btn--primary"
                        >
                            <Download className="w-4 h-4" />
                            JSON
                        </button>
                    </div>
                </div>
            </div>

            {/* History List */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-xl font-bold text-ds-text mb-4 flex items-center gap-2">
                    <History className="w-6 h-6 text-ds-accent-text" />
                    {t('history.title', { n: history.length })}
                </h3>

                {history.length === 0 ? (
                    <div className="text-center py-12">
                        <Trophy className="w-16 h-16 text-ds-soft mx-auto mb-4" />
                        <p className="text-ds-soft">{t('history.empty')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((entry) => (
                            <div
                                key={entry.id}
                                className="border border-ds-border rounded-lg overflow-hidden"
                            >
                                {/* Entry Header */}
                                <div
                                    className="p-4 bg-ds-bg cursor-pointer hover:bg-ds-raised transition-colors"
                                    onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h4 className="text-lg font-bold text-ds-text">
                                                    {entry.config.name}
                                                </h4>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                    entry.status === 'completed'
                                                        ? 'bg-ds-ok/10 text-ds-ok '
                                                        : 'bg-ds-danger/10 text-ds-danger '
                                                }`}>
                                                    {entry.status === 'completed' ? t('history.done') : t('history.cancelled')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-ds-soft">
                                                {t('history.prize', { name: entry.config.prizeName })}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-6 mr-4">
                                            <div className="text-center">
                                                <p className="text-2xl font-black text-ds-text">{entry.totalParticipants}</p>
                                                <p className="text-xs text-ds-soft">{t('history.participants')}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-black text-ds-text">{entry.winners.length}</p>
                                                <p className="text-xs text-ds-soft">{t('history.winners')}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-ds-soft">
                                                    {new Date(entry.startedAt).toLocaleDateString()}
                                                </p>
                                                <p className="text-xs text-ds-soft">
                                                    {new Date(entry.startedAt).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(entry.id);
                                            }}
                                            className="p-2 text-ds-danger hover:bg-ds-danger/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedEntry === entry.id && (
                                    <div className="p-4 border-t border-ds-border">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <p className="text-sm font-bold text-ds-soft mb-1">{t('history.duration')}</p>
                                                <p className="text-ds-text">{t('history.minutes', { n: entry.durationMinutes })}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-ds-soft mb-1">{t('history.totalWeight')}</p>
                                                <p className="text-ds-text">{entry.totalWeight.toFixed(2)}×</p>
                                            </div>
                                        </div>

                                        {/* Winners */}
                                        <div>
                                            <p className="text-sm font-bold text-ds-soft mb-2">{t('history.winnersColon')}</p>
                                            <div className="space-y-2">
                                                {entry.winners.map((winner, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center gap-3 p-3 bg-ds-bg rounded-lg"
                                                    >
                                                        <div className="p-2 bg-ds-warn text-ds-on-accent rounded-full font-black">
                                                            #{winner.position}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-bold text-ds-text">
                                                                {winner.participant.displayName}
                                                            </p>
                                                            <p className="text-xs text-ds-soft">
                                                                @{winner.participant.username}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-bold text-ds-text">
                                                                {winner.participant.calculatedWeight.toFixed(2)}×
                                                            </p>
                                                            <p className="text-xs text-ds-soft">{t('history.weightWord')}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Cancel Reason */}
                                        {entry.status === 'cancelled' && entry.cancelReason && (
                                            <div className="mt-4 p-3 bg-ds-danger/10 border border-ds-danger/40 rounded-lg">
                                                <p className="text-sm font-bold text-ds-danger mb-1">{t('history.cancelReason')}</p>
                                                <p className="text-sm text-ds-danger">{entry.cancelReason}</p>
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
