import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Coins, Languages, ShieldCheck, Users, AlertTriangle } from 'lucide-react';
import type { LtTab } from './types';

const card = 'bg-ds-surface rounded-lg p-6 border border-ds-border';

/** Guía del módulo: qué cuesta la traducción, cómo te protege Decatron y qué conviene configurar. */
export default function GuideTab({ onNavigate }: { onNavigate: (tab: LtTab) => void }) {
    const { t } = useTranslation('features');
    const link = (tab: LtTab, label: string) => <button type="button" className="underline text-ds-accent-text" onClick={() => onNavigate(tab)}>{label}</button>;
    const items = (key: string, n: number) => Array.from({ length: n }, (_, i) => <li key={i}>{t(`liveTranslation.guide.${key}${i + 1}`)}</li>);

    return (
        <div className="space-y-6">
            <div className={card}>
                <h2 className="text-xl font-black text-ds-text mb-1">{t('liveTranslation.guide.title')}</h2>
                <p className="text-sm text-ds-soft mb-4">{t('liveTranslation.guide.intro')}</p>
                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-ds-text">
                    <li>{t('liveTranslation.guide.step1')} {link('general', t('liveTranslation.tabs.general'))}</li>
                    <li>{t('liveTranslation.guide.step2')} {link('access', t('liveTranslation.tabs.access'))}</li>
                    <li>{t('liveTranslation.guide.step3')}</li>
                </ol>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className={card}>
                    <h3 className="font-black text-ds-text flex items-center gap-2 mb-2"><Coins className="w-5 h-5 text-ds-accent-text" /> {t('liveTranslation.guide.costTitle')}</h3>
                    <p className="text-sm text-ds-soft mb-3">{t('liveTranslation.guide.costIntro')}</p>
                    <ul className="list-disc pl-5 space-y-1.5 text-sm text-ds-text">{items('cost', 3)}</ul>
                </div>

                <div className={card}>
                    <h3 className="font-black text-ds-text flex items-center gap-2 mb-2"><ShieldCheck className="w-5 h-5 text-ds-accent-text" /> {t('liveTranslation.guide.protectTitle')}</h3>
                    <p className="text-sm text-ds-soft mb-3">{t('liveTranslation.guide.protectIntro')}</p>
                    <ul className="list-disc pl-5 space-y-1.5 text-sm text-ds-text">{items('protect', 7)}</ul>
                </div>

                <div className={card}>
                    <h3 className="font-black text-ds-text flex items-center gap-2 mb-2"><Languages className="w-5 h-5 text-ds-accent-text" /> {t('liveTranslation.guide.recoTitle')}</h3>
                    <ul className="list-disc pl-5 space-y-1.5 text-sm text-ds-text">{items('reco', 6)}</ul>
                </div>

                <div className={card}>
                    <h3 className="font-black text-ds-text flex items-center gap-2 mb-2"><AlertTriangle className="w-5 h-5 text-ds-warn" /> {t('liveTranslation.guide.creditsTitle')}</h3>
                    <ul className="list-disc pl-5 space-y-1.5 text-sm text-ds-text">{items('credits', 5)}</ul>
                </div>
            </div>

            <div className={card}>
                <h3 className="font-black text-ds-text mb-2">{t('liveTranslation.guide.exampleTitle')}</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-ds-text">{items('example', 3)}</ul>
            </div>

            <div className={card}>
                <h3 className="font-black text-ds-text flex items-center gap-2 mb-2"><Users className="w-5 h-5 text-ds-accent-text" /> {t('liveTranslation.guide.panicTitle')}</h3>
                <p className="text-sm text-ds-soft">{t('liveTranslation.guide.panicBody')}</p>
                <p className="text-sm mt-3">
                    <Link to="/dashboard/docs/translation/config" className="underline text-ds-accent-text">{t('liveTranslation.guide.docs')}</Link>
                </p>
            </div>
        </div>
    );
}
