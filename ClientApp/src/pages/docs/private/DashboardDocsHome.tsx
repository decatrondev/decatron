import { HelpCircle, ArrowRight, Search, BookOpen, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { docUrl, pagesFor, DOC_PAGES, type DocColor, type DocPage } from '../registry';

const COLOR_MAP: Record<DocColor, string> = {
    blue: 'bg-ds-raised text-ds-accent-text ',
    green: 'bg-ds-raised text-ds-accent-text',
    yellow: 'bg-ds-raised text-ds-accent-text ',
    purple: 'bg-ds-raised text-ds-accent-text ',
    red: 'bg-ds-raised text-ds-accent-text',
    pink: 'bg-ds-raised text-ds-accent-text ',
    orange: 'bg-ds-raised text-ds-accent-text ',
    cyan: 'bg-ds-raised text-ds-accent-text ',
};

// Guías populares: ids del registro
const POPULAR = ['overlays-guide', 'timer', 'event-alerts', 'giveaway'];
// Tarjetas destacadas
const FEATURED = ['overlays-guide', 'settings'];

export default function DashboardDocsHome() {
    const { t } = useTranslation('docs');
    const [searchQuery, setSearchQuery] = useState('');
    const byId = (id: string) => DOC_PAGES.find(p => p.id === id)!;

    const query = searchQuery.toLowerCase();
    const filteredGuides = pagesFor('private', 'features').filter(page =>
        t(`pages.${page.id}.title`).toLowerCase().includes(query) ||
        t(`pages.${page.id}.description`).toLowerCase().includes(query)
    );

    return (
        <div className="space-y-8">
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-ds-raised rounded-lg flex items-center justify-center">
                        <HelpCircle className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">{t('pages.help-center.title')}</h1>
                        <p className="text-ds-soft">{t('pages.help-center.description')}</p>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ds-soft" />
                    <input
                        type="text"
                        placeholder={t('help.search')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-ds-bg border border-ds-border rounded-lg text-ds-text placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-ds-accent focus:border-transparent"
                    />
                </div>
            </div>

            <div>
                <h2 className="text-xl font-black text-ds-text mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-ds-accent-text" />
                    {t('help.popular')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {POPULAR.map(id => {
                        const page = byId(id);
                        const Icon = page.icon;
                        return (
                            <Link
                                key={id}
                                to={docUrl('private', page.path)}
                                className="flex items-center gap-3 p-4 bg-ds-surface rounded-lg border border-ds-border hover:border-ds-accent transition-colors group"
                            >
                                <div className="w-10 h-10 bg-ds-bg rounded-lg flex items-center justify-center text-ds-accent-text group-hover:bg-ds-accent-hover group-hover:text-white transition-colors">
                                    <Icon className="w-5 h-5" />
                                </div>
                                <span className="font-medium text-ds-text group-hover:text-ds-accent-text transition-colors">
                                    {t(`help.quick.${id}`)}
                                </span>
                                <ArrowRight className="w-4 h-4 text-ds-soft ml-auto group-hover:text-ds-accent-text transition-colors" />
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div>
                <h2 className="text-xl font-black text-ds-text mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-ds-accent-text" />
                    {t('help.modules')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGuides.map(page => <GuideCard key={page.id} page={page} />)}
                </div>
                {filteredGuides.length === 0 && (
                    <div className="text-center py-8 text-ds-soft">{t('help.noResults', { query: searchQuery })}</div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {FEATURED.map((id) => {
                    const page = byId(id);
                    const Icon = page.icon;
                    return (
                        <Link
                            key={id}
                            to={docUrl('private', page.path)}
                            className={`block p-6 bg-ds-surface border border-ds-border hover:border-ds-accent rounded-lg text-ds-text transition-colors`}
                        >
                            <Icon className="w-10 h-10 mb-4 text-ds-accent-text" />
                            <h3 className="text-xl font-bold mb-2">{t(`pages.${id}.title`)}</h3>
                            <p className="text-ds-soft mb-4">{t(`pages.${id}.description`)}</p>
                            <div className="flex items-center gap-2 font-bold">
                                {t('help.guide')}
                                <ArrowRight className="w-4 h-4" />
                            </div>
                        </Link>
                    );
                })}
            </div>

            <LinkRow page={byId('permissions')} />

            <div>
                <h2 className="text-xl font-black text-ds-text mb-4">{t('help.commandsTitle')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {pagesFor('private', 'commands').map(page => (
                        <Link
                            key={page.id}
                            to={docUrl('private', page.path)}
                            className="block p-4 bg-ds-surface rounded-lg border border-ds-border hover:border-ds-accent transition-colors group"
                        >
                            <h4 className="font-bold text-ds-text group-hover:text-ds-accent-text transition-colors mb-1">
                                {t(`pages.${page.id}.title`)}
                            </h4>
                            <p className="text-sm text-ds-soft">{t(`pages.${page.id}.description`)}</p>
                        </Link>
                    ))}
                </div>
            </div>

            <LinkRow page={byId('variables')} />
        </div>
    );
}

function GuideCard({ page }: { page: DocPage }) {
    const { t } = useTranslation('docs');
    const Icon = page.icon;
    return (
        <Link
            to={docUrl('private', page.path)}
            className="block p-4 bg-ds-surface rounded-lg border border-ds-border hover:border-ds-accent transition-colors group"
        >
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 ${COLOR_MAP[page.color]} rounded-lg flex items-center justify-center flex-shrink-0`}>
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

function LinkRow({ page }: { page: DocPage }) {
    const { t } = useTranslation('docs');
    const Icon = page.icon;
    return (
        <Link
            to={docUrl('private', page.path)}
            className="block p-6 bg-ds-surface rounded-lg border border-ds-border hover:border-ds-accent transition-colors group"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${COLOR_MAP[page.color]} rounded-lg flex items-center justify-center`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-ds-text group-hover:text-ds-accent-text transition-colors">
                            {t(`pages.${page.id}.title`)}
                        </h3>
                        <p className="text-sm text-ds-soft">{t(`pages.${page.id}.description`)}</p>
                    </div>
                </div>
                <ArrowRight className="w-5 h-5 text-ds-soft group-hover:text-ds-accent-text transition-colors" />
            </div>
        </Link>
    );
}
