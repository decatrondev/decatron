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
    { id: null, label: 'Todos', clave: null, color: 'text-ds-text ' },
    { id: 'ACCEPTED', label: 'Aceptados', clave: 'accepted', color: 'text-ds-ok ' },
    { id: 'PENDING', label: 'Pendientes', clave: 'pending', color: 'text-ds-warn ' },
    { id: 'REJECTED', label: 'Rechazados', clave: 'rejected', color: 'text-ds-danger ' },
    { id: 'ERROR', label: 'Con error', clave: 'error', color: 'text-ds-danger ' },
];

const ESTADO_ESTILO: Record<string, string> = {
    ACCEPTED: 'bg-ds-ok/10 text-ds-ok ',
    PENDING: 'bg-ds-warn/10 text-ds-warn ',
    REJECTED: 'bg-ds-danger/10 text-ds-danger ',
    ERROR: 'bg-ds-danger/10 text-ds-danger ',
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
                    <h3 className="font-black text-ds-text text-lg">Comprobantes</h3>
                    <p className="text-sm text-ds-soft mt-0.5">
                        Boletas y facturas de las compras de tier. Las donaciones no llevan comprobante.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {aviso && (
                        <span className={`text-sm font-bold px-3 py-1.5 rounded-lg max-w-md truncate ${
                            aviso.tipo === 'ok'
                                ? 'bg-ds-ok/10 text-ds-ok '
                                : 'bg-ds-danger/10 text-ds-danger '
                        }`} title={aviso.texto}>{aviso.texto}</span>
                    )}
                    <button
                        onClick={cargar}
                        className="flex items-center gap-2 px-4 py-2.5 border border-ds-border text-sm font-bold rounded-lg text-ds-soft hover:bg-ds-bg"
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
                        className={`rounded-lg p-3 border text-left transition-all ${
                            status === f.id
                                ? 'border-ds-accent ring-2 ring-ds-accent/30 bg-ds-surface '
                                : 'border-ds-border bg-ds-surface hover:border-ds-accent/50'
                        }`}
                    >
                        <p className={`text-2xl font-black ${f.color}`}>
                            {data ? (f.clave ? data.counts[f.clave] : data.total) : '—'}
                        </p>
                        <p className="text-xs font-bold text-ds-soft">{f.label}</p>
                    </button>
                ))}
            </div>

            {/* Buscador */}
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ds-soft" />
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
                    <Loader2 className="w-6 h-6 animate-spin text-ds-accent-text" />
                </div>
            ) : !data || data.items.length === 0 ? (
                <div className={`${CARD} text-center py-12`}>
                    <p className="text-ds-soft font-bold">No hay comprobantes con este filtro</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {data.items.map(fila => (
                        <div key={fila.paymentId} className={`${CARD} !p-4`}>
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black text-ds-text font-mono">
                                            {fila.number ?? 'sin número'}
                                        </span>
                                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${
                                            ESTADO_ESTILO[fila.status ?? ''] ?? 'bg-ds-raised text-ds-soft '
                                        }`}>
                                            {fila.status ?? 'SIN COMPROBANTE'}
                                        </span>
                                        {fila.customerCountry && fila.customerCountry !== 'PE' && (
                                            <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-ds-accent/10 text-ds-accent-text">
                                                EXPORTACIÓN {fila.customerCountry}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-ds-soft mt-1">
                                        <span className="font-bold">{fila.twitchLogin ?? '—'}</span>
                                        {' · '}{fila.tier ?? '—'}
                                        {fila.billingType === 'permanent' ? ' permanente' : ' mensual'}
                                        {' · '}{fecha(fila.capturedAt)}
                                        {' · '}{fila.provider ?? '—'}
                                    </p>
                                    <p className="text-xs text-ds-soft mt-0.5 truncate">
                                        {fila.customerName ?? 'sin nombre'}
                                        {fila.customerDoc ? ` · ${fila.customerDocType} ${fila.customerDoc}` : ''}
                                        {fila.orderId ? ` · ${fila.orderId}` : ''}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <span className="font-black text-ds-text">
                                        {fila.currency === 'PEN' ? 'S/' : '$'} {fila.amount.toFixed(2)}
                                    </span>

                                    {fila.canDownload && FORMATOS.map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => bajar(fila, f.id)}
                                            disabled={ocupado === `${f.id}-${fila.paymentId}`}
                                            title={f.hint}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-ds-border text-xs font-bold text-ds-soft hover:bg-ds-bg disabled:opacity-60"
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
                                            className="ds-btn ds-btn--primary ds-btn--sm"
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
                                <div className="mt-3 flex items-start gap-2 text-xs text-ds-danger bg-ds-danger/10 border border-ds-danger/40 rounded-lg px-3 py-2">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span className="break-words">
                                        {fila.error}
                                        <span className="text-ds-soft ml-2">
                                            ({fila.attempts} intento{fila.attempts === 1 ? '' : 's'}, último {fecha(fila.lastAttempt)})
                                        </span>
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}

                    {totalPaginas > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-sm text-ds-soft">
                                {data.total} comprobante{data.total === 1 ? '' : 's'} · página {data.page} de {totalPaginas}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="p-2 rounded-lg border border-ds-border disabled:opacity-40"
                                >
                                    <ChevronLeft className="w-4 h-4 text-ds-soft" />
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPaginas, p + 1))}
                                    disabled={page >= totalPaginas}
                                    className="p-2 rounded-lg border border-ds-border disabled:opacity-40"
                                >
                                    <ChevronRight className="w-4 h-4 text-ds-soft" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
