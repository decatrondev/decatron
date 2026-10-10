import { useState, useMemo } from 'react';
import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Pagination from '../components/Pagination';

interface ModerationLog {
    id: number;
    username: string;
    detectedWord: string;
    severity: string;
    actionTaken: string;
    strikeLevel: number;
    createdAt: string;
}

interface DateRange {
    from: Date;
    to: Date;
}

interface ModerationTabProps {
    data?: ModerationLog[];
    isLoading: boolean;
    dateRange: DateRange;
}

const severityColors: Record<string, string> = {
    leve: 'bg-ds-warn/10 text-ds-warn ',
    medio: 'bg-ds-warn/10 text-ds-warn ',
    severo: 'bg-ds-danger/10 text-ds-danger '
};

const actionColors: Record<string, string> = {
    warn: 'bg-ds-warn/10 text-ds-warn ',
    timeout: 'bg-ds-warn/10 text-ds-warn ',
    ban: 'bg-ds-danger/10 text-ds-danger ',
    delete: 'bg-ds-bg text-ds-soft '
};

export default function ModerationTab({ data, isLoading, dateRange }: ModerationTabProps) {
    const { t, i18n } = useTranslation('analytics');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    // Stats
    const stats = useMemo(() => {
        if (!data) return { total: 0, severe: 0, uniqueWords: 0, topWords: [] as { word: string; count: number }[] };

        const severityCounts = data.reduce((acc, log) => {
            acc[log.severity] = (acc[log.severity] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const wordCounts = data.reduce((acc, log) => {
            const word = log.detectedWord.toLowerCase();
            acc[word] = (acc[word] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topWords = Object.entries(wordCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word, count]) => ({ word, count }));

        return {
            total: data.length,
            severe: severityCounts['severo'] || 0,
            uniqueWords: Object.keys(wordCounts).length,
            topWords
        };
    }, [data]);

    // Pagination
    const totalPages = Math.ceil((data?.length || 0) / itemsPerPage);
    const paginatedData = data?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) || [];

    const handleItemsPerPageChange = (newItemsPerPage: number) => {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1);
    };

    const locale = i18n.language === 'en' ? 'en-US' : 'es-ES';

    return (
        <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 bg-ds-accent/10 rounded-lg border border-ds-accent">
                    <p className="text-xs font-bold text-ds-accent-text uppercase tracking-wider mb-1">
                        {t('moderation.totalActions', 'Total Acciones')}
                    </p>
                    {isLoading ? (
                        <div className="h-8 w-20 bg-ds-accent/10 rounded animate-pulse" />
                    ) : (
                        <p className="text-2xl font-black text-ds-text">{stats.total}</p>
                    )}
                </div>
                <div className="p-5 bg-ds-danger/10 rounded-lg border border-ds-danger/40">
                    <p className="text-xs font-bold text-ds-danger uppercase tracking-wider mb-1">
                        {t('moderation.severeActions', 'Severas')}
                    </p>
                    {isLoading ? (
                        <div className="h-8 w-20 bg-ds-danger/10 rounded animate-pulse" />
                    ) : (
                        <p className="text-2xl font-black text-ds-danger">{stats.severe}</p>
                    )}
                </div>
                <div className="p-5 bg-ds-bg rounded-lg border border-ds-border">
                    <p className="text-xs font-bold text-ds-soft uppercase tracking-wider mb-1">
                        {t('moderation.uniqueWords', 'Palabras Únicas')}
                    </p>
                    {isLoading ? (
                        <div className="h-8 w-20 bg-ds-raised rounded animate-pulse" />
                    ) : (
                        <p className="text-2xl font-black text-ds-text">{stats.uniqueWords}</p>
                    )}
                </div>
            </div>

            {/* Top Words */}
            {stats.topWords.length > 0 && (
                <div className="bg-ds-bg rounded-lg border border-ds-border p-5">
                    <h3 className="text-sm font-bold text-ds-text mb-4">
                        {t('moderation.topWords', 'Top Palabras Detectadas')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {stats.topWords.map(({ word, count }, index) => (
                            <div
                                key={word}
                                className="flex items-center gap-2 px-3 py-1.5 bg-ds-surface rounded-lg border border-ds-border"
                            >
                                <span className="text-xs font-bold text-ds-soft">
                                    #{index + 1}
                                </span>
                                <span className="text-sm font-mono text-ds-text">
                                    {word}
                                </span>
                                <span className="text-xs px-1.5 py-0.5 bg-ds-bg rounded text-ds-soft">
                                    {count}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-ds-bg rounded-lg border border-ds-border overflow-hidden">
                <div className="p-4 border-b border-ds-border">
                    <h3 className="text-sm font-bold text-ds-text">
                        {t('moderation.historyTitle', 'Historial de Moderación')}
                    </h3>
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
                            <div className="col-span-2">{t('moderation.date', 'Fecha')}</div>
                            <div className="col-span-2">{t('moderation.username', 'Usuario')}</div>
                            <div className="col-span-3">{t('moderation.word', 'Palabra')}</div>
                            <div className="col-span-2">{t('moderation.severity', 'Severidad')}</div>
                            <div className="col-span-2">{t('moderation.action', 'Acción')}</div>
                            <div className="col-span-1">{t('moderation.strike', 'Strike')}</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-ds-border">
                            {paginatedData.map((log) => (
                                <div key={log.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 hover:bg-ds-surface transition-colors">
                                    {/* Mobile header */}
                                    <div className="md:hidden flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold text-ds-text">
                                            {log.username}
                                        </span>
                                        <span className="text-xs text-ds-soft">
                                            {new Date(log.createdAt).toLocaleString(locale, {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    {/* Desktop: Date */}
                                    <div className="hidden md:block col-span-2 text-sm text-ds-text">
                                        {new Date(log.createdAt).toLocaleString(locale, {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>

                                    {/* Desktop: Username */}
                                    <div className="hidden md:block col-span-2 text-sm font-semibold text-ds-text">
                                        {log.username}
                                    </div>

                                    {/* Word */}
                                    <div className="md:col-span-3">
                                        <span className="text-sm font-mono text-ds-soft bg-ds-bg px-2 py-0.5 rounded">
                                            {log.detectedWord}
                                        </span>
                                    </div>

                                    {/* Severity & Action (Mobile: same row) */}
                                    <div className="flex items-center gap-2 md:contents">
                                        <div className="md:col-span-2">
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${severityColors[log.severity] || severityColors.leve}`}>
                                                {log.severity}
                                            </span>
                                        </div>
                                        <div className="md:col-span-2">
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${actionColors[log.actionTaken] || actionColors.delete}`}>
                                                {log.actionTaken}
                                            </span>
                                        </div>
                                        <div className="md:col-span-1 text-sm text-ds-text">
                                            {log.strikeLevel}/3
                                        </div>
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
                        <Shield className="w-12 h-12 text-ds-soft mx-auto mb-4" />
                        <p className="text-sm text-ds-soft">
                            {t('moderation.noActions', 'No hay acciones de moderación en este período')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
