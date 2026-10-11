import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DocSections, asArray, type DocSectionData } from '../../components/docs/DocBlocks';
import type { DocScope } from './registry';

// Página de un módulo descrita como datos: public/locales/{es,en}/<ns>.json → una clave por página con
// { title, subtitle, sections[], tail[] }. `children` se dibuja entre las secciones y `tail` (por ejemplo
// una lista generada desde el código).
interface PageData { title?: string; subtitle?: string; cta?: { to: string; label: string }; sections?: DocSectionData[]; tail?: DocSectionData[] }

export function ModuleDoc({ ns, page, scope, icon: Icon, children }: {
    ns: string;
    page: string;
    scope: DocScope;
    icon: ComponentType<{ className?: string }>;
    children?: ReactNode;
}) {
    const { t } = useTranslation(ns);
    const raw = t(page, { returnObjects: true });
    // Mientras carga el namespace, t() devuelve el texto de la clave
    const data: PageData = raw && typeof raw === 'object' ? (raw as PageData) : {};

    return (
        <div className="space-y-8">
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-ds-bg rounded-lg flex items-center justify-center border border-ds-border">
                        <Icon className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">{data.title}</h1>
                        <p className="text-ds-soft">{data.subtitle}</p>
                    </div>
                </div>
                {data.cta && (
                    <Link to={data.cta.to} className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors">
                        {data.cta.label} →
                    </Link>
                )}
            </div>

            <DocSections sections={asArray<DocSectionData>(data.sections)} scope={scope} />
            {children}
            <DocSections sections={asArray<DocSectionData>(data.tail)} scope={scope} />
        </div>
    );
}
