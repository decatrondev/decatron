import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../../services/api';
import { PlatformIcon } from './PlatformIcon';
import { GUIDE_COMMANDS, roleFor, type GuideCommand, type GuidePermissions } from '../commandGuide';

// "Cómo pedir" en /sr/{canal} (SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 0): solo lo que usa un viewer,
// según el modo, los permisos y los límites de ese canal. El modo llega en vivo; lo demás se vuelve a pedir
// cuando cambia el modo o la playlist que suena.

export type RequestMode = 'open' | 'playlists' | 'review' | 'closed';

interface Guide {
    permissions: GuidePermissions;
    skipVoteEnabled: boolean;
    skipVotesRequired: number;
    maxPerUser: number;
    maxPerUserPerHour: number;
    maxDurationSeconds: number;
    noRepeatMinutes: number;
    numberedPlaylist: { id: number; name: string } | null;
    hasCollaborative: boolean;
    platforms: string[];
    hidden: string[];
}

/** Los que siempre se ven; el resto va en "Ver comandos". */
const PRIMARY = ['sr', 'srNumber', 'pladd'];

const MODE_TONE: Record<RequestMode, string> = {
    open: 'bg-[#39ff14]',
    playlists: 'bg-cyan-400',
    review: 'bg-amber-300',
    closed: 'bg-red-400',
};

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function PublicRequestGuide({ channel, mode, requestSource, activePlaylistId }: {
    channel: string;
    mode: RequestMode;
    requestSource?: 'any' | 'playlists';
    activePlaylistId?: number | null;
}) {
    const { t } = useTranslation('commands');
    const [guide, setGuide] = useState<Guide | null>(null);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get(`/public/song-request/${channel.toLowerCase()}/guide`)
            .then(res => { if (!cancelled && res.data?.success) setGuide(res.data); })
            .catch(() => { /* sin guía queda el modo, que llega en el snapshot */ });
        return () => { cancelled = true; };
    }, [channel, mode, activePlaylistId]);

    const visible = (cmd: GuideCommand) => {
        if (!guide) return cmd.id === 'sr';
        if (cmd.keys.every(k => guide.hidden.includes(k))) return false;
        if (cmd.id === 'srNumber') return guide.numberedPlaylist != null;
        if (cmd.id === 'skipVote') return guide.skipVoteEnabled;
        if (cmd.id === 'pladd') return guide.hasCollaborative;
        return cmd.group === 'request' || cmd.id === 'pl' || cmd.id === 'playlistLink';
    };
    const commands = GUIDE_COMMANDS.filter(visible);
    const primary = commands.filter(c => PRIMARY.includes(c.id));
    const secondary = commands.filter(c => !PRIMARY.includes(c.id));

    const rules = guide ? [
        guide.permissions.request !== 'everyone' && t('srGuide.public.rules.role', { role: t(`srGuide.rolePhrase.${guide.permissions.request}`) }),
        guide.maxPerUser > 0 && t('srGuide.public.rules.maxPerUser', { count: guide.maxPerUser }),
        guide.maxPerUserPerHour > 0 && t('srGuide.public.rules.perHour', { count: guide.maxPerUserPerHour }),
        guide.maxDurationSeconds > 0 && t('srGuide.public.rules.maxDuration', { duration: formatDuration(guide.maxDurationSeconds) }),
        guide.noRepeatMinutes > 0 && t('srGuide.public.rules.noRepeat', { minutes: guide.noRepeatMinutes }),
    ].filter(Boolean) as string[] : [];

    const platforms = guide?.platforms?.length ? guide.platforms : [];

    const row = (cmd: GuideCommand) => {
        const role = guide ? roleFor(cmd, guide.permissions) : 'everyone';
        return (
            <li key={cmd.id} className="py-2.5 4xl:py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-sm 3xl:text-base 4xl:text-lg text-[#39ff14] break-all">{t(`srGuide.cmd.${cmd.id}.syntax`)}</code>
                    {role && role !== 'everyone' && (
                        <span className="px-1.5 py-0.5 rounded border border-[#39ff14]/25 bg-[#39ff14]/10 font-mono text-[10px] 3xl:text-xs 4xl:text-sm uppercase tracking-wide text-[#39ff14]">
                            {t(`srGuide.badges.${role}`)}
                        </span>
                    )}
                    {cmd.aliases && (
                        <span className="font-mono text-xs 3xl:text-sm 4xl:text-base text-[#52525b]">{t('srGuide.aliases')} {cmd.aliases.join(' · ')}</span>
                    )}
                </div>
                <p className="mt-0.5 text-sm 3xl:text-base 4xl:text-lg text-[#a1a1aa]">
                    {t(`srGuide.cmd.${cmd.id}.text`, { votes: guide?.skipVotesRequired ?? 1 })}
                    {cmd.id === 'srNumber' && guide?.numberedPlaylist && (
                        <> <a href={`#playlist-${guide.numberedPlaylist.id}`} className="text-[#d4d4d8] underline decoration-[#39ff14]/40 hover:decoration-[#39ff14]">{t('srGuide.public.numbered', { playlist: guide.numberedPlaylist.name })}</a></>
                    )}
                </p>
                {cmd.examples.length > 0 && (cmd.id === 'sr' || cmd.id === 'pladd') && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {cmd.examples.map(ex => (
                            <code key={ex} className="px-1.5 py-0.5 rounded bg-[#18181b] font-mono text-xs 3xl:text-sm 4xl:text-base text-[#71717a] break-all">{ex}</code>
                        ))}
                    </div>
                )}
            </li>
        );
    };

    return (
        <section className="mb-10 4xl:mb-14 rounded-xl border border-[#27272a] bg-[#111114] p-4 sm:p-5 4xl:p-7">
            <h2 className="flex items-center gap-2 mb-3 font-mono text-xs 3xl:text-sm 4xl:text-base uppercase tracking-widest text-[#a1a1aa] font-bold">
                <span className="text-[#39ff14]">#</span>{t('srGuide.public.title')}
            </h2>

            {/* Modo actual */}
            <div className="space-y-1.5">
                <p className="flex items-start gap-2.5 text-white font-semibold text-sm 3xl:text-base 4xl:text-xl">
                    <span className={`mt-1.5 4xl:mt-2.5 w-2 h-2 rounded-full shrink-0 ${MODE_TONE[mode]}`} />
                    {t(`srGuide.public.mode.${mode}`)}
                </p>
                {mode === 'review' && requestSource === 'playlists' && (
                    <p className="flex items-start gap-2.5 text-white font-semibold text-sm 3xl:text-base 4xl:text-xl">
                        <span className={`mt-1.5 4xl:mt-2.5 w-2 h-2 rounded-full shrink-0 ${MODE_TONE.playlists}`} />
                        {t('srGuide.public.mode.playlists')}
                    </p>
                )}
            </div>

            {platforms.length > 0 && (
                <p className="mt-2 text-xs 3xl:text-sm 4xl:text-base text-[#71717a]">
                    {t('srGuide.public.chatOn')}{' '}
                    {platforms.map((p, i) => (
                        <span key={p}>
                            {i > 0 && ` ${t('srGuide.public.or')} `}
                            <PlatformIcon platform={p} className="w-3.5 h-3.5 3xl:w-4 3xl:h-4 4xl:w-5 4xl:h-5" />{' '}
                            <span className="text-[#a1a1aa]">{p === 'kick' ? 'Kick' : 'Twitch'}</span>
                        </span>
                    ))}
                </p>
            )}

            {/* Reglas */}
            {rules.length > 0 && (
                <div className="mt-4">
                    <p className="font-mono text-[11px] 3xl:text-xs 4xl:text-sm uppercase tracking-widest text-[#52525b] mb-1.5">{t('srGuide.public.rulesTitle')}</p>
                    <ul className="flex flex-wrap gap-1.5">
                        {rules.map(r => (
                            <li key={r} className="px-2 py-1 rounded border border-[#27272a] bg-[#0a0a0f] text-xs 3xl:text-sm 4xl:text-base text-[#d4d4d8]">{r}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Comandos */}
            <ul className="mt-3 divide-y divide-[#1f1f23]">
                {primary.map(row)}
                {showAll && secondary.map(row)}
            </ul>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs 3xl:text-sm 4xl:text-base">
                {secondary.length > 0 ? (
                    <button onClick={() => setShowAll(v => !v)} className="text-[#39ff14] hover:underline">
                        {showAll ? t('srGuide.public.hide') : `${t('srGuide.public.show')} (${secondary.length})`} {showAll ? '▴' : '▾'}
                    </button>
                ) : <span />}
                <a href={`/commands/${channel.toLowerCase()}`} className="text-[#71717a] hover:text-[#d4d4d8]">
                    {t('srGuide.public.allCommands')} →
                </a>
            </div>
        </section>
    );
}
