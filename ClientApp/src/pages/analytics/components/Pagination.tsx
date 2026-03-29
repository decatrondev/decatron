import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (items: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function Pagination({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange
}: PaginationProps) {
    const { t } = useTranslation('analytics');

    if (totalItems === 0) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-gray-50 dark:bg-[#1B1C1D] border-t border-[#e2e8f0] dark:border-[#374151]">
            {/* Items info */}
            <div className="flex items-center gap-4">
                <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                    {t('pagination.showing', 'Mostrando')} {startItem}-{endItem} {t('pagination.of', 'de')} {totalItems}
                </span>

                {/* Items per page selector */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">{t('pagination.perPage', 'Por página:')}</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                        className="px-2 py-1 text-xs bg-white dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                    >
                        {PAGE_SIZE_OPTIONS.map(size => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Page navigation */}
            {totalPages > 1 && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1}
                        className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f8fafc] dark:hover:bg-[#1B1C1D] transition-colors text-[#64748b] dark:text-[#94a3b8]"
                    >
                        {t('pagination.first', 'Primera')}
                    </button>
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg bg-white dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f8fafc] dark:hover:bg-[#1B1C1D] transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                    </button>

                    <span className="px-3 py-1 text-xs font-medium text-[#1e293b] dark:text-[#f8fafc]">
                        {currentPage} / {totalPages}
                    </span>

                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg bg-white dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f8fafc] dark:hover:bg-[#1B1C1D] transition-colors"
                    >
                        <ChevronRight className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                    </button>
                    <button
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f8fafc] dark:hover:bg-[#1B1C1D] transition-colors text-[#64748b] dark:text-[#94a3b8]"
                    >
                        {t('pagination.last', 'Última')}
                    </button>
                </div>
            )}
        </div>
    );
}
