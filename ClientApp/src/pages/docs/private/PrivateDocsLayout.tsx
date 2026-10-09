import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, LayoutDashboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DocsLanguageSwitch from '../../../components/docs/DocsLanguageSwitch';
import { DOC_GROUP_ORDER, docUrl, pagesFor, type DocGroup } from '../registry';

// Marco de /dashboard/docs (docs con cuenta): barra con «Atrás», «Centro de ayuda» y «Volver al panel»,
// y un índice lateral con todas las páginas (del registro) para moverse sin pasar por el inicio.
export default function PrivateDocsLayout() {
    const { t } = useTranslation('docs');
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const isHome = pathname.replace(/\/$/, '') === docUrl('private', '');
    const current = pagesFor('private').find(p => docUrl('private', p.path) === pathname.replace(/\/$/, ''));

    // Solo el grupo de la página actual se muestra abierto: el índice cabe sin scroll propio.
    // Los demás grupos se abren con un clic.
    const [openGroups, setOpenGroups] = useState<Partial<Record<DocGroup, boolean>>>({});
    useEffect(() => {
        const group = current?.group ?? 'start';
        setOpenGroups(prev => ({ ...prev, [group]: true }));
    }, [current?.group]);

    const goBack = () => {
        // Sin historial (se abrió la página directo) vuelve al centro de ayuda
        if (window.history.length > 1) navigate(-1);
        else navigate(docUrl('private', ''));
    };

    const index = (
        <nav aria-label={t('layout.documentation')} className="space-y-2">
            {DOC_GROUP_ORDER.private.map(group => {
                const items = pagesFor('private', group);
                if (!items.length) return null;
                const open = !!openGroups[group];
                return (
                    <div key={group}>
                        <button
                            type="button"
                            onClick={() => setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }))}
                            aria-expanded={open}
                            className="w-full flex items-center justify-between px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-white transition-colors"
                        >
                            <span>{t(`groups.${group}`)}</span>
                            <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
                        </button>
                        {open && (
                            <div className="mt-1 space-y-0.5">
                                {items.map(page => {
                                    const to = docUrl('private', page.path);
                                    const active = pathname.replace(/\/$/, '') === to;
                                    return (
                                        <Link
                                            key={page.id}
                                            to={to}
                                            aria-current={active ? 'page' : undefined}
                                            className={`block border-l-2 pl-3 pr-2 py-1.5 text-sm leading-snug transition-colors ${
                                                active
                                                    ? 'border-[#2563eb] text-[#2563eb] dark:text-[#60a5fa] font-semibold'
                                                    : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-white'
                                            }`}
                                        >
                                            {t(`pages.${page.id}.title`)}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </nav>
    );

    return (
        <div className="space-y-6">
            {/* Barra fija: sigue al scroll para tener siempre a mano Atrás, las migas y el idioma.
                Los márgenes y el top negativos igualan el padding del contenedor del panel (p-4 sm:p-6 xl:p-8): la barra cubre hasta el borde. El índice (top 4.25rem) queda justo debajo. */}
            <div className="sticky -top-4 sm:-top-6 xl:-top-8 z-20 -mx-4 sm:-mx-6 xl:-mx-8 -mt-4 sm:-mt-6 xl:-mt-8 px-4 sm:px-6 xl:px-8 pt-4 sm:pt-6 xl:pt-8 pb-3 bg-white dark:bg-[#1B1C1D] border-b border-[#e2e8f0] dark:border-[#374151] flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-sm font-semibold text-[#475569] dark:text-[#cbd5e1] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />{t('layout.back')}
                </button>
                <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-sm text-[#64748b] dark:text-[#94a3b8] min-w-0">
                    <Link to="/dashboard" className="inline-flex items-center gap-1.5 hover:text-[#2563eb] transition-colors">
                        <LayoutDashboard className="w-4 h-4" />{t('layout.backToDashboard')}
                    </Link>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    {isHome ? (
                        <span className="font-semibold text-gray-900 dark:text-white">{t('pages.help-center.title')}</span>
                    ) : (
                        <>
                            <Link to={docUrl('private', '')} className="hover:text-[#2563eb] transition-colors">{t('pages.help-center.title')}</Link>
                            {current && (
                                <>
                                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                                    <span className="font-semibold text-gray-900 dark:text-white truncate">{t(`pages.${current.id}.title`)}</span>
                                </>
                            )}
                        </>
                    )}
                </nav>
                <div className="ml-auto"><DocsLanguageSwitch /></div>
            </div>

            <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-8">
                <aside className="hidden lg:block">
                    <div className="sticky top-[4.25rem] max-h-[calc(100vh-11rem)] overflow-y-auto pr-2">{index}</div>
                </aside>
                <div className="min-w-0">
                    <details className="lg:hidden mb-6 rounded-lg border border-[#e2e8f0] dark:border-[#374151] p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-white">{t('layout.index')}</summary>
                        <div className="mt-3">{index}</div>
                    </details>
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
