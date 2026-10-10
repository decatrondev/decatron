import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Download, Loader2, Clock, AlertCircle, CheckCircle2, Receipt } from 'lucide-react';
import api from '../../services/api';
import { descargarComprobante, FORMATOS, type FormatoComprobante } from '../../utils/invoiceFiles';

/**
 * Los comprobantes de las compras del usuario: tiers y DecaCoins, mezclados por fecha.
 *
 * Las donaciones no aparecen: son liberalidades y no llevan comprobante, así que no
 * tendría sentido listarlas acá y dejar la fila vacía.
 *
 * Un comprobante puede tardar en salir — se emite fuera del cobro, cada dos minutos — y
 * eso hay que decirlo, no dejar un hueco: quien acaba de pagar entra justo a mirar.
 */

/** Lo que devuelve /supporters/my-invoices. */
interface ComprobanteTier {
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

/** Lo que devuelve /coins/my-invoices. */
interface ComprobanteCoins {
    purchaseId: number;
    coinsReceived: number;
    createdAt: string;
    amount: number;
    currency: string;
    status: string | null;
    type: string | null;
    number: string | null;
    customerName: string | null;
    customerDoc: string | null;
    canDownload: boolean;
}

/** Forma común: la tarjeta es la misma, solo cambia qué se compró y de dónde se baja. */
interface Comprobante {
    key: string;
    /** Qué se compró, en una línea. */
    concepto: string;
    fechaIso: string;
    amount: number;
    currency: string;
    status: string | null;
    type: string | null;
    number: string | null;
    customerName: string | null;
    customerDoc: string | null;
    canDownload: boolean;
    /** URL base de descarga; el formato se agrega al final. */
    downloadBase: string;
    /** Qué se acreditó igual aunque el comprobante falle. */
    yaAcreditado: string;
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
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ds-ok">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Aceptado por SUNAT
            </span>
        );
    }

    if (estado === 'PENDING' || estado === null) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ds-warn">
                <Clock className="w-3.5 h-3.5" />
                Emitiéndose
            </span>
        );
    }

    // REJECTED o ERROR. Al comprador no le sirve el detalle técnico: le sirve saber que
    // alguien lo va a mirar y que no tiene que volver a pagar.
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ds-danger">
            <AlertCircle className="w-3.5 h-3.5" />
            Con un problema
        </span>
    );
}

interface ComprobanteCredits { purchaseId: number; creditsReceived: number; createdAt: string; amount: number; currency: string; status: string | null; type: string | null; number: string | null; canDownload: boolean }

