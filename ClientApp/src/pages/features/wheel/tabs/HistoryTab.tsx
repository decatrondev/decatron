import { Download } from 'lucide-react';
import { type Metrics, type Spin, type SpinFilters } from '../model';
import { CARD, FIELD } from '../ui';

/// La pestana Historial: las metricas arriba y la tabla de giros abajo.
///
/// Son dos fuentes distintas a proposito. Las tarjetas usan TODO el historial
/// porque una distribucion calculada sobre una ventana recortada le mentiria al
/// streamer sobre su propia rueda; la tabla usa solo lo que su tier deja ver.
export function HistoryTab({ spins, total, page, metrics, filters, historyDays, onFilters, onApply, onReset, onPage, onExport, t }: {
    spins: Spin[];
    total: number;
    page: number;
    metrics: Metrics | null;
    filters: SpinFilters;
    /** -1 = sin limite. */
    historyDays: number;
    onFilters: (f: SpinFilters) => void;
    onApply: () => void;
    onReset: () => void;
    onPage: (p: number) => void;
    onExport: () => void;
    t: any;
}) {
    const paginas = Math.max(1, Math.ceil(total / 50));
    const set = (cambios: Partial<SpinFilters>) => onFilters({ ...filters, ...cambios });

    return (
        <div className="space-y-4">
            {metrics && (
                <>
                    <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {([
                            [t('wheel.history.mSpins'), metrics.totals.spins],
                            [t('wheel.history.mLast7'), metrics.totals.spinsLast7],
                            [t('wheel.history.mLast30'), metrics.totals.spinsLast30],
                            [t('wheel.history.mCredits'), metrics.totals.creditsSpent],
                            [t('wheel.history.mPending'), metrics.totals.pendingDeliveries],
                        ] as const).map(([label, valor]) => (
                            <div key={label} className="bg-[#1B1C1D] border border-[#374151] rounded-xl px-4 py-3">
                                <p className="text-xs text-[#94a3b8]">{label}</p>
                                <p className="text-2xl font-bold text-[#f8fafc] tabular-nums">{valor.toLocaleString()}</p>
                            </div>
                        ))}
                    </section>

                    <section className={CARD}>
                        <div className="px-5 py-4 border-b border-[#374151]">
                            <h2 className="font-bold text-[#f8fafc]">{t('wheel.history.distTitle')}</h2>
                            <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.history.distHelp')}</p>
                        </div>
                        <div className="p-5 space-y-3">
                            {metrics.distribution.map(d => (
                                <div key={d.segmentId}>
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-[#f8fafc] font-medium truncate">{d.label}</span>
                                        <span className="text-[#94a3b8] tabular-nums ml-3 shrink-0">
                                            {d.spins} · {d.realPct.toFixed(1)}% / {d.configuredPct.toFixed(1)}%
                                        </span>
                                    </div>
                                    {/* Dos barras y no una: la de arriba es lo que salio y
                                        la fina de abajo lo configurado. Superponerlas
                                        obligaria a adivinar cual es cual. */}
                                    <div className="h-2 bg-[#262626] rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${Math.min(100, d.realPct)}%`, background: d.color || '#E8B455' }}
                                        />
                                    </div>
                                    <div className="h-1 bg-[#262626] rounded-full overflow-hidden mt-0.5">
                                        <div className="h-full bg-[#64748b] rounded-full" style={{ width: `${Math.min(100, d.configuredPct)}%` }} />
                                    </div>
                                </div>
                            ))}
                            {metrics.totals.spins < 30 && (
                                <p className="text-xs text-[#64748b] pt-1">{t('wheel.history.fewSpins')}</p>
                            )}
                        </div>
                    </section>

                    {metrics.luckiest.length > 0 && (
                        <section className={CARD}>
                            <div className="px-5 py-4 border-b border-[#374151]">
                                <h2 className="font-bold text-[#f8fafc]">{t('wheel.history.luckiest')}</h2>
                            </div>
                            <div className="p-5 flex flex-wrap gap-2">
                                {metrics.luckiest.map(l => (
                                    <span key={l.viewer} className="px-2.5 py-1 bg-[#262626] border border-[#374151] rounded-lg text-xs text-[#cbd5e1]">
                                        @{l.viewer} · {t('wheel.history.spinsN', { count: l.spins })}
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}

            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151] flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-bold text-[#f8fafc]">{t('wheel.history.title')}</h2>
                        <p className="text-xs text-[#94a3b8] mt-0.5">
                            {historyDays < 0
                                ? t('wheel.history.windowAll')
                                : t('wheel.history.window', { days: historyDays })}
                        </p>
                    </div>
                    <button
                        onClick={onExport}
                        className="px-3 py-2 bg-[#262626] hover:bg-[#333] border border-[#374151] text-[#f8fafc] rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        {t('wheel.history.export')}
                    </button>
                </div>

                <div className="px-5 py-4 border-b border-[#374151] flex flex-wrap items-end gap-3">
                    <label className="text-xs text-[#94a3b8]">
                        {t('wheel.history.from')}
                        <input type="date" value={filters.from} onChange={e => set({ from: e.target.value })} className={`${FIELD} block mt-1`} />
                    </label>
                    <label className="text-xs text-[#94a3b8]">
                        {t('wheel.history.to')}
                        <input type="date" value={filters.to} onChange={e => set({ to: e.target.value })} className={`${FIELD} block mt-1`} />
                    </label>
                    <label className="text-xs text-[#94a3b8]">
                        {t('wheel.history.viewer')}
                        <input
                            value={filters.viewer}
                            onChange={e => set({ viewer: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && onApply()}
                            placeholder={t('wheel.history.viewerPlaceholder')}
                            className={`${FIELD} block mt-1 w-44`}
                        />
                    </label>
                    <label className="text-xs text-[#94a3b8]">
                        {t('wheel.history.trigger')}
                        <select value={filters.trigger} onChange={e => set({ trigger: e.target.value })} className={`${FIELD} block mt-1`}>
                            <option value="all">{t('wheel.history.any')}</option>
                            <option value="command">{t('wheel.history.trCommand')}</option>
                            <option value="panel">{t('wheel.history.trPanel')}</option>
                            <option value="auto">{t('wheel.history.trAuto')}</option>
                            <option value="raffle_draw">{t('wheel.history.trRaffle')}</option>
                        </select>
                    </label>
                    <label className="text-xs text-[#94a3b8]">
                        {t('wheel.history.delivery')}
                        <select value={filters.status} onChange={e => set({ status: e.target.value })} className={`${FIELD} block mt-1`}>
                            <option value="all">{t('wheel.history.any')}</option>
                            <option value="delivered">{t('wheel.history.stDelivered')}</option>
                            <option value="pending">{t('wheel.history.stPending')}</option>
                            <option value="failed">{t('wheel.history.stFailed')}</option>
                        </select>
                    </label>
                    <button onClick={onApply} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                        {t('wheel.history.apply')}
                    </button>
                    <button onClick={onReset} className="px-3 py-2 text-sm text-[#94a3b8] hover:text-[#f8fafc] transition-colors">
                        {t('wheel.history.clear')}
                    </button>
                </div>

                {spins.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-[#64748b] text-center">{t('wheel.history.empty')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-[#94a3b8] border-b border-[#374151]">
                                    <th className="px-5 py-2 font-medium">{t('wheel.history.colWhen')}</th>
                                    <th className="px-3 py-2 font-medium">{t('wheel.history.colViewer')}</th>
                                    <th className="px-3 py-2 font-medium">{t('wheel.history.colResult')}</th>
                                    <th className="px-3 py-2 font-medium">{t('wheel.history.colTrigger')}</th>
                                    <th className="px-3 py-2 font-medium text-right">{t('wheel.history.colCredits')}</th>
                                    <th className="px-5 py-2 font-medium">{t('wheel.history.colDelivery')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {spins.map(sp => (
                                    <tr key={sp.id} className="border-b border-[#262626] last:border-0">
                                        <td className="px-5 py-2 text-[#cbd5e1] whitespace-nowrap">
                                            {new Date(sp.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-[#cbd5e1]">{sp.viewer ? `@${sp.viewer}` : '—'}</td>
                                        <td className="px-3 py-2 text-[#f8fafc]">
                                            {/* El gajo puede haberse borrado despues del giro; el
                                                tipo del premio viene del snapshot y sobrevive igual. */}
                                            {sp.label ?? <span className="text-[#64748b] italic">{t('wheel.history.deletedSegment')}</span>}
                                            {sp.prize?.type && (
                                                <span className="text-xs text-[#64748b] ml-2">{sp.prize.type}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-[#94a3b8]">{sp.trigger}</td>
                                        <td className="px-3 py-2 text-[#cbd5e1] text-right tabular-nums">{sp.creditsSpent}</td>
                                        <td className="px-5 py-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                sp.deliveryStatus === 'delivered' ? 'bg-green-500/10 text-green-300'
                                                : sp.deliveryStatus === 'pending' ? 'bg-amber-500/10 text-amber-300'
                                                : 'bg-red-500/10 text-red-300'
                                            }`}>
                                                {t(`wheel.history.st${sp.deliveryStatus === 'delivered' ? 'Delivered'
                                                    : sp.deliveryStatus === 'pending' ? 'Pending' : 'Failed'}`)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {paginas > 1 && (
                    <div className="px-5 py-3 border-t border-[#374151] flex items-center justify-between text-sm">
                        <span className="text-xs text-[#94a3b8]">{t('wheel.history.pageOf', { page, pages: paginas, total })}</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onPage(page - 1)}
                                disabled={page <= 1}
                                className="px-3 py-1.5 bg-[#262626] disabled:opacity-40 border border-[#374151] text-[#f8fafc] rounded-lg text-xs"
                            >
                                {t('wheel.history.prev')}
                            </button>
                            <button
                                onClick={() => onPage(page + 1)}
                                disabled={page >= paginas}
                                className="px-3 py-1.5 bg-[#262626] disabled:opacity-40 border border-[#374151] text-[#f8fafc] rounded-lg text-xs"
                            >
                                {t('wheel.history.next')}
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
