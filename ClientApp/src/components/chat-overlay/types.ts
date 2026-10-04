// Overlay de chat (.dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 1): tipos del mensaje que manda el servidor
// y de la configuración, con sus valores por defecto. La config se guarda entera como JSON.

export type ChatPlatform = 'twitch' | 'kick' | 'youtube';

/** Un trozo de mensaje ya resuelto por el servidor: t = tipo, v = texto, n = nombre del emote, u = imagen, a = animado, z = va encima del anterior, p = proveedor, b = bits. */
export interface ChatPart {
    t: 'text' | 'emote' | 'cheer';
    v?: string;
    n?: string;
    u?: string;
    a?: boolean;
    z?: boolean;
    p?: string;
    b?: number;
}

export interface ChatBadge {
    id: string;
    url?: string;
    title?: string;
    /** Kick no da imágenes: llega solo el tipo ("moderator", "vip"...) y se dibuja una insignia propia */
    kick?: string;
}

export interface ChatMsg {
    id: string;
    platform: ChatPlatform;
    channel: { id: string; login: string; name: string; shared: boolean };
    user: { login: string; name: string; id: string; color?: string };
    badges: ChatBadge[];
    parts: ChatPart[];
    highlight: boolean;
    reply?: { user: string; text: string };
    ts: number;
}

export type ChatPreset = 'classic' | 'compact' | 'boxed' | 'minimal' | 'twitch';
export type EnterAnimation = 'slide' | 'fade' | 'pop' | 'none';
export type ExitAnimation = 'fade' | 'slide' | 'none';
export type MinRole = 'all' | 'sub' | 'vip' | 'mod';
export type BubbleMovement = 'float' | 'drift' | 'bounce' | 'fall' | 'stay' | 'random';
export type BubbleShape = 'round' | 'comic' | 'rect';

/** Un área del lienzo: donde pueden aparecer burbujas (allow) o donde nunca debe aparecer nada (deny) */
export interface BubbleZone { id: string; kind: 'allow' | 'deny'; x: number; y: number; width: number; height: number }

export interface ChatOverlayConfig {
    version: number;
    /** 'bubbles' llega en la fase 2 */
    mode: 'list' | 'bubbles';
    sources: { twitch: boolean; kick: boolean; youtube: boolean; showPlatformIcon: boolean };
    sharedChat: { mode: 'all' | 'mine'; hiddenChannels: string[]; showOrigin: boolean };
    display: {
        maxMessages: number;
        /** 0 = los mensajes no desaparecen por tiempo, solo salen cuando entran otros */
        messageSeconds: number;
        direction: 'up' | 'down';
        showBadges: boolean;
        showTimestamp: boolean;
        showReplies: boolean;
        nameColor: 'user' | 'fixed';
        fixedNameColor: string;
        separator: string;
    };
    filters: {
        hideCommands: boolean;
        hideBots: boolean;
        blockedUsers: string[];
        blockedWords: string[];
        minRole: MinRole;
    };
    emotes: {
        sevenTv: boolean;
        bttv: boolean;
        ffz: boolean;
        globals: boolean;
        /** Los emotes propios de Decatron (los que sube la comunidad del canal) */
        decatron: boolean;
        sharedChannels: boolean;
        hidden: string[];
        sizePx: number;
    };
    theme: {
        preset: ChatPreset;
        containerBg: string;
        containerRadius: number;
        containerPadding: number;
        messageBg: string;
        messageRadius: number;
        messagePaddingY: number;
        messagePaddingX: number;
        gap: number;
        borderColor: string;
        borderWidth: number;
        highlightColor: string;
    };
    text: {
        fontFamily: string;
        fontSize: number;
        fontWeight: number;
        lineHeight: number;
        color: string;
        outlineEnabled: boolean;
        outlineColor: string;
        outlineWidth: number;
        shadow: boolean;
    };
    animations: { enter: EnterAnimation; exit: ExitAnimation; durationMs: number };
    /** Modo burbujas: mensajes que salen por toda la pantalla */
    bubbles: {
        movement: BubbleMovement;
        /** Píxeles por segundo */
        speed: number;
        /** Cuánto se ve cada burbuja */
        durationSeconds: number;
        maxBubbles: number;
        maxWidth: number;
        shape: BubbleShape;
        background: string;
        /** Borde del color de quien escribe */
        userBorder: boolean;
        avoidOverlap: boolean;
        /** Con el máximo alcanzado: la más vieja se va para dejar lugar, o el mensaje nuevo se descarta */
        whenFull: 'replace' | 'skip';
        sizeByLength: boolean;
        /** Un mensaje que es solo emotes se ve más grande; 1 = igual que los demás */
        emoteOnlyScale: number;
        /** Sin zonas permitidas, aparecen en toda la pantalla */
        zones: BubbleZone[];
    };
    layout: { x: number; y: number; width: number; height: number };
}

