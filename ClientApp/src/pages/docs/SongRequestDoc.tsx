import { Music } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModuleDoc } from './ModuleDoc';
import type { DocScope } from './registry';
import {
    GUIDE_COMMANDS,
    GUIDE_GROUPS,
    roleFor,
    type GuidePermissions,
} from '../features/song-request-extension/commandGuide';

// Páginas de Song Request. El texto vive en public/locales/{es,en}/docs-sr.json (una clave por página).
// La lista de comandos sale de commandGuide.ts + commands.json → srGuide: la misma fuente del panel y de /sr.
export type SrPage = 'overview' | 'setup' | 'requests' | 'playlists' | 'commands' | 'overlay' | 'library';

// Permisos por defecto de SongRequestSettings.Permissions (backend)
const DEFAULT_PERMISSIONS: GuidePermissions = {
    request: 'everyone',
    skip: 'moderator',
    manage: 'lead_moderator',
    review: 'moderator',
    playlist: 'everyone',
};
// Votos para saltar por defecto (SongRequestSettings.SkipVotesRequired)
const DEFAULT_SKIP_VOTES = 3;

export function SongRequestDoc({ page, scope }: { page: SrPage; scope: DocScope }) {
    return (
        <ModuleDoc ns="docs-sr" page={page} scope={scope} icon={Music}>
            {page === 'commands' && <CommandList />}
        </ModuleDoc>
    );
}

function CommandList() {
    const { t } = useTranslation('commands');

    return (
        <div className="space-y-8">
            {GUIDE_GROUPS.map(group => {
                const commands = GUIDE_COMMANDS.filter(c => c.group === group);
                if (!commands.length) return null;
                return (
                    <section key={group}>
                        <h2 className="text-2xl font-black text-ds-text mb-2 pb-2 border-b border-ds-border">
                            {t(`srGuide.groups.${group}`)}
                        </h2>
                        {t(`srGuide.groupNotes.${group}`, { defaultValue: '' }) && (
                            <p className="mb-3 text-ds-soft">{t(`srGuide.groupNotes.${group}`)}</p>
                        )}
                        <div className="rounded-lg border border-ds-border divide-y divide-ds-border overflow-hidden">
                            {commands.map(cmd => {
                                const role = roleFor(cmd, DEFAULT_PERMISSIONS);
                                return (
                                    <div key={cmd.id} className="p-4 grid grid-cols-1 lg:grid-cols-[minmax(0,20rem)_1fr] gap-x-6 gap-y-2">
                                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                                            <code className="font-mono text-sm font-bold text-ds-accent-text break-all">{t(`srGuide.cmd.${cmd.id}.syntax`)}</code>
                                            <span className="shrink-0 px-1.5 py-0.5 rounded border border-ds-border text-xs font-semibold text-ds-soft">
                                                {role ? t(`srGuide.badges.${role}`) : t('srGuide.badges.playlist')}
                                            </span>
                                        </div>
                                        <div className="min-w-0 space-y-2">
                                            <p className="text-sm text-ds-soft">{t(`srGuide.cmd.${cmd.id}.text`, { votes: DEFAULT_SKIP_VOTES })}</p>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {cmd.examples.map(ex => (
                                                    <code key={ex} className="px-1.5 py-0.5 rounded bg-ds-bg font-mono text-xs text-ds-text">{ex}</code>
                                                ))}
                                                {cmd.aliases && (
                                                    <span className="text-xs text-ds-soft">
                                                        {t('srGuide.aliases')} <span className="font-mono">{cmd.aliases.join(' · ')}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
