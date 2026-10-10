import { useState, useMemo } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Pagination from '../components/Pagination';

interface ChatMessage {
    id: number;
    username: string;
    userId: string | null;
    message: string;
    timestamp: string;
}

interface DateRange {
    from: Date;
    to: Date;
}

interface ChatMessagesTabProps {
    data?: ChatMessage[];
    isLoading: boolean;
    dateRange: DateRange;
}

export default function ChatMessagesTab({ data, isLoading, dateRange }: ChatMessagesTabProps) {
    const { t, i18n } = useTranslation('analytics');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [searchQuery, setSearchQuery] = useState('');

    // Stats
    const stats = useMemo(() => {
        if (!data) return { total: 0, uniqueUsers: 0 };

        const uniqueUsers = new Set(data.map(m => m.username.toLowerCase())).size;

        return {
            total: data.length,
            uniqueUsers
        };
    }, [data]);

    // Filter by search
    const filteredData = useMemo(() => {
        if (!data) return [];
        if (!searchQuery.trim()) return data;

        const query = searchQuery.toLowerCase();
        return data.filter(m =>
            m.username.toLowerCase().includes(query) ||
            m.message.toLowerCase().includes(query)
        );
    }, [data, searchQuery]);

    // Pagination
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleItemsPerPageChange = (newItemsPerPage: number) => {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1);
    };

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        setCurrentPage(1);
    };

    const locale = i18n.language === 'en' ? 'en-US' : 'es-ES';

    return (
        <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 bg-ds-accent/10 rounded-lg border border-ds-accent">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-ds-accent">
                            <MessageSquare className="w-5 h-5 text-ds-on-accent" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-ds-accent-text uppercase tracking-wider">
                                {t('chatMessages.totalMessages', 'Total Mensajes')}
                            </p>
                            {isLoading ? (
                                <div className="h-7 w-20 bg-ds-accent/10 rounded animate-pulse mt-1" />
                            ) : (
                                <p className="text-2xl font-black text-ds-text">{stats.total}</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="p-5 bg-ds-bg rounded-lg border border-ds-border">
                    <p className="text-xs font-bold text-ds-soft uppercase tracking-wider mb-1">
                        {t('chatMessages.uniqueUsers', 'Usuarios Únicos')}
                    </p>
                    {isLoading ? (
                        <div className="h-8 w-20 bg-ds-raised rounded animate-pulse" />
                    ) : (
                        <p className="text-2xl font-black text-ds-text">{stats.uniqueUsers}</p>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-ds-bg rounded-lg border border-ds-border overflow-hidden">
                <div className="p-4 border-b border-ds-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-bold text-ds-text">
                            {t('chatMessages.historyTitle', 'Historial de Chat')}
                        </h3>
                        <p className="text-xs text-ds-soft mt-1">
                            {filteredData.length} {t('chatMessages.messagesInPeriod', 'mensajes en el período')}
                        </p>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ds-soft" />
                        <input
                            type="text"
                            placeholder={t('chatMessages.searchPlaceholder', 'Buscar usuario o mensaje...')}
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm bg-ds-surface border border-ds-border rounded-lg text-ds-text placeholder-ds-soft focus:outline-none focus:ring-2 focus:ring-ds-accent/20 w-full sm:w-64"
                        />
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
                            <div className="col-span-2">{t('chatMessages.date', 'Fecha')}</div>
                            <div className="col-span-2">{t('chatMessages.username', 'Usuario')}</div>
                            <div className="col-span-8">{t('chatMessages.message', 'Mensaje')}</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-ds-border">
                            {paginatedData.map((msg) => (
                                <div key={msg.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 hover:bg-ds-surface transition-colors">
                                    {/* Mobile header */}
                                    <div className="md:hidden flex items-center justify-between mb-1">
                                        <span className="text-sm font-semibold text-ds-text">
                                            {msg.username}
                                        </span>
                                        <span className="text-xs text-ds-soft">
                                            {new Date(msg.timestamp).toLocaleString(locale, {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    {/* Desktop: Date */}
                                    <div className="hidden md:block col-span-2 text-sm text-ds-text">
                                        {new Date(msg.timestamp).toLocaleString(locale, {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>

                                    {/* Desktop: Username */}
                                    <div className="hidden md:block col-span-2 text-sm font-semibold text-ds-text">
                                        {msg.username}
                                    </div>

                                    {/* Message */}
                                    <div className="md:col-span-8 text-sm text-ds-soft break-words">
                                        {msg.message}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredData.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={handleItemsPerPageChange}
                        />
                    </>
                ) : (
                    <div className="p-12 text-center">
                        <MessageSquare className="w-12 h-12 text-ds-soft mx-auto mb-4" />
                        <p className="text-sm text-ds-soft">
                            {searchQuery
                                ? t('chatMessages.noResults', 'No se encontraron mensajes')
                                : t('chatMessages.noMessages', 'No hay mensajes en este período')
                            }
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
