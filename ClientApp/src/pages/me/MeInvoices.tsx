import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Download, Loader2, Clock, AlertCircle, CheckCircle2, Receipt } from 'lucide-react';
import api from '../../services/api';
import { descargarComprobante, FORMATOS, type FormatoComprobante } from '../../utils/invoiceFiles';

/**
 * Los comprobantes de las compras del usuario.
 *
 * Solo aparecen las compras de tier: las donaciones son liberalidades y no llevan
 * comprobante, así que no tendría sentido listarlas acá y dejar la fila vacía.
 *
 * Un comprobante puede tardar en salir — se emite fuera del cobro, cada dos minutos — y
 * eso hay que decirlo, no dejar un hueco: quien acaba de pagar entra justo a mirar.
 */

interface Comprobante {
    paymentId: number;
    tier: string | null;
    billingType: string | null;
    capturedAt: string;
    amount: number;
    currency: string;
    status: string | null;
    type: string | null;
    number: string | null;
    customerName: string | null;
    customerDoc: string | null;
    canDownload: boolean;
}

const TIER_LABEL: Record<string, string> = {
    supporter: 'Supporter',
    premium: 'Premium',
    fundador: 'Fundador',
};

function fecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function importe(monto: number, moneda: string): string {
    return `${moneda === 'PEN' ? 'S/' : '$'} ${monto.toFixed(2)}`;
}

function tipoLabel(tipo: string | null): string {
    if (!tipo) return 'Comprobante';
    if (tipo.toUpperCase().includes('BOLETA')) return 'Boleta de venta electrónica';
    if (tipo.toUpperCase().includes('FACTURA')) return 'Factura electrónica';
    return tipo;
}

/** El estado del comprobante contado como se lo cuenta a quien pagó, no como lo guarda SUNAT. */
function Estado({ estado }: { estado: string | null }) {
    if (estado === 'ACCEPTED') {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Aceptado por SUNAT
            </span>
        );
    }

    if (estado === 'PENDING' || estado === null) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                Emitiéndose
            </span>
        );
    }

    // REJECTED o ERROR. Al comprador no le sirve el detalle técnico: le sirve saber que
    // alguien lo va a mirar y que no tiene que volver a pagar.
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5" />
            Con un problema
        </span>
    );
}

export default function MeInvoices() {
    const [items, setItems]     = useState<Comprobante[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);
    const [bajando, setBajando] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get<Comprobante[]>('/supporters/my-invoices');
                setItems(data);
            } catch {
                setError('No pudimos cargar tus comprobantes. Intentá de nuevo en un momento.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const bajar = async (paymentId: number, formato: FormatoComprobante) => {
        const clave = `${paymentId}-${formato}`;
        setBajando(clave);
        setError(null);
        try {
            await descargarComprobante(`/supporters/my-invoices/${paymentId}/download`, formato);
        } catch {
            setError('No se pudo descargar el archivo. Si acabás de comprar, esperá un par de minutos.');
        } finally {
            setBajando(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-7 h-7 animate-spin text-[#2563eb]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Mis comprobantes</h1>
                <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">
                    Las boletas y facturas de tus compras de tier.{' '}
                    <Link to="/me/billing" className="text-[#2563eb] font-bold hover:underline">
                        Editar mis datos de facturación
                    </Link>
                </p>
            </div>

            {error && (
                <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {items.length === 0 ? (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-10 border border-[#e2e8f0] dark:border-[#374151] text-center">
                    <Receipt className="w-10 h-10 mx-auto mb-3 text-[#94a3b8]" />
                    <p className="font-black text-[#1e293b] dark:text-[#f8fafc]">Todavía no compraste ningún tier</p>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                        Cuando lo hagas, tu comprobante aparece acá.
                    </p>
                    <Link
                        to="/supporters"
                        className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-black hover:bg-[#1d4ed8] transition-colors"
                    >
                        Ver los tiers
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map(c => (
                        <div
                            key={c.paymentId}
                            className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-5 border border-[#e2e8f0] dark:border-[#374151]"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="w-4 h-4 text-[#2563eb] shrink-0" />
                                        <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc] truncate">
                                            {c.number ?? tipoLabel(c.type)}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                        {TIER_LABEL[c.tier ?? ''] ?? c.tier ?? 'Tier'}
                                        {c.billingType === 'permanent' ? ' — acceso permanente' : ' — 1 mes'}
                                        {' · '}
                                        {fecha(c.capturedAt)}
                                    </p>
                                    {c.number && (
                                        <p className="text-xs text-[#94a3b8] mt-0.5">{tipoLabel(c.type)}</p>
                                    )}
                                    {c.customerName && (
                                        <p className="text-xs text-[#94a3b8] mt-0.5">
                                            A nombre de {c.customerName}
                                            {c.customerDoc ? ` · ${c.customerDoc}` : ''}
                                        </p>
                                    )}
                                </div>

                                <div className="text-right shrink-0">
                                    <p className="font-black text-lg text-[#1e293b] dark:text-[#f8fafc]">
                                        {importe(c.amount, c.currency)}
                                    </p>
                                    <Estado estado={c.status} />
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                                {c.canDownload ? (
                                    <div className="flex flex-wrap gap-2">
                                        {FORMATOS.map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => bajar(c.paymentId, f.id)}
                                                disabled={bajando === `${c.paymentId}-${f.id}`}
                                                title={f.hint}
                                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 ${
                                                    f.id === 'pdf'
                                                        ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]'
                                                        : 'border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#111213]'
                                                }`}
                                            >
                                                {bajando === `${c.paymentId}-${f.id}`
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <Download className="w-4 h-4" />}
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                        {c.status === 'PENDING' || c.status === null
                                            ? 'Tu comprobante se está emitiendo. Suele tardar un par de minutos; volvé a entrar y ya va a estar acá.'
                                            : 'Hubo un problema al emitir este comprobante. Tu tier está acreditado igual y ya lo estamos revisando — no tenés que hacer nada.'}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
