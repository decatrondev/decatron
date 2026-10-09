import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ExternalLink, Check, Heart, Server, Sparkles, Gift } from 'lucide-react';
import api from '../../services/api';
import decatronMascot from '../../assets/decatron-mascot.png';

// Piezas de /supporters (presentación). El cobro vive en SupportersPublic.tsx (TierCards y FreeDonation)
// y no se toca desde aquí. Base común de las vistas públicas: tokens pub-* de tailwind.config.

export interface PublicConfig {
    enabled: boolean; title: string; tagline: string; description: string;
    monthlyGoal: number; monthlyRaised: number; showProgressBar: boolean;
    showSupportersWall: boolean; showFoundersSection: boolean; heroFrom: string; heroTo: string;
}
export interface PublicSupporter {
    displayName: string; twitchLogin: string; tier: string; isPermanent: boolean; joinedAt: string; avatarUrl?: string;
}

export const TIER_META: Record<string, { label: string; emoji: string; color: string }> = {
    supporter: { label: 'Supporter', emoji: '⚡', color: '#3b82f6' },
    premium:   { label: 'Premium',   emoji: '💎', color: '#8b5cf6' },
    fundador:  { label: 'Fundador',  emoji: '🌟', color: '#f59e0b' },
};

const wrap = 'max-w-6xl 3xl:max-w-[1500px] mx-auto px-5 sm:px-8';
const tag = 'font-mono text-sm text-pub-accent-hi mb-3';
const h2 = 'font-extrabold tracking-tight text-white text-3xl 3xl:text-4xl';

function Avatar({ s, size, ring }: { s: PublicSupporter; size: number; ring?: string }) {
    const [broken, setBroken] = useState(false);
    const color = ring ?? TIER_META[s.tier]?.color ?? '#2f6bff';
    const style = { width: size, height: size, boxShadow: `0 0 0 2px #0b0d12, 0 0 0 4px ${color}` };
    if (s.avatarUrl && !broken) {
        return <img src={s.avatarUrl} alt={s.displayName} loading="lazy" onError={() => setBroken(true)} className="rounded-full object-cover shrink-0 bg-pub-raised" style={style} />;
    }
    return (
        <span className="rounded-full shrink-0 flex items-center justify-center font-black text-white" style={{ ...style, background: `linear-gradient(135deg, ${color}, #12151c)`, fontSize: size * 0.4 }}>
            {s.displayName.charAt(0).toUpperCase()}
        </span>
    );
}

const since = (iso: string, lng: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(lng, { month: 'long', year: 'numeric' });
};

export function SupBackdrop() {
    return (
        <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[900px] opacity-[0.07]"
            style={{
                backgroundImage: 'linear-gradient(#2f6bff 1px, transparent 1px), linear-gradient(90deg, #2f6bff 1px, transparent 1px)',
                backgroundSize: '44px 44px',
                maskImage: 'radial-gradient(ellipse 70% 70% at 60% 30%, #000 30%, transparent 75%)',
                WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 60% 30%, #000 30%, transparent 75%)',
            }}
        />
    );
}

export function SupNav() {
    const { t } = useTranslation('supporters');
    const [logged, setLogged] = useState(false);
    useEffect(() => { setLogged(!!localStorage.getItem('token')); }, []);
    return (
        <header className={`relative z-10 ${wrap} py-5 flex items-center justify-between`}>
            <Link to="/" className="flex items-center gap-2.5">
                <img src={decatronMascot} alt="" className="w-9 h-9" />
                <span className="text-xl font-extrabold tracking-tight text-white">Decatron</span>
            </Link>
            {logged ? (
                <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-md bg-pub-accent hover:bg-pub-accent-hi text-white text-sm font-bold transition-colors">
                    <ExternalLink className="w-4 h-4" />{t('navDashboard')}
                </a>
            ) : (
                <a href="/login?redirect=supporters" className="px-4 py-2 rounded-md border border-pub-border hover:border-pub-accent/60 text-[#e6e9ef] text-sm font-bold transition-colors">{t('navLogin')}</a>
            )}
        </header>
    );
}

