import { useCallback, useEffect, useState } from 'react';
import { authHeaders } from './shared';
import type { PublicPlaylist, PublicPlaylistItem } from './PlaylistPanel';

export interface SharedPlaylist extends Omit<PublicPlaylist, 'id'> { listed: boolean }
type Status = 'loading' | 'ok' | 'notfound' | 'error';

/**
 * Una playlist compartida (pública o solo con enlace): sus datos, sus canciones y los votos del viewer.
 * `refreshKey` la vuelve a pedir (el streamer cambió algo) sin vaciar lo que ya se ve.
 */
export function usePlaylistData(channel: string, code: string, refreshKey = 0) {
    const [status, setStatus] = useState<Status>('loading');
    const [playlist, setPlaylist] = useState<SharedPlaylist | null>(null);
    const [items, setItems] = useState<PublicPlaylistItem[] | null>(null);
    const [myVotes, setMyVotes] = useState<Set<number>>(new Set());
    const api = `/api/song-request/public/${encodeURIComponent(channel)}/playlists/${encodeURIComponent(code)}`;

    const load = useCallback(async () => {
        try {
            const r = await fetch(`/api/public/song-request/${encodeURIComponent(channel)}/playlists/${encodeURIComponent(code)}`);
            if (r.status === 404) { setStatus('notfound'); return; }
            const d = r.ok ? await r.json() : null;
            if (!d?.shared) { setStatus(prev => (prev === 'ok' ? prev : 'error')); return; }
            setPlaylist(d.shared.playlist);
            setItems(d.shared.items ?? []);
            setStatus('ok');
            const headers = authHeaders();
            if (headers.Authorization && d.shared.playlist.votingEnabled) {
                fetch(`${api}/my-votes`, { headers })
                    .then(res => (res.ok ? res.json() : null))
                    .then(v => setMyVotes(new Set<number>(v?.items ?? [])))
                    .catch(() => { /* sin votos */ });
            }
        } catch { setStatus(prev => (prev === 'ok' ? prev : 'error')); }
    }, [channel, code, api]);
    useEffect(() => { load(); }, [load, refreshKey]);

    /** @returns false si no hay sesión (el que llama manda al login). */
    const vote = async (itemId: number, loggedIn: boolean): Promise<boolean> => {
        if (!loggedIn) return false;
        try {
            const r = await fetch(`${api}/items/${itemId}/vote`, { method: 'POST', headers: authHeaders() });
            const d = r.ok ? await r.json() : null;
            if (!d?.success) return true;
            setMyVotes(prev => {
                const set = new Set(prev);
                if (d.voted) set.add(itemId); else set.delete(itemId);
                return set;
            });
            setItems(prev => (prev ?? []).map(i => (i.id === itemId ? { ...i, votes: d.votes } : i)));
        } catch { /* se reintenta con otro clic */ }
        return true;
    };

    return { status, playlist, items, myVotes, reload: load, vote, api };
}
