import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Bot, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '../../brand/BrandMark';
import ThemeToggle from '../../components/ThemeToggle';
import DocsLanguageSwitch from '../../components/docs/DocsLanguageSwitch';
import { DOC_GROUP_ORDER, docUrl, pagesFor } from './registry';

// Marco de las docs públicas (tipo 1): base común azul/grafito (tokens pub-*), modo claro y oscuro
// para lectura larga, y escala en pantallas grandes con .panel-scale. El índice de la derecha se
// arma solo con los h2 de cada página.

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function DocsLayout() {
    const { t } = useTranslation('docs');
    const { pathname } = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const bodyRef = useRef<HTMLDivElement>(null);
    const [toc, setToc] = useState<{ id: string; text: string }[]>([]);
    const [active, setActive] = useState('');
    const isLoggedIn = !!localStorage.getItem('token');

    useEffect(() => { setMenuOpen(false); }, [pathname]);

    // Índice a partir de los h2 de la página; se rearma cuando cambia el contenido (textos que cargan después)
    useEffect(() => {
        const root = bodyRef.current;
        if (!root) return;
        let io: IntersectionObserver | undefined;
        let timer: number | undefined;

        const build = () => {
            io?.disconnect();
            const used = new Set<string>();
            const heads = Array.from(root.querySelectorAll<HTMLElement>('h2'));
            const items = heads.map(h => {
                let id = h.id || slug(h.textContent ?? '');
                while (!id || used.has(id)) id = `${id || 's'}-${used.size}`;
                used.add(id);
                h.id = id;
                h.classList.add('scroll-mt-28');
                return { id, text: h.textContent ?? '' };
            });
            setToc(prev => (JSON.stringify(prev) === JSON.stringify(items) ? prev : items));
            if (!items.length) return;
            io = new IntersectionObserver(entries => {
                const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                if (visible) setActive(visible.target.id);
            }, { rootMargin: '-96px 0px -65% 0px' });
            heads.forEach(h => io!.observe(h));
        };

        const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(build, 150); };
        const mo = new MutationObserver(schedule);
        mo.observe(root, { childList: true, subtree: true, characterData: true });
        schedule();
        return () => { mo.disconnect(); io?.disconnect(); window.clearTimeout(timer); };
    }, [pathname]);

    const sidebar = (
        <nav aria-label={t('layout.documentation')} className="space-y-6">
            {DOC_GROUP_ORDER.public.map(group => {
                const items = pagesFor('public', group);
                if (!items.length) return null;
                return (
                    <div key={group}>
                        <p className="px-3 mb-2 font-mono text-xs font-semibold text-[#5b6475] dark:text-[#8b93a3]"># {t(`groups.${group}`)}</p>
                        <div className="space-y-0.5">
                            {items.map(page => {
                                const to = docUrl('public', page.path);
                                const isActive = pathname === to;
                                return (
                                    <Link
                                        key={page.id}
                                        to={to}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={`block border-l-2 pl-3 pr-2 py-1.5 text-sm leading-snug transition-colors ${
                                            isActive
                                                ? 'border-[#2563eb] dark:border-pub-accent text-[#2563eb] dark:text-pub-accent-hi font-semibold'
                                                : 'border-[#dfe3ea] dark:border-pub-border text-[#5b6475] dark:text-[#8b93a3] hover:text-[#12151c] dark:hover:text-white'
                                        }`}
                                    >
                                        {t(`pages.${page.id}.title`)}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </nav>
    );

    return (
        <div className="docs-pub min-h-screen flex flex-col bg-[#f6f7fa] dark:bg-pub-bg text-[#12151c] dark:text-[#e6e9ef]">
            {/* Cuadrícula tenue del fondo, igual que la portada, SR y Sprites (solo en oscuro) */}
            <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 opacity-[0.04] hidden dark:block"
                style={{
                    backgroundImage: 'linear-gradient(#2f6bff 1px, transparent 1px), linear-gradient(90deg, #2f6bff 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />
            <header className="sticky top-0 z-40 bg-[#f6f7fa]/90 dark:bg-pub-bg/90 backdrop-blur border-b border-[#dfe3ea] dark:border-pub-border">
                <div className="panel-scale max-w-[1400px] 3xl:max-w-[1700px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0 overflow-hidden">
                        <button
                            onClick={() => setMenuOpen(o => !o)}
                            aria-label={t('layout.menu')}
                            aria-expanded={menuOpen}
                            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                        <Link to="/" className="flex items-center gap-2 text-xl font-black text-[#2563eb] dark:text-white">
                            <BrandMark slot="legal-header" fallback={<><Bot className="w-7 h-7" /><span className="hidden sm:inline">Decatron</span></>} />
                        </Link>
                        <Link to="/docs" className="hidden sm:inline font-mono text-xs font-semibold text-[#5b6475] dark:text-[#8b93a3] hover:text-[#2563eb] dark:hover:text-pub-accent-hi transition-colors">
                            # {t('layout.documentation')}
                        </Link>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                        <div className="hidden sm:block"><DocsLanguageSwitch /></div>
                        <ThemeToggle />
                        <Link
                            to={isLoggedIn ? '/dashboard' : '/login'}
                            className="px-3 sm:px-4 py-2 text-sm font-bold whitespace-nowrap rounded-lg text-white bg-[#2563eb] dark:bg-pub-accent hover:opacity-90 transition-opacity"
                        >
                            {isLoggedIn ? t('layout.goToDashboard') : t('layout.login')}
                        </Link>
                    </div>
                </div>
            </header>

            {menuOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMenuOpen(false)} />}
            <aside className={`fixed lg:hidden top-[57px] bottom-0 left-0 z-30 w-72 overflow-y-auto p-5 bg-[#f6f7fa] dark:bg-pub-bg border-r border-[#dfe3ea] dark:border-pub-border transition-transform ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="sm:hidden mb-5"><DocsLanguageSwitch /></div>
                {sidebar}
            </aside>

            <main className="flex-1 relative">
                <div className="panel-scale max-w-[1400px] 3xl:max-w-[1700px] mx-auto px-4 sm:px-6 py-8 lg:py-12 grid lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_200px] gap-8 xl:gap-10">
                    <aside className="hidden lg:block">
                        <div className="sticky top-24 max-h-[calc((100vh-7rem)/var(--z))] overflow-y-auto pr-2">{sidebar}</div>
                    </aside>
                    <div ref={bodyRef} className="min-w-0">
                        <Outlet />
                    </div>
                    <aside className="hidden xl:block">
                        {toc.length >= 3 && (
                            <nav aria-label="Contenido" className="sticky top-24 max-h-[calc((100vh-7rem)/var(--z))] overflow-y-auto space-y-1 text-sm">
                                <p className="font-mono text-xs font-semibold text-[#5b6475] dark:text-[#8b93a3] mb-2"># {t('layout.onThisPage')}</p>
                                {toc.map(i => (
                                    <a
                                        key={i.id}
                                        href={`#${i.id}`}
                                        className={`block border-l-2 pl-3 py-1.5 leading-snug transition-colors ${
                                            active === i.id
                                                ? 'border-[#2563eb] dark:border-pub-accent text-[#2563eb] dark:text-pub-accent-hi font-semibold'
                                                : 'border-[#dfe3ea] dark:border-pub-border text-[#5b6475] dark:text-[#8b93a3] hover:text-[#12151c] dark:hover:text-white'
                                        }`}
                                    >
                                        {i.text}
                                    </a>
                                ))}
                            </nav>
                        )}
                    </aside>
                </div>
            </main>

            <footer className="relative border-t border-[#dfe3ea] dark:border-pub-border">
                <div className="panel-scale max-w-[1400px] 3xl:max-w-[1700px] mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-[#5b6475] dark:text-[#8b93a3]">
                    <span>&copy; {new Date().getFullYear()} Decatron</span>
                    <a href="mailto:support@decatron.net" className="hover:text-[#2563eb] dark:hover:text-pub-accent-hi transition-colors">support@decatron.net</a>
                </div>
            </footer>
        </div>
    );
}
