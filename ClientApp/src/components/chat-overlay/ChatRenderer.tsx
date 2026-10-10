import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { FeedItem } from './useChatFeed';
import type { ChatBadge, ChatMsg, ChatOverlayConfig, ChatPart, ChatPlatform } from './types';

// Un solo renderer para el overlay de OBS, la vista previa y el editor (.dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 1).

const TWITCH_DEFAULT_COLORS = ['#FF0000', '#0000FF', '#00FF00', '#B22222', '#FF7F50', '#9ACD32', '#FF4500', '#2E8B57', '#DAA520', '#D2691E', '#5F9EA0', '#1E90FF', '#FF69B4', '#8A2BE2', '#00FF7F'];

const PLATFORM_STYLE: Record<ChatPlatform, { bg: string; fg: string; letter: string }> = {
    twitch: { bg: '#9146FF', fg: '#ffffff', letter: 'T' },
    kick: { bg: '#53FC18', fg: '#0b0e0f', letter: 'K' },
    youtube: { bg: '#FF0000', fg: '#ffffff', letter: 'Y' },
};

const KICK_BADGES: Record<string, { bg: string; glyph: string }> = {
    broadcaster: { bg: '#e91916', glyph: '●' },
    moderator: { bg: '#00ad03', glyph: '⚔' },
    vip: { bg: '#e005b9', glyph: '♦' },
    subscriber: { bg: '#53fc18', glyph: '★' },
    og: { bg: '#f5a623', glyph: 'OG' },
    founder: { bg: '#f5a623', glyph: 'F' },
    verified: { bg: '#1d9bf0', glyph: '✓' },
    staff: { bg: '#6b7280', glyph: 'S' },
};

function hash(text: string): number {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return Math.abs(h);
}

/** Los colores muy oscuros no se leen sobre un stream: se aclaran, como hace el chat de Twitch */
function readable(color: string): string {
    const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
    if (!m) return color;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (luminance >= 0.35) return color;
    const mix = (c: number) => Math.round(c + (255 - c) * 0.55);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function nameColorOf(msg: ChatMsg, config: ChatOverlayConfig): string {
    if (config.display.nameColor === 'fixed') return config.display.fixedNameColor;
    return readable(msg.user.color || TWITCH_DEFAULT_COLORS[hash(msg.user.login) % TWITCH_DEFAULT_COLORS.length]);
}

function originColor(login: string): string {
    return `hsl(${hash(login) % 360}, 70%, 65%)`;
}

export function BadgeView({ badge, size }: { badge: ChatBadge; size: number }) {
    if (badge.url) {
        return <img src={badge.url} alt={badge.title || badge.id} title={badge.title} style={{ display: 'inline-block', height: size, width: size, verticalAlign: 'middle', marginRight: 4 }} />;
    }
    const kind = KICK_BADGES[badge.kick || ''] ?? { bg: '#6b7280', glyph: (badge.kick || '?').slice(0, 1).toUpperCase() };
    return (
        <span
            title={badge.title}
            style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: size * 0.22,
                background: kind.bg, color: '#fff', fontSize: size * (kind.glyph.length > 1 ? 0.5 : 0.7), fontWeight: 800, lineHeight: 1,
                verticalAlign: 'middle', marginRight: 4, textShadow: 'none',
            }}
        >
            {kind.glyph}
        </span>
    );
}

function Tag({ bg, fg, children, size }: { bg: string; fg: string; children: ReactNode; size: number }) {
    return (
        <span
            style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: size, height: size, padding: '0 4px', borderRadius: size * 0.25,
                background: bg, color: fg, fontSize: size * 0.62, fontWeight: 800, lineHeight: 1, verticalAlign: 'middle', marginRight: 6, textShadow: 'none',
            }}
        >
            {children}
        </span>
    );
}

/** Texto y emotes. Un emote "zero-width" se dibuja encima del anterior en vez de a su lado. */
function PartsView({ parts, config }: { parts: ChatPart[]; config: ChatOverlayConfig }) {
    const size = config.emotes.sizePx;
    const nodes: ReactNode[] = [];
    let i = 0;
    while (i < parts.length) {
        const part = parts[i];
        if (part.t === 'text') {
            nodes.push(<Fragment key={i}>{part.v}</Fragment>);
            i++;
        } else if (part.t === 'cheer') {
            nodes.push(
                <span key={i} style={{ whiteSpace: 'nowrap' }}>
                    {part.u && <img src={part.u} alt={part.n} style={{ display: 'inline-block', height: size, verticalAlign: 'middle' }} />}
                    <b style={{ marginLeft: 2, color: '#b9a3ff' }}>{part.b}</b>
                </span>
            );
            i++;
        } else {
            const group: ChatPart[] = [part];
            i++;
            while (i < parts.length && parts[i].t === 'emote' && parts[i].z) { group.push(parts[i]); i++; }
            nodes.push(
                <span key={i} style={{ position: 'relative', display: 'inline-block', verticalAlign: 'middle', height: size, margin: '0 2px' }}>
                    {group.map((g, k) => (
                        <img
                            key={k}
                            src={g.u}
                            alt={g.n}
                            title={g.n}
                            style={k === 0 ? { height: size, display: 'block' } : { height: size, position: 'absolute', left: 0, top: 0 }}
                        />
                    ))}
                </span>
            );
        }
    }
    return <>{nodes}</>;
}

