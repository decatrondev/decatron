import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, Search, Loader2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { CARD, INPUT } from '../constants';
import api from '../../../../services/api';
import { descargarComprobante, FORMATOS, type FormatoComprobante } from '../../../../utils/invoiceFiles';
import { EmisorPanel } from './EmisorPanel';

/**
 * Estado de los comprobantes de todas las compras.
 *
 * Existe por una razón concreta: el job reintenta 5 veces y después deja el pago en ERROR
 * y se calla. Sin esta pantalla, un comprobante que nunca salió solo se ve entrando a la
 * base de datos a mano.
 */

interface InvoiceRow {
    paymentId: number;
    twitchLogin: string | null;
    tier: string | null;
    billingType: string | null;
    capturedAt: string;
    provider: string | null;
    orderId: string | null;
    amount: number;
    currency: string;
    customerName: string | null;
    customerDocType: string | null;
    customerDoc: string | null;
    customerCountry: string | null;
    status: string | null;
    type: string | null;
    number: string | null;
    documentId: number | null;
    error: string | null;
    attempts: number;
    lastAttempt: string | null;
    canDownload: boolean;
}

interface InvoicesResponse {
    total: number;
    page: number;
    pageSize: number;
    counts: { accepted: number; pending: number; rejected: number; error: number; none: number };
    items: InvoiceRow[];
}

const FILTROS: { id: string | null; label: string; clave: keyof InvoicesResponse['counts'] | null; color: string }[] = [
    { id: null,        label: 'Todos',     clave: null,       color: 'text-[#1e293b] dark:text-[#f8fafc]' },
    { id: 'ACCEPTED',  label: 'Aceptados', clave: 'accepted', color: 'text-green-600 dark:text-green-400' },
    { id: 'PENDING',   label: 'Pendientes', clave: 'pending', color: 'text-amber-600 dark:text-amber-400' },
    { id: 'REJECTED',  label: 'Rechazados', clave: 'rejected', color: 'text-red-600 dark:text-red-400' },
    { id: 'ERROR',     label: 'Con error', clave: 'error',    color: 'text-red-600 dark:text-red-400' },
];

const ESTADO_ESTILO: Record<string, string> = {
    ACCEPTED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    PENDING:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    REJECTED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    ERROR:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

function fecha(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    });
}

