import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bookmark, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { parseChannelInput, slotKey, type LayoutId, type Slot } from './types';

interface Saved { id: number; name: string; slots: string[]; layout: LayoutId; updatedAt: string }

interface Props {
    slots: Slot[];
    layout: LayoutId;
    loggedIn: boolean;
    loginUrl: string;
    onApply: (slots: Slot[], layout: LayoutId) => void;
    className: string;
}

const toSlots = (keys: string[]): Slot[] => keys.flatMap(k => {
    const p = parseChannelInput(k, 'twitch');
    return p ? [{ id: slotKey(p.platform, p.channel), ...p }] : [];
});

/** Layouts guardados en la cuenta: qué canales y qué distribución. Se guardan, se aplican y se borran desde aquí. */
export default function LayoutsMenu({ slots, layout, loggedIn, loginUrl, onApply, className }: Props) {
    const { t } = useTranslation('multiview');
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Saved[]>([]);
    const [max, setMax] = useState(0);
    const [name, setName] = useState('');
    const [msg, setMsg] = useState<{ tone: 'ok' | 'warn'; text: string; replaceId?: number; upgrade?: boolean } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const box = useRef<HTMLDivElement>(null);

    const load = useCallback(() => {
        api.get('/multiview/layouts')
            .then(r => { setItems(r.data.items as Saved[]); setMax(r.data.max as number); })
            .catch(() => setMsg({ tone: 'warn', text: t('layouts.error') }));
    }, [t]);

    useEffect(() => { if (open && loggedIn) load(); }, [open, loggedIn, load]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);

    const body = () => ({ name: name.trim(), slots: slots.map(s => s.id), layout });

    const save = async (replaceId?: number) => {
        setMsg(null);
        try {
            if (replaceId) await api.put(`/multiview/layouts/${replaceId}`, body());
            else await api.post('/multiview/layouts', body());
            setMsg({ tone: 'ok', text: t('layouts.saved', { name: name.trim() }) });
            setName('');
            load();
        } catch (e: unknown) {
            const res = (e as { response?: { status?: number; data?: { error?: string; id?: number; max?: number } } }).response;
            if (res?.status === 409) setMsg({ tone: 'warn', text: t('layouts.exists', { name: name.trim() }), replaceId: res.data?.id });
            else if (res?.status === 403) setMsg({ tone: 'warn', text: t('layouts.limit', { max: res.data?.max ?? max }), upgrade: true });
            else setMsg({ tone: 'warn', text: t('layouts.error') });
        }
    };

    const remove = async (id: number) => {
        setConfirmDelete(null);
        try { await api.delete(`/multiview/layouts/${id}`); load(); } catch { setMsg({ tone: 'warn', text: t('layouts.error') }); }
    };

    return (
        <div className="relative" ref={box}>
            <button type="button" className={`${className} !px-2.5 ${open ? '!border-pub-accent/60 !text-white' : ''}`} onClick={() => setOpen(v => !v)}
                aria-expanded={open} aria-haspopup="dialog" aria-label={t('layouts.title')} title={t('layouts.title')}>
                <Bookmark className="h-4 w-4" />
            </button>
            {open && (
                <div role="dialog" aria-label={t('layouts.title')} className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,92vw)] rounded-lg border border-pub-border bg-pub-raised p-3 shadow-xl">
                    <p className="mb-2 flex items-baseline justify-between text-sm font-bold text-white">
                        {t('layouts.title')}
                        {loggedIn && <span className="font-mono text-xs font-normal text-[#a1a1aa]">{items.length}/{max}</span>}
                    </p>

                    {!loggedIn ? (
                        <p className="text-sm text-[#a1a1aa]"><a href={loginUrl} className="font-semibold text-pub-accent-hi underline">{t('layouts.loginToSave')}</a></p>
                    ) : (
                        <>
                            <form onSubmit={e => { e.preventDefault(); if (name.trim() && slots.length) void save(); }} className="flex gap-1.5">
                                <input value={name} onChange={e => setName(e.target.value.slice(0, 60))} placeholder={t('layouts.name')} aria-label={t('layouts.name')}
                                    className="h-9 min-w-0 flex-1 rounded-md border border-pub-border bg-pub-surface px-3 text-sm text-[#d4d4d8] placeholder:text-[#71717a] focus:border-pub-accent/60 focus:outline-none" />
                                <button type="submit" disabled={!name.trim() || !slots.length} className="h-9 flex-none rounded-md bg-pub-accent px-3 text-sm font-bold text-white hover:bg-pub-accent-hover disabled:opacity-50 disabled:hover:bg-pub-accent">{t('layouts.save')}</button>
                            </form>
                            {!slots.length && <p className="mt-1.5 text-xs text-[#71717a]">{t('layouts.needChannels')}</p>}

                            {msg && (
                                <p className={`mt-2 text-xs ${msg.tone === 'ok' ? 'text-ds-ok' : 'text-ds-warn'}`} role="status">
                                    {msg.text}{' '}
                                    {msg.replaceId && <button type="button" onClick={() => void save(msg.replaceId)} className="font-semibold text-pub-accent-hi underline">{t('layouts.replace')}</button>}
                                    {msg.upgrade && <Link to="/supporters" className="font-semibold text-pub-accent-hi underline">{t('limit.upgrade')}</Link>}
                                </p>
                            )}

                            <ul className="mt-3 max-h-64 divide-y divide-pub-border overflow-y-auto">
                                {items.length === 0 && <li className="py-3 text-center text-sm text-[#71717a]">{t('layouts.empty')}</li>}
                                {items.map(l => (
                                    <li key={l.id} className="flex items-center gap-2 py-2">
                                        <button type="button" onClick={() => { onApply(toSlots(l.slots), l.layout); setOpen(false); }} className="min-w-0 flex-1 text-left" title={t('layouts.apply')}>
                                            <span className="block truncate text-sm font-semibold text-white">{l.name}</span>
                                            <span className="block truncate text-xs text-[#a1a1aa]">{l.slots.map(k => k.split(':')[1]).join(', ')}</span>
                                        </button>
                                        {confirmDelete === l.id ? (
                                            <>
                                                <button type="button" onClick={() => void remove(l.id)} className="rounded px-2 py-1 text-xs font-bold text-ds-danger hover:bg-white/10">{t('layouts.confirmDelete')}</button>
                                                <button type="button" onClick={() => setConfirmDelete(null)} className="rounded px-2 py-1 text-xs text-[#a1a1aa] hover:bg-white/10">{t('layouts.cancel')}</button>
                                            </>
                                        ) : (
                                            <button type="button" onClick={() => setConfirmDelete(l.id)} aria-label={t('layouts.delete', { name: l.name })} title={t('layouts.delete', { name: l.name })} className="flex-none rounded p-1.5 text-[#a1a1aa] hover:bg-white/10 hover:text-white">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
