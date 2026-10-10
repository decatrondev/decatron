import { useTranslation } from 'react-i18next';
import { CopyButton } from './ui';
import { GUIDE_COMMANDS, GUIDE_GROUPS, roleFor, type GuidePermissions } from '../commandGuide';

/**
 * Guía de comandos del dashboard (SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 0): todos los comandos por grupo,
 * con el permiso que tienen ahora en el canal, ejemplos y alias. Sigue en vivo lo que se cambie en Permisos.
 */
export function CommandGuide({ permissions, skipVoteEnabled, skipVotesRequired, publicUrl }: {
    permissions: GuidePermissions;
    skipVoteEnabled: boolean;
    skipVotesRequired: number;
    publicUrl?: string;
}) {
    const { t, i18n } = useTranslation('commands');
    const { t: tOverlays } = useTranslation('overlays');

    return (
        <div className="space-y-6">
            <p className="text-sm 3xl:text-base text-ds-soft">{t('srGuide.dashboard.description')}</p>

            {GUIDE_GROUPS.map(group => {
                const commands = GUIDE_COMMANDS.filter(c => c.group === group);
                return (
                    <section key={group}>
                        <h4 className="mb-2 text-xs 3xl:text-sm font-black uppercase tracking-wider text-ds-soft">{t(`srGuide.groups.${group}`)}</h4>
                        {i18n.exists(`commands:srGuide.groupNotes.${group}`) && (
                            <p className="mb-2 text-sm 3xl:text-base text-ds-soft">{t(`srGuide.groupNotes.${group}`)}</p>
                        )}
                        <div className="divide-y divide-ds-border border-y border-ds-border">
                            {commands.map(cmd => {
                                const role = roleFor(cmd, permissions);
                                const off = cmd.id === 'skipVote' && !skipVoteEnabled;
                                return (
                                    <div key={cmd.id} className={`py-3 grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_1fr] gap-x-6 gap-y-1.5 ${off ? 'opacity-60' : ''}`}>
                                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                                            <code className="font-mono text-sm 3xl:text-base font-bold text-ds-accent-text break-all">{t(`srGuide.cmd.${cmd.id}.syntax`)}</code>
                                            <RoleBadge label={off ? t('srGuide.badges.off') : role ? t(`srGuide.badges.${role}`) : t('srGuide.badges.playlist')} muted={off} />
                                        </div>
                                        <div className="min-w-0 space-y-1.5">
                                            <p className="text-sm 3xl:text-base text-ds-soft">
                                                {t(`srGuide.cmd.${cmd.id}.text`, { votes: skipVotesRequired })}
                                                {off && <span className="text-ds-soft"> {t('srGuide.dashboard.skipVoteOff')}</span>}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {cmd.examples.map(ex => (
                                                    <code key={ex} className="px-1.5 py-0.5 rounded bg-ds-raised font-mono text-xs 3xl:text-sm text-ds-text break-all">{ex}</code>
                                                ))}
                                                {cmd.aliases && (
                                                    <span className="text-xs 3xl:text-sm text-ds-soft">
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

            {publicUrl && (
                <div className="rounded-lg bg-ds-bg border border-ds-border p-3 space-y-2">
                    <p className="text-sm 3xl:text-base text-ds-soft">{t('srGuide.dashboard.publicNote')}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-sm 3xl:text-base text-ds-accent-text hover:underline break-all">{publicUrl}</a>
                        <CopyButton text={publicUrl} label={tOverlays('songRequest.common.copy')} doneLabel={tOverlays('songRequest.common.copied')} />
                    </div>
                </div>
            )}
        </div>
    );
}

function RoleBadge({ label, muted }: { label: string; muted?: boolean }) {
    return (
        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] 3xl:text-xs font-bold uppercase tracking-wide ${muted
            ? 'bg-ds-raised text-ds-soft'
            : 'bg-ds-accent/10 text-ds-accent-text border border-ds-accent/20'}`}
        >
            {label}
        </span>
    );
}
