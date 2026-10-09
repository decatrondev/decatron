import { Zap, Clock, Users, Gamepad2, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DocAlert from '../../components/docs/DocAlert';
import {
    COMMAND_ACCESS,
    COMMAND_GROUPS,
    COMMAND_GROUP_ORDER,
    KICK_COMING_SOON,
    KICK_UNAVAILABLE,
    getCommandGroup,
} from '../../config/defaultCommandsCatalog';
// Misma fuente que lee el backend para el panel: un comando nuevo en estos archivos aparece aquí solo.
import metadataEs from '../../../../Resources/bot-metadata/es.json';
import metadataEn from '../../../../Resources/bot-metadata/en.json';

interface CommandMeta {
    description: string;
    aliases: string[];
    usageExamples: string[];
}

const GROUP_ICONS: Record<string, React.ReactNode> = {
    stream: <Zap className="w-6 h-6" />,
    timer: <Clock className="w-6 h-6" />,
    community: <Users className="w-6 h-6" />,
    games: <Gamepad2 className="w-6 h-6" />,
};

export default function DefaultCommandsDoc() {
    const { t, i18n } = useTranslation('docs');
    const metadata = (i18n.language?.startsWith('en') ? metadataEn : metadataEs) as Record<string, CommandMeta>;

    // Un comando listado como alias de otro (por ejemplo !t de !title) no lleva tarjeta propia.
    const aliasNames = new Set<string>();
    Object.values(metadata).forEach(m => m.aliases.forEach(a => aliasNames.add(a)));

    const byGroup: Record<string, string[]> = {};
    Object.keys(metadata).forEach(name => {
        if (aliasNames.has(name)) return;
        const group = getCommandGroup(name);
        (byGroup[group] ||= []).push(name);
    });
    // Dentro de cada grupo, el orden del catálogo; los comandos nuevos quedan al final.
    Object.entries(byGroup).forEach(([group, names]) => {
        const order = COMMAND_GROUPS[group] ?? [];
        names.sort((a, b) => {
            const ia = order.indexOf(a), ib = order.indexOf(b);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });
    });

    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151] shadow-xl">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl flex items-center justify-center border border-[#e2e8f0] dark:border-[#374151]">
                        <Zap className="w-8 h-8 text-[#2563eb]" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white">{t('defaultCommands.title')}</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">{t('defaultCommands.subtitle')}</p>
                    </div>
                </div>
                <p className="text-[#64748b] dark:text-[#94a3b8]">{t('defaultCommands.intro')}</p>
            </div>

            {Object.keys(metadata).length === 0 && (
                <DocAlert type="warning">{t('defaultCommands.empty')}</DocAlert>
            )}

            {COMMAND_GROUP_ORDER.map(group => {
                const names = byGroup[group];
                if (!names?.length) return null;
                return (
                    <section key={group}>
                        <div className="flex items-center gap-3 mb-1 text-[#2563eb]">
                            {GROUP_ICONS[group]}
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">{t(`defaultCommands.groups.${group}.title`)}</h2>
                        </div>
                        <p className="text-[#64748b] dark:text-[#94a3b8] text-sm">{t(`defaultCommands.groups.${group}.description`)}</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                            {names.map(name => (
                                <CommandCard key={name} name={name} meta={metadata[name]} />
                            ))}
                        </div>
                    </section>
                );
            })}

            <DocAlert type="info" title={t('defaultCommands.kick.soon') + ' / ' + t('defaultCommands.kick.unavailable')}>
                {t('defaultCommands.kickNote')}
            </DocAlert>

            <section>
                <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-[#2563eb]" />
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">{t('defaultCommands.tipsTitle')}</h2>
                </div>
                <ul className="list-disc pl-6 space-y-2 text-[#64748b] dark:text-[#94a3b8]">
                    <li>{t('defaultCommands.tips.toggle')}</li>
                    <li>{t('defaultCommands.tips.aliases')}</li>
                    <li>{t('defaultCommands.tips.language')}</li>
                </ul>
            </section>

            <section>
                <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">{t('defaultCommands.othersTitle')}</h2>
                <p className="text-[#64748b] dark:text-[#94a3b8]">{t('defaultCommands.others')}</p>
            </section>
        </div>
    );
}

function CommandCard({ name, meta }: { name: string; meta: CommandMeta }) {
    const { t } = useTranslation('docs');
    const access = COMMAND_ACCESS[name];
    const kick = KICK_COMING_SOON.has(name) ? 'soon' : KICK_UNAVAILABLE.has(name) ? 'unavailable' : null;

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
            <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <code className="text-lg font-bold text-[#2563eb] dark:text-pub-accent-hi bg-[#eef1f6] dark:bg-pub-raised px-3 py-1 rounded-md">!{name}</code>
                    {kick && (
                        <span className="px-2 py-1 border border-[#dfe3ea] dark:border-pub-border text-[#5b6475] dark:text-[#8b93a3] rounded-md text-xs font-semibold">
                            {t(`defaultCommands.kick.${kick}`)}
                        </span>
                    )}
                </div>

                <p className="text-[#64748b] dark:text-[#94a3b8] text-sm">{meta.description}</p>

                {meta.aliases.length > 0 && (
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                        <span className="font-medium">{t('defaultCommands.aliases')}: </span>
                        {meta.aliases.map(a => (
                            <code key={a} className="mr-2 font-mono text-gray-800 dark:text-[#f8fafc]">!{a}</code>
                        ))}
                    </p>
                )}

                {meta.usageExamples.length > 0 && (
                    <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-lg p-3 border border-[#e2e8f0] dark:border-[#374151]">
                        <span className="text-[#64748b] dark:text-[#94a3b8] font-medium text-sm block mb-1">
                            {t('defaultCommands.examples')}
                        </span>
                        {meta.usageExamples.map(u => (
                            <code key={u} className="block text-gray-800 dark:text-[#f8fafc] font-mono text-sm">{u}</code>
                        ))}
                    </div>
                )}

                {access && (
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                        <span className="font-medium">{t('defaultCommands.who')}: </span>
                        {t(`defaultCommands.access.${access}`)}
                    </p>
                )}
            </div>
        </div>
    );
}
