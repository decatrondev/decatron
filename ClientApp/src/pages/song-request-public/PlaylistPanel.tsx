import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlatformIcon } from '../features/song-request-extension/components/PlatformIcon';
import { authHeaders, formatDuration } from './shared';
import { usePlaylistData } from './usePlaylistData';

export interface PlaylistRequirements { minRole: string; minAccountAgeDays: number; minFollowAgeDays: number; maxPerUser: number; cooldownMinutes: number }
export interface PublicPlaylist { id: number; code: string; name: string; count: number; open: boolean; review?: boolean; requirements: PlaylistRequirements; isActive?: boolean; numbered?: boolean; votingEnabled?: boolean }
export interface PublicPlaylistItem { id: number; number: number; votes: number; addedBy: string | null; addedByPlatform: string | null; track: { trackId: number; source: string; sourceId: string; url: string | null; title: string; artist: string; durationSeconds: number | null; thumbnailUrl: string | null } }
/** Con qué cuenta agrega el viewer logueado. undefined = sin sesión; null = con sesión pero sin Twitch ni Kick. */
export type Contributor = { platform: string; name: string } | null | undefined;

/** Con qué cuenta entra el viewer (para votar y agregar). */
export function useContributor(channel: string): Contributor {
    const [contributor, setContributor] = useState<Contributor>(undefined);
    // Fetch directo (no el cliente de la app): un 401 acá es "no inició sesión", no hay que mandarlo al login
    useEffect(() => {
        const headers = authHeaders();
        if (!headers.Authorization) { setContributor(undefined); return; }
        fetch(`/api/song-request/public/${encodeURIComponent(channel)}/me`, { headers })
            .then(r => (r.ok ? r.json() : null))
            .then(d => setContributor(d ? d.contributor ?? null : undefined))
            .catch(() => setContributor(undefined));
    }, [channel]);
    return contributor;
}

/**
 * Lo de adentro de una playlist: pedir por número, agregar (si es colaborativa), las canciones y los votos.
 * Lo usan el acordeón de la pestaña Playlists y la vista /sr/{canal}/p/{código}.
 */
