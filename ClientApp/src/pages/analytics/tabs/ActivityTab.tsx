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
                <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-blue-500">
                            <Heart className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                                {t('activity.newFollowers', 'Nuevos Followers')}
                            </p>
                            {isLoading ? (
                                <div className="h-7 w-20 bg-blue-200 dark:bg-blue-800 rounded animate-pulse mt-1" />
                            ) : (
                                <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                    {totalFollowers}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-green-500">
                            <DollarSign className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wider">
                                {t('activity.totalTips', 'Total Tips')}
                            </p>
                            {isLoading ? (
                                <div className="h-7 w-24 bg-green-200 dark:bg-green-800 rounded animate-pulse mt-1" />
                            ) : (
                                <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
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
                <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-5">
                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-blue-500" />
                        {t('activity.followersPerDay', 'Followers por Día')}
                    </h3>
                    {isLoading ? (
                        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    ) : data?.followers && data.followers.length > 0 ? (
                        <div className="space-y-2">
                            {data.followers.slice(-7).map((day, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-xs font-mono text-[#64748b] dark:text-[#94a3b8] w-16">
                                        {new Date(day.date).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                                    </span>
                                    <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500"
                                            style={{ width: `${(day.count / maxFollowers) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-[#1e293b] dark:text-[#f8fafc] w-10 text-right">
                                        {day.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-48 flex items-center justify-center">
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                {t('activity.noFollowers', 'Sin datos de followers en este período')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Tips Chart */}
                <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-5">
                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        {t('activity.tipsPerDay', 'Tips por Día')}
                    </h3>
                    {isLoading ? (
                        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    ) : data?.tips && data.tips.length > 0 ? (
                        <div className="space-y-2">
                            {data.tips.slice(-7).map((day, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-xs font-mono text-[#64748b] dark:text-[#94a3b8] w-16">
                                        {new Date(day.date).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                                    </span>
                                    <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
                                            style={{ width: `${(day.amount / maxTips) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-[#1e293b] dark:text-[#f8fafc] w-14 text-right">
                                        ${day.amount.toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-48 flex items-center justify-center">
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                {t('activity.noTips', 'Sin datos de tips en este período')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Tippers */}
            {data?.topTippers && data.topTippers.length > 0 && (
                <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-5">
                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-amber-500" />
                        {t('activity.topSupporters', 'Top Supporters')}
                    </h3>
                    <div className="space-y-3">
                        {data.topTippers.map((tipper, i) => {
                            const maxValue = data.topTippers![0].value;
                            const percentage = (tipper.value / maxValue) * 100;

                            return (
                                <div key={i} className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                        i === 0 ? 'bg-amber-400 text-amber-900' :
                                        i === 1 ? 'bg-gray-300 text-gray-700' :
                                        i === 2 ? 'bg-amber-600 text-amber-100' :
                                        'bg-gray-100 dark:bg-gray-700 text-[#64748b] dark:text-[#94a3b8]'
                                    }`}>
                                        {i + 1}
                                    </span>
                                    <span className="flex-1 text-sm font-medium text-[#1e293b] dark:text-[#f8fafc]">
                                        {tipper.name}
                                    </span>
                                    <div className="w-32 h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-green-600 dark:text-green-400 w-20 text-right">
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
