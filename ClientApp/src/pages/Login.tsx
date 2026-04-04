import { Bot, Shield, Clock, Palette, ShoppingBag } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

export default function Login() {
    const { t } = useTranslation('login');
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const error = searchParams.get('error');
    const exchangeCode = searchParams.get('code');
    const redirect = searchParams.get('redirect');
    const provider = searchParams.get('provider');
    const [exchangeError, setExchangeError] = useState<string | null>(null);

    useEffect(() => {
        if (exchangeCode) {
            const exchangeUrl = provider === 'discord' ? '/auth/discord/exchange' : '/auth/exchange';
            api.post(exchangeUrl, { code: exchangeCode })
                .then((response) => {
                    localStorage.setItem('token', response.data.token);

                    if (redirect === 'gacha/terms') {
                        navigate('/gacha/terms');
                    } else {
                        navigate('/dashboard');
                    }
                })
                .catch(() => {
                    setExchangeError(t('authFailed'));
                });
        }
    }, [exchangeCode, navigate, redirect, provider]);

    const handleTwitchLogin = () => {
        const redirectParam = redirect ? `?redirect=${redirect}` : '';
        window.location.href = `/api/auth/login${redirectParam}`;
    };

    const handleDiscordLogin = () => {
        window.location.href = '/api/auth/discord/login';
    };

    const features = [
        {
            icon: Bot,
            title: t('featureCustomCommandsTitle'),
            description: t('featureCustomCommandsDescription')
        },
        {
            icon: Shield,
            title: t('featureModerationTitle'),
            description: t('featureModerationDescription')
        },
        {
            icon: Clock,
            title: t('featureRealtimeTitle'),
            description: t('featureRealtimeDescription')
        },
        {
            icon: Palette,
            title: t('featureRankCardsTitle'),
            description: t('featureRankCardsDescription')
        },
        {
            icon: ShoppingBag,
            title: t('featureMarketplaceTitle'),
            description: t('featureMarketplaceDescription')
        }
    ];

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#1B1C1D] px-4">
            <div className="max-w-6xl w-full grid md:grid-cols-2 bg-white dark:bg-[#1B1C1D] rounded-2xl shadow-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">

                {/* Login Box */}
                <div className="p-12 flex flex-col justify-center">
                    <div className="mb-8">
                        <h1 className="text-4xl font-black mb-3 text-[#1e293b] dark:text-[#f8fafc]">
                            {t('welcome')}
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            {t('subtitle')}
                        </p>
                    </div>

                    {(error || exchangeError) && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                                {error || exchangeError}
                            </p>
                        </div>
                    )}

                    <div className="space-y-4 mb-6">
                        {/* Twitch Login */}
                        <div>
                            <button
                                onClick={handleTwitchLogin}
                                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-[#9146ff] to-[#772ce8] hover:from-[#772ce8] hover:to-[#5c16c5] text-white font-bold rounded-lg transition-all hover:-translate-y-0.5 shadow-lg"
                            >
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                                </svg>
                                <span>{t('continueWithTwitch')}</span>
                            </button>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1.5 ml-1">
                                {t('twitchAccessDescription')}
                            </p>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-[#e2e8f0] dark:bg-[#374151]"></div>
                            <span className="text-xs font-medium text-[#94a3b8] dark:text-[#64748b] uppercase tracking-wider">o</span>
                            <div className="flex-1 h-px bg-[#e2e8f0] dark:bg-[#374151]"></div>
                        </div>

                        {/* Discord Login */}
                        <div>
                            <button
                                onClick={handleDiscordLogin}
                                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-[#5865F2] to-[#4752C4] hover:from-[#4752C4] hover:to-[#3C45A5] text-white font-bold rounded-lg transition-all hover:-translate-y-0.5 shadow-lg"
                            >
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
                                </svg>
                                <span>{t('continueWithDiscord')}</span>
                            </button>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1.5 ml-1">
                                {t('discordAccessDescription')}
                            </p>
                        </div>
                    </div>

                    {/* Link accounts hint */}
                    <p className="text-center text-xs text-[#94a3b8] dark:text-[#64748b] mb-6">
                        {t('linkAccountsHint')}
                    </p>

                    <div className="p-5 bg-blue-50 dark:bg-blue-900/20 border border-[#e2e8f0] dark:border-[#374151] rounded-lg mb-6">
                        <h3 className="text-[#2563eb] font-bold mb-2">{t('whyOAuth')}</h3>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {t('whyOAuthDescription')}
                        </p>
                    </div>

                    <p className="text-center text-sm text-[#64748b] dark:text-[#94a3b8]">
                        {t('termsNotice')}{' '}
                        <a href="#" className="text-[#2563eb] font-semibold hover:underline">
                            {t('termsOfService')}
                        </a>
                    </p>
                </div>

                {/* Info Panel */}
                <div className="hidden md:flex bg-gradient-to-br from-blue-900 to-blue-800 dark:from-[#1B1C1D] dark:to-[#1e293b] p-12 flex-col justify-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
                    </div>

                    <div className="relative z-10 text-white">
                        <h2 className="text-3xl font-black mb-8">
                            {t('powerYourChannel')}
                        </h2>

                        <div className="space-y-4">
                            {features.map((feature, i) => (
                                <div key={i} className="flex items-start gap-4 p-4 bg-white/10 rounded-lg backdrop-blur">
                                    <feature.icon className="w-6 h-6 flex-shrink-0 mt-1" />
                                    <div>
                                        <h3 className="font-bold mb-1">{feature.title}</h3>
                                        <p className="text-sm opacity-90">{feature.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
