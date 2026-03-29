/**
 * HistoryTab - Statistics cards, recent tips table, period selector
 */

import React from 'react';
import { TrendingUp, History } from 'lucide-react';
import type { TipStatistics, RecentTip } from '../../types/config';
import { CURRENCIES } from '../../types/config';

interface HistoryTabProps {
    stats: TipStatistics | null;
    recentTips: RecentTip[];
    statsPeriod: string;
    setStatsPeriod: (period: string) => void;
    currency: string;
    cardClass: string;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
    stats,
    recentTips,
    statsPeriod,
    setStatsPeriod,
    currency,
    cardClass,
}) => {
    const formatCurrency = (amount: number) => {
        const curr = CURRENCIES.find(c => c.code === currency);
        return `${curr?.symbol || '$'}${amount.toFixed(2)}`;
    };

    return (
        <>
            {/* Statistics */}
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Estadísticas
                    </h3>
                    <select
                        value={statsPeriod}
                        onChange={e => setStatsPeriod(e.target.value)}
                        className="px-3 py-1 text-sm border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626]"
                    >
                        <option value="today">Hoy</option>
                        <option value="week">Esta semana</option>
                        <option value="month">Este mes</option>
                        <option value="year">Este año</option>
                        <option value="">Todo el tiempo</option>
                    </select>
                </div>

                {stats ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                            <p className="text-xs text-green-600 dark:text-green-400 font-semibold">Total recaudado</p>
                            <p className="text-2xl font-black text-green-700 dark:text-green-300">
                                {formatCurrency(stats.totalAmount)}
                            </p>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Donaciones</p>
                            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">
                                {stats.totalCount}
                            </p>
                        </div>
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                            <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold">Promedio</p>
                            <p className="text-2xl font-black text-purple-700 dark:text-purple-300">
                                {formatCurrency(stats.averageAmount)}
                            </p>
                        </div>
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                            <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold">Tiempo añadido</p>
                            <p className="text-2xl font-black text-orange-700 dark:text-orange-300">
                                {stats.formattedTimeAdded}
                            </p>
                        </div>
                    </div>
                ) : (
                    <p className="text-[#64748b] dark:text-[#94a3b8] text-center py-4">
                        Cargando estadísticas...
                    </p>
                )}

                {stats?.topDonor && (
                    <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            <span className="font-bold">Top donante:</span> {stats.topDonor} ({formatCurrency(stats.topDonorTotal)})
                        </p>
                    </div>
                )}
            </div>

            {/* Recent Tips */}
            <div className={cardClass}>
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Donaciones recientes
                </h3>

                {recentTips.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {recentTips.map(tip => (
                            <div
                                key={tip.id}
                                className="flex items-center justify-between p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-xl"
                            >
                                <div>
                                    <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                        {tip.donorName}
                                    </p>
                                    {tip.message && (
                                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] truncate max-w-xs">
                                            "{tip.message}"
                                        </p>
                                    )}
                                    <p className="text-xs text-[#94a3b8]">
                                        {new Date(tip.donatedAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                        {formatCurrency(tip.amount)}
                                    </p>
                                    {tip.timeAdded > 0 && (
                                        <p className="text-xs text-purple-500">
                                            +{Math.floor(tip.timeAdded / 60)}m {tip.timeAdded % 60}s
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[#64748b] dark:text-[#94a3b8] text-center py-8">
                        Aún no hay donaciones registradas
                    </p>
                )}
            </div>
        </>
    );
};
