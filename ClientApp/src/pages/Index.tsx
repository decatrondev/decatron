import { useState } from 'react';
import { Bot, Zap, Settings, Users, BarChart, Sparkles, MonitorPlay, Globe, Heart, Wrench, Gift, Trophy, Check, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import decatronHero from '../assets/decatron-hero.png';
import { BrandMark } from '../brand/BrandMark';
import ChannelsCarousel from '../components/landing/ChannelsCarousel';

type PlatformKey = 'twitch' | 'kick' | 'youtube';

const PLATFORM_META: Record<PlatformKey, { label: string; accent: string; accentSoft: string; disabled?: boolean }> = {
    twitch: { label: 'Twitch', accent: '#9146ff', accentSoft: 'rgba(145,70,255,0.12)' },
    kick: { label: 'Kick', accent: '#53fc18', accentSoft: 'rgba(83,252,24,0.12)' },
    youtube: { label: 'YouTube', accent: '#ff0000', accentSoft: 'rgba(255,0,0,0.12)', disabled: true },
};

const TERMINAL_LOGS: Record<PlatformKey, { user: string; color: string; text: string; isBot?: boolean }[]> = {
    twitch: [
        { user: 'cositas_tv', color: '#ff6b6b', text: '!so morenitalol' },
        { user: 'Decatron', color: '#9146ff', text: '🎥 Shoutout a morenitalol — dale una visita en twitch.tv/morenitalol', isBot: true },
        { user: 'nightowl99', color: '#a78bfa', text: '!rank' },
        { user: 'Decatron', color: '#9146ff', text: '📊 nightowl99 — Nivel 12 · 4,350 XP', isBot: true },
    ],
    kick: [
        { user: 'zowie_vt', color: '#60d394', text: '!gacha' },
        { user: 'Decatron', color: '#53fc18', text: '🎰 zowie_vt desbloqueó Striker Holofoil (Épico)', isBot: true },
        { user: 'elkiwivikingo', color: '#f9c74f', text: '!watchtime' },
        { user: 'Decatron', color: '#53fc18', text: '⏱️ elkiwivikingo lleva 18h 40m viendo este canal', isBot: true },
    ],
    youtube: [],
};

function PlatformTerminal() {
    const [active, setActive] = useState<PlatformKey>('twitch');
    const meta = PLATFORM_META[active];
    const log = TERMINAL_LOGS[active];

    return (
        <div className="w-full rounded-2xl border border-white/10 bg-[#05070a] shadow-[0_0_60px_-15px_rgba(37,99,235,0.35)] overflow-hidden">
            {/* Title bar con tabs de plataforma */}
            <div className="flex items-center gap-1 px-4 pt-4">
                <div className="flex gap-1.5 mr-3">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                </div>
                {(Object.keys(PLATFORM_META) as PlatformKey[]).map((key) => {
                    const p = PLATFORM_META[key];
                    const isActive = key === active;
                    return (
                        <button
                            key={key}
                            onClick={() => !p.disabled && setActive(key)}
                            disabled={p.disabled}
                            className={`px-3 py-1.5 text-xs font-mono rounded-t-md transition-colors ${
                                p.disabled
                                    ? 'text-[#3f4652] cursor-not-allowed'
                                    : isActive
                                    ? 'text-white'
                                    : 'text-[#6b7280] hover:text-[#9ca3af]'
                            }`}
                            style={isActive ? { backgroundColor: p.accentSoft, borderBottom: `2px solid ${p.accent}` } : undefined}
                        >
                            {p.label}
                            {p.disabled && <span className="ml-1.5 opacity-60">· pronto</span>}
                        </button>
                    );
                })}
            </div>

            <div className="px-6 pb-6 pt-4 min-h-[260px]">
                {log.length > 0 ? (
                    <div className="space-y-3 font-mono text-sm">
                        {log.map((msg, i) => (
                            <div key={i} className={`flex items-start gap-2 ${msg.isBot ? 'opacity-95' : ''}`}>
                                {msg.isBot && <Bot className="w-4 h-4 mt-0.5 shrink-0" style={{ color: meta.accent }} />}
                                <p className="leading-relaxed break-all">
                                    <span className="font-bold" style={{ color: msg.color }}>{msg.user}</span>
                                    <span className="text-[#4b5563]">: </span>
                                    <span className="text-[#d1d5db]">{msg.text}</span>
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full min-h-[196px] flex flex-col items-center justify-center gap-2 text-center">
                        <Clock3 className="w-6 h-6 text-[#3f4652]" />
                        <p className="text-sm text-[#6b7280] font-mono">YouTube todavía no está conectado.</p>
                        <p className="text-xs text-[#3f4652] font-mono">Se suma a esta terminal apenas esté listo.</p>
                    </div>
                )}

                <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/5">
                    <span className="text-[#3f4652] font-mono text-sm">$</span>
                    <div className="flex-1 text-sm text-[#3f4652] font-mono">Escribí un comando…</div>
                    <span className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-full" style={{ color: meta.accent, backgroundColor: meta.accentSoft }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: meta.accent }} />
                        Decatron conectado
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function Index() {
    const { t } = useTranslation('landing');

    const commands = [
        { name: t('cmdCreateName'), description: t('cmdCreateDescription'), icon: Zap },
        { name: t('cmdRuletaName'), description: t('cmdRuletaDescription'), icon: Trophy },
        { name: t('cmdCommandsLinkName'), description: t('cmdCommandsLinkDescription'), icon: Settings },
        { name: t('cmdShoutoutName'), description: t('cmdShoutoutDescription'), icon: Users },
        { name: t('cmdWatchtimeName'), description: t('cmdWatchtimeDescription'), icon: BarChart },
        { name: t('cmdAiName'), description: t('cmdAiDescription'), icon: Sparkles },
        { name: t('cmdGachaName'), description: t('cmdGachaDescription'), icon: MonitorPlay },
    ];

    const whyCards = [
        { icon: Gift, title: t('whyFreeTitle'), description: t('whyFreeDescription') },
        { icon: Wrench, title: t('whyCustomTitle'), description: t('whyCustomDescription') },
        { icon: Globe, title: t('whyLangTitle'), description: t('whyLangDescription') },
    ];

    const platforms: PlatformKey[] = ['twitch', 'kick', 'youtube'];
    const platformCopy: Record<PlatformKey, { status: string; description: string }> = {
        twitch: { status: t('platformTwitchStatus'), description: t('platformTwitchDescription') },
        kick: { status: t('platformKickStatus'), description: t('platformKickDescription') },
        youtube: { status: t('platformYoutubeStatus'), description: t('platformYoutubeDescription') },
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#1B1C1D]">
            {/* Hero — siempre oscura, como una terminal: no depende del tema claro/oscuro del resto del sitio */}
            <section className="bg-[#0B0D12] px-4 pt-24 pb-20">
                <div className="max-w-4xl 3xl:max-w-5xl 4xl:max-w-6xl mx-auto text-center space-y-6 mb-14">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#2563eb]/30 bg-[#2563eb]/10 text-[#60a5fa] font-mono text-sm 3xl:text-base 4xl:text-lg">
                        <span className="text-[#3b82f6]">&gt;</span>
                        <span>{t('heroEyebrow')}</span>
                    </div>

                    <h1 className="font-display text-5xl md:text-7xl 3xl:text-8xl 4xl:text-9xl font-extrabold text-white tracking-tight">
                        {t('title')}
                    </h1>

                    <p className="text-xl 3xl:text-2xl 4xl:text-3xl text-[#9ca3af] max-w-2xl 3xl:max-w-3xl 4xl:max-w-4xl mx-auto">
                        {t('heroDescription')}
                    </p>

                    <div className="flex flex-wrap gap-4 justify-center pt-2">
                        <Link to="/login" className="inline-flex items-center gap-2 px-8 py-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-lg transition-all">
                            <span>{t('loginButton')}</span>
                            <Zap className="w-5 h-5" />
                        </Link>
                        <a href="#comandos" className="inline-flex items-center gap-2 px-8 py-4 border-2 border-white/15 hover:border-white/30 text-white font-bold rounded-lg transition-colors">
                            {t('viewCommands')}
                        </a>
                    </div>
                </div>

                <div className="max-w-6xl 3xl:max-w-7xl 4xl:max-w-[1800px] 5xl:max-w-[2200px] mx-auto grid lg:grid-cols-[minmax(0,1fr)_auto] gap-10 items-center">
                    <div className="w-full max-w-3xl mx-auto lg:mx-0">
                        <PlatformTerminal />
                    </div>
                    <BrandMark
                        slot="landing-hero"
                        className="shrink-0 select-none"
                        fallback={<img
                            src={decatronHero}
                            alt=""
                            className="hidden lg:block w-[420px] xl:w-[520px] 3xl:w-[600px] 4xl:w-[720px] shrink-0 select-none"
                        />}
                    />
                </div>
            </section>

            {/* Plataformas */}
            <section className="py-24 px-4 bg-white dark:bg-[#1B1C1D]">
                <div className="max-w-5xl 3xl:max-w-6xl 4xl:max-w-7xl 5xl:max-w-[1600px] mx-auto">
                    <h2 className="font-display text-3xl 3xl:text-4xl 4xl:text-5xl font-bold mb-12 3xl:mb-16 text-center text-[#1e293b] dark:text-[#f8fafc]">
                        <span className="text-[#2563eb]">&gt;</span> {t('platformsHeading')}
                    </h2>
                    <div className="grid md:grid-cols-3 gap-6 3xl:gap-8">
                        {platforms.map((key) => {
                            const meta = PLATFORM_META[key];
                            const copy = platformCopy[key];
                            return (
                                <div
                                    key={key}
                                    className={`p-6 3xl:p-8 4xl:p-10 rounded-xl border bg-[#f8fafc] dark:bg-[#1e293b] transition-colors ${
                                        meta.disabled ? 'opacity-60' : ''
                                    }`}
                                    style={{ borderColor: meta.disabled ? undefined : `${meta.accent}40` }}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="font-display text-xl 3xl:text-2xl font-bold text-[#1e293b] dark:text-[#f8fafc]">{meta.label}</span>
                                        <span
                                            className="flex items-center gap-1.5 text-xs 3xl:text-sm font-mono font-bold px-2.5 py-1 rounded-full"
                                            style={{ color: meta.accent, backgroundColor: meta.accentSoft }}
                                        >
                                            {meta.disabled ? <Clock3 className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                            {copy.status}
                                        </span>
                                    </div>
                                    <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] leading-relaxed">{copy.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <ChannelsCarousel />

            {/* Comandos */}
            <section id="comandos" className="py-24 px-4 bg-[#f8fafc] dark:bg-[#111214]">
                <div className="max-w-5xl 3xl:max-w-6xl 4xl:max-w-7xl mx-auto">
                    <div className="text-center mb-12 3xl:mb-16">
                        <h2 className="font-display text-3xl 3xl:text-4xl 4xl:text-5xl font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            <span className="text-[#2563eb]">&gt;</span> {t('commandsHeading')}
                        </h2>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-2 3xl:text-lg">{t('commandsSubheading')}</p>
                    </div>
                    <div className="grid md:grid-cols-2 3xl:grid-cols-3 4xl:grid-cols-4 gap-4 3xl:gap-6">
                        {commands.map((c, i) => (
                            <div key={i} className="flex items-start gap-4 p-5 3xl:p-6 bg-white dark:bg-[#1e293b] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]/50 transition-colors">
                                <c.icon className="w-5 h-5 3xl:w-6 3xl:h-6 text-[#2563eb] mt-1 shrink-0" />
                                <div>
                                    <code className="font-mono font-bold text-[#1e293b] dark:text-[#f8fafc] 3xl:text-lg">{c.name}</code>
                                    <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] leading-relaxed mt-1">{c.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why Decatron? */}
            <section className="py-24 px-4 bg-white dark:bg-[#1B1C1D]">
                <div className="max-w-4xl 3xl:max-w-5xl 4xl:max-w-6xl mx-auto">
                    <h2 className="font-display text-3xl 3xl:text-4xl 4xl:text-5xl font-bold mb-12 3xl:mb-16 text-center text-[#1e293b] dark:text-[#f8fafc]">
                        <span className="text-[#2563eb]">&gt;</span> {t('whyHeading')}
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8 3xl:gap-10">
                        {whyCards.map((c, i) => (
                            <div key={i} className="text-center p-8 3xl:p-10 bg-[#f8fafc] dark:bg-[#1e293b] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                                <div className="inline-flex items-center justify-center w-14 h-14 3xl:w-16 3xl:h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
                                    <c.icon className="w-7 h-7 3xl:w-8 3xl:h-8 text-[#2563eb]" />
                                </div>
                                <h3 className="text-lg 3xl:text-xl font-bold mb-2 text-[#1e293b] dark:text-[#f8fafc]">{c.title}</h3>
                                <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] leading-relaxed">{c.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Fortnite Spirit Tracker spotlight */}
            <section className="py-24 px-4 bg-[#0A0C14]">
                <div className="max-w-6xl 3xl:max-w-7xl 4xl:max-w-[1700px] mx-auto grid md:grid-cols-2 gap-16 3xl:gap-20 items-center">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B61FF]/10 border border-[#7B61FF]/30 rounded-full text-[#A78BFA] font-semibold text-sm 3xl:text-base">
                            <Zap className="w-4 h-4" />
                            <span>Fortnite Spirit Tracker</span>
                        </div>
                        <h2 className="font-display text-4xl 3xl:text-5xl 4xl:text-6xl font-bold text-white leading-tight">
                            Trackea tu colección de spirits con tu comunidad
                        </h2>
                        <p className="text-[#9CA3AF] text-lg 3xl:text-xl leading-relaxed">
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
                <div className="max-w-2xl 3xl:max-w-3xl mx-auto text-center space-y-6">
                    <Heart className="w-12 h-12 3xl:w-14 3xl:h-14 text-[#2563eb] mx-auto" />
                    <h2 className="font-display text-3xl 3xl:text-4xl font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('ctaHeading')}</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] text-lg 3xl:text-xl leading-relaxed">{t('ctaDescription')}</p>
                    <Link to="/supporters" className="inline-flex items-center gap-2 px-8 py-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-lg transition-all">
                        {t('ctaButton')}
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-4 bg-[#f8fafc] dark:bg-[#111214] border-t border-[#e2e8f0] dark:border-[#374151]">
                <div className="max-w-6xl 3xl:max-w-7xl mx-auto space-y-6">
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
