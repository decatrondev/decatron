import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, Trophy, Share2, Check, X, Loader, Sparkles, MessageCircle } from 'lucide-react';
import api from '../../services/api';
import SpiritCard, { type SpriteData, type SpriteCollectionItem } from '../../components/spirits/SpiritCard';

const RARITIES = ['Rare', 'Special', 'Epic', 'Legendary', 'Mythic'];
const THEMES   = ['Basic', 'Gold', 'Candy', 'Galaxy', 'Gem', 'Holofoil', 'Cube', 'Rift/Cube', 'Cheat', 'Quack', 'Hacker'];

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
    const [filterSeason, setFilterSeason] = useState('');
    const [currentSeason, setCurrentSeason] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [showUnreleased, setShowUnreleased] = useState(false);

    // Aviso de spirits nuevos
    const [newSprites, setNewSprites] = useState<SpriteData[]>([]);
    const [showNewBanner, setShowNewBanner] = useState(false);
    const [notifyTwitchChat, setNotifyTwitchChat] = useState(false);
    const [notifyDiscordDm, setNotifyDiscordDm] = useState(false);
    const [hasDiscordLinked, setHasDiscordLinked] = useState(false);
    const [prefsLoaded, setPrefsLoaded] = useState(false);
    const [savingPrefs, setSavingPrefs] = useState(false);
    const [managingChannel, setManagingChannel] = useState<string | null>(null);

    const load = useCallback(() => {
        api.get('/fortnite/my-collection')
            .then(r => {
                setCollection(r.data.collection ?? []);
                setManagingChannel(r.data.managingChannel ?? null);
                setObtained(r.data.obtained ?? 0);
                setTotal(r.data.total ?? 0);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        api.get('/fortnite/current-season')
            .then(r => {
                const cs = r.data.currentSeason ?? '';
                setCurrentSeason(cs);
                setFilterSeason(cs);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        api.get('/fortnite/new-since-last-visit')
            .then(r => {
                const sprites: SpriteData[] = r.data.sprites ?? [];
                if (sprites.length > 0) {
                    setNewSprites(sprites);
                    setShowNewBanner(true);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        api.get('/fortnite/notification-prefs')
            .then(r => {
                setNotifyTwitchChat(!!r.data.notifyTwitchChat);
                setNotifyDiscordDm(!!r.data.notifyDiscordDm);
                setHasDiscordLinked(!!r.data.hasDiscordLinked);
                setPrefsLoaded(true);
            })
            .catch(() => setPrefsLoaded(true));
    }, []);

    const savePrefs = async (nextTwitch: boolean, nextDiscord: boolean) => {
        setNotifyTwitchChat(nextTwitch);
        setNotifyDiscordDm(nextDiscord);
        setSavingPrefs(true);
        try {
            await api.put('/fortnite/notification-prefs', { notifyTwitchChat: nextTwitch, notifyDiscordDm: nextDiscord });
        } catch {
            showToast(t('my.error'), 'err');
        } finally {
            setSavingPrefs(false);
        }
    };

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
    const seasons = useMemo(() => {
        const found = [...new Set(collection.map(c => c.sprite.season).filter((s): s is string => !!s))];
        return found.sort((a, b) => a === currentSeason ? -1 : b === currentSeason ? 1 : a.localeCompare(b));
    }, [collection]);
    const byRarity = useMemo(() => RARITIES.map(r => {
        const all = collection.filter(c => c.sprite.rarity === r && !c.sprite.isUnreleased);
        return { rarity: r, have: all.filter(c => c.isObtained).length, total: all.length };
    }).filter(r => r.total > 0), [collection]);
    const percentage = total > 0 ? Math.round(obtained / total * 100) : 0;
    const hasFilters = !!(filterChar || filterRarity || filterTheme || filterSeason !== currentSeason || search || showUnreleased || statusFilter !== 'all');

    const filtered = useMemo(() => {
        return collection.filter(c => {
            if (!showUnreleased && c.sprite.isUnreleased) return false;
            if (statusFilter === 'obtained' && !c.isObtained) return false;
            if (statusFilter === 'missing' && c.isObtained) return false;
            if (filterChar && c.sprite.character !== filterChar) return false;
            if (filterRarity && c.sprite.rarity !== filterRarity) return false;
            if (filterTheme && c.sprite.theme !== filterTheme) return false;
            if (filterSeason && c.sprite.season !== filterSeason) return false;
            if (search && !c.sprite.name.toLowerCase().includes(search.toLowerCase()) &&
                !c.sprite.character.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [collection, statusFilter, filterChar, filterRarity, filterTheme, filterSeason, search, showUnreleased]);

    const RARITY_COLOR: Record<string, string> = {
        Rare: '#60A5FA', Special: '#34D399', Epic: '#C084FC', Legendary: '#F59E0B', Mythic: '#F43F5E',
    };

    const card = 'bg-ds-surface rounded-lg border border-ds-border ';
    const field = 'px-3 py-2 bg-ds-bg border border-ds-border rounded-lg text-sm 3xl:text-base text-ds-text focus:outline-none focus:ring-2 focus:ring-ds-accent';
    const muted = 'text-ds-soft ';
    const activeBtn = 'bg-ds-accent text-ds-on-accent';
    const idleBtn = 'bg-ds-bg text-ds-soft hover:bg-ds-raised ';

    const Toggle = ({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) => (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(!on)}
            className={`w-full flex items-center justify-between gap-3 py-2 text-left ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
            <span className="text-sm 3xl:text-base text-ds-text">{label}</span>
            <span className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-colors ${on ? 'bg-ds-accent' : 'bg-ds-border '}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-ds-surface shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
            </span>
        </button>
    );

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" />
        </div>
    );

    const clearFilters = () => {
        setFilterChar(''); setFilterRarity(''); setFilterTheme(''); setFilterSeason(currentSeason);
        setSearch(''); setShowUnreleased(false); setStatusFilter('all');
    };

    return (
        <div className="panel-scale max-w-[1920px] mx-auto space-y-6">

            {/* Gestionando canal ajeno (control_total delegado) */}
            {managingChannel && (
                <div className="bg-ds-warn/10 border border-ds-warn/40 rounded-lg px-4 py-3 text-sm 3xl:text-base font-bold text-ds-warn">
                    {t('my.managing', { channel: managingChannel })}
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div role="status" className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold ${
                    toast.type === 'ok'
                        ? 'bg-ds-ok/10 border border-ds-ok/40 text-ds-ok '
                        : 'bg-ds-danger/10 border border-ds-danger/40 text-ds-danger '
                }`}>
                    {toast.type === 'ok' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}

            {/* Encabezado */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl 3xl:text-4xl font-black text-ds-text">{t('my.title')}</h1>
                    <p className={`text-sm 3xl:text-base mt-1 ${muted}`}>{t('my.subtitle')}</p>
                </div>
                <div className="flex gap-3">
                    {username && (
                        <button
                            onClick={copyLink}
                            className="flex items-center gap-2 px-4 py-3 bg-ds-surface rounded-lg border border-ds-border hover:bg-ds-bg transition-colors text-sm 3xl:text-base font-bold text-ds-soft"
                        >
                            {copied ? <Check className="w-4 h-4 text-ds-ok" /> : <Share2 className="w-4 h-4" />}
                            {copied ? t('my.copied') : t('my.share')}
                        </button>
                    )}
                    <Link
                        to="/sprites"
                        className="px-6 py-3 rounded-lg font-bold text-sm 3xl:text-base bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent transition-all"
                    >
                        {t('my.see_gallery')}
                    </Link>
                </div>
            </div>

            {/* Spirits nuevos desde la última visita */}
            {showNewBanner && newSprites.length > 0 && (
                <div className="bg-ds-accent/10 border border-ds-accent rounded-lg p-4 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-ds-accent-text flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm 3xl:text-base text-ds-text">
                            {newSprites.length === 1 ? t('my.new_one') : t('my.new_many', { count: newSprites.length })}
                        </p>
                        <p className="text-xs 3xl:text-sm mt-0.5 text-ds-accent-text truncate">
                            {newSprites.slice(0, 8).map(s => s.name).join(', ')}
                            {newSprites.length > 8 ? ` ${t('my.new_more', { count: newSprites.length - 8 })}` : ''}
                        </p>
                    </div>
                    <button onClick={() => setShowNewBanner(false)} aria-label={t('my.dismiss')} className={`${muted} hover:text-ds-text transition-colors flex-shrink-0`}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

                {/* Columna principal: filtros + colección */}
                <div className="xl:col-span-2 space-y-6 min-w-0 order-2 xl:order-1">

                    <div className={`${card} p-4 space-y-4`}>
                        <div className="flex flex-wrap gap-2">
                            {(['all', 'obtained', 'missing'] as StatusFilter[]).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold whitespace-nowrap transition-all ${statusFilter === s ? activeBtn : idleBtn}`}
                                >
                                    {s === 'all' ? t('filters.all') : s === 'obtained' ? t('filters.obtained') : t('filters.missing')}
                                </button>
                            ))}
                            <button
                                onClick={() => setShowUnreleased(v => !v)}
                                aria-pressed={showUnreleased}
                                className={`px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold whitespace-nowrap transition-all ${showUnreleased ?'bg-ds-warn text-ds-on-accent' : idleBtn}`}
                            >
                                {t('filters.unreleased')}
                            </button>
                        </div>

                        <div className="flex items-center gap-2 bg-ds-bg border border-ds-border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-ds-accent">
                            <Search className={`w-4 h-4 flex-shrink-0 ${muted}`} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={t('filters.search_placeholder')}
                                className="flex-1 bg-transparent text-sm 3xl:text-base text-ds-text placeholder-ds-soft focus:outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            <select value={filterChar} onChange={e => setFilterChar(e.target.value)} className={field}>
                                <option value="">{t('filters.all_characters')}</option>
                                {characters.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select value={filterRarity} onChange={e => setFilterRarity(e.target.value)} className={field}>
                                <option value="">{t('filters.all_rarities')}</option>
                                {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <select value={filterTheme} onChange={e => setFilterTheme(e.target.value)} className={field}>
                                <option value="">{t('filters.all_themes')}</option>
                                {THEMES.map(th => <option key={th} value={th}>{th}</option>)}
                            </select>
                            <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)} className={field}>
                                <option value="">{t('filters.all_seasons')}</option>
                                {seasons.map(se => (
                                    <option key={se} value={se}>{se === currentSeason ? `${se} (actual)` : se}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center justify-between text-xs 3xl:text-sm">
                            <span className={`font-bold ${muted}`}>{t('filters.count', { count: filtered.length })}</span>
                            {hasFilters && (
                                <button onClick={clearFilters} className="font-bold text-ds-accent-text hover:underline">
                                    {t('filters.clear')}
                                </button>
                            )}
                        </div>
                    </div>

                    {filtered.length === 0 ? (
                        <div className={`${card} text-center py-16 ${muted}`}>
                            <p className="font-bold">{t('no_spirits')}</p>
                        </div>
                    ) : (
                        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 1fr))' }}>
                            {filtered.map(item => (
                                <div key={item.sprite.id} className="relative">
                                    {pendingKey === item.sprite.spriteKey && (
                                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ds-input/40 rounded-lg">
                                            <Loader className="w-5 h-5 animate-spin text-ds-text" />
                                        </div>
                                    )}
                                    <SpiritCard item={item} interactive variant="panel" onClick={() => handleToggle(item)} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Columna lateral: progreso, rarezas, avisos */}
                <div className="xl:col-span-1 min-w-0 space-y-6 order-1 xl:order-2 xl:sticky xl:top-4">

                    <div className={`${card} p-5 space-y-4`}>
                        <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-ds-accent-text" />
                            <h2 className="text-base 3xl:text-lg font-black text-ds-text">{t('my.progress_title')}</h2>
                        </div>
                        <div className="flex items-end justify-between">
                            <span className="text-4xl 3xl:text-5xl font-black text-ds-text tabular-nums">
                                {obtained}<span className={`text-xl 3xl:text-2xl font-bold ${muted}`}> / {total}</span>
                            </span>
                            <span className="text-2xl 3xl:text-3xl font-black text-ds-accent-text tabular-nums">{percentage}%</span>
                        </div>
                        <div className="h-2.5 bg-ds-raised rounded-full overflow-hidden" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
                            <div className="h-full rounded-full bg-ds-accent transition-all duration-700" style={{ width: `${percentage}%` }} />
                        </div>
                        <div className={`flex gap-4 text-xs 3xl:text-sm ${muted}`}>
                            <span><span className="text-ds-ok font-bold">{obtained}</span> {t('progress.obtained')}</span>
                            <span><span className="font-bold text-ds-text">{total - obtained}</span> {t('progress.missing')}</span>
                        </div>

                        {byRarity.length > 0 && (
                            <div className="pt-4 border-t border-ds-border space-y-2.5">
                                <h3 className={`text-xs 3xl:text-sm font-bold ${muted}`}>{t('my.by_rarity')}</h3>
                                {byRarity.map(r => (
                                    <div key={r.rarity} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs 3xl:text-sm">
                                            <span className="font-bold text-ds-text">{r.rarity}</span>
                                            <span className={`tabular-nums ${muted}`}>{r.have} / {r.total}</span>
                                        </div>
                                        <div className="h-1.5 bg-ds-raised rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${r.total ? (r.have / r.total) * 100 : 0}%`, background: RARITY_COLOR[r.rarity] }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {prefsLoaded && (
                        <div className={`${card} p-5`}>
                            <h2 className="text-base 3xl:text-lg font-black text-ds-text mb-1">{t('my.notify_title')}</h2>
                            <div className="divide-y divide-ds-border">
                                <Toggle
                                    on={notifyTwitchChat}
                                    disabled={savingPrefs}
                                    onChange={v => savePrefs(v, notifyDiscordDm)}
                                    label={t('my.notify_twitch')}
                                />
                                <div>
                                    <Toggle
                                        on={notifyDiscordDm}
                                        disabled={savingPrefs || !hasDiscordLinked}
                                        onChange={v => savePrefs(notifyTwitchChat, v)}
                                        label={<span className="inline-flex items-center gap-1.5"><MessageCircle className="w-4 h-4 text-[#5865F2]" />{t('my.notify_discord')}</span>}
                                    />
                                    {!hasDiscordLinked && (
                                        <Link to="/settings" className="inline-block pb-1 text-xs 3xl:text-sm font-bold text-ds-accent-text hover:underline">
                                            {t('my.link_discord')}
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
