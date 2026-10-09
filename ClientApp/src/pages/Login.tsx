import { Shield, Loader2, Languages, Layers, Music, Users, Terminal } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { notifyTokenChanged } from '../utils/tokenEvents';
import decatronMascot from '../assets/decatron-mascot.png';

// Acceso: base común de las vistas públicas (tokens pub-* de tailwind.config), siempre oscura.
// Los tres botones de acceso son iguales; solo el logo de cada plataforma lleva su color.

const TWITCH_PATH = 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z';
const YOUTUBE_PATH = 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z';
const DISCORD_PATH = 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z';

export default function Login() {
    const { t } = useTranslation('login');
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const error = searchParams.get('error');
    const exchangeCode = searchParams.get('code');
    const redirect = searchParams.get('redirect');
    const provider = searchParams.get('provider');
    const [exchangeError, setExchangeError] = useState<string | null>(null);
    const [loggingIn, setLoggingIn] = useState(false);
    const [exchanging, setExchanging] = useState(false);

    useEffect(() => {
        if (exchangeCode) {
            setExchanging(true);
            const exchangeUrl = provider === 'discord' ? '/auth/discord/exchange' : '/auth/exchange';
            api.post(exchangeUrl, { code: exchangeCode })
                .then((response) => {
                    localStorage.setItem('token', response.data.token);
                    notifyTokenChanged(response.data.token);

                    if (redirect) {
                        navigate('/' + redirect);
                    } else {
                        navigate('/dashboard');
                    }
                })
                .catch(() => {
                    setExchangeError(t('authFailed'));
                    setExchanging(false);
                });
        }
    }, [exchangeCode, navigate, redirect, provider]);

    const handleTwitchLogin = () => {
        setLoggingIn(true);
        // redirect (de useSearchParams, ya decodificado) puede traer su propia
        // query string adentro (ej. viene de /oauth/authorize?client_id=...&...)
        // — sin volver a codificarlo acá, esos & y = sueltos rompen la URL de
        // /api/auth/login y se pierden todos los parámetros después del primero.
        const redirectParam = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';
        window.location.href = `/api/auth/login${redirectParam}`;
    };

    const handleDiscordLogin = () => {
        setLoggingIn(true);
        window.location.href = '/api/auth/discord/login';
    };

    const handleKickLogin = () => {
        setLoggingIn(true);
        window.location.href = '/api/auth/kick/login';
    };

    const features = [
        { icon: Terminal, title: t('featureCommandsTitle'), description: t('featureCommandsDescription') },
        { icon: Shield, title: t('featureModerationTitle'), description: t('featureModerationDescription') },
        { icon: Layers, title: t('featureOverlaysTitle'), description: t('featureOverlaysDescription') },
        { icon: Music, title: t('featureSongTitle'), description: t('featureSongDescription') },
        { icon: Languages, title: t('featureTranslateTitle'), description: t('featureTranslateDescription') },
        { icon: Users, title: t('featureCommunityTitle'), description: t('featureCommunityDescription') },
    ];

    const busy = loggingIn || exchanging;
    const label = (text: string) => loggingIn ? t('redirecting') : exchanging ? t('authenticating') : text;
    const providerBtn = 'w-full text-left flex items-center gap-3.5 px-5 py-3.5 rounded-md border border-pub-border bg-pub-surface hover:bg-pub-raised hover:border-pub-accent/60 text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
    const hint = 'text-xs 3xl:text-sm text-[#8b93a3] mt-2 ml-1';

    return (
        <div className="dark panel-scale min-h-screen bg-pub-bg text-[#e6e9ef] font-onest overflow-x-hidden relative">
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[900px] opacity-[0.07]"
                style={{
                    backgroundImage: 'linear-gradient(#2f6bff 1px, transparent 1px), linear-gradient(90deg, #2f6bff 1px, transparent 1px)',
                    backgroundSize: '44px 44px',
                    maskImage: 'radial-gradient(ellipse 70% 70% at 50% 30%, #000 30%, transparent 75%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 30%, #000 30%, transparent 75%)',
                }}
            />

            <header className="relative z-10 max-w-6xl 3xl:max-w-[1500px] mx-auto px-5 sm:px-8 py-5 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2.5">
                    <img src={decatronMascot} alt="" className="w-9 h-9" />
                    <span className="text-xl font-extrabold tracking-tight text-white">Decatron</span>
                </Link>
                <Link to="/" className="text-sm text-[#8b93a3] hover:text-white transition-colors">&larr; Decatron.net</Link>
            </header>

            <main className="relative z-10 max-w-6xl 3xl:max-w-[1500px] mx-auto px-5 sm:px-8 py-8 lg:py-14 grid lg:grid-cols-[minmax(0,440px)_1fr] gap-12 lg:gap-20 items-start">

                {/* Acceso */}
                <section>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">{t('welcome')}</h1>
                    <p className="text-[#8b93a3] mb-8 leading-relaxed">{t('subtitle')}</p>

                    {(error || exchangeError) && (
                        <div role="alert" className="mb-6 p-4 rounded-md border border-red-500/40 bg-red-500/10">
                            <p className="text-red-400 text-sm font-medium">{error || exchangeError}</p>
                        </div>
                    )}

                    <div className="space-y-5 mb-6">
                        <div>
                            <button onClick={handleTwitchLogin} disabled={busy} className={providerBtn}>
                                {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                    <svg className="w-6 h-6 text-[#9146ff]" viewBox="0 0 24 24" fill="currentColor"><path d={TWITCH_PATH} /></svg>
                                )}
                                <span>{label(t('continueWithTwitch'))}</span>
                            </button>
                            <p className={hint}>{t('twitchAccessDescription')}</p>
                        </div>

                        <div>
                            <button onClick={handleKickLogin} disabled={busy} className={providerBtn}>
                                {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                    <span className="w-6 h-6 flex items-center justify-center rounded bg-[#53fc18] text-black font-extrabold text-sm">K</span>
                                )}
                                <span>{label(t('continueWithKick'))}</span>
                            </button>
                            <p className={hint}>{t('kickAccessDescription')}</p>
                        </div>

                        <div>
                            <button disabled className={providerBtn}>
                                <svg className="w-6 h-6 opacity-50" viewBox="0 0 24 24" fill="currentColor"><path d={YOUTUBE_PATH} /></svg>
                                <span className="text-[#8b93a3]">{t('continueWithYoutube')}</span>
                                <span className="ml-auto font-mono text-[10px] px-2 py-0.5 rounded border border-pub-border text-[#8b93a3]">{t('youtubeComingSoon')}</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-pub-border" />
                            <span className="font-mono text-xs text-[#8b93a3]">o</span>
                            <div className="flex-1 h-px bg-pub-border" />
                        </div>

                        <div>
                            <button onClick={handleDiscordLogin} disabled={busy} className={providerBtn}>
                                {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                    <svg className="w-6 h-6 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor"><path d={DISCORD_PATH} /></svg>
                                )}
                                <span>{label(t('continueWithDiscord'))}</span>
                            </button>
                            <p className={hint}>{t('discordAccessDescription')}</p>
                        </div>
                    </div>

                    <p className="text-xs 3xl:text-sm text-[#8b93a3] mb-6">{t('linkAccountsHint')}</p>

                    <div className="p-4 rounded-md border border-pub-border bg-pub-surface mb-6">
                        <h2 className="text-sm font-bold text-pub-accent-hi mb-1">{t('whyOAuth')}</h2>
                        <p className="text-sm text-[#8b93a3] leading-relaxed">{t('whyOAuthDescription')}</p>
                    </div>

                    <p className="text-sm text-[#8b93a3] leading-relaxed">
                        {t('termsNotice')}{' '}
                        <Link to="/terminos" className="text-pub-accent-hi font-semibold hover:underline">{t('termsOfService')}</Link>
                        {' '}{t('termsAnd')}{' '}
                        <Link to="/privacidad" className="text-pub-accent-hi font-semibold hover:underline">{t('privacyPolicy')}</Link>.
                    </p>
                </section>

                {/* Qué incluye */}
                <aside className="hidden lg:block relative">
                    <div
                        className="absolute -inset-10 blur-3xl opacity-50 pointer-events-none"
                        style={{ background: 'radial-gradient(circle at 70% 20%, rgba(47,107,255,0.35), transparent 65%)' }}
                    />
                    <div className="relative">
                        <p className="font-mono text-sm text-pub-accent-hi mb-2"><span className="text-[#8b93a3]">#</span> decatron</p>
                        <h2 className="text-3xl 3xl:text-4xl font-extrabold tracking-tight text-white mb-8">{t('powerYourChannel')}</h2>
                        <ul className="divide-y divide-pub-border border-y border-pub-border">
                            {features.map((f, i) => (
                                <li key={i} className="flex items-start gap-4 py-5">
                                    <f.icon className="w-5 h-5 3xl:w-6 3xl:h-6 text-pub-accent-hi mt-0.5 shrink-0" />
                                    <div>
                                        <h3 className="font-bold text-white 3xl:text-lg">{f.title}</h3>
                                        <p className="text-sm 3xl:text-base text-[#8b93a3] leading-relaxed mt-0.5">{f.description}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>
            </main>
        </div>
    );
}