export function PlaylistPanel({ channel, playlist, loginRedirect, listMaxHeight = true, onChanged }: {
    channel: string;
    playlist: PublicPlaylist;
    /** A dónde vuelve el viewer después de iniciar sesión para votar. */
    loginRedirect: string;
    listMaxHeight?: boolean;
    onChanged?: () => void;
}) {
    const { t } = useTranslation('commands');
    const contributor = useContributor(channel);
    const { items, myVotes, vote: castVote, reload } = usePlaylistData(channel, playlist.code);
    const vote = async (itemId: number) => {
        if (!await castVote(itemId, !!contributor)) window.location.href = `/login?redirect=${encodeURIComponent(loginRedirect)}`;
    };

    return (
        <>
            {playlist.numbered && (
                <p className="px-4 pb-2 text-xs 3xl:text-sm 4xl:text-base text-ds-soft">
                    {t('songRequestPublic.requestByNumber')} <code className="font-mono text-pub-accent-hi">{t('songRequestPublic.requestByNumberCmd')}</code>
                </p>
            )}
            {playlist.open && (
                <ContributeBox
                    channel={channel}
                    playlist={playlist}
                    contributor={contributor}
                    onAdded={() => { reload(); onChanged?.(); }}
                />
            )}
            {!items ? (
                <p className="px-4 pb-3 font-mono text-sm 3xl:text-base text-ds-soft animate-pulse">{t('songRequestPublic.loading')}</p>
            ) : items.length === 0 ? (
                <p className="px-4 pb-3 text-sm 3xl:text-base text-ds-soft">{t('songRequestPublic.playlistEmpty')}</p>
            ) : (
                <ol className={`divide-y divide-pub-border-soft border-t border-pub-border-soft ${listMaxHeight ? 'max-h-[32rem] 4xl:max-h-[48rem] overflow-y-auto' : ''}`}>
                    {items.map(item => (
                <li key={item.id} className="flex items-center">
                    <a href={item.track.url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 flex items-center gap-3 4xl:gap-5 py-2 4xl:py-3 px-4 hover:bg-pub-surface transition-colors">
                        <span className="font-mono text-xs 3xl:text-sm 4xl:text-base text-ds-soft w-9 4xl:w-12 text-right shrink-0">#{item.number}</span>
                        {item.track.thumbnailUrl
                            ? <img src={item.track.thumbnailUrl} alt="" loading="lazy" className="w-16 h-9 3xl:w-20 3xl:h-[45px] 4xl:w-28 4xl:h-[63px] object-cover rounded shrink-0 bg-pub-raised" />
                            : <div className="w-16 h-9 3xl:w-20 3xl:h-[45px] 4xl:w-28 4xl:h-[63px] rounded shrink-0 bg-pub-raised" />}
                        <div className="min-w-0 flex-1">
                            <p className="text-ds-text text-sm 3xl:text-base 4xl:text-xl truncate">{item.track.title}</p>
                            <p className="text-xs 3xl:text-sm 4xl:text-base text-ds-soft truncate">
                                {item.track.artist}
                                {item.addedBy && (
                                    <>
                                        <span className="text-[#3f3f46]"> · </span>
                                        <PlatformIcon platform={item.addedByPlatform ?? 'twitch'} className="w-3.5 h-3.5 3xl:w-4 3xl:h-4 4xl:w-5 4xl:h-5" />{' '}
                                        {t('songRequestPublic.addedBy', { user: item.addedBy })}
                                    </>
                                )}
                            </p>
                        </div>
                        <span className="font-mono text-xs 3xl:text-sm 4xl:text-base text-ds-soft shrink-0">{formatDuration(item.track.durationSeconds)}</span>
                    </a>
                    {playlist.votingEnabled && (
                        <button
                            onClick={() => vote(item.id)}
                            title={contributor ? t('songRequestPublic.vote') : t('songRequestPublic.loginToVote')}
                            className={`mr-3 shrink-0 flex items-center gap-1 px-2 py-1 rounded font-mono text-xs 3xl:text-sm 4xl:text-base border transition-colors ${myVotes.has(item.id)
                                ? 'border-pub-accent text-pub-accent-hi bg-pub-accent/10'
                                : 'border-pub-border text-ds-soft hover:border-pub-accent/60'}`}
                        >
                            ▲ {item.votes}
                        </button>
                    )}
                </li>
                    ))}
                </ol>
            )}
        </>
    );
}

/** Agregar a una playlist colaborativa: requisitos, con qué cuenta, y el formulario (o cómo iniciar sesión). */
export function ContributeBox({ channel, playlist, contributor, onAdded }: { channel: string; playlist: PublicPlaylist; contributor: Contributor; onAdded: () => void }) {
    const { t } = useTranslation('commands');
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
    const r = playlist.requirements;
    const rules = [
        r.minRole !== 'everyone' && t('songRequestPublic.req.role', { role: t(`songRequestPublic.roles.${r.minRole}`, { defaultValue: r.minRole }) }),
        r.minAccountAgeDays > 0 && t('songRequestPublic.req.accountAge', { days: r.minAccountAgeDays }),
        r.minFollowAgeDays > 0 && t('songRequestPublic.req.followAge', { days: r.minFollowAgeDays }),
        r.maxPerUser > 0 && t('songRequestPublic.req.maxPerUser', { max: r.maxPerUser }),
        r.cooldownMinutes > 0 && t('songRequestPublic.req.cooldown', { minutes: r.cooldownMinutes }),
    ].filter(Boolean) as string[];
    const loginUrl = `/login?redirect=${encodeURIComponent(`/sr/${channel}?tab=playlists`)}`;

    const submit = async () => {
        if (!input.trim()) return;
        setBusy(true); setResult(null);
        try {
            const res = await fetch(`/api/song-request/public/${encodeURIComponent(channel)}/playlists/${playlist.code}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ input: input.trim() }),
            });
            const d = res.ok ? await res.json() : null;
            if (d?.success) {
                setInput('');
                setResult({ ok: true, text: t(d.pending ? 'songRequestPublic.pending' : 'songRequestPublic.added', { title: d.title, playlist: playlist.name }) });
                onAdded();
            } else {
                const key = d?.error ?? (res.status === 401 ? 'pl_need_login' : 'failed');
                setResult({ ok: false, text: String(t(`songRequestPublic.errors.${key}`, { ...(d?.vars ?? {}), playlist: playlist.name, defaultValue: t('songRequestPublic.errors.failed') })) });
            }
        } catch {
            setResult({ ok: false, text: t('songRequestPublic.errors.failed') });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="px-4 pb-4 space-y-3">
            <p className="text-xs 3xl:text-sm 4xl:text-base text-ds-soft">
                {rules.length > 0 ? `${t('songRequestPublic.req.title')} ${rules.join(' · ')}` : t('songRequestPublic.req.anyone')}
                {playlist.review && ` ${t('songRequestPublic.req.review')}`}
            </p>
            {contributor === undefined ? (
                <a href={loginUrl} className="inline-block px-4 py-2 rounded-lg bg-pub-accent text-ds-text font-bold text-sm 3xl:text-base 4xl:text-lg hover:brightness-110">
                    {t('songRequestPublic.loginToAdd')}
                </a>
            ) : contributor === null ? (
                <p className="text-sm 3xl:text-base text-ds-warn">{t('songRequestPublic.errors.pl_need_account')}</p>
            ) : (
                <>
                    <form className="flex flex-col sm:flex-row gap-2" onSubmit={e => { e.preventDefault(); submit(); }}>
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            maxLength={500}
                            placeholder={t('songRequestPublic.addPlaceholder')}
                            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-pub-surface border border-pub-border text-ds-text text-sm 3xl:text-base 4xl:text-lg placeholder:text-ds-soft focus:outline-none focus:border-pub-accent"
                        />
                        <button type="submit" disabled={busy || !input.trim()} className="px-4 py-2 rounded-lg bg-pub-accent text-ds-text font-bold text-sm 3xl:text-base 4xl:text-lg disabled:opacity-50 shrink-0">
                            {busy ? t('songRequestPublic.adding') : t('songRequestPublic.add')}
                        </button>
                    </form>
                    <p className="text-xs 3xl:text-sm text-ds-soft">
                        <PlatformIcon platform={contributor.platform} className="w-3.5 h-3.5 3xl:w-4 3xl:h-4" /> {t('songRequestPublic.addingAs', { user: contributor.name })}
                    </p>
                </>
            )}
            {result && <p className={`text-sm 3xl:text-base ${result.ok ? 'text-ds-ok' : 'text-ds-danger'}`}>{result.text}</p>}
        </div>
    );
}
