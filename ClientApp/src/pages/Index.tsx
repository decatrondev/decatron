import { useEffect, useState } from 'react';
import { Zap, Settings, Users, BarChart, Sparkles, MonitorPlay, Globe, Heart, Wrench, Gift, Trophy, Check, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import decatronHero from '../assets/decatron-hero.png';
import decatronMascot from '../assets/decatron-mascot.png';
import { BrandMark } from '../brand/BrandMark';
import ChannelsCarousel from '../components/landing/ChannelsCarousel';
import api from '../services/api';

// Portada: siempre oscura, sobre la base común de las vistas públicas (tokens pub-* de tailwind.config).
// El contenedor lleva "dark" para que los componentes con variantes dark: (carrusel de canales) también
// se vean oscuros aunque el visitante tenga el tema claro.

type PlatformKey = 'twitch' | 'kick' | 'youtube';

const PLATFORMS: { key: PlatformKey; label: string; disabled?: boolean }[] = [
    { key: 'twitch', label: 'Twitch' },
    { key: 'kick', label: 'Kick' },
    { key: 'youtube', label: 'YouTube', disabled: true },
];

const TERMINAL_LOGS: Record<PlatformKey, { user: string; color: string; text: string; isBot?: boolean }[]> = {
    twitch: [
        { user: 'cositas_tv', color: '#ff8a8a', text: '!so morenitalol' },
        { user: 'Decatron', color: '#5b8cff', text: '🎥 Shoutout a morenitalol — dale una visita en twitch.tv/morenitalol', isBot: true },
        { user: 'nightowl99', color: '#c4b5fd', text: '!rank' },
        { user: 'Decatron', color: '#5b8cff', text: '📊 nightowl99 — Nivel 12 · 4,350 XP', isBot: true },
    ],
    kick: [
        { user: 'zowie_vt', color: '#7ddba6', text: '!gacha' },
        { user: 'Decatron', color: '#5b8cff', text: '🎰 zowie_vt desbloqueó Striker Holofoil (Épico)', isBot: true },
        { user: 'elkiwivikingo', color: '#f9c74f', text: '!watchtime' },
        { user: 'Decatron', color: '#5b8cff', text: '⏱️ elkiwivikingo lleva 18h 40m viendo este canal', isBot: true },
    ],
    youtube: [],
};

// Escribe el texto una sola vez al cambiar de pestaña (respeta prefers-reduced-motion)
function useTyped(text: string, startDelay = 700, speed = 24) {
    const [n, setN] = useState(0);
    useEffect(() => {
        setN(0);
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(text.length); return; }
        let i = 0;
        let timer: number;
        const start = window.setTimeout(() => {
            timer = window.setInterval(() => {
                i += 1;
                setN(i);
                if (i >= text.length) window.clearInterval(timer);
            }, speed);
        }, startDelay);
        return () => { window.clearTimeout(start); window.clearInterval(timer); };
    }, [text, startDelay, speed]);
    return text.slice(0, n);
}

