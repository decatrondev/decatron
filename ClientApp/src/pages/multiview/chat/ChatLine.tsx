import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, Clock, CornerDownRight, Reply, Trash2 } from 'lucide-react';
import type { ChatMsg, ModAction } from './types';

// Los colores de usuario muy oscuros (azul puro, negro) no se leen sobre el fondo del panel: se aclaran.
function readable(color?: string): string | undefined {
    const m = color?.match(/^#([0-9a-f]{6})$/i);
    if (!m) return undefined;
    const n = parseInt(m[1], 16);
    let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (lum < 0.35) { const k = 0.55; r = Math.round(r + (255 - r) * k); g = Math.round(g + (255 - g) * k); b = Math.round(b + (255 - b) * k); }
    return `rgb(${r} ${g} ${b})`;
}

const STAFF = new Set(['broadcaster', 'moderator', 'lead_moderator', 'staff', 'admin', 'global_mod']);
// A quien ya modera (o es dueño del canal) no se le pueden dar timeout ni ban desde aquí: la plataforma lo rechaza.
const isStaff = (m: ChatMsg) => m.badges.some(b => STAFF.has(b.id.split('/')[0].toLowerCase()) || (b.kick != null && STAFF.has(b.kick.toLowerCase())));
const TIMEOUTS = [60, 600, 3600, 86400];

interface Props {
    msg: ChatMsg;
    showChannel: boolean;
    onReply?: (m: ChatMsg) => void;
    /** Quien mira puede moderar el canal de este mensaje */
    canMod?: boolean;
    onMod?: (m: ChatMsg, action: ModAction, seconds?: number) => void;
}

function ChatLineBase({ msg, showChannel, onReply, canMod, onMod }: Props) {
    const { t } = useTranslation('multiview');
    const [menu, setMenu] = useState<'timeout' | 'ban' | null>(null);
    const staff = isStaff(msg);
    const mod = canMod && onMod && !msg.deleted;
    const run = (a: ModAction, seconds?: number) => { setMenu(null); onMod?.(msg, a, seconds); };
    return (
        <div className={`group/line relative px-3 py-0.5 text-[13px] leading-[1.45] hover:bg-white/[0.04] 3xl:text-[15px] ${msg.highlight ? 'bg-pub-accent/15' : ''}`} data-msg>
            {(onReply || mod) && !msg.deleted && (
                <div className={`absolute right-2 top-0.5 z-10 items-center gap-0.5 rounded bg-pub-surface p-0.5 shadow ${menu ? 'flex' : 'hidden group-hover/line:flex group-focus-within/line:flex'}`}>
                    {onReply && (
                        <button type="button" onClick={() => onReply(msg)} aria-label={t('chat.reply')} title={t('chat.reply')} className="rounded p-1 text-[#a1a1aa] hover:text-white">
                            <Reply className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {mod && (
                        <>
                            <button type="button" onClick={() => run('delete')} aria-label={t('chat.mod.delete')} title={t('chat.mod.delete')} className="rounded p-1 text-[#a1a1aa] hover:text-white">
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            {!staff && (
                                <>
                                    <button type="button" onClick={() => setMenu(menu === 'timeout' ? null : 'timeout')} aria-expanded={menu === 'timeout'} aria-label={t('chat.mod.timeout')} title={t('chat.mod.timeout')} className="rounded p-1 text-[#a1a1aa] hover:text-white">
                                        <Clock className="h-3.5 w-3.5" />
                                    </button>
                                    <button type="button" onClick={() => setMenu(menu === 'ban' ? null : 'ban')} aria-expanded={menu === 'ban'} aria-label={t('chat.mod.ban')} title={t('chat.mod.ban')} className="rounded p-1 text-ds-danger hover:text-white">
                                        <Ban className="h-3.5 w-3.5" />
                                    </button>
                                </>
                            )}
                        </>
                    )}
                    {menu && (
                        <div className="absolute right-0 top-full mt-1 min-w-[9rem] rounded-md border border-pub-border bg-pub-raised py-1 text-[12px] shadow-lg" role="menu">
                            {menu === 'timeout' && TIMEOUTS.map(sec => (
                                <button key={sec} type="button" role="menuitem" onClick={() => run('timeout', sec)} className="block w-full px-3 py-1 text-left text-[#d4d4d8] hover:bg-white/10">{t(`chat.mod.t${sec}`)}</button>
                            ))}
                            {menu === 'ban' && (
                                <>
                                    <p className="px-3 py-1 text-[#a1a1aa]">{t('chat.mod.banAsk', { user: msg.user.name })}</p>
                                    <button type="button" role="menuitem" onClick={() => run('ban')} className="block w-full px-3 py-1 text-left font-semibold text-ds-danger hover:bg-white/10">{t('chat.mod.banConfirm')}</button>
                                    <button type="button" role="menuitem" onClick={() => setMenu(null)} className="block w-full px-3 py-1 text-left text-[#a1a1aa] hover:bg-white/10">{t('chat.mod.cancel')}</button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
            {msg.reply && (
                <div className="flex min-w-0 items-center gap-1 text-[11px] text-[#71717a] 3xl:text-[12px]">
                    <CornerDownRight className="h-3 w-3 flex-none" aria-hidden />
                    <span className="truncate">@{msg.reply.user}: {msg.reply.text}</span>
                </div>
            )}
            <div className="break-words">
                {showChannel && (
                    <span className="mr-1.5 rounded border border-pub-border px-1 py-px font-mono text-[10px] uppercase text-[#a1a1aa]" title={msg.platform === 'twitch' ? 'Twitch' : 'Kick'}>
                        {msg.channel.login}
                    </span>
                )}
                {msg.badges.map(b => b.url
                    ? <img key={b.id} src={b.url} alt={b.title ?? b.id} title={b.title ?? b.id} className="mr-1 inline-block h-[1.15em] w-[1.15em] align-text-bottom" loading="lazy" />
                    : <span key={b.id} className="mr-1 rounded bg-white/10 px-1 text-[10px] font-bold uppercase text-[#d4d4d8]" title={b.title}>{(b.kick ?? b.id).slice(0, 4)}</span>)}
                <span className="font-bold" style={{ color: readable(msg.user.color) ?? '#d4d4d8' }}>{msg.user.name}</span>
                <span className="text-[#a1a1aa]">: </span>
                {msg.deleted
                    ? <span className="italic text-[#71717a]">{t('chat.deleted')}</span>
                    : msg.parts.map((p, i) => p.t === 'text'
                        ? <span key={i} className="text-[#e4e4e7]">{p.v}</span>
                        : <img key={i} src={p.u} alt={p.n} title={p.n} className="mx-0.5 inline-block h-[1.9em] w-auto max-w-[8em] align-middle" loading="lazy" />)}
            </div>
        </div>
    );
}

export const ChatLine = memo(ChatLineBase);
