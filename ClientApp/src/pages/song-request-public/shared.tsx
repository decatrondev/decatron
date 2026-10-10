import type { RequestMode } from '../features/song-request-extension/components/PublicRequestGuide';

// Tipos y piezas comunes de las pestañas de /sr/:channelName (SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 1b).

export interface QueueItem {
    id: number;
    position: number;
    source: string | null;
    url: string | null;
    title: string;
    artist: string;
    durationSeconds: number | null;
    thumbnailUrl: string | null;
    requestedBy: string;
    platform: string;
    isFallback?: boolean;
    originSource: string | null;
    originUrl: string | null;
}

export interface QueueState {
    channel: string;
    enabled: boolean;
    requestsOpen: boolean;
    paused: boolean;
    stopped?: boolean;
    mode?: RequestMode;
    allowWebRequests?: boolean;
    activePlaylist?: { code: string; name: string } | null;
    requestSource?: 'any' | 'playlists';
    activePlaylistId?: number | null;
    current: QueueItem | null;
    queue: QueueItem[];
    totalDurationSeconds: number;
}

export function formatDuration(seconds: number | null | undefined): string {
    if (!seconds || seconds <= 0) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="flex items-center gap-2 mb-3 font-mono text-xs 3xl:text-sm 4xl:text-base uppercase tracking-widest text-ds-soft font-bold">
            <span className="text-pub-accent-hi">#</span>
            {children}
        </h2>
    );
}

export function Chip({ tone, children }: { tone: 'green' | 'red' | 'amber'; children: React.ReactNode }) {
    const styles = {
        green: 'bg-ds-ok/10 text-ds-ok border-ds-ok/40',
        red: 'bg-ds-danger-solid/10 text-ds-danger border-ds-danger/40',
        amber: 'bg-ds-warn/10 text-ds-warn border-ds-warn/40',
    }[tone];
    return <span className={`px-2 py-0.5 rounded border uppercase tracking-wide ${styles}`}>{children}</span>;
}

export function Notice({ text, tone }: { text: string; tone?: 'error' }) {
    return (
        <div className="rounded-lg border border-pub-border bg-pub-surface p-5 4xl:p-8">
            <p className={`text-sm 3xl:text-base 4xl:text-lg ${tone === 'error' ? 'text-ds-danger' : 'text-ds-soft'}`}>{text}</p>
        </div>
    );
}

export function authHeaders(): Record<string, string> {
    try {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    } catch { return {}; }
}
