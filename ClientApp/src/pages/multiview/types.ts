// Tipos y utilidades de la URL del Multi-view. Plan: .dev/plans/MULTIVIEW_PLAN.md (Fase 1).

export type Platform = 'twitch' | 'kick';
export type LayoutId = 'grid' | 'focus' | 'stack';
export type QualityChoice = 'auto' | '720' | '480' | '360' | '160';

export interface Slot {
    id: string;
    platform: Platform;
    channel: string;
}

export interface KickStatus {
    slug: string;
    known: boolean;
    exists: boolean;
    live: boolean;
    viewers: number | null;
    chatroomId: number | null;
    title: string | null;
}

export const LAYOUTS: LayoutId[] = ['grid', 'focus', 'stack'];
export const QUALITIES: QualityChoice[] = ['auto', '720', '480', '360', '160'];

// Un usuario de Twitch: 4 a 25 caracteres; en Kick hasta 25 con guion. Se acepta el mismo conjunto en ambos.
const CHANNEL_RE = /^[a-z0-9_-]{2,25}$/;

export const normalizeChannel = (v: string) => v.trim().toLowerCase();
export const isValidChannel = (v: string) => CHANNEL_RE.test(v);
export const slotKey = (platform: Platform, channel: string) => `${platform}:${channel}`;

/** Acepta «canal», «kick:canal» o un enlace de twitch.tv / kick.com y devuelve la plataforma y el canal. */
export function parseChannelInput(raw: string, fallback: Platform): { platform: Platform; channel: string } | null {
    let text = raw.trim();
    if (!text) return null;
    let platform = fallback;
    const url = text.match(/^(?:https?:\/\/)?(?:www\.|player\.)?(twitch\.tv|kick\.com)\/(?:popout\/|embed\/)?([A-Za-z0-9_-]+)/i);
    if (url) {
        platform = url[1].toLowerCase().startsWith('kick') ? 'kick' : 'twitch';
        text = url[2];
    } else {
        const pref = text.match(/^(twitch|kick|k|t):(.+)$/i);
        if (pref) {
            platform = pref[1].toLowerCase().startsWith('k') ? 'kick' : 'twitch';
            text = pref[2];
        }
    }
    const channel = normalizeChannel(text.replace(/^@/, ''));
    return isValidChannel(channel) ? { platform, channel } : null;
}

/** /multi/canal1/k:canal2 → casillas. Sin prefijo = Twitch; «k:» = Kick. Repetidos y no válidos se ignoran. */
export function slotsFromPath(pathname: string): Slot[] {
    const seen = new Set<string>();
    const out: Slot[] = [];
    for (const seg of pathname.replace(/^\/multi\/?/, '').split('/').filter(Boolean)) {
        const p = parseChannelInput(decodeURIComponent(seg), 'twitch');
        if (!p) continue;
        const key = slotKey(p.platform, p.channel);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ id: key, ...p });
    }
    return out;
}

export function pathFromSlots(slots: Slot[]): string {
    if (!slots.length) return '/multi';
    return '/multi/' + slots.map(s => (s.platform === 'kick' ? `k:${s.channel}` : s.channel)).join('/');
}
