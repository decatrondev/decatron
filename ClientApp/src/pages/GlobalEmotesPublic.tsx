import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { decodeJwt, isTokenExpired } from '../utils/jwt';
import { EmoteThumb } from '../components/channel-emotes/shared';
import GlobalEmotesAdmin from './admin/GlobalEmotesAdmin';

// Página pública de los emotes globales de Decatron: /emotes/global. Cualquiera ve la galería; las personas
// que el dueño autorizó (por su usuario de Twitch) gestionan el set desde acá con su sesión.

interface Item { id: number; name: string; animated: boolean; urls: { x1: string; x2: string; x4: string } }

export default function GlobalEmotesPublic() {
    const { t } = useTranslation('emotes');
    const [items, setItems] = useState<Item[] | null>(null);
    const [search, setSearch] = useState('');
    const [copied, setCopied] = useState<string | null>(null);
    const [access, setAccess] = useState<'checking' | 'yes' | 'no'>('checking');

    const token = (() => { try { return localStorage.getItem('token'); } catch { return null; } })();
    const loggedIn = !!token && !isTokenExpired(token, 60);
    const myLogin = (token && decodeJwt(token)?.login) || '';
    const loginUrl = `/login?redirect=${encodeURIComponent('/emotes/global')}`;

    useEffect(() => {
        api.get('/public/global-emotes').then(r => setItems(r.data.emotes ?? [])).catch(() => setItems([]));
    }, []);
    useEffect(() => {
        if (!loggedIn) { setAccess('no'); return; }
        api.get('/admin/global-emotes').then(() => setAccess('yes')).catch(() => setAccess('no'));
    }, [loggedIn]);

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (items ?? []).filter(e => !q || e.name.toLowerCase().includes(q));
    }, [items, search]);

    const copy = (name: string) => {
        navigator.clipboard?.writeText(name).catch(() => { /* sin permiso */ });
        setCopied(name);
        setTimeout(() => setCopied(c => (c === name ? null : c)), 1500);
    };

    return (
        <div className="dark min-h-screen bg-[#0a0a0c] text-[#e4e4e7] px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-6xl 3xl:max-w-7xl mx-auto">
                <h1 className="text-2xl sm:text-3xl 3xl:text-4xl font-bold text-white">{t('global.publicTitle')}</h1>
                <p className="mt-2 mb-6 text-sm 3xl:text-base text-[#a1a1aa]">{t('global.publicSubtitle')}</p>

                {items === null ? <p className="font-mono text-sm text-[#71717a] animate-pulse">{t('global.loading')}</p> : (
                    <>
                        <div className="flex flex-wrap items-center gap-3 mb-5">
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('global.search')}
                                className="flex-1 min-w-[12rem] px-4 py-2.5 rounded-xl bg-[#111114] border border-[#27272a] text-white text-sm 3xl:text-base focus:outline-none focus:border-[#39ff14]/60" />
                            <span className="font-mono text-xs 3xl:text-sm text-[#71717a]">{t('public.count', { count: items.length })}</span>
                        </div>
                        {items.length === 0 ? <p className="font-mono text-sm text-[#71717a] py-8">{t('global.publicEmpty')}</p> : (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] 3xl:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] 4xl:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                                {shown.map(e => (
                                    <button key={e.id} type="button" onClick={() => copy(e.name)} title={t('public.clickToCopy')}
                                        className="rounded-xl border border-[#27272a] bg-[#111114] p-3 flex flex-col items-center gap-2 hover:border-[#39ff14]/40 transition-colors">
                                        <EmoteThumb src={e.urls.x2} name={e.name} height={48} bg="dark" />
                                        <span className="font-mono text-xs 3xl:text-sm font-bold text-white truncate max-w-full">{copied === e.name ? t('global.copied') : e.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}

                <section className="mt-12">
                    <h2 className="flex items-center gap-2 mb-3 font-mono text-xs 3xl:text-sm uppercase tracking-widest text-[#a1a1aa] font-bold">
                        <span className="text-[#39ff14]">#</span>{access === 'yes' ? t('global.manageTitle') : t('global.loginTitle')}
                    </h2>
                    {!loggedIn && (
                        <div className="rounded-2xl border border-[#27272a] bg-[#111114] p-5 space-y-3">
                            <p className="text-sm 3xl:text-base">{t('global.loginText')}</p>
                            <a href={loginUrl} className="inline-block px-6 py-2.5 rounded-xl bg-[#39ff14] hover:bg-[#2fe010] text-black font-bold text-sm 3xl:text-base">{t('global.loginButton')}</a>
                        </div>
                    )}
                    {loggedIn && access === 'checking' && <p className="font-mono text-sm text-[#71717a] animate-pulse">{t('global.loading')}</p>}
                    {loggedIn && access === 'no' && <p className="text-sm 3xl:text-base text-[#a1a1aa]">{t('global.noAccess', { login: myLogin || '…' })}</p>}
                    {access === 'yes' && <GlobalEmotesAdmin embedded />}
                </section>
            </div>
        </div>
    );
}
