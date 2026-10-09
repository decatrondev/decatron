import { Book, ArrowRight, Grid } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { docUrl, pagesFor, type DocPage } from './registry';

const QUICK_STEPS = ['connect', 'configure', 'test', 'overlays'] as const;

export default function DocsHome() {
    const { t } = useTranslation('docs');
    // El inicio no se lista a sí mismo
    const start = pagesFor('public', 'start').filter(p => p.path !== '' && p.id !== 'features');

    return (
        <div className="space-y-8">
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-ds-raised rounded-lg flex items-center justify-center">
                        <Book className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">{t('home.title')}</h1>
                        <p className="text-ds-soft">{t('home.subtitle')}</p>
                    </div>
                </div>
            </div>

            <Section title={t('home.start')} pages={start} cols="md:grid-cols-3" />
            <Section title={t('home.commands')} pages={pagesFor('public', 'commands')} cols="md:grid-cols-2" />

            <div>
                <h2 className="text-2xl font-black text-ds-text mb-4">{t('home.features')}</h2>
                <p className="text-ds-soft mb-4">{t('home.featuresText')}</p>
                <Link
                    to={docUrl('public', 'features')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    <Grid className="w-4 h-4" />
                    {t('home.viewAll')}
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            <Section title={t('home.reference')} pages={pagesFor('public', 'reference')} cols="md:grid-cols-2 lg:grid-cols-4" />

            <div className="bg-ds-bg rounded-lg p-6 border border-ds-border">
                <h2 className="text-xl font-black text-ds-text mb-4">{t('home.quick')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {QUICK_STEPS.map((key, i) => (
                        <div key={key} className="flex flex-col items-center text-center p-4 bg-ds-surface rounded-lg border border-ds-border">
                            <div className="w-8 h-8 bg-ds-accent text-white rounded-full flex items-center justify-center font-bold text-sm mb-2">{i + 1}</div>
                            <h4 className="font-bold text-ds-text text-sm mb-1">{t(`home.steps.${key}.0`)}</h4>
                            <p className="text-xs text-ds-soft">{t(`home.steps.${key}.1`)}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function Section({ title, pages, cols }: { title: string; pages: DocPage[]; cols: string }) {
    if (pages.length === 0) return null;
    return (
        <div>
            <h2 className="text-2xl font-black text-ds-text mb-4">{title}</h2>
            <div className={`grid grid-cols-1 ${cols} gap-4`}>
                {pages.map(page => <DocCard key={page.id} page={page} />)}
            </div>
        </div>
    );
}

function DocCard({ page }: { page: DocPage }) {
    const { t } = useTranslation('docs');
    const Icon = page.icon;
    return (
        <Link
            to={docUrl('public', page.path)}
            className="group block p-4 bg-ds-surface rounded-lg border border-ds-border hover:border-ds-accent transition-all"
        >
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-ds-bg text-ds-accent-text rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-ds-text group-hover:text-ds-accent-text transition-colors">
                        {t(`pages.${page.id}.title`)}
                    </h3>
                    <p className="text-sm text-ds-soft">{t(`pages.${page.id}.description`)}</p>
                </div>
            </div>
        </Link>
    );
}
