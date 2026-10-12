import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Send, X } from 'lucide-react';
import api from '../../../services/api';
import type { Slot } from '../types';
import type { ChatMsg, EmoteItem, MeInfo, SendResult } from './types';

const MAX = 500;
const emoteCache = new Map<string, EmoteItem[]>();

interface Props {
    slots: Slot[];
    /** Casilla elegida en las pestañas: es el destino por defecto. */
    activeKey: string | null;
    me: MeInfo;
    loginUrl: string;
    present: boolean;
    onPresent: (v: boolean) => void;
    reply: ChatMsg | null;
    onClearReply: () => void;
    send: (key: string, text: string, replyTo?: string | null) => Promise<SendResult>;
}

export default function ChatComposer({ slots, activeKey, me, loginUrl, present, onPresent, reply, onClearReply, send }: Props) {
    const { t } = useTranslation('multiview');
    const [target, setTarget] = useState<string>('');
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [emotes, setEmotes] = useState<EmoteItem[]>([]);
    const input = useRef<HTMLInputElement>(null);

    // Destino: al responder, el canal del mensaje; si no, la pestaña elegida; si no, el que ya estaba o el primero.
    useEffect(() => {
        if (reply && slots.some(s => s.id === reply.key)) { setTarget(reply.key); return; }
        if (activeKey && slots.some(s => s.id === activeKey)) { setTarget(activeKey); return; }
        setTarget(prev => (slots.some(s => s.id === prev) ? prev : slots[0]?.id ?? ''));
    }, [activeKey, slots, reply]);

    const slot = slots.find(s => s.id === target);
    const linked = slot ? (slot.platform === 'twitch' ? me.twitch : me.kick) : null;

    // Emotes del canal destino para autocompletar (7TV, BTTV, FFZ y los de Decatron); se piden una vez por canal.
    useEffect(() => {
        if (!slot || !me.authenticated) { setEmotes([]); return; }
        const cached = emoteCache.get(slot.id);
        if (cached) { setEmotes(cached); return; }
        let alive = true;
        const load = (attempt: number) => api.get('/public/multiview/emotes', { params: { key: slot.id } })
            .then(r => {
                if (!alive) return;
                if (r.data?.ready) { emoteCache.set(slot.id, r.data.items as EmoteItem[]); setEmotes(r.data.items as EmoteItem[]); }
                else if (attempt < 4) window.setTimeout(() => alive && load(attempt + 1), 3000);
            })
            .catch(() => { /* sin autocompletado */ });
        void load(0);
        return () => { alive = false; };
    }, [slot, me.authenticated]);

    const word = /(\S+)$/.exec(text)?.[1] ?? '';
    const suggestions = useMemo(() => {
        if (word.length < 2 || word.startsWith('@') || word.startsWith('!') || !emotes.length) return [];
        const w = word.toLowerCase();
        const starts = emotes.filter(e => e.name.toLowerCase().startsWith(w));
        const rest = emotes.filter(e => !e.name.toLowerCase().startsWith(w) && e.name.toLowerCase().includes(w));
        return starts.concat(rest).filter(e => e.name !== word).slice(0, 8);
    }, [word, emotes]);

    const errorText = (r: SendResult) => {
        const base = t(`chat.err.${r.code ?? 'failed'}`, { defaultValue: t('chat.err.failed') });
        return r.detail && ['forbidden', 'dropped', 'failed'].includes(r.code ?? '') ? `${base} (${r.detail})` : base;
    };

    const submit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const value = text.trim();
        if (!value || !slot || busy) return;
        setBusy(true);
        setError(null);
        const r = await send(slot.id, value, reply && reply.key === slot.id ? reply.id : null);
        setBusy(false);
        if (r.ok) { setText(''); onClearReply(); }
        else setError(errorText(r));
        input.current?.focus();
    };

    const complete = (name: string) => {
        setText(prev => prev.replace(/\S+$/, name) + ' ');
        input.current?.focus();
    };

    if (!me.authenticated) {
        return (
            <div className="border-t border-pub-border p-2 text-center text-[13px] text-[#a1a1aa]">
                <a href={loginUrl} className="font-semibold text-pub-accent-hi underline">{t('chat.loginToWrite')}</a>
            </div>
        );
    }

    return (
        <div className="relative border-t border-pub-border p-2">
            {suggestions.length > 0 && (
                <ul className="absolute inset-x-2 bottom-full mb-1 max-h-56 overflow-y-auto rounded-md border border-pub-border bg-pub-raised py-1 shadow-lg" role="listbox">
                    {suggestions.map(s => (
                        <li key={s.name}>
                            <button type="button" onMouseDown={ev => { ev.preventDefault(); complete(s.name); }} className="flex w-full items-center gap-2 px-3 py-1 text-left text-[13px] text-[#d4d4d8] hover:bg-white/10">
                                <img src={s.url} alt="" className="h-6 w-auto max-w-[3rem]" loading="lazy" />
                                <span className="truncate">{s.name}</span>
                                <span className="ml-auto text-[10px] uppercase text-[#71717a]">{s.provider}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {reply && (
                <div className="mb-1.5 flex items-center gap-1.5 rounded bg-white/5 px-2 py-1 text-[12px] text-[#a1a1aa]">
                    <span className="min-w-0 flex-1 truncate">{t('chat.replyingTo', { user: reply.user.name })}: {reply.parts.map(p => p.v ?? p.n ?? '').join('')}</span>
                    <button type="button" onClick={onClearReply} aria-label={t('chat.cancelReply')} className="flex-none text-[#a1a1aa] hover:text-white"><X className="h-3.5 w-3.5" /></button>
                </div>
            )}

            <form onSubmit={submit} className="flex items-center gap-1.5">
                {slots.length > 1 && (
                    <select value={target} onChange={e => setTarget(e.target.value)} aria-label={t('chat.target')} title={t('chat.target')}
                        className="h-9 max-w-[7.5rem] flex-none rounded-md border border-pub-border bg-pub-surface px-1.5 text-[12px] text-[#d4d4d8] focus:border-pub-accent/60 focus:outline-none [&>option]:bg-pub-raised">
                        {slots.map(s => <option key={s.id} value={s.id}>{s.channel}</option>)}
                    </select>
                )}
                <input
                    ref={input} value={text} onChange={e => setText(e.target.value.slice(0, MAX))} maxLength={MAX} disabled={!linked}
                    onKeyDown={e => { if (e.key === 'Tab' && suggestions.length > 0) { e.preventDefault(); complete(suggestions[0].name); } }}
                    placeholder={linked ? t('chat.placeholder', { channel: slot?.channel ?? '' }) : t('chat.notLinked', { platform: slot?.platform === 'kick' ? 'Kick' : 'Twitch' })}
                    aria-label={t('chat.placeholder', { channel: slot?.channel ?? '' })} autoComplete="off"
                    className="h-9 min-w-0 flex-1 rounded-md border border-pub-border bg-pub-surface px-3 text-[13px] text-[#d4d4d8] placeholder:text-[#71717a] focus:border-pub-accent/60 focus:outline-none disabled:opacity-60"
                />
                <button type="submit" disabled={!linked || busy || !text.trim()} aria-label={t('chat.send')} title={t('chat.send')}
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-pub-accent text-white hover:bg-pub-accent-hover disabled:opacity-50 disabled:hover:bg-pub-accent">
                    <Send className="h-4 w-4" />
                </button>
            </form>

            {error && <p className="mt-1.5 text-[12px] text-ds-danger" role="alert">{error}</p>}
            {!linked && slot && <p className="mt-1.5 text-[12px] text-[#a1a1aa]"><Link to="/settings" className="underline">{t('chat.linkAccount', { platform: slot.platform === 'kick' ? 'Kick' : 'Twitch' })}</Link></p>}

            <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[11px] text-[#71717a]" title={t('chat.presenceHint')}>
                <input type="checkbox" checked={present} onChange={e => onPresent(e.target.checked)} className="accent-[#3161d8]" />
                {t('chat.presence')}
            </label>
            {text.length > MAX - 60 && <p className="text-right text-[11px] text-[#71717a]">{text.length}/{MAX}</p>}
        </div>
    );
}
