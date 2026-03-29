import { useState, useMemo } from 'react';
import { Film, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Pagination from '../components/Pagination';

interface GameChange {
    id: number;
    categoryName: string;
    changedBy: string;
    changedAt: string;
}

interface TitleChange {
    id: number;
    title: string;
    changedBy: string;
    changedAt: string;
}

interface StreamHistoryData {
    games: GameChange[];
    titles: TitleChange[];
}

interface DateRange {
    from: Date;
    to: Date;
}

interface StreamHistoryTabProps {
    data?: StreamHistoryData;
    isLoading: boolean;
    dateRange: DateRange;
}

export default function StreamHistoryTab({ data, isLoading, dateRange }: StreamHistoryTabProps) {
    const { t, i18n } = useTranslation('analytics');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [filter, setFilter] = useState<'all' | 'game' | 'title'>('all');

    // Combine and sort all changes
    const allChanges = useMemo(() => {
        const combined = [
            ...(data?.games?.map(g => ({
                id: `game-${g.id}`,
                type: 'game' as const,
                value: g.categoryName,
                changedBy: g.changedBy,
                changedAt: new Date(g.changedAt)
            })) || []),
            ...(data?.titles?.map(t => ({
                id: `title-${t.id}`,
                type: 'title' as const,
                value: t.title,
                changedBy: t.changedBy,
                changedAt: new Date(t.changedAt)
            })) || [])
        ].sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());

        if (filter === 'all') return combined;
        return combined.filter(c => c.type === filter);
    }, [data, filter]);

    // Pagination
    const totalPages = Math.ceil(allChanges.length / itemsPerPage);
    const paginatedData = allChanges.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleItemsPerPageChange = (newItemsPerPage: number) => {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1);
    };

    const handleFilterChange = (newFilter: 'all' | 'game' | 'title') => {
        setFilter(newFilter);
        setCurrentPage(1);
    };

    const locale = i18n.language === 'en' ? 'en-US' : 'es-ES';

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-purple-500">
                            <Film className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                                {t('streamHistory.categoryChanges', 'Cambios de Categoría')}
                            </p>
                            {isLoading ? (
                                <div className="h-7 w-16 bg-purple-200 dark:bg-purple-800 rounded animate-pulse mt-1" />
                            ) : (
                                <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                    {data?.games?.length || 0}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-blue-500">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                                {t('streamHistory.titleChanges', 'Cambios de Título')}
                            </p>
                            {isLoading ? (
                                <div className="h-7 w-16 bg-blue-200 dark:bg-blue-800 rounded animate-pulse mt-1" />
                            ) : (
                                <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                    {data?.titles?.length || 0}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                <div className="p-4 border-b border-[#e2e8f0] dark:border-[#374151] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {t('streamHistory.historyTitle', 'Historial de Cambios')}
                        </h3>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                            {allChanges.length} {t('streamHistory.changesInPeriod', 'cambios en el período seleccionado')}
                        </p>
                    </div>

                    {/* Filter */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleFilterChange('all')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                filter === 'all'
                                    ? 'bg-[#2563eb] text-white'
                                    : 'bg-white dark:bg-[#1B1C1D] text-[#64748b] dark:text-[#94a3b8] hover:bg-gray-100 dark:hover:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151]'
                            }`}
                        >
                            {t('streamHistory.filterAll', 'Todos')}
                        </button>
                        <button
                            onClick={() => handleFilterChange('game')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                filter === 'game'
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-white dark:bg-[#1B1C1D] text-[#64748b] dark:text-[#94a3b8] hover:bg-gray-100 dark:hover:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151]'
                            }`}
                        >
                            {t('streamHistory.filterCategory', 'Categoría')}
                        </button>
                        <button
                            onClick={() => handleFilterChange('title')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                filter === 'title'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white dark:bg-[#1B1C1D] text-[#64748b] dark:text-[#94a3b8] hover:bg-gray-100 dark:hover:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151]'
                            }`}
                        >
                            {t('streamHistory.filterTitle', 'Título')}
                        </button>
                    </div>
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
                            <div className="col-span-2">{t('streamHistory.date', 'Fecha')}</div>
                            <div className="col-span-2">{t('streamHistory.type', 'Tipo')}</div>
                            <div className="col-span-5">{t('streamHistory.value', 'Valor')}</div>
                            <div className="col-span-3">{t('streamHistory.changedBy', 'Cambiado Por')}</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                            {paginatedData.map((change) => (
                                <div key={change.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 hover:bg-white dark:hover:bg-[#1B1C1D] transition-colors">
                                    {/* Mobile: Header */}
                                    <div className="md:hidden flex items-center justify-between">
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                            change.type === 'game'
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        }`}>
                                            {change.type === 'game' ? t('streamHistory.category', 'Categoría') : t('streamHistory.titleLabel', 'Título')}
                                        </span>
                                        <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                            {change.changedAt.toLocaleString(locale, {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    {/* Desktop: Date */}
                                    <div className="hidden md:block col-span-2 text-sm text-[#1e293b] dark:text-[#f8fafc]">
                                        {change.changedAt.toLocaleString(locale, {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>

                                    {/* Desktop: Type */}
                                    <div className="hidden md:block col-span-2">
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                            change.type === 'game'
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        }`}>
                                            {change.type === 'game' ? t('streamHistory.category', 'Categoría') : t('streamHistory.titleLabel', 'Título')}
                                        </span>
                                    </div>

                                    {/* Value */}
                                    <div className="md:col-span-5 text-sm font-medium text-[#1e293b] dark:text-[#f8fafc] truncate">
                                        {change.value}
                                    </div>

                                    {/* Changed By */}
                                    <div className="md:col-span-3 text-sm text-[#64748b] dark:text-[#94a3b8]">
                                        <span className="md:hidden text-xs">{t('streamHistory.by', 'por')} </span>
                                        {change.changedBy}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={allChanges.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={handleItemsPerPageChange}
                        />
                    </>
                ) : (
                    <div className="p-12 text-center">
                        <Film className="w-12 h-12 text-[#94a3b8] dark:text-[#64748b] mx-auto mb-4" />
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {t('streamHistory.noChanges', 'Sin cambios en este período')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
