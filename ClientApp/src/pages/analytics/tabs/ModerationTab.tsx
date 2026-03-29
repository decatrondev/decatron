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
    leve: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    medio: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    severo: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
};

const actionColors: Record<string, string> = {
    warn: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    timeout: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    ban: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    delete: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
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
                <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1">
                        {t('moderation.totalActions', 'Total Acciones')}
                    </p>
                    {isLoading ? (
                        <div className="h-8 w-20 bg-blue-200 dark:bg-blue-800 rounded animate-pulse" />
                    ) : (
                        <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">{stats.total}</p>
                    )}
                </div>
                <div className="p-5 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl border border-red-200 dark:border-red-800">
                    <p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider mb-1">
                        {t('moderation.severeActions', 'Severas')}
                    </p>
                    {isLoading ? (
                        <div className="h-8 w-20 bg-red-200 dark:bg-red-800 rounded animate-pulse" />
                    ) : (
                        <p className="text-2xl font-black text-red-600 dark:text-red-400">{stats.severe}</p>
                    )}
                </div>
                <div className="p-5 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                    <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-1">
                        {t('moderation.uniqueWords', 'Palabras Únicas')}
                    </p>
                    {isLoading ? (
                        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    ) : (
                        <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">{stats.uniqueWords}</p>
                    )}
                </div>
            </div>

            {/* Top Words */}
            {stats.topWords.length > 0 && (
                <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-5">
                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                        {t('moderation.topWords', 'Top Palabras Detectadas')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {stats.topWords.map(({ word, count }, index) => (
                            <div
                                key={word}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#1B1C1D] rounded-lg border border-[#e2e8f0] dark:border-[#374151]"
                            >
                                <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                                    #{index + 1}
                                </span>
                                <span className="text-sm font-mono text-[#1e293b] dark:text-[#f8fafc]">
                                    {word}
                                </span>
                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[#64748b] dark:text-[#94a3b8]">
                                    {count}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                <div className="p-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                        {t('moderation.historyTitle', 'Historial de Moderación')}
                    </h3>
                </div>

                {isLoading ? (
                    <div className="p-4 space-y-2">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        ))}
                    </div>
                ) : paginatedData.length > 0 ? (
                    <>
                        {/* Table Header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                            <div className="col-span-2">{t('moderation.date', 'Fecha')}</div>
                            <div className="col-span-2">{t('moderation.username', 'Usuario')}</div>
                            <div className="col-span-3">{t('moderation.word', 'Palabra')}</div>
                            <div className="col-span-2">{t('moderation.severity', 'Severidad')}</div>
                            <div className="col-span-2">{t('moderation.action', 'Acción')}</div>
                            <div className="col-span-1">{t('moderation.strike', 'Strike')}</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                            {paginatedData.map((log) => (
                                <div key={log.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 hover:bg-white dark:hover:bg-[#1B1C1D] transition-colors">
                                    {/* Mobile header */}
                                    <div className="md:hidden flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                            {log.username}
                                        </span>
                                        <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                            {new Date(log.createdAt).toLocaleString(locale, {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    {/* Desktop: Date */}
                                    <div className="hidden md:block col-span-2 text-sm text-[#1e293b] dark:text-[#f8fafc]">
                                        {new Date(log.createdAt).toLocaleString(locale, {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>

                                    {/* Desktop: Username */}
                                    <div className="hidden md:block col-span-2 text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                        {log.username}
                                    </div>

                                    {/* Word */}
                                    <div className="md:col-span-3">
                                        <span className="text-sm font-mono text-[#64748b] dark:text-[#94a3b8] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
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
                                        <div className="md:col-span-1 text-sm text-[#1e293b] dark:text-[#f8fafc]">
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
                        <Shield className="w-12 h-12 text-[#94a3b8] dark:text-[#64748b] mx-auto mb-4" />
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {t('moderation.noActions', 'No hay acciones de moderación en este período')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
