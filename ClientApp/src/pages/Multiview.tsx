import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff, Check, Gauge, Keyboard, LayoutGrid, Link2, Maximize, MessageSquare, PanelLeft, Plus, Rows3, Tv2, X } from 'lucide-react';
import { BrandMark } from '../brand/BrandMark';
import { isTokenExpired } from '../utils/jwt';
import SlotFrame from './multiview/SlotFrame';
import ChatPanel from './multiview/chat/ChatPanel';
import LayoutsMenu from './multiview/LayoutsMenu';
import ShortcutsHelp from './multiview/ShortcutsHelp';
import { mvLines, mvLog } from './multiview/debug';
import { planLayout } from './multiview/layouts';
import { useKickStatus, useLiveAlerts, useSlotLimit, useStruggling } from './multiview/hooks';
import { useTranslationInfo } from './multiview/translation';
import {
    LAYOUTS, QUALITIES, parseChannelInput, pathFromSlots, slotKey, slotsFromPath,
    type LayoutId, type Platform, type QualityChoice, type Slot,
} from './multiview/types';

// Multi-view público (/multi): varios canales de Twitch y Kick en una sola pantalla. Fase 1 del plan
// .dev/plans/MULTIVIEW_PLAN.md: casillas, audio de una sola, calidad, layouts y límite por plan. Chat, escribir y
// moderar llegan en las fases siguientes.

const LAYOUT_ICON: Record<LayoutId, typeof LayoutGrid> = { grid: LayoutGrid, focus: PanelLeft, stack: Rows3 };
const field = 'h-9 rounded-md border border-pub-border bg-pub-surface px-3 text-sm text-[#d4d4d8] placeholder:text-[#71717a] focus:border-pub-accent/60 focus:outline-none';
const btn = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-accent-hi';
const btnPrimary = `${btn} bg-pub-accent font-bold text-white hover:bg-pub-accent-hover disabled:opacity-50 disabled:hover:bg-pub-accent`;
const btnGhost = `${btn} border border-pub-border text-[#d4d4d8] hover:border-pub-accent/60 hover:text-white`;

const readLayout = (search: string): LayoutId => {
    const l = new URLSearchParams(search).get('l');
    if (l && (LAYOUTS as string[]).includes(l)) return l as LayoutId;
    try { const saved = localStorage.getItem('mv-layout'); if (saved && (LAYOUTS as string[]).includes(saved)) return saved as LayoutId; } catch { /* sin almacenamiento */ }
    return 'grid';
};

