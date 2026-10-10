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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-ds-surface border-t border-ds-border">
            {/* Items info */}
            <div className="flex items-center gap-4">
                <span className="text-xs text-ds-soft">
                    {t('pagination.showing', 'Mostrando')} {startItem}-{endItem} {t('pagination.of', 'de')} {totalItems}
                </span>

                {/* Items per page selector */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-ds-soft">{t('pagination.perPage', 'Por página:')}</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                        className="ds-input"
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
                        className="ds-btn ds-btn--secondary ds-btn--sm"
                    >
                        {t('pagination.first', 'Primera')}
                    </button>
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="ds-btn ds-btn--secondary ds-icon-btn ds-btn--sm"
                    >
                        <ChevronLeft className="w-4 h-4 text-ds-soft" />
                    </button>

                    <span className="px-3 py-1 text-xs font-medium text-ds-text">
                        {currentPage} / {totalPages}
                    </span>

                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="ds-btn ds-btn--secondary ds-icon-btn ds-btn--sm"
                    >
                        <ChevronRight className="w-4 h-4 text-ds-soft" />
                    </button>
                    <button
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="ds-btn ds-btn--secondary ds-btn--sm"
                    >
                        {t('pagination.last', 'Última')}
                    </button>
                </div>
            )}
        </div>
    );
}
