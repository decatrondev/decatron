import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, Loader, Zap } from 'lucide-react';
import api from '../services/api';
import SpiritCard, { type SpriteData, type SpriteCollectionItem } from '../components/spirits/SpiritCard';
import '../components/spirits/spirits.css';
import { BrandMark } from '../brand/BrandMark';
import { useSpiritFilters } from '../components/spirits/useSpiritFilters';
import {
    PublicShell, PageTitle, ProgressPanel, SpiritFilterBar, SpiritGridBox, EmptyNotice, Toast,
    linkButton, primaryButton,
} from '../components/spirits/PublicSpiritsKit';

function getJwtUsername(): string {
    try {
        const token = localStorage.getItem('token');
        if (!token) return '';
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload['Name'] || payload['name'] || '';
    } catch { return ''; }
}

export default function SpritesGallery() {
    const { t } = useTranslation('spirits');
    const username = getJwtUsername();
    const isLoggedIn = !!username;

    // Catálogo de sprites
    const [sprites, setSprites] = useState<SpriteData[]>([]);
    const [loading, setLoading] = useState(true);

    // Usuarios con sesión: su colección real (spriteKeys que tienen)
    const [myKeys, setMyKeys] = useState<Set<string>>(new Set());
    const [collectionLoaded, setCollectionLoaded] = useState(false);
    const [pendingKey, setPendingKey] = useState<string | null>(null);

    // Invitados: marcas locales (no se guardan)
    const [localKeys, setLocalKeys] = useState<Set<string>>(new Set());
    const [showGuestBanner, setShowGuestBanner] = useState(false);
    const [dismissedBanner, setDismissedBanner] = useState(false);

    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    useEffect(() => {
        api.get('/fortnite/sprites')
            .then(r => { setSprites(r.data.sprites ?? []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

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
            if (pendingKey) return;
            setPendingKey(key);
            try {
                if (myKeys.has(key)) {
                    await api.delete(`/fortnite/my-collection/${key}`);
                    setMyKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
                    showToast(t('my.unmarked', { name: item.sprite.name }), 'ok');
                } else {
                    await api.post('/fortnite/my-collection/mark', { spriteKey: key, platform: 'web' });
                    setMyKeys(prev => new Set(prev).add(key));
                    showToast(t('my.marked', { name: item.sprite.name }), 'ok');
                }
            } catch {
                showToast(t('my.error'), 'err');
            } finally {
                setPendingKey(null);
            }
        } else {
            setLocalKeys(prev => {
                const s = new Set(prev);
                if (s.has(key)) { s.delete(key); } else { s.add(key); }
                return s;
            });
            if (!showGuestBanner && !dismissedBanner) setShowGuestBanner(true);
        }
    }, [isLoggedIn, myKeys, pendingKey, showGuestBanner, dismissedBanner, t]);

    const released = sprites.filter(s => !s.isUnreleased).length;
    const activeKeys = isLoggedIn ? myKeys : localKeys;
    const obtainedCount = activeKeys.size;

    const allItems: SpriteCollectionItem[] = useMemo(() =>
        sprites.map(s => ({ sprite: s, isObtained: activeKeys.has(s.spriteKey) })),
    [sprites, activeKeys]);

    const f = useSpiritFilters(allItems);
    const isLoading = loading || (isLoggedIn && !collectionLoaded);

    return (
        <PublicShell
            brand={<BrandMark slot="sprites-header" fallback={<><Bot className="w-6 h-6" /><span>Decatron</span></>} />}
            actions={isLoggedIn ? (
                <Link to="/me/spirits" className={primaryButton}>{t('gallery.my_collection')}</Link>
            ) : (
                <>
                    <a href="/login" className={linkButton}>{t('public.login')}</a>
                    <a href="/login" className={primaryButton}>{t('public.signup')}</a>
                </>
            )}
        >
            {toast && <Toast msg={toast.msg} type={toast.type} />}

            {!isLoggedIn && showGuestBanner && !dismissedBanner && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
                    <div className="bg-pub-surface border border-pub-accent/40 rounded-lg p-4 shadow-2xl shadow-black/60">
                        <div className="flex items-start gap-3">
                            <Zap className="w-5 h-5 text-pub-accent-hi flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-white text-sm">
                                    {localKeys.size === 1 ? t('public.guest_one') : t('public.guest_many', { count: localKeys.size })}
                                </p>
                                <p className="text-[#a1a1aa] text-xs mt-1">{t('public.guest_body')}</p>
                                <div className="flex gap-2 mt-3">
                                    <a href="/login" className={`${primaryButton} !text-xs !px-3`}>{t('public.guest_cta')}</a>
                                    <button onClick={() => setDismissedBanner(true)} className="px-3 py-2 text-[#71717a] hover:text-[#d4d4d8] text-xs font-semibold transition-colors">
                                        {t('public.guest_later')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <PageTitle eyebrow={t('gallery.subtitle_available', { count: released })} title={t('gallery.title')} />

            {obtainedCount > 0 ? (
                <ProgressPanel
                    items={allItems}
                    badge={!isLoggedIn && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded border uppercase tracking-wide bg-amber-400/10 text-amber-300 border-amber-400/25">
                            {t('public.unsaved')}
                        </span>
                    )}
                >
                    {!isLoggedIn && (
                        <a href="/login" className="inline-block font-mono text-xs 3xl:text-sm text-pub-accent-hi hover:underline">{t('public.save_progress')}</a>
                    )}
                </ProgressPanel>
            ) : (
                <p className="mb-8 font-mono text-xs 3xl:text-sm text-[#71717a]">{t('public.hint')}</p>
            )}

            <SpiritFilterBar f={f} items={allItems} />

            {isLoading ? (
                <p className="font-mono text-sm 3xl:text-base text-[#71717a] animate-pulse">...</p>
            ) : f.filtered.length === 0 ? (
                <EmptyNotice title={t('gallery.no_results')} hint={t('gallery.no_results_hint')} />
            ) : (
                <SpiritGridBox>
                    {f.filtered.map(item => (
                        <div key={item.sprite.id} className="relative">
                            {pendingKey === item.sprite.spriteKey && (
                                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 rounded-xl">
                                    <Loader className="w-5 h-5 animate-spin text-pub-accent-hi" />
                                </div>
                            )}
                            <SpiritCard item={item} interactive onClick={() => handleToggle(item)} />
                        </div>
                    ))}
                </SpiritGridBox>
            )}
        </PublicShell>
    );
}
