import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Supporter } from '../types';
import { INPUT, TIER_LABELS, fmtDate } from '../constants';
import api from '../../../../services/api';

export function SupportersTab() {
    const [supporters, setSupporters] = useState<Supporter[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const PAGE_SIZE = 20;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), ...(search ? { search } : {}) });
            const res = await api.get<{ data: Supporter[]; total: number; totalPages: number }>(`/supporters/list?${params}`);
            setSupporters(res.data.data);
            setTotal(res.data.total);
            setTotalPages(res.data.totalPages);
        } catch {
            setSupporters([]);
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [search]);

    const TIER_BADGE: Record<string, string> = {
        supporter: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
        premium: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
        fundador: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && setSearch(searchInput.trim())}
                        placeholder="Buscar supporter..."
                        className={`${INPUT} pl-9`}
                    />
                </div>
                <button
                    onClick={() => setSearch(searchInput.trim())}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold rounded-xl"
                >
                    Buscar
                </button>
                {search && (
                    <button onClick={() => { setSearch(''); setSearchInput(''); }} className="text-sm text-[#94a3b8] hover:text-[#64748b]">
                        Limpiar
                    </button>
                )}
                <button onClick={load} className="p-2.5 border border-[#e2e8f0] dark:border-[#374151] rounded-xl bg-white dark:bg-[#262626] hover:bg-[#f8fafc] dark:hover:bg-[#374151] transition-colors ml-auto">
                    <RefreshCw className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                </button>
                <span className="text-sm text-[#64748b] dark:text-[#94a3b8] whitespace-nowrap">{total} supporters</span>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626]">
                                <th className="text-left px-5 py-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">Supporter</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">Tier</th>
                                <th className="text-center px-5 py-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide hidden md:table-cell">Tipo</th>
                                <th className="text-right px-5 py-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide hidden lg:table-cell">Donado</th>
                                <th className="text-right px-5 py-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide hidden sm:table-cell">Vence</th>
                                <th className="text-right px-5 py-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide hidden xl:table-cell">Desde</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="border-b border-[#e2e8f0] dark:border-[#374151] last:border-0">
                                        {[...Array(6)].map((_, j) => (
                                            <td key={j} className="px-5 py-4">
                                                <div className="h-4 bg-[#e2e8f0] dark:bg-[#262626] rounded animate-pulse" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : supporters.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-[#94a3b8]">
                                        <div className="text-5xl mb-3">🌟</div>
                                        <p className="font-semibold">
                                            {search ? `Sin resultados para "${search}"` : 'Aún no hay supporters activos'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                supporters.map(s => (
                                    <tr key={s.id} className="border-b border-[#e2e8f0] dark:border-[#374151] last:border-0 hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563eb] to-[#7c3aed] flex items-center justify-center text-white text-sm font-bold shrink-0">
                                                    {s.displayName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc]">{s.displayName}</p>
                                                    <p className="text-xs text-[#94a3b8]">@{s.twitchLogin}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${TIER_BADGE[s.tier] ?? 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]'}`}>
                                                {TIER_LABELS[s.tier] ?? s.tier}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center hidden md:table-cell">
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.isPermanent ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]'}`}>
                                                {s.isPermanent ? '∞ Permanente' : 'Mensual'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right hidden lg:table-cell">
                                            <span className="font-black text-green-600 dark:text-green-400 text-sm">
                                                ${s.totalDonated.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right hidden sm:table-cell">
                                            <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                                {s.isPermanent ? '∞' : s.expiresAt ? fmtDate(s.expiresAt) : '—'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right hidden xl:table-cell">
                                            <span className="text-xs text-[#94a3b8]">{fmtDate(s.joinedAt)}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626]">
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Página {page} de {totalPages}</p>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] disabled:opacity-40 hover:bg-[#f8fafc] dark:hover:bg-[#374151] transition-colors">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] disabled:opacity-40 hover:bg-[#f8fafc] dark:hover:bg-[#374151] transition-colors">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
