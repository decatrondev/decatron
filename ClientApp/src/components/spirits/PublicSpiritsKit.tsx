import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { SectionTitle } from '../../pages/song-request-public/shared';
import type { SpriteCollectionItem } from './SpiritCard';
import { RARITIES, THEMES, type SpiritFilters, type StatusFilter } from './useSpiritFilters';

// Piezas compartidas de /sprites y /sprites/:usuario, con el mismo lenguaje visual que /sr/:canal
// (fondo #0a0a0f con cuadrícula verde, acento #39ff14, títulos mono con "#", pestañas subrayadas).

export const RARITY_COLOR: Record<string, string> = {
    Rare: '#60A5FA', Special: '#34D399', Epic: '#C084FC', Legendary: '#F59E0B', Mythic: '#F43F5E',
};

const field = 'bg-[#111114] border border-[#27272a] rounded-md px-3 py-2 text-sm 3xl:text-base text-[#d4d4d8] focus:outline-none focus:border-[#39ff14]/60 [&>option]:bg-[#18181b]';

export function PublicShell({ brand, actions, children }: { brand: ReactNode; actions: ReactNode; children: ReactNode }) {
    const { t } = useTranslation('spirits');
    return (
        <div className="min-h-screen bg-[#0a0a0f] text-[#d4d4d8] relative overflow-x-hidden">
            <div
                className="pointer-events-none fixed inset-0 opacity-[0.04]"
                style={{
                    backgroundImage: 'linear-gradient(#39ff14 1px, transparent 1px), linear-gradient(90deg, #39ff14 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />
            <header className="sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur border-b border-[#27272a]">
                <div className="spirits-page max-w-6xl 3xl:max-w-[1500px] 4xl:max-w-[1900px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                    <a href="/" className="flex items-center gap-2 text-lg 3xl:text-xl font-black text-white hover:text-[#39ff14] transition-colors">{brand}</a>
                    <div className="flex items-center gap-2">{actions}</div>
                </div>
            </header>
            <div className="spirits-page relative max-w-6xl 3xl:max-w-[1500px] 4xl:max-w-[1900px] mx-auto px-4 sm:px-6 py-8 sm:py-12 4xl:py-16">
                {children}
                <footer className="mt-16 pt-6 border-t border-[#27272a] font-mono text-xs 3xl:text-sm text-[#3f3f46] flex items-center justify-between flex-wrap gap-2">
                    <span>{t('public.footer')}</span>
                    <span className="text-[#39ff14]/60">{window.location.host}</span>
                </footer>
            </div>
        </div>
    );
}

export function PageTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
    return (
        <div className="mb-8 4xl:mb-12 min-w-0">
            <p className="font-mono text-xs 3xl:text-sm 4xl:text-base uppercase tracking-widest text-[#39ff14]/80">{eyebrow}</p>
            <h1 className="text-3xl sm:text-4xl 3xl:text-5xl font-black text-white truncate">{title}</h1>
        </div>
    );
}

export const linkButton = 'px-3 py-2 text-sm 3xl:text-base font-semibold text-[#a1a1aa] hover:text-white transition-colors';
export const primaryButton = 'px-4 py-2 rounded-md text-sm 3xl:text-base font-bold bg-[#39ff14] text-black hover:bg-[#6bff4f] transition-colors';

export function ProgressPanel({ items, badge, children }: {
    items: SpriteCollectionItem[]; badge?: ReactNode; children?: ReactNode;
}) {
    const { t } = useTranslation('spirits');
    // Solo los lanzados, igual que las pestañas y el desglose por rareza
    const released = items.filter(c => !c.sprite.isUnreleased);
    const obtained = released.filter(c => c.isObtained).length;
    const total = released.length;
    const percentage = total > 0 ? Math.round(obtained / total * 100) : 0;
    const byRarity = RARITIES.map(r => {
        const all = items.filter(c => c.sprite.rarity === r && !c.sprite.isUnreleased);
        return { rarity: r, have: all.filter(c => c.isObtained).length, total: all.length };
    }).filter(r => r.total > 0);

    return (
        <section className="mb-8 4xl:mb-12">
            <SectionTitle>{t('public.progress')}</SectionTitle>
            <div className="rounded-lg border border-[#27272a] bg-[#111114] p-4 sm:p-5 4xl:p-6 space-y-4">
                <div className="flex items-end justify-between gap-3">
                    <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-3xl 3xl:text-4xl font-black text-white tabular-nums">
                            {obtained}<span className="text-lg 3xl:text-xl font-bold text-[#52525b]"> / {total}</span>
                        </span>
                        {badge}
                    </div>
                    <span className="font-mono text-xl 3xl:text-2xl font-bold text-[#39ff14] tabular-nums">{percentage}%</span>
                </div>
                <div className="h-1.5 bg-[#27272a] rounded-full overflow-hidden" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-[#39ff14] shadow-[0_0_10px_rgba(57,255,20,0.5)] transition-all duration-700" style={{ width: `${percentage}%` }} />
                </div>
                {byRarity.length > 0 && (
                    <ul className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs 3xl:text-sm text-[#a1a1aa]">
                        {byRarity.map(r => (
                            <li key={r.rarity} className="flex items-center gap-2" title={t('public.by_rarity')}>
                                <span className="w-2 h-2 rounded-full" style={{ background: RARITY_COLOR[r.rarity] }} />
                                {r.rarity}
                                <span className="text-white tabular-nums">{r.have}/{r.total}</span>
                            </li>
                        ))}
                    </ul>
                )}
                {children}
            </div>
        </section>
    );
}

export function SpiritFilterBar({ f, items }: { f: SpiritFilters; items: SpriteCollectionItem[] }) {
    const { t } = useTranslation('spirits');
    const released = items.filter(c => !c.sprite.isUnreleased);
    const have = released.filter(c => c.isObtained).length;
    const counts: Record<StatusFilter, number> = { all: released.length, obtained: have, missing: released.length - have };

    return (
        <section className="mb-6">
            <nav role="tablist" className="flex items-center mb-5 border-b border-[#27272a] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(['all', 'obtained', 'missing'] as StatusFilter[]).map(s => (
                    <button
                        key={s}
                        role="tab"
                        aria-selected={f.statusFilter === s}
                        onClick={() => f.setStatusFilter(s)}
                        className={`shrink-0 px-3 sm:px-4 py-2.5 font-mono text-xs 3xl:text-sm uppercase tracking-wider border-b-2 -mb-px transition-colors ${
                            f.statusFilter === s ? 'border-[#39ff14] text-[#39ff14]' : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                        }`}
                    >
                        {s === 'all' ? t('filters.all') : s === 'obtained' ? t('filters.obtained') : t('filters.missing')}
                        <span className="ml-2 tabular-nums opacity-70">{counts[s]}</span>
                    </button>
                ))}
            </nav>

            <div className="space-y-2">
                <input
                    type="search"
                    value={f.search}
                    onChange={e => f.setSearch(e.target.value)}
                    placeholder={t('filters.search_placeholder')}
                    className={`w-full ${field} placeholder-[#52525b]`}
                />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <select value={f.filterChar} onChange={e => f.setFilterChar(e.target.value)} className={field}>
                        <option value="">{t('filters.all_characters')}</option>
                        {f.characters.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={f.filterRarity} onChange={e => f.setFilterRarity(e.target.value)} className={field}>
                        <option value="">{t('filters.all_rarities')}</option>
                        {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={f.filterTheme} onChange={e => f.setFilterTheme(e.target.value)} className={field}>
                        <option value="">{t('filters.all_themes')}</option>
                        {THEMES.map(th => <option key={th} value={th}>{th}</option>)}
                    </select>
                    <select value={f.filterSeason} onChange={e => f.setFilterSeason(e.target.value)} className={field}>
                        <option value="">{t('filters.all_seasons')}</option>
                        {f.seasons.map(se => (
                            <option key={se} value={se}>{se === f.currentSeason ? `${se} (${t('public.current')})` : se}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center justify-between font-mono text-xs 3xl:text-sm text-[#71717a] pt-1">
                    <span>{t('filters.count', { count: f.filtered.length })}</span>
                    <div className="flex items-center gap-4">
                        {f.hasFilters && (
                            <button onClick={f.clear} className="text-[#39ff14] hover:underline">{t('filters.clear')}</button>
                        )}
                        <button
                            onClick={() => f.setShowUnreleased(v => !v)}
                            aria-pressed={f.showUnreleased}
                            className={`px-2.5 py-1 rounded border uppercase tracking-wide transition-colors ${
                                f.showUnreleased ? 'bg-amber-400/10 text-amber-300 border-amber-400/25' : 'border-[#27272a] hover:text-[#d4d4d8]'
                            }`}
                        >
                            {t('filters.unreleased')}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}

export function SpiritGridBox({ children }: { children: ReactNode }) {
    return (
        <div className="grid gap-3 3xl:gap-4 grid-cols-[repeat(auto-fill,minmax(104px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] 3xl:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] 4xl:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
            {children}
        </div>
    );
}

export function EmptyNotice({ title, hint }: { title: string; hint?: string }) {
    return (
        <div className="rounded-lg border border-[#27272a] bg-[#111114] p-8 text-center">
            <p className="font-bold text-[#a1a1aa]">{title}</p>
            {hint && <p className="text-sm text-[#52525b] mt-1">{hint}</p>}
        </div>
    );
}

export function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
    return (
        <div role="status" className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-md border shadow-xl text-sm font-bold ${
            type === 'ok' ? 'bg-[#0a0a0f] border-[#39ff14]/40 text-[#39ff14]' : 'bg-[#0a0a0f] border-red-500/40 text-red-400'
        }`}>
            {type === 'ok' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {msg}
        </div>
    );
}
