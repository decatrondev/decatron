/**
 * SupportersPublic — Landing page pública de apoyos a Decatron
 * Sin Layout wrapper — accesible sin autenticación
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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

// ─── Nav ──────────────────────────────────────────────────────────────────────

function SupportersNav() {
    const { t } = useTranslation('supporters');
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
                            {t('navDashboard')}
                        </a>
                    ) : (
                        <a
                            href="/login"
                            className="px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] text-sm font-bold rounded-xl hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                        >
                            {t('navLogin')}
                        </a>
                    )}
                </div>
            </div>
        </nav>
    );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ config }: { config: PublicConfig }) {
    const { t } = useTranslation('supporters');
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
                    {t('heroSupportBadge')}
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-4 leading-tight">
                    {config.title || t('defaultTitle')}
                </h1>
                <p className="text-xl text-white/80 mb-8 max-w-xl mx-auto">
                    {config.tagline || t('defaultTagline')}
                </p>
                <p className="text-base text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed">
                    {config.description || t('defaultDescription')}
                </p>

                {/* Progress bar */}
                {config.showProgressBar && config.monthlyGoal > 0 && (
                    <div className="max-w-md mx-auto mb-10">
                        <div className="flex justify-between text-sm text-white/80 mb-2 font-semibold">
                            <span>{t('raisedThisMonth')} <strong className="text-white">${config.monthlyRaised}</strong></span>
                            <span>{t('goal')} <strong className="text-white">${config.monthlyGoal}</strong></span>
                        </div>
                        <div className="h-4 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full transition-all duration-1000"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-sm text-white/70 mt-2">{t('monthlyGoalProgress', { progress: progress.toFixed(0) })}</p>
                    </div>
                )}

                <a
                    href="#tiers"
                    className="inline-flex items-center gap-2 bg-white text-[#2563eb] font-black px-8 py-4 rounded-2xl hover:bg-white/90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                >
                    <Star className="w-5 h-5" />
                    {t('viewTiers')}
                </a>
            </div>
        </section>
    );
}

// ─── Why Support ──────────────────────────────────────────────────────────────

function WhySupport() {
    const { t } = useTranslation('supporters');

    const WHY_SUPPORT = [
        {
            icon: '\ud83d\udda5\ufe0f',
            titleKey: 'whyServerCostsTitle',
            descKey: 'whyServerCostsDesc',
        },
        {
            icon: '\u26a1',
            titleKey: 'whyNewFeaturesTitle',
            descKey: 'whyNewFeaturesDesc',
        },
        {
            icon: '\ud83c\udd93',
            titleKey: 'whyFreeForAllTitle',
            descKey: 'whyFreeForAllDesc',
        },
    ];

    return (
        <section className="py-16 px-4 bg-[#f8fafc] dark:bg-[#1B1C1D]">
            <div className="max-w-5xl mx-auto">
                <h2 className="text-3xl font-black text-center text-[#1e293b] dark:text-[#f8fafc] mb-3">
                    {t('whySupportTitle')}
                </h2>
                <p className="text-center text-[#64748b] dark:text-[#94a3b8] mb-12 max-w-xl mx-auto">
                    {t('whySupportSubtitle')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {WHY_SUPPORT.map(item => (
                        <div
                            key={item.titleKey}
                            className="bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-6 shadow-sm text-center hover:shadow-md transition-shadow"
                        >
                            <div className="text-4xl mb-4">{item.icon}</div>
                            <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">{t(item.titleKey)}</h3>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] leading-relaxed">{t(item.descKey)}</p>
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
            alert(t('paypalConnectError'));
            setLoadingTier(null);
        }
    };

    return (
        <section id="tiers" className="py-20 px-4 bg-white dark:bg-[#262626]">
            <div className="max-w-5xl mx-auto">
                <h2 className="text-3xl font-black text-center text-[#1e293b] dark:text-[#f8fafc] mb-3">
                    {t('chooseTierTitle')}
                </h2>
                <p className="text-center text-[#64748b] dark:text-[#94a3b8] mb-8">
                    {t('chooseTierSubtitle')}
                </p>

                {/* Billing toggle */}
                <div className="flex justify-center mb-6">
                    <div className="inline-flex items-center bg-[#f8fafc] dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl p-1 gap-0.5">
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
                <div className="flex justify-center mb-8">
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
                                    className="flex-1 px-4 py-2 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] text-sm font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
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
                                            &#11088; {t('mostPopular')}
                                        </span>
                                    </div>
                                )}

                                {/* Header */}
                                <div className="text-center mb-6">
                                    <div className="text-4xl mb-2">{tier.badgeEmoji}</div>
                                    <h3 className={`text-2xl font-black mb-1 ${tier.textColor}`}>{tier.name}</h3>

                                    {unavailable ? (
                                        <div className="py-4">
                                            <p className="text-sm text-[#94a3b8]">{t('noPermanentOption')}</p>
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
                                    <div className="w-full py-3 rounded-xl font-black text-sm text-center bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                        &#9989; {t('tierActivated')}
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
                                            <><Loader2 className="w-4 h-4 animate-spin" /> {t('redirectingPaypal')}</>
                                        ) : discountedPrice !== null && discountedPrice !== price ? (
                                            billingType === 'monthly'
                                                ? t('supportWithMonthly', { price: discountedPrice.toFixed(2) })
                                                : t('supportWithOneTime', { price: discountedPrice.toFixed(2) })
                                        ) : (
                                            billingType === 'monthly'
                                                ? t('supportWithMonthly', { price: String(price) })
                                                : t('supportWithOneTime', { price: String(price) })
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        disabled
                                        className="w-full py-3 rounded-xl font-black text-sm bg-[#f8fafc] dark:bg-[#262626] text-[#94a3b8] cursor-not-allowed"
                                    >
                                        {t('noPermanentOption')}
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
            alert(t('paypalConnectError'));
            setLoading(false);
        }
    };

    return (
        <section className="py-16 px-4 bg-[#f8fafc] dark:bg-[#262626]">
            <div className="max-w-lg mx-auto text-center">
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
                        <><Loader2 className="w-5 h-5 animate-spin" /> {t('redirecting')}</>
                    ) : (
                        <>{numAmount >= 1 ? t('donateAmount', { amount: numAmount.toFixed(2) }) : t('enterAmount')} &#10084;&#65039;</>
                    )}
                </button>

                <p className="text-xs text-[#94a3b8] mt-4">
                    {t('securePaypalMin')}
                </p>
            </div>
        </section>
    );
}

