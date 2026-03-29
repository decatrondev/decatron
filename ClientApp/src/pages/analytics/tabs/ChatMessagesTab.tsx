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
                <div className="p-5 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-indigo-500">
                            <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                                {t('chatMessages.totalMessages', 'Total Mensajes')}
                            </p>
                            {isLoading ? (
                                <div className="h-7 w-20 bg-indigo-200 dark:bg-indigo-800 rounded animate-pulse mt-1" />
                            ) : (
                                <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">{stats.total}</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="p-5 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                    <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider mb-1">
                        {t('chatMessages.uniqueUsers', 'Usuarios Únicos')}
                    </p>
                    {isLoading ? (
                        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    ) : (
                        <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">{stats.uniqueUsers}</p>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                <div className="p-4 border-b border-[#e2e8f0] dark:border-[#374151] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {t('chatMessages.historyTitle', 'Historial de Chat')}
                        </h3>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                            {filteredData.length} {t('chatMessages.messagesInPeriod', 'mensajes en el período')}
                        </p>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                        <input
                            type="text"
                            placeholder={t('chatMessages.searchPlaceholder', 'Buscar usuario o mensaje...')}
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] placeholder-[#94a3b8] dark:placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 w-full sm:w-64"
                        />
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
                            <div className="col-span-2">{t('chatMessages.date', 'Fecha')}</div>
                            <div className="col-span-2">{t('chatMessages.username', 'Usuario')}</div>
                            <div className="col-span-8">{t('chatMessages.message', 'Mensaje')}</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                            {paginatedData.map((msg) => (
                                <div key={msg.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 hover:bg-white dark:hover:bg-[#1B1C1D] transition-colors">
                                    {/* Mobile header */}
                                    <div className="md:hidden flex items-center justify-between mb-1">
                                        <span className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                            {msg.username}
                                        </span>
                                        <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                            {new Date(msg.timestamp).toLocaleString(locale, {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    {/* Desktop: Date */}
                                    <div className="hidden md:block col-span-2 text-sm text-[#1e293b] dark:text-[#f8fafc]">
                                        {new Date(msg.timestamp).toLocaleString(locale, {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>

                                    {/* Desktop: Username */}
                                    <div className="hidden md:block col-span-2 text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                        {msg.username}
                                    </div>

                                    {/* Message */}
                                    <div className="md:col-span-8 text-sm text-[#64748b] dark:text-[#94a3b8] break-words">
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
                        <MessageSquare className="w-12 h-12 text-[#94a3b8] dark:text-[#64748b] mx-auto mb-4" />
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
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
