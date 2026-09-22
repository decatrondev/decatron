/**
 * Llamadas a los LLM una por una: paginadas, con filtros por módulo, modelo, canal,
 * estado y fechas, y el error completo al expandir la fila. Vive aparte porque la usan
 * el admin de costos de IA y Finanzas → Costos.
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import api from '../../services/api';

export const MODULE_LABEL: Record<string, string> = { 'twitch-chat': '!decatronai (Twitch)', 'web-chat': 'Chat web', translation: 'Traducción en vivo', 'lol-coach': 'Coach de LoL', unknown: 'Sin módulo' };
const usd = (n: number) => `$${n.toFixed(n < 0.01 && n > 0 ? 4 : 2)}`;
const cardClass = 'rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg';
const h2 = 'text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4';
const muted = 'text-xs text-[#64748b] dark:text-[#94a3b8]';
const input = 'w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#111213] text-sm text-[#1e293b] dark:text-[#f8fafc] font-mono';
const th = 'py-1 text-left text-[#64748b] dark:text-[#94a3b8] font-medium';
const tr = 'border-t border-[#f1f5f9] dark:border-[#26262c]';

interface Call { id: number; module: string; provider: string; model: string; userId: number; channelName: string | null; promptTokens: number; completionTokens: number; estimatedCostUsd: number; responseTimeMs: number; success: boolean; errorMessage: string | null; usedAt: string; creditsCharged: number | null }
interface CallsPage { page: number; pageSize: number; total: number; totalPages: number; items: Call[]; modules: string[]; models: string[] }
interface CallFilters { module: string; model: string; channel: string; success: '' | 'true' | 'false'; from: string; to: string }
const EMPTY_FILTERS: CallFilters = { module: '', model: '', channel: '', success: '', from: '', to: '' };

/**
 * Llamadas una por una: paginadas, con filtros por módulo/modelo/canal/estado/fechas y el
 * error completo al expandir la fila. Carga aparte del resumen para no pesar en el refresco.
 */
export function CallsTable() {
    const [filters, setFilters] = useState<CallFilters>(EMPTY_FILTERS);
    const [channelDraft, setChannelDraft] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [data, setData] = useState<CallsPage | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
            for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
            const r = await api.get(`/admin/ai-costs/calls?${params.toString()}`);
            setData(r.data);
        } catch { /* el resumen ya muestra el error general */ } finally { setLoading(false); }
    }, [filters, page, pageSize]);

    useEffect(() => { load(); }, [load]);

    const setFilter = (patch: Partial<CallFilters>) => { setFilters(f => ({ ...f, ...patch })); setPage(1); };
    const hasFilters = Object.values(filters).some(Boolean);
    const select = `${input} !font-sans`;

    return (
        <div className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className={`${h2} !mb-0`}>Llamadas {data ? <span className={`${muted} font-normal`}>· {data.total.toLocaleString()} en total</span> : null}</h2>
                <div className="flex items-center gap-2">
                    {hasFilters && <button onClick={() => { setFilters(EMPTY_FILTERS); setChannelDraft(''); setPage(1); }} className={`${muted} inline-flex items-center gap-1 hover:underline`}><X className="w-3 h-3" /> Limpiar filtros</button>}
                    <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]" title="Actualizar"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 mb-4">
                <select value={filters.module} onChange={e => setFilter({ module: e.target.value })} className={select}>
                    <option value="">Todos los módulos</option>
                    {data?.modules.map(m => <option key={m} value={m}>{MODULE_LABEL[m] ?? m}</option>)}
                </select>
                <select value={filters.model} onChange={e => setFilter({ model: e.target.value })} className={select}>
                    <option value="">Todos los modelos</option>
                    {data?.models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <form onSubmit={e => { e.preventDefault(); setFilter({ channel: channelDraft.trim() }); }} className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                    <input value={channelDraft} onChange={e => setChannelDraft(e.target.value)} onBlur={() => { if (channelDraft.trim() !== filters.channel) setFilter({ channel: channelDraft.trim() }); }} placeholder="Canal…" className={`${select} !pl-8`} />
                </form>
                <select value={filters.success} onChange={e => setFilter({ success: e.target.value as CallFilters['success'] })} className={select}>
                    <option value="">OK y errores</option>
                    <option value="true">Solo OK</option>
                    <option value="false">Solo errores</option>
                </select>
                <input type="date" value={filters.from} onChange={e => setFilter({ from: e.target.value })} className={select} title="Desde" />
                <input type="date" value={filters.to} onChange={e => setFilter({ to: e.target.value })} className={select} title="Hasta" />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr><th className={th}></th><th className={th}>Cuándo</th><th className={th}>Módulo</th><th className={th}>Modelo</th><th className={th}>Canal</th><th className={th}>in/out</th><th className={th}>ms</th><th className={`${th} text-right`}>Costo</th><th className={`${th} text-right`}>Créditos</th><th className={`${th} text-right`}>Estado</th></tr></thead>
                    <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                        {data?.items.map(r => {
                            const expanded = open === r.id;
                            return (
                                <Fragment key={r.id}>
                                    <tr className={`${tr} ${r.success ? '' : 'text-red-500'} ${r.errorMessage ? 'cursor-pointer' : ''}`} onClick={() => r.errorMessage && setOpen(expanded ? null : r.id)}>
                                        <td className="w-5 text-[#94a3b8]">{r.errorMessage ? (expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : null}</td>
                                        <td className="py-1.5 text-xs whitespace-nowrap">{new Date(r.usedAt).toLocaleString()}</td>
                                        <td className="text-xs">{MODULE_LABEL[r.module] ?? r.module}</td>
                                        <td className="font-mono text-xs">{r.model}</td>
                                        <td className="text-xs">{r.channelName ?? '—'}{r.userId ? <span className={`${muted} ml-1`}>#{r.userId}</span> : null}</td>
                                        <td className="font-mono text-xs">{r.promptTokens}/{r.completionTokens}</td>
                                        <td className="text-xs">{r.responseTimeMs}</td>
                                        <td className="text-right font-mono text-xs">{r.success ? usd(r.estimatedCostUsd) : '—'}</td>
                                        <td className="text-right font-mono text-xs" title={r.creditsCharged == null ? 'Anterior al cobro por créditos o sin canal' : undefined}>{r.creditsCharged == null ? '—' : r.creditsCharged.toLocaleString()}</td>
                                        <td className="text-right text-xs">{r.success ? <span className="text-green-500">OK</span> : <span title={r.errorMessage ?? undefined}>{(r.errorMessage ?? 'error').slice(0, 24)}</span>}</td>
                                    </tr>
                                    {expanded && r.errorMessage && (
                                        <tr className={tr}><td colSpan={10} className="py-2"><pre className="text-[11px] whitespace-pre-wrap break-all rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3">{r.errorMessage}</pre></td></tr>
                                    )}
                                </Fragment>
                            );
                        })}
                        {data && data.items.length === 0 && <tr><td colSpan={10} className={`${muted} py-6 text-center`}>Sin llamadas con esos filtros.</td></tr>}
                    </tbody>
                </table>
            </div>

            {data && data.total > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                    <div className={`${muted} flex items-center gap-2`}>
                        <span>Por página</span>
                        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className={`${select} !w-auto !py-1`}>
                            {[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <span>· {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} de {data.total.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading} className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-40 hover:bg-[#f1f5f9] dark:hover:bg-[#262626]"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-xs px-2 text-[#1e293b] dark:text-[#f8fafc]">{data.page} / {data.totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages || loading} className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-40 hover:bg-[#f1f5f9] dark:hover:bg-[#262626]"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
            )}
        </div>
    );
}
