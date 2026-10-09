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
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-bg rounded-lg flex items-center justify-center border border-ds-border">
                        <Zap className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-ds-text">{t('defaultCommands.title')}</h1>
                        <p className="text-ds-soft mt-1">{t('defaultCommands.subtitle')}</p>
                    </div>
                </div>
                <p className="text-ds-soft">{t('defaultCommands.intro')}</p>
            </div>

            {Object.keys(metadata).length === 0 && (
                <DocAlert type="warning">{t('defaultCommands.empty')}</DocAlert>
            )}

            {COMMAND_GROUP_ORDER.map(group => {
                const names = byGroup[group];
                if (!names?.length) return null;
                return (
                    <section key={group}>
                        <div className="flex items-center gap-3 mb-1 text-ds-accent-text">
                            {GROUP_ICONS[group]}
                            <h2 className="text-2xl font-black text-ds-text">{t(`defaultCommands.groups.${group}.title`)}</h2>
                        </div>
                        <p className="text-ds-soft text-sm">{t(`defaultCommands.groups.${group}.description`)}</p>
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
                    <Lightbulb className="w-5 h-5 text-ds-accent-text" />
                    <h2 className="text-xl font-black text-ds-text">{t('defaultCommands.tipsTitle')}</h2>
                </div>
                <ul className="list-disc pl-6 space-y-2 text-ds-soft">
                    <li>{t('defaultCommands.tips.toggle')}</li>
                    <li>{t('defaultCommands.tips.aliases')}</li>
                    <li>{t('defaultCommands.tips.language')}</li>
                </ul>
            </section>

            <section>
                <h2 className="text-xl font-black text-ds-text mb-2">{t('defaultCommands.othersTitle')}</h2>
                <p className="text-ds-soft">{t('defaultCommands.others')}</p>
            </section>
        </div>
    );
}

function CommandCard({ name, meta }: { name: string; meta: CommandMeta }) {
    const { t } = useTranslation('docs');
    const access = COMMAND_ACCESS[name];
    const kick = KICK_COMING_SOON.has(name) ? 'soon' : KICK_UNAVAILABLE.has(name) ? 'unavailable' : null;

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
            <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <code className="text-lg font-bold text-ds-accent-text bg-ds-bg px-3 py-1 rounded-md">!{name}</code>
                    {kick && (
                        <span className="px-2 py-1 border border-ds-border text-ds-soft rounded-md text-xs font-semibold">
                            {t(`defaultCommands.kick.${kick}`)}
                        </span>
                    )}
                </div>

                <p className="text-ds-soft text-sm">{meta.description}</p>

                {meta.aliases.length > 0 && (
                    <p className="text-sm text-ds-soft">
                        <span className="font-medium">{t('defaultCommands.aliases')}: </span>
                        {meta.aliases.map(a => (
                            <code key={a} className="mr-2 font-mono text-ds-text">!{a}</code>
                        ))}
                    </p>
                )}

                {meta.usageExamples.length > 0 && (
                    <div className="bg-ds-bg rounded-lg p-3 border border-ds-border">
                        <span className="text-ds-soft font-medium text-sm block mb-1">
                            {t('defaultCommands.examples')}
                        </span>
                        {meta.usageExamples.map(u => (
                            <code key={u} className="block text-ds-text font-mono text-sm">{u}</code>
                        ))}
                    </div>
                )}

                {access && (
                    <p className="text-sm text-ds-soft">
                        <span className="font-medium">{t('defaultCommands.who')}: </span>
                        {t(`defaultCommands.access.${access}`)}
                    </p>
                )}
            </div>
        </div>
    );
}
