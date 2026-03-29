/**
 * SupportersPublic — Landing page pública de apoyos a Decatron
 * Sin Layout wrapper — accesible sin autenticación
 */

import { useState, useEffect, useCallback } from 'react';
import { Bot, Heart, Star, Check, ChevronDown, ChevronUp, ExternalLink, Zap, Loader2 } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PublicConfig {
    enabled: boolean;
    title: string;
    tagline: string;
    description: string;
    monthlyGoal: number;
    monthlyRaised: number;
    showProgressBar: boolean;
    showSupportersWall: boolean;
    showFoundersSection: boolean;
    heroFrom: string;
    heroTo: string;
}

interface PublicSupporter {
    displayName: string;
    twitchLogin: string;
    tier: string;
    isPermanent: boolean;
    joinedAt: string;
}

// ─── Default config (shown when API not ready) ────────────────────────────────

const DEFAULT_CONFIG: PublicConfig = {
    enabled: true,
    title: 'Apoya a Decatron',
    tagline: 'Ayuda a mantener el bot gratuito para todos',
    description: 'Decatron es completamente gratuito. Si quieres apoyar el desarrollo y los costos del servidor, puedes hacerlo desde aquí. Como agradecimiento, recibes beneficios exclusivos en el bot.',
    monthlyGoal: 50,
    monthlyRaised: 0,
    showProgressBar: true,
    showSupportersWall: true,
    showFoundersSection: true,
    heroFrom: '#2563eb',
    heroTo: '#7c3aed',
};

// ─── Tier data ────────────────────────────────────────────────────────────────

const TIERS = [
    {
        id: 'supporter',
        name: 'Supporter',
        badgeEmoji: '⚡',
        color: '#3b82f6',
        bgLight: 'bg-blue-50',
        bgDark: 'dark:bg-blue-950/30',
        borderActive: 'border-blue-400',
        textColor: 'text-blue-600 dark:text-blue-400',
        monthlyPrice: 5,
        permanentPrice: null as number | null,
        highlighted: false,
        benefits: [
            '50 comandos personalizados',
            '10 variantes por alerta',
            '2 overlays por tipo',
            'AI Commands',
            'Analytics 90 días',
            'Timer history 90 días',
            'Badge ⚡ en la página pública',
        ],
    },
    {
        id: 'premium',
        name: 'Premium',
        badgeEmoji: '💎',
        color: '#8b5cf6',
        bgLight: 'bg-purple-50',
        bgDark: 'dark:bg-purple-950/30',
        borderActive: 'border-purple-500',
        textColor: 'text-purple-600 dark:text-purple-400',
        monthlyPrice: 15,
        permanentPrice: null as number | null,
        highlighted: true,
        benefits: [
            '100 comandos personalizados',
            '15 variantes por alerta',
            '4 overlays por tipo',
            'AI Commands',
            'Analytics 365 días + exportar CSV',
            'Timer history 365 días + backups',
            'Badge 💎 en la página pública',
        ],
    },
    {
        id: 'fundador',
        name: 'Fundador',
        badgeEmoji: '🌟',
        color: '#f59e0b',
        bgLight: 'bg-amber-50',
        bgDark: 'dark:bg-amber-950/30',
        borderActive: 'border-amber-400',
        textColor: 'text-amber-600 dark:text-amber-400',
        monthlyPrice: 25,
        permanentPrice: 100,
        highlighted: false,
        benefits: [
            'Comandos, variantes y overlays ilimitados',
            'Analytics y timer history ilimitados',
            'AI Commands',
            'Sugerencias con prioridad en el roadmap',
            'Sección especial de Fundadores',
            'Badge 🌟 FUNDADOR exclusivo permanente',
        ],
    },
];