export default function MeInvoices() {
    const [items, setItems]     = useState<Comprobante[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);
    const [bajando, setBajando] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            // Las dos fuentes en paralelo, y si una falla se muestra la otra: es mejor
            // ver la mitad de tus comprobantes que una pantalla de error entera.
            const [tiers, coins, credits] = await Promise.allSettled([
                api.get<ComprobanteTier[]>('/supporters/my-invoices'),
                api.get<ComprobanteCoins[]>('/coins/my-invoices'),
                api.get<ComprobanteCredits[]>('/tts-credits/purchases'),
            ]);

            if (tiers.status === 'rejected' && coins.status === 'rejected' && credits.status === 'rejected') {
                setError('No pudimos cargar tus comprobantes. Intentá de nuevo en un momento.');
                setLoading(false);
                return;
            }

            const deTiers: Comprobante[] = tiers.status === 'fulfilled'
                ? tiers.value.data.map(c => ({
                    key: `tier-${c.paymentId}`,
                    concepto: `${TIER_LABEL[c.tier ?? ''] ?? c.tier ?? 'Tier'}${c.billingType === 'permanent' ? ' — acceso permanente' : ' — 1 mes'}`,
                    fechaIso: c.capturedAt,
                    amount: c.amount,
                    currency: c.currency,
                    status: c.status,
                    type: c.type,
                    number: c.number,
                    customerName: c.customerName,
                    customerDoc: c.customerDoc,
                    canDownload: c.canDownload,
                    downloadBase: `/supporters/my-invoices/${c.paymentId}/download`,
                    yaAcreditado: 'Tu tier está acreditado igual',
                }))
                : [];

            const deCoins: Comprobante[] = coins.status === 'fulfilled'
                ? coins.value.data.map(c => ({
                    key: `coins-${c.purchaseId}`,
                    concepto: `Compra de ${c.coinsReceived.toLocaleString('es-PE')} DecaCoins`,
                    fechaIso: c.createdAt,
                    amount: c.amount,
                    currency: c.currency,
                    status: c.status,
                    type: c.type,
                    number: c.number,
                    customerName: c.customerName,
                    customerDoc: c.customerDoc,
                    canDownload: c.canDownload,
                    downloadBase: `/coins/my-invoices/${c.purchaseId}/download`,
                    yaAcreditado: 'Tus DecaCoins están acreditados igual',
                }))
                : [];

            // Compras de créditos (voz premium, traducción, IA): mismo esquema de comprobante que coins.
            const deCredits: Comprobante[] = credits.status === 'fulfilled'
                ? credits.value.data.filter(c => c.status != null).map(c => ({
                    key: `credits-${c.purchaseId}`,
                    concepto: `Compra de ${c.creditsReceived.toLocaleString('es-PE')} créditos`,
                    fechaIso: c.createdAt,
                    amount: c.amount,
                    currency: c.currency,
                    status: c.status,
                    type: c.type,
                    number: c.number,
                    customerName: null,
                    customerDoc: null,
                    canDownload: c.canDownload,
                    downloadBase: `/tts-credits/purchases/${c.purchaseId}/download`,
                    yaAcreditado: 'Tus créditos están acreditados igual',
                }))
                : [];

            setItems(
                [...deTiers, ...deCoins, ...deCredits].sort(
                    (a, b) => new Date(b.fechaIso).getTime() - new Date(a.fechaIso).getTime()
                )
            );
            setLoading(false);
        })();
    }, []);

    const bajar = async (item: Comprobante, formato: FormatoComprobante) => {
        const clave = `${item.key}-${formato}`;
        setBajando(clave);
        setError(null);
        try {
            await descargarComprobante(item.downloadBase, formato);
        } catch {
            setError('No se pudo descargar el archivo. Si acabás de comprar, esperá un par de minutos.');
        } finally {
            setBajando(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-7 h-7 animate-spin text-ds-accent-text" />
            </div>
        );
    }

    return (
        <div className="panel-scale space-y-6">
            <div>
                <h1 className="text-3xl font-black text-ds-text">Mis comprobantes</h1>
                <p className="text-ds-soft mt-2">
                    Las boletas y facturas de tus compras de tier.{' '}
                    <Link to="/me/billing" className="text-ds-accent-text font-bold hover:underline">
                        Editar mis datos de facturación
                    </Link>
                </p>
            </div>

            {error && (
                <div className="flex items-start gap-2 text-sm text-ds-danger bg-ds-danger/10 border border-ds-danger/40 rounded-lg px-4 py-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {items.length === 0 ? (
                <div className="bg-ds-surface rounded-lg p-10 border border-ds-border text-center">
                    <Receipt className="w-10 h-10 mx-auto mb-3 text-ds-soft" />
                    <p className="font-black text-ds-text">Todavía no compraste ningún tier</p>
                    <p className="text-sm text-ds-soft mt-1">
                        Cuando lo hagas, tu comprobante aparece acá.
                    </p>
                    <Link
                        to="/supporters"
                        className="inline-block mt-5 px-5 py-2.5 rounded-lg bg-ds-accent text-ds-on-accent text-sm font-black hover:bg-ds-accent-hover transition-colors"
                    >
                        Ver los tiers
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map(c => (
                        <div
                            key={c.key}
                            className="bg-ds-surface rounded-lg p-5 border border-ds-border"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="w-4 h-4 text-ds-accent-text shrink-0" />
                                        <h3 className="font-black text-ds-text truncate">
                                            {c.number ?? tipoLabel(c.type)}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-ds-soft">
                                        {c.concepto} · {fecha(c.fechaIso)}
                                    </p>
                                    {c.number && (
                                        <p className="text-xs text-ds-soft mt-0.5">{tipoLabel(c.type)}</p>
                                    )}
                                    {c.customerName && (
                                        <p className="text-xs text-ds-soft mt-0.5">
                                            A nombre de {c.customerName}
                                            {c.customerDoc ? ` · ${c.customerDoc}` : ''}
                                        </p>
                                    )}
                                </div>

                                <div className="text-right shrink-0">
                                    <p className="font-black text-lg text-ds-text">
                                        {importe(c.amount, c.currency)}
                                    </p>
                                    <Estado estado={c.status} />
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-ds-border">
                                {c.canDownload ? (
                                    <div className="flex flex-wrap gap-2">
                                        {FORMATOS.map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => bajar(c, f.id)}
                                                disabled={bajando === `${c.key}-${f.id}`}
                                                title={f.hint}
                                                className={f.id === 'pdf' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                                            >
                                                {bajando === `${c.key}-${f.id}`
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <Download className="w-4 h-4" />}
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-ds-soft">
                                        {c.status === 'PENDING' || c.status === null
                                            ? 'Tu comprobante se está emitiendo. Suele tardar un par de minutos; volvé a entrar y ya va a estar acá.'
                                            : `Hubo un problema al emitir este comprobante. ${c.yaAcreditado} y ya lo estamos revisando — no tenés que hacer nada.`}
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
