import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlatformIcon } from '../features/song-request-extension/components/PlatformIcon';
import { authHeaders, formatDuration } from './shared';

interface PlaylistRequirements { minRole: string; minAccountAgeDays: number; minFollowAgeDays: number; maxPerUser: number; cooldownMinutes: number }
interface PublicPlaylist { id: number; name: string; count: number; open: boolean; review?: boolean; requirements: PlaylistRequirements; isActive?: boolean; numbered?: boolean; votingEnabled?: boolean }
interface PublicPlaylistItem { id: number; number: number; votes: number; addedBy: string | null; addedByPlatform: string | null; track: { url: string | null; title: string; artist: string; durationSeconds: number | null; thumbnailUrl: string | null } }
/** Con qué cuenta agrega el viewer logueado. undefined = sin sesión; null = con sesión pero sin Twitch ni Kick. */
type Contributor = { platform: string; name: string } | null | undefined;

/** Las playlists que el streamer marcó como públicas; en las colaborativas se puede agregar (SONG_REQUEST_PLAYLISTS_PLAN.md). */
export default function PlaylistsTab({ channel, activePlaylistId }: { channel: string; activePlaylistId?: number | null }) {
    const { t } = useTranslation('commands');
    const [playlists, setPlaylists] = useState<PublicPlaylist[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [openId, setOpenId] = useState<number | null>(null);
    const [items, setItems] = useState<Record<number, PublicPlaylistItem[]>>({});
    const [contributor, setContributor] = useState<Contributor>(undefined);
    const [myVotes, setMyVotes] = useState<Record<number, Set<number>>>({});
    const base = `/api/public/song-request/${encodeURIComponent(channel)}`;

    const loadPlaylists = useCallback(() => {
        fetch(`${base}/playlists`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => setPlaylists(d?.playlists ?? []))
            .finally(() => setLoaded(true))
            .catch(() => { /* sin playlists públicas */ });
    }, [base]);
    // Cuando cambia la que suena se recarga: cambian "Sonando" y a cuál cuenta !sr #n
    useEffect(loadPlaylists, [loadPlaylists, activePlaylistId]);

    // Fetch directo (no el cliente de la app): un 401 acá es "no inició sesión", no hay que mandarlo al login
    useEffect(() => {
        const headers = authHeaders();
        if (!headers.Authorization) { setContributor(undefined); return; }
        fetch(`/api/song-request/public/${encodeURIComponent(channel)}/me`, { headers })
            .then(r => (r.ok ? r.json() : null))
            .then(d => setContributor(d ? d.contributor ?? null : undefined))
            .catch(() => setContributor(undefined));
    }, [channel]);

    const loadItems = async (id: number) => {
        try {
            const r = await fetch(`${base}/playlists/${id}`);
            const d = r.ok ? await r.json() : null;
            setItems(prev => ({ ...prev, [id]: d?.items ?? [] }));
        } catch { setItems(prev => ({ ...prev, [id]: [] })); }
        const headers = authHeaders();
        if (headers.Authorization && playlists.find(p => p.id === id)?.votingEnabled) {
            fetch(`/api/song-request/public/${encodeURIComponent(channel)}/playlists/${id}/my-votes`, { headers })
                .then(r => (r.ok ? r.json() : null))
                .then(d => setMyVotes(prev => ({ ...prev, [id]: new Set<number>(d?.items ?? []) })))
                .catch(() => { /* sin votos */ });
        }
    };

    const vote = async (playlistId: number, itemId: number) => {
        if (!contributor) { window.location.href = `/login?redirect=${encodeURIComponent(`/sr/${channel}?tab=playlists`)}`; return; }
        try {
            const r = await fetch(`/api/song-request/public/${encodeURIComponent(channel)}/playlists/${playlistId}/items/${itemId}/vote`, { method: 'POST', headers: authHeaders() });
            const d = r.ok ? await r.json() : null;
            if (!d?.success) return;
            setMyVotes(prev => {
                const set = new Set(prev[playlistId] ?? []);
                if (d.voted) set.add(itemId); else set.delete(itemId);
                return { ...prev, [playlistId]: set };
            });
            setItems(prev => ({ ...prev, [playlistId]: (prev[playlistId] ?? []).map(i => (i.id === itemId ? { ...i, votes: d.votes } : i)) }));
        } catch { /* se reintenta con otro clic */ }
    };

    const toggle = (id: number) => {
        setOpenId(prev => (prev === id ? null : id));
        if (!items[id]) loadItems(id);
    };

    // "Los números son los de «X»" en la guía lleva a #playlist-{id}: se abre sola
    useEffect(() => {
        const openFromHash = () => {
            const match = /^#playlist-(\d+)$/.exec(window.location.hash);
            const id = match ? Number(match[1]) : null;
            if (id == null || !playlists.some(p => p.id === id)) return;
            setOpenId(id);
            if (!items[id]) loadItems(id);
        };
        openFromHash();
        window.addEventListener('hashchange', openFromHash);
        return () => window.removeEventListener('hashchange', openFromHash);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playlists]);

    if (!loaded) return <p className="font-mono text-sm 3xl:text-base text-[#71717a] animate-pulse">{t('songRequestPublic.loading')}</p>;
    if (playlists.length === 0) return <p className="text-sm 3xl:text-base 4xl:text-lg text-[#71717a]">{t('songRequestPublic.noPlaylists')}</p>;
    return (
        <div>
            <div className="space-y-2">
                {playlists.map(p => (
                    <div key={p.id} id={`playlist-${p.id}`} className="border border-[#1f1f23] rounded-lg scroll-mt-6">
                        <button onClick={() => toggle(p.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 4xl:py-4 text-left hover:bg-[#111114] rounded-lg transition-colors">
                            <span className="flex items-center gap-2 min-w-0">
                                <span className="text-white font-semibold text-sm 3xl:text-base 4xl:text-xl truncate">{p.name}</span>
                                {p.isActive && <span className="shrink-0 px-1.5 py-0.5 rounded border border-amber-400/50 font-mono text-[10px] 3xl:text-xs 4xl:text-sm uppercase tracking-wider text-amber-300">▶ {t('songRequestPublic.playing')}</span>}
                                {p.open && <span className="shrink-0 px-1.5 py-0.5 rounded border border-[#39ff14]/40 font-mono text-[10px] 3xl:text-xs 4xl:text-sm uppercase tracking-wider text-[#39ff14]">{t('songRequestPublic.collaborative')}</span>}
                            </span>
                            <span className="font-mono text-xs 3xl:text-sm 4xl:text-base text-[#71717a] shrink-0">
                                {t('songRequestPublic.songs', { count: p.count })} {openId === p.id ? '▴' : '▾'}
                            </span>
                        </button>
                        {openId === p.id && (
                            <>
                                {p.numbered && (
                                    <p className="px-4 pb-2 text-xs 3xl:text-sm 4xl:text-base text-[#a1a1aa]">
                                        {t('songRequestPublic.requestByNumber')} <code className="font-mono text-[#39ff14]">{t('songRequestPublic.requestByNumberCmd')}</code>
                                    </p>
                                )}
                                {p.open && (
                                    <ContributeBox
                                        channel={channel}
                                        playlist={p}
                                        contributor={contributor}
                                        onAdded={() => { loadItems(p.id); loadPlaylists(); }}
                                    />
                                )}
                                {!items[p.id] ? (
                                    <p className="px-4 pb-3 font-mono text-sm 3xl:text-base text-[#71717a] animate-pulse">{t('songRequestPublic.loading')}</p>
                                ) : items[p.id].length === 0 ? (
                                    <p className="px-4 pb-3 text-sm 3xl:text-base text-[#71717a]">{t('songRequestPublic.playlistEmpty')}</p>
                                ) : (
                                    <ol className="divide-y divide-[#1f1f23] border-t border-[#1f1f23] max-h-[32rem] 4xl:max-h-[48rem] overflow-y-auto">
                                        {items[p.id].map(item => (
                                            <li key={item.id} className="flex items-center">
                                                <a href={item.track.url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 flex items-center gap-3 4xl:gap-5 py-2 4xl:py-3 px-4 hover:bg-[#111114] transition-colors">
                                                    <span className="font-mono text-xs 3xl:text-sm 4xl:text-base text-[#52525b] w-9 4xl:w-12 text-right shrink-0">#{item.number}</span>
                                                    {item.track.thumbnailUrl
                                                        ? <img src={item.track.thumbnailUrl} alt="" loading="lazy" className="w-16 h-9 3xl:w-20 3xl:h-[45px] 4xl:w-28 4xl:h-[63px] object-cover rounded shrink-0 bg-[#18181b]" />
                                                        : <div className="w-16 h-9 3xl:w-20 3xl:h-[45px] 4xl:w-28 4xl:h-[63px] rounded shrink-0 bg-[#18181b]" />}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-white text-sm 3xl:text-base 4xl:text-xl truncate">{item.track.title}</p>
                                                        <p className="text-xs 3xl:text-sm 4xl:text-base text-[#71717a] truncate">
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
                                                    <span className="font-mono text-xs 3xl:text-sm 4xl:text-base text-[#71717a] shrink-0">{formatDuration(item.track.durationSeconds)}</span>
                                                </a>
                                                {p.votingEnabled && (
                                                    <button
                                                        onClick={() => vote(p.id, item.id)}
                                                        title={contributor ? t('songRequestPublic.vote') : t('songRequestPublic.loginToVote')}
                                                        className={`mr-3 shrink-0 flex items-center gap-1 px-2 py-1 rounded font-mono text-xs 3xl:text-sm 4xl:text-base border transition-colors ${myVotes[p.id]?.has(item.id)
                                                            ? 'border-[#39ff14] text-[#39ff14] bg-[#39ff14]/10'
                                                            : 'border-[#27272a] text-[#a1a1aa] hover:border-[#39ff14]/60'}`}
                                                    >
                                                        ▲ {item.votes}
                                                    </button>
                                                )}
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Agregar a una playlist colaborativa: requisitos, con qué cuenta, y el formulario (o cómo iniciar sesión). */
function ContributeBox({ channel, playlist, contributor, onAdded }: { channel: string; playlist: PublicPlaylist; contributor: Contributor; onAdded: () => void }) {
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
            const res = await fetch(`/api/song-request/public/${encodeURIComponent(channel)}/playlists/${playlist.id}/items`, {
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
            <p className="text-xs 3xl:text-sm 4xl:text-base text-[#a1a1aa]">
                {rules.length > 0 ? `${t('songRequestPublic.req.title')} ${rules.join(' · ')}` : t('songRequestPublic.req.anyone')}
                {playlist.review && ` ${t('songRequestPublic.req.review')}`}
            </p>
            {contributor === undefined ? (
                <a href={loginUrl} className="inline-block px-4 py-2 rounded-lg bg-[#39ff14] text-black font-bold text-sm 3xl:text-base 4xl:text-lg hover:brightness-110">
                    {t('songRequestPublic.loginToAdd')}
                </a>
            ) : contributor === null ? (
                <p className="text-sm 3xl:text-base text-amber-300">{t('songRequestPublic.errors.pl_need_account')}</p>
            ) : (
                <>
                    <form className="flex flex-col sm:flex-row gap-2" onSubmit={e => { e.preventDefault(); submit(); }}>
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            maxLength={500}
                            placeholder={t('songRequestPublic.addPlaceholder')}
                            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#111114] border border-[#27272a] text-white text-sm 3xl:text-base 4xl:text-lg placeholder:text-[#52525b] focus:outline-none focus:border-[#39ff14]"
                        />
                        <button type="submit" disabled={busy || !input.trim()} className="px-4 py-2 rounded-lg bg-[#39ff14] text-black font-bold text-sm 3xl:text-base 4xl:text-lg disabled:opacity-50 shrink-0">
                            {busy ? t('songRequestPublic.adding') : t('songRequestPublic.add')}
                        </button>
                    </form>
                    <p className="text-xs 3xl:text-sm text-[#71717a]">
                        <PlatformIcon platform={contributor.platform} className="w-3.5 h-3.5 3xl:w-4 3xl:h-4" /> {t('songRequestPublic.addingAs', { user: contributor.name })}
                    </p>
                </>
            )}
            {result && <p className={`text-sm 3xl:text-base ${result.ok ? 'text-[#39ff14]' : 'text-red-400'}`}>{result.text}</p>}
        </div>
    );
}
