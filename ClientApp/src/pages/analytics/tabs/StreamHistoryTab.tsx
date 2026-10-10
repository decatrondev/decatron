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
                <div className="p-5 bg-ds-accent/10 rounded-lg border border-ds-accent">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-ds-accent">
                            <Film className="w-5 h-5 text-ds-on-accent" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-ds-accent-text uppercase tracking-wider">
                                {t('streamHistory.categoryChanges', 'Cambios de Categoría')}
                            </p>
                            {isLoading ? (
                                <div className="h-7 w-16 bg-ds-accent/10 rounded animate-pulse mt-1" />
                            ) : (
                                <p className="text-2xl font-black text-ds-text">
                                    {data?.games?.length || 0}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-ds-accent/10 rounded-lg border border-ds-accent">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-ds-accent">
                            <FileText className="w-5 h-5 text-ds-on-accent" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-ds-accent-text uppercase tracking-wider">
                                {t('streamHistory.titleChanges', 'Cambios de Título')}
                            </p>
                            {isLoading ? (
                                <div className="h-7 w-16 bg-ds-accent/10 rounded animate-pulse mt-1" />
                            ) : (
                                <p className="text-2xl font-black text-ds-text">
                                    {data?.titles?.length || 0}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-ds-bg rounded-lg border border-ds-border overflow-hidden">
                <div className="p-4 border-b border-ds-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-bold text-ds-text">
                            {t('streamHistory.historyTitle', 'Historial de Cambios')}
                        </h3>
                        <p className="text-xs text-ds-soft mt-1">
                            {allChanges.length} {t('streamHistory.changesInPeriod', 'cambios en el período seleccionado')}
                        </p>
                    </div>

                    {/* Filter */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleFilterChange('all')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                filter === 'all'
                                    ? 'bg-ds-accent text-ds-on-accent'
                                    : 'bg-ds-surface text-ds-soft hover:bg-ds-bg border border-ds-border '
                            }`}
                        >
                            {t('streamHistory.filterAll', 'Todos')}
                        </button>
                        <button
                            onClick={() => handleFilterChange('game')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                filter === 'game'
                                    ? 'bg-ds-accent text-ds-on-accent'
                                    : 'bg-ds-surface text-ds-soft hover:bg-ds-bg border border-ds-border '
                            }`}
                        >
                            {t('streamHistory.filterCategory', 'Categoría')}
                        </button>
                        <button
                            onClick={() => handleFilterChange('title')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                filter === 'title'
                                    ? 'bg-ds-accent text-ds-on-accent'
                                    : 'bg-ds-surface text-ds-soft hover:bg-ds-bg border border-ds-border '
                            }`}
                        >
                            {t('streamHistory.filterTitle', 'Título')}
                        </button>
                    </div>
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
                            <div className="col-span-2">{t('streamHistory.date', 'Fecha')}</div>
                            <div className="col-span-2">{t('streamHistory.type', 'Tipo')}</div>
                            <div className="col-span-5">{t('streamHistory.value', 'Valor')}</div>
                            <div className="col-span-3">{t('streamHistory.changedBy', 'Cambiado Por')}</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-ds-border">
                            {paginatedData.map((change) => (
                                <div key={change.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 hover:bg-ds-surface transition-colors">
                                    {/* Mobile: Header */}
                                    <div className="md:hidden flex items-center justify-between">
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                            change.type === 'game'
                                                ? 'bg-ds-accent/10 text-ds-accent-text '
                                                : 'bg-ds-accent/10 text-ds-accent-text '
                                        }`}>
                                            {change.type === 'game' ? t('streamHistory.category', 'Categoría') : t('streamHistory.titleLabel', 'Título')}
                                        </span>
                                        <span className="text-xs text-ds-soft">
                                            {change.changedAt.toLocaleString(locale, {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    {/* Desktop: Date */}
                                    <div className="hidden md:block col-span-2 text-sm text-ds-text">
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
                                                ? 'bg-ds-accent/10 text-ds-accent-text '
                                                : 'bg-ds-accent/10 text-ds-accent-text '
                                        }`}>
                                            {change.type === 'game' ? t('streamHistory.category', 'Categoría') : t('streamHistory.titleLabel', 'Título')}
                                        </span>
                                    </div>

                                    {/* Value */}
                                    <div className="md:col-span-5 text-sm font-medium text-ds-text truncate">
                                        {change.value}
                                    </div>

                                    {/* Changed By */}
                                    <div className="md:col-span-3 text-sm text-ds-soft">
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
                        <Film className="w-12 h-12 text-ds-soft mx-auto mb-4" />
                        <p className="text-sm text-ds-soft">
                            {t('streamHistory.noChanges', 'Sin cambios en este período')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
