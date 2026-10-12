// Mensaje del chat del Multi-view tal como lo manda el servidor (formato del chat en pantalla) más lo que el panel agrega.

export interface ChatPart {
    t: 'text' | 'emote' | 'cheer';
    v?: string;   // texto
    n?: string;   // nombre del emote
    u?: string;   // imagen
    a?: boolean;  // animado
    z?: boolean;  // se dibuja encima del anterior
    p?: string;   // proveedor
    b?: number;   // bits
}

export interface ChatBadge { id: string; url?: string; title?: string; kick?: string }

export interface ChatMsg {
    /** «twitch:canal» o «kick:canal»: de qué casilla viene */
    key: string;
    id: string;
    platform: 'twitch' | 'kick';
    channel: { id: string; login: string; name: string; shared: boolean };
    user: { login: string; name: string; id: string; color?: string };
    badges: ChatBadge[];
    parts: ChatPart[];
    highlight: boolean;
    reply?: { user: string; text: string };
    ts: number;
    deleted?: boolean;
}

export type ChatStatus = 'connecting' | 'live' | 'reconnecting' | 'off';

export interface MeInfo { authenticated: boolean; twitch: string | null; kick: string | null }
export interface SendResult { ok: boolean; code?: string | null; detail?: string | null }
export interface EmoteItem { name: string; url: string; provider: string; animated: boolean }

export type ModAction = 'delete' | 'timeout' | 'ban' | 'unban';
export interface ModRequest { action: ModAction; key: string; messageId?: string | null; targetId?: string | null; seconds?: number | null; reason?: string | null }
export type Role = 'mod' | 'broadcaster';
