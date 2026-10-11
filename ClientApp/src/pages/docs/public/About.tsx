import { Bot, Zap, Clock, Gift, Bell, MessageSquare, Shield, Sparkles, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { asArray } from '../../../components/docs/DocBlocks';

// El texto vive en public/locales/{es,en}/docs-public.json → about.
interface Item { t: string; d: string }
const ICONS: ReactNode[] = [
    <Zap className="w-6 h-6" />, <Clock className="w-6 h-6" />, <Gift className="w-6 h-6" />, <Bell className="w-6 h-6" />,
    <MessageSquare className="w-6 h-6" />, <Shield className="w-6 h-6" />, <Sparkles className="w-6 h-6" />,
];

export default function About() {
    const { t } = useTranslation('docs-public');
    const audience = asArray<Item>(t('about.audience', { returnObjects: true }));
    const features = asArray<Item>(t('about.features', { returnObjects: true }));

    return (
        <div className="space-y-8">
            {/* Hero */}
            <div className="bg-ds-surface border border-ds-border rounded-lg p-10 text-ds-text">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 bg-ds-bg border border-ds-border text-ds-accent-text rounded-lg flex items-center justify-center">
                        <Bot className="w-12 h-12" />
                    </div>
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black mb-2">Decatron</h1>
                        <p className="text-xl text-ds-soft">{t('about.tagline')}</p>
                    </div>
                </div>
                <p className="text-lg text-ds-soft max-w-3xl">{t('about.intro')}</p>
                <div className="flex flex-wrap gap-4 mt-8">
                    <Link to="/docs/getting-started" className="ds-btn ds-btn--primary ds-btn--lg">
                        {t('about.start')}
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link to="/docs/features" className="ds-btn ds-btn--secondary ds-btn--lg">{t('about.seeAll')}</Link>
                </div>
            </div>

            {/* Para quién es */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <h2 className="text-2xl font-black text-ds-text mb-4">{t('about.audienceTitle')}</h2>
                <p className="text-ds-soft mb-6">{t('about.audienceIntro')}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {audience.map(a => (
                        <div key={a.t} className="bg-ds-bg rounded-lg p-4 border border-ds-border">
                            <h4 className="font-bold text-ds-text">{a.t}</h4>
                            <p className="text-sm text-ds-soft">{a.d}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Características */}
            <div>
                <h2 className="text-2xl font-black text-ds-text mb-6">{t('about.featuresTitle')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {features.map((f, i) => (
                        <div key={f.t} className="p-6 bg-ds-surface rounded-lg border border-ds-border">
                            <div className="w-12 h-12 bg-ds-raised text-ds-accent-text rounded-lg flex items-center justify-center mb-4">{ICONS[i]}</div>
                            <h3 className="text-lg font-bold text-ds-text mb-2">{f.t}</h3>
                            <p className="text-sm text-ds-soft">{f.d}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* CTA */}
            <div className="bg-ds-surface border border-ds-border rounded-lg p-8 text-ds-text text-center">
                <h2 className="text-2xl font-black mb-4">{t('about.ctaTitle')}</h2>
                <p className="text-ds-soft mb-6 max-w-xl mx-auto">{t('about.ctaText')}</p>
                <Link to="/login" className="ds-btn ds-btn--primary ds-btn--lg">
                    {t('about.ctaButton')}
                    <ArrowRight className="w-5 h-5" />
                </Link>
            </div>
        </div>
    );
}
