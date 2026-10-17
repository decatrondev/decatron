import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '../../brand/BrandMark';
import { DsRoot, Button } from '../../components/ds';
import decatronMascot from '../../assets/decatron-mascot.png';
import { BOT_SITE } from '../../platform/host';

// Marco de la plataforma (decatron.top): siempre oscuro, con el ambiente del sistema de diseño.
// Todo el color sale de los tokens `ds`, así que /admin/estilo lo controla.

export const wrap = 'max-w-6xl 3xl:max-w-[1500px] mx-auto px-5 sm:px-8';

function LanguageToggle() {
    const { i18n } = useTranslation();
    const current = i18n.language?.startsWith('en') ? 'en' : 'es';
    const change = (lng: 'es' | 'en') => {
        i18n.changeLanguage(lng);
        try { localStorage.setItem('lastLanguage', lng); } catch { /* sin almacenamiento: solo no se recuerda */ }
    };
    return (
        <div className="flex items-center text-sm font-mono" role="group" aria-label="Language">
            {(['es', 'en'] as const).map((l, i) => (
                <span key={l} className="flex items-center">
                    {i > 0 && <span className="text-ds-faint mx-1.5" aria-hidden>/</span>}
                    <button
                        type="button" onClick={() => change(l)} aria-pressed={current === l}
                        className={current === l ? 'text-ds-text font-bold' : 'text-ds-soft hover:text-ds-text transition-colors'}
                    >{l.toUpperCase()}</button>
                </span>
            ))}
        </div>
    );
}

/** brandName: en el subdominio de un tenant la cabecera lleva el nombre del tenant (su marca) y no la de Decatron. */
export default function PlatformShell({ children, showNav = true, brandName }: { children: ReactNode; showNav?: boolean; brandName?: string }) {
    const { t, i18n } = useTranslation('platform');
    const { pathname, hash } = useLocation();

    useEffect(() => {
        document.title = brandName || t('meta.title');
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', t('meta.description'));
        document.documentElement.lang = i18n.language?.startsWith('en') ? 'en' : 'es';
    }, [t, i18n.language, brandName]);

    // Los enlaces con # desplazan solos al entrar desde otra ruta
    useEffect(() => {
        if (!hash) return;
        document.getElementById(hash.slice(1))?.scrollIntoView();
    }, [pathname, hash]);

    const goJoin = () => document.getElementById('lista')?.scrollIntoView({ behavior: 'smooth' });
    const nav = [
        ['que-es', t('nav.what')], ['como', t('nav.how')], ['incluye', t('nav.includes')], ['preguntas', t('nav.faq')],
    ] as const;

    return (
        <DsRoot theme="dark" ambient className="panel-scale min-h-screen bg-ds-bg text-ds-text font-onest overflow-x-hidden">
            <header className="sticky top-0 z-40 border-b border-ds-border-soft bg-ds-bg/85 backdrop-blur">
                <div className={`${wrap} py-3 flex items-center justify-between gap-4`}>
                    <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label={brandName || 'Decatron'}>
                        {brandName
                            ? <span className="text-xl font-extrabold tracking-tight text-ds-text">{brandName}</span>
                            : <BrandMark
                                slot="platform-header"
                                fallback={<><img src={decatronMascot} alt="" className="w-9 h-9" /><span className="text-xl font-extrabold tracking-tight text-ds-text">Decatron</span></>}
                            />}
                    </Link>
                    {showNav && (
                        <nav className="hidden md:flex items-center gap-7 text-sm text-ds-soft" aria-label="Principal">
                            {nav.map(([id, label]) => (
                                <Link key={id} to={`/#${id}`} className="hover:text-ds-text transition-colors">{label}</Link>
                            ))}
                        </nav>
                    )}
                    <div className="flex items-center gap-4">
                        <LanguageToggle />
                        {showNav && <Button size="sm" onClick={goJoin}>{t('nav.join')}</Button>}
                    </div>
                </div>
            </header>

            <main>{children}</main>

            <footer className="border-t border-ds-border-soft mt-10">
                <div className={`${wrap} py-10 space-y-6`}>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm 3xl:text-base">
                        <p className="text-ds-soft font-mono">{brandName ? t('tenantLogin.poweredBy') : t('footer.copyright')}</p>
                        {!brandName && <a href={BOT_SITE} className="text-ds-soft hover:text-ds-text transition-colors">{t('footer.bot')}</a>}
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-4 border-t border-ds-border-soft text-sm text-ds-faint">
                        <a href={`${BOT_SITE}/terminos`} className="hover:text-ds-text transition-colors">{t('footer.terms')}</a>
                        <a href={`${BOT_SITE}/privacidad`} className="hover:text-ds-text transition-colors">{t('footer.privacy')}</a>
                        <a href={`${BOT_SITE}/devoluciones`} className="hover:text-ds-text transition-colors">{t('footer.refunds')}</a>
                        <a href={`${BOT_SITE}/libro-reclamaciones`} className="hover:text-ds-text transition-colors">{t('footer.claims')}</a>
                    </div>
                </div>
            </footer>
        </DsRoot>
    );
}
