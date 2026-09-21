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
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#2563eb]" />
                    <h2 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">Tu comprobante</h2>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />
                    </div>
                )}

                {perfilIncompleto && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>Completá tus datos de facturación antes de comprar. Se piden una sola vez.</span>
                        </div>
                        <button
                            onClick={() => navigate('/me/billing')}
                            className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold py-2.5 rounded-xl transition-colors"
                        >
                            Completar mis datos
                        </button>
                    </div>
                )}

                {error && !perfilIncompleto && (
                    <div className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</div>
                )}

                {!loading && preview && (
                    <>
                        {/* Quien tiene RUC elige; el resto no ve nada de esto. */}
                        {preview.canChooseFactura && (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => onChangeFactura(false)}
                                    className={`py-2 px-3 rounded-xl text-sm font-bold border-2 transition-colors ${!prefiereFactura ? 'border-[#2563eb] text-[#2563eb] bg-[#2563eb]/5' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8]'}`}
                                >
                                    Quiero boleta
                                </button>
                                <button
                                    onClick={() => onChangeFactura(true)}
                                    className={`py-2 px-3 rounded-xl text-sm font-bold border-2 transition-colors ${prefiereFactura ? 'border-[#2563eb] text-[#2563eb] bg-[#2563eb]/5' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8]'}`}
                                >
                                    Quiero factura
                                </button>
                            </div>
                        )}

                        <div className="rounded-xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden text-sm">
                            <div className="bg-[#f8fafc] dark:bg-[#111213] px-4 py-2.5 font-black text-[#1e293b] dark:text-[#f8fafc]">
                                {preview.documentType === 'FACTURA' ? 'Factura electrónica' : 'Boleta de venta electrónica'}
                            </div>
                            <dl className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                                <div className="flex justify-between gap-4 px-4 py-2">
                                    <dt className="text-[#64748b] dark:text-[#94a3b8]">Nombre</dt>
                                    <dd className="font-semibold text-right text-[#1e293b] dark:text-[#f8fafc]">{preview.customerName}</dd>
                                </div>
                                <div className="flex justify-between gap-4 px-4 py-2">
                                    <dt className="text-[#64748b] dark:text-[#94a3b8]">Documento</dt>
                                    <dd className="font-semibold text-right text-[#1e293b] dark:text-[#f8fafc]">{preview.customerDoc}</dd>
                                </div>
                                <div className="flex justify-between gap-4 px-4 py-2">
                                    <dt className="text-[#64748b] dark:text-[#94a3b8]">Subtotal</dt>
                                    <dd className="text-right text-[#1e293b] dark:text-[#f8fafc]">S/ {preview.subtotal?.toFixed(2)}</dd>
                                </div>
                                <div className="flex justify-between gap-4 px-4 py-2">
                                    <dt className="text-[#64748b] dark:text-[#94a3b8]">
                                        IGV {preview.igvRate > 0 ? `${preview.igvRate}%` : ''}
                                    </dt>
                                    <dd className="text-right text-[#1e293b] dark:text-[#f8fafc]">S/ {preview.igv?.toFixed(2)}</dd>
                                </div>
                                <div className="flex justify-between gap-4 px-4 py-2.5 bg-[#f8fafc] dark:bg-[#111213]">
                                    <dt className="font-black text-[#1e293b] dark:text-[#f8fafc]">Total</dt>
                                    <dd className="font-black text-right text-[#1e293b] dark:text-[#f8fafc]">S/ {preview.total?.toFixed(2)}</dd>
                                </div>
                            </dl>
                        </div>

                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{preview.note}</p>

                        {submitError && (
                            <div className="flex items-start gap-2 text-sm font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    <p>{submitError}</p>
                                    <p className="font-normal text-xs mt-1 text-red-600/80 dark:text-red-400/70">
                                        No se te cobró nada. Podés intentar con otra tarjeta o con Yape.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={onCancel}
                                disabled={confirming}
                                className="flex-1 border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={confirming}
                                className="flex-1 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
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
                        className="w-full border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] font-bold py-2.5 rounded-xl"
                    >
                        Cerrar
                    </button>
                )}
            </div>
        </div>
    );
}
