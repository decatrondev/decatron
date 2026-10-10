import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, DollarSign, MessageSquare, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface DonationPageConfig {
    channelName: string;
    pageTitle: string;
    pageDescription?: string;
    pageAccentColor: string;
    pageBackgroundImage?: string;
    currency: string;
    minAmount: number;
    maxAmount: number;
    suggestedAmounts: string;
    requireMessage: boolean;
    maxMessageLength: number;
    paypalClientId: string;
    paypalMerchantId?: string;
}

interface PayPalButtonsInstance {
    render: (container: HTMLElement) => Promise<void>;
    close: () => void;
}

declare global {
    interface Window {
        paypal?: {
            Buttons: (config: {
                style?: {
                    layout?: string;
                    color?: string;
                    shape?: string;
                    label?: string;
                    height?: number;
                };
                createOrder: () => Promise<string>;
                onApprove: (data: { orderID: string }) => Promise<void>;
                onError: (err: Error) => void;
                onCancel: () => void;
            }) => PayPalButtonsInstance;
        };
    }
}

type DonationStatus = 'idle' | 'processing' | 'success' | 'error';

export default function TipsDonate() {
    const { t } = useTranslation('tips');
    const { channelName } = useParams<{ channelName: string }>();

    const [config, setConfig] = useState<DonationPageConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [donorName, setDonorName] = useState('');
    const [amount, setAmount] = useState<number>(5);
    const [customAmount, setCustomAmount] = useState('');
    const [message, setMessage] = useState('');
    const [useCustomAmount, setUseCustomAmount] = useState(false);

    const [status, setStatus] = useState<DonationStatus>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [timeAdded, setTimeAdded] = useState(0);

    // Load page config
    useEffect(() => {
        if (!channelName) return;

        const loadConfig = async () => {
            try {
                const response = await fetch(`/api/tips/page/${channelName}`);
                if (!response.ok) {
                    if (response.status === 404) {
                        setError(t('errorDonationsNotEnabled'));
                    } else {
                        setError(t('errorLoadingPage'));
                    }
                    return;
                }
                const data = await response.json();
                setConfig(data);

                // Set default amount from suggested
                const suggested = data.suggestedAmounts?.split(',').map((s: string) => parseFloat(s.trim()));
                if (suggested?.length > 0) {
                    setAmount(suggested[0]);
                }
            } catch (err) {
                setError(t('errorConnection'));
            } finally {
                setLoading(false);
            }
        };

        loadConfig();
    }, [channelName]);

    const [paypalReady, setPaypalReady] = useState(false);
    const [paypalBlocked, setPaypalBlocked] = useState(false);

    // Load PayPal SDK
    useEffect(() => {
        if (!config || !config.paypalClientId) return;

        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${config.paypalClientId}&currency=${config.currency}&merchant-id=${config.paypalMerchantId}`;
        script.async = true;
        script.onload = () => {
            setPaypalReady(true);
        };
        script.onerror = () => {
            console.warn('PayPal SDK blocked or failed to load');
            setPaypalBlocked(true);
        };
        document.body.appendChild(script);

        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, [config]);

    // Render PayPal buttons when SDK is ready or inputs change
    useEffect(() => {
        if (paypalReady && window.paypal && config) {
            const timer = setTimeout(() => renderPayPalButtons(), 300);
            return () => clearTimeout(timer);
        }
    }, [paypalReady, amount, customAmount, useCustomAmount, donorName]);

    const getEffectiveAmount = useCallback(() => {
        if (useCustomAmount && customAmount) {
            return parseFloat(customAmount);
        }
        return amount;
    }, [useCustomAmount, customAmount, amount]);

    const renderPayPalButtons = () => {
        try {
        if (!window.paypal || !config || paypalBlocked) return;

        const container = document.getElementById('paypal-button-container');
        if (!container || !document.body.contains(container)) return;

        // Clear existing buttons
        container.innerHTML = '';

        const effectiveAmount = getEffectiveAmount();

        // Validate amount
        if (effectiveAmount < config.minAmount || effectiveAmount > config.maxAmount) {
            return;
        }

        // Validate donor name
        if (!donorName.trim()) {
            return;
        }

        window.paypal.Buttons({
            style: {
                layout: 'vertical',
                color: 'gold',
                shape: 'rect',
                label: 'pay',
                height: 45
            },
            createOrder: async () => {
                setStatus('processing');
                setStatusMessage(t('creatingOrder'));

                const response = await fetch('/api/tips/paypal/create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channelName: config.channelName,
                        donorName: donorName.trim(),
                        amount: effectiveAmount,
                        message: message.trim()
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || t('errorCreatingOrder'));
                }

                return data.orderId;
            },
            onApprove: async (data) => {
                setStatusMessage(t('processingPayment'));

                try {
                    const response = await fetch('/api/tips/paypal/capture-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId: data.orderID,
                            channelName: config.channelName
                        })
                    });

                    const result = await response.json();

                    if (response.ok && result.success) {
                        setStatus('success');
                        setTimeAdded(result.timeAdded || 0);
                        setStatusMessage(t('thankYouDonation'));
                    } else {
                        throw new Error(result.error || t('errorProcessingPayment'));
                    }
                } catch (err) {
                    setStatus('error');
                    setStatusMessage(err instanceof Error ? err.message : t('errorProcessingPayment'));
                }
            },
            onError: (err) => {
                setStatus('error');
                setStatusMessage(t('paymentError'));
                console.error('PayPal error:', err);
            },
            onCancel: () => {
                setStatus('idle');
                setStatusMessage('');
            }
        }).render(container);
        } catch (err) {
            console.warn('PayPal render error:', err);
        }
    };

    const formatCurrency = (value: number) => {
        const symbols: Record<string, string> = {
            USD: '$',
            EUR: '\u20ac',
            GBP: '\u00a3',
            MXN: '$',
            BRL: 'R$'
        };
        const symbol = symbols[config?.currency || 'USD'] || '$';
        return `${symbol}${value.toFixed(2)}`;
    };

    const suggestedAmounts = config?.suggestedAmounts
        ?.split(',')
        .map(s => parseFloat(s.trim()))
        .filter(n => !isNaN(n)) || [5, 10, 25, 50];

    if (loading) {
        return (
            <div className="min-h-screen bg-pub-bg flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-pub-accent-hi animate-spin" />
            </div>
        );
    }

    if (error || !config) {
        return (
            <div className="min-h-screen bg-pub-bg flex items-center justify-center p-4">
                <div className="bg-pub-surface/90 border border-pub-border backdrop-blur-sm rounded-lg p-8 max-w-md text-center">
                    <AlertCircle className="w-16 h-16 text-ds-danger mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-ds-text mb-2">{t('notAvailableTitle')}</h1>
                    <p className="text-ds-soft">{error}</p>
                </div>
            </div>
        );
    }

    // Success state
    if (status === 'success') {
        return (
            <div className="min-h-screen bg-pub-bg flex items-center justify-center p-4">
                <div className="bg-pub-surface/90 border border-pub-border backdrop-blur-sm rounded-lg p-8 max-w-md text-center">
                    <div
                        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                        style={{ backgroundColor: config.pageAccentColor }}
                    >
                        <CheckCircle className="w-12 h-12 text-ds-text" />
                    </div>
                    <h1 className="text-3xl font-bold text-ds-text mb-2">{t('thankYouTitle')}</h1>
                    <p className="text-xl text-ds-soft mb-4">
                        {t('donationReceived', { amount: formatCurrency(getEffectiveAmount()) })}
                    </p>
                    {timeAdded > 0 && (
                        <p className="text-lg text-pub-accent-hi">
                            {t('timeAdded', { minutes: Math.floor(timeAdded / 60), seconds: timeAdded % 60 })}
                        </p>
                    )}
                    <button
                        onClick={() => {
                            setStatus('idle');
                            setMessage('');
                        }}
                        className="mt-6 px-6 py-3 rounded-lg font-semibold text-ds-text transition-colors"
                        style={{ backgroundColor: config.pageAccentColor }}
                    >
                        {t('donateAgain')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-pub-bg py-8 px-4"
            style={config.pageBackgroundImage ? {
                backgroundImage: `url(${config.pageBackgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            } : { backgroundImage: `radial-gradient(ellipse 80% 45% at 50% 0%, ${config.pageAccentColor || '#3161d8'}40, transparent 70%)` }}
        >
            <div className="max-w-lg mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div
                        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                        style={{ backgroundColor: config.pageAccentColor }}
                    >
                        <Heart className="w-8 h-8 text-ds-text" />
                    </div>
                    <h1 className="text-3xl font-bold text-ds-text mb-2">{config.pageTitle}</h1>
                    {config.pageDescription && (
                        <p className="text-ds-soft">{config.pageDescription}</p>
                    )}
                    <p className="text-lg text-pub-accent-hi mt-2">
                        {t('supportChannel', { channelName: config.channelName })}
                    </p>
                </div>

                {/* Donation Form */}
                <div className="bg-pub-surface/90 border border-pub-border backdrop-blur-sm rounded-lg p-6 space-y-6">
                    {/* Donor Name */}
                    <div>
                        <label className="block text-sm font-medium text-ds-soft mb-2">
                            {t('donorNameLabel')}
                        </label>
                        <input
                            type="text"
                            value={donorName}
                            onChange={(e) => setDonorName(e.target.value)}
                            placeholder={t('donorNamePlaceholder')}
                            maxLength={50}
                            className="w-full px-4 py-3 bg-pub-bg border border-pub-border rounded-lg text-ds-text placeholder-ds-soft focus:outline-none focus:border-pub-accent"
                        />
                    </div>

                    {/* Amount Selection */}
                    <div>
                        <label className="block text-sm font-medium text-ds-soft mb-2">
                            {t('donationAmountLabel')}
                        </label>

                        {/* Suggested Amounts */}
                        <div className="grid grid-cols-4 gap-2 mb-3">
                            {suggestedAmounts.map((amt) => (
                                <button
                                    key={amt}
                                    onClick={() => {
                                        setAmount(amt);
                                        setUseCustomAmount(false);
                                    }}
                                    className={`py-3 rounded-lg font-semibold transition-all ${
                                        !useCustomAmount && amount === amt
                                            ? 'text-ds-text ring-2 ring-offset-2 ring-offset-ds-border'
                                            : 'bg-pub-bg border border-pub-border text-ds-soft hover:border-pub-accent/60'
                                    }`}
                                    style={!useCustomAmount && amount === amt ? {
                                        backgroundColor: config.pageAccentColor,
                                        ringColor: config.pageAccentColor
                                    } : {}}
                                >
                                    {formatCurrency(amt)}
                                </button>
                            ))}
                        </div>

                        {/* Custom Amount */}
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ds-soft" />
                            <input
                                type="number"
                                value={customAmount}
                                onChange={(e) => {
                                    setCustomAmount(e.target.value);
                                    setUseCustomAmount(true);
                                }}
                                onFocus={() => setUseCustomAmount(true)}
                                placeholder={t('customAmountPlaceholder')}
                                min={config.minAmount}
                                max={config.maxAmount}
                                step="0.01"
                                className={`w-full pl-10 pr-4 py-3 bg-pub-bg border rounded-lg text-ds-text placeholder-ds-soft focus:outline-none ${
                                    useCustomAmount
                                        ? 'border-pub-accent'
                                        : 'border-pub-border'
                                }`}
                            />
                        </div>
                        <p className="text-xs text-ds-soft mt-1">
                            {t('amountRange', { min: formatCurrency(config.minAmount), max: formatCurrency(config.maxAmount) })}
                        </p>
                    </div>

                    {/* Message */}
                    <div>
                        <label className="block text-sm font-medium text-ds-soft mb-2">
                            <MessageSquare className="inline w-4 h-4 mr-1" />
                            {t('messageLabel')} {config.requireMessage ? t('messageRequired') : t('messageOptional')}
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={t('messagePlaceholder')}
                            maxLength={config.maxMessageLength}
                            rows={3}
                            className="w-full px-4 py-3 bg-pub-bg border border-pub-border rounded-lg text-ds-text placeholder-ds-soft focus:outline-none focus:border-pub-accent resize-none"
                        />
                        <p className="text-xs text-ds-soft mt-1 text-right">
                            {message.length}/{config.maxMessageLength}
                        </p>
                    </div>

                    {/* Validation Errors */}
                    {!donorName.trim() && (
                        <p className="text-ds-warn text-sm">
                            {t('enterNameToContinue')}
                        </p>
                    )}
                    {config.requireMessage && !message.trim() && (
                        <p className="text-ds-warn text-sm">
                            {t('messageIsRequired')}
                        </p>
                    )}
                    {(getEffectiveAmount() < config.minAmount || getEffectiveAmount() > config.maxAmount) && (
                        <p className="text-ds-danger text-sm">
                            {t('amountOutOfRange', { min: formatCurrency(config.minAmount), max: formatCurrency(config.maxAmount) })}
                        </p>
                    )}

                    {/* PayPal Buttons */}
                    <div className="pt-4">
                        {paypalBlocked && (
                            <div className="flex items-center gap-2 py-4 px-4 bg-ds-warn/10 border border-ds-warn/40 rounded-lg text-ds-warn text-sm mb-4">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span>{t('adBlockerDetected', 'Your ad blocker is preventing PayPal from loading. Please disable it for this page to make a donation.')}</span>
                            </div>
                        )}
                        {status === 'processing' && (
                            <div className="flex items-center justify-center gap-2 py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-pub-accent-hi" />
                                <span className="text-ds-soft">{statusMessage}</span>
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="flex items-center justify-center gap-2 py-4 text-ds-danger">
                                <AlertCircle className="w-5 h-5" />
                                <span>{statusMessage}</span>
                            </div>
                        )}
                        <div
                            id="paypal-button-container"
                            className={status === 'processing' ? 'opacity-50 pointer-events-none' : ''}
                        />
                    </div>

                    {/* Total */}
                    <div className="border-t border-pub-border pt-4">
                        <div className="flex justify-between items-center">
                            <span className="text-ds-soft">{t('totalToPay')}</span>
                            <span className="text-2xl font-bold text-ds-text">
                                {formatCurrency(getEffectiveAmount())}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-6 text-ds-soft text-sm">
                    <p>{t('securePaypal')}</p>
                    <div className="mt-2 flex items-center justify-center gap-4">
                        <Link to="/tip/privacy" className="hover:text-pub-accent-hi underline">
                            {t('privacyPolicy')}
                        </Link>
                        <span>•</span>
                        <Link to="/tip/terms" className="hover:text-pub-accent-hi underline">
                            {t('termsOfService')}
                        </Link>
                    </div>
                    <p className="mt-2">{t('poweredBy')}</p>
                </div>
            </div>
        </div>
    );
}