export const CANVAS = { width: 1920, height: 1080 };

export const DEFAULT_CHAT_CONFIG: ChatOverlayConfig = {
    version: 1,
    mode: 'list',
    sources: { twitch: true, kick: true, youtube: true, showPlatformIcon: false },
    sharedChat: { mode: 'all', hiddenChannels: [], showOrigin: true },
    display: {
        maxMessages: 14,
        messageSeconds: 0,
        direction: 'up',
        showBadges: true,
        showTimestamp: false,
        showReplies: true,
        nameColor: 'user',
        fixedNameColor: '#ffffff',
        separator: ':',
    },
    filters: { hideCommands: true, hideBots: true, blockedUsers: [], blockedWords: [], minRole: 'all' },
    emotes: { sevenTv: true, bttv: true, ffz: true, globals: true, decatron: true, sharedChannels: true, hidden: [], sizePx: 38 },
    theme: {
        preset: 'classic',
        containerBg: 'rgba(0,0,0,0)',
        containerRadius: 0,
        containerPadding: 0,
        messageBg: 'rgba(0,0,0,0)',
        messageRadius: 0,
        messagePaddingY: 2,
        messagePaddingX: 0,
        gap: 6,
        borderColor: 'rgba(255,255,255,0.2)',
        borderWidth: 0,
        highlightColor: 'rgba(145,70,255,0.45)',
    },
    text: {
        fontFamily: 'Inter',
        fontSize: 28,
        fontWeight: 600,
        lineHeight: 1.35,
        color: '#ffffff',
        outlineEnabled: false,
        outlineColor: '#000000',
        outlineWidth: 2,
        shadow: true,
    },
    animations: { enter: 'slide', exit: 'fade', durationMs: 350 },
    bubbles: {
        movement: 'float',
        speed: 60,
        durationSeconds: 9,
        maxBubbles: 12,
        maxWidth: 520,
        shape: 'round',
        background: 'rgba(15,15,20,0.82)',
        userBorder: true,
        avoidOverlap: true,
        whenFull: 'replace',
        sizeByLength: true,
        emoteOnlyScale: 2.2,
        zones: [],
    },
    layout: { x: 40, y: 380, width: 640, height: 640 },
};

/** Diseños prearmados: cada uno cambia el tema y el texto, y deja el resto como estaba */
export const CHAT_PRESETS: Record<ChatPreset, { theme: Partial<ChatOverlayConfig['theme']>; text: Partial<ChatOverlayConfig['text']>; emoteSize: number }> = {
    classic: {
        theme: { containerBg: 'rgba(0,0,0,0)', containerRadius: 0, containerPadding: 0, messageBg: 'rgba(0,0,0,0)', messageRadius: 0, messagePaddingY: 2, messagePaddingX: 0, gap: 6, borderWidth: 0 },
        text: { fontSize: 28, fontWeight: 600, shadow: true, outlineEnabled: false },
        emoteSize: 38,
    },
    compact: {
        theme: { containerBg: 'rgba(0,0,0,0)', containerRadius: 0, containerPadding: 0, messageBg: 'rgba(0,0,0,0)', messageRadius: 0, messagePaddingY: 0, messagePaddingX: 0, gap: 2, borderWidth: 0 },
        text: { fontSize: 22, fontWeight: 600, shadow: true, outlineEnabled: false },
        emoteSize: 30,
    },
    boxed: {
        theme: { containerBg: 'rgba(0,0,0,0)', containerRadius: 0, containerPadding: 0, messageBg: 'rgba(15,15,20,0.72)', messageRadius: 12, messagePaddingY: 8, messagePaddingX: 14, gap: 8, borderWidth: 0 },
        text: { fontSize: 26, fontWeight: 600, shadow: false, outlineEnabled: false },
        emoteSize: 36,
    },
    minimal: {
        theme: { containerBg: 'rgba(0,0,0,0)', containerRadius: 0, containerPadding: 0, messageBg: 'rgba(0,0,0,0)', messageRadius: 0, messagePaddingY: 1, messagePaddingX: 0, gap: 4, borderWidth: 0 },
        text: { fontSize: 24, fontWeight: 500, shadow: false, outlineEnabled: true, outlineColor: '#000000', outlineWidth: 3 },
        emoteSize: 32,
    },
    twitch: {
        theme: { containerBg: 'rgba(24,24,27,0.92)', containerRadius: 10, containerPadding: 14, messageBg: 'rgba(0,0,0,0)', messageRadius: 0, messagePaddingY: 3, messagePaddingX: 0, gap: 4, borderWidth: 0 },
        text: { fontSize: 24, fontWeight: 500, shadow: false, outlineEnabled: false },
        emoteSize: 32,
    },
};

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Mezcla lo guardado sobre los valores por defecto: lo que falta o viene con otro tipo usa el de fábrica */
function merge<T>(defaults: T, raw: unknown): T {
    if (isObject(defaults)) {
        const source = isObject(raw) ? raw : {};
        const out: Json = {};
        for (const key of Object.keys(defaults as Json)) out[key] = merge((defaults as Json)[key], source[key]);
        return out as T;
    }
    if (Array.isArray(defaults)) return (Array.isArray(raw) ? raw.filter(x => typeof x === 'string') : defaults) as T;
    if (typeof defaults === 'number') return (typeof raw === 'number' && Number.isFinite(raw) ? raw : defaults) as T;
    if (typeof defaults === 'boolean') return (typeof raw === 'boolean' ? raw : defaults) as T;
    if (typeof defaults === 'string') return (typeof raw === 'string' ? raw : defaults) as T;
    return defaults;
}

