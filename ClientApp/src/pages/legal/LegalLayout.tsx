import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bot, ArrowLeft } from 'lucide-react';
import { BrandMark } from '../../brand/BrandMark';
import ThemeToggle from '../../components/ThemeToggle';

// Marco de las páginas legales: base común de las vistas públicas (tokens pub-*), con modo claro y
// oscuro para lectura larga. El índice lateral se arma solo con los h2 de cada documento, así el
// texto legal no se toca para cambiar el diseño.

const DOCS = [
    { to: '/terminos', label: 'Términos y condiciones' },
    { to: '/privacidad', label: 'Privacidad' },
    { to: '/devoluciones', label: 'Devoluciones' },
    { to: '/libro-reclamaciones', label: 'Libro de reclamaciones' },
];

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function LegalLayout() {
    const { pathname } = useLocation();
    const bodyRef = useRef<HTMLDivElement>(null);
    const [toc, setToc] = useState<{ id: string; text: string }[]>([]);
    const [active, setActive] = useState('');

    // Índice a partir de los h2 del documento visible
    useEffect(() => {
        const heads = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>('article h2') ?? []);
        const items = heads.map(h => {
            if (!h.id) h.id = slug(h.textContent ?? '');
            h.classList.add('scroll-mt-28');
            return { id: h.id, text: h.textContent ?? '' };
        });
        setToc(items);
        setActive(items[0]?.id ?? '');
        if (!items.length) return;
        const io = new IntersectionObserver(entries => {
            const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
            if (visible) setActive(visible.target.id);
        }, { rootMargin: '-96px 0px -65% 0px' });
        heads.forEach(h => io.observe(h));
        return () => io.disconnect();
    }, [pathname]);

    return (
        <div className="min-h-screen flex flex-col bg-[#f6f7fa] dark:bg-pub-bg text-[#12151c] dark:text-[#e6e9ef]">
            <header className="sticky top-0 z-50 bg-[#f6f7fa]/90 dark:bg-pub-bg/90 backdrop-blur border-b border-[#dfe3ea] dark:border-pub-border">
                <div className="panel-scale max-w-6xl 3xl:max-w-[1500px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
                    <Link to="/" className="flex items-center gap-2 text-xl font-black text-[#2f5fc6] dark:text-white">
                        <BrandMark slot="legal-header" fallback={<><Bot className="w-7 h-7" /><span>Decatron</span></>} />
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link to="/" className="hidden sm:flex items-center gap-2 text-sm font-medium text-[#5b6475] dark:text-[#8b93a3] hover:text-[#2f5fc6] dark:hover:text-pub-accent-hi transition-colors">
                            <ArrowLeft className="w-4 h-4" />Volver al inicio
                        </Link>
                        <ThemeToggle />
                    </div>
                </div>
                <nav className="panel-scale max-w-6xl 3xl:max-w-[1500px] mx-auto px-4 sm:px-6 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {DOCS.map(d => (
                        <NavLink
                            key={d.to}
                            to={d.to}
                            className={({ isActive }) => `shrink-0 px-3 sm:px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                                isActive
                                    ? 'border-[#2f5fc6] dark:border-pub-accent text-[#2f5fc6] dark:text-pub-accent-hi'
                                    : 'border-transparent text-[#5b6475] dark:text-[#8b93a3] hover:text-[#12151c] dark:hover:text-white'
                            }`}
                        >
                            {d.label}
                        </NavLink>
                    ))}
                </nav>
            </header>

            <main className="flex-1">
                <div className="panel-scale max-w-6xl 3xl:max-w-[1500px] mx-auto px-4 sm:px-6 py-10 lg:py-14 grid lg:grid-cols-[220px_minmax(0,1fr)] gap-12">
                    <aside className="hidden lg:block">
                        {toc.length >= 4 && (
                            <nav aria-label="Contenido" className="sticky top-32 space-y-1 text-sm">
                                {toc.map(i => (
                                    <a
                                        key={i.id}
                                        href={`#${i.id}`}
                                        className={`block border-l-2 pl-3 py-1.5 leading-snug transition-colors ${
                                            active === i.id
                                                ? 'border-[#2f5fc6] dark:border-pub-accent text-[#2f5fc6] dark:text-pub-accent-hi font-semibold'
                                                : 'border-[#dfe3ea] dark:border-pub-border text-[#5b6475] dark:text-[#8b93a3] hover:text-[#12151c] dark:hover:text-white'
                                        }`}
                                    >
                                        {i.text}
                                    </a>
                                ))}
                            </nav>
                        )}
                    </aside>
                    <div ref={bodyRef} className="min-w-0">
                        <Outlet />
                    </div>
                </div>
            </main>

            <footer className="border-t border-[#dfe3ea] dark:border-pub-border">
                <div className="panel-scale max-w-6xl 3xl:max-w-[1500px] mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-[#5b6475] dark:text-[#8b93a3]">
                    <span>&copy; {new Date().getFullYear()} Decatron. Todos los derechos reservados.</span>
                    <a href="mailto:support@decatron.net" className="hover:text-[#2f5fc6] dark:hover:text-pub-accent-hi transition-colors">support@decatron.net</a>
                </div>
            </footer>
        </div>
    );
}
