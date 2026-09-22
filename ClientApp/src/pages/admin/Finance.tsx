/**
 * Admin → Finanzas: lo único que responde "¿gano o pierdo?". Une los tres orígenes de
 * cobro (tiers/donaciones, DecaCoins, créditos), descuenta comisión de pasarela e IGV,
 * resta los costos variables (IA + voz/STT) y los fijos, y muestra el beneficio neto.
 * Plan: .dev/plans/FINANZAS_PLAN.md
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RefreshCw, Download, Wallet, TrendingUp, TrendingDown, Plus, Trash2, Save, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import api from '../../services/api';
import { CallsTable } from '../../components/admin/AiCallsTable';

interface Line { key: string; pen: number; usd: number; count: number }
interface Summary {
    from: string; to: string;
    settings: { gatewayPercent: number; gatewayFixedPen: number; gatewayFeeHasIgv: boolean; igvPercent: number; penPerUsd: number; primaryCurrency: string; creditUsd: number; targetMarginPercent: number };
    income: { grossPen: number; grossUsd: number; count: number; bySource: { source: string; pen: number; usd: number; count: number }[]; byMonth: { month: string; pen: number; count: number }[] };
    deductions: { gatewayFeesPen: number; gatewayFeesUsd: number; igvPen: number; igvUsd: number; taxedPen: number };
    netSalesPen: number; netSalesUsd: number;
    costs: { variablePen: number; variableUsd: number; variable: Line[]; fixedPen: number; fixedUsd: number; fixed: Line[] };
    grossMarginPen: number; grossMarginUsd: number;
    netProfitPen: number; netProfitUsd: number; marginPercent: number;
    thirdParty: { tipsPen: number };
}
interface IncomeRow { source: string; id: number; login: string | null; at: string; amountPen: number; amountUsd: number; gateway: string; chargeId: string | null; invoiceStatus: string | null; invoiceType: string | null; invoiceNumber: string | null; concept: string; feePen: number }
interface FixedCost { id: number; concept: string; amount: number; currency: string; periodicity: string; startsOn: string; endsOn: string | null; notes: string | null }

const SOURCE_LABEL: Record<string, string> = { tier: 'Tiers', donation: 'Donaciones', coins: 'DecaCoins', credits: 'Créditos' };
const COST_LABEL: Record<string, string> = { ai: 'IA (LLM)', live_translation: 'Traducción en vivo (Deepgram)', speak_chat: 'Speak Chat (voz)', event_alerts: 'Alertas (voz)', timer_alerts: 'Timers (voz)', lol_coach: 'Coach (voz)', tips: 'Donaciones (voz)', other: 'Otros' };
const PERIODICITY: Record<string, string> = { monthly: 'Mensual', yearly: 'Anual', one_time: 'Único' };
const card = 'rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg';
const muted = 'text-xs text-[#64748b] dark:text-[#94a3b8]';
const input = 'w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#111213] text-sm text-[#1e293b] dark:text-[#f8fafc]';
const th = 'py-1 text-left text-[#64748b] dark:text-[#94a3b8] font-medium text-xs';
const tr = 'border-t border-[#f1f5f9] dark:border-[#26262c]';
const pen = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usd = (n: number) => `$${n.toFixed(2)}`;

export default function Finance() {
    const navigate = useNavigate();
    const [tab, setTab] = useState<'resumen' | 'ingresos' | 'costos' | 'creditos' | 'tarifas' | 'ajustes'>('resumen');
    const [months, setMonths] = useState(12);
    const [data, setData] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try { const r = await api.get(`/admin/finance/summary?months=${months}`); setData(r.data); }
        catch (e: any) { setError(e?.response?.status === 403 ? 'Solo el owner puede ver esta página.' : 'No se pudo cargar.'); }
        finally { setLoading(false); }
    }, [months]);
    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin')} className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626]"><ArrowLeft className="w-5 h-5 text-[#64748b]" /></button>
                    <div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Finanzas</h1>
                        <p className={`${muted} mt-1`}>Ingresos, costos y beneficio de la plataforma. Las pruebas no cuentan.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {[3, 12, 24].map(m => <button key={m} onClick={() => setMonths(m)} className={`px-3 py-1.5 rounded-lg text-xs border ${months === m ? 'bg-[#9146FF] border-[#9146FF] text-white' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b]'}`}>{m} meses</button>)}
                    <button onClick={load} className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151]"><RefreshCw className={`w-4 h-4 text-[#64748b] ${loading ? 'animate-spin' : ''}`} /></button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {([['resumen', 'Resumen'], ['ingresos', 'Ingresos'], ['costos', 'Costos'], ['creditos', 'Créditos'], ['tarifas', 'Tarifas'], ['ajustes', 'Ajustes']] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-xl text-sm font-bold border ${tab === k ? 'bg-[#9146FF] border-[#9146FF] text-white' : 'bg-white dark:bg-[#1B1C1D] border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8]'}`}>{label}</button>
                ))}
            </div>

            {error && <div className={`${card} text-red-500 text-sm`}>{error}</div>}
            {loading && !data && <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#9146FF]" /></div>}

            {data && tab === 'resumen' && <Resumen d={data} />}
            {data && tab === 'ingresos' && <Ingresos months={months} />}
            {data && tab === 'costos' && <Costos d={data} onChanged={load} />}
            {tab === 'creditos' && <Creditos months={months} />}
            {tab === 'tarifas' && <Tarifas />}
            {tab === 'ajustes' && <Ajustes onSaved={load} />}
        </div>
    );
}

function Resumen({ d }: { d: Summary }) {
    const rate = d.settings.penPerUsd;
    const maxMonth = Math.max(1, ...d.income.byMonth.map(m => m.pen));
    const step = (label: string, valuePen: number, hint?: string, negative?: boolean, strong?: boolean) => (
        <div className={`flex items-baseline justify-between gap-4 py-2 ${strong ? 'border-t-2 border-[#e2e8f0] dark:border-[#374151] mt-1 pt-3' : ''}`}>
            <div>
                <div className={`${strong ? 'text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]' : 'text-sm text-[#1e293b] dark:text-[#f8fafc]'}`}>{label}</div>
                {hint && <div className={muted}>{hint}</div>}
            </div>
            <div className={`text-right font-mono ${strong ? 'text-lg font-black' : 'text-sm'} ${negative ? 'text-red-500' : strong ? (valuePen >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500') : 'text-[#1e293b] dark:text-[#f8fafc]'}`}>
                {negative ? '−' : ''}{pen(Math.abs(valuePen))}
                <div className={muted}>{usd(Math.abs(valuePen) / rate)}</div>
            </div>
        </div>
    );

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat icon={<Wallet className="w-4 h-4" />} label="Ingresos brutos" value={pen(d.income.grossPen)} sub={`${d.income.count} cobros · ${usd(d.income.grossUsd)}`} />
                <Stat icon={<TrendingDown className="w-4 h-4" />} label="Costos" value={pen(d.costs.variablePen + d.costs.fixedPen)} sub={`variables ${pen(d.costs.variablePen)} · fijos ${pen(d.costs.fixedPen)}`} />
                <Stat icon={<TrendingUp className="w-4 h-4" />} label="Beneficio neto" value={pen(d.netProfitPen)} sub={`margen ${d.marginPercent}%`} accent={d.netProfitPen >= 0} />
                <a href="/admin/donations" className="block"><Stat icon={<Info className="w-4 h-4" />} label="Tips a streamers" value={pen(d.thirdParty.tipsPen)} sub="dinero de terceros, no es ingreso · ver" /></a>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div className={card}>
                    <h2 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3">De lo cobrado a lo que queda</h2>
                    {step('Ingresos brutos', d.income.grossPen, `${d.income.count} cobros reales`)}
                    {step('Comisión de la pasarela', d.deductions.gatewayFeesPen, `${d.settings.gatewayPercent}% + S/ ${d.settings.gatewayFixedPen}${d.settings.gatewayFeeHasIgv ? ' + IGV' : ''} por cobro`, true)}
                    {step('IGV', d.deductions.igvPen, d.deductions.taxedPen > 0 ? `sobre ${pen(d.deductions.taxedPen)} facturados` : 'nada facturado en el período', true)}
                    {step('Neto de ventas', d.netSalesPen, undefined, false, true)}
                    {step('Costos variables', d.costs.variablePen, 'IA, voz y transcripción', true)}
                    {step('Costos fijos', d.costs.fixedPen, 'servidor, dominios, suscripciones', true)}
                    {step('Beneficio neto', d.netProfitPen, `margen ${d.marginPercent}% sobre lo cobrado`, false, true)}
                </div>

                <div className="space-y-6">
                    <div className={card}>
                        <h2 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3">De dónde viene la plata</h2>
                        {d.income.bySource.length === 0 ? <p className={muted}>Sin cobros en el período.</p> : (
                            <ul className="space-y-3">
                                {d.income.bySource.map(s => (
                                    <li key={s.source}>
                                        <div className="flex items-center justify-between text-sm text-[#1e293b] dark:text-[#f8fafc]">
                                            <span>{SOURCE_LABEL[s.source] ?? s.source} <span className={muted}>· {s.count}</span></span>
                                            <span className="font-mono">{pen(s.pen)}</span>
                                        </div>
                                        <div className="h-1.5 mt-1 rounded-full bg-[#f1f5f9] dark:bg-[#262626]"><div className="h-1.5 rounded-full bg-[#9146FF]" style={{ width: `${d.income.grossPen ? (s.pen / d.income.grossPen) * 100 : 0}%` }} /></div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className={card}>
                        <h2 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3">Por mes</h2>
                        {d.income.byMonth.length === 0 ? <p className={muted}>Sin datos.</p> : (
                            <ul className="space-y-2">
                                {d.income.byMonth.map(m => (
                                    <li key={m.month} className="flex items-center gap-3 text-xs">
                                        <span className="w-16 text-[#64748b] dark:text-[#94a3b8]">{m.month}</span>
                                        <span className="flex-1 h-4 rounded bg-[#f1f5f9] dark:bg-[#262626] overflow-hidden"><span className="block h-4 rounded bg-[#9146FF]/70" style={{ width: `${(m.pen / maxMonth) * 100}%` }} /></span>
                                        <span className="w-24 text-right font-mono text-[#1e293b] dark:text-[#f8fafc]">{pen(m.pen)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

function Ingresos({ months }: { months: number }) {
    const [page, setPage] = useState(1);
    const [source, setSource] = useState('');
    const [data, setData] = useState<{ total: number; page: number; totalPages: number; items: IncomeRow[] } | null>(null);
    useEffect(() => {
        const p = new URLSearchParams({ months: String(months), page: String(page), pageSize: '50' });
        if (source) p.set('source', source);
        api.get(`/admin/finance/income?${p}`).then(r => setData(r.data)).catch(() => { });
    }, [months, page, source]);

    return (
        <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Cobros {data ? <span className={`${muted} font-normal`}>· {data.total}</span> : null}</h2>
                <div className="flex items-center gap-2">
                    <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }} className={`${input} !w-auto !py-1.5`}>
                        <option value="">Todas las fuentes</option>
                        {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <a href={`/api/admin/finance/income.csv?months=${months}`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-xs text-[#64748b] dark:text-[#94a3b8]"><Download className="w-3.5 h-3.5" /> CSV</a>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr><th className={th}>Cuándo</th><th className={th}>Fuente</th><th className={th}>Canal</th><th className={th}>Concepto</th><th className={`${th} text-right`}>Cobrado</th><th className={`${th} text-right`}>Comisión</th><th className={th}>Pasarela</th><th className={th}>Comprobante</th></tr></thead>
                    <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                        {data?.items.map(r => (
                            <tr key={`${r.source}-${r.id}`} className={tr}>
                                <td className="py-1.5 text-xs whitespace-nowrap">{new Date(r.at).toLocaleDateString()}</td>
                                <td className="text-xs">{SOURCE_LABEL[r.source] ?? r.source}</td>
                                <td className="text-xs">{r.login ?? '—'}</td>
                                <td className="text-xs">{r.concept}</td>
                                <td className="text-right font-mono text-xs">{pen(r.amountPen)}<div className={muted}>{usd(r.amountUsd)}</div></td>
                                <td className="text-right font-mono text-xs text-red-500">−{pen(r.feePen)}</td>
                                <td className="text-xs">{r.gateway}</td>
                                <td className="text-xs" title={r.chargeId ?? undefined}>{r.invoiceNumber ?? (r.invoiceStatus ? <span className={muted}>{r.invoiceStatus}</span> : <span className={muted}>sin comprobante</span>)}</td>
                            </tr>
                        ))}
                        {data && data.items.length === 0 && <tr><td colSpan={8} className={`${muted} py-6 text-center`}>Sin cobros con esos filtros.</td></tr>}
                    </tbody>
                </table>
            </div>
            {data && data.totalPages > 1 && (
                <div className="flex items-center justify-end gap-1 mt-4">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-xs px-2">{data.page} / {data.totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                </div>
            )}
        </div>
    );
}

const EMPTY_COST = { concept: '', amount: 0, currency: 'USD', periodicity: 'monthly', startsOn: new Date().toISOString().slice(0, 10), endsOn: null as string | null, notes: '' };

function Costos({ d, onChanged }: { d: Summary; onChanged: () => void }) {
    const [costs, setCosts] = useState<FixedCost[]>([]);
    const [editing, setEditing] = useState<(typeof EMPTY_COST & { id?: number }) | null>(null);
    const [saving, setSaving] = useState(false);
    const load = () => api.get('/admin/finance/fixed-costs').then(r => setCosts(r.data)).catch(() => { });
    useEffect(() => { load(); }, []);

    const save = async () => {
        if (!editing) return;
        setSaving(true);
        try {
            if (editing.id) await api.put(`/admin/finance/fixed-costs/${editing.id}`, editing);
            else await api.post('/admin/finance/fixed-costs', editing);
            setEditing(null); load(); onChanged();
        } catch { /* el form queda abierto */ } finally { setSaving(false); }
    };
    const remove = async (c: FixedCost) => {
        if (!confirm(`¿Borrar "${c.concept}"?`)) return;
        await api.delete(`/admin/finance/fixed-costs/${c.id}`); load(); onChanged();
    };

    return (
        <>
            <div className={card}>
                <h2 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1">Costos variables del período</h2>
                <p className={`${muted} mb-4`}>Lo que cuesta atender a los canales: IA por su costo real y voz/transcripción por los créditos consumidos.</p>
                <table className="w-full text-sm">
                    <thead><tr><th className={th}>Concepto</th><th className={`${th} text-right`}>Movs.</th><th className={`${th} text-right`}>USD</th><th className={`${th} text-right`}>PEN</th></tr></thead>
                    <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                        {d.costs.variable.map(v => <tr key={v.key} className={tr}><td className="py-1 text-xs">{COST_LABEL[v.key] ?? v.key}</td><td className="text-right text-xs">{v.count}</td><td className="text-right font-mono text-xs">{usd(v.usd)}</td><td className="text-right font-mono text-xs">{pen(v.pen)}</td></tr>)}
                        {d.costs.variable.length === 0 && <tr><td colSpan={4} className={`${muted} py-4 text-center`}>Sin costos variables en el período.</td></tr>}
                    </tbody>
                </table>
            </div>

            <CallsTable />

            <div className={card}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Costos fijos</h2>
                        <p className={muted}>Servidor, dominios, suscripciones. Se cargan a mano y entran al beneficio neto.</p>
                    </div>
                    <button onClick={() => setEditing({ ...EMPTY_COST })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#9146FF] text-white text-xs font-bold"><Plus className="w-3.5 h-3.5" /> Agregar</button>
                </div>
                <table className="w-full text-sm">
                    <thead><tr><th className={th}>Concepto</th><th className={th}>Periodicidad</th><th className={`${th} text-right`}>Monto</th><th className={th}>Desde</th><th className={th}>Hasta</th><th className={th}></th></tr></thead>
                    <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                        {costs.map(c => (
                            <tr key={c.id} className={tr}>
                                <td className="py-1 text-xs">{c.concept}{c.notes && <div className={muted}>{c.notes}</div>}</td>
                                <td className="text-xs">{PERIODICITY[c.periodicity] ?? c.periodicity}</td>
                                <td className="text-right font-mono text-xs">{c.currency === 'PEN' ? pen(c.amount) : usd(c.amount)}</td>
                                <td className="text-xs">{c.startsOn}</td>
                                <td className="text-xs">{c.endsOn ?? '—'}</td>
                                <td className="text-right text-xs whitespace-nowrap">
                                    <button onClick={() => setEditing({ ...c, notes: c.notes ?? '' })} className="text-[#9146FF] hover:underline mr-3">Editar</button>
                                    <button onClick={() => remove(c)} className="text-red-500"><Trash2 className="w-3.5 h-3.5 inline" /></button>
                                </td>
                            </tr>
                        ))}
                        {costs.length === 0 && <tr><td colSpan={6} className={`${muted} py-4 text-center`}>Todavía no cargaste ningún costo fijo.</td></tr>}
                    </tbody>
                </table>

                {editing && (
                    <div className="mt-4 p-4 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#111213] grid md:grid-cols-3 gap-3">
                        <label><span className={muted}>Concepto</span><input className={input} value={editing.concept} onChange={e => setEditing({ ...editing, concept: e.target.value })} placeholder="Servidor VPS" /></label>
                        <label><span className={muted}>Monto</span><input type="number" step="0.01" className={input} value={editing.amount} onChange={e => setEditing({ ...editing, amount: Number(e.target.value) })} /></label>
                        <label><span className={muted}>Moneda</span><select className={input} value={editing.currency} onChange={e => setEditing({ ...editing, currency: e.target.value })}><option value="USD">USD</option><option value="PEN">PEN</option></select></label>
                        <label><span className={muted}>Periodicidad</span><select className={input} value={editing.periodicity} onChange={e => setEditing({ ...editing, periodicity: e.target.value })}>{Object.entries(PERIODICITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                        <label><span className={muted}>Desde</span><input type="date" className={input} value={editing.startsOn} onChange={e => setEditing({ ...editing, startsOn: e.target.value })} /></label>
                        <label><span className={muted}>Hasta (opcional)</span><input type="date" className={input} value={editing.endsOn ?? ''} onChange={e => setEditing({ ...editing, endsOn: e.target.value || null })} /></label>
                        <label className="md:col-span-2"><span className={muted}>Notas</span><input className={input} value={editing.notes ?? ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></label>
                        <div className="flex items-end gap-2">
                            <button onClick={() => setEditing(null)} className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-sm">Cancelar</button>
                            <button onClick={save} disabled={saving} className="px-3 py-2 rounded-lg bg-[#9146FF] text-white text-sm font-bold disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

interface CreditsEco {
    creditUsd: number;
    sold: { credits: number; usd: number; pen: number; purchases: number; pricePerMillionUsd: number; costPerMillionUsd: number };
    granted: { type: string; credits: number; n: number }[];
    consumed: { credits: number; entries: number; costUsd: number; costPen: number };
    liability: { credits: number; channels: number; costUsd: number; costPen: number };
    byChannel: { userId: number; login: string | null; tier: string | null; paidPen: number; payments: number; usedCredits: number; costPen: number; costUsd: number; marginPen: number }[];
}
const GRANT_LABEL: Record<string, string> = { monthly_reset: 'Cuota del plan', grant: 'Regalo del admin', purchase: 'Compra de paquetes', refund: 'Devoluciones' };

/**
 * Unidad económica de los créditos: si el precio cubre el costo, cuánto se debe en
 * créditos ya cobrados y qué canal consume más de lo que paga.
 */
function Creditos({ months }: { months: number }) {
    const [d, setD] = useState<CreditsEco | null>(null);
    useEffect(() => { api.get(`/admin/finance/credits?months=${months}`).then(r => setD(r.data)).catch(() => { }); }, [months]);
    if (!d) return <div className={card}><Loader2 className="w-5 h-5 animate-spin text-[#9146FF]" /></div>;
    const healthy = d.sold.pricePerMillionUsd >= d.sold.costPerMillionUsd;

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat icon={<Wallet className="w-4 h-4" />} label="Créditos vendidos" value={d.sold.credits.toLocaleString()} sub={`${d.sold.purchases} compras · ${usd(d.sold.usd)}`} />
                <Stat icon={<TrendingUp className="w-4 h-4" />} label="Precio por millón" value={d.sold.pricePerMillionUsd > 0 ? usd(d.sold.pricePerMillionUsd) : '—'} sub={`cuesta ${usd(d.sold.costPerMillionUsd)}`} accent={d.sold.pricePerMillionUsd > 0 ? healthy : undefined} />
                <Stat icon={<TrendingDown className="w-4 h-4" />} label="Créditos consumidos" value={d.consumed.credits.toLocaleString()} sub={`costo real ${pen(d.consumed.costPen)}`} />
                <Stat icon={<Info className="w-4 h-4" />} label="Pasivo de créditos" value={d.liability.credits.toLocaleString()} sub={`${d.liability.channels} canales · ${pen(d.liability.costPen)} por servir`} />
            </div>

            <div className={card}>
                <h2 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1">Créditos que entraron a circulación</h2>
                <p className={`${muted} mb-4`}>Todo lo que se acreditó en el período. La cuota del plan no se paga por crédito: se paga con la suscripción.</p>
                <table className="w-full text-sm">
                    <thead><tr><th className={th}>Origen</th><th className={`${th} text-right`}>Movs.</th><th className={`${th} text-right`}>Créditos</th><th className={`${th} text-right`}>Costo si se gastan (USD)</th></tr></thead>
                    <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                        {d.granted.map(g => <tr key={g.type} className={tr}><td className="py-1 text-xs">{GRANT_LABEL[g.type] ?? g.type}</td><td className="text-right text-xs">{g.n}</td><td className="text-right font-mono text-xs">{g.credits.toLocaleString()}</td><td className="text-right font-mono text-xs">{usd(g.credits * d.creditUsd)}</td></tr>)}
                        {d.granted.length === 0 && <tr><td colSpan={4} className={`${muted} py-4 text-center`}>Nada acreditado en el período.</td></tr>}
                    </tbody>
                </table>
            </div>

            <div className={card}>
                <h2 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1">Qué paga y qué consume cada canal</h2>
                <p className={`${muted} mb-4`}>Con esto se ajustan las cuotas de los tiers: un canal que consume más de lo que paga es el que hay que mirar.</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr><th className={th}>Canal</th><th className={th}>Plan</th><th className={`${th} text-right`}>Pagó</th><th className={`${th} text-right`}>Créditos usados</th><th className={`${th} text-right`}>Costo real</th><th className={`${th} text-right`}>Diferencia</th></tr></thead>
                        <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                            {d.byChannel.map(c => (
                                <tr key={c.userId} className={tr}>
                                    <td className="py-1 text-xs">{c.login ?? `#${c.userId}`}</td>
                                    <td className="text-xs capitalize">{c.tier ?? '—'}</td>
                                    <td className="text-right font-mono text-xs">{c.paidPen > 0 ? pen(c.paidPen) : '—'}</td>
                                    <td className="text-right font-mono text-xs">{c.usedCredits.toLocaleString()}</td>
                                    <td className="text-right font-mono text-xs">{pen(c.costPen)}</td>
                                    <td className={`text-right font-mono text-xs ${c.marginPen >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{c.marginPen >= 0 ? '' : '−'}{pen(Math.abs(c.marginPen))}</td>
                                </tr>
                            ))}
                            {d.byChannel.length === 0 && <tr><td colSpan={6} className={`${muted} py-4 text-center`}>Sin actividad en el período.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

interface Rate {
    engine: string; label: string; unit: string; creditsPerUnit: number; providerUsdPerUnit: number; enabled: boolean; notes: string | null;
    chargedUsdPerUnit: number; marginPercent: number | null; suggestedCreditsPerUnit: number | null;
    perMillionCharsUsd: number | null; providerPerMillionCharsUsd: number | null; perMinuteUsd: number | null; providerPerMinuteUsd: number | null;
}

/**
 * Tarifas de créditos: lo que se le cobra al canal por cada motor contra lo que cuesta
 * de verdad. Todo editable: ningún precio vive en el código.
 */
function Tarifas() {
    const [d, setD] = useState<{ creditUsd: number; targetMarginPercent: number; rates: Rate[] } | null>(null);
    const [editing, setEditing] = useState<Rate | null>(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const load = () => api.get('/admin/finance/rates').then(r => setD(r.data)).catch(() => setMsg('No se pudieron cargar las tarifas.'));
    useEffect(() => { load(); }, []);
    if (!d) return <div className={card}><Loader2 className="w-5 h-5 animate-spin text-[#9146FF]" /></div>;

    const save = async () => {
        if (!editing) return;
        setBusy(true); setMsg(null);
        try { await api.put(`/admin/finance/rates/${encodeURIComponent(editing.engine)}`, editing); setEditing(null); load(); }
        catch (e: any) { setMsg(e?.response?.data?.message ?? 'No se pudo guardar.'); }
        finally { setBusy(false); }
    };
    const applyMargin = async () => {
        if (!confirm(`¿Poner todas las tarifas al ${d.targetMarginPercent}% de margen sobre el costo del proveedor?`)) return;
        setBusy(true);
        try { const r = await api.post('/admin/finance/rates/apply-margin'); setMsg(`${r.data.changed} tarifas actualizadas al ${r.data.marginPercent}%.`); load(); }
        finally { setBusy(false); }
    };
    const marginColor = (m: number | null) => m == null ? muted : m >= d.targetMarginPercent ? 'text-green-600 dark:text-green-400' : m > 0 ? 'text-amber-500' : 'text-red-500';

    return (
        <>
            <div className={card}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                    <h2 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Tarifas por motor</h2>
                    <button onClick={applyMargin} disabled={busy} className="px-3 py-1.5 rounded-lg bg-[#9146FF] text-white text-xs font-bold disabled:opacity-50">Aplicar {d.targetMarginPercent}% a todas</button>
                </div>
                <p className={`${muted} mb-4`}>1 crédito = {usd(d.creditUsd)} (${(d.creditUsd * 1_000_000).toFixed(2)} por millón). El margen es lo que cobras por encima de lo que te cobra el proveedor. En verde, los que llegan al objetivo.</p>
                {msg && <p className={`${muted} mb-3`}>{msg}</p>}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr><th className={th}>Motor</th><th className={`${th} text-right`}>Cobra</th><th className={`${th} text-right`}>Cuesta</th><th className={`${th} text-right`}>Margen</th><th className={`${th} text-right`}>Sugerido</th><th className={th}></th></tr></thead>
                        <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                            {d.rates.map(r => (
                                <tr key={r.engine} className={tr}>
                                    <td className="py-1.5 text-xs">{r.label}{!r.enabled && <span className="ml-1 text-[10px] uppercase text-[#94a3b8]">apagado</span>}<div className={muted}>{r.engine}</div></td>
                                    <td className="text-right font-mono text-xs">
                                        {r.creditsPerUnit.toLocaleString()} cr/{r.unit === 'char' ? 'car' : r.unit === 'second' ? 'seg' : 'USD'}
                                        <div className={muted}>{r.perMillionCharsUsd != null ? `${usd(r.perMillionCharsUsd)}/M car` : r.perMinuteUsd != null ? `${usd(r.perMinuteUsd)}/min` : `×${r.creditsPerUnit} sobre el costo`}</div>
                                    </td>
                                    <td className="text-right font-mono text-xs">
                                        {r.providerPerMillionCharsUsd != null ? `${usd(r.providerPerMillionCharsUsd)}/M car` : r.providerPerMinuteUsd != null ? `${usd(r.providerPerMinuteUsd)}/min` : r.unit === 'usd' ? 'costo real' : '—'}
                                    </td>
                                    <td className={`text-right font-mono text-xs font-bold ${marginColor(r.marginPercent)}`}>{r.marginPercent != null ? `${r.marginPercent}%` : '—'}</td>
                                    <td className="text-right font-mono text-xs text-[#64748b] dark:text-[#94a3b8]">{r.suggestedCreditsPerUnit != null ? r.suggestedCreditsPerUnit.toLocaleString() : '—'}</td>
                                    <td className="text-right"><button onClick={() => setEditing({ ...r })} className="text-[#9146FF] hover:underline text-xs">Editar</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {editing && (
                    <div className="mt-4 p-4 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#111213] grid md:grid-cols-3 gap-3">
                        <label className="md:col-span-2"><span className={muted}>Nombre</span><input className={input} value={editing.label} onChange={e => setEditing({ ...editing, label: e.target.value })} /></label>
                        <label><span className={muted}>Unidad</span><select className={input} value={editing.unit} onChange={e => setEditing({ ...editing, unit: e.target.value })}><option value="char">Por carácter</option><option value="second">Por segundo</option><option value="usd">Multiplicador sobre el costo</option></select></label>
                        <label><span className={muted}>Créditos por unidad</span><input type="number" step="0.0001" className={input} value={editing.creditsPerUnit} onChange={e => setEditing({ ...editing, creditsPerUnit: Number(e.target.value) })} /></label>
                        <label><span className={muted}>Costo del proveedor (USD por unidad)</span><input type="number" step="0.0000000001" className={input} value={editing.providerUsdPerUnit} onChange={e => setEditing({ ...editing, providerUsdPerUnit: Number(e.target.value) })} /></label>
                        <label className="flex items-end gap-2 text-sm text-[#1e293b] dark:text-[#f8fafc]"><input type="checkbox" checked={editing.enabled} onChange={e => setEditing({ ...editing, enabled: e.target.checked })} /> Activo</label>
                        <label className="md:col-span-2"><span className={muted}>Notas</span><input className={input} value={editing.notes ?? ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></label>
                        <div className="flex items-end gap-2">
                            <button onClick={() => setEditing(null)} className="px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-sm">Cancelar</button>
                            <button onClick={save} disabled={busy} className="px-3 py-2 rounded-lg bg-[#9146FF] text-white text-sm font-bold disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar'}</button>
                        </div>
                        {editing.suggestedCreditsPerUnit != null && (
                            <p className={`${muted} md:col-span-3`}>Para {d.targetMarginPercent}% de margen: <b>{editing.suggestedCreditsPerUnit.toLocaleString()}</b> créditos por unidad.</p>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

function Ajustes({ onSaved }: { onSaved: () => void }) {
    const [s, setS] = useState<(Summary['settings'] & { creditUsd: number; targetMarginPercent: number }) | null>(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    useEffect(() => { api.get('/admin/finance/settings').then(r => setS(r.data)).catch(() => { }); }, []);
    if (!s) return <div className={card}><Loader2 className="w-5 h-5 animate-spin text-[#9146FF]" /></div>;

    const save = async () => {
        setSaving(true); setMsg(null);
        try { await api.put('/admin/finance/settings', s); setMsg('Guardado.'); onSaved(); }
        catch (e: any) { setMsg(e?.response?.data?.message ?? 'No se pudo guardar.'); }
        finally { setSaving(false); }
    };

    return (
        <div className={card}>
            <h2 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1">Parámetros del cálculo</h2>
            <p className={`${muted} mb-4`}>Con estos números se calculan las deducciones. El tipo de cambio es el mismo que usa el cobro con Culqi.</p>
            <div className="grid md:grid-cols-3 gap-3">
                <label><span className={muted}>Comisión de la pasarela (%)</span><input type="number" step="0.01" className={input} value={s.gatewayPercent} onChange={e => setS({ ...s, gatewayPercent: Number(e.target.value) })} /></label>
                <label><span className={muted}>Parte fija por cobro (S/)</span><input type="number" step="0.01" className={input} value={s.gatewayFixedPen} onChange={e => setS({ ...s, gatewayFixedPen: Number(e.target.value) })} /></label>
                <label><span className={muted}>IGV (%)</span><input type="number" step="0.01" className={input} value={s.igvPercent} onChange={e => setS({ ...s, igvPercent: Number(e.target.value) })} /></label>
                <label><span className={muted}>Tipo de cambio (S/ por USD)</span><input type="number" step="0.0001" className={input} value={s.penPerUsd} onChange={e => setS({ ...s, penPerUsd: Number(e.target.value) })} /></label>
                <label><span className={muted}>Valor del crédito (USD)</span><input type="number" step="0.000000001" className={input} value={s.creditUsd} onChange={e => setS({ ...s, creditUsd: Number(e.target.value) })} /></label>
                <label><span className={muted}>Margen objetivo (%)</span><input type="number" step="1" className={input} value={s.targetMarginPercent} onChange={e => setS({ ...s, targetMarginPercent: Number(e.target.value) })} /></label>
                <label className="flex items-end gap-2 text-sm text-[#1e293b] dark:text-[#f8fafc]"><input type="checkbox" checked={s.gatewayFeeHasIgv} onChange={e => setS({ ...s, gatewayFeeHasIgv: e.target.checked })} /> La comisión lleva IGV</label>
                <div className="flex items-end gap-3">
                    <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#9146FF] text-white text-sm font-bold disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar</button>
                    {msg && <span className={muted}>{msg}</span>}
                </div>
            </div>
        </div>
    );
}

function Stat({ icon, label, value, sub, accent }: { icon: JSX.Element; label: string; value: string; sub?: string; accent?: boolean }) {
    return (
        <div className={`${card} !p-4 ${accent !== undefined ? (accent ? 'border-green-500/40' : 'border-red-500/40') : ''}`}>
            <div className={`${muted} flex items-center gap-1.5`}><span className="text-[#9146FF]">{icon}</span>{label}</div>
            <div className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mt-1">{value}</div>
            {sub && <div className={`${muted} mt-1`}>{sub}</div>}
        </div>
    );
}
