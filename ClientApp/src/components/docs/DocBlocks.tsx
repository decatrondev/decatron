import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DocAlert from './DocAlert';
import DocSection from './DocSection';
import CodeBlock from './CodeBlock';
import { DOC_PAGES, docUrl, type DocScope } from '../../pages/docs/registry';

// Páginas de documentación descritas como datos (public/locales/{es,en}/<ns>.json), para escribir cada
// módulo una sola vez en español e inglés sin repetir TSX. Un bloque es uno de:
//   { t: 'p', x }  { t: 'h3', x }  { t: 'ul', items }  { t: 'ol', items }
//   { t: 'note', kind: 'info'|'tip'|'warning'|'success', title?, x }
//   { t: 'code', x }  { t: 'table', head?: [..], rows: [[..]] }
//   { t: 'link', to: '<id de página del registro>' }
//   { t: 'limits', rows: ['songPlaylists', …] }  → tabla en vivo desde GET /api/supporters/tier-limits (no se copian números)
export type DocBlock =
    | { t: 'p'; x: string }
    | { t: 'h3'; x: string }
    | { t: 'ul'; items: string[] }
    | { t: 'ol'; items: string[] }
    | { t: 'note'; kind?: 'info' | 'tip' | 'warning' | 'success'; title?: string; x: string }
    | { t: 'code'; x: string }
    | { t: 'table'; head?: string[]; rows: string[][] }
    | { t: 'link'; to: string }
    | { t: 'limits'; rows: string[] };

export interface DocSectionData { id?: string; title: string; blocks: DocBlock[] }

/** Un valor de i18n con returnObjects puede llegar como texto mientras carga el namespace. */
export function asArray<T>(v: unknown): T[] {
    return Array.isArray(v) ? (v as T[]) : [];
}

/** Texto con `código` entre comillas invertidas dibujado como <code>; el resto queda tal cual. */
function Inline({ text }: { text: string }) {
    const parts = String(text).split(/`([^`]+)`/g);
    return (
        <>
            {parts.map((part, i) => i % 2 === 1
                ? <code key={i} className="px-1.5 py-0.5 rounded bg-ds-raised text-ds-text text-[0.9em] font-mono">{part}</code>
                : <span key={i}>{part}</span>)}
        </>
    );
}

export function DocBlocks({ blocks, scope }: { blocks: DocBlock[]; scope: DocScope }) {
    return <>{blocks.map((b, i) => <Block key={i} b={b} scope={scope} />)}</>;
}

function Block({ b, scope }: { b: DocBlock; scope: DocScope }) {
    const { t } = useTranslation('docs');
    switch (b.t) {
        case 'p':
            return <p><Inline text={b.x} /></p>;
        case 'h3':
            return <h3 className="text-lg font-bold text-ds-text pt-2">{b.x}</h3>;
        case 'ul':
            return <ul className="list-disc pl-6 space-y-2">{asArray<string>(b.items).map(x => <li key={x}><Inline text={x} /></li>)}</ul>;
        case 'ol':
            return <ol className="list-decimal pl-6 space-y-2">{asArray<string>(b.items).map(x => <li key={x}><Inline text={x} /></li>)}</ol>;
        case 'note':
            return <DocAlert type={b.kind ?? 'info'} title={b.title}><Inline text={b.x} /></DocAlert>;
        case 'code':
            return <CodeBlock code={b.x} />;
        case 'table':
            return (
                <div className="rounded-lg border border-ds-border overflow-x-auto">
                    <table className="w-full text-sm">
                        {b.head && (
                            <thead>
                                <tr className="border-b border-ds-border text-left text-ds-text">
                                    {b.head.map(h => <th key={h} className="px-4 py-2 font-bold"><Inline text={h} /></th>)}
                                </tr>
                            </thead>
                        )}
                        <tbody className="divide-y divide-ds-border">
                            {asArray<string[]>(b.rows).map((row, ri) => (
                                <tr key={ri} className="align-top">
                                    {row.map((cell, ci) => (
                                        <td key={ci} className={`px-4 py-2 ${ci === 0 ? 'font-medium text-ds-text' : ''}`}><Inline text={cell} /></td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        case 'link': {
            const page = DOC_PAGES.find(p => p.id === b.to);
            if (!page) return null;
            const target: DocScope = page.scopes.includes(scope) ? scope : page.scopes[0];
            return (
                <p>
                    <Link to={docUrl(target, page.path)} className="font-bold text-ds-accent-text hover:underline">
                        {t(`pages.${page.id}.title`)} →
                    </Link>
                </p>
            );
        }
        case 'limits':
            return <TierLimitsTable rows={asArray<string>(b.rows)} />;
        default:
            return null;
    }
}

export function DocSections({ sections, scope }: { sections: DocSectionData[]; scope: DocScope }) {
    return (
        <>
            {asArray<DocSectionData>(sections).map((s, i) => (
                <DocSection key={s.id ?? i} title={s.title} id={s.id}>
                    <DocBlocks blocks={asArray<DocBlock>(s.blocks)} scope={scope} />
                </DocSection>
            ))}
        </>
    );
}

// Límites por plan leídos en vivo del endpoint público: -1 = sin tope. Una sola petición por carga de página.
interface TierLimits { tiers: string[]; rows: Record<string, Record<string, number>> }
let limitsPromise: Promise<TierLimits> | null = null;
function loadLimits(): Promise<TierLimits> {
    if (!limitsPromise) {
        limitsPromise = fetch('/api/supporters/tier-limits')
            .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<TierLimits>; })
            .catch(e => { limitsPromise = null; throw e; });
    }
    return limitsPromise;
}

const BOOLEAN_ROWS = new Set(['songHidePromo']);

function TierLimitsTable({ rows }: { rows: string[] }) {
    const { t, i18n } = useTranslation('docs');
    const [data, setData] = useState<TierLimits | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        loadLimits().then(d => { if (alive) setData(d); }).catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, []);

    if (failed) return <DocAlert type="warning">{t('limits.error')}</DocAlert>;
    if (!data) return <p className="text-sm">{t('limits.loading')}</p>;

    const fmt = (key: string, v: number | undefined) => {
        if (v === undefined) return '—';
        if (BOOLEAN_ROWS.has(key)) return v ? t('limits.yes') : t('limits.no');
        return v < 0 ? t('limits.unlimited') : v.toLocaleString(i18n.language);
    };

    return (
        <div className="rounded-lg border border-ds-border overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-ds-border text-left text-ds-text">
                        <th className="px-4 py-2 font-bold">{t('limits.title')}</th>
                        {data.tiers.map(tier => <th key={tier} className="px-4 py-2 font-bold">{t(`limits.tiers.${tier}`)}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-ds-border">
                    {rows.filter(r => data.rows[r]).map(r => (
                        <tr key={r}>
                            <td className="px-4 py-2 font-medium text-ds-text">{t(`limits.rows.${r}`)}</td>
                            {data.tiers.map(tier => <td key={tier} className="px-4 py-2">{fmt(r, data.rows[r][tier])}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