function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** `hideAuthor` quita insignias, nombre y separador (el estilo cristal los pone aparte, en la píldora) */
export function MessageView({ msg, config, hideAuthor = false }: { msg: ChatMsg; config: ChatOverlayConfig; hideAuthor?: boolean }) {
    const { text, display, sources, sharedChat } = config;
    const badgeSize = Math.round(text.fontSize * 0.95);
    const platform = PLATFORM_STYLE[msg.platform];
    return (
        <>
            {display.showReplies && msg.reply && (
                <div style={{ fontSize: text.fontSize * 0.72, opacity: 0.75, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    ↪ @{msg.reply.user}: {msg.reply.text}
                </div>
            )}
            <div style={{ overflowWrap: 'anywhere' }}>
                {display.showTimestamp && <span style={{ opacity: 0.6, fontSize: text.fontSize * 0.75, marginRight: 8 }}>{formatTime(msg.ts)}</span>}
                {sources.showPlatformIcon && <Tag bg={platform.bg} fg={platform.fg} size={badgeSize}>{platform.letter}</Tag>}
                {sharedChat.showOrigin && msg.channel.shared && (
                    <span style={{ color: originColor(msg.channel.login), fontSize: text.fontSize * 0.75, fontWeight: 800, marginRight: 6, opacity: 0.95 }}>
                        [{msg.channel.name}]
                    </span>
                )}
                {!hideAuthor && display.showBadges && msg.badges.map(b => <BadgeView key={b.id} badge={b} size={badgeSize} />)}
                {!hideAuthor && <span style={{ color: nameColorOf(msg, config), fontWeight: 800 }}>{msg.user.name}</span>}
                {!hideAuthor && <span style={{ marginRight: 8 }}>{display.separator}</span>}
                <PartsView parts={msg.parts} config={config} />
            </div>
        </>
    );
}

/** Letra, color, sombra y contorno: los mismos para el cuadro de lista y para las burbujas */
export function textStyle(config: ChatOverlayConfig): CSSProperties {
    const { text } = config;
    const textShadow = [
        text.shadow ? '0 2px 4px rgba(0,0,0,.85), 0 0 2px rgba(0,0,0,.9)' : '',
        text.outlineEnabled
            ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
                .map(([x, y]) => `${x * text.outlineWidth}px ${y * text.outlineWidth}px 0 ${text.outlineColor}`).join(',')
            : '',
    ].filter(Boolean).join(',');
    return {
        fontFamily: `"${text.fontFamily}", system-ui, sans-serif`, fontSize: text.fontSize, fontWeight: text.fontWeight,
        lineHeight: text.lineHeight, color: text.color, textShadow: textShadow || undefined,
    };
}

const KEYFRAMES = `
@keyframes cht-in-slide { from { opacity: 0; transform: translateX(-36px); } to { opacity: 1; transform: none; } }
@keyframes cht-in-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cht-in-pop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: none; } }
@keyframes cht-out-fade { from { opacity: 1; } to { opacity: 0; } }
@keyframes cht-out-slide { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateX(36px); } }
`;

function itemStyle(item: FeedItem, config: ChatOverlayConfig): CSSProperties {
    const { theme, animations } = config;
    const base: CSSProperties = {
        background: item.msg.highlight ? theme.highlightColor : theme.messageBg,
        borderRadius: theme.messageRadius,
        padding: `${theme.messagePaddingY}px ${theme.messagePaddingX}px`,
        marginTop: theme.gap,
        border: theme.borderWidth > 0 ? `${theme.borderWidth}px solid ${theme.borderColor}` : undefined,
        flexShrink: 0,
        maxWidth: '100%',
    };
    const ms = animations.durationMs;
    if (item.leavingAt !== null && animations.exit !== 'none') {
        return { ...base, animation: `cht-out-${animations.exit} ${ms}ms ease forwards` };
    }
    if (animations.enter !== 'none' && ms > 0) {
        return { ...base, animation: `cht-in-${animations.enter} ${ms}ms ease both` };
    }
    return base;
}

/** El cuadro del chat tal como se ve en un lienzo de 1920×1080 */
/** `inline` lo deja sin posición propia, para ponerlo dentro del editor de arrastre */
export default function ChatBox({ items, config, inline = false }: { items: FeedItem[]; config: ChatOverlayConfig; inline?: boolean }) {
    const { layout, theme, display } = config;
    const ordered = display.direction === 'down' ? [...items].reverse() : items;

    return (
        <>
            <style>{KEYFRAMES}</style>
            <div
                style={{
                    ...(inline ? { position: 'relative' as const } : { position: 'absolute' as const, left: layout.x, top: layout.y }),
                    width: layout.width, height: layout.height,
                    boxSizing: 'border-box', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', justifyContent: display.direction === 'up' ? 'flex-end' : 'flex-start',
                    background: theme.containerBg, borderRadius: theme.containerRadius, padding: theme.containerPadding,
                    ...textStyle(config),
                }}
            >
                {ordered.map(item => (
                    <div key={item.msg.id} style={itemStyle(item, config)}>
                        <MessageView msg={item.msg} config={config} />
                    </div>
                ))}
            </div>
        </>
    );
}