export default function Multiview() {
    const { t } = useTranslation('multiview');
    const location = useLocation();
    const navigate = useNavigate();
    const { maxSlots, tier } = useSlotLimit();

    const urlSlots = useMemo(() => slotsFromPath(location.pathname), [location.pathname]);
    const layout = readLayout(location.search);
    const slots = useMemo(() => urlSlots.slice(0, maxSlots), [urlSlots, maxSlots]);
    const trimmed = urlSlots.length - slots.length;

    const [platform, setPlatform] = useState<Platform>('twitch');
    const [text, setText] = useState('');
    const [message, setMessage] = useState<{ tone: 'warn' | 'info'; text: string; upgrade?: boolean } | null>(null);
    const [audioId, setAudioId] = useState<string | null>(null);
    const [volumes, setVolumes] = useState<Record<string, number>>({});
    const [quality, setQuality] = useState<QualityChoice>('auto');
    const [liveMap, setLiveMap] = useState<Record<string, boolean>>({});
    const [dragId, setDragId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [unlocked, setUnlocked] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [notifyOn, setNotifyOn] = useState(() => { try { return localStorage.getItem('mv-notify') === '1'; } catch { return false; } });
    const addRef = useRef<HTMLInputElement>(null);
    const [chatOpen, setChatOpen] = useState(() => { try { return localStorage.getItem('mv-chat') !== '0'; } catch { return true; } });
    const toggleChat = () => setChatOpen(v => { try { localStorage.setItem('mv-chat', v ? '0' : '1'); } catch { /* sin almacenamiento */ } return !v; });
    const [debug] = useState(() => new URLSearchParams(window.location.search).has('debug'));
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!debug) return;
        const on = () => setTick(n => n + 1);
        window.addEventListener('mv-log', on);
        const vis = () => mvLog(`pestaña ${document.visibilityState}`);
        document.addEventListener('visibilitychange', vis);
        return () => { window.removeEventListener('mv-log', on); document.removeEventListener('visibilitychange', vis); };
    }, [debug]);
    const [struggling, resetStruggling] = useStruggling(slots.length >= 3 && quality !== '360' && quality !== '160');
    const kick = useKickStatus(slots);
    const trInfo = useTranslationInfo(slots);
    // Idioma de los subtítulos traducidos por casilla (cada una abre su propia conexión solo mientras tiene idioma).
    const [trLangs, setTrLangs] = useState<Record<string, string>>({});
    const setTrLang = (id: string, lang: string | null) =>
        setTrLangs(prev => { const next = { ...prev }; if (lang) next[id] = lang; else delete next[id]; return next; });
    const liveOf = useCallback((s: Slot): boolean | null =>
        s.platform === 'kick' ? (kick[s.channel]?.known ? kick[s.channel].live : null) : (liveMap[s.id] ?? null), [kick, liveMap]);
    const [liveAlerts, dismissAlert] = useLiveAlerts(slots, liveOf, notifyOn, ch => t('notify.live', { channel: ch }));

    // Avisos del navegador: se piden al activarlos (hace falta un clic y el permiso del navegador).
    const toggleNotify = async () => {
        if (notifyOn) { setNotifyOn(false); try { localStorage.setItem('mv-notify', '0'); } catch { /* sin almacenamiento */ } return; }
        let ok = false;
        try {
            if ('Notification' in window) ok = Notification.permission === 'granted' || (await Notification.requestPermission()) === 'granted';
        } catch { /* sin soporte */ }
        if (!ok) { setMessage({ tone: 'info', text: t('notify.denied') }); return; }
        setNotifyOn(true);
        try { localStorage.setItem('mv-notify', '1'); } catch { /* sin almacenamiento */ }
    };

    const loggedIn = (() => { try { const k = localStorage.getItem('token'); return !!k && !isTokenExpired(k, 60); } catch { return false; } })();

    // El primer clic o tecla en la página habilita el audio activo (las casillas sin audio pasan a volumen 0).
    useEffect(() => {
        if (unlocked) return;
        const on = () => setUnlocked(true);
        // Un clic dentro de un player (otro origen) no llega a la página, pero el foco pasa al iframe: la ventana
        // pierde el foco y el elemento activo es un IFRAME.
        const onBlur = () => window.setTimeout(() => { if (document.activeElement?.tagName === 'IFRAME') setUnlocked(true); }, 0);
        window.addEventListener('pointerdown', on, { once: true });
        window.addEventListener('keydown', on, { once: true });
        window.addEventListener('blur', onBlur);
        return () => { window.removeEventListener('pointerdown', on); window.removeEventListener('keydown', on); window.removeEventListener('blur', onBlur); };
    }, [unlocked]);

    useEffect(() => { document.title = slots.length ? `Multi-view · ${slots.map(s => s.channel).join(', ')}` : 'Multi-view'; }, [slots]);

    const go = useCallback((next: Slot[], nextLayout: LayoutId = layout) => {
        const params = new URLSearchParams();
        if (nextLayout !== 'grid') params.set('l', nextLayout);
        if (debug) params.set('debug', '1');
        const qs = params.toString() ? `?${params}` : '';
        navigate(pathFromSlots(next) + qs, { replace: true });
    }, [layout, navigate, debug]);

    const setLayout = (l: LayoutId) => {
        try { localStorage.setItem('mv-layout', l); } catch { /* sin almacenamiento */ }
        go(slots, l);
    };

    const add = (e?: React.FormEvent) => {
        e?.preventDefault();
        setMessage(null);
        const parsed = parseChannelInput(text, platform);
        if (!parsed) { setMessage({ tone: 'warn', text: t('add.invalid') }); return; }
        const key = slotKey(parsed.platform, parsed.channel);
        if (slots.some(s => s.id === key)) { setMessage({ tone: 'info', text: t('add.duplicate') }); return; }
        if (slots.length >= maxSlots) { setMessage({ tone: 'warn', text: t('add.limit', { max: maxSlots }), upgrade: true }); return; }
        go([...slots, { id: key, ...parsed }]);
        setText('');
    };

    // La extensión de Decatron (módulo Multi-view) pide agregar el canal que se está viendo en twitch.tv. Se agrega aquí mismo,
    // sin recargar (los videos no se cortan), y se le contesta qué pasó. Los datos viajan como texto JSON entre mundos.
    const latest = useRef({ slots, maxSlots, go });
    latest.current = { slots, maxSlots, go };
    useEffect(() => {
        const reply = (r: { mode: string; count?: number; max?: number }) => window.dispatchEvent(new CustomEvent('decatron-mv-result', { detail: JSON.stringify(r) }));
        const onAdd = (e: Event) => {
            let channel = '';
            try { channel = String(JSON.parse(String((e as CustomEvent).detail)).channel ?? ''); } catch { /* petición mal formada */ }
            const parsed = parseChannelInput(channel, 'twitch');
            if (!parsed) { reply({ mode: 'error' }); return; }
            const { slots: cur, maxSlots: max, go: nav } = latest.current;
            const key = slotKey(parsed.platform, parsed.channel);
            if (cur.some(x => x.id === key)) { reply({ mode: 'already', count: cur.length, max }); return; }
            if (cur.length >= max) { reply({ mode: 'limit', count: cur.length, max }); return; }
            nav([...cur, { id: key, ...parsed }]);
            reply({ mode: 'added', count: cur.length + 1, max });
        };
        window.addEventListener('decatron-mv-add', onAdd);
        return () => window.removeEventListener('decatron-mv-add', onAdd);
    }, []);

    const remove = (id: string) => {
        if (audioId === id) setAudioId(null);
        go(slots.filter(s => s.id !== id));
    };

    const makeMain = (id: string) => {
        const i = slots.findIndex(s => s.id === id);
        if (i <= 0) return;
        const next = [...slots];
        [next[0], next[i]] = [next[i], next[0]];
        go(next);
    };

    const dropOn = (targetId: string) => {
        if (!dragId || dragId === targetId) { setDragId(null); return; }
        const a = slots.findIndex(s => s.id === dragId);
        const b = slots.findIndex(s => s.id === targetId);
        setDragId(null);
        if (a < 0 || b < 0) return;
        const next = [...slots];
        [next[a], next[b]] = [next[b], next[a]];
        go(next);
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch { setMessage({ tone: 'info', text: window.location.href }); }
    };

    const fullscreenPage = () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => { /* no permitido */ });
    };

    // Atajos de teclado (no actúan mientras se escribe en un campo ni con Ctrl, Alt o Cmd).
    const keys = useRef({ slots, audioId, layout });
    keys.current = { slots, audioId, layout };
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const el = e.target as HTMLElement | null;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
            const { slots: sl, audioId: au, layout: ly } = keys.current;
            const k = e.key.toLowerCase();
            if (/^[1-9]$/.test(k)) { const slot = sl[Number(k) - 1]; if (slot) { e.preventDefault(); setAudioId(au === slot.id ? null : slot.id); } }
            else if (k === '0') setAudioId(null);
            else if (k === 'l') { const i = LAYOUTS.indexOf(ly); const next = LAYOUTS[(i + 1) % LAYOUTS.length]; try { localStorage.setItem('mv-layout', next); } catch { /* sin almacenamiento */ } go(sl, next); }
            else if (k === 'c') toggleChat();
            else if (k === 'f') fullscreenPage();
            else if (k === 'n') void toggleNotify();
            else if (k === 'a' || k === '/') { e.preventDefault(); addRef.current?.focus(); }
            else if (k === '?') setHelpOpen(v => !v);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [go, notifyOn]);

    const plan = useMemo(() => planLayout(layout, slots.length), [layout, slots.length]);
    const loginUrl = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;

    return (
        <div className="flex min-h-dvh flex-col bg-pub-bg text-[#d4d4d8] md:h-dvh">
            <header className="border-b border-pub-border bg-pub-bg/95">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
                    <a href="/" className="flex flex-none items-center gap-2 text-base font-black text-white hover:text-pub-accent-hi">
                        <BrandMark slot="public-nav" fallback={<><Tv2 className="h-5 w-5" /><span>Decatron</span></>} />
                    </a>
                    <span className="hidden font-mono text-xs uppercase tracking-widest text-pub-accent-hi/80 sm:inline"># {t('title')}</span>

                    <form onSubmit={add} className="order-last flex w-full items-center gap-2 sm:order-none sm:w-auto">
                        <div className="inline-flex rounded-md border border-pub-border p-0.5" role="group" aria-label={t('add.platform')}>
                            {(['twitch', 'kick'] as Platform[]).map(pf => (
                                <button
                                    key={pf} type="button" aria-pressed={platform === pf} onClick={() => setPlatform(pf)}
                                    className={`h-8 rounded px-2.5 text-sm font-semibold ${platform === pf ? 'bg-pub-accent text-white' : 'text-[#a1a1aa] hover:text-white'}`}
                                >{pf === 'twitch' ? 'Twitch' : 'Kick'}</button>
                            ))}
                        </div>
                        <input
                            ref={addRef} value={text} onChange={e => setText(e.target.value)} className={`${field} min-w-0 flex-1 sm:w-56 sm:flex-none`}
                            placeholder={t('add.placeholder')} aria-label={t('add.label')} autoComplete="off" spellCheck={false}
                        />
                        <button type="submit" className={btnPrimary} disabled={!text.trim()}><Plus className="h-4 w-4" />{t('add.button')}</button>
                    </form>

                    <span className="font-mono text-xs tabular-nums text-[#a1a1aa]" title={t('limit.hint', { tier })}>{slots.length}/{maxSlots}</span>

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-md border border-pub-border p-0.5" role="group" aria-label={t('layout.label')}>
                            {LAYOUTS.map(l => {
                                const Icon = LAYOUT_ICON[l];
                                return (
                                    <button key={l} type="button" aria-pressed={layout === l} onClick={() => setLayout(l)} title={t(`layout.${l}`)} aria-label={t(`layout.${l}`)}
                                        className={`flex h-8 w-8 items-center justify-center rounded ${layout === l ? 'bg-pub-accent text-white' : 'text-[#a1a1aa] hover:text-white'}`}>
                                        <Icon className="h-4 w-4" />
                                    </button>
                                );
                            })}
                        </div>
                        <label className="flex items-center gap-1.5 text-sm text-[#a1a1aa]">
                            <Gauge className="h-4 w-4" aria-hidden />
                            <span className="sr-only">{t('quality.label')}</span>
                            <select value={quality} onChange={e => { setQuality(e.target.value as QualityChoice); resetStruggling(); }} className={`${field} !px-2 [&>option]:bg-pub-raised`} title={t('quality.hint')}>
                                {QUALITIES.map(q => <option key={q} value={q}>{q === 'auto' ? t('quality.auto') : `${q}p`}</option>)}
                            </select>
                        </label>
                        <LayoutsMenu slots={slots} layout={layout} loggedIn={loggedIn} loginUrl={loginUrl} className={btnGhost}
                            onApply={(sl, ly) => { try { localStorage.setItem('mv-layout', ly); } catch { /* sin almacenamiento */ } go(sl.slice(0, maxSlots), ly); }} />
                        <button type="button" className={btnGhost} onClick={copyLink} disabled={!slots.length}>
                            {copied ? <Check className="h-4 w-4 text-ds-ok" /> : <Link2 className="h-4 w-4" />}{copied ? t('share.copied') : t('share.copy')}
                        </button>
                        <button type="button" className={`${btnGhost} !px-2.5 ${chatOpen ? '!border-pub-accent/60 !text-white' : ''}`} onClick={toggleChat} aria-pressed={chatOpen} aria-label={t('chat.toggle')} title={t('chat.toggle')}><MessageSquare className="h-4 w-4" /></button>
                        <button type="button" className={`${btnGhost} !px-2.5 ${notifyOn ? '!border-pub-accent/60 !text-white' : ''}`} onClick={() => void toggleNotify()} aria-pressed={notifyOn} aria-label={t('notify.toggle')} title={t('notify.toggle')}>
                            {notifyOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                        </button>
                        <button type="button" className={`${btnGhost} !px-2.5 hidden md:inline-flex`} onClick={() => setHelpOpen(true)} aria-label={t('shortcuts.button')} title={t('shortcuts.button')}><Keyboard className="h-4 w-4" /></button>
                        <button type="button" className={`${btnGhost} !px-2.5`} onClick={fullscreenPage} aria-label={t('fullscreen')} title={t('fullscreen')}><Maximize className="h-4 w-4" /></button>
                        {loggedIn
                            ? <Link to="/dashboard" className={btnGhost}>{t('account.panel')}</Link>
                            : <a href={loginUrl} className={btnGhost}>{t('account.login')}</a>}
                    </div>
                </div>

                {(message || trimmed > 0 || struggling) && (
                    <div className="space-y-1 px-3 pb-2 text-sm sm:px-4" role="status">
                        {message && (
                            <p className={message.tone === 'warn' ? 'text-ds-warn' : 'text-[#a1a1aa]'}>
                                {message.text}{' '}
                                {message.upgrade && <Link to="/supporters" className="font-semibold text-pub-accent-hi underline">{t('limit.upgrade')}</Link>}
                            </p>
                        )}
                        {trimmed > 0 && (
                            <p className="text-ds-warn">{t('limit.trimmed', { shown: slots.length, total: urlSlots.length, max: maxSlots })}{' '}
                                <Link to="/supporters" className="font-semibold text-pub-accent-hi underline">{t('limit.upgrade')}</Link></p>
                        )}
                        {struggling && (
                            <p className="flex flex-wrap items-center gap-2 text-ds-warn">
                                {t('perf.suggest')}
                                <button type="button" className={`${btnGhost} !h-7 !px-2`} onClick={() => { setQuality('360'); resetStruggling(); }}>{t('perf.apply')}</button>
                                <button type="button" className="text-[#a1a1aa] underline hover:text-white" onClick={resetStruggling}>{t('perf.dismiss')}</button>
                            </p>
                        )}
                    </div>
                )}
            </header>

            {slots.length === 0 ? (
                <main className="flex flex-1 items-center justify-center px-4 py-16">
                    <div className="max-w-xl text-center">
                        <Tv2 className="mx-auto mb-4 h-10 w-10 text-pub-accent-hi" aria-hidden />
                        <h1 className="text-2xl font-black text-white sm:text-3xl">{t('empty.title')}</h1>
                        <p className="mt-2 text-[#a1a1aa]">{t('empty.body', { max: maxSlots })}</p>
                        <p className="mt-4 font-mono text-xs text-[#71717a]">{t('empty.example')}</p>
                    </div>
                </main>
            ) : (
                <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
                <main
                    className={`grid gap-1 p-1 md:min-h-0 md:min-w-0 md:flex-1 md:[grid-template-columns:var(--mv-cols)] md:[grid-template-rows:var(--mv-rows)] ${layout === 'stack' ? 'md:mx-auto md:w-full md:max-w-5xl md:content-start md:overflow-y-auto' : ''}`}
                    style={plan.container}
                >
                    {slots.map((s, i) => (
                        <SlotFrame
                            key={s.id}
                            slot={s}
                            index={i}
                            style={plan.item(i)}
                            live={liveOf(s)}
                            viewers={s.platform === 'kick' ? kick[s.channel]?.viewers ?? null : null}
                            hasAudio={audioId === s.id}
                            volume={volumes[s.id] ?? 1}
                            quality={quality}
                            isMain={i === 0}
                            stack={layout === 'stack'}
                            unlocked={unlocked}
                            tr={s.platform === 'twitch' ? trInfo[s.channel] : undefined}
                            trLang={trLangs[s.id] ?? null}
                            onTrLang={lang => setTrLang(s.id, lang)}
                            dragging={dragId !== null && dragId !== s.id}
                            onAudio={() => setAudioId(audioId === s.id ? null : s.id)}
                            onVolume={v => setVolumes(prev => ({ ...prev, [s.id]: v }))}
                            onLive={live => setLiveMap(prev => (prev[s.id] === live ? prev : { ...prev, [s.id]: live }))}
                            onMakeMain={() => makeMain(s.id)}
                            onRemove={() => remove(s.id)}
                            onDragStart={() => setDragId(s.id)}
                            onDragEnd={() => setDragId(null)}
                            onDropOn={() => dropOn(s.id)}
                        />
                    ))}
                </main>
                {chatOpen && <ChatPanel slots={slots} />}
                </div>
            )}
            {liveAlerts.length > 0 && (
                <div className="pointer-events-none fixed bottom-4 left-4 z-40 flex flex-col gap-2" role="status" aria-live="polite">
                    {liveAlerts.map(a => (
                        <div key={a.id} className="pointer-events-auto flex items-center gap-2 rounded-md border border-pub-accent/50 bg-pub-raised px-3 py-2 text-sm text-white shadow-lg">
                            <span className="h-2 w-2 flex-none rounded-full bg-ds-danger" aria-hidden />
                            {t('notify.live', { channel: a.channel })}
                            <button type="button" onClick={() => dismissAlert(a.id)} aria-label={t('notify.close')} className="ml-1 text-[#a1a1aa] hover:text-white"><X className="h-3.5 w-3.5" /></button>
                        </div>
                    ))}
                </div>
            )}
            {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
            {debug && (
                <pre className="fixed bottom-2 left-2 z-50 max-h-60 max-w-[90vw] overflow-auto rounded-md bg-black/85 p-2 font-mono text-[11px] leading-snug text-[#d4d4d8]">
                    {mvLines().join('\n') || 'diagnóstico activo: esperando eventos'}
                </pre>
            )}
        </div>
    );
}
