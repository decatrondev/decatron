/**
 * Compra de paquetes de créditos: paquetes desde la DB, confirmación del comprobante
 * (BillingConfirmModal, igual que DecaCoins), cobro con Culqi y lista de compras con
 * descarga del comprobante. Plan CREDITOS_UNIFICADOS, fase 4.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Loader2, Check, X, Download, Star } from 'lucide-react';
import api from '../../services/api';
import { openCulqiCheckout } from '../../services/culqi';
import { descargarComprobante } from '../../utils/invoiceFiles';
import BillingConfirmModal, { type ComprobantePreview } from '../me/BillingConfirmModal';

interface Package { id: number; name: string; description: string | null; credits: number; bonusCredits: number; total: number; priceUsd: number; highlight: boolean; perMillionUsd: number }
interface Purchase { purchaseId: number; creditsReceived: number; createdAt: string; amount: number; currency: string; priceUsd: number; isTest: boolean; status: string | null; type: string | null; number: string | null; canDownload: boolean }

const card = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]';
const muted = 'text-sm text-[#64748b] dark:text-[#94a3b8]';
const h2 = 'text-lg font-black text-[#1e293b] dark:text-[#f8fafc]';

export default function BuyCreditsSection({ canBuy, onPurchased }: { canBuy: boolean; onPurchased: () => void }) {
    const { t } = useTranslation('features', { keyPrefix: 'credits.buy' });
    const [packages, setPackages] = useState<Package[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [pending, setPending] = useState<Package | null>(null);
    const [preview, setPreview] = useState<ComprobantePreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [prefiereFactura, setPrefiereFactura] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
    const [downloading, setDownloading] = useState<number | null>(null);

    const load = useCallback(async () => {
        try {
            const [p, h] = await Promise.all([api.get('/tts-credits/packages'), api.get('/tts-credits/purchases')]);
            setPackages(p.data); setPurchases(h.data);
        } catch { /* la página principal ya avisa */ }
    }, []);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 8000); return () => clearTimeout(id); }, [toast]);

    const pedirPreview = async (pkg: Package, factura: boolean) => {
        setPreviewLoading(true); setPreviewError(null); setPreview(null);
        try { const r = await api.post('/tts-credits/billing-preview', { packageId: pkg.id, prefiereFactura: factura }); setPreview(r.data.preview); }
        catch (err: any) { setPreviewError(err?.response?.data?.error || t('previewError')); }
        finally { setPreviewLoading(false); }
    };
    const iniciar = async (pkg: Package) => { setPrefiereFactura(false); setSubmitError(null); setPending(pkg); await pedirPreview(pkg, false); };
    const cambiarFactura = async (v: boolean) => { if (!pending) return; setPrefiereFactura(v); setSubmitError(null); await pedirPreview(pending, v); };
    const cancelar = () => { setPending(null); setPreview(null); setPreviewError(null); setSubmitError(null); };

    // Confirmado el comprobante: recién acá se abre Culqi y se cobra.
    const confirmar = async () => {
        if (!pending) return;
        setConfirming(true); setSubmitError(null);
        try {
            const c = await openCulqiCheckout(pending.priceUsd, `Decatron — ${t('checkoutTitle')}`);
            const r = await api.post('/tts-credits/buy', { packageId: pending.id, prefiereFactura, culqiToken: c.token, culqiEmail: c.email, firstName: c.firstName, lastName: c.lastName });
            setToast({ ok: true, text: t('success', { n: r.data.creditsReceived.toLocaleString() }) });
            setPending(null); setPreview(null);
            onPurchased(); load();
        } catch (err: any) {
            setSubmitError(err?.response?.data?.error || err?.message || t('error'));
        } finally { setConfirming(false); }
    };

    const descargar = async (p: Purchase) => {
        setDownloading(p.purchaseId);
        try { await descargarComprobante(`/tts-credits/purchases/${p.purchaseId}/download`, 'pdf'); }
        catch { setToast({ ok: false, text: t('downloadError') }); }
        finally { setDownloading(null); }
    };

    return (
        <>
            {pending && <BillingConfirmModal preview={preview} loading={previewLoading} error={previewError} submitError={submitError} prefiereFactura={prefiereFactura} onChangeFactura={cambiarFactura} onConfirm={confirmar} onCancel={cancelar} confirming={confirming} />}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 max-w-sm flex items-start gap-2 px-4 py-3 rounded-xl shadow-2xl font-semibold text-white ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.ok ? <Check className="w-5 h-5 shrink-0" /> : <X className="w-5 h-5 shrink-0" />}<p>{toast.text}</p>
                </div>
            )}

            <div id="buy" className={card}>
                <div className="flex items-center gap-2 mb-1"><ShoppingBag className="w-5 h-5 text-[#9146FF]" /><h2 className={h2}>{t('title')}</h2></div>
                <p className={`${muted} mb-4`}>{t('hint')}</p>
                {!canBuy && <p className="text-sm text-amber-500 mb-4">{t('onlyOwner')}</p>}
                <div className="grid sm:grid-cols-3 gap-4">
                    {packages.map(p => (
                        <div key={p.id} className={`relative p-5 rounded-xl border ${p.highlight ? 'border-[#9146FF] bg-[#9146FF]/5' : 'border-[#e2e8f0] dark:border-[#374151]'} flex flex-col`}>
                            {p.highlight && <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#9146FF] text-white text-[10px] font-bold uppercase"><Star className="w-3 h-3" /> {t('popular')}</span>}
                            <div className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{p.name}</div>
                            <div className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] mt-1">{p.total.toLocaleString()}</div>
                            <div className={muted}>{t('credits')}{p.bonusCredits > 0 && <> · {t('bonus', { n: p.bonusCredits.toLocaleString() })}</>}</div>
                            {p.description && <p className={`${muted} mt-2 flex-1`}>{p.description}</p>}
                            <div className="mt-4 flex items-end justify-between gap-2">
                                <div>
                                    <div className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">${p.priceUsd.toFixed(2)}</div>
                                    <div className="text-[11px] text-[#94a3b8]">{t('perMillion', { usd: p.perMillionUsd.toFixed(0) })}</div>
                                </div>
                                <button onClick={() => iniciar(p)} disabled={!canBuy || confirming} className="px-4 py-2 rounded-lg bg-[#9146FF] hover:bg-[#7c3aed] disabled:opacity-50 text-white text-sm font-bold">{confirming && pending?.id === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t('buy')}</button>
                            </div>
                        </div>
                    ))}
                    {packages.length === 0 && <p className={muted}>{t('noPackages')}</p>}
                </div>
                <p className={`${muted} mt-4 text-xs`}>{t('legal')}</p>
            </div>

            {purchases.length > 0 && (
                <div className={card}>
                    <h2 className={`${h2} mb-4`}>{t('purchasesTitle')}</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-[#64748b] dark:text-[#94a3b8]"><th className="py-1 font-medium">{t('col.when')}</th><th className="py-1 font-medium">{t('col.credits')}</th><th className="py-1 font-medium">{t('col.paid')}</th><th className="py-1 font-medium">{t('col.invoice')}</th><th className="py-1 font-medium text-right"></th></tr></thead>
                            <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                                {purchases.map(p => (
                                    <tr key={p.purchaseId} className="border-t border-[#f1f5f9] dark:border-[#26262c]">
                                        <td className="py-1.5 text-xs whitespace-nowrap">{new Date(p.createdAt).toLocaleString()}</td>
                                        <td className="font-mono text-xs">+{p.creditsReceived.toLocaleString()}</td>
                                        <td className="text-xs">{p.currency === 'PEN' ? 'S/ ' : '$'}{p.amount.toFixed(2)} <span className={muted}>(${p.priceUsd.toFixed(2)})</span>{p.isTest && <span className="ml-1 text-[10px] uppercase text-amber-500">test</span>}</td>
                                        <td className="text-xs">{p.number ? <>{p.type === 'FACTURA' ? t('factura') : t('boleta')} {p.number}</> : p.status === 'PENDING' ? <span className={muted}>{t('invoicePending')}</span> : p.status === 'ERROR' ? <span className="text-red-500">{t('invoiceError')}</span> : <span className={muted}>—</span>}</td>
                                        <td className="text-right">{p.canDownload && <button onClick={() => descargar(p)} disabled={downloading === p.purchaseId} className="inline-flex items-center gap-1 text-xs text-[#9146FF] hover:underline disabled:opacity-50">{downloading === p.purchaseId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF</button>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
}
