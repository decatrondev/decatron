import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, Filter, Trophy, ExternalLink, Bot, Zap } from 'lucide-react';
import api from '../services/api';
import SpiritCard, { type SpriteCollectionItem } from '../components/spirits/SpiritCard';
import '../components/spirits/spirits.css';

const RARITIES = ['Rare', 'Special', 'Epic', 'Legendary', 'Mythic'];
const THEMES   = ['Basic', 'Gold', 'Candy', 'Galaxy', 'Gem', 'Holofoil', 'Rift'];

type StatusFilter = 'all' | 'obtained' | 'missing';

export default function SpiritCollection() {
    const { username } = useParams<{ username: string }>();
    const { t } = useTranslation('spirits');

    const [collection, setCollection] = useState<SpriteCollectionItem[]>([]);
    const [obtained, setObtained] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const [search, setSearch] = useState('');
    const [filterChar, setFilterChar] = useState('');
    const [filterRarity, setFilterRarity] = useState('');
    const [filterTheme, setFilterTheme] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [showUnreleased, setShowUnreleased] = useState(false);

    useEffect(() => {
        if (!username) return;
        setLoading(true);
        api.get(`/fortnite/collection/${username}`)
            .then(r => {
                setCollection(r.data.collection ?? []);
                setObtained(r.data.obtained ?? 0);
                setTotal(r.data.total ?? 0);
                setLoading(false);
            })
            .catch(err => {
                if (err.response?.status === 404) setNotFound(true);
                setLoading(false);
            });
    }, [username]);

    const characters = useMemo(() => [...new Set(collection.map(c => c.sprite.character))].sort(), [collection]);
    const percentage = total > 0 ? Math.round(obtained / total * 100) : 0;

    const filtered = useMemo(() => {
        return collection.filter(c => {
            if (!showUnreleased && c.sprite.isUnreleased) return false;
            if (statusFilter === 'obtained' && !c.isObtained) return false;
            if (statusFilter === 'missing' && c.isObtained) return false;
            if (filterChar && c.sprite.character !== filterChar) return false;
            if (filterRarity && c.sprite.rarity !== filterRarity) return false;
            if (filterTheme && c.sprite.theme !== filterTheme) return false;
            if (search && !c.sprite.name.toLowerCase().includes(search.toLowerCase()) &&
                !c.sprite.character.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [collection, statusFilter, filterChar, filterRarity, filterTheme, search, showUnreleased]);

    const hasFilters = !!(filterChar || filterRarity || filterTheme || search || showUnreleased || statusFilter !== 'all');

    if (loading) return (
        <div className="min-h-screen bg-[#0A0C14] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#7B61FF]" />
        </div>
    );

    if (notFound) return (
        <div className="min-h-screen bg-[#0A0C14] flex items-center justify-center text-center px-4">
            <div className="space-y-4">
                <p className="text-6xl">👻</p>
                <h2 className="font-spirit text-2xl font-black text-white">{t('collection.not_found_title')}</h2>
                <p className="text-[#9CA3AF]">{t('collection.not_found_desc', { username })}</p>
                <Link to="/sprites" className="inline-block mt-4 px-5 py-2.5 bg-[#7B61FF] hover:bg-[#6D54E8] text-white rounded-xl text-sm font-bold transition-colors">
                    {t('collection.see_all')}
                </Link>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0A0C14]">
            {/* Public nav */}
            <header className="sticky top-0 z-40 bg-[#0A0C14]/90 backdrop-blur border-b border-[#1E2A3B]">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <a href="/" className="flex items-center gap-2 text-xl font-black text-[#7B61FF] hover:text-[#A78BFA] transition-colors">
                        <Bot className="w-6 h-6" />
                        <span>Decatron</span>
                    </a>
                    <div className="flex items-center gap-2">
                        <Link to="/sprites" className="px-3 py-2 text-[#9CA3AF] hover:text-white text-sm font-semibold transition-colors">
                            Ver catálogo
                        </Link>
                        <a href="/login" className="px-4 py-2 bg-[#7B61FF] hover:bg-[#6D54E8] text-white text-sm font-bold rounded-lg transition-colors">
                            Trackea tu colección →
                        </a>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">

                {/* Header */}
                <div className="space-y-6">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                            <p className="text-[#9CA3AF] text-sm mb-1">{t('collection.collected_by')}</p>
                            <h1 className="font-spirit text-3xl md:text-4xl font-black text-white">
                                @{username}
                            </h1>
                        </div>
                        <Link
                            to="/sprites"
                            className="flex items-center gap-2 px-4 py-2 bg-[#111827] border border-[#1E2A3B] text-[#9CA3AF] rounded-xl text-sm font-bold hover:border-[#7B61FF]/50 transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" /> {t('collection.see_catalog')}
                        </Link>
                    </div>

                    {/* Progress */}
                    <div className="bg-[#111827] rounded-2xl border border-[#1E2A3B] p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Trophy className="w-5 h-5 text-[#7B61FF]" />
                                <span className="font-spirit text-2xl font-black text-white">{obtained} <span className="text-[#4B5563] text-lg">/ {total}</span></span>
                            </div>
                            <span className="font-spirit text-xl font-black text-[#7B61FF]">{percentage}%</span>
                        </div>
                        <div className="h-2 bg-[#0A0C14] rounded-full overflow-hidden">
                            <div
                                className="h-full spirit-progress-bar rounded-full transition-all duration-700"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <div className="flex gap-4 text-xs text-[#4B5563]">
                            <span><span className="text-[#34D399] font-bold">{obtained}</span> {t('progress.obtained')}</span>
                            <span><span className="text-[#374151] font-bold">{total - obtained}</span> {t('progress.missing')}</span>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-[#111827] rounded-2xl border border-[#1E2A3B] p-4 space-y-3">
                    <div className="flex items-center gap-2 bg-[#0A0C14] border border-[#1E2A3B] rounded-xl px-3 py-2">
                        <Search className="w-4 h-4 text-[#4B5563] flex-shrink-0" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('filters.search_placeholder')}
                            className="flex-1 bg-transparent text-sm text-[#F9FAFB] placeholder-[#4B5563] focus:outline-none"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1 text-[#4B5563]">
                            <Filter className="w-3.5 h-3.5" />
                        </div>

                        {(['all', 'obtained', 'missing'] as StatusFilter[]).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    statusFilter === s
                                        ? s === 'obtained' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          : s === 'missing' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                          : 'bg-[#7B61FF]/20 text-[#A78BFA] border border-[#7B61FF]/30'
                                        : 'bg-[#0A0C14] border border-[#1E2A3B] text-[#4B5563]'
                                }`}
                            >
                                {s === 'all' ? t('filters.all') : s === 'obtained' ? t('filters.obtained') : t('filters.missing')}
                            </button>
                        ))}

                        <select
                            value={filterChar}
                            onChange={e => setFilterChar(e.target.value)}
                            className="px-3 py-1.5 bg-[#0A0C14] border border-[#1E2A3B] rounded-lg text-xs text-[#9CA3AF] focus:outline-none focus:border-[#7B61FF] [&>option]:bg-[#111827]"
                        >
                            <option value="">{t('filters.all_characters')}</option>
                            {characters.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>

                        <select
                            value={filterRarity}
                            onChange={e => setFilterRarity(e.target.value)}
                            className="px-3 py-1.5 bg-[#0A0C14] border border-[#1E2A3B] rounded-lg text-xs text-[#9CA3AF] focus:outline-none focus:border-[#7B61FF] [&>option]:bg-[#111827]"
                        >
                            <option value="">{t('filters.all_rarities')}</option>
                            {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>

                        <select
                            value={filterTheme}
                            onChange={e => setFilterTheme(e.target.value)}
                            className="px-3 py-1.5 bg-[#0A0C14] border border-[#1E2A3B] rounded-lg text-xs text-[#9CA3AF] focus:outline-none focus:border-[#7B61FF] [&>option]:bg-[#111827]"
                        >
                            <option value="">{t('filters.all_themes')}</option>
                            {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>

                        <button
                            onClick={() => setShowUnreleased(v => !v)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                showUnreleased
                                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                    : 'bg-[#0A0C14] border border-[#1E2A3B] text-[#4B5563]'
                            }`}
                        >
                            {t('filters.unreleased')}
                        </button>

                        {hasFilters && (
                            <button
                                onClick={() => { setFilterChar(''); setFilterRarity(''); setFilterTheme(''); setSearch(''); setShowUnreleased(false); setStatusFilter('all'); }}
                                className="px-3 py-1.5 bg-[#7B61FF]/10 border border-[#7B61FF]/30 text-[#7B61FF] rounded-lg text-xs font-bold hover:bg-[#7B61FF]/20 transition-colors"
                            >
                                {t('filters.clear')}
                            </button>
                        )}

                        <span className="ml-auto text-xs text-[#4B5563] self-center">
                            {t('filters.count', { count: filtered.length })}
                        </span>
                    </div>
                </div>

                {/* Grid */}
                {filtered.length === 0 ? (
                    <div className="text-center py-20 text-[#4B5563]">
                        <p className="font-bold">{t('no_spirits')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                        {filtered.map(item => (
                            <SpiritCard key={item.sprite.id} item={item} />
                        ))}
                    </div>
                )}

                {/* CTA para visitantes */}
                <div className="mt-12 rounded-2xl border border-[#7B61FF]/20 bg-gradient-to-r from-[#7B61FF]/10 to-[#A78BFA]/5 p-8 flex flex-col sm:flex-row items-center gap-6">
                    <div className="flex-shrink-0 w-14 h-14 rounded-full bg-[#7B61FF]/20 flex items-center justify-center">
                        <Zap className="w-7 h-7 text-[#7B61FF]" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                        <p className="font-spirit text-lg font-black text-white">¿Tienes tus propios Fortnite Spirits?</p>
                        <p className="text-[#9CA3AF] text-sm mt-1">Regístrate en Decatron con Twitch o Discord y trackea tu colección, compártela y compite en el leaderboard.</p>
                    </div>
                    <a
                        href="/login"
                        className="flex-shrink-0 px-6 py-3 bg-[#7B61FF] hover:bg-[#6D54E8] text-white font-bold rounded-xl transition-colors whitespace-nowrap"
                    >
                        Empezar gratis →
                    </a>
                </div>
            </div>
        </div>
    );
}