// ─── Founders Section ─────────────────────────────────────────────────────────

function FoundersSection({ supporters }: { supporters: PublicSupporter[] }) {
    const { t } = useTranslation('supporters');
    const founders = supporters.filter(s => s.tier === 'fundador' && s.isPermanent);

    if (founders.length === 0) return (
        <section className="py-16 px-4 bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/20 dark:to-[#1B1C1D]">
            <div className="max-w-5xl mx-auto text-center">
                <div className="text-5xl mb-3">&#127775;</div>
                <h2 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">{t('foundersTitle')}</h2>
                <p className="text-[#64748b] dark:text-[#94a3b8] mb-8">
                    {t('foundersEmptySubtitle')}
                </p>
                <div className="inline-block border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-2xl px-10 py-8 text-center">
                    <div className="text-3xl mb-2">&#10024;</div>
                    <p className="text-sm font-bold text-[#94a3b8]">{t('foundersYourName')}</p>
                </div>
            </div>
        </section>
    );

    return (
        <section className="py-16 px-4 bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/20 dark:to-[#1B1C1D]">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-10">
                    <div className="text-5xl mb-3">&#127775;</div>
                    <h2 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">{t('foundersTitle')}</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">
                        {t('foundersSubtitle')}
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
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">&#127775; {t('founderLabel')}</p>
                            <p className="text-[10px] text-[#94a3b8] mt-0.5">&infin; {t('permanentLabel')}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── Supporters Wall ──────────────────────────────────────────────────────────

const TIER_BADGE: Record<string, { label: string; bg: string; text: string }> = {
    supporter: { label: '\u26a1 Supporter', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
    premium: { label: '\ud83d\udc8e Premium', bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300' },
    fundador: { label: '\ud83c\udf1f Fundador', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
};

const AVATAR_GRADIENTS = [
    'from-[#2563eb] to-[#7c3aed]',
    'from-[#7c3aed] to-[#db2777]',
    'from-[#059669] to-[#2563eb]',
    'from-[#d97706] to-[#dc2626]',
    'from-[#0891b2] to-[#7c3aed]',
];

function SupportersWall({ supporters, loading }: { supporters: PublicSupporter[]; loading: boolean }) {
    const { t } = useTranslation('supporters');
    const active = supporters.filter(s => !s.isPermanent);

    return (
        <section className="py-16 px-4 bg-[#f8fafc] dark:bg-[#262626]">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">
                        {t('activeSupportersTitle')}
                    </h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">
                        {t('activeSupportersSubtitle')}
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
                        <div className="text-5xl mb-3">&#10084;&#65039;</div>
                        <p className="font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">{t('noActiveSupporters')}</p>
                        <p className="text-sm text-[#94a3b8]">{t('beFirstSupporter')}</p>
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
    const { t } = useTranslation('supporters');
    const [open, setOpen] = useState<number | null>(null);

    const FAQ_KEYS = [0, 1, 2, 3, 4, 5];

    return (
        <section className="py-16 px-4 bg-white dark:bg-[#1B1C1D]">
            <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl font-black text-center text-[#1e293b] dark:text-[#f8fafc] mb-10">
                    {t('faqTitle')}
                </h2>
                <div className="space-y-3">
                    {FAQ_KEYS.map((i) => (
                        <div
                            key={i}
                            className="border border-[#e2e8f0] dark:border-[#374151] rounded-xl overflow-hidden"
                        >
                            <button
                                onClick={() => setOpen(open === i ? null : i)}
                                className="w-full flex items-center justify-between px-5 py-4 text-left bg-white dark:bg-[#1B1C1D] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                            >
                                <span className="font-bold text-[#1e293b] dark:text-[#f8fafc] pr-4">{t(`faq${i}q`)}</span>
                                {open === i
                                    ? <ChevronUp className="w-5 h-5 text-[#64748b] shrink-0" />
                                    : <ChevronDown className="w-5 h-5 text-[#64748b] shrink-0" />
                                }
                            </button>
                            {open === i && (
                                <div className="px-5 pb-5 bg-[#f8fafc] dark:bg-[#262626] border-t border-[#e2e8f0] dark:border-[#374151]">
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] pt-4 leading-relaxed">{t(`faq${i}a`)}</p>
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
    const { t } = useTranslation('supporters');

    return (
        <section
            className="py-16 px-4 text-white text-center"
            style={{ background: `linear-gradient(135deg, ${config.heroFrom} 0%, ${config.heroTo} 100%)` }}
        >
            <div className="max-w-2xl mx-auto">
                <div className="text-5xl mb-4">&#10084;&#65039;</div>
                <h2 className="text-3xl font-black mb-3">{t('footerCtaTitle')}</h2>
                <p className="text-white/80 mb-8">
                    {t('footerCtaSubtitle')}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a
                        href="#tiers"
                        className="inline-flex items-center justify-center gap-2 bg-white text-[#2563eb] font-black px-8 py-3.5 rounded-xl hover:bg-white/90 transition-all shadow-lg"
                    >
                        <Star className="w-5 h-5" />
                        {t('supportNow')}
                    </a>
                    <a
                        href="/"
                        className="inline-flex items-center justify-center gap-2 bg-white/20 border border-white/40 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-white/30 transition-all"
                    >
                        <Bot className="w-5 h-5" />
                        {t('goToDecatron')}
                    </a>
                </div>
            </div>
        </section>
    );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function PageFooter() {
    const { t } = useTranslation('supporters');

    return (
        <footer className="bg-white dark:bg-[#1B1C1D] border-t border-[#e2e8f0] dark:border-[#374151] py-8 px-4 text-center">
            <div className="flex items-center justify-center gap-2 text-[#2563eb] font-black mb-2">
                <Bot className="w-5 h-5" />
                <span>Decatron</span>
            </div>
            <p className="text-xs text-[#94a3b8]">
                {t('footerPaypal')} &middot;{' '}
                <a href="/tip/privacy" className="hover:text-[#64748b] underline">{t('footerPrivacy')}</a>
                {' '}&middot;{' '}
                <a href="/tip/terms" className="hover:text-[#64748b] underline">{t('footerTerms')}</a>
            </p>
        </footer>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SupportersPublic() {
    const { t } = useTranslation('supporters');
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

    usePayPalReturn(handlePayPalSuccess, t);

    // If not enabled, show a simple "coming soon" message
    if (!loading && !config.enabled) {
        return (
            <div className="min-h-screen bg-[#f8fafc] dark:bg-[#1B1C1D] flex flex-col">
                <SupportersNav />
                <div className="flex-1 flex items-center justify-center px-4">
                    <div className="text-center">
                        <div className="text-6xl mb-4">&#128679;</div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">{t('comingSoonTitle')}</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">{t('comingSoonSubtitle')}</p>
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
                    <p className="font-black text-lg">&#10084;&#65039; {paypalResult.data.message}</p>
                    <p className="text-sm text-pink-100 mt-1">{t('donationBanner')}</p>
                </div>
            )}
            {paypalResult?.type === 'tier' && (
                paypalResult.data.tierAssigned ? (
                    <div className="bg-green-600 text-white px-4 py-4 text-center">
                        <p className="font-black text-lg">
                            &#127881; {t('tierBannerThanks', {
                                tier: paypalResult.data.tier,
                                status: paypalResult.data.isPermanent
                                    ? t('tierActivatedPermanently')
                                    : t('tierActivatedFor', { duration: paypalResult.data.duration ?? 30, unit: paypalResult.data.unit ?? 'days' })
                            })}
                        </p>
                        <p className="text-sm text-green-100 mt-1">{t('tierBenefitsActive')}</p>
                    </div>
                ) : (
                    <div className="bg-blue-600 text-white px-4 py-5 text-center">
                        <p className="font-black text-lg">&#128591; {t('tierBannerThanksGeneric')}</p>
                        <p className="text-sm text-blue-100 mt-1 mb-3">
                            {t('tierPaymentReceived', { tier: paypalResult.data.tier })}
                        </p>
                        {!isLoggedIn && (
                            <a
                                href="/api/auth/login"
                                className="inline-flex items-center gap-2 bg-white text-blue-600 font-black px-5 py-2 rounded-xl text-sm hover:bg-blue-50 transition-colors shadow"
                            >
                                {t('connectTwitch')}
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