export function normalizeChatConfig(raw: unknown): ChatOverlayConfig {
    const c = merge(DEFAULT_CHAT_CONFIG, raw);
    // Valores acotados: una config a mano o vieja no debe romper el overlay
    c.display.maxMessages = Math.min(60, Math.max(1, Math.round(c.display.maxMessages)));
    c.display.messageSeconds = Math.min(600, Math.max(0, c.display.messageSeconds));
    c.emotes.sizePx = Math.min(120, Math.max(12, c.emotes.sizePx));
    c.text.fontSize = Math.min(120, Math.max(8, c.text.fontSize));
    c.animations.durationMs = Math.min(3000, Math.max(0, c.animations.durationMs));
    c.layout.width = Math.min(CANVAS.width, Math.max(120, c.layout.width));
    c.layout.height = Math.min(CANVAS.height, Math.max(80, c.layout.height));
    c.layout.x = Math.min(CANVAS.width - 40, Math.max(0, c.layout.x));
    c.layout.y = Math.min(CANVAS.height - 40, Math.max(0, c.layout.y));
    if (!['list', 'bubbles'].includes(c.mode)) c.mode = 'list';
    if (!['up', 'down'].includes(c.display.direction)) c.display.direction = 'up';
    if (!['all', 'mine'].includes(c.sharedChat.mode)) c.sharedChat.mode = 'all';
    if (!['all', 'sub', 'vip', 'mod'].includes(c.filters.minRole)) c.filters.minRole = 'all';
    if (!['slide', 'fade', 'pop', 'none'].includes(c.animations.enter)) c.animations.enter = 'slide';
    if (!['fade', 'slide', 'none'].includes(c.animations.exit)) c.animations.exit = 'fade';

    const b = c.bubbles;
    if (!['float', 'drift', 'bounce', 'fall', 'stay', 'random'].includes(b.movement)) b.movement = 'float';
    if (!['round', 'comic', 'rect'].includes(b.shape)) b.shape = 'round';
    if (!['replace', 'skip'].includes(b.whenFull)) b.whenFull = 'replace';
    b.speed = Math.min(400, Math.max(0, b.speed));
    b.durationSeconds = Math.min(60, Math.max(2, b.durationSeconds));
    b.maxBubbles = Math.min(40, Math.max(1, Math.round(b.maxBubbles)));
    b.maxWidth = Math.min(1200, Math.max(160, b.maxWidth));
    b.emoteOnlyScale = Math.min(5, Math.max(1, b.emoteOnlyScale));
    // Las zonas son una lista de objetos: la mezcla de arriba solo sabe de textos
    const rawZones = (raw as { bubbles?: { zones?: unknown } } | null)?.bubbles?.zones;
    b.zones = Array.isArray(rawZones)
        ? rawZones.flatMap((z): BubbleZone[] => {
            if (!isObject(z) || (z.kind !== 'allow' && z.kind !== 'deny')) return [];
            const n = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
            const width = Math.min(CANVAS.width, Math.max(8, n(z.width, 200)));
            const height = Math.min(CANVAS.height, Math.max(8, n(z.height, 200)));
            return [{
                id: typeof z.id === 'string' && z.id ? z.id : `z${Math.random().toString(36).slice(2, 8)}`,
                kind: z.kind,
                x: Math.min(CANVAS.width - 8, Math.max(0, n(z.x, 0))),
                y: Math.min(CANVAS.height - 8, Math.max(0, n(z.y, 0))),
                width, height,
            }];
        }).slice(0, 20)
        : [];
    return c;
}