const FAQ = [
    {
        q: '¿El bot es de pago?',
        a: 'No. Decatron es 100% gratuito para todos los streamers de Twitch. Las donaciones son voluntarias para apoyar el desarrollo y cubrir los costos del servidor.',
    },
    {
        q: '¿Qué pasa si cancelo mi suscripción mensual?',
        a: 'Tu tier vuelve automáticamente al plan gratuito cuando vence el período. No se realiza ningún cargo adicional.',
    },
    {
        q: '¿Los pagos son seguros?',
        a: 'Sí. Todos los pagos se procesan a través de PayPal, que cuenta con protección al comprador y cifrado de datos.',
    },
    {
        q: '¿Los beneficios se activan automáticamente?',
        a: 'Sí. Una vez confirmado el pago, los beneficios se aplican automáticamente a tu cuenta de Decatron en cuestión de minutos.',
    },
    {
        q: '¿Puedo cambiar de tier mensual a permanente después?',
        a: 'Claro. Puedes actualizar en cualquier momento. Si ya tienes un plan mensual activo, puedes pasarte al plan permanente y no necesitarás pagar mensualmente nunca más.',
    },
    {
        q: '¿Hay reembolsos?',
        a: 'Puedes solicitar un reembolso dentro de los 7 días posteriores al pago si los beneficios no se activaron correctamente. Contáctanos en Discord.',
    },
];

const WHY_SUPPORT = [
    {
        icon: '🖥️',
        title: 'Costos del servidor',
        desc: 'Mantener Decatron funcionando 24/7 tiene costos de infraestructura reales. Tu apoyo cubre los servidores.',
    },
    {
        icon: '⚡',
        title: 'Nuevas funciones',
        desc: 'Cada donación acelera el desarrollo de nuevas funciones. ¡Los Fundadores tienen voz en el roadmap!',
    },
    {
        icon: '🆓',
        title: 'Gratis para todos',
        desc: 'Tu apoyo hace posible que Decatron sea gratuito para toda la comunidad de streamers. Gracias.',
    },
];

// ─── Nav ──────────────────────────────────────────────────────────────────────

function SupportersNav() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        setIsLoggedIn(!!token);
    }, []);

    return (
        <nav className="sticky top-0 z-50 bg-white/95 dark:bg-[#1B1C1D]/95 backdrop-blur-sm border-b border-[#e2e8f0] dark:border-[#374151] shadow-sm">
            <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
                <a href="/" className="flex items-center gap-2 text-xl font-black text-[#2563eb]">
                    <Bot className="w-7 h-7" />
                    <span>Decatron</span>
                </a>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    {isLoggedIn ? (
                        <a
                            href="/dashboard"
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold rounded-xl hover:from-[#1d4ed8] hover:to-[#2563eb] transition-all"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Dashboard
                        </a>
                    ) : (
                        <a
                            href="/login"
                            className="px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] text-sm font-bold rounded-xl hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                        >
                            Acceder
                        </a>
                    )}
                </div>
            </div>
        </nav>
    );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ config }: { config: PublicConfig }) {
    const progress = config.monthlyGoal > 0
        ? Math.min(100, (config.monthlyRaised / config.monthlyGoal) * 100)
        : 0;

    return (
        <section
            className="relative overflow-hidden py-24 px-4 text-white text-center"
            style={{ background: `linear-gradient(135deg, ${config.heroFrom} 0%, ${config.heroTo} 100%)` }}
        >
            {/* Decorative circles */}
            <div className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: 'white', transform: 'translate(-30%, -30%)' }} />
            <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: 'white', transform: 'translate(30%, 30%)' }} />

            <div className="relative max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5 text-sm font-semibold mb-6">
                    <Heart className="w-4 h-4 text-pink-300" />
                    Apoya el desarrollo gratuito
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-4 leading-tight">
                    {config.title}
                </h1>
                <p className="text-xl text-white/80 mb-8 max-w-xl mx-auto">
                    {config.tagline}
                </p>
                <p className="text-base text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed">
                    {config.description}
                </p>

                {/* Progress bar */}
                {config.showProgressBar && config.monthlyGoal > 0 && (
                    <div className="max-w-md mx-auto mb-10">
                        <div className="flex justify-between text-sm text-white/80 mb-2 font-semibold">
                            <span>Recaudado este mes: <strong className="text-white">${config.monthlyRaised}</strong></span>
                            <span>Objetivo: <strong className="text-white">${config.monthlyGoal}</strong></span>
                        </div>
                        <div className="h-4 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full transition-all duration-1000"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-sm text-white/70 mt-2">{progress.toFixed(0)}% del objetivo mensual alcanzado</p>
                    </div>
                )}

                <a
                    href="#tiers"
                    className="inline-flex items-center gap-2 bg-white text-[#2563eb] font-black px-8 py-4 rounded-2xl hover:bg-white/90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                >
                    <Star className="w-5 h-5" />
                    Ver tiers de apoyo
                </a>
            </div>
        </section>
    );
}