function PlatformTerminal() {
    const { t } = useTranslation('landing');
    const [active, setActive] = useState<PlatformKey>('twitch');
    const log = TERMINAL_LOGS[active];
    const firstBot = log.findIndex(m => m.isBot);
    const typed = useTyped(firstBot >= 0 ? log[firstBot].text : '');

    return (
        <div className="w-full rounded-lg border border-pub-border bg-pub-bg/90 backdrop-blur-sm shadow-[0_20px_60px_-20px_rgba(47,107,255,0.45)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-pub-border pr-4">
                <div role="tablist" className="flex">
                    {PLATFORMS.map(p => (
                        <button
                            key={p.key}
                            role="tab"
                            aria-selected={active === p.key}
                            disabled={p.disabled}
                            onClick={() => !p.disabled && setActive(p.key)}
                            className={`px-4 py-2.5 font-mono text-xs 3xl:text-sm border-b-2 -mb-px transition-colors ${
                                p.disabled
                                    ? 'border-transparent text-[#3f4652] cursor-not-allowed'
                                    : active === p.key
                                    ? 'border-pub-accent text-white'
                                    : 'border-transparent text-[#8b93a3] hover:text-white'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <span className="flex items-center gap-2 font-mono text-xs text-[#8b93a3]">
                    <span className="w-2 h-2 rounded-full bg-pub-accent animate-pulse" />{t('terminalLive')}
                </span>
            </div>

            <div className="p-4 sm:p-5 min-h-[220px]">
                {log.length > 0 ? (
                    <div className="space-y-3 font-mono text-[13px] 3xl:text-sm leading-relaxed">
                        {log.map((msg, i) => {
                            const isTyping = i === firstBot;
                            return (
                                <p key={`${active}-${i}`} className="break-words">
                                    <span className="font-bold" style={{ color: msg.color }}>{msg.user}</span>
                                    <span className="text-[#8b93a3]">: </span>
                                    <span className="text-[#e6e9ef]">{isTyping ? typed : msg.text}</span>
                                    {isTyping && typed.length < msg.text.length && <span className="inline-block w-2 h-4 -mb-0.5 ml-0.5 bg-pub-accent animate-pulse" />}
                                </p>
                            );
                        })}
                    </div>
                ) : (
                    <div className="min-h-[180px] flex flex-col items-center justify-center gap-2 text-center">
                        <Clock3 className="w-6 h-6 text-[#3f4652]" />
                        <p className="text-sm text-[#8b93a3] font-mono">{t('youtubeNotConnected')}</p>
                        <p className="text-xs text-[#3f4652] font-mono">{t('youtubeJoin')}</p>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-t border-pub-border font-mono text-xs text-[#3f4652]">
                <span>$</span>
                <span className="flex-1">{t('terminalPrompt')}</span>
                <span className="text-[#5b8cff]">{t('connected')}</span>
            </div>
        </div>
    );
}

export default function Index() {
    const { t } = useTranslation('landing');
    // Cantidad real de spirits lanzados (el catálogo crece cada temporada); sin dato, texto sin número
    const [spiritCount, setSpiritCount] = useState<number | null>(null);
    useEffect(() => {
        api.get('/fortnite/sprites')
            .then(r => setSpiritCount((r.data.sprites ?? []).filter((x: { isUnreleased?: boolean }) => !x.isUnreleased).length || null))
            .catch(() => {});
    }, []);

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

    const platformCopy: Record<PlatformKey, { status: string; description: string }> = {
        twitch: { status: t('platformTwitchStatus'), description: t('platformTwitchDescription') },
        kick: { status: t('platformKickStatus'), description: t('platformKickDescription') },
        youtube: { status: t('platformYoutubeStatus'), description: t('platformYoutubeDescription') },
    };

    // El titular parte en la coma: "Tu bot," / "en cada chat."
    const [headA, ...headB] = t('heroEyebrow').split(/,\s*/);

    const sectionTitle = 'font-extrabold tracking-tight text-white text-3xl 3xl:text-4xl 4xl:text-5xl';
    const tag = 'font-mono text-sm text-pub-accent-hi mb-3';
    const wrap = 'max-w-7xl 3xl:max-w-[1600px] mx-auto px-5 sm:px-8';

    return (
        <div className="dark panel-scale min-h-screen bg-pub-bg text-[#e6e9ef] font-onest overflow-x-hidden">
            {/* Cuadrícula tenue en azul, desvanecida hacia los bordes */}
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[900px] opacity-[0.07]"
                style={{
                    backgroundImage: 'linear-gradient(#2f6bff 1px, transparent 1px), linear-gradient(90deg, #2f6bff 1px, transparent 1px)',
                    backgroundSize: '44px 44px',
                    maskImage: 'radial-gradient(ellipse 70% 70% at 60% 30%, #000 30%, transparent 75%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 60% 30%, #000 30%, transparent 75%)',
                }}
            />

            <header className={`relative z-10 ${wrap} py-5 flex items-center justify-between`}>
                <Link to="/" className="flex items-center gap-2.5">
                    <img src={decatronMascot} alt="" className="w-9 h-9" />
                    <span className="text-xl font-extrabold tracking-tight text-white">Decatron</span>
                </Link>
                <nav className="hidden md:flex items-center gap-8 text-sm text-[#8b93a3]">
                    <a href="#comandos" className="hover:text-white transition-colors">{t('navCommands')}</a>
                    <Link to="/supporters" className="hover:text-white transition-colors">{t('navSupporters')}</Link>
                    <Link to="/docs" className="hover:text-white transition-colors">{t('navDocs')}</Link>
                </nav>
                <Link to="/login" className="px-4 py-2 rounded-md bg-pub-accent hover:bg-pub-accent-hi text-white text-sm font-bold transition-colors">{t('loginButton')}</Link>
            </header>

            {/* Hero */}
            <section className={`relative z-10 ${wrap} pt-10 sm:pt-16 pb-16 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-6 items-center`}>
                <div className="space-y-7">
                    <p className="font-mono text-sm text-pub-accent-hi"><span className="text-[#8b93a3]">#</span> {t('heroTag')}</p>
                    <h1 className="font-extrabold tracking-tight leading-[0.95] text-white text-[clamp(3rem,8vw,6.75rem)]">
                        {headA}{headB.length > 0 && <>,<br />{headB.join(', ')}</>}
                    </h1>
                    <p className="text-lg 3xl:text-xl text-[#8b93a3] max-w-lg leading-relaxed">{t('heroDescription')}</p>
                    <div className="flex flex-wrap gap-3">
                        <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md bg-pub-accent hover:bg-pub-accent-hi text-white font-bold transition-colors">
                            {t('loginButton')} <Zap className="w-4 h-4" />
                        </Link>
                        <a href="#comandos" className="px-6 py-3.5 rounded-md border border-pub-border hover:border-pub-accent/60 text-[#e6e9ef] font-bold transition-colors">{t('viewCommands')}</a>
                    </div>
                    <ul className="flex flex-wrap gap-x-7 gap-y-2 font-mono text-xs text-[#8b93a3] pt-2">
                        {PLATFORMS.map(p => (
                            <li key={p.key} className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${p.disabled ? 'border border-[#8b93a3]' : 'bg-pub-accent'}`} />
                                {p.label} <span className={p.disabled ? '' : 'text-pub-accent-hi'}>{platformCopy[p.key].status}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="relative">
                    <div
                        className="absolute inset-0 blur-3xl opacity-70"
                        style={{ background: 'radial-gradient(circle at 55% 40%, rgba(47,107,255,0.45), rgba(56,189,248,0.12) 45%, transparent 70%)' }}
                    />
                    <BrandMark
                        slot="landing-hero"
                        className="relative w-full max-w-[640px] 3xl:max-w-[760px] mx-auto select-none"
                        fallback={<img src={decatronHero} alt="" className="relative w-full max-w-[640px] 3xl:max-w-[760px] mx-auto select-none" />}
                    />
                    <div className="relative mt-4 lg:mt-0 lg:absolute lg:-bottom-6 lg:-left-10 lg:w-[380px] 3xl:w-[440px]">
                        <PlatformTerminal />
                    </div>
                </div>
            </section>

            {/* Comandos como cinta */}
            <div className="relative z-10 border-y border-pub-border">
                <div className={`${wrap} py-5 flex flex-wrap items-center gap-x-8 gap-y-3 font-mono text-sm`}>
                    <span className="text-[#8b93a3]"># {t('stripLabel')}</span>
                    {commands.map(c => <span key={c.name} className="text-[#e6e9ef]">{c.name}</span>)}
                </div>
            </div>

            {/* Plataformas */}
            <section className="relative z-10 py-24">
                <div className={wrap}>
                    <h2 className={`${sectionTitle} mb-10`}>{t('platformsHeading')}</h2>
                    <div className="grid md:grid-cols-3 gap-4 3xl:gap-6">
                        {PLATFORMS.map(p => (
                            <div key={p.key} className={`p-6 3xl:p-8 rounded-lg border border-pub-border bg-pub-surface ${p.disabled ? 'opacity-60' : ''}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xl 3xl:text-2xl font-extrabold text-white">{p.label}</span>
                                    <span className={`flex items-center gap-1.5 text-xs 3xl:text-sm font-mono font-bold px-2.5 py-1 rounded ${p.disabled ? 'text-[#8b93a3] bg-white/5' : 'text-pub-accent-hi bg-pub-accent/10'}`}>
                                        {p.disabled ? <Clock3 className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                        {platformCopy[p.key].status}
                                    </span>
                                </div>
                                <p className="text-sm 3xl:text-base text-[#8b93a3] leading-relaxed">{platformCopy[p.key].description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <ChannelsCarousel />

            {/* Comandos */}
            <section id="comandos" className="relative z-10 py-24 border-t border-pub-border">
                <div className={wrap}>
                    <div className="mb-10">
                        <h2 className={sectionTitle}>{t('commandsHeading')}</h2>
                        <p className="text-[#8b93a3] mt-2 3xl:text-lg">{t('commandsSubheading')}</p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 4xl:grid-cols-4 gap-4 3xl:gap-6">
                        {commands.map((c, i) => (
                            <div key={i} className="flex items-start gap-4 p-5 3xl:p-6 rounded-lg border border-pub-border bg-pub-surface hover:border-pub-accent/50 transition-colors">
                                <c.icon className="w-5 h-5 3xl:w-6 3xl:h-6 text-pub-accent-hi mt-1 shrink-0" />
                                <div>
                                    <code className="font-mono font-bold text-white 3xl:text-lg">{c.name}</code>
                                    <p className="text-sm 3xl:text-base text-[#8b93a3] leading-relaxed mt-1">{c.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Por qué Decatron */}
            <section className="relative z-10 py-24 border-t border-pub-border">
                <div className={wrap}>
                    <h2 className={`${sectionTitle} mb-10`}>{t('whyHeading')}</h2>
                    <div className="grid md:grid-cols-3 gap-4 3xl:gap-6">
                        {whyCards.map((c, i) => (
                            <div key={i} className="p-6 3xl:p-8 rounded-lg border border-pub-border bg-pub-surface">
                                <c.icon className="w-6 h-6 3xl:w-7 3xl:h-7 text-pub-accent-hi mb-4" />
                                <h3 className="text-lg 3xl:text-xl font-bold mb-2 text-white">{c.title}</h3>
                                <p className="text-sm 3xl:text-base text-[#8b93a3] leading-relaxed">{c.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Fortnite Spirit Tracker */}
            <section className="relative z-10 py-24 border-t border-pub-border bg-pub-surface/40">
                <div className={`${wrap} grid md:grid-cols-2 gap-14 3xl:gap-20 items-center`}>
                    <div className="space-y-6">
                        <p className={tag}># {t('spiritsBadge')}</p>
                        <h2 className="font-extrabold tracking-tight text-white text-3xl md:text-4xl 3xl:text-5xl 4xl:text-6xl leading-tight">{t('spiritsTitle')}</h2>
                        <p className="text-[#8b93a3] text-lg 3xl:text-xl leading-relaxed">{spiritCount ? t('spiritsBody', { count: spiritCount }) : t('spiritsBodyNoCount')}</p>
                        <ul className="flex flex-wrap gap-2 font-mono text-xs 3xl:text-sm text-[#8b93a3]">
                            {[t('spiritsF1'), t('spiritsF2'), t('spiritsF3'), t('spiritsF4')].map(f => (
                                <li key={f} className="px-3 py-1.5 rounded border border-pub-border">{f}</li>
                            ))}
                        </ul>
                        <div className="flex flex-wrap gap-3">
                            <Link to="/sprites" className="px-6 py-3 rounded-md bg-pub-accent hover:bg-pub-accent-hi text-white font-bold transition-colors">{t('spiritsGallery')}</Link>
                            <Link to="/login" className="px-6 py-3 rounded-md border border-pub-border hover:border-pub-accent/60 text-[#e6e9ef] font-bold transition-colors">{t('spiritsSignup')}</Link>
                        </div>
                    </div>
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
                                className={`aspect-square rounded-xl border-[1.5px] overflow-hidden ${s.obtained ? 'bg-pub-raised' : 'bg-pub-surface opacity-40 grayscale'}`}
                                style={{ borderColor: s.obtained ? s.color : '#222733', boxShadow: s.obtained ? `0 0 14px ${s.color}50` : 'none' }}
                            >
                                <img src={`/sprites/${s.key}.png`} alt={s.key} className="w-full h-full object-contain p-1" />
                            </div>
                        ))}
                        <div className="col-span-4 mt-2 flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-pub-border rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-pub-accent shadow-[0_0_10px_rgba(47,107,255,0.5)]" style={{ width: '62%' }} />
                            </div>
                            <span className="font-mono text-xs font-bold text-pub-accent-hi">5/8 · 62%</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Apoyo */}
            <section className="relative z-10 py-20 border-t border-pub-border">
                <div className="max-w-2xl 3xl:max-w-3xl mx-auto px-5 text-center space-y-6">
                    <Heart className="w-10 h-10 3xl:w-12 3xl:h-12 text-pub-accent-hi mx-auto" />
                    <h2 className={sectionTitle}>{t('ctaHeading')}</h2>
                    <p className="text-[#8b93a3] text-lg 3xl:text-xl leading-relaxed">{t('ctaDescription')}</p>
                    <Link to="/supporters" className="inline-flex items-center gap-2 px-8 py-4 rounded-md bg-pub-accent hover:bg-pub-accent-hi text-white font-bold transition-colors">{t('ctaButton')}</Link>
                </div>
            </section>

            {/* Pie */}
            <footer className="relative z-10 py-10 border-t border-pub-border">
                <div className={`${wrap} space-y-6`}>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm 3xl:text-base">
                        <p className="text-[#8b93a3] font-mono">{t('copyright')}</p>
                        <div className="flex items-center gap-6">
                            <Link to="/supporters" className="text-[#8b93a3] hover:text-white transition-colors">{t('footerSupporters')}</Link>
                            <Link to="/login" className="text-[#8b93a3] hover:text-white transition-colors">{t('footerLogin')}</Link>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-4 border-t border-pub-border text-sm text-[#5b6475]">
                        <Link to="/terminos" className="hover:text-white transition-colors">{t('footerTerms')}</Link>
                        <Link to="/privacidad" className="hover:text-white transition-colors">{t('footerPrivacy')}</Link>
                        <Link to="/devoluciones" className="hover:text-white transition-colors">{t('footerRefunds')}</Link>
                        <Link to="/libro-reclamaciones" className="hover:text-white transition-colors">{t('footerClaims')}</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
