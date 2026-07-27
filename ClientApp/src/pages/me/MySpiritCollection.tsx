import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, Filter, Trophy, Share2, Check, X, Loader } from 'lucide-react';
import api from '../../services/api';
import SpiritCard, { type SpriteCollectionItem } from '../../components/spirits/SpiritCard';
import '../../components/spirits/spirits.css';

const RARITIES = ['Rare', 'Special', 'Epic', 'Legendary', 'Mythic'];
const THEMES   = ['Basic', 'Gold', 'Candy', 'Galaxy', 'Gem', 'Holofoil', 'Rift'];

type StatusFilter = 'all' | 'obtained' | 'missing';

function getJwtUsername(): string {
    try {
        const token = localStorage.getItem('token');
        if (!token) return '';
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload['Name'] || payload['name'] || '';
    } catch { return ''; }
}

export default function MySpiritCollection() {
    const { t } = useTranslation('spirits');
    const username = getJwtUsername();

    const [collection, setCollection] = useState<SpriteCollectionItem[]>([]);
    const [obtained, setObtained] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
    const [copied, setCopied] = useState(false);

    const [search, setSearch] = useState('');
    const [filterChar, setFilterChar] = useState('');
    const [filterRarity, setFilterRarity] = useState('');
    const [filterTheme, setFilterTheme] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [showUnreleased, setShowUnreleased] = useState(false);

    const load = useCallback(() => {
        api.get('/fortnite/my-collection')
            .then(r => {
                setCollection(r.data.collection ?? []);
                setObtained(r.data.obtained ?? 0);
                setTotal(r.data.total ?? 0);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const showToast = (msg: string, type: 'ok' | 'err') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 2500);
    };

    const handleToggle = async (item: SpriteCollectionItem) => {
        const key = item.sprite.spriteKey;
        if (pendingKey) return;
        setPendingKey(key);
        try {
            if (item.isObtained) {
                await api.delete(`/fortnite/my-collection/${key}`);
                setCollection(prev => prev.map(c =>
                    c.sprite.spriteKey === key ? { ...c, isObtained: false, obtainedAt: undefined, platform: undefined } : c
                ));
                setObtained(v => v - 1);
                showToast(t('my.unmarked', { name: item.sprite.name }), 'ok');
            } else {
                await api.post('/fortnite/my-collection/mark', { spriteKey: key, platform: 'web' });
                setCollection(prev => prev.map(c =>
                    c.sprite.spriteKey === key ? { ...c, isObtained: true, obtainedAt: new Date().toISOString(), platform: 'web' } : c
                ));
                setObtained(v => v + 1);
                showToast(t('my.marked', { name: item.sprite.name }), 'ok');
            }
        } catch {
            showToast(t('my.error'), 'err');
        } finally {
            setPendingKey(null);
        }
    };

    const copyLink = () => {
        const url = `${window.location.origin}/sprites/${username}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const characters = useMemo(() => [...new Set(collection.map(c => c.sprite.character))].sort(), [collection]);
    const percentage = total > 0 ? Math.round(obtained / total * 100) : 0;
    const hasFilters = !!(filterChar || filterRarity || filterTheme || search || showUnreleased || statusFilter !== 'all');

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

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#7B61FF]" />
        </div>
    );

    return (
        <div className="space-y-6 bg-[#0A0C14] min-h-screen -m-6 p-6">

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-bold transition-all ${
                    toast.type === 'ok'
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                }`}>
                    {toast.type === 'ok' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="font-spirit text-3xl font-black text-white">{t('my.title')}</h1>
                    <p className="text-[#9CA3AF] text-sm mt-1">{t('my.subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    {username && (
                        <button
                            onClick={copyLink}
                            className="flex items-center gap-2 px-4 py-2 bg-[#111827] border border-[#1E2A3B] text-[#9CA3AF] rounded-xl text-sm font-bold hover:border-[#7B61FF]/50 transition-colors"
                        >
                            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                            {copied ? t('my.copied') : t('my.share')}
                        </button>
                    )}
                    <Link
                        to="/sprites"
                        className="px-4 py-2 bg-[#7B61FF] hover:bg-[#6D54E8] text-white rounded-xl text-sm font-bold transition-colors"
                    >
                        {t('my.see_gallery')}
                    </Link>
                </div>
            </div>

            {/* Progress */}
            <div className="bg-[#111827] rounded-2xl border border-[#1E2A3B] p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-[#7B61FF]" />
                        <span className="font-spirit text-2xl font-black text-white">
                            {obtained} <span className="text-[#4B5563] text-lg">/ {total}</span>
                        </span>
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
                        className="px-3 py-1.5 bg-[#0A0C14] border border-[#1E2A3B] rounded-lg text-xs text-[#9CA3AF] focus:outline-none [&>option]:bg-[#111827]"
                    >
                        <option value="">{t('filters.all_characters')}</option>
                        {characters.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select
                        value={filterRarity}
                        onChange={e => setFilterRarity(e.target.value)}
                        className="px-3 py-1.5 bg-[#0A0C14] border border-[#1E2A3B] rounded-lg text-xs text-[#9CA3AF] focus:outline-none [&>option]:bg-[#111827]"
                    >
                        <option value="">{t('filters.all_rarities')}</option>
                        {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>

                    <select
                        value={filterTheme}
                        onChange={e => setFilterTheme(e.target.value)}
                        className="px-3 py-1.5 bg-[#0A0C14] border border-[#1E2A3B] rounded-lg text-xs text-[#9CA3AF] focus:outline-none [&>option]:bg-[#111827]"
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
                        <div key={item.sprite.id} className="relative">
                            {pendingKey === item.sprite.spriteKey && (
                                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-2xl">
                                    <Loader className="w-5 h-5 animate-spin text-[#7B61FF]" />
                                </div>
                            )}
                            <SpiritCard
                                item={item}
                                interactive
                                onClick={() => handleToggle(item)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
