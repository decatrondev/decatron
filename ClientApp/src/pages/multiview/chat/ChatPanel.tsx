import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ShieldCheck } from 'lucide-react';
import { ChatLine } from './ChatLine';
import ChatComposer from './ChatComposer';
import type { ChatMsg, ModAction, SendResult } from './types';
import { useMultiviewChat } from './useMultiviewChat';
import type { Slot } from '../types';

const ALL = '*';
const OFFICIAL_SUFFIX = ':official';

export default function ChatPanel({ slots }: { slots: Slot[] }) {
    const { t } = useTranslation('multiview');
    const keys = useMemo(() => slots.map(s => s.id), [slots]);
    // Aparecer como conectado en los canales de Twitch abiertos: activo por defecto, se puede apagar.
    const [present, setPresent] = useState(() => { try { return localStorage.getItem('mv-present') !== '0'; } catch { return true; } });
    const changePresent = (v: boolean) => { setPresent(v); try { localStorage.setItem('mv-present', v ? '1' : '0'); } catch { /* sin almacenamiento */ } };
    const { messages, status, me, send, roles, moderate } = useMultiviewChat(keys, slots.length > 0, present);
    const [reply, setReply] = useState<ChatMsg | null>(null);
    const startReply = useCallback((m: ChatMsg) => setReply(m), []);
    const [notice, setNotice] = useState<{ ok: boolean; text: string; undo?: () => void; reauth?: 'twitch' | 'kick' } | null>(null);
    const noticeTimer = useRef<number | null>(null);
    const showNotice = (n: { ok: boolean; text: string; undo?: () => void; reauth?: 'twitch' | 'kick' }) => {
        setNotice(n);
        if (noticeTimer.current != null) window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setNotice(null), n.undo ? 12000 : 6000);
    };
    const modError = (r: SendResult, platform: 'twitch' | 'kick') => {
        const base = t(`chat.mod.err.${r.code ?? 'failed'}`, { defaultValue: t('chat.mod.err.failed') });
        showNotice({
            ok: false,
            text: r.detail && ['forbidden', 'failed'].includes(r.code ?? '') ? `${base} (${r.detail})` : base,
            reauth: r.code === 'reauth_mod' || r.code === 'reauth' ? platform : undefined,
        });
    };
    const doMod = useCallback(async (m: ChatMsg, action: ModAction, seconds?: number) => {
        const r = await moderate({ action, key: m.key, messageId: m.id, targetId: m.user.id, seconds: seconds ?? null });
        if (!r.ok) { modError(r, m.platform); return; }
        const who = m.user.name;
        if (action === 'delete') showNotice({ ok: true, text: t('chat.mod.done.delete') });
        else if (action === 'unban') showNotice({ ok: true, text: t('chat.mod.done.unban', { user: who }) });
        else showNotice({
            ok: true,
            text: t(action === 'ban' ? 'chat.mod.done.ban' : 'chat.mod.done.timeout', { user: who }),
            undo: async () => {
                const u = await moderate({ action: 'unban', key: m.key, targetId: m.user.id });
                if (u.ok) showNotice({ ok: true, text: t('chat.mod.done.unban', { user: who }) }); else modError(u, m.platform);
            },
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [moderate, t]);
    const loginUrl = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    // Por defecto se ve el chat OFICIAL de cada canal (es el que muestra el saldo de puntos y donde la extensión reclama los cofres) y
    // se abre en la pestaña del primer canal. La última elección (oficial o el de Decatron) queda como la de siempre.
    const [defaultOfficial, setDefaultOfficial] = useState(() => { try { return localStorage.getItem('mv-chat-mode') !== 'decatron'; } catch { return true; } });
    const [tab, setTab] = useState(() => (defaultOfficial && slots[0] ? slots[0].id : ALL));
    const picked = useRef(false);
    const pickTab = (id: string) => { picked.current = true; setTab(id); };
    useEffect(() => { if (!picked.current && defaultOfficial && tab === ALL && slots[0]) setTab(slots[0].id); }, [slots, defaultOfficial, tab]);
    // El chat oficial se recuerda por canal y, una vez abierto, el iframe queda montado (oculto) al cambiar de pestaña:
    // cerrarlo haría perder la sesión de Twitch, el saldo de puntos y el estado del chat cada vez. Con el oficial por defecto, los de
    // todos los canales de Twitch quedan montados desde el inicio (así se reclaman los cofres de todos, no solo del que se mira).
    const [officialBy, setOfficialBy] = useState<Record<string, boolean>>({});
    const [mounted, setMounted] = useState<string[]>([]);
    const isOfficial = (id: string) => officialBy[id] ?? defaultOfficial;
    const setOfficialFor = (id: string, on: boolean) => {
        setOfficialBy(prev => ({ ...prev, [id]: on }));
        setDefaultOfficial(on);
        try { localStorage.setItem('mv-chat-mode', on ? 'official' : 'decatron'); } catch { /* sin almacenamiento */ }
        if (on) setMounted(prev => (prev.includes(id) ? prev : [...prev, id]));
    };
    const list = useRef<HTMLDivElement>(null);
    const stick = useRef(true);
    const [unread, setUnread] = useState(0);

    // Si la pestaña elegida ya no existe (se quitó la casilla), se vuelve a «Todos».
    useEffect(() => { if (tab !== ALL && !keys.includes(tab)) { setTab(ALL); } }, [keys, tab]);
    // Al quitar una casilla se descarta su chat oficial
    useEffect(() => { setMounted(prev => (prev.every(id => keys.includes(id)) ? prev : prev.filter(id => keys.includes(id)))); }, [keys]);

    const shown = useMemo(() => (tab === ALL ? messages : messages.filter(m => m.key === tab)), [messages, tab]);

    useLayoutEffect(() => {
        const el = list.current;
        if (!el) return;
        if (stick.current) { el.scrollTop = el.scrollHeight; setUnread(0); }
        else setUnread(n => n + 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shown.length]);

    const onScroll = () => {
        const el = list.current;
        if (!el) return;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        if (stick.current) setUnread(0);
    };
    const toEnd = () => {
        const el = list.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        stick.current = true;
        setUnread(0);
    };

    const selected = slots.find(s => s.id === tab);
    const official = !!selected && isOfficial(selected.id);
    const officialUrlOf = (s: (typeof slots)[number]) => (s.platform === 'twitch'
        ? `https://www.twitch.tv/embed/${encodeURIComponent(s.channel)}/chat?parent=${window.location.hostname}&darkpopout`
        : `https://kick.com/popout/${encodeURIComponent(s.channel)}/chat`);
    const mountedSlots = slots.filter(s => mounted.includes(s.id) || isOfficial(s.id) || (s.platform === 'twitch' && defaultOfficial));

    const tabBtn = (active: boolean) => `flex-none whitespace-nowrap rounded px-2.5 py-1.5 text-[13px] font-semibold ${active ? 'bg-pub-accent text-white' : 'text-[#a1a1aa] hover:text-white'}`;

    return (
        <aside className="flex h-[70dvh] min-h-0 flex-col border-t border-pub-border bg-pub-surface md:h-auto md:w-[340px] md:flex-none md:border-l md:border-t-0 3xl:w-[420px] 4xl:w-[520px]" aria-label={t('chat.title')}>
            <div className="flex items-center gap-1 overflow-x-auto border-b border-pub-border p-1.5" role="tablist">
                <button role="tab" aria-selected={tab === ALL} className={tabBtn(tab === ALL)} onClick={() => pickTab(ALL)}>{t('chat.all')}</button>
                {slots.map(s => (
                    <button key={s.id} role="tab" aria-selected={tab === s.id} className={tabBtn(tab === s.id)} onClick={() => pickTab(s.id)} title={s.platform === 'twitch' ? 'Twitch' : 'Kick'}>
                        {s.channel}{roles[s.id] && <ShieldCheck className="ml-1 inline h-3.5 w-3.5 align-text-bottom" aria-label={t('chat.mod.youMod')} />}
                    </button>
                ))}
            </div>

            {selected && (
                <div className="flex items-center justify-between gap-2 border-b border-pub-border px-2 py-1 text-[12px] text-[#a1a1aa]">
                    <span className="truncate">{selected.platform === 'twitch' ? 'Twitch' : 'Kick'} · {selected.channel}{roles[selected.id] && <span className="ml-1.5 text-pub-accent-hi">· {t('chat.mod.youMod')}</span>}</span>
                    <div className="inline-flex rounded-md border border-pub-border p-0.5" role="group">
                        <button type="button" aria-pressed={!official} onClick={() => setOfficialFor(selected.id, false)} className={`rounded px-2 py-0.5 ${!official ? 'bg-pub-accent text-white' : 'hover:text-white'}`}>{t('chat.decatron')}</button>
                        <button type="button" aria-pressed={official} onClick={() => setOfficialFor(selected.id, true)} className={`rounded px-2 py-0.5 ${official ? 'bg-pub-accent text-white' : 'hover:text-white'}`} title={t('chat.officialHint')}>{t('chat.official')}</button>
                    </div>
                </div>
            )}

            {mountedSlots.length > 0 && (
                <div className={official ? 'relative min-h-0 flex-1' : 'hidden'}>
                    {mountedSlots.map(s => (
                        <iframe key={s.id + OFFICIAL_SUFFIX + s.channel} title={`${t('chat.official')} · ${s.channel}`} src={officialUrlOf(s)}
                            className={`absolute inset-0 h-full w-full border-0 ${s.id === tab ? '' : 'invisible'}`} />
                    ))}
                </div>
            )}
            {!official && (
                <div className="relative min-h-0 flex-1">
                    <div ref={list} onScroll={onScroll} className="absolute inset-0 overflow-y-auto overscroll-contain py-1">
                        {shown.length === 0 && (
                            <p className="px-4 py-8 text-center text-sm text-[#71717a]">{status === 'live' ? t('chat.waiting') : status === 'off' ? t('chat.off') : t('chat.connecting')}</p>
                        )}
                        {shown.map(m => <ChatLine key={m.key + m.id} msg={m} showChannel={tab === ALL && slots.length > 1} onReply={me.authenticated ? startReply : undefined} canMod={!!roles[m.key]} onMod={doMod} />)}
                    </div>
                    {notice && (
                        <div className={`absolute inset-x-2 bottom-2 z-20 flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] shadow-lg ${notice.ok ? 'border-pub-border bg-pub-raised text-[#d4d4d8]' : 'border-ds-danger/50 bg-pub-raised text-ds-danger'}`} role="status">
                            <span className="min-w-0 flex-1">{notice.text}</span>
                            {notice.undo && <button type="button" onClick={notice.undo} className="flex-none font-semibold text-pub-accent-hi underline">{t('chat.mod.undo')}</button>}
                            {notice.reauth && (
                                <a className="flex-none font-semibold text-pub-accent-hi underline"
                                    href={notice.reauth === 'twitch' ? `/api/auth/login?mod=1&redirect=${encodeURIComponent(window.location.pathname + window.location.search)}` : '/api/auth/kick/login'}>{t('chat.mod.authorize')}</a>
                            )}
                        </div>
                    )}
                    {unread > 0 && (
                        <button type="button" onClick={toEnd} className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-pub-accent px-3 py-1 text-xs font-bold text-white shadow-lg">
                            <ArrowDown className="h-3.5 w-3.5" />{t('chat.newMessages')}
                        </button>
                    )}
                    {status !== 'live' && shown.length > 0 && (
                        <p className="pointer-events-none absolute inset-x-0 top-0 bg-black/70 px-3 py-1 text-center text-xs text-ds-warn">{status === 'off' ? t('chat.off') : t('chat.reconnecting')}</p>
                    )}
                </div>
            )}

            {!official && (
                <ChatComposer
                    slots={slots} activeKey={tab === ALL ? null : tab} me={me} loginUrl={loginUrl}
                    present={present} onPresent={changePresent} reply={reply} onClearReply={() => setReply(null)} send={send}
                />
            )}
        </aside>
    );
}
