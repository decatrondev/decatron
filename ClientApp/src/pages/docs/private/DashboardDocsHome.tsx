import { HelpCircle, ArrowRight, Search, BookOpen, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { docUrl, pagesFor, DOC_PAGES, type DocColor, type DocPage } from '../registry';

const COLOR_MAP: Record<DocColor, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    pink: 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400',
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
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                        <HelpCircle className="w-8 h-8 text-[#2563eb]" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">{t('pages.help-center.title')}</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">{t('pages.help-center.description')}</p>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748b]" />
                    <input
                        type="text"
                        placeholder={t('help.search')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-[#f8fafc] dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-gray-900 dark:text-white placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                    />
                </div>
            </div>

            <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#2563eb]" />
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
                                className="flex items-center gap-3 p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-colors group"
                            >
                                <div className="w-10 h-10 bg-[#f8fafc] dark:bg-[#374151] rounded-lg flex items-center justify-center text-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white transition-colors">
                                    <Icon className="w-5 h-5" />
                                </div>
                                <span className="font-medium text-gray-900 dark:text-white group-hover:text-[#2563eb] transition-colors">
                                    {t(`help.quick.${id}`)}
                                </span>
                                <ArrowRight className="w-4 h-4 text-[#64748b] ml-auto group-hover:text-[#2563eb] transition-colors" />
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#2563eb]" />
                    {t('help.modules')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGuides.map(page => <GuideCard key={page.id} page={page} />)}
                </div>
                {filteredGuides.length === 0 && (
                    <div className="text-center py-8 text-[#64748b]">{t('help.noResults', { query: searchQuery })}</div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {FEATURED.map((id, i) => {
                    const page = byId(id);
                    const Icon = page.icon;
                    const gradient = i === 0 ? 'from-purple-500 to-purple-700' : 'from-gray-700 to-gray-900';
                    return (
                        <Link
                            key={id}
                            to={docUrl('private', page.path)}
                            className={`block p-6 bg-gradient-to-br ${gradient} rounded-2xl text-white hover:shadow-lg transition-shadow`}
                        >
                            <Icon className="w-10 h-10 mb-4" />
                            <h3 className="text-xl font-bold mb-2">{t(`pages.${id}.title`)}</h3>
                            <p className="text-white/80 mb-4">{t(`pages.${id}.description`)}</p>
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
                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">{t('help.commandsTitle')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {pagesFor('private', 'commands').map(page => (
                        <Link
                            key={page.id}
                            to={docUrl('private', page.path)}
                            className="block p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-colors group"
                        >
                            <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-[#2563eb] transition-colors mb-1">
                                {t(`pages.${page.id}.title`)}
                            </h4>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t(`pages.${page.id}.description`)}</p>
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
            className="block p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-colors group"
        >
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 ${COLOR_MAP[page.color]} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-[#2563eb] transition-colors">
                        {t(`pages.${page.id}.title`)}
                    </h3>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t(`pages.${page.id}.description`)}</p>
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
            className="block p-6 bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-colors group"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${COLOR_MAP[page.color]} rounded-xl flex items-center justify-center`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-[#2563eb] transition-colors">
                            {t(`pages.${page.id}.title`)}
                        </h3>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t(`pages.${page.id}.description`)}</p>
                    </div>
                </div>
                <ArrowRight className="w-5 h-5 text-[#64748b] group-hover:text-[#2563eb] transition-colors" />
            </div>
        </Link>
    );
}
