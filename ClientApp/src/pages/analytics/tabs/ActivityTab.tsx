import { Heart, DollarSign, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ActivityData {
    followers: { date: string; count: number }[];
    tips: { date: string; amount: number }[];
    topTippers?: { name: string; value: number }[];
}

interface DateRange {
    from: Date;
    to: Date;
}

interface ActivityTabProps {
    data?: ActivityData;
    isLoading: boolean;
    dateRange: DateRange;
}

export default function ActivityTab({ data, isLoading, dateRange }: ActivityTabProps) {
    const { t, i18n } = useTranslation('analytics');
    const totalFollowers = data?.followers?.reduce((acc, item) => acc + item.count, 0) || 0;
    const totalTips = data?.tips?.reduce((acc, item) => acc + item.amount, 0) || 0;

    const maxFollowers = Math.max(...(data?.followers?.map(f => f.count) || [1]));
    const maxTips = Math.max(...(data?.tips?.map(t => t.amount) || [1]));

    const locale = i18n.language === 'en' ? 'en-US' : 'es-ES';

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 bg-ds-accent/10 rounded-lg border border-ds-accent">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-ds-accent">
                            <Heart className="w-5 h-5 text-ds-on-accent" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-ds-accent-text uppercase tracking-wider">
                                {t('activity.newFollowers', 'Nuevos Followers')}
                            </p>
                            {isLoading ? (
                                <div className="h-7 w-20 bg-ds-accent/10 rounded animate-pulse mt-1" />
                            ) : (
                                <p className="text-2xl font-black text-ds-text">
                                    {totalFollowers}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-ds-accent/10 rounded-lg border border-ds-accent">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-ds-accent">
                            <DollarSign className="w-5 h-5 text-ds-on-accent" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-ds-accent-text uppercase tracking-wider">
                                {t('activity.totalTips', 'Total Tips')}
                            </p>
                            {isLoading ? (
                                <div className="h-7 w-24 bg-ds-accent/10 rounded animate-pulse mt-1" />
                            ) : (
                                <p className="text-2xl font-black text-ds-text">
                                    ${totalTips.toFixed(2)}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Followers Chart */}
                <div className="bg-ds-bg rounded-lg border border-ds-border p-5">
                    <h3 className="text-sm font-bold text-ds-text mb-4 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-ds-accent-text" />
                        {t('activity.followersPerDay', 'Followers por Día')}
                    </h3>
                    {isLoading ? (
                        <div className="h-48 bg-ds-raised rounded animate-pulse" />
                    ) : data?.followers && data.followers.length > 0 ? (
                        <div className="space-y-2">
                            {data.followers.slice(-7).map((day, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-xs font-mono text-ds-soft w-16">
                                        {new Date(day.date).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                                    </span>
                                    <div className="flex-1 h-6 bg-ds-bg rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-ds-accent rounded-full transition-all duration-500"
                                            style={{ width: `${(day.count / maxFollowers) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-ds-text w-10 text-right">
                                        {day.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-48 flex items-center justify-center">
                            <p className="text-sm text-ds-soft">
                                {t('activity.noFollowers', 'Sin datos de followers en este período')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Tips Chart */}
                <div className="bg-ds-bg rounded-lg border border-ds-border p-5">
                    <h3 className="text-sm font-bold text-ds-text mb-4 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-ds-accent-text" />
                        {t('activity.tipsPerDay', 'Tips por Día')}
                    </h3>
                    {isLoading ? (
                        <div className="h-48 bg-ds-raised rounded animate-pulse" />
                    ) : data?.tips && data.tips.length > 0 ? (
                        <div className="space-y-2">
                            {data.tips.slice(-7).map((day, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-xs font-mono text-ds-soft w-16">
                                        {new Date(day.date).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                                    </span>
                                    <div className="flex-1 h-6 bg-ds-bg rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-ds-accent rounded-full transition-all duration-500"
                                            style={{ width: `${(day.amount / maxTips) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-ds-text w-14 text-right">
                                        ${day.amount.toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-48 flex items-center justify-center">
                            <p className="text-sm text-ds-soft">
                                {t('activity.noTips', 'Sin datos de tips en este período')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Tippers */}
            {data?.topTippers && data.topTippers.length > 0 && (
                <div className="bg-ds-bg rounded-lg border border-ds-border p-5">
                    <h3 className="text-sm font-bold text-ds-text mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-ds-accent-text" />
                        {t('activity.topSupporters', 'Top Supporters')}
                    </h3>
                    <div className="space-y-3">
                        {data.topTippers.map((tipper, i) => {
                            const maxValue = data.topTippers![0].value;
                            const percentage = (tipper.value / maxValue) * 100;

                            return (
                                <div key={i} className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                        i === 0 ? 'bg-ds-accent text-ds-on-accent' :
                                        i === 1 ? 'bg-ds-raised text-ds-soft' :
                                        i === 2 ? 'bg-ds-raised text-ds-soft' :
                                        'bg-ds-bg text-ds-soft '
                                    }`}>
                                        {i + 1}
                                    </span>
                                    <span className="flex-1 text-sm font-medium text-ds-text">
                                        {tipper.name}
                                    </span>
                                    <div className="w-32 h-3 bg-ds-bg rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-ds-accent rounded-full"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-ds-accent-text w-20 text-right">
                                        ${tipper.value.toFixed(2)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
