import type { MusicTrack, PlaybackProgress } from '../../../components/music-overlay/types';

/** Lo que manda el servidor (GET /nowplaying/now y el aviso NowPlayingUpdate). */
export interface NowPlayingTrackData {
    song: string;
    artist: string;
    album?: string;
    albumArtUrl?: string;
    durationMs: number;
    progressMs?: number | null;
    isPlaying: boolean;
    provider: string;
    isNewTrack?: boolean;
    timestamp?: string;
}

/**
 * Pasa la canción al formato del motor. El progreso, como el overlay viejo: Spotify lo da exacto;
 * Last.fm no, así que se estima con la hora en que empezó.
 */
export function trackFromApi(d: NowPlayingTrackData, now = Date.now()): { track: MusicTrack; progress: PlaybackProgress } {
    const id = `${d.song}|${d.artist}`;
    const provider = (d.provider || '').toLowerCase().replace('.', '');
    const positionMs = d.progressMs != null && d.progressMs > 0
        ? d.progressMs
        : Math.max(0, now - (d.timestamp ? new Date(d.timestamp).getTime() : now));
    const duration = (d.durationMs || 0) / 1000;
    return {
        track: {
            id,
            title: d.song,
            artist: d.artist,
            album: d.album || null,
            durationSeconds: duration || null,
            thumbnailUrl: d.albumArtUrl || null,
            source: provider,
        },
        progress: { itemId: id, position: duration ? Math.min(duration, positionMs / 1000) : positionMs / 1000, duration, playing: !!d.isPlaying },
    };
}
