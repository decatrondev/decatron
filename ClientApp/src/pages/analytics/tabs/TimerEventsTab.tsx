import { useState, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Pagination from '../components/Pagination';

interface TimerEvent {
    id: number;
    eventType: string;
    username: string;
    timeAdded: number;
    details: string;
    occurredAt: string;
}

interface DateRange {
    from: Date;
    to: Date;
}

interface TimerEventsTabProps {
    data?: TimerEvent[];
    isLoading: boolean;
    dateRange: DateRange;
}

const eventTypeColors: Record<string, string> = {
    follow: 'bg-ds-accent/10 text-ds-accent-text ',
    subscribe: 'bg-ds-accent/10 text-ds-accent-text ',
    subscribe_prime: 'bg-ds-bg text-ds-soft ',
    cheer: 'bg-ds-bg text-ds-soft ',
    bits: 'bg-ds-bg text-ds-soft ',
    raid: 'bg-ds-bg text-ds-soft ',
    giftsub: 'bg-ds-accent/10 text-ds-accent-text ',
    tip: 'bg-ds-bg text-ds-soft ',
    command: 'bg-ds-bg text-ds-soft ',
    hypetrain: 'bg-ds-bg text-ds-soft ',
    default: 'bg-ds-bg text-ds-soft '
};

function formatTime(seconds: number): string {
    const sign = seconds < 0 ? '-' : '+';
    const abs = Math.abs(seconds);

    if (abs >= 3600) {
        const hours = Math.floor(abs / 3600);
        const mins = Math.floor((abs % 3600) / 60);
        return `${sign}${hours}h ${mins}m`;
    }
    if (abs >= 60) {
        return `${sign}${Math.floor(abs / 60)}m`;
    }
    return `${sign}${abs}s`;
}

export default function TimerEventsTab({ data, isLoading, dateRange }: TimerEventsTabProps) {
    const { t, i18n } = useTranslation('analytics');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    const getEventLabel = (type: string): string => {
        const labels: Record<string, string> = {
            follow: t('timerEvents.follow', 'Follow'),
            subscribe: t('timerEvents.subscribe', 'Sub'),
            subscribe_prime: t('timerEvents.subscribePrime', 'Prime'),
            cheer: t('timerEvents.cheer', 'Bits'),
            bits: t('timerEvents.cheer', 'Bits'),
            raid: t('timerEvents.raid', 'Raid'),
            giftsub: t('timerEvents.giftsub', 'Gift'),
            tip: t('timerEvents.tip', 'Tip'),
            command: t('timerEvents.command', 'Comando'),
            hypetrain: t('timerEvents.hypetrain', 'Hype Train'),
        };
        return labels[type.toLowerCase()] || type;
    };

    // Stats
    const stats = useMemo(() => {
        if (!data) return { total: 0, byType: {} as Record<string, number> };

        const byType: Record<string, number> = {};
        data.forEach(e => {
            byType[e.eventType] = (byType[e.eventType] || 0) + 1;
        });

        return { total: data.length, byType };
    }, [data]);

    // Pagination
    const totalPages = Math.ceil((data?.length || 0) / itemsPerPage);
    const paginatedData = data?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) || [];

    // Reset page when items per page changes
    const handleItemsPerPageChange = (newItemsPerPage: number) => {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1);
    };

    const locale = i18n.language === 'en' ? 'en-US' : 'es-ES';

    return (
        <div className="space-y-6">
            {/* Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {Object.entries(stats.byType).slice(0, 6).map(([type, count]) => (
                    <div key={type} className="p-3 bg-ds-bg rounded-lg border border-ds-border">
                        <p className="text-xs font-bold text-ds-soft mb-1 capitalize">
                            {getEventLabel(type)}
                        </p>
                        <p className="text-lg font-black text-ds-text">
                            {count}
                        </p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-ds-bg rounded-lg border border-ds-border overflow-hidden">
                <div className="p-4 border-b border-ds-border">
                    <h3 className="text-sm font-bold text-ds-text">
                        {t('timerEvents.historyTitle', 'Historial de Eventos')}
                    </h3>
                    <p className="text-xs text-ds-soft mt-1">
                        {data?.length || 0} {t('timerEvents.eventsInPeriod', 'eventos en el período seleccionado')}
                    </p>
                </div>

                {isLoading ? (
                    <div className="p-4 space-y-2">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-12 bg-ds-raised rounded animate-pulse" />
                        ))}
                    </div>
                ) : paginatedData.length > 0 ? (
                    <>
                        {/* Table Header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-ds-bg text-xs font-bold text-ds-soft uppercase tracking-wider">
                            <div className="col-span-2">{t('timerEvents.date', 'Fecha')}</div>
                            <div className="col-span-2">{t('timerEvents.type', 'Tipo')}</div>
                            <div className="col-span-3">{t('timerEvents.username', 'Usuario')}</div>
                            <div className="col-span-2">{t('timerEvents.time', 'Tiempo')}</div>
                            <div className="col-span-3">{t('timerEvents.details', 'Detalles')}</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-ds-border">
                            {paginatedData.map((event) => (
                                <div key={event.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 hover:bg-ds-surface transition-colors">
                                    {/* Mobile: Date on top */}
                                    <div className="md:hidden flex items-center justify-between">
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${eventTypeColors[event.eventType.toLowerCase()] || eventTypeColors.default}`}>
                                            {getEventLabel(event.eventType)}
                                        </span>
                                        <span className="text-xs text-ds-soft">
                                            {new Date(event.occurredAt).toLocaleString(locale, {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    {/* Desktop: Date */}
                                    <div className="hidden md:block col-span-2 text-sm text-ds-text">
                                        {new Date(event.occurredAt).toLocaleString(locale, {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>

                                    {/* Desktop: Type */}
                                    <div className="hidden md:block col-span-2">
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${eventTypeColors[event.eventType.toLowerCase()] || eventTypeColors.default}`}>
                                            {getEventLabel(event.eventType)}
                                        </span>
                                    </div>

                                    {/* Username */}
                                    <div className="md:col-span-3 text-sm font-semibold text-ds-text">
                                        {event.username}
                                    </div>

                                    {/* Time */}
                                    <div className="md:col-span-2">
                                        <span className={`text-sm font-mono font-bold ${
                                            event.timeAdded >= 0
                                                ? 'text-ds-ok '
                                                : 'text-ds-danger '
                                        }`}>
                                            {formatTime(event.timeAdded)}
                                        </span>
                                    </div>

                                    {/* Details */}
                                    <div className="md:col-span-3 text-sm text-ds-soft truncate">
                                        {event.details || '-'}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={data?.length || 0}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={handleItemsPerPageChange}
                        />
                    </>
                ) : (
                    <div className="p-12 text-center">
                        <Clock className="w-12 h-12 text-ds-soft mx-auto mb-4" />
                        <p className="text-sm text-ds-soft">
                            {t('timerEvents.noEvents', 'No hay eventos en este período')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
