import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, Coins, Loader2, LogOut, PauseCircle, PlayCircle, Save, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import api from '../../../services/api';
import type { AccessMode, AccessSettings, AccessView, ListenerRow } from './types';

const card = 'bg-ds-surface rounded-lg p-6 border border-ds-border';
const label = 'text-sm font-semibold text-ds-text';
const muted = 'text-sm text-ds-soft';
const input = 'w-full px-3 py-2 rounded-lg bg-ds-surface border border-ds-border text-ds-text text-sm';
const MODES: AccessMode[] = ['everyone', 'logged_in', 'followers', 'subscribers', 'vip', 'mods', 'list'];
const TWITCH_MODES: AccessMode[] = ['followers', 'subscribers', 'vip', 'mods'];

type Preset = 'recommended' | 'open' | 'strict';

/** Acceso y protección: topes de oyentes, idiomas a la vez y conexiones por IP, y el botón de pánico. */
export default function AccessTab({ canEdit, langNames }: { canEdit: boolean; langNames: Record<string, string> }) {
    const { t } = useTranslation('features');
    const [view, setView] = useState<AccessView | null>(null);
    const [form, setForm] = useState<AccessSettings | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

    const [listeners, setListeners] = useState<ListenerRow[]>([]);

    const apply = (v: AccessView) => { setView(v); setForm(v.settings); };

    const load = useCallback(async () => {
        try { apply((await api.get('/live-translation/access')).data as AccessView); }
        catch { setMessage({ text: t('liveTranslation.access.loadError'), error: true }); }
    }, [t]);
    useEffect(() => { void load(); }, [load]);

    // Quién escucha ahora, cada 5 s
    useEffect(() => {
        const id = window.setInterval(async () => {
            try {
                const v = (await api.get('/live-translation/access')).data as AccessView;
                setView(prev => prev ? { ...prev, now: v.now, abuse: v.abuse } : v);
                setListeners(((await api.get('/live-translation/access/listeners')).data as { listeners: ListenerRow[] }).listeners);
            } catch { /* sin cambios */ }
        }, 5000);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        void api.get('/live-translation/access/listeners').then(r => setListeners((r.data as { listeners: ListenerRow[] }).listeners)).catch(() => undefined);
    }, []);

    if (!view || !form) return <div className="text-center py-8 text-ds-soft">{message?.text ?? t('liveTranslation.loading')}</div>;

    const c = view.ceilings;
    const set = (patch: Partial<AccessSettings>) => setForm(prev => prev ? { ...prev, ...patch } : prev);

    // Un nivel que se comprueba con Twitch solo está disponible si hay Twitch vinculado y el token del streamer tiene el permiso
    const available = (m: AccessMode) => !TWITCH_MODES.includes(m) || (view.levels.hasTwitch && view.levels.tokenValid && (view.levels.missing[m]?.length ?? 1) === 0);

    const preset = (p: Preset) => {
        // Recomendado: seguidores desde hace 7 días si se puede comprobar; si no, queda abierto con los topes puestos
        if (p === 'recommended') set({ maxListenersTotal: null, maxListenersPerLanguage: null, maxActiveLanguages: Math.min(2, c.maxLanguages), maxConnectionsPerIp: 3, mode: available('followers') ? 'followers' : 'everyone', minFollowDays: 7 });
        if (p === 'open') set({ maxListenersTotal: c.maxListeners, maxListenersPerLanguage: null, maxActiveLanguages: c.maxLanguages, maxConnectionsPerIp: 5, mode: 'everyone' });
        // Estricto: la mitad del valor recomendado de tu plan (máximo 20), un idioma a la vez y 2 conexiones por IP
        if (p === 'strict') set({ maxListenersTotal: Math.max(1, Math.min(20, Math.floor(c.defaultListeners / 2))), maxListenersPerLanguage: null, maxActiveLanguages: 1, maxConnectionsPerIp: 2, mode: available('subscribers') ? 'subscribers' : available('followers') ? 'followers' : 'logged_in', minFollowDays: 30, minSubTier: 1 });
    };

    const save = async (next: AccessSettings = form) => {
        setSaving(true); setMessage(null);
        try { apply((await api.put('/live-translation/access', next)).data as AccessView); setMessage({ text: t('liveTranslation.access.saved') }); }
        catch (e: unknown) {
            const data = (e as { response?: { data?: { error?: string } } }).response?.data;
            setMessage({ text: data?.error === 'unavailable' ? t('liveTranslation.access.who.unavailableSave') : t('liveTranslation.access.saveError'), error: true });
        }
        finally { setSaving(false); }
    };

    const togglePause = async () => {
        const pausing = !form.paused;
        if (pausing && !window.confirm(t('liveTranslation.access.pauseConfirm'))) return;
        await save({ ...form, paused: pausing });
    };

    const kick = async (row: ListenerRow, ban: boolean) => {
        if (ban && !window.confirm(t(row.login ? 'liveTranslation.access.live.blockConfirm' : 'liveTranslation.access.live.banConfirm', { who: row.login ?? row.ip }))) return;
        try {
            await api.post('/live-translation/access/kick', { id: row.id, ban });
            setListeners(prev => prev.filter(x => x.id !== row.id));
            if (ban && row.login) await load();
        } catch { setMessage({ text: t('liveTranslation.access.live.error'), error: true }); }
    };

    const clearAbuse = async () => {
        try { await api.post('/live-translation/access/abuse/clear'); setView(prev => prev ? { ...prev, abuse: null } : prev); }
        catch { setMessage({ text: t('liveTranslation.access.live.error'), error: true }); }
    };

    const minutesAgo = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    const fmt = (n: number) => n.toLocaleString();
    const hours = (credits: number | null) => (credits && view.cost.perSpeechHour ? Math.round((credits / view.cost.perSpeechHour) * 10) / 10 : null);

    const num = (v: number | null) => (v == null ? '' : String(v));
    const parse = (s: string) => (s.trim() === '' ? null : Math.max(1, Math.floor(Number(s) || 1)));

    return (
        <div className="space-y-6">
            {message && <div className={`p-3 rounded-lg text-sm ${message.error ? 'bg-ds-danger/10 text-ds-danger' : 'bg-ds-ok/10 text-ds-ok'}`}>{message.text}</div>}

            {form.paused && (
                <div className="p-4 rounded-lg bg-ds-warn/10 border border-ds-warn/40 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="font-black text-ds-warn">{t('liveTranslation.access.pausedTitle')}</div>
                        <p className={muted}>{t('liveTranslation.access.pausedBody')}</p>
                    </div>
                    {canEdit && <button type="button" onClick={() => void togglePause()} className="ds-btn ds-btn--primary"><PlayCircle className="w-4 h-4" /> {t('liveTranslation.access.resume')}</button>}
                </div>
            )}

            {view.abuse && (
                <div className="p-4 rounded-lg bg-ds-warn/10 border border-ds-warn/40 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="font-black text-ds-warn flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> {t('liveTranslation.access.abuse.title')}</div>
                        <p className={muted}>{t(`liveTranslation.access.abuse.body_${view.abuse.reason}`, { attempts: view.abuse.attempts, rejections: view.abuse.rejections, minutes: Math.max(1, Math.ceil((new Date(view.abuse.until).getTime() - Date.now()) / 60000)) })}</p>
                    </div>
                    {canEdit && <button type="button" onClick={() => void clearAbuse()} className="ds-btn ds-btn--secondary">{t('liveTranslation.access.abuse.undo')}</button>}
                </div>
            )}

            <div className={card}>
                <h2 className="text-xl font-black text-ds-text">{t('liveTranslation.access.who.title')}</h2>
                <p className={`${muted} mb-4`}>{t('liveTranslation.access.who.subtitle')}</p>

                <div className="grid gap-2" role="radiogroup" aria-label={t('liveTranslation.access.who.title')}>
                    {MODES.map(m => {
                        const ok = available(m);
                        const selected = form.mode === m;
                        return (
                            <label key={m} className={`flex items-start gap-3 rounded-lg border p-3 ${selected ? 'border-ds-accent bg-ds-accent/5' : 'border-ds-border'} ${ok && canEdit ? 'cursor-pointer' : 'opacity-60'}`}>
                                <input type="radio" name="lt-mode" className="mt-1 accent-ds-accent" checked={selected} disabled={!ok || !canEdit} onChange={() => set({ mode: m })} />
                                <span className="min-w-0 flex-1">
                                    <span className={label}>{t(`liveTranslation.access.who.mode.${m}`)}</span>
                                    <span className={`${muted} block`}>{t(`liveTranslation.access.who.modeHint.${m}`)}</span>
                                    {!ok && TWITCH_MODES.includes(m) && (
                                        <span className="mt-1 block text-sm text-ds-warn">
                                            {!view.levels.hasTwitch
                                                ? t('liveTranslation.access.who.noTwitch')
                                                : t('liveTranslation.access.who.missing', { scopes: (view.levels.missing[m] ?? []).join(', ') })}
                                            {view.levels.hasTwitch && (
                                                <> <a className="underline" href={`/api/auth/login?redirect=${encodeURIComponent('/features/live-translation')}`}>{t('liveTranslation.access.who.reauth')}</a></>
                                            )}
                                        </span>
                                    )}
                                </span>
                            </label>
                        );
                    })}
                </div>

                {(form.mode === 'followers' || form.mode === 'subscribers') && (
                    <div className="mt-4 grid md:grid-cols-2 gap-6">
                        {form.mode === 'followers' && (
                            <label className="block">
                                <span className={label}>{t('liveTranslation.access.who.days')}</span>
                                <p className={`${muted} mb-2`}>{t('liveTranslation.access.who.daysHint')}</p>
                                <input type="number" min={0} max={365} className={input} disabled={!canEdit} value={form.minFollowDays}
                                       onChange={e => set({ minFollowDays: Math.max(0, Math.min(365, Math.floor(Number(e.target.value) || 0))) })} />
                            </label>
                        )}
                        {form.mode === 'subscribers' && (
                            <label className="block">
                                <span className={label}>{t('liveTranslation.access.who.tier')}</span>
                                <p className={`${muted} mb-2`}>{t('liveTranslation.access.who.tierHint')}</p>
                                <select className={input} disabled={!canEdit} value={form.minSubTier} onChange={e => set({ minSubTier: Number(e.target.value) })}>
                                    {[1, 2, 3].map(n => <option key={n} value={n}>{t('liveTranslation.access.who.tierN', { n })}</option>)}
                                </select>
                            </label>
                        )}
                    </div>
                )}

                <div className="mt-6 grid md:grid-cols-2 gap-6">
                    <label className="block">
                        <span className={label}>{t('liveTranslation.access.who.allow')}</span>
                        <p className={`${muted} mb-2`}>{t('liveTranslation.access.who.allowHint')}</p>
                        <textarea className={`${input} h-28 font-mono`} disabled={!canEdit} value={form.allowList} spellCheck={false}
                                  placeholder={t('liveTranslation.access.who.listPlaceholder')} onChange={e => set({ allowList: e.target.value })} />
                    </label>
                    <label className="block">
                        <span className={label}>{t('liveTranslation.access.who.block')}</span>
                        <p className={`${muted} mb-2`}>{t('liveTranslation.access.who.blockHint')}</p>
                        <textarea className={`${input} h-28 font-mono`} disabled={!canEdit} value={form.blockList} spellCheck={false}
                                  placeholder={t('liveTranslation.access.who.listPlaceholder')} onChange={e => set({ blockList: e.target.value })} />
                    </label>
                </div>
            </div>

            <div className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                        <h2 className="text-xl font-black text-ds-text">{t('liveTranslation.access.title')}</h2>
                        <p className={muted}>{t('liveTranslation.access.subtitle')}</p>
                    </div>
                    {canEdit && (
                        <div className="flex flex-wrap gap-2" role="group" aria-label={t('liveTranslation.access.presets')}>
                            {(['recommended', 'open', 'strict'] as Preset[]).map(p => (
                                <button key={p} type="button" onClick={() => preset(p)} className="ds-btn ds-btn--secondary ds-btn--sm" title={t(`liveTranslation.access.preset.${p}Hint`)}>
                                    {t(`liveTranslation.access.preset.${p}`)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <label className="block">
                        <span className={label}>{t('liveTranslation.access.total')}</span>
                        <p className={`${muted} mb-2`}>{t('liveTranslation.access.totalHint', { max: c.maxListeners, def: c.defaultListeners })}</p>
                        <input type="number" min={1} max={c.maxListeners} className={input} disabled={!canEdit} value={num(form.maxListenersTotal)} placeholder={String(c.defaultListeners)}
                               onChange={e => set({ maxListenersTotal: parse(e.target.value) })} />
                    </label>
                    <label className="block">
                        <span className={label}>{t('liveTranslation.access.perLanguage')}</span>
                        <p className={`${muted} mb-2`}>{t('liveTranslation.access.perLanguageHint')}</p>
                        <input type="number" min={1} max={c.maxListeners} className={input} disabled={!canEdit} value={num(form.maxListenersPerLanguage)} placeholder={t('liveTranslation.access.sameAsTotal')}
                               onChange={e => set({ maxListenersPerLanguage: parse(e.target.value) })} />
                    </label>
                    <label className="block">
                        <span className={label}>{t('liveTranslation.access.languages')}</span>
                        <p className={`${muted} mb-2`}>{t('liveTranslation.access.languagesHint')}</p>
                        <select className={input} disabled={!canEdit} value={form.maxActiveLanguages} onChange={e => set({ maxActiveLanguages: Number(e.target.value) })}>
                            {Array.from({ length: c.maxLanguages }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className={label}>{t('liveTranslation.access.perIp')}</span>
                        <p className={`${muted} mb-2`}>{t('liveTranslation.access.perIpHint')}</p>
                        <select className={input} disabled={!canEdit} value={form.maxConnectionsPerIp} onChange={e => set({ maxConnectionsPerIp: Number(e.target.value) })}>
                            {Array.from({ length: c.maxConnectionsPerIp }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                </div>

                <div className="mt-6 pt-6 border-t border-ds-border">
                    <label className="block max-w-xl">
                        <span className={`${label} flex items-center gap-2`}><Coins className="w-4 h-4 text-ds-accent-text" /> {t('liveTranslation.access.budget.title')}</span>
                        <p className={`${muted} mb-2`}>{t('liveTranslation.access.budget.hint')}</p>
                        <input className={input} type="number" min={1} inputMode="numeric" disabled={!canEdit} placeholder={t('liveTranslation.access.budget.none')}
                            value={form.creditBudgetPerSession ?? ''} onChange={e => set({ creditBudgetPerSession: e.target.value.trim() === '' ? null : Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
                    </label>
                    <p className={`${muted} mt-2`}>
                        {view.cost.perSpeechHour
                            ? t('liveTranslation.access.budget.cost', { perHour: fmt(view.cost.perSpeechHour), sessions: view.cost.sessions })
                            : t('liveTranslation.access.budget.noCost')}
                        {hours(form.creditBudgetPerSession) != null && ` ${t('liveTranslation.access.budget.equals', { hours: hours(form.creditBudgetPerSession) })}`}
                    </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <p className={muted}>{t('liveTranslation.access.effective', { total: view.effective.maxListenersTotal, languages: view.effective.maxActiveLanguages, ip: view.effective.maxConnectionsPerIp })}</p>
                    {canEdit && (
                        <button type="button" onClick={() => void save()} disabled={saving} className="px-4 py-2 rounded-lg bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent font-semibold flex items-center gap-2 disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('liveTranslation.save')}
                        </button>
                    )}
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className={card}>
                    <h3 className="font-black text-ds-text flex items-center gap-2 mb-2"><Users className="w-5 h-5 text-ds-accent-text" /> {t('liveTranslation.access.nowTitle')}</h3>
                    {view.now.listeners === 0
                        ? <p className={muted}>{t('liveTranslation.access.nowEmpty')}</p>
                        : (
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(view.now.byLanguage).map(([l, n]) => (
                                    <span key={l} className="px-3 py-1 rounded-full text-xs font-semibold bg-ds-accent/15 text-ds-accent-text">{langNames[l] || l.toUpperCase()} · {n}</span>
                                ))}
                            </div>
                        )}
                </div>

                <div className={card}>
                    <h3 className="font-black text-ds-text flex items-center gap-2 mb-2"><ShieldCheck className="w-5 h-5 text-ds-accent-text" /> {t('liveTranslation.access.alwaysTitle')}</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-ds-text">
                        <li>{t('liveTranslation.access.always1')}</li>
                        <li>{t('liveTranslation.access.always2')}</li>
                        <li>{t('liveTranslation.access.always3')}</li>
                    </ul>
                </div>
            </div>

            <div className={card}>
                <h3 className="font-black text-ds-text flex items-center gap-2 mb-1"><Users className="w-5 h-5 text-ds-accent-text" /> {t('liveTranslation.access.live.title')}</h3>
                <p className={`${muted} mb-3`}>{t('liveTranslation.access.live.hint')}</p>
                {listeners.length === 0
                    ? <p className={muted}>{t('liveTranslation.access.nowEmpty')}</p>
                    : (
                        <ul className="divide-y divide-ds-border">
                            {listeners.map(row => (
                                <li key={row.id} className="py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                                    <span className="min-w-0 flex-1 text-sm text-ds-text truncate">
                                        <span className="font-semibold">{row.login ?? t('liveTranslation.access.live.anonymous')}</span>
                                        <span className="text-ds-soft"> · {langNames[row.lang] || row.lang.toUpperCase()} · {row.ip} · {t('liveTranslation.access.live.since', { minutes: minutesAgo(row.since) })}</span>
                                    </span>
                                    {canEdit && (
                                        <span className="flex gap-2">
                                            <button type="button" onClick={() => void kick(row, false)} className="ds-btn ds-btn--secondary"><LogOut className="w-4 h-4" /> {t('liveTranslation.access.live.kick')}</button>
                                            <button type="button" onClick={() => void kick(row, true)} className="ds-btn ds-btn--danger"><Ban className="w-4 h-4" /> {t(row.login ? 'liveTranslation.access.live.block' : 'liveTranslation.access.live.banIp')}</button>
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
            </div>

            {canEdit && !form.paused && (
                <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
                    <div>
                        <h3 className="font-black text-ds-text flex items-center gap-2"><PauseCircle className="w-5 h-5 text-ds-danger" /> {t('liveTranslation.access.panicTitle')}</h3>
                        <p className={muted}>{t('liveTranslation.access.panicBody')}</p>
                    </div>
                    <button type="button" onClick={() => void togglePause()} className="ds-btn ds-btn--danger"><PauseCircle className="w-4 h-4" /> {t('liveTranslation.access.pause')}</button>
                </div>
            )}
        </div>
    );
}
