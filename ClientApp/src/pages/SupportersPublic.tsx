/**
 * SupportersPublic — Landing page pública de apoyos a Decatron
 * Sin Layout wrapper — accesible sin autenticación
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../services/api';
import {
    SupNav, SupHero, SupWhy, SupFounders, PlanComparison, SupWall, SupFAQ, SupFinalCTA, SupFooter, SupBackdrop,
    type PublicConfig, type PublicSupporter,
} from './supporters-public/parts';

// ─── Types ───────────────────────────────────────────────────────────────────

// ─── Default config (shown when API not ready) ────────────────────────────────

const DEFAULT_CONFIG: PublicConfig = {
    enabled: true,
    title: '',
    tagline: '',
    description: '',
    monthlyGoal: 50,
    monthlyRaised: 0,
    showProgressBar: true,
    showSupportersWall: true,
    showFoundersSection: true,
    heroFrom: '#2563eb',
    heroTo: '#7c3aed',
};

// ─── Tier data ────────────────────────────────────────────────────────────────

interface TierDef {
    id: string;
    name: string;
    badgeEmoji: string;
    color: string;
    bgLight: string;
    bgDark: string;
    borderActive: string;
    textColor: string;
    monthlyPrice: number;
    permanentPrice: number | null;
    highlighted: boolean;
    benefitKeys: string[];
}

const TIERS: TierDef[] = [
    {
        id: 'supporter',
        name: 'Supporter',
        badgeEmoji: '\u26a1',
        color: '#3b82f6',
        bgLight: 'bg-blue-50',
        bgDark: 'dark:bg-blue-950/30',
        borderActive: 'border-blue-400',
        textColor: 'text-blue-600 dark:text-blue-400',
        monthlyPrice: 5,
        permanentPrice: null,
        highlighted: false,
        benefitKeys: [
            'supporterBenefits0',
            'supporterBenefits1',
            'supporterBenefits2',
            'supporterBenefits3',
            'supporterBenefits4',
            'supporterBenefits5',
            'supporterBenefits6',
        ],
    },
    {
        id: 'premium',
        name: 'Premium',
        badgeEmoji: '\ud83d\udc8e',
        color: '#8b5cf6',
        bgLight: 'bg-purple-50',
        bgDark: 'dark:bg-purple-950/30',
        borderActive: 'border-purple-500',
        textColor: 'text-purple-600 dark:text-purple-400',
        monthlyPrice: 15,
        permanentPrice: null,
        highlighted: true,
        benefitKeys: [
            'premiumBenefits0',
            'premiumBenefits1',
            'premiumBenefits2',
            'premiumBenefits3',
            'premiumBenefits4',
            'premiumBenefits5',
            'premiumBenefits6',
        ],
    },
    {
        id: 'fundador',
        name: 'Fundador',
        badgeEmoji: '\ud83c\udf1f',
        color: '#f59e0b',
        bgLight: 'bg-amber-50',
        bgDark: 'dark:bg-amber-950/30',
        borderActive: 'border-amber-400',
        textColor: 'text-amber-600 dark:text-amber-400',
        monthlyPrice: 25,
        permanentPrice: 100,
        highlighted: false,
        benefitKeys: [
            'fundadorBenefits0',
            'fundadorBenefits1',
            'fundadorBenefits2',
            'fundadorBenefits3',
            'fundadorBenefits4',
            'fundadorBenefits5',
        ],
    },
];

// ─── PayPal hook ──────────────────────────────────────────────────────────────

interface CaptureResult {
    success: boolean;
    tierAssigned: boolean;
    tier: string;
    billingType: string;
    isPermanent: boolean;
    message: string;
    duration?: number;
    unit?: string;
}

interface DonationResult {
    success: boolean;
    amount: number;
    message: string;
}

type PayPalResult =
    | { type: 'tier'; data: CaptureResult }
    | { type: 'donation'; data: DonationResult };

function usePayPalReturn(onSuccess: (result: PayPalResult) => void, t: (key: string) => string) {
    useEffect(() => {
        const params  = new URLSearchParams(window.location.search);
        const status  = params.get('pp_status');
        const orderId = params.get('token'); // PayPal appends this

        if (!orderId) return;

        if (status === 'return') {
            // Tier payment return
            const tier    = params.get('pp_tier') ?? '';
            const billing = params.get('pp_billing') ?? '';
            window.history.replaceState({}, '', '/supporters');
            api.post<CaptureResult>('/supporters/capture-paypal-order', {
                orderId, tier, billingType: billing,
            }).then(res => onSuccess({ type: 'tier', data: res.data }))
              .catch(() => alert(t('paypalCaptureError')));
        }

        if (status === 'donation-return') {
            // Free donation return
            const amount = parseFloat(params.get('pp_amount') ?? '0');
            window.history.replaceState({}, '', '/supporters');
            api.post<DonationResult>('/supporters/capture-donation-order', { orderId, amount })
              .then(res => onSuccess({ type: 'donation', data: res.data }))
              .catch(() => alert(t('donationCaptureError')));
        }
    }, [onSuccess]);
}

// ─── Tier Cards ───────────────────────────────────────────────────────────────

/** Fecha corta para contarle al comprador hasta cuándo le llega el tier. */
function fechaCorta(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Qué le hace una compra al tier vigente. Lo calcula el backend en /billing-preview. */
interface TierChange {
    allowed: boolean;
    action: 'nuevo' | 'extiende' | 'sube' | 'baja' | 'yapermanente';
    reason: string | null;
    currentTier: string | null;
    currentExpiresAt: string | null;
    currentIsPermanent: boolean;
    newExpiresAt: string | null;
}

interface DiscountValidation {
    valid: boolean;
    error?: string;
    discountType: string;
    discountValue: number;
    originalAmount: number;
    discountedAmount: number;
    codeId: number;
}

function TierCards() {
    const { t } = useTranslation('supporters');
    const [billingType, setBillingType] = useState<'monthly' | 'permanent'>('monthly');
    const [successTier, setSuccessTier] = useState<string | null>(null);

    /*
        Compra completada. El botón de la tarjeta cambiando a "activado" no alcanzaba: es
        chico, está abajo, y no dice nada del comprobante — que tarda un par de minutos
        porque se emite fuera del cobro. Sin este aviso, quien acaba de pagar entra a
        buscar su factura, no la encuentra y cree que el pago falló.
    */
    const [compraLista, setCompraLista] = useState<string | null>(null);

    // Discount code
    const [showCodeInput, setShowCodeInput] = useState(false);
    const [codeInput, setCodeInput]         = useState('');
    const [validatingCode, setValidatingCode] = useState(false);
    const [codeValidation, setCodeValidation] = useState<DiscountValidation | null>(null);
    const [codeError, setCodeError]           = useState<string | null>(null);

    /*
        Compra en dos pasos: primero la vista previa del comprobante, después Culqi.

        Los datos NO se piden acá. Salen del perfil de facturación del usuario, que se
        completa una sola vez en /me/billing. Pedirlos en medio del pago era el error de
        antes: un comprobante se emite sobre un cobro ya hecho, y si el dato está mal
        cuando llega a SUNAT ya no hay a quién preguntarle.
    */
    const [checkoutTier, setCheckoutTier]     = useState<string | null>(null);
    const [preview, setPreview]               = useState<any | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [needsProfile, setNeedsProfile]     = useState(false);
    const [prefiereFactura, setPrefiereFactura] = useState(false);
    const [checkoutError, setCheckoutError]   = useState<string | null>(null);
    const [needsLogin, setNeedsLogin]         = useState(false);

    /*
        Qué le hace esta compra al tier que ya tiene. Lo decide el backend, que es el único
        que puede saberlo, y se muestra ANTES de pagar: comprar algo que te deja peor de lo
        que estabas no se arregla después del cobro.
    */
    const [tierChange, setTierChange] = useState<TierChange | null>(null);

    const pedirPreview = useCallback(async (tierId: string, factura: boolean) => {
        setPreviewLoading(true);
        setCheckoutError(null);
        try {
            const { data } = await api.post('/supporters/billing-preview', {
                tier: tierId,
                billingType,
                discountCode: codeValidation ? codeInput.trim() : undefined,
                prefiereFactura: factura,
            });
            setPreview(data.preview);
            setTierChange(data.tierChange ?? null);
            setNeedsProfile(false);
        } catch (err: any) {
            // Sin perfil no se puede ni previsualizar: es exactamente lo que falta.
            if (err.response?.data?.error === 'PROFILE_REQUIRED') {
                setNeedsProfile(true);
                setPreview(null);
                setTierChange(null);
            } else {
                setCheckoutError(err.response?.data?.message || err.response?.data?.error || 'No se pudo calcular el comprobante.');
            }
        } finally {
            setPreviewLoading(false);
        }
    }, [billingType, codeValidation, codeInput]);

    const openCheckout = (tierId: string) => {
        setCheckoutTier(tierId);
        setPreview(null);
        setNeedsProfile(false);
        setCheckoutError(null);
        setPrefiereFactura(false);

        // Sin sesión no se llama a la API a propósito: el interceptor de axios manda a
        // /login ante un 401, y el comprador terminaba en Twitch sin entender por qué se
        // fue de la página. Mejor decírselo y que decida él.
        if (!localStorage.getItem('token')) {
            setNeedsLogin(true);
            return;
        }

        setNeedsLogin(false);
        pedirPreview(tierId, false);
    };

    /** Solo quien tiene RUC ve esta opción; al cambiarla se recalcula el comprobante. */
    const cambiarFactura = (factura: boolean) => {
        setPrefiereFactura(factura);
        if (checkoutTier) pedirPreview(checkoutTier, factura);
    };

    const confirmCheckout = () => {
        const tierId = checkoutTier!;
        setCheckoutTier(null);
        handleCulqiSupport(tierId);
    };

    const handleValidateCode = async (tier: string) => {
        if (!codeInput.trim()) return;
        setValidatingCode(true);
        setCodeError(null);
        setCodeValidation(null);
        try {
            const res = await api.get<DiscountValidation>(
                `/supporters/validate-code?code=${encodeURIComponent(codeInput)}&tier=${tier}&billing=${billingType}`
            );
            if (res.data.valid) {
                setCodeValidation(res.data);
            } else {
                setCodeError(res.data.error ?? t('invalidCode'));
            }
        } catch {
            setCodeError(t('codeValidationError'));
        } finally {
            setValidatingCode(false);
        }
    };

    // Reset code when billing type changes
    const handleBillingChange = (type: 'monthly' | 'permanent') => {
        setBillingType(type);
        setCodeValidation(null);
        setCodeError(null);
    };

    const [culqiLoading, setCulqiLoading] = useState<string | null>(null);
    const [paymentError, setPaymentError] = useState<{ tier: string; msg: string } | null>(null);

    const isIntlCardError = (msg: string) =>
        /CVV|cvv|incorrecto|denegad|bloqueada|rechazada|no soportada|internacional/i.test(msg);

    const handleCulqiSupport = async (tierId: string) => {
        setCulqiLoading(tierId);
        setPaymentError(null);
        try {
            // Load Culqi SDK
            await new Promise<void>((resolve, reject) => {
                if ((window as any).CulqiCheckout) { resolve(); return; }
                const existing = document.getElementById('culqi-checkout-js');
                if (existing) {
                    const check = setInterval(() => { if ((window as any).CulqiCheckout) { clearInterval(check); resolve(); } }, 50);
                    setTimeout(() => { clearInterval(check); reject(new Error('Culqi timeout')); }, 10000);
                    return;
                }
                const script = document.createElement('script');
                script.id = 'culqi-checkout-js';
                script.src = 'https://js.culqi.com/checkout-js';
                script.onload = () => {
                    const check = setInterval(() => { if ((window as any).CulqiCheckout) { clearInterval(check); resolve(); } }, 50);
                    setTimeout(() => { clearInterval(check); reject(new Error('Culqi timeout')); }, 10000);
                };
                script.onerror = () => reject(new Error('No se pudo cargar Culqi'));
                document.head.appendChild(script);
            });

            // Get public key
            const { data: keyData } = await api.get('/supporters/culqi-public-key');
            if (!keyData.publicKey) throw new Error('Culqi no configurado');

            // Get tier price
            const tierConfig = TIERS.find(t2 => t2.id === tierId);
            const priceUsd = billingType === 'permanent' ? tierConfig?.permanentPrice : tierConfig?.monthlyPrice;
            if (!priceUsd) { setCulqiLoading(null); return; }

            // Apply discount
            let finalUsd = priceUsd;
            if (codeValidation) {
                finalUsd = codeValidation.discountedAmount;
            }
            const amountPen = Math.round(finalUsd * (keyData.penPerUsd || 3.80) * 100); // centavos PEN

            const config = {
                settings: { title: 'Decatron', currency: 'PEN', amount: amountPen },
                client: { email: '' },
                options: {
                    lang: 'es',
                    modal: true,
                    installments: false,
                    paymentMethods: { tarjeta: true, yape: true, billetera: false, bancaMovil: false, agente: false, cuotealo: false },
                },
            };

            const culqi = new (window as any).CulqiCheckout(keyData.publicKey, config);

            culqi.culqi = async () => {
                if (culqi.token) {
                    const tokenId   = culqi.token.id;
                    const email     = culqi.token.email      || '';
                    const firstName = culqi.token.first_name || '';
                    const lastName  = culqi.token.last_name  || '';
                    culqi.close();
                    setCulqiLoading(tierId);

                    try {
                        const res = await api.post('/supporters/create-culqi-charge', {
                            culqiToken:   tokenId,
                            culqiEmail:   email,
                            tier:         tierId,
                            billingType,
                            discountCode: codeValidation ? codeInput.trim() : undefined,
                            firstName,
                            lastName,
                            // Los datos del comprobante ya no viajan desde acá: el backend
                            // los toma del perfil, que el navegador no puede falsear.
                            prefiereFactura,
                        });
                        if (res.data.success) {
                            setSuccessTier(tierId);
                            setPaymentError(null);
                            setCheckoutTier(null);
                            setCompraLista(tierId);
                        }
                    } catch (err: any) {
                        const msg = err.response?.data?.error || 'Error al procesar el pago con tarjeta';
                        setPaymentError({ tier: tierId, msg });
                    } finally {
                        setCulqiLoading(null);
                    }
                } else if (culqi.error) {
                    const msg = culqi.error.user_message
                        || culqi.error.merchant_message
                        || 'Error al procesar la tarjeta';
                    culqi.close();
                    setCulqiLoading(null);
                    setPaymentError({ tier: tierId, msg });
                }
            };

            culqi.open();
            setCulqiLoading(null);
        } catch (err: any) {
            const msg = err?.message || 'Error al abrir el formulario de pago';
            setPaymentError({ tier: tierId, msg });
            setCulqiLoading(null);
        }
    };

    return (
        <section id="tiers" className="relative z-10 py-20 px-4 sm:px-8 border-t border-pub-border scroll-mt-4">
            <div className="max-w-6xl 3xl:max-w-[1500px] mx-auto">
                <p className="font-mono text-sm text-pub-accent-hi mb-3"># {t('viewPlans').toLowerCase()}</p>
                <h2 className="font-extrabold tracking-tight text-white text-3xl 3xl:text-4xl mb-2">
                    {t('chooseTierTitle')}
                </h2>
                <p className="text-[#8b93a3] mb-8 3xl:text-lg">
                    {t('chooseTierSubtitle')}
                </p>

                {/* Billing toggle */}
                <div className="flex justify-start mb-6">
                    <div className="inline-flex items-center bg-[#f8fafc] dark:bg-pub-bg border border-[#e2e8f0] dark:border-pub-border rounded-xl p-1 gap-0.5">
                        <button
                            onClick={() => handleBillingChange('monthly')}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${billingType === 'monthly' ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-sm' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-white dark:hover:bg-[#374151]'}`}
                        >
                            {t('billingMonthly')}
                        </button>
                        <button
                            onClick={() => handleBillingChange('permanent')}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${billingType === 'permanent' ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-sm' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-white dark:hover:bg-[#374151]'}`}
                        >
                            {t('billingPermanent')}
                            <span className="bg-amber-400 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">&infin;</span>
                        </button>
                    </div>
                </div>

                {/* Discount code */}
                <div className="flex justify-start mb-8">
                    {!showCodeInput ? (
                        <button
                            onClick={() => setShowCodeInput(true)}
                            className="text-xs text-[#64748b] dark:text-[#94a3b8] underline underline-offset-2 hover:text-[#2563eb] transition-colors"
                        >
                            {t('haveDiscountCode')}
                        </button>
                    ) : (
                        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
                            <div className="flex items-center gap-2 w-full">
                                <input
                                    type="text"
                                    value={codeInput}
                                    onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeValidation(null); setCodeError(null); }}
                                    placeholder={t('discountPlaceholder')}
                                    className="flex-1 px-4 py-2 rounded-xl border border-[#e2e8f0] dark:border-pub-border bg-white dark:bg-pub-bg text-[#1e293b] dark:text-[#f8fafc] text-sm font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                                />
                                <button
                                    onClick={() => handleValidateCode(TIERS[0].id)}
                                    disabled={validatingCode || !codeInput.trim()}
                                    className="px-4 py-2 bg-[#2563eb] text-white text-sm font-bold rounded-xl hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors flex items-center gap-1.5"
                                >
                                    {validatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : t('applyCode')}
                                </button>
                                <button
                                    onClick={() => { setShowCodeInput(false); setCodeInput(''); setCodeValidation(null); setCodeError(null); }}
                                    className="text-[#94a3b8] hover:text-[#64748b] text-sm"
                                >&times;</button>
                            </div>
                            {codeValidation && (
                                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-2 rounded-xl text-sm font-semibold">
                                    <Check className="w-4 h-4 shrink-0" />
                                    {codeValidation.discountType === 'percent'
                                        ? t('codeValidPercent', { value: codeValidation.discountValue })
                                        : t('codeValidFixed', { value: codeValidation.discountValue })}
                                </div>
                            )}
                            {codeError && (
                                <div className="text-red-600 dark:text-red-400 text-sm font-semibold">{codeError}</div>
                            )}
                        </div>
                    )}
                </div>

                {/*
                    Vista previa del comprobante, antes de pagar.

                    No pide datos: los muestra. Salen del perfil de facturación, que se
                    completa una sola vez en /me/billing. Lo único que se decide acá es si
                    quien tiene RUC quiere factura o boleta.
                */}
                {checkoutTier && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                        onClick={() => setCheckoutTier(null)}
                    >
                        <div
                            className="w-full max-w-md bg-white dark:bg-pub-bg rounded-2xl p-6 shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-1">
                                {t('previewTitle')}
                            </h3>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-5">
                                {t('previewSubtitle')}
                            </p>

                            {!needsLogin && previewLoading && (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />
                                </div>
                            )}

                            {/* Sin sesión: se explica antes de mandarlo a Twitch. */}
                            {needsLogin && (
                                <div className="space-y-4">
                                    <div className="flex items-start gap-2 text-sm text-[#1e293b] dark:text-[#f8fafc] bg-[#f8fafc] dark:bg-pub-raised border border-[#e2e8f0] dark:border-pub-border rounded-xl px-4 py-3">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#2563eb]" />
                                        <span>{t('previewNeedsLogin')}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setCheckoutTier(null)}
                                            className="flex-1 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-pub-border text-sm font-bold text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#111213] transition-colors"
                                        >
                                            {t('invoiceCancel')}
                                        </button>
                                        {/* El ?redirect= lo lee Login.tsx y devuelve acá al terminar:
                                            sin eso, el comprador se pierde en el dashboard. */}
                                        <a
                                            href="/login?redirect=supporters"
                                            className="flex-1 py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-black text-center hover:bg-[#1d4ed8] transition-colors"
                                        >
                                            {t('previewGoToLogin')}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Sin perfil no se puede comprar: es lo que falta, y se dice. */}
                            {!previewLoading && needsProfile && (
                                <div className="space-y-4">
                                    <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{t('previewNeedsProfile')}</span>
                                    </div>
                                    <a
                                        href="/me/billing"
                                        className="block w-full py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-black text-center hover:bg-[#1d4ed8] transition-colors"
                                    >
                                        {t('previewGoToProfile')}
                                    </a>
                                </div>
                            )}

                            {!previewLoading && checkoutError && (
                                <div className="text-sm font-semibold text-red-600 dark:text-red-400 mb-4">{checkoutError}</div>
                            )}

                            {!previewLoading && preview && (
                                <div className="space-y-4">
                                    {/* Lo que le pasa al tier. Bloqueante en rojo, informativo
                                        en azul: en los dos casos se dice antes de pagar. */}
                                    {tierChange && tierChange.currentTier && (
                                        <div className={`flex items-start gap-2 text-sm rounded-xl px-4 py-3 border ${
                                            tierChange.allowed
                                                ? 'text-[#1e293b] dark:text-[#f8fafc] bg-[#f8fafc] dark:bg-pub-raised border-[#e2e8f0] dark:border-pub-border'
                                                : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                        }`}>
                                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                            <span>
                                                {!tierChange.allowed
                                                    ? tierChange.reason
                                                    : tierChange.action === 'extiende' && tierChange.newExpiresAt
                                                        ? t('tierChangeExtends', {
                                                            tier: tierChange.currentTier,
                                                            hasta: fechaCorta(tierChange.currentExpiresAt),
                                                            nueva: fechaCorta(tierChange.newExpiresAt),
                                                        })
                                                        : t('tierChangeUpgrades', {
                                                            actual: tierChange.currentTier,
                                                            nuevo: checkoutTier ?? '',
                                                        })}
                                            </span>
                                        </div>
                                    )}

                                    {/* Quien tiene RUC elige; el resto no ve nada de esto. */}
                                    {preview.documentType && preview.canChooseFactura && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => cambiarFactura(false)}
                                                className={`py-2 px-3 rounded-xl text-sm font-bold border-2 transition-colors ${!prefiereFactura ? 'border-[#2563eb] text-[#2563eb] bg-[#2563eb]/5' : 'border-[#e2e8f0] dark:border-pub-border text-[#64748b] dark:text-[#94a3b8]'}`}
                                            >
                                                {t('previewWantBoleta')}
                                            </button>
                                            <button
                                                onClick={() => cambiarFactura(true)}
                                                className={`py-2 px-3 rounded-xl text-sm font-bold border-2 transition-colors ${prefiereFactura ? 'border-[#2563eb] text-[#2563eb] bg-[#2563eb]/5' : 'border-[#e2e8f0] dark:border-pub-border text-[#64748b] dark:text-[#94a3b8]'}`}
                                            >
                                                {t('previewWantFactura')}
                                            </button>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-[#e2e8f0] dark:border-pub-border overflow-hidden text-sm">
                                        <div className="bg-[#f8fafc] dark:bg-pub-raised px-4 py-2.5 font-black text-[#1e293b] dark:text-[#f8fafc]">
                                            {preview.documentType === 'FACTURA' ? t('previewDocFactura') : t('previewDocBoleta')}
                                        </div>
                                        <dl className="divide-y divide-[#e2e8f0] dark:divide-pub-border">
                                            <div className="flex justify-between gap-4 px-4 py-2">
                                                <dt className="text-[#64748b] dark:text-[#94a3b8]">{t('previewName')}</dt>
                                                <dd className="font-semibold text-right text-[#1e293b] dark:text-[#f8fafc]">{preview.customerName}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4 px-4 py-2">
                                                <dt className="text-[#64748b] dark:text-[#94a3b8]">{t('previewDoc')}</dt>
                                                <dd className="font-semibold text-right text-[#1e293b] dark:text-[#f8fafc]">{preview.customerDoc}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4 px-4 py-2">
                                                <dt className="text-[#64748b] dark:text-[#94a3b8]">{t('previewSubtotal')}</dt>
                                                <dd className="text-right text-[#1e293b] dark:text-[#f8fafc]">S/ {preview.subtotal?.toFixed(2)}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4 px-4 py-2">
                                                <dt className="text-[#64748b] dark:text-[#94a3b8]">IGV {preview.igvRate > 0 ? `${preview.igvRate}%` : ''}</dt>
                                                <dd className="text-right text-[#1e293b] dark:text-[#f8fafc]">S/ {preview.igv?.toFixed(2)}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4 px-4 py-2.5 bg-[#f8fafc] dark:bg-pub-raised">
                                                <dt className="font-black text-[#1e293b] dark:text-[#f8fafc]">{t('previewTotal')}</dt>
                                                <dd className="font-black text-right text-[#1e293b] dark:text-[#f8fafc]">S/ {preview.total?.toFixed(2)}</dd>
                                            </div>
                                        </dl>
                                    </div>

                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{preview.note}</p>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setCheckoutTier(null)}
                                            className="flex-1 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-pub-border text-sm font-bold text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#111213] transition-colors"
                                        >
                                            {t('invoiceCancel')}
                                        </button>
                                        <button
                                            onClick={confirmCheckout}
                                            disabled={tierChange ? !tierChange.allowed : false}
                                            className="flex-1 py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-black hover:bg-[#1d4ed8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#2563eb]"
                                        >
                                            {t('invoiceContinue')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Compra lista: el tier ya está, el comprobante viene en camino. */}
                {compraLista && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                        onClick={() => setCompraLista(null)}
                    >
                        <div
                            className="w-full max-w-md bg-white dark:bg-pub-bg rounded-2xl p-6 shadow-2xl text-center"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                {t('purchaseDoneTitle')}
                            </h3>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                                {t('purchaseDoneTier', {
                                    tier: TIERS.find(x => x.id === compraLista)?.name ?? compraLista,
                                })}
                            </p>
                            <div className="text-sm text-[#1e293b] dark:text-[#f8fafc] bg-[#f8fafc] dark:bg-pub-raised border border-[#e2e8f0] dark:border-pub-border rounded-xl px-4 py-3 mb-5 text-left">
                                {t('purchaseDoneInvoice')}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <a
                                    href="/me/invoices"
                                    className="flex-1 py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-black hover:bg-[#1d4ed8] transition-colors"
                                >
                                    {t('purchaseDoneGoToInvoices')}
                                </a>
                                <button
                                    onClick={() => setCompraLista(null)}
                                    className="flex-1 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-pub-border text-sm font-bold text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#111213] transition-colors"
                                >
                                    {t('purchaseDoneClose')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    {TIERS.map(tier => {
                        const price = billingType === 'permanent' ? tier.permanentPrice : tier.monthlyPrice;
                        const hasPermanent = tier.permanentPrice !== null;
                        const unavailable = billingType === 'permanent' && !hasPermanent;

                        // Apply discount if code validated (applies to all tiers or this specific tier)
                        const discountedPrice = codeValidation && price !== null
                            ? (codeValidation.discountType === 'percent'
                                ? Math.max(1, Math.round(price * (1 - codeValidation.discountValue / 100) * 100) / 100)
                                : Math.max(1, price - codeValidation.discountValue))
                            : null;

                        return (
                            <div
                                key={tier.id}
                                className={`relative rounded-lg border border-t-[3px] p-6 sm:p-7 transition-colors ${
                                    tier.highlighted ? 'bg-pub-raised' : 'bg-pub-surface'
                                } ${unavailable ? 'opacity-50' : ''}`}
                                style={{ borderColor: tier.highlighted ? `${tier.color}88` : undefined, borderTopColor: tier.color }}
                            >
                                {tier.highlighted && (
                                    <div className="absolute -top-3.5 left-5">
                                        <span
                                            className="text-white text-xs font-black px-4 py-1.5 rounded-full whitespace-nowrap shadow-lg"
                                            style={{ backgroundColor: tier.color }}
                                        >
                                            &#11088; {t('mostPopular')}
                                        </span>
                                    </div>
                                )}

                                {/* Header */}
                                <div className="mb-6">
                                    <h3 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: tier.color }}><span className="mr-2">{tier.badgeEmoji}</span>{tier.name}</h3>

                                    {unavailable ? (
                                        <div className="py-4">
                                            <p className="text-sm text-[#94a3b8]">{t('noPermanentOption')}</p>
                                        </div>
                                    ) : (
                                        <div className="mt-3">
                                            {discountedPrice !== null && discountedPrice !== price ? (
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-4xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                                        ${discountedPrice.toFixed(2)}
                                                    </span>
                                                    <span className="text-lg font-bold text-[#94a3b8] line-through">
                                                        ${price}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-4xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                                    ${price}
                                                </span>
                                            )}
                                            <span className="text-[#64748b] dark:text-[#94a3b8] ml-1 text-sm">
                                                {billingType === 'monthly' ? t('perMonth') : t('oneTime')}
                                            </span>
                                        </div>
                                    )}

                                    {billingType === 'monthly' && tier.permanentPrice && (
                                        <p className="text-xs text-[#94a3b8] mt-1">
                                            {t('orPermanent', { price: tier.permanentPrice })}
                                        </p>
                                    )}
                                </div>

                                {/* Benefits */}
                                <ul className="space-y-3 mb-6">
                                    {tier.benefitKeys.map(key => (
                                        <li key={key} className="flex items-start gap-2.5">
                                            <Check
                                                className="w-4 h-4 mt-0.5 shrink-0"
                                                style={{ color: tier.color }}
                                            />
                                            <span className="text-sm text-[#64748b] dark:text-[#94a3b8] leading-tight">
                                                {t(key)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA Button */}
                                {successTier === tier.id ? (
                                    <div className="w-full py-3 rounded-xl font-black text-sm text-center bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center gap-2">
                                        <CheckCircle className="w-4 h-4" /> {t('tierActivated')}
                                    </div>
                                ) : !unavailable ? (
                                    <button
                                        onClick={() => openCheckout(tier.id)}
                                        disabled={culqiLoading !== null}
                                        className="w-full py-3 rounded-md font-bold text-sm transition-all flex items-center justify-center gap-2 border hover:opacity-90 disabled:opacity-70"
                                        style={tier.highlighted ? { borderColor: tier.color, background: tier.color, color: '#fff' } : { borderColor: `${tier.color}88`, color: tier.color }}
                                    >
                                        {culqiLoading === tier.id ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                                        ) : (
                                            <>💳 {t('culqiButton', { defaultValue: 'Tarjeta / Yape' })}</>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        disabled
                                        className="w-full py-3 rounded-xl font-black text-sm bg-[#f8fafc] dark:bg-pub-surface text-[#94a3b8] cursor-not-allowed"
                                    >
                                        {t('noPermanentOption')}
                                    </button>
                                )}

                                {/* Error inline del pago */}
                                {paymentError?.tier === tier.id && (
                                    <div className="mt-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-left">
                                        <div className="flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                                                    {paymentError.msg}
                                                </p>
                                                {isIntlCardError(paymentError.msg) && (
                                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 leading-relaxed">
                                                        💡 Si tu tarjeta es internacional (USA, Europa), tu banco puede bloquearla al detectar un procesador peruano. Intenta con <strong>Yape</strong> o una tarjeta latinoamericana.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Free notice */}
                <div className="mt-10">
                    <div className="inline-flex items-center gap-2 font-mono text-xs 3xl:text-sm text-[#8b93a3]">
                        <Check className="w-4 h-4 text-emerald-400" />
                        {t('freePlanNotice')}
                    </div>
                </div>
            </div>
        </section>
    );
}

// ─── Free Donation ────────────────────────────────────────────────────────────

function FreeDonation() {
    const { t } = useTranslation('supporters');
    const PRESETS = [1, 3, 5, 10, 20, 50];
    const [amount, setAmount]       = useState<string>('5');
    const [loading, setLoading]     = useState(false);
    const [inputFocused, setFocused] = useState(false);
    const [donateError, setDonateError]     = useState<string | null>(null);
    const [donateSuccess, setDonateSuccess] = useState<string | null>(null);

    const numAmount = parseFloat(amount) || 0;
    const isValid   = numAmount >= 1 && numAmount <= 10000;

    const isIntlCardError = (msg: string) =>
        /CVV|cvv|incorrecto|denegad|bloqueada|rechazada|no soportada|internacional/i.test(msg);

    const handleDonate = async () => {
        if (!isValid) return;
        setLoading(true);
        setDonateError(null);
        setDonateSuccess(null);
        try {
            // Load Culqi SDK
            await new Promise<void>((resolve, reject) => {
                if ((window as any).CulqiCheckout) { resolve(); return; }
                const existing = document.getElementById('culqi-checkout-js');
                if (existing) {
                    const check = setInterval(() => { if ((window as any).CulqiCheckout) { clearInterval(check); resolve(); } }, 50);
                    setTimeout(() => { clearInterval(check); reject(new Error('Culqi timeout')); }, 10000);
                    return;
                }
                const script = document.createElement('script');
                script.id = 'culqi-checkout-js';
                script.src = 'https://js.culqi.com/checkout-js';
                script.onload = () => {
                    const check = setInterval(() => { if ((window as any).CulqiCheckout) { clearInterval(check); resolve(); } }, 50);
                    setTimeout(() => { clearInterval(check); reject(new Error('Culqi timeout')); }, 10000);
                };
                script.onerror = () => reject(new Error('No se pudo cargar Culqi'));
                document.head.appendChild(script);
            });

            const { data: keyData } = await api.get('/supporters/culqi-public-key');
            if (!keyData.publicKey) throw new Error('Culqi no configurado');

            const amountPen = Math.round(numAmount * (keyData.penPerUsd || 3.80) * 100); // centavos PEN

            const config = {
                settings: { title: 'Decatron', currency: 'PEN', amount: amountPen },
                client: { email: '' },
                options: {
                    lang: 'es',
                    modal: true,
                    installments: false,
                    paymentMethods: { tarjeta: true, yape: true, billetera: false, bancaMovil: false, agente: false, cuotealo: false },
                },
            };

            const culqi = new (window as any).CulqiCheckout(keyData.publicKey, config);

            culqi.culqi = async () => {
                if (culqi.token) {
                    const tokenId   = culqi.token.id;
                    const email     = culqi.token.email      || '';
                    const firstName = culqi.token.first_name || '';
                    const lastName  = culqi.token.last_name  || '';
                    culqi.close();
                    setLoading(true);
                    try {
                        const res = await api.post('/supporters/create-culqi-donation', {
                            culqiToken: tokenId,
                            culqiEmail: email,
                            amountUsd:  numAmount,
                            firstName,
                            lastName,
                        });
                        if (res.data.success) {
                            setDonateSuccess(res.data.message || `¡Gracias por tu donación de $${numAmount.toFixed(2)}! ❤️`);
                        }
                    } catch (err: any) {
                        setDonateError(err.response?.data?.error || 'Error al procesar la donación');
                    } finally {
                        setLoading(false);
                    }
                } else if (culqi.error) {
                    const msg = culqi.error.user_message
                        || culqi.error.merchant_message
                        || 'Error al procesar la tarjeta';
                    culqi.close();
                    setLoading(false);
                    setDonateError(msg);
                }
            };

            culqi.open();
            setLoading(false);
        } catch (err: any) {
            setDonateError(err?.message || 'Error al abrir el formulario de pago');
            setLoading(false);
        }
    };

    return (
        <section id="donar" className="relative z-10 py-20 px-4 sm:px-8 border-t border-pub-border scroll-mt-4">
            <div className="max-w-lg mx-auto text-center rounded-lg border border-pub-border bg-pub-surface p-8 sm:p-10">
                <div className="text-4xl mb-3">&#10084;&#65039;</div>
                <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">
                    {t('freeDonateTitle')}
                </h2>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-8 max-w-sm mx-auto">
                    {t('freeDonateSubtitle')}
                </p>

                {/* Preset amounts */}
                <div className="flex flex-wrap justify-center gap-2 mb-5">
                    {PRESETS.map(p => (
                        <button
                            key={p}
                            onClick={() => setAmount(String(p))}
                            className={`px-4 py-2 rounded-xl font-black text-sm transition-all border-2 ${
                                numAmount === p
                                    ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white border-transparent shadow-md'
                                    : 'border-[#e2e8f0] dark:border-pub-border text-[#64748b] dark:text-[#94a3b8] bg-white dark:bg-pub-bg hover:border-[#2563eb] dark:hover:border-[#2563eb]'
                            }`}
                        >
                            ${p}
                        </button>
                    ))}
                </div>

                {/* Custom amount input */}
                <div className={`flex items-center gap-2 max-w-xs mx-auto mb-6 border-2 rounded-2xl px-4 py-3 bg-white dark:bg-pub-bg transition-colors ${
                    inputFocused ? 'border-[#2563eb]' : 'border-[#e2e8f0] dark:border-pub-border'
                }`}>
                    <span className="text-2xl font-black text-[#64748b] dark:text-[#94a3b8]">$</span>
                    <input
                        type="number"
                        min={1}
                        max={10000}
                        step={0.01}
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        placeholder="0.00"
                        className="flex-1 bg-transparent text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] focus:outline-none text-center w-0 min-w-0"
                    />
                    <span className="text-sm text-[#94a3b8] font-bold">USD</span>
                </div>

                <button
                    onClick={handleDonate}
                    disabled={!isValid || loading}
                    className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white font-black py-4 rounded-2xl text-base hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:translate-y-0"
                >
                    {loading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> {t('redirecting')}</>
                    ) : (
                        <>{numAmount >= 1 ? t('donateAmount', { amount: numAmount.toFixed(2) }) : t('enterAmount')} &#10084;&#65039;</>
                    )}
                </button>

                {/* Error de pago inline */}
                {donateError && (
                    <div className="max-w-xs mx-auto mt-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-left">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                                    {donateError}
                                </p>
                                {isIntlCardError(donateError) && (
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 leading-relaxed">
                                        💡 Si tu tarjeta es internacional (USA, Europa), tu banco puede bloquearla al detectar un procesador peruano. Intenta con <strong>Yape</strong> u otra tarjeta latinoamericana.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Éxito de donación */}
                {donateSuccess && (
                    <div className="max-w-xs mx-auto mt-4 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">{donateSuccess}</p>
                    </div>
                )}

                <p className="text-xs text-[#94a3b8] mt-4">
                    {t('securePaypalMin')}
                </p>
            </div>
        </section>
    );
}


// ─── Página ───────────────────────────────────────────────────────────────────

export default function SupportersPublic() {
    const { t } = useTranslation('supporters');
    const [config, setConfig]         = useState<PublicConfig>(DEFAULT_CONFIG);
    const [supporters, setSupporters] = useState<PublicSupporter[]>([]);
    const [loading, setLoading]       = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [cfgRes, supRes] = await Promise.all([
                    api.get<PublicConfig>('/supporters/public-config'),
                    api.get<PublicSupporter[]>('/supporters/list-public'),
                ]);
                setConfig(cfgRes.data);
                setSupporters(supRes.data);
            } catch {
                // Se usan los valores por defecto si el backend no responde
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Siempre oscura, como la portada: el contenedor lleva "dark" para las variantes dark: del cobro
    const shell = 'dark panel-scale min-h-screen bg-pub-bg text-[#e6e9ef] font-onest overflow-x-hidden relative';

    if (!loading && !config.enabled) {
        return (
            <div className={`${shell} flex flex-col`}>
                <SupBackdrop />
                <SupNav />
                <div className="relative z-10 flex-1 flex items-center justify-center px-4 text-center">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">{t('comingSoonTitle')}</h1>
                        <p className="text-[#8b93a3]">{t('comingSoonSubtitle')}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={shell}>
            <SupBackdrop />
            <SupNav />
            <SupHero config={config} supporters={supporters} />
            <SupWhy />
            {config.showFoundersSection && <SupFounders supporters={supporters} />}
            <TierCards />
            <PlanComparison />
            <FreeDonation />
            {config.showSupportersWall && <SupWall supporters={supporters} loading={loading} />}
            <SupFAQ />
            <SupFinalCTA />
            <SupFooter />
        </div>
    );
}