// ─── Why Support ──────────────────────────────────────────────────────────────

function WhySupport() {
    return (
        <section className="py-16 px-4 bg-[#f8fafc] dark:bg-[#1B1C1D]">
            <div className="max-w-5xl mx-auto">
                <h2 className="text-3xl font-black text-center text-[#1e293b] dark:text-[#f8fafc] mb-3">
                    ¿Por qué apoyar?
                </h2>
                <p className="text-center text-[#64748b] dark:text-[#94a3b8] mb-12 max-w-xl mx-auto">
                    Tu apoyo tiene un impacto directo en Decatron y en la comunidad
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {WHY_SUPPORT.map(item => (
                        <div
                            key={item.title}
                            className="bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-6 shadow-sm text-center hover:shadow-md transition-shadow"
                        >
                            <div className="text-4xl mb-4">{item.icon}</div>
                            <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">{item.title}</h3>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── PayPal hook ──────────────────────────────────────────────────────────────

interface CaptureResult {
    success: boolean;
    tierAssigned: boolean;
    tier: string;
    billingType: string;
    isPermanent: boolean;
    message: string;
}

interface DonationResult {
    success: boolean;
    amount: number;
    message: string;
}

type PayPalResult =
    | { type: 'tier'; data: CaptureResult }
    | { type: 'donation'; data: DonationResult };

function usePayPalReturn(onSuccess: (result: PayPalResult) => void) {
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
              .catch(() => alert('Hubo un error al confirmar el pago. Contacta a @decatron en Discord.'));
        }

        if (status === 'donation-return') {
            // Free donation return
            const amount = parseFloat(params.get('pp_amount') ?? '0');
            window.history.replaceState({}, '', '/supporters');
            api.post<DonationResult>('/supporters/capture-donation-order', { orderId, amount })
              .then(res => onSuccess({ type: 'donation', data: res.data }))
              .catch(() => alert('Hubo un error al confirmar la donación. Contacta a @decatron en Discord.'));
        }
    }, [onSuccess]);
}

// ─── Tier Cards ───────────────────────────────────────────────────────────────

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
    const [billingType, setBillingType] = useState<'monthly' | 'permanent'>('monthly');
    const [loadingTier, setLoadingTier] = useState<string | null>(null);
    const [successTier, setSuccessTier] = useState<string | null>(null);

    // Discount code
    const [showCodeInput, setShowCodeInput] = useState(false);
    const [codeInput, setCodeInput]         = useState('');
    const [validatingCode, setValidatingCode] = useState(false);
    const [codeValidation, setCodeValidation] = useState<DiscountValidation | null>(null);
    const [codeError, setCodeError]           = useState<string | null>(null);

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
                setCodeError(res.data.error ?? 'Código inválido');
            }
        } catch {
            setCodeError('Error al validar el código');
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

    const handleSupport = async (tierId: string, basePrice: number) => {
        setLoadingTier(tierId);
        try {
            const res = await api.post<{ orderId: string; approvalUrl: string }>(
                '/supporters/create-paypal-order',
                {
                    tier: tierId,
                    billingType,
                    discountCode: codeValidation ? codeInput.trim() : undefined,
                },
            );
            window.location.href = res.data.approvalUrl;
        } catch {
            alert('Error al conectar con PayPal. Intenta de nuevo.');
            setLoadingTier(null);
        }
    };

    return (
        <section id="tiers" className="py-20 px-4 bg-white dark:bg-[#262626]">
            <div className="max-w-5xl mx-auto">
                <h2 className="text-3xl font-black text-center text-[#1e293b] dark:text-[#f8fafc] mb-3">
                    Elige tu nivel de apoyo
                </h2>
                <p className="text-center text-[#64748b] dark:text-[#94a3b8] mb-8">
                    Todos los pagos son seguros y procesados por PayPal
                </p>

                {/* Billing toggle */}
                <div className="flex justify-center mb-6">
                    <div className="inline-flex items-center bg-[#f8fafc] dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl p-1 gap-0.5">
                        <button
                            onClick={() => handleBillingChange('monthly')}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${billingType === 'monthly' ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-sm' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-white dark:hover:bg-[#374151]'}`}
                        >
                            Mensual
                        </button>
                        <button
                            onClick={() => handleBillingChange('permanent')}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${billingType === 'permanent' ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-sm' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-white dark:hover:bg-[#374151]'}`}
                        >
                            Permanente
                            <span className="bg-amber-400 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">∞</span>
                        </button>
                    </div>
                </div>

                {/* Discount code */}
                <div className="flex justify-center mb-8">
                    {!showCodeInput ? (
                        <button
                            onClick={() => setShowCodeInput(true)}
                            className="text-xs text-[#64748b] dark:text-[#94a3b8] underline underline-offset-2 hover:text-[#2563eb] transition-colors"
                        >
                            ¿Tienes un código de descuento?
                        </button>
                    ) : (
                        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
                            <div className="flex items-center gap-2 w-full">
                                <input
                                    type="text"
                                    value={codeInput}
                                    onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeValidation(null); setCodeError(null); }}
                                    placeholder="CÓDIGO DE DESCUENTO"
                                    className="flex-1 px-4 py-2 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] text-sm font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                                />
                                <button
                                    onClick={() => handleValidateCode(TIERS[0].id)}
                                    disabled={validatingCode || !codeInput.trim()}
                                    className="px-4 py-2 bg-[#2563eb] text-white text-sm font-bold rounded-xl hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors flex items-center gap-1.5"
                                >
                                    {validatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                                </button>
                                <button
                                    onClick={() => { setShowCodeInput(false); setCodeInput(''); setCodeValidation(null); setCodeError(null); }}
                                    className="text-[#94a3b8] hover:text-[#64748b] text-sm"
                                >✕</button>
                            </div>
                            {codeValidation && (
                                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-2 rounded-xl text-sm font-semibold">
                                    <Check className="w-4 h-4 shrink-0" />
                                    ¡Código válido! {codeValidation.discountType === 'percent' ? `${codeValidation.discountValue}% de descuento` : `$${codeValidation.discountValue} de descuento`}
                                </div>
                            )}
                            {codeError && (
                                <div className="text-red-600 dark:text-red-400 text-sm font-semibold">{codeError}</div>
                            )}
                        </div>
                    )}
                </div>

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
                                className={`relative rounded-2xl border-2 p-6 transition-all ${
                                    tier.highlighted
                                        ? `border-2 shadow-xl scale-[1.02] ${tier.bgLight} ${tier.bgDark}`
                                        : `border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] hover:shadow-md`
                                } ${unavailable ? 'opacity-50' : ''}`}
                                style={tier.highlighted ? { borderColor: tier.color } : {}}
                            >
                                {tier.highlighted && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                        <span
                                            className="text-white text-xs font-black px-4 py-1.5 rounded-full whitespace-nowrap shadow-lg"
                                            style={{ backgroundColor: tier.color }}
                                        >
                                            ⭐ Más popular
                                        </span>
                                    </div>
                                )}

                                {/* Header */}
                                <div className="text-center mb-6">
                                    <div className="text-4xl mb-2">{tier.badgeEmoji}</div>
                                    <h3 className={`text-2xl font-black mb-1 ${tier.textColor}`}>{tier.name}</h3>

                                    {unavailable ? (
                                        <div className="py-4">
                                            <p className="text-sm text-[#94a3b8]">Sin opción permanente</p>
                                        </div>
                                    ) : (
                                        <div className="mt-3">
                                            {discountedPrice !== null && discountedPrice !== price ? (
                                                <div className="flex items-baseline justify-center gap-2">
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
                                                {billingType === 'monthly' ? '/mes' : 'único'}
                                            </span>
                                        </div>
                                    )}

                                    {billingType === 'monthly' && tier.permanentPrice && (
                                        <p className="text-xs text-[#94a3b8] mt-1">
                                            o ${tier.permanentPrice} permanente
                                        </p>
                                    )}
                                </div>

                                {/* Benefits */}
                                <ul className="space-y-3 mb-6">
                                    {tier.benefits.map(benefit => (
                                        <li key={benefit} className="flex items-start gap-2.5">
                                            <Check
                                                className="w-4 h-4 mt-0.5 shrink-0"
                                                style={{ color: tier.color }}
                                            />
                                            <span className="text-sm text-[#64748b] dark:text-[#94a3b8] leading-tight">
                                                {benefit}
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA Button */}
                                {successTier === tier.id ? (
                                    <div className="w-full py-3 rounded-xl font-black text-sm text-center bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                        ✅ ¡Tier activado!
                                    </div>
                                ) : !unavailable ? (
                                    <button
                                        onClick={() => handleSupport(tier.id, price ?? 0)}
                                        disabled={loadingTier !== null}
                                        className={`w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                                            tier.highlighted
                                                ? 'text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                                                : 'text-white hover:opacity-90'
                                        } disabled:opacity-70`}
                                        style={{ backgroundColor: tier.color }}
                                    >
                                        {loadingTier === tier.id ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Redirigiendo a PayPal...</>
                                        ) : discountedPrice !== null && discountedPrice !== price ? (
                                            `Apoyar con $${discountedPrice.toFixed(2)}${billingType === 'monthly' ? '/mes' : ' (único)'}`
                                        ) : (
                                            `Apoyar con $${price}${billingType === 'monthly' ? '/mes' : ' (único)'}`
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        disabled
                                        className="w-full py-3 rounded-xl font-black text-sm bg-[#f8fafc] dark:bg-[#262626] text-[#94a3b8] cursor-not-allowed"
                                    >
                                        Sin opción permanente
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Free notice */}
                <div className="mt-10 text-center">
                    <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-5 py-3 rounded-xl text-sm font-semibold">
                        <Zap className="w-4 h-4" />
                        El plan gratuito incluye: 25 comandos, 5 variantes, 1 overlay por tipo, scripting avanzado y más.
                    </div>
                </div>
            </div>
        </section>
    );
}

// ─── Free Donation ────────────────────────────────────────────────────────────

function FreeDonation() {
    const PRESETS = [1, 3, 5, 10, 20, 50];
    const [amount, setAmount]     = useState<string>('5');
    const [loading, setLoading]   = useState(false);
    const [inputFocused, setFocused] = useState(false);

    const numAmount = parseFloat(amount) || 0;
    const isValid   = numAmount >= 1 && numAmount <= 10000;

    const handleDonate = async () => {
        if (!isValid) return;
        setLoading(true);
        try {
            const res = await api.post<{ approvalUrl: string }>(
                '/supporters/create-donation-order',
                { amount: numAmount },
            );
            window.location.href = res.data.approvalUrl;
        } catch {
            alert('Error al conectar con PayPal. Intenta de nuevo.');
            setLoading(false);
        }
    };

    return (
        <section className="py-16 px-4 bg-[#f8fafc] dark:bg-[#262626]">
            <div className="max-w-lg mx-auto text-center">
                <div className="text-4xl mb-3">❤️</div>
                <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">
                    Donar libremente
                </h2>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-8 max-w-sm mx-auto">
                    Sin tiers ni beneficios. Solo apoya el proyecto con lo que quieras.
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
                                    : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] bg-white dark:bg-[#1B1C1D] hover:border-[#2563eb] dark:hover:border-[#2563eb]'
                            }`}
                        >
                            ${p}
                        </button>
                    ))}
                </div>

                {/* Custom amount input */}
                <div className={`flex items-center gap-2 max-w-xs mx-auto mb-6 border-2 rounded-2xl px-4 py-3 bg-white dark:bg-[#1B1C1D] transition-colors ${
                    inputFocused ? 'border-[#2563eb]' : 'border-[#e2e8f0] dark:border-[#374151]'
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
                    className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 bg-gradient-to-r from-[#ec4899] to-[#f43f5e] text-white font-black py-4 rounded-2xl text-base hover:from-[#db2777] hover:to-[#e11d48] disabled:opacity-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:translate-y-0"
                >
                    {loading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Redirigiendo...</>
                    ) : (
                        <>{numAmount >= 1 ? `Donar $${numAmount.toFixed(2)}` : 'Ingresa un monto'} ❤️</>
                    )}
                </button>

                <p className="text-xs text-[#94a3b8] mt-4">
                    Pago seguro via PayPal · Mínimo $1
                </p>
            </div>
        </section>
    );
}

// ─── Founders Section ─────────────────────────────────────────────────────────

function FoundersSection({ supporters }: { supporters: PublicSupporter[] }) {
    const founders = supporters.filter(s => s.tier === 'fundador' && s.isPermanent);

    if (founders.length === 0) return (
        <section className="py-16 px-4 bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/20 dark:to-[#1B1C1D]">
            <div className="max-w-5xl mx-auto text-center">
                <div className="text-5xl mb-3">🌟</div>
                <h2 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">Fundadores</h2>
                <p className="text-[#64748b] dark:text-[#94a3b8] mb-8">
                    Sé el primero en apoyar Decatron permanentemente y tu nombre estará aquí para siempre.
                </p>
                <div className="inline-block border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-2xl px-10 py-8 text-center">
                    <div className="text-3xl mb-2">✨</div>
                    <p className="text-sm font-bold text-[#94a3b8]">Tu nombre podría estar aquí</p>
                </div>
            </div>
        </section>
    );

    return (
        <section className="py-16 px-4 bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/20 dark:to-[#1B1C1D]">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-10">
                    <div className="text-5xl mb-3">🌟</div>
                    <h2 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">Fundadores</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">
                        Quienes hacen posible que Decatron exista
                    </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {founders.map(f => (
                        <div
                            key={f.twitchLogin}
                            className="bg-white dark:bg-[#1B1C1D] border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-2xl font-black mx-auto mb-3 shadow-lg">
                                {f.displayName.charAt(0).toUpperCase()}
                            </div>
                            <p className="font-black text-sm text-[#1e293b] dark:text-[#f8fafc] truncate">{f.displayName}</p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">🌟 Fundador</p>
                            <p className="text-[10px] text-[#94a3b8] mt-0.5">∞ Permanente</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── Supporters Wall ──────────────────────────────────────────────────────────

const TIER_BADGE: Record<string, { label: string; bg: string; text: string }> = {
    supporter: { label: '⚡ Supporter', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
    premium: { label: '💎 Premium', bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300' },
    fundador: { label: '🌟 Fundador', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
};

const AVATAR_GRADIENTS = [
    'from-[#2563eb] to-[#7c3aed]',
    'from-[#7c3aed] to-[#db2777]',
    'from-[#059669] to-[#2563eb]',
    'from-[#d97706] to-[#dc2626]',
    'from-[#0891b2] to-[#7c3aed]',
];

function SupportersWall({ supporters, loading }: { supporters: PublicSupporter[]; loading: boolean }) {
    const active = supporters.filter(s => !s.isPermanent);

    return (
        <section className="py-16 px-4 bg-[#f8fafc] dark:bg-[#262626]">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">
                        Supporters activos
                    </h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">
                        Gracias a todos por hacer posible que Decatron sea gratuito
                    </p>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {[...Array(12)].map((_, i) => (
                            <div key={i} className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-4 text-center animate-pulse">
                                <div className="w-12 h-12 rounded-full bg-[#e2e8f0] dark:bg-[#374151] mx-auto mb-2" />
                                <div className="h-3 bg-[#e2e8f0] dark:bg-[#374151] rounded mx-auto w-16 mb-1" />
                                <div className="h-3 bg-[#e2e8f0] dark:bg-[#374151] rounded mx-auto w-12" />
                            </div>
                        ))}
                    </div>
                ) : active.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-3">❤️</div>
                        <p className="font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">Aún no hay supporters activos</p>
                        <p className="text-sm text-[#94a3b8]">¡Sé el primero en apoyar el proyecto!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {active.map((s, i) => {
                            const badge = TIER_BADGE[s.tier];
                            const grad = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length];
                            return (
                                <div
                                    key={s.twitchLogin}
                                    className="bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4 text-center hover:shadow-md transition-all hover:-translate-y-0.5 group"
                                >
                                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-lg font-black mx-auto mb-2 shadow-sm group-hover:scale-110 transition-transform`}>
                                        {s.displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <p className="font-bold text-xs text-[#1e293b] dark:text-[#f8fafc] truncate">{s.displayName}</p>
                                    {badge && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text} mt-1 inline-block`}>
                                            {badge.label}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQSection() {
    const [open, setOpen] = useState<number | null>(null);

    return (
        <section className="py-16 px-4 bg-white dark:bg-[#1B1C1D]">
            <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl font-black text-center text-[#1e293b] dark:text-[#f8fafc] mb-10">
                    Preguntas frecuentes
                </h2>
                <div className="space-y-3">
                    {FAQ.map((item, i) => (
                        <div
                            key={i}
                            className="border border-[#e2e8f0] dark:border-[#374151] rounded-xl overflow-hidden"
                        >
                            <button
                                onClick={() => setOpen(open === i ? null : i)}
                                className="w-full flex items-center justify-between px-5 py-4 text-left bg-white dark:bg-[#1B1C1D] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                            >
                                <span className="font-bold text-[#1e293b] dark:text-[#f8fafc] pr-4">{item.q}</span>
                                {open === i
                                    ? <ChevronUp className="w-5 h-5 text-[#64748b] shrink-0" />
                                    : <ChevronDown className="w-5 h-5 text-[#64748b] shrink-0" />
                                }
                            </button>
                            {open === i && (
                                <div className="px-5 pb-5 bg-[#f8fafc] dark:bg-[#262626] border-t border-[#e2e8f0] dark:border-[#374151]">
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] pt-4 leading-relaxed">{item.a}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── Footer CTA ───────────────────────────────────────────────────────────────

function FooterCTA({ config }: { config: PublicConfig }) {
    return (
        <section
            className="py-16 px-4 text-white text-center"
            style={{ background: `linear-gradient(135deg, ${config.heroFrom} 0%, ${config.heroTo} 100%)` }}
        >
            <div className="max-w-2xl mx-auto">
                <div className="text-5xl mb-4">❤️</div>
                <h2 className="text-3xl font-black mb-3">Juntos hacemos posible Decatron</h2>
                <p className="text-white/80 mb-8">
                    Cada donación, por pequeña que sea, tiene un impacto real en el proyecto.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a
                        href="#tiers"
                        className="inline-flex items-center justify-center gap-2 bg-white text-[#2563eb] font-black px-8 py-3.5 rounded-xl hover:bg-white/90 transition-all shadow-lg"
                    >
                        <Star className="w-5 h-5" />
                        Apoyar ahora
                    </a>
                    <a
                        href="/"
                        className="inline-flex items-center justify-center gap-2 bg-white/20 border border-white/40 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-white/30 transition-all"
                    >
                        <Bot className="w-5 h-5" />
                        Ir a Decatron
                    </a>
                </div>
            </div>
        </section>
    );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function PageFooter() {
    return (
        <footer className="bg-white dark:bg-[#1B1C1D] border-t border-[#e2e8f0] dark:border-[#374151] py-8 px-4 text-center">
            <div className="flex items-center justify-center gap-2 text-[#2563eb] font-black mb-2">
                <Bot className="w-5 h-5" />
                <span>Decatron</span>
            </div>
            <p className="text-xs text-[#94a3b8]">
                Los pagos se procesan de forma segura por PayPal ·{' '}
                <a href="/tip/privacy" className="hover:text-[#64748b] underline">Privacidad</a>
                {' '}·{' '}
                <a href="/tip/terms" className="hover:text-[#64748b] underline">Términos</a>
            </p>
        </footer>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SupportersPublic() {
    const [config, setConfig]         = useState<PublicConfig>(DEFAULT_CONFIG);
    const [supporters, setSupporters] = useState<PublicSupporter[]>([]);
    const [loading, setLoading]       = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [paypalResult, setPaypalResult] = useState<PayPalResult | null>(null);

    useEffect(() => {
        setIsLoggedIn(!!localStorage.getItem('token'));

        const load = async () => {
            try {
                const [cfgRes, supRes] = await Promise.all([
                    api.get<PublicConfig>('/supporters/public-config'),
                    api.get<PublicSupporter[]>('/supporters/list-public'),
                ]);
                setConfig(cfgRes.data);
                setSupporters(supRes.data);
            } catch {
                // Use defaults — backend not ready yet
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handlePayPalSuccess = useCallback((result: PayPalResult) => {
        setPaypalResult(result);
    }, []);

    usePayPalReturn(handlePayPalSuccess);

    // If not enabled, show a simple "coming soon" message
    if (!loading && !config.enabled) {
        return (
            <div className="min-h-screen bg-[#f8fafc] dark:bg-[#1B1C1D] flex flex-col">
                <SupportersNav />
                <div className="flex-1 flex items-center justify-center px-4">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🚧</div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">Próximamente</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">La página de apoyos estará disponible pronto.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-[#1B1C1D]">
            <SupportersNav />

            {/* PayPal result banner */}
            {paypalResult?.type === 'donation' && (
                <div className="bg-pink-600 text-white px-4 py-4 text-center">
                    <p className="font-black text-lg">❤️ {paypalResult.data.message}</p>
                    <p className="text-sm text-pink-100 mt-1">Tu apoyo hace posible que Decatron sea gratuito para todos.</p>
                </div>
            )}
            {paypalResult?.type === 'tier' && (
                paypalResult.data.tierAssigned ? (
                    <div className="bg-green-600 text-white px-4 py-4 text-center">
                        <p className="font-black text-lg">
                            🎉 ¡Gracias por tu apoyo! Tier <strong>{paypalResult.data.tier}</strong>{' '}
                            {paypalResult.data.isPermanent
                                ? 'activado permanentemente'
                                : `activado por ${paypalResult.data.duration ?? 30} ${paypalResult.data.unit ?? 'días'}`}.
                        </p>
                        <p className="text-sm text-green-100 mt-1">Los beneficios ya están activos en tu cuenta de Decatron.</p>
                    </div>
                ) : (
                    <div className="bg-blue-600 text-white px-4 py-5 text-center">
                        <p className="font-black text-lg">🙏 ¡Gracias por apoyar Decatron!</p>
                        <p className="text-sm text-blue-100 mt-1 mb-3">
                            Tu pago fue recibido. Para activar los beneficios del tier <strong>{paypalResult.data.tier}</strong>,
                            inicia sesión con tu cuenta de Decatron.
                        </p>
                        {!isLoggedIn && (
                            <a
                                href="/api/auth/login"
                                className="inline-flex items-center gap-2 bg-white text-blue-600 font-black px-5 py-2 rounded-xl text-sm hover:bg-blue-50 transition-colors shadow"
                            >
                                Conectar cuenta con Twitch
                            </a>
                        )}
                    </div>
                )
            )}

            <Hero config={config} />
            <WhySupport />
            <FreeDonation />
            <TierCards />
            {config.showFoundersSection && <FoundersSection supporters={supporters} />}
            {config.showSupportersWall && <SupportersWall supporters={supporters} loading={loading} />}
            <FAQSection />
            <FooterCTA config={config} />
            <PageFooter />
        </div>
    );
}
