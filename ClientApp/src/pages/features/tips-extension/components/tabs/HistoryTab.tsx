/**
 * HistoryTab - Statistics cards, recent tips table, period selector
 */

import React from 'react';
import { TrendingUp, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation('features');

    const formatCurrency = (amount: number) => {
        const curr = CURRENCIES.find(c => c.code === currency);
        return `${curr?.symbol || '$'}${amount.toFixed(2)}`;
    };

    return (
        <>
            {/* Statistics */}
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        {t('tipsTabs.statistics')}
                    </h3>
                    <select
                        value={statsPeriod}
                        onChange={e => setStatsPeriod(e.target.value)}
                        className="px-3 py-1 text-sm border border-ds-border rounded-lg bg-ds-surface"
                    >
                        <option value="today">{t('tipsTabs.periodToday')}</option>
                        <option value="week">{t('tipsTabs.periodWeek')}</option>
                        <option value="month">{t('tipsTabs.periodMonth')}</option>
                        <option value="year">{t('tipsTabs.periodYear')}</option>
                        <option value="">{t('tipsTabs.periodAll')}</option>
                    </select>
                </div>

                {stats ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-ds-ok/10 rounded-lg">
                            <p className="text-xs text-ds-ok font-semibold">{t('tipsTabs.totalRaised')}</p>
                            <p className="text-2xl font-black text-ds-ok">
                                {formatCurrency(stats.totalAmount)}
                            </p>
                        </div>
                        <div className="p-4 bg-ds-accent/10 rounded-lg">
                            <p className="text-xs text-ds-accent-text font-semibold">{t('tipsTabs.donations')}</p>
                            <p className="text-2xl font-black text-ds-accent-text">
                                {stats.totalCount}
                            </p>
                        </div>
                        <div className="p-4 bg-ds-accent/10 rounded-lg">
                            <p className="text-xs text-ds-accent-text font-semibold">{t('tipsTabs.average')}</p>
                            <p className="text-2xl font-black text-ds-accent-text">
                                {formatCurrency(stats.averageAmount)}
                            </p>
                        </div>
                        <div className="p-4 bg-ds-warn/10 rounded-lg">
                            <p className="text-xs text-ds-warn font-semibold">{t('tipsTabs.timeAdded')}</p>
                            <p className="text-2xl font-black text-ds-warn">
                                {stats.formattedTimeAdded}
                            </p>
                        </div>
                    </div>
                ) : (
                    <p className="text-ds-soft text-center py-4">
                        {t('tipsTabs.loadingStats')}
                    </p>
                )}

                {stats?.topDonor && (
                    <div className="mt-4 p-4 bg-ds-warn/10 border border-ds-warn/40 rounded-lg">
                        <p className="text-sm text-ds-warn">
                            <span className="font-bold">{t('tipsTabs.topDonor')}</span> {stats.topDonor} ({formatCurrency(stats.topDonorTotal)})
                        </p>
                    </div>
                )}
            </div>

            {/* Recent Tips */}
            <div className={cardClass}>
                <h3 className="text-lg font-bold text-ds-text mb-4 flex items-center gap-2">
                    <History className="w-5 h-5" />
                    {t('tipsTabs.recentDonations')}
                </h3>

                {recentTips.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {recentTips.map(tip => (
                            <div
                                key={tip.id}
                                className="flex items-center justify-between p-3 bg-ds-bg rounded-lg"
                            >
                                <div>
                                    <p className="font-bold text-ds-text">
                                        {tip.donorName}
                                    </p>
                                    {tip.message && (
                                        <p className="text-sm text-ds-soft truncate max-w-xs">
                                            "{tip.message}"
                                        </p>
                                    )}
                                    <p className="text-xs text-ds-soft">
                                        {new Date(tip.donatedAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-ds-ok">
                                        {formatCurrency(tip.amount)}
                                    </p>
                                    {tip.timeAdded > 0 && (
                                        <p className="text-xs text-ds-accent-text">
                                            +{Math.floor(tip.timeAdded / 60)}m {tip.timeAdded % 60}s
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-ds-soft text-center py-8">
                        {t('tipsTabs.noDonationsYet')}
                    </p>
                )}
            </div>
        </>
    );
};
