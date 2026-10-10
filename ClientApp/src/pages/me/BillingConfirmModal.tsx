import { Loader2, FileText, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Qué comprobante va a salir, mostrado ANTES de pagar. El backend lo calcula con las
// mismas reglas que usa al emitir (ver BillingProfileService.Preview), así que lo que
// se ve acá es exactamente lo que después llega: si dice factura sin IGV, eso sale.

export interface ComprobantePreview {
    documentType: string;
    customerName: string;
    customerDoc: string | null;
    country: string;
    esExportacion: boolean;
    canChooseFactura: boolean;
    currency: string;
    subtotal: number;
    igv: number;
    total: number;
    igvRate: number;
    note: string;
}

interface Props {
    preview: ComprobantePreview | null;
    loading: boolean;
    /** 'PROFILE_REQUIRED' cuando todavía no completó sus datos de facturación. */
    error: string | null;
    /**
     * Lo que falló al intentar cobrar (tarjeta rechazada, etc). Va acá adentro y no en
     * un toast: el comprador está mirando este modal, no la esquina de la pantalla.
     */
    submitError: string | null;
    prefiereFactura: boolean;
    onChangeFactura: (value: boolean) => void;
    onConfirm: () => void;
    onCancel: () => void;
    confirming: boolean;
}

export default function BillingConfirmModal({
    preview, loading, error, submitError, prefiereFactura, onChangeFactura, onConfirm, onCancel, confirming,
}: Props) {
    const navigate = useNavigate();
    const perfilIncompleto = error === 'PROFILE_REQUIRED';

    return (
        <div className="fixed inset-0 z-[90] bg-ds-input/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-ds-surface border border-ds-border rounded-lg w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-ds-accent-text" />
                    <h2 className="text-lg font-black text-ds-text">Tu comprobante</h2>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-ds-accent-text" />
                    </div>
                )}

                {perfilIncompleto && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-2 text-sm text-ds-warn bg-ds-warn/10 border border-ds-warn/40 rounded-lg px-4 py-3">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>Completá tus datos de facturación antes de comprar. Se piden una sola vez.</span>
                        </div>
                        <button
                            onClick={() => navigate('/me/billing')}
                            className="ds-btn ds-btn--primary w-full"
                        >
                            Completar mis datos
                        </button>
                    </div>
                )}

                {error && !perfilIncompleto && (
                    <div className="text-sm font-semibold text-ds-danger">{error}</div>
                )}

                {!loading && preview && (
                    <>
                        {/* Quien tiene RUC elige; el resto no ve nada de esto. */}
                        {preview.canChooseFactura && (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => onChangeFactura(false)}
                                    className={`py-2 px-3 rounded-lg text-sm font-bold border-2 transition-colors ${!prefiereFactura ? 'border-ds-accent text-ds-accent-text bg-ds-accent/5' : 'border-ds-border text-ds-soft '}`}
                                >
                                    Quiero boleta
                                </button>
                                <button
                                    onClick={() => onChangeFactura(true)}
                                    className={`py-2 px-3 rounded-lg text-sm font-bold border-2 transition-colors ${prefiereFactura ? 'border-ds-accent text-ds-accent-text bg-ds-accent/5' : 'border-ds-border text-ds-soft '}`}
                                >
                                    Quiero factura
                                </button>
                            </div>
                        )}

                        <div className="rounded-lg border border-ds-border overflow-hidden text-sm">
                            <div className="bg-ds-bg px-4 py-2.5 font-black text-ds-text">
                                {preview.documentType === 'FACTURA' ? 'Factura electrónica' : 'Boleta de venta electrónica'}
                            </div>
                            <dl className="divide-y divide-ds-border">
                                <div className="flex justify-between gap-4 px-4 py-2">
                                    <dt className="text-ds-soft">Nombre</dt>
                                    <dd className="font-semibold text-right text-ds-text">{preview.customerName}</dd>
                                </div>
                                <div className="flex justify-between gap-4 px-4 py-2">
                                    <dt className="text-ds-soft">Documento</dt>
                                    <dd className="font-semibold text-right text-ds-text">{preview.customerDoc}</dd>
                                </div>
                                <div className="flex justify-between gap-4 px-4 py-2">
                                    <dt className="text-ds-soft">Subtotal</dt>
                                    <dd className="text-right text-ds-text">S/ {preview.subtotal?.toFixed(2)}</dd>
                                </div>
                                <div className="flex justify-between gap-4 px-4 py-2">
                                    <dt className="text-ds-soft">
                                        IGV {preview.igvRate > 0 ? `${preview.igvRate}%` : ''}
                                    </dt>
                                    <dd className="text-right text-ds-text">S/ {preview.igv?.toFixed(2)}</dd>
                                </div>
                                <div className="flex justify-between gap-4 px-4 py-2.5 bg-ds-bg">
                                    <dt className="font-black text-ds-text">Total</dt>
                                    <dd className="font-black text-right text-ds-text">S/ {preview.total?.toFixed(2)}</dd>
                                </div>
                            </dl>
                        </div>

                        <p className="text-xs text-ds-soft">{preview.note}</p>

                        {submitError && (
                            <div className="flex items-start gap-2 text-sm font-semibold text-ds-danger bg-ds-danger/10 border border-ds-danger/40 rounded-lg px-4 py-3">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    <p>{submitError}</p>
                                    <p className="font-normal text-xs mt-1 text-ds-danger/80">
                                        No se te cobró nada. Podés intentar con otra tarjeta o con Yape.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={onCancel}
                                disabled={confirming}
                                className="ds-btn ds-btn--secondary flex-1"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={confirming}
                                className="ds-btn ds-btn--primary flex-1"
                            >
                                {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {submitError ? 'Reintentar' : 'Pagar'}
                            </button>
                        </div>
                    </>
                )}

                {!loading && !preview && !error && (
                    <button
                        onClick={onCancel}
                        className="ds-btn ds-btn--secondary w-full"
                    >
                        Cerrar
                    </button>
                )}
            </div>
        </div>
    );
}
