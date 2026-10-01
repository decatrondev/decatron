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
    const { t } = useTranslation('commands');
    const { t: tOverlays } = useTranslation('overlays');

    return (
        <div className="space-y-6">
            <p className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8]">{t('srGuide.dashboard.description')}</p>

            {GUIDE_GROUPS.map(group => {
                const commands = GUIDE_COMMANDS.filter(c => c.group === group);
                return (
                    <section key={group}>
                        <h4 className="mb-2 text-xs 3xl:text-sm font-black uppercase tracking-wider text-[#94a3b8]">{t(`srGuide.groups.${group}`)}</h4>
                        <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151] border-y border-[#e2e8f0] dark:border-[#374151]">
                            {commands.map(cmd => {
                                const role = roleFor(cmd, permissions);
                                const off = cmd.id === 'skipVote' && !skipVoteEnabled;
                                return (
                                    <div key={cmd.id} className={`py-3 grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_1fr] gap-x-6 gap-y-1.5 ${off ? 'opacity-60' : ''}`}>
                                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                                            <code className="font-mono text-sm 3xl:text-base font-bold text-[#2563eb] dark:text-[#60a5fa] break-all">{t(`srGuide.cmd.${cmd.id}.syntax`)}</code>
                                            <RoleBadge label={off ? t('srGuide.badges.off') : role ? t(`srGuide.badges.${role}`) : t('srGuide.badges.playlist')} muted={off} />
                                        </div>
                                        <div className="min-w-0 space-y-1.5">
                                            <p className="text-sm 3xl:text-base text-[#475569] dark:text-[#cbd5e1]">
                                                {t(`srGuide.cmd.${cmd.id}.text`, { votes: skipVotesRequired })}
                                                {off && <span className="text-[#94a3b8]"> {t('srGuide.dashboard.skipVoteOff')}</span>}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {cmd.examples.map(ex => (
                                                    <code key={ex} className="px-1.5 py-0.5 rounded bg-[#f1f5f9] dark:bg-[#262626] font-mono text-xs 3xl:text-sm text-[#334155] dark:text-[#e2e8f0] break-all">{ex}</code>
                                                ))}
                                                {cmd.aliases && (
                                                    <span className="text-xs 3xl:text-sm text-[#94a3b8]">
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
                <div className="rounded-lg bg-[#f8fafc] dark:bg-[#1f1f1f] border border-[#e2e8f0] dark:border-[#374151] p-3 space-y-2">
                    <p className="text-sm 3xl:text-base text-[#475569] dark:text-[#cbd5e1]">{t('srGuide.dashboard.publicNote')}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-sm 3xl:text-base text-[#2563eb] dark:text-[#60a5fa] hover:underline break-all">{publicUrl}</a>
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
            ? 'bg-[#f1f5f9] dark:bg-[#262626] text-[#94a3b8]'
            : 'bg-[#2563eb]/10 text-[#2563eb] dark:text-[#60a5fa] border border-[#2563eb]/20'}`}
        >
            {label}
        </span>
    );
}
