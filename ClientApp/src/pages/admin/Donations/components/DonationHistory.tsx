import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, Clock, MessageSquare } from 'lucide-react';
import api from '../../../../services/api';

interface Donation {
    id: number;
    donorName: string;
    amount: number;
    currency: string;
    message: string | null;
    timeAdded: number;
    donatedAt: string;
}

interface PagedResponse {
    data: Donation[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', MXN: '$', BRL: 'R$',
    ARS: '$', COP: '$', CLP: '$', PEN: 'S/',
};

function fmt(amount: number, currency = 'USD') {
    const sym = CURRENCY_SYMBOLS[currency] ?? '$';
    return `${sym}${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTime(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

function fmtDate(str: string) {
    return new Date(str).toLocaleString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

const PAGE_SIZES = [10, 20, 50];

interface Props {
    refreshKey: number;
}

export function DonationHistory({ refreshKey }: Props) {
    const [donations, setDonations] = useState<Donation[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(pageSize),
                ...(search ? { search } : {})
            });
            const res = await api.get<PagedResponse>(`/tips/history?${params}`);
            setDonations(res.data.data);
            setTotal(res.data.total);
            setTotalPages(res.data.totalPages);
        } catch {
            setDonations([]);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, search, refreshKey]);

    useEffect(() => { load(); }, [load]);

    // Reset page when search or pageSize changes
    useEffect(() => { setPage(1); }, [search, pageSize]);

    const handleSearch = () => {
        setSearch(searchInput.trim());
        setPage(1);
    };

    const pageNumbers = () => {
        const pages: (number | '...')[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (page > 3) pages.push('...');
            for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
            if (page < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    const inputClass = 'px-3 py-2 text-sm border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-purple-500';
    const btnBase = 'p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#374151] disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Search */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="Buscar donante..."
                            className={`${inputClass} pl-9 w-full`}
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        className="px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                        Buscar
                    </button>
                    {search && (
                        <button
                            onClick={() => { setSearch(''); setSearchInput(''); }}
                            className="text-sm text-[#94a3b8] hover:text-[#64748b] transition-colors"
                        >
                            Limpiar
                        </button>
                    )}
                </div>

                {/* Page size + count */}
                <div className="flex items-center gap-3 text-sm text-[#64748b] dark:text-[#94a3b8]">
                    <span>{total} registros</span>
                    <select
                        value={pageSize}
                        onChange={e => setPageSize(Number(e.target.value))}
                        className={inputClass}
                    >
                        {PAGE_SIZES.map(s => (
                            <option key={s} value={s}>{s} por página</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626]">
                                <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide w-12">#</th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">Donante</th>
                                <th className="text-right px-4 py-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">Monto</th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide hidden md:table-cell">Mensaje</th>
                                <th className="text-center px-4 py-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide hidden lg:table-cell">Timer</th>
                                <th className="text-right px-4 py-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide hidden sm:table-cell">Fecha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(pageSize > 5 ? 5 : pageSize)].map((_, i) => (
                                    <tr key={i} className="border-b border-[#e2e8f0] dark:border-[#374151] last:border-0">
                                        {[...Array(6)].map((__, j) => (
                                            <td key={j} className="px-4 py-3">
                                                <div className="h-5 bg-[#e2e8f0] dark:bg-[#262626] rounded animate-pulse" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : donations.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-[#94a3b8]">
                                        {search ? `No hay resultados para "${search}"` : 'Aún no hay donaciones'}
                                    </td>
                                </tr>
                            ) : (
                                donations.map((d, idx) => (
                                    <tr
                                        key={d.id}
                                        className="border-b border-[#e2e8f0] dark:border-[#374151] last:border-0 hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                                    >
                                        {/* Row # */}
                                        <td className="px-4 py-3 text-sm text-[#94a3b8]">
                                            {(page - 1) * pageSize + idx + 1}
                                        </td>

                                        {/* Donor */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                    {d.donorName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-semibold text-[#1e293b] dark:text-[#f8fafc] text-sm">
                                                    {d.donorName}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Amount */}
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-black text-green-600 dark:text-green-400">
                                                {fmt(d.amount, d.currency)}
                                            </span>
                                        </td>

                                        {/* Message */}
                                        <td className="px-4 py-3 hidden md:table-cell max-w-xs">
                                            {d.message ? (
                                                <span className="flex items-center gap-1 text-sm text-[#64748b] dark:text-[#94a3b8] truncate">
                                                    <MessageSquare className="w-3 h-3 shrink-0" />
                                                    {d.message}
                                                </span>
                                            ) : (
                                                <span className="text-[#cbd5e1] dark:text-[#374151] text-sm">—</span>
                                            )}
                                        </td>

                                        {/* Timer */}
                                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                                            {d.timeAdded > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-full font-semibold">
                                                    <Clock className="w-3 h-3" />
                                                    +{fmtTime(d.timeAdded)}
                                                </span>
                                            ) : (
                                                <span className="text-[#cbd5e1] dark:text-[#374151] text-sm">—</span>
                                            )}
                                        </td>

                                        {/* Date */}
                                        <td className="px-4 py-3 text-right text-sm text-[#64748b] dark:text-[#94a3b8] hidden sm:table-cell whitespace-nowrap">
                                            {fmtDate(d.donatedAt)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626]">
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
                        </p>
                        <div className="flex items-center gap-1">
                            <button className={btnBase} onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {pageNumbers().map((p, i) =>
                                p === '...' ? (
                                    <span key={`ellipsis-${i}`} className="px-2 text-[#94a3b8]">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p as number)}
                                        className={`w-8 h-8 text-sm font-semibold rounded-lg transition-colors ${
                                            page === p
                                                ? 'bg-purple-600 text-white'
                                                : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                            <button className={btnBase} onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