export function SupHero({ config, supporters }: { config: PublicConfig; supporters: PublicSupporter[] }) {
    const { t } = useTranslation('supporters');
    const people = useMemo(() => {
        const order: Record<string, number> = { fundador: 0, premium: 1, supporter: 2 };
        return supporters.filter(s => s.tier !== 'admin').sort((a, b) => (order[a.tier] ?? 3) - (order[b.tier] ?? 3));
    }, [supporters]);
    const progress = config.monthlyGoal > 0 ? Math.min(100, (config.monthlyRaised / config.monthlyGoal) * 100) : 0;
    const shown = people.slice(0, 8);

    return (
        <section className={`relative z-10 ${wrap} pt-10 sm:pt-16 pb-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center`}>
            <div className="space-y-7">
                <p className="font-mono text-sm text-pub-accent-hi"><span className="text-[#8b93a3]">#</span> {t('heroTag')}</p>
                <h1 className="font-extrabold tracking-tight leading-[0.98] text-white text-[clamp(2.75rem,7vw,6rem)]">
                    {config.title || t('defaultTitle')}
                </h1>
                <p className="text-xl 3xl:text-2xl text-white/90 font-semibold max-w-xl">{config.tagline || t('defaultTagline')}</p>
                <p className="text-lg 3xl:text-xl text-[#8b93a3] max-w-xl leading-relaxed">{config.description || t('defaultDescription')}</p>
                <div className="flex flex-wrap gap-3">
                    <a href="#tiers" className="px-6 py-3.5 rounded-md bg-pub-accent hover:bg-pub-accent-hi text-white font-bold transition-colors">{t('viewPlans')}</a>
                    <a href="#donar" className="px-6 py-3.5 rounded-md border border-pub-border hover:border-pub-accent/60 text-[#e6e9ef] font-bold transition-colors">{t('donateFreely')}</a>
                </div>
                {config.showProgressBar && config.monthlyRaised > 0 && (
                    <div className="max-w-md space-y-2 pt-2">
                        <div className="flex justify-between font-mono text-xs text-[#8b93a3]">
                            <span>{t('raisedThisMonth')} <span className="text-white">${config.monthlyRaised}</span></span>
                            <span>{t('goal')} ${config.monthlyGoal}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-pub-border overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                            <div className="h-full rounded-full bg-pub-accent shadow-[0_0_10px_rgba(47,107,255,0.5)]" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Las personas que ya apoyan son la imagen del hero */}
            <div className="relative flex flex-col items-center gap-8">
                <div className="absolute inset-0 blur-3xl opacity-60 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(47,107,255,0.4), rgba(56,189,248,0.1) 45%, transparent 70%)' }} />
                {shown.length > 0 ? (
                    <>
                        <div className="relative flex flex-wrap justify-center gap-x-4 gap-y-6 max-w-md">
                            {shown.map((s, i) => (
                                <a key={s.twitchLogin} href={`https://twitch.tv/${s.twitchLogin}`} target="_blank" rel="noopener noreferrer"
                                   title={s.displayName} className="transition-transform hover:-translate-y-1" style={{ marginTop: i % 2 ? 24 : 0 }}>
                                    <Avatar s={s} size={people.length <= 4 ? 132 : i < 3 ? 108 : 76} />
                                </a>
                            ))}
                        </div>
                        <p className="relative font-mono text-sm text-[#8b93a3]">{t('supportersCount', { count: people.length })}</p>
                    </>
                ) : (
                    <img src={decatronMascot} alt="" className="relative w-56 3xl:w-72 select-none" />
                )}
            </div>
        </section>
    );
}

export function SupWhy() {
    const { t } = useTranslation('supporters');
    const items = [
        { icon: Server, title: t('whyServerCostsTitle'), desc: t('whyServerCostsDesc') },
        { icon: Sparkles, title: t('whyNewFeaturesTitle'), desc: t('whyNewFeaturesDesc') },
        { icon: Gift, title: t('whyFreeForAllTitle'), desc: t('whyFreeForAllDesc') },
    ];
    return (
        <section className="relative z-10 border-y border-pub-border">
            <div className={`${wrap} py-14`}>
                <h2 className={`${h2} mb-8`}>{t('whyHeading')}</h2>
                <div className="grid md:grid-cols-3 gap-8">
                    {items.map(i => (
                        <div key={i.title} className="flex items-start gap-4">
                            <i.icon className="w-5 h-5 3xl:w-6 3xl:h-6 text-pub-accent-hi mt-1 shrink-0" />
                            <div>
                                <h3 className="font-bold text-white 3xl:text-lg">{i.title}</h3>
                                <p className="text-sm 3xl:text-base text-[#8b93a3] leading-relaxed mt-1">{i.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function SupFounders({ supporters }: { supporters: PublicSupporter[] }) {
    const { t, i18n } = useTranslation('supporters');
    const founders = supporters.filter(s => s.tier === 'fundador' && s.isPermanent);
    return (
        <section className="relative z-10 py-20">
            <div className={wrap}>
                <p className={tag}># {TIER_META.fundador.emoji} {t('founderLabel')}</p>
                <h2 className={h2}>{t('foundersTitle')}</h2>
                <p className="text-[#8b93a3] mt-2 mb-10 3xl:text-lg">{founders.length ? t('foundersSubtitle') : t('foundersEmptySubtitle')}</p>
                {founders.length === 0 ? (
                    <a href="#tiers" className="inline-flex px-6 py-3 rounded-md border border-amber-400/40 text-amber-300 font-bold hover:bg-amber-400/10 transition-colors">{t('foundersYourName')}</a>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 3xl:gap-6">
                        {founders.map(f => (
                            <a key={f.twitchLogin} href={`https://twitch.tv/${f.twitchLogin}`} target="_blank" rel="noopener noreferrer"
                               className="group flex items-center gap-5 p-5 rounded-lg border border-amber-400/25 bg-pub-surface hover:border-amber-400/60 transition-colors">
                                <Avatar s={f} size={80} ring="#f59e0b" />
                                <div className="min-w-0">
                                    <p className="text-lg font-extrabold text-white truncate">{f.displayName}</p>
                                    <p className="font-mono text-xs text-amber-300 mt-1">{TIER_META.fundador.emoji} {t('permanentBadge')}</p>
                                    {since(f.joinedAt, i18n.language) && <p className="font-mono text-xs text-[#8b93a3] mt-0.5">{t('sinceLabel', { date: since(f.joinedAt, i18n.language) })}</p>}
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

interface LimitsPayload { tiers: string[]; rows: Record<string, Record<string, number>> }

function fmtBytes(b: number) {
    if (b >= 1024 ** 3) return `${+(b / 1024 ** 3).toFixed(1)} GB`;
    return `${Math.round(b / 1024 ** 2)} MB`;
}

export function PlanComparison() {
    const { t } = useTranslation('supporters');
    const [data, setData] = useState<LimitsPayload | null>(null);
    useEffect(() => { api.get<LimitsPayload>('/supporters/tier-limits').then(r => setData(r.data)).catch(() => {}); }, []);
    if (!data) return null;

    const unl = <span className="text-pub-accent-hi">{t('tableUnlimited')}</span>;
    const num = (v: number) => v < 0 ? unl : v.toLocaleString();
    const flag = (v: number) => v ? <Check className="w-4 h-4 text-emerald-400 mx-auto" aria-label={t('tableYes')} /> : <span className="text-[#3f4652]">{t('tableNo')}</span>;
    const bytes = (v: number) => v < 0 ? unl : fmtBytes(v);
    const days = (v: number) => v < 0 ? unl : v === 0 ? <span className="text-[#3f4652]">{t('tableNo')}</span> : v.toLocaleString();

    type Row = { key: string; label: string; fmt: (v: number) => React.ReactNode };
    const groups: { title: string; rows: Row[] }[] = [
        { title: t('tGroupSong'), rows: [
            { key: 'songPlaylists', label: t('rSongPlaylists'), fmt: num }, { key: 'songItems', label: t('rSongItems'), fmt: num },
            { key: 'songHistoryDays', label: t('rSongHistory'), fmt: days }, { key: 'songTemplates', label: t('rSongTemplates'), fmt: num },
            { key: 'songHidePromo', label: t('rHidePromo'), fmt: flag } ] },
        { title: t('tGroupWheel'), rows: [
            { key: 'wheels', label: t('rWheels'), fmt: num }, { key: 'wheelSegments', label: t('rWheelSegments'), fmt: num },
            { key: 'wheelHistoryDays', label: t('rWheelHistory'), fmt: days } ] },
        { title: t('tGroupGames'), rows: [
            { key: 'gamesAccounts', label: t('rGamesAccounts'), fmt: num }, { key: 'gamesInstances', label: t('rGamesInstances'), fmt: num },
            { key: 'gamesRecent', label: t('rGamesRecent'), fmt: num }, { key: 'gamesHistoryDays', label: t('rGamesHistory'), fmt: days },
            { key: 'gamesHidePromo', label: t('rHidePromo'), fmt: flag } ] },
        { title: t('tGroupStorage'), rows: [
            { key: 'storageBytes', label: t('rStorage'), fmt: bytes }, { key: 'pollyChars', label: t('rPolly'), fmt: (v) => v === 0 ? <span className="text-[#3f4652]">{t('tableNo')}</span> : num(v) } ] },
    ];
    const head = (tier: string) => tier === 'free' ? t('tableFree') : TIER_META[tier]?.label ?? tier;

    return (
        <section className="relative z-10 py-20 border-t border-pub-border">
            <div className={wrap}>
                <p className={tag}># {t('tableTitle').toLowerCase()}</p>
                <h2 className={h2}>{t('tableTitle')}</h2>
                <p className="text-[#8b93a3] mt-2 mb-8 3xl:text-lg">{t('tableSubtitle')}</p>
                <div className="overflow-x-auto rounded-lg border border-pub-border">
                    <table className="w-full min-w-[640px] text-sm 3xl:text-base">
                        <thead>
                            <tr className="bg-pub-surface">
                                <th className="text-left px-4 py-3 font-normal" />
                                {data.tiers.map(tier => (
                                    <th key={tier} scope="col" className="px-4 py-3 text-center font-extrabold" style={{ color: TIER_META[tier]?.color ?? '#e6e9ef' }}>{head(tier)}</th>
                                ))}
                            </tr>
                        </thead>
                        {groups.map(g => (
                            <tbody key={g.title}>
                                <tr><th colSpan={5} scope="colgroup" className="text-left px-4 pt-6 pb-2 font-mono text-xs text-pub-accent-hi font-normal border-t border-pub-border"># {g.title}</th></tr>
                                {g.rows.map(r => (
                                    <tr key={r.key} className="border-t border-pub-border-soft">
                                        <th scope="row" className="text-left px-4 py-2.5 font-medium text-[#b4bccb]">{r.label}</th>
                                        {data.tiers.map(tier => (
                                            <td key={tier} className="px-4 py-2.5 text-center tabular-nums text-white">{r.fmt(data.rows[r.key]?.[tier] ?? 0)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        ))}
                    </table>
                </div>
            </div>
        </section>
    );
}

export function SupWall({ supporters, loading }: { supporters: PublicSupporter[]; loading: boolean }) {
    const { t, i18n } = useTranslation('supporters');
    const rest = supporters.filter(s => s.tier !== 'admin' && !(s.tier === 'fundador' && s.isPermanent));
    return (
        <section className="relative z-10 py-20 border-t border-pub-border">
            <div className={wrap}>
                <h2 className={h2}>{t('wallTitle')}</h2>
                <p className="text-[#8b93a3] mt-2 mb-10 3xl:text-lg">{t('wallSubtitle')}</p>
                {loading ? (
                    <p className="font-mono text-sm text-[#8b93a3] animate-pulse">...</p>
                ) : rest.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-pub-border bg-pub-surface/50 p-10 text-center">
                        <Heart className="w-8 h-8 text-pub-accent-hi mx-auto mb-3" />
                        <p className="font-bold text-white">{t('wallEmptyTitle')}</p>
                        <p className="text-sm text-[#8b93a3] mt-1">{t('wallEmptyBody')}</p>
                        <a href="#tiers" className="inline-flex mt-5 px-5 py-2.5 rounded-md bg-pub-accent hover:bg-pub-accent-hi text-white font-bold text-sm transition-colors">{t('viewPlans')}</a>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {rest.map(s => (
                            <a key={s.twitchLogin} href={`https://twitch.tv/${s.twitchLogin}`} target="_blank" rel="noopener noreferrer"
                               className="flex items-center gap-4 p-4 rounded-lg border border-pub-border bg-pub-surface hover:border-pub-accent/50 transition-colors">
                                <Avatar s={s} size={52} />
                                <div className="min-w-0">
                                    <p className="font-bold text-white truncate">{s.displayName}</p>
                                    <p className="font-mono text-xs mt-0.5" style={{ color: TIER_META[s.tier]?.color }}>{TIER_META[s.tier]?.emoji} {TIER_META[s.tier]?.label ?? s.tier}</p>
                                    {since(s.joinedAt, i18n.language) && <p className="font-mono text-[11px] text-[#8b93a3]">{since(s.joinedAt, i18n.language)}</p>}
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

export function SupFAQ() {
    const { t } = useTranslation('supporters');
    const [open, setOpen] = useState<number | null>(null);
    return (
        <section className="relative z-10 py-20 border-t border-pub-border">
            <div className={`${wrap} grid lg:grid-cols-[1fr_2fr] gap-10`}>
                <h2 className={h2}>{t('faqTitle')}</h2>
                <div className="divide-y divide-pub-border border-y border-pub-border">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <div key={i}>
                            <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}
                                    className="w-full flex items-center justify-between gap-4 py-5 text-left">
                                <span className="font-bold text-white 3xl:text-lg">{t(`faq${i}q`)}</span>
                                <ChevronDown className={`w-5 h-5 text-[#8b93a3] shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
                            </button>
                            {open === i && <p className="pb-5 text-[#8b93a3] leading-relaxed max-w-prose 3xl:text-lg">{t(`faq${i}a`)}</p>}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function SupFinalCTA() {
    const { t } = useTranslation('supporters');
    return (
        <section className="relative z-10 py-20 border-t border-pub-border">
            <div className="max-w-2xl 3xl:max-w-3xl mx-auto px-5 text-center space-y-6">
                <Heart className="w-10 h-10 3xl:w-12 3xl:h-12 text-pub-accent-hi mx-auto" />
                <h2 className={h2}>{t('footerCtaTitle')}</h2>
                <p className="text-[#8b93a3] text-lg 3xl:text-xl leading-relaxed">{t('footerCtaSubtitle')}</p>
                <div className="flex flex-wrap justify-center gap-3">
                    <a href="#tiers" className="px-8 py-3.5 rounded-md bg-pub-accent hover:bg-pub-accent-hi text-white font-bold transition-colors">{t('supportNow')}</a>
                    <Link to="/" className="px-8 py-3.5 rounded-md border border-pub-border hover:border-pub-accent/60 text-[#e6e9ef] font-bold transition-colors">{t('goToDecatron')}</Link>
                </div>
            </div>
        </section>
    );
}

export function SupFooter() {
    const { t } = useTranslation('supporters');
    return (
        <footer className="relative z-10 py-10 border-t border-pub-border">
            <div className={`${wrap} flex flex-col md:flex-row items-center justify-between gap-4 text-sm`}>
                <p className="font-mono text-xs text-[#8b93a3]">{t('footerPaypal')}</p>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[#8b93a3]">
                    <Link to="/terminos" className="hover:text-white transition-colors">{t('footerTerms')}</Link>
                    <Link to="/privacidad" className="hover:text-white transition-colors">{t('footerPrivacy')}</Link>
                    <Link to="/devoluciones" className="hover:text-white transition-colors">{t('footerRefunds')}</Link>
                    <Link to="/libro-reclamaciones" className="hover:text-white transition-colors">{t('footerClaims')}</Link>
                </div>
            </div>
        </footer>
    );
}
