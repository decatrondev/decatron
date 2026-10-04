import type { ChatBadge, ChatMsg, ChatPart, ChatPlatform } from './types';

// Mensajes de ejemplo para diseñar sin estar en vivo (vista previa y editor).

export interface SampleEmote { name: string; url: string; animated?: boolean; provider: string }

const NATIVE: SampleEmote[] = [
    { name: 'Kappa', url: 'https://static-cdn.jtvnw.net/emoticons/v2/25/static/dark/2.0', provider: 'twitch' },
    { name: 'LUL', url: 'https://static-cdn.jtvnw.net/emoticons/v2/425618/static/dark/2.0', provider: 'twitch' },
    { name: '4Head', url: 'https://static-cdn.jtvnw.net/emoticons/v2/354/static/dark/2.0', provider: 'twitch' },
    { name: 'Kreygasm', url: 'https://static-cdn.jtvnw.net/emoticons/v2/41/static/dark/2.0', provider: 'twitch' },
];

const USERS: { name: string; color?: string; badges: string[]; platform: ChatPlatform }[] = [
    { name: 'AnaGamer', color: '#FF4500', badges: ['moderator'], platform: 'twitch' },
    { name: 'pixel_cat', color: '#1E90FF', badges: ['subscriber'], platform: 'twitch' },
    { name: 'DonMarcos', color: '#9ACD32', badges: ['vip'], platform: 'twitch' },
    { name: 'luna_ttv', color: '#FF69B4', badges: [], platform: 'twitch' },
    { name: 'KickFan99', color: '#53FC18', badges: ['subscriber'], platform: 'kick' },
    { name: 'sinColor', badges: [], platform: 'twitch' },
    { name: 'Tomás', color: '#8A2BE2', badges: ['subscriber', 'vip'], platform: 'twitch' },
];

const LINES: (string | { emote: number })[][] = [
    ['¡Buenas! Llegué justo a tiempo ', { emote: 0 }],
    ['esa jugada estuvo increíble ', { emote: 1 }, ' ', { emote: 1 }],
    ['alguien sabe qué skin es esa?'],
    [{ emote: 2 }, ' no puede ser'],
    ['jajajaja ', { emote: 0 }],
    ['primera vez en el stream, me encanta el overlay'],
    ['GG ', { emote: 3 }],
    ['de dónde son todos? yo desde Lima'],
];

let counter = 0;

/** Un mensaje de ejemplo; `extra` trae emotes reales del canal (7TV, BTTV, FFZ) para que la vista previa se parezca a lo real */
export function sampleMessage(extra: SampleEmote[] = [], opts: { shared?: boolean } = {}): ChatMsg {
    const pool = [...NATIVE, ...extra.slice(0, 40)];
    const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
    const user = pick(USERS);
    const line = pick(LINES);

    const parts: ChatPart[] = [];
    for (const piece of line) {
        if (typeof piece === 'string') { parts.push({ t: 'text', v: piece }); continue; }
        const e = piece.emote < NATIVE.length && extra.length > 0 && Math.random() < 0.6 ? pick(extra) : pool[piece.emote % pool.length];
        parts.push({ t: 'emote', n: e.name, u: e.url, a: e.animated, p: e.provider });
    }

    const badges: ChatBadge[] = user.badges.map(b => ({ id: `${user.platform}-${b}`, kick: b, title: b }));
    counter += 1;
    return {
        id: `sample-${Date.now()}-${counter}`,
        platform: user.platform,
        channel: opts.shared
            ? { id: 'guest', login: 'streamer_invitado', name: 'Invitado', shared: true }
            : { id: 'me', login: 'tu_canal', name: 'TuCanal', shared: false },
        user: { login: user.name.toLowerCase(), name: user.name, id: user.name, color: user.color },
        badges,
        parts,
        highlight: counter % 9 === 0,
        reply: counter % 7 === 0 ? { user: 'AnaGamer', text: 'qué buen stream' } : undefined,
        ts: Date.now(),
    };
}
