import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, PauseCircle, PlayCircle, Save, ShieldCheck, Users } from 'lucide-react';
import api from '../../../services/api';
import type { AccessSettings, AccessView } from './types';

const card = 'bg-ds-surface rounded-lg p-6 border border-ds-border';
const label = 'text-sm font-semibold text-ds-text';
const muted = 'text-sm text-ds-soft';
const input = 'w-full px-3 py-2 rounded-lg bg-ds-surface border border-ds-border text-ds-text text-sm';

type Preset = 'recommended' | 'open' | 'strict';

/** Acceso y protección: topes de oyentes, idiomas a la vez y conexiones por IP, y el botón de pánico. */
export default function AccessTab({ canEdit, langNames }: { canEdit: boolean; langNames: Record<string, string> }) {
    const { t } = useTranslation('features');
    const [view, setView] = useState<AccessView | null>(null);
    const [form, setForm] = useState<AccessSettings | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

    const apply = (v: AccessView) => { setView(v); setForm(v.settings); };

    const load = useCallback(async () => {
        try { apply((await api.get('/live-translation/access')).data as AccessView); }
        catch { setMessage({ text: t('liveTranslation.access.loadError'), error: true }); }
    }, [t]);
    useEffect(() => { void load(); }, [load]);

    // Quién escucha ahora, cada 5 s
    useEffect(() => {
        const id = window.setInterval(async () => {
            try { const v = (await api.get('/live-translation/access')).data as AccessView; setView(prev => prev ? { ...prev, now: v.now } : v); } catch { /* sin cambios */ }
        }, 5000);
        return () => window.clearInterval(id);
    }, []);

    if (!view || !form) return <div className="text-center py-8 text-ds-soft">{message?.text ?? t('liveTranslation.loading')}</div>;

    const c = view.ceilings;
    const set = (patch: Partial<AccessSettings>) => setForm(prev => prev ? { ...prev, ...patch } : prev);

    const preset = (p: Preset) => {
        if (p === 'recommended') set({ maxListenersTotal: null, maxListenersPerLanguage: null, maxActiveLanguages: Math.min(2, c.maxLanguages), maxConnectionsPerIp: 3 });
        if (p === 'open') set({ maxListenersTotal: c.maxListeners, maxListenersPerLanguage: null, maxActiveLanguages: c.maxLanguages, maxConnectionsPerIp: 5 });
        // Estricto: la mitad del valor recomendado de tu plan (máximo 20), un idioma a la vez y 2 conexiones por IP
        if (p === 'strict') set({ maxListenersTotal: Math.max(1, Math.min(20, Math.floor(c.defaultListeners / 2))), maxListenersPerLanguage: null, maxActiveLanguages: 1, maxConnectionsPerIp: 2 });
    };

    const save = async (next: AccessSettings = form) => {
        setSaving(true); setMessage(null);
        try { apply((await api.put('/live-translation/access', next)).data as AccessView); setMessage({ text: t('liveTranslation.access.saved') }); }
        catch { setMessage({ text: t('liveTranslation.access.saveError'), error: true }); }
        finally { setSaving(false); }
    };

    const togglePause = async () => {
        const pausing = !form.paused;
        if (pausing && !window.confirm(t('liveTranslation.access.pauseConfirm'))) return;
        await save({ ...form, paused: pausing });
    };

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
