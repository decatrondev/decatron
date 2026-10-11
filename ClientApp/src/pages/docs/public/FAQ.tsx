import { HelpCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DocAlert from '../../../components/docs/DocAlert';
import { asArray } from '../../../components/docs/DocBlocks';

// El texto vive en public/locales/{es,en}/docs-public.json → faq.
interface FaqItem { q: string; a?: string; intro?: string; steps?: string[]; tip?: string; note?: string; link?: { to: string; label?: string } }
interface FaqSection { title: string; items: FaqItem[] }

export default function FAQ() {
    const { t } = useTranslation('docs-public');
    const sections = asArray<FaqSection>(t('faq.sections', { returnObjects: true }));

    return (
        <div className="space-y-8">
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised rounded-lg flex items-center justify-center">
                        <HelpCircle className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-ds-text">{t('faq.title')}</h1>
                        <p className="text-ds-soft">{t('faq.subtitle')}</p>
                    </div>
                </div>
            </div>

            {sections.map(s => (
                <div key={s.title}>
                    <h2 className="text-2xl font-black text-ds-text mb-4">{s.title}</h2>
                    <div className="space-y-3">
                        {asArray<FaqItem>(s.items).map(item => <Item key={item.q} item={item} guide={t('faq.guide')} tipTitle={t('faq.tipTitle')} />)}
                    </div>
                </div>
            ))}

            <div className="bg-ds-surface border border-ds-border rounded-lg p-8 text-center">
                <h2 className="text-2xl font-black text-ds-text mb-4">{t('faq.ctaTitle')}</h2>
                <p className="text-ds-soft mb-6">{t('faq.ctaText')}</p>
                <Link to="/docs" className="ds-btn ds-btn--primary ds-btn--lg">{t('faq.ctaButton')}</Link>
            </div>
        </div>
    );
}

function Item({ item, guide, tipTitle }: { item: FaqItem; guide: string; tipTitle: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-4 p-5 text-left">
                <span className="font-bold text-ds-text">{item.q}</span>
                {open ? <ChevronUp className="w-5 h-5 text-ds-soft flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-ds-soft flex-shrink-0" />}
            </button>
            {open && (
                <div className="px-5 pb-5 text-ds-soft space-y-3">
                    {item.a && <p>{item.a}</p>}
                    {item.intro && <p>{item.intro}</p>}
                    {item.steps && (
                        <ol className="list-decimal ml-4 space-y-2">
                            {asArray<string>(item.steps).map(x => <li key={x}>{x}</li>)}
                        </ol>
                    )}
                    {item.tip && <DocAlert type="tip" title={tipTitle}>{item.tip}</DocAlert>}
                    {item.note && <DocAlert type="info">{item.note}</DocAlert>}
                    {item.link && (
                        <Link to={item.link.to} className="inline-flex items-center gap-2 text-ds-accent-text font-medium hover:underline">
                            {item.link.label || guide}
                            <ExternalLink className="w-4 h-4" />
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
