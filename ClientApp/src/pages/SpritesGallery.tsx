import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, Filter, Bot, Check, X, Loader, Trophy, Zap } from 'lucide-react';
import api from '../services/api';
import SpiritCard, { type SpriteData, type SpriteCollectionItem } from '../components/spirits/SpiritCard';
import '../components/spirits/spirits.css';

const RARITIES = ['Rare', 'Special', 'Epic', 'Legendary', 'Mythic'];
const THEMES   = ['Basic', 'Gold', 'Candy', 'Galaxy', 'Gem', 'Holofoil', 'Rift'];

function getJwtUsername(): string {
    try {
        const token = localStorage.getItem('token');
        if (!token) return '';
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload['Name'] || payload['name'] || '';
    } catch { return ''; }
}

type StatusFilter = 'all' | 'obtained' | 'missing';

export default function SpritesGallery() {
    const { t } = useTranslation('spirits');
    const username = getJwtUsername();
    const isLoggedIn = !!username;

    // Sprite catalog
    const [sprites, setSprites] = useState<SpriteData[]>([]);
    const [loading, setLoading] = useState(true);

    // Auth users: their actual collection from API (set of spriteKeys they own)
    const [myKeys, setMyKeys] = useState<Set<string>>(new Set());
    const [collectionLoaded, setCollectionLoaded] = useState(false);
    const [pendingKey, setPendingKey] = useState<string | null>(null);

    // Guest users: local toggles (not saved)
    const [localKeys, setLocalKeys] = useState<Set<string>>(new Set());
    const [showGuestBanner, setShowGuestBanner] = useState(false);
    const [dismissedBanner, setDismissedBanner] = useState(false);

    // Toast
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    // Filters
    const [search, setSearch] = useState('');
    const [filterChar, setFilterChar] = useState('');
    const [filterRarity, setFilterRarity] = useState('');
    const [filterTheme, setFilterTheme] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [showUnreleased, setShowUnreleased] = useState(false);

    // Load catalog
    useEffect(() => {
        api.get('/fortnite/sprites')
            .then(r => { setSprites(r.data.sprites ?? []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    // Load auth user's collection
    useEffect(() => {
        if (!isLoggedIn) { setCollectionLoaded(true); return; }
        api.get('/fortnite/my-collection')
            .then(r => {
                const keys = new Set<string>(
                    (r.data.collection ?? []).filter((c: any) => c.isObtained).map((c: any) => c.sprite?.spriteKey ?? '')
                );
                setMyKeys(keys);
                setCollectionLoaded(true);
            })
            .catch(() => setCollectionLoaded(true));
    }, [isLoggedIn]);

    const showToast = (msg: string, type: 'ok' | 'err') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 2500);
    };

    const handleToggle = useCallback(async (item: SpriteCollectionItem) => {
        const key = item.sprite.spriteKey;

        if (isLoggedIn) {
            // Authenticated: toggle in DB
            if (pendingKey) return;
            setPendingKey(key);
            try {
                if (myKeys.has(key)) {
                    await api.delete(`/fortnite/my-collection/${key}`);
                    setMyKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
                    showToast(`${item.sprite.name} desmarcado`, 'ok');
                } else {
                    await api.post('/fortnite/my-collection/mark', { spriteKey: key, platform: 'web' });
                    setMyKeys(prev => new Set(prev).add(key));
                    showToast(`✅ ${item.sprite.name} obtenido!`, 'ok');
                }
            } catch {
                showToast('Error al actualizar', 'err');
            } finally {
                setPendingKey(null);
            }
        } else {
            // Guest: toggle locally, show banner
            setLocalKeys(prev => {
                const s = new Set(prev);
                if (s.has(key)) { s.delete(key); } else { s.add(key); }
                return s;
            });
            if (!showGuestBanner && !dismissedBanner) setShowGuestBanner(true);
        }
    }, [isLoggedIn, myKeys, pendingKey, showGuestBanner, dismissedBanner]);

    const characters = useMemo(() => [...new Set(sprites.map(s => s.character))].sort(), [sprites]);
    const released   = sprites.filter(s => !s.isUnreleased).length;

    const activeKeys = isLoggedIn ? myKeys : localKeys;
    const localCount = localKeys.size;
    const myCount    = myKeys.size;

    // Build collection items merging catalog + obtained status
    const allItems: SpriteCollectionItem[] = useMemo(() =>
        sprites.map(s => ({ sprite: s, isObtained: activeKeys.has(s.spriteKey) })),
    [sprites, activeKeys]);

    const filtered = useMemo(() => allItems.filter(c => {
        if (!showUnreleased && c.sprite.isUnreleased) return false;
        if (statusFilter === 'obtained' && !c.isObtained) return false;
        if (statusFilter === 'missing'  &&  c.isObtained) return false;
        if (filterChar   && c.sprite.character !== filterChar) return false;
        if (filterRarity && c.sprite.rarity    !== filterRarity) return false;
        if (filterTheme  && c.sprite.theme     !== filterTheme) return false;
        if (search && !c.sprite.name.toLowerCase().includes(search.toLowerCase()) &&
            !c.sprite.character.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    }), [allItems, statusFilter, filterChar, filterRarity, filterTheme, search, showUnreleased]);

    const hasFilters = !!(filterChar || filterRarity || filterTheme || search || showUnreleased || statusFilter !== 'all');
    const isLoading  = loading || (isLoggedIn && !collectionLoaded);

    const obtainedCount = isLoggedIn ? myCount : localCount;
    const percentage    = released > 0 ? Math.round(obtainedCount / released * 100) : 0;

    return (
        <div className="min-h-screen bg-[#0A0C14]">

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-bold ${
                    toast.type === 'ok'
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                }`}>
                    {toast.type === 'ok' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}

            {/* Guest save-progress banner */}
            {!isLoggedIn && showGuestBanner && !dismissedBanner && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
                    <div className="bg-[#111827] border border-[#7B61FF]/50 rounded-2xl p-4 shadow-2xl shadow-[#7B61FF]/20">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#7B61FF]/20 flex items-center justify-center flex-shrink-0">
                                <Zap className="w-5 h-5 text-[#7B61FF]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-white text-sm">
                                    {localCount === 1 ? '1 spirit marcado' : `${localCount} spirits marcados`} — sin cuenta no se guardan
                                </p>
                                <p className="text-[#9CA3AF] text-xs mt-0.5">
                                    Regístrate gratis con Twitch o Discord para guardar tu progreso y competir en el leaderboard.
                                </p>
                                <div className="flex gap-2 mt-3">
                                    <a
                                        href="/login"
                                        className="px-4 py-2 bg-[#7B61FF] hover:bg-[#6D54E8] text-white text-xs font-bold rounded-lg transition-colors"
                                    >
                                        Crear cuenta gratis →
                                    </a>
                                    <button
                                        onClick={() => setDismissedBanner(true)}
                                        className="px-3 py-2 text-[#4B5563] hover:text-[#9CA3AF] text-xs font-semibold transition-colors"
                                    >
                                        Ahora no
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => setDismissedBanner(true)} className="text-[#4B5563] hover:text-white transition-colors flex-shrink-0">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Public nav */}
            <header className="sticky top-0 z-40 bg-[#0A0C14]/90 backdrop-blur border-b border-[#1E2A3B]">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <a href="/" className="flex items-center gap-2 text-xl font-black text-[#7B61FF] hover:text-[#A78BFA] transition-colors">
                        <Bot className="w-6 h-6" />
                        <span>Decatron</span>
                    </a>
                    <div className="flex items-center gap-2">
                        {isLoggedIn ? (
                            <Link to="/me/spirits" className="px-4 py-2 bg-[#7B61FF] hover:bg-[#6D54E8] text-white text-sm font-bold rounded-lg transition-colors">
                                {t('gallery.my_collection')}
                            </Link>
                        ) : (
                            <>
                                <a href="/login" className="px-4 py-2 text-[#9CA3AF] hover:text-white text-sm font-semibold transition-colors">
                                    Iniciar sesión
                                </a>
                                <a href="/login" className="px-4 py-2 bg-[#7B61FF] hover:bg-[#6D54E8] text-white text-sm font-bold rounded-lg transition-colors">
                                    Registrarse gratis
                                </a>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="font-spirit text-4xl md:text-5xl font-black text-white tracking-tight">
                        {t('gallery.title')}
                    </h1>
                    <p className="text-[#9CA3AF] text-sm">
                        {released} spirits disponibles · Haz clic para marcar los que tienes
                    </p>
                </div>

                {/* Progress bar (visible when has something marked) */}
                {obtainedCount > 0 && (
                    <div className="bg-[#111827] rounded-2xl border border-[#1E2A3B] p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-[#7B61FF]" />
                                <span className="font-spirit text-lg font-black text-white">
                                    {obtainedCount} <span className="text-[#4B5563] text-sm">/ {released}</span>
                                </span>
                                {!isLoggedIn && (
                                    <span className="text-xs text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20 px-2 py-0.5 rounded-full font-bold">
                                        Sin guardar
                                    </span>
                                )}
                            </div>
                            <span className="font-spirit font-black text-[#7B61FF]">{percentage}%</span>
                        </div>
                        <div className="h-1.5 bg-[#0A0C14] rounded-full overflow-hidden">
                            <div
                                className="h-full spirit-progress-bar rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        {!isLoggedIn && (
                            <a href="/login" className="block text-center text-xs text-[#7B61FF] hover:text-[#A78BFA] font-bold transition-colors mt-1">
                                Regístrate para guardar tu progreso →
                            </a>
                        )}
                    </div>
                )}

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

                        <select value={filterChar} onChange={e => setFilterChar(e.target.value)}
                            className="px-3 py-1.5 bg-[#0A0C14] border border-[#1E2A3B] rounded-lg text-xs text-[#9CA3AF] focus:outline-none [&>option]:bg-[#111827]">
                            <option value="">{t('filters.all_characters')}</option>
                            {characters.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>

                        <select value={filterRarity} onChange={e => setFilterRarity(e.target.value)}
                            className="px-3 py-1.5 bg-[#0A0C14] border border-[#1E2A3B] rounded-lg text-xs text-[#9CA3AF] focus:outline-none [&>option]:bg-[#111827]">
                            <option value="">{t('filters.all_rarities')}</option>
                            {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>

                        <select value={filterTheme} onChange={e => setFilterTheme(e.target.value)}
                            className="px-3 py-1.5 bg-[#0A0C14] border border-[#1E2A3B] rounded-lg text-xs text-[#9CA3AF] focus:outline-none [&>option]:bg-[#111827]">
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
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-[#7B61FF]" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-[#4B5563]">
                        <p className="font-bold">{t('gallery.no_results')}</p>
                        <p className="text-sm mt-1">{t('gallery.no_results_hint')}</p>
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
        </div>
    );
}
