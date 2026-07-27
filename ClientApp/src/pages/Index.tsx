import { Bot, Zap, Shield, Settings, Users, BarChart, Sparkles, MonitorPlay, Clock, Globe, Heart, Wrench, Gift, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function TwitchChatWidget() {
    const messages = [
        { user: 'StreamerPro', color: '#ff6b6b', text: '!play never gonna give you up' },
        { user: 'Decatron', color: '#2563eb', text: '🎵 Song queued! Position #3', isBot: true },
        { user: 'NightOwl99', color: '#a78bfa', text: '!rank' },
        { user: 'Decatron', color: '#2563eb', text: '📊 NightOwl99 — Level 12 | 4,350 XP', isBot: true },
    ];

    return (
        <div className="space-y-3">
            {messages.map((msg, i) => (
                <div key={i} className={`flex items-start gap-2 text-sm ${msg.isBot ? 'opacity-90' : ''}`}>
                    {msg.isBot && <Bot className="w-4 h-4 mt-0.5 text-[#2563eb] shrink-0" />}
                    <p className="leading-relaxed">
                        <span className="font-bold" style={{ color: msg.color }}>{msg.user}</span>
                        <span className="text-[#94a3b8]">: </span>
                        <span className="text-[#cbd5e1]">{msg.text}</span>
                    </p>
                </div>
            ))}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#374151]">
                <div className="flex-1 bg-[#0f172a] rounded px-3 py-2 text-sm text-[#475569]">
                    Send a message...
                </div>
            </div>
        </div>
    );
}

export default function Index() {
    const { t } = useTranslation('landing');

    const features = [
        { icon: Bot, title: t('featureCommandsTitle'), description: t('featureCommandsDescription') },
        { icon: Shield, title: t('featureModerationTitle'), description: t('featureModerationDescription') },
        { icon: Settings, title: t('featureSettingsTitle'), description: t('featureSettingsDescription') },
        { icon: Users, title: t('featureMultiChannelTitle'), description: t('featureMultiChannelDescription') },
        { icon: BarChart, title: t('featureStatsTitle'), description: t('featureStatsDescription') },
        { icon: Zap, title: t('featurePerformanceTitle'), description: t('featurePerformanceDescription') },
        { icon: Sparkles, title: t('featureAITitle'), description: t('featureAIDescription') },
        { icon: MonitorPlay, title: t('featureOverlaysTitle'), description: t('featureOverlaysDescription') },
    ];

    const stats = [
        { icon: Clock, label: t('statOnline') },
        { icon: Users, label: t('statMultiChannel') },
        { icon: Gift, label: t('statFree') },
        { icon: Globe, label: t('statLanguages') },
    ];

    const whyCards = [
        { icon: Gift, title: t('whyFreeTitle'), description: t('whyFreeDescription') },
        { icon: Wrench, title: t('whyCustomTitle'), description: t('whyCustomDescription') },
        { icon: Globe, title: t('whyLangTitle'), description: t('whyLangDescription') },
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-[#1B1C1D]">
            {/* Hero */}
            <section className="min-h-screen flex items-center justify-center bg-white dark:bg-[#1B1C1D] px-4">
                <div className="max-w-6xl w-full grid md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-600 rounded-full text-blue-600 dark:text-blue-400 font-semibold">
                            <Bot className="w-5 h-5" />
                            <span>{t('poweredBy')}</span>
                        </div>

                        <h1 className="text-5xl md:text-6xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                            {t('title')}
                        </h1>

                        <p className="text-xl text-[#64748b] dark:text-[#94a3b8]">
                            {t('heroDescription')}
                        </p>

                        <div className="flex gap-4">
                            <Link to="/login" className="inline-flex items-center gap-2 px-8 py-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-lg transition-all">
                                <span>{t('loginButton')}</span>
                                <Zap className="w-5 h-5" />
                            </Link>
                            <a href="#features" className="inline-flex items-center gap-2 px-8 py-4 border-2 border-[#2563eb] text-[#2563eb] dark:text-blue-400 font-bold rounded-lg">
                                {t('viewFeatures')}
                            </a>
                        </div>
                    </div>

                    {/* Simulated Twitch Chat */}
                    <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl shadow-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="ml-2 text-xs text-[#64748b] dark:text-[#94a3b8] font-mono">twitch.tv/chat</span>
                        </div>
                        <div className="bg-white dark:bg-[#1e293b] rounded-lg p-6 min-h-[280px]">
                            <TwitchChatWidget />
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            <section className="py-8 bg-[#2563eb]">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {stats.map((s, i) => (
                            <div key={i} className="flex items-center justify-center gap-3 text-white">
                                <s.icon className="w-6 h-6 opacity-80" />
                                <span className="font-bold text-lg">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="py-24 px-4 bg-white dark:bg-[#1B1C1D]">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-4xl font-black mb-12 text-center text-[#2563eb]">{t('featuresHeading')}</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((f, i) => (
                            <div key={i} className="p-6 bg-[#f8fafc] dark:bg-[#1e293b] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] dark:hover:border-[#2563eb] transition-colors">
                                <f.icon className="w-10 h-10 text-[#2563eb] mb-4" />
                                <h3 className="text-lg font-bold mb-2 text-[#1e293b] dark:text-[#f8fafc]">{f.title}</h3>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] leading-relaxed">{f.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why Decatron? */}
            <section className="py-24 px-4 bg-[#f8fafc] dark:bg-[#111214]">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-4xl font-black mb-12 text-center text-[#1e293b] dark:text-[#f8fafc]">{t('whyHeading')}</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {whyCards.map((c, i) => (
                            <div key={i} className="text-center p-8 bg-white dark:bg-[#1e293b] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
                                    <c.icon className="w-7 h-7 text-[#2563eb]" />
                                </div>
                                <h3 className="text-lg font-bold mb-2 text-[#1e293b] dark:text-[#f8fafc]">{c.title}</h3>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] leading-relaxed">{c.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Fortnite Spirit Tracker spotlight */}
            <section className="py-24 px-4 bg-[#0A0C14]">
                <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B61FF]/10 border border-[#7B61FF]/30 rounded-full text-[#A78BFA] font-semibold text-sm">
                            <Zap className="w-4 h-4" />
                            <span>Fortnite Spirit Tracker</span>
                        </div>
                        <h2 className="text-4xl font-black text-white leading-tight">
                            Trackea tu colección de spirits con tu comunidad
                        </h2>
                        <p className="text-[#9CA3AF] text-lg leading-relaxed">
                            Visualiza los 61+ Fortnite Spirits, marca cuáles tienes, comparte tu progreso y compite en el leaderboard global — todo integrado con Twitch y Discord.
                        </p>
                        <div className="flex flex-wrap gap-3 text-sm text-[#9CA3AF]">
                            {['!spirits en Twitch', '/spirits en Discord', 'Galería visual', 'Leaderboard global'].map(f => (
                                <span key={f} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111827] border border-[#1E2A3B] rounded-lg">
                                    <Zap className="w-3.5 h-3.5 text-[#7B61FF]" /> {f}
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <Link to="/sprites" className="px-6 py-3 bg-[#7B61FF] hover:bg-[#6D54E8] text-white font-bold rounded-xl transition-colors">
                                Ver galería →
                            </Link>
                            <Link to="/login" className="px-6 py-3 border border-[#7B61FF]/40 text-[#A78BFA] hover:border-[#7B61FF] font-bold rounded-xl transition-colors">
                                Registrarse gratis
                            </Link>
                        </div>
                    </div>
                    {/* Preview cards */}
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { key: 'zeropoint_gold',    color: '#F59E0B', obtained: true  },
                            { key: 'fire_holofoil',     color: '#60A5FA', obtained: true  },
                            { key: 'demon_galaxy',      color: '#C084FC', obtained: false },
                            { key: 'ghost_basic',       color: '#34D399', obtained: true  },
                            { key: 'punk_rift',         color: '#F43F5E', obtained: false },
                            { key: 'water_gem',         color: '#60A5FA', obtained: true  },
                            { key: 'king_holofoil',     color: '#34D399', obtained: true  },
                            { key: 'aura_gem',          color: '#C084FC', obtained: false },
                        ].map((s, i) => (
                            <div
                                key={i}
                                className={`aspect-square rounded-2xl border-2 overflow-hidden transition-all ${
                                    s.obtained ? 'bg-[#111827]' : 'bg-[#0A0C14] opacity-35 grayscale'
                                }`}
                                style={{
                                    borderColor: s.obtained ? s.color : '#1E2A3B',
                                    boxShadow: s.obtained ? `0 0 14px ${s.color}50` : 'none'
                                }}
                            >
                                <img
                                    src={`/sprites/${s.key}.png`}
                                    alt={s.key}
                                    className="w-full h-full object-contain p-1"
                                />
                            </div>
                        ))}
                        <div className="col-span-4 mt-2 flex items-center gap-3">
                            <Trophy className="w-4 h-4 text-[#7B61FF] flex-shrink-0" />
                            <div className="flex-1 h-2 bg-[#111827] rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-[#7B61FF] to-[#A78BFA]" style={{ width: '62%' }} />
                            </div>
                            <span className="text-xs font-bold text-[#7B61FF]">5/8 · 62%</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA — Support */}
            <section className="py-20 px-4 bg-white dark:bg-[#1B1C1D]">
                <div className="max-w-2xl mx-auto text-center space-y-6">
                    <Heart className="w-12 h-12 text-[#2563eb] mx-auto" />
                    <h2 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('ctaHeading')}</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] text-lg leading-relaxed">{t('ctaDescription')}</p>
                    <Link to="/supporters" className="inline-flex items-center gap-2 px-8 py-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-lg transition-all">
                        {t('ctaButton')}
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-4 bg-[#f8fafc] dark:bg-[#111214] border-t border-[#e2e8f0] dark:border-[#374151]">
                <div className="max-w-6xl mx-auto space-y-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-[#64748b] dark:text-[#94a3b8] font-medium">{t('copyright')}</p>
                        <div className="flex items-center gap-6">
                            <Link to="/supporters" className="text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#2563eb] transition-colors font-medium">
                                {t('footerSupporters')}
                            </Link>
                            <Link to="/login" className="text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#2563eb] transition-colors font-medium">
                                {t('footerLogin')}
                            </Link>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-6 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                        <Link to="/terminos" className="text-sm text-[#94a3b8] dark:text-[#475569] hover:text-[#2563eb] dark:hover:text-[#2563eb] transition-colors">
                            Términos y Condiciones
                        </Link>
                        <Link to="/privacidad" className="text-sm text-[#94a3b8] dark:text-[#475569] hover:text-[#2563eb] dark:hover:text-[#2563eb] transition-colors">
                            Política de Privacidad
                        </Link>
                        <Link to="/devoluciones" className="text-sm text-[#94a3b8] dark:text-[#475569] hover:text-[#2563eb] dark:hover:text-[#2563eb] transition-colors">
                            Devoluciones
                        </Link>
                        <Link to="/libro-reclamaciones" className="text-sm text-[#94a3b8] dark:text-[#475569] hover:text-[#2563eb] dark:hover:text-[#2563eb] transition-colors">
                            Libro de Reclamaciones
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
