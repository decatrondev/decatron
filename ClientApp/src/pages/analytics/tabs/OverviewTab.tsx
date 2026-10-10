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
        blue: 'from-ds-accent/10 to-ds-accent/10 border-ds-accent ',
        green: 'from-ds-accent/10 to-ds-accent/10 border-ds-accent ',
        purple: 'from-ds-accent/10 to-ds-accent/10 border-ds-accent ',
        amber: 'from-ds-accent/10 to-ds-accent/10 border-ds-accent ',
    };

    const iconColorClasses: Record<string, string> = {
        blue: 'text-ds-accent-text ',
        green: 'text-ds-accent-text ',
        purple: 'text-ds-accent-text ',
        amber: 'text-ds-accent-text ',
    };

    return (
        <div className={`p-5 bg-gradient-to-br ${colorClasses[color]} rounded-lg border`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-bold text-ds-soft uppercase tracking-wider mb-2">
                        {title}
                    </p>
                    {isLoading ? (
                        <div className="h-8 w-24 bg-ds-raised rounded animate-pulse" />
                    ) : (
                        <p className="text-2xl font-black text-ds-text">
                            {value}
                        </p>
                    )}
                </div>
                <div className={`p-2.5 rounded-lg bg-ds-surface/50 `}>
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
                <div className="bg-ds-bg rounded-lg border border-ds-border p-5">
                    <h3 className="text-sm font-bold text-ds-text mb-4">
                        {t('overview.eventsPerDay', 'Eventos por Día')}
                    </h3>
                    {isLoading ? (
                        <div className="h-48 bg-ds-raised rounded animate-pulse" />
                    ) : data?.eventsPerDay && data.eventsPerDay.length > 0 ? (
                        <div className="space-y-2">
                            {data.eventsPerDay.slice(-7).map((day, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-xs font-mono text-ds-soft w-16">
                                        {new Date(day.date).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                                    </span>
                                    <div className="flex-1 h-6 bg-ds-bg rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-ds-accent rounded-full transition-all duration-500"
                                            style={{ width: `${(day.count / maxCount) * 100}%` }}
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
                                {t('timerEvents.noEvents', 'Sin datos en este período')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Event Types Distribution */}
                <div className="bg-ds-bg rounded-lg border border-ds-border p-5">
                    <h3 className="text-sm font-bold text-ds-text mb-4">
                        {t('overview.topEventTypes', 'Tipos de Eventos')}
                    </h3>
                    {isLoading ? (
                        <div className="h-48 bg-ds-raised rounded animate-pulse" />
                    ) : data?.topEventTypes && data.topEventTypes.length > 0 ? (
                        <div className="space-y-3">
                            {data.topEventTypes.map((event, i) => {
                                const total = data.topEventTypes.reduce((acc, e) => acc + e.count, 0);
                                const percentage = ((event.count / total) * 100).toFixed(1);
                                const colors = ['bg-ds-accent', 'bg-ds-accent', 'bg-ds-accent', 'bg-ds-warn', 'bg-ds-accent'];

                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${colors[i % colors.length]}`} />
                                        <span className="flex-1 text-sm text-ds-text capitalize">
                                            {event.type}
                                        </span>
                                        <span className="text-xs font-bold text-ds-soft">
                                            {event.count}
                                        </span>
                                        <span className="text-xs text-ds-soft w-12 text-right">
                                            {percentage}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-48 flex items-center justify-center">
                            <p className="text-sm text-ds-soft">
                                {t('timerEvents.noEvents', 'Sin datos en este período')}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
