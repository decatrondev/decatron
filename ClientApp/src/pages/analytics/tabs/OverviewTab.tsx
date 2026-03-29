import { Clock, Shield, Film, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OverviewData {
    totalTimerEvents: number;
    totalTimeAdded: number;
    totalModerationActions: number;
    totalGameChanges: number;
    topEventTypes: { type: string; count: number }[];
    eventsPerDay: { date: string; count: number }[];
}

interface OverviewTabProps {
    data?: OverviewData;
    isLoading: boolean;
}

function formatTime(seconds: number): string {
    if (seconds <= 0) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

function StatCard({
    title,
    value,
    icon: Icon,
    color,
    isLoading
}: {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    isLoading: boolean;
}) {
    const colorClasses: Record<string, string> = {
        blue: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800',
        green: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800',
        purple: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800',
        amber: 'from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800',
    };

    const iconColorClasses: Record<string, string> = {
        blue: 'text-blue-600 dark:text-blue-400',
        green: 'text-green-600 dark:text-green-400',
        purple: 'text-purple-600 dark:text-purple-400',
        amber: 'text-amber-600 dark:text-amber-400',
    };

    return (
        <div className={`p-5 bg-gradient-to-br ${colorClasses[color]} rounded-xl border`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-2">
                        {title}
                    </p>
                    {isLoading ? (
                        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    ) : (
                        <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                            {value}
                        </p>
                    )}
                </div>
                <div className={`p-2.5 rounded-lg bg-white/50 dark:bg-black/20`}>
                    <Icon className={`w-5 h-5 ${iconColorClasses[color]}`} />
                </div>
            </div>
        </div>
    );
}

export default function OverviewTab({ data, isLoading }: OverviewTabProps) {
    const { t, i18n } = useTranslation('analytics');
    const maxCount = Math.max(...(data?.eventsPerDay?.map(e => e.count) || [1]));
    const locale = i18n.language === 'en' ? 'en-US' : 'es-ES';

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title={t('overview.timerEvents', 'Timer Events')}
                    value={data?.totalTimerEvents || 0}
                    icon={Zap}
                    color="blue"
                    isLoading={isLoading}
                />
                <StatCard
                    title={t('overview.timeAdded', 'Tiempo Añadido')}
                    value={formatTime(data?.totalTimeAdded || 0)}
                    icon={Clock}
                    color="green"
                    isLoading={isLoading}
                />
                <StatCard
                    title={t('overview.moderationActions', 'Moderación')}
                    value={data?.totalModerationActions || 0}
                    icon={Shield}
                    color="purple"
                    isLoading={isLoading}
                />
                <StatCard
                    title={t('overview.gameChanges', 'Cambios de Categoría')}
                    value={data?.totalGameChanges || 0}
                    icon={Film}
                    color="amber"
                    isLoading={isLoading}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Events Timeline */}
                <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-5">
                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                        {t('overview.eventsPerDay', 'Eventos por Día')}
                    </h3>
                    {isLoading ? (
                        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    ) : data?.eventsPerDay && data.eventsPerDay.length > 0 ? (
                        <div className="space-y-2">
                            {data.eventsPerDay.slice(-7).map((day, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-xs font-mono text-[#64748b] dark:text-[#94a3b8] w-16">
                                        {new Date(day.date).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                                    </span>
                                    <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                                            style={{ width: `${(day.count / maxCount) * 100}%` }}
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
                                {t('timerEvents.noEvents', 'Sin datos en este período')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Event Types Distribution */}
                <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-5">
                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                        {t('overview.topEventTypes', 'Tipos de Eventos')}
                    </h3>
                    {isLoading ? (
                        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    ) : data?.topEventTypes && data.topEventTypes.length > 0 ? (
                        <div className="space-y-3">
                            {data.topEventTypes.map((event, i) => {
                                const total = data.topEventTypes.reduce((acc, e) => acc + e.count, 0);
                                const percentage = ((event.count / total) * 100).toFixed(1);
                                const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500', 'bg-indigo-500'];

                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${colors[i % colors.length]}`} />
                                        <span className="flex-1 text-sm text-[#1e293b] dark:text-[#f8fafc] capitalize">
                                            {event.type}
                                        </span>
                                        <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                                            {event.count}
                                        </span>
                                        <span className="text-xs text-[#94a3b8] dark:text-[#64748b] w-12 text-right">
                                            {percentage}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-48 flex items-center justify-center">
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                {t('timerEvents.noEvents', 'Sin datos en este período')}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