export function InvoicesTab() {
    const [data, setData]       = useState<InvoicesResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus]   = useState<string | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [termino, setTermino] = useState('');
    const [page, setPage]       = useState(1);
    const [ocupado, setOcupado] = useState<string | null>(null);
    const [aviso, setAviso]     = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get<InvoicesResponse>('/supporters/admin/invoices', {
                params: { status: status ?? undefined, q: termino || undefined, page, pageSize: 25 },
            });
            setData(data);
        } catch {
            setAviso({ tipo: 'error', texto: 'No se pudo cargar la lista' });
        } finally {
            setLoading(false);
        }
    }, [status, termino, page]);

    useEffect(() => { cargar(); }, [cargar]);

    // El buscador espera a que dejes de escribir: cada tecla es una consulta a la base.
    useEffect(() => {
        const id = setTimeout(() => { setTermino(busqueda); setPage(1); }, 400);
        return () => clearTimeout(id);
    }, [busqueda]);

    const reintentar = async (fila: InvoiceRow) => {
        setOcupado(`retry-${fila.paymentId}`);
        setAviso(null);
        try {
            const { data } = await api.post<{ accepted: boolean; status: string | null; error: string | null; number: string | null }>(
                `/supporters/admin/invoices/${fila.paymentId}/retry`
            );
            setAviso(
                data.accepted
                    ? { tipo: 'ok', texto: `✅ ${data.number ?? 'Comprobante'} aceptado por SUNAT` }
                    : { tipo: 'error', texto: `Sigue sin salir (${data.status ?? 'sin estado'}): ${data.error ?? 'sin detalle'}` }
            );
            cargar();
        } catch {
            setAviso({ tipo: 'error', texto: 'No se pudo reintentar' });
        } finally {
            setOcupado(null);
        }
    };

    const bajar = async (fila: InvoiceRow, formato: FormatoComprobante) => {
        setOcupado(`${formato}-${fila.paymentId}`);
        try {
            await descargarComprobante(`/supporters/admin/invoices/${fila.paymentId}/download`, formato);
        } catch {
            setAviso({ tipo: 'error', texto: `No se pudo descargar el ${formato.toUpperCase()}` });
        } finally {
            setOcupado(null);
        }
    };

    const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

    return (
        <div className="space-y-6">
            <EmisorPanel />

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc] text-lg">Comprobantes</h3>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                        Boletas y facturas de las compras de tier. Las donaciones no llevan comprobante.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {aviso && (
                        <span className={`text-sm font-bold px-3 py-1.5 rounded-lg max-w-md truncate ${
                            aviso.tipo === 'ok'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`} title={aviso.texto}>{aviso.texto}</span>
                    )}
                    <button
                        onClick={cargar}
                        className="flex items-center gap-2 px-4 py-2.5 border border-[#e2e8f0] dark:border-[#374151] text-sm font-bold rounded-xl text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#262626]"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Semáforo. Los contadores no dependen del filtro: son el estado real de todo. */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {FILTROS.map(f => (
                    <button
                        key={f.label}
                        onClick={() => { setStatus(f.id); setPage(1); }}
                        className={`rounded-xl p-3 border text-left transition-all ${
                            status === f.id
                                ? 'border-[#2563eb] ring-2 ring-[#2563eb]/30 bg-white dark:bg-[#1B1C1D]'
                                : 'border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] hover:border-[#2563eb]/50'
                        }`}
                    >
                        <p className={`text-2xl font-black ${f.color}`}>
                            {data ? (f.clave ? data.counts[f.clave] : data.total) : '—'}
                        </p>
                        <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">{f.label}</p>
                    </button>
                ))}
            </div>

            {/* Buscador */}
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                <input
                    type="text"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar por usuario, razón social, documento, serie o id de orden…"
                    className={`${INPUT} pl-10`}
                />
            </div>

            {loading && !data ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />
                </div>
            ) : !data || data.items.length === 0 ? (
                <div className={`${CARD} text-center py-12`}>
                    <p className="text-[#64748b] dark:text-[#94a3b8] font-bold">No hay comprobantes con este filtro</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {data.items.map(fila => (
                        <div key={fila.paymentId} className={`${CARD} !p-4`}>
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black text-[#1e293b] dark:text-[#f8fafc] font-mono">
                                            {fila.number ?? 'sin número'}
                                        </span>
                                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${
                                            ESTADO_ESTILO[fila.status ?? ''] ?? 'bg-[#f1f5f9] dark:bg-[#374151] text-[#64748b] dark:text-[#94a3b8]'
                                        }`}>
                                            {fila.status ?? 'SIN COMPROBANTE'}
                                        </span>
                                        {fila.customerCountry && fila.customerCountry !== 'PE' && (
                                            <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                                EXPORTACIÓN {fila.customerCountry}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        <span className="font-bold">{fila.twitchLogin ?? '—'}</span>
                                        {' · '}{fila.tier ?? '—'}
                                        {fila.billingType === 'permanent' ? ' permanente' : ' mensual'}
                                        {' · '}{fecha(fila.capturedAt)}
                                        {' · '}{fila.provider ?? '—'}
                                    </p>
                                    <p className="text-xs text-[#94a3b8] mt-0.5 truncate">
                                        {fila.customerName ?? 'sin nombre'}
                                        {fila.customerDoc ? ` · ${fila.customerDocType} ${fila.customerDoc}` : ''}
                                        {fila.orderId ? ` · ${fila.orderId}` : ''}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <span className="font-black text-[#1e293b] dark:text-[#f8fafc]">
                                        {fila.currency === 'PEN' ? 'S/' : '$'} {fila.amount.toFixed(2)}
                                    </span>

                                    {fila.canDownload && FORMATOS.map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => bajar(fila, f.id)}
                                            disabled={ocupado === `${f.id}-${fila.paymentId}`}
                                            title={f.hint}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-xs font-bold text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#262626] disabled:opacity-60"
                                        >
                                            {ocupado === `${f.id}-${fila.paymentId}`
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <Download className="w-3.5 h-3.5" />}
                                            {f.label}
                                        </button>
                                    ))}

                                    {fila.status !== 'ACCEPTED' && (
                                        <button
                                            onClick={() => reintentar(fila)}
                                            disabled={ocupado === `retry-${fila.paymentId}`}
                                            title={fila.documentId
                                                ? 'Ya está emitido: solo vuelve a consultar su estado en SUNAT'
                                                : 'Emite el comprobante ahora, sin esperar al job'}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-60"
                                        >
                                            {ocupado === `retry-${fila.paymentId}`
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <RefreshCw className="w-3.5 h-3.5" />}
                                            {fila.documentId ? 'Consultar' : 'Reintentar'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {fila.error && (
                                <div className="mt-3 flex items-start gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span className="break-words">
                                        {fila.error}
                                        <span className="text-[#94a3b8] ml-2">
                                            ({fila.attempts} intento{fila.attempts === 1 ? '' : 's'}, último {fecha(fila.lastAttempt)})
                                        </span>
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}

                    {totalPaginas > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                {data.total} comprobante{data.total === 1 ? '' : 's'} · página {data.page} de {totalPaginas}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-40"
                                >
                                    <ChevronLeft className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPaginas, p + 1))}
                                    disabled={page >= totalPaginas}
                                    className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-40"
                                >
                                    <ChevronRight className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
