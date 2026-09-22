/**
 * Créditos del canal: un solo saldo para todo lo que le cuesta dinero a la plataforma
 * (voz premium, traducción en vivo, IA del coach, !ia, chat). Misma referencia visual que
 * DecaCoins (/me/coins): tarjeta de saldo, qué se gastó este período, tarifas e historial.
 * Plan: .dev/plans/CREDITOS_UNIFICADOS_PLAN.md (fase 3). La compra llega en la fase 4.
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Coins, Loader2, RefreshCw, ChevronLeft, ChevronRight, Sparkles, Mic, Bot, Bell, MessageSquare, Clock, Cpu, Info } from 'lucide-react';
import api from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import BuyCreditsSection from './credits/BuyCreditsSection';

interface Summary {
    tier: string; isUnlimited: boolean; tierExpiresAt: string | null;
    monthlyGranted: number; monthlyUsed: number; monthlyRemaining: number; purchasedBalance: number; totalAvailable: number; monthlyPeriod: string;
    standardGranted: number; standardUsed: number; standardRemaining: number;
    inTransitionWindow: boolean; transitionEndsAt: string | null;
    byFeature: { feature: string; credits: number; entries: number }[];
    standardByFeature: { feature: string; credits: number; entries: number }[];
    rates: { creditUsd: number; sttCreditsPerSecond: number; premiumVoicePerChar: Record<string, number>; aiApproxPerCall: Record<string, number> };
}
interface Entry { id: number; createdAt: string; type: string; credits: number; bucket: string; feature: string | null; engine: string | null; chars: number | null; voice: string | null; language: string | null; note: string | null }
interface HistoryPage { total: number; page: number; pageSize: number; totalPages: number; features: string[]; entries: Entry[] }

const FEATURE_ICON: Record<string, JSX.Element> = {
    lol_coach_ai: <Bot className="w-4 h-4" />, lol_coach: <Bot className="w-4 h-4" />,
    live_translation: <Mic className="w-4 h-4" />, live_translation_ai: <Sparkles className="w-4 h-4" />,
    twitch_chat_ai: <MessageSquare className="w-4 h-4" />, decatron_chat_ai: <MessageSquare className="w-4 h-4" />,
    event_alerts: <Bell className="w-4 h-4" />, speak_chat: <MessageSquare className="w-4 h-4" />, timer_alerts: <Clock className="w-4 h-4" />,
};
const fmt = (n: number) => n.toLocaleString();
const card = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]';
const muted = 'text-sm text-[#64748b] dark:text-[#94a3b8]';
const h2 = 'text-lg font-black text-[#1e293b] dark:text-[#f8fafc]';
const select = 'px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#111213] text-sm text-[#1e293b] dark:text-[#f8fafc]';

export default function Credits() {
    const { t } = useTranslation('features', { keyPrefix: 'credits' });
    const { permissions } = usePermissions();
    const [summary, setSummary] = useState<Summary | null>(null);
    const [history, setHistory] = useState<HistoryPage | null>(null);
    const [page, setPage] = useState(1);
    const [feature, setFeature] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const featureName = (f: string | null) => f ? t(`features.${f}`, { defaultValue: f.replace(/_/g, ' ') }) : t('features.other');
    const engineName = (e: string | null, voice: string | null) => {
        if (!e) return '';
        if (e === 'ai') return voice ?? 'IA';
        return t(`engines.${e}`, { defaultValue: e });
    };

    const loadSummary = useCallback(async () => {
        try { const r = await api.get('/tts-credits/summary'); setSummary(r.data); setError(null); }
        catch { setError(t('loadError')); }
        finally { setLoading(false); }
    }, [t]);
    const loadHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: '25' });
            if (feature) params.set('feature', feature);
            const r = await api.get(`/tts-credits/history?${params.toString()}`);
            setHistory(r.data);
        } catch { /* el resumen ya avisa */ } finally { setLoadingHistory(false); }
    }, [page, feature]);

    useEffect(() => { loadSummary(); }, [loadSummary]);
    useEffect(() => { loadHistory(); }, [loadHistory]);

    if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" /></div>;
    if (!summary) return <div className={`${card} text-red-500`}>{error ?? t('loadError')}</div>;

    const s = summary;
    const pct = s.monthlyGranted > 0 ? Math.min(100, (s.monthlyUsed / s.monthlyGranted) * 100) : 0;
    const stdPct = s.standardGranted > 0 ? Math.min(100, (s.standardUsed / s.standardGranted) * 100) : 0;
    const usdPer = (credits: number) => `$${(credits * s.rates.creditUsd).toFixed(credits * s.rates.creditUsd < 0.01 ? 4 : 2)}`;
    const spentPeriod = s.byFeature.reduce((a, b) => a + b.credits, 0);

    return (
        <div className="space-y-6 max-w-[1100px] mx-auto">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">{t('title')}</h1>
                    <p className={`${muted} mt-2`}>{t('subtitle')}</p>
                </div>
                <button onClick={() => { loadSummary(); loadHistory(); }} className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]" title={t('refresh')}><RefreshCw className="w-4 h-4 text-[#64748b]" /></button>
            </div>

            {/* Saldo */}
            <div className="bg-gradient-to-r from-[#1a1b1e] to-[#2d2f36] rounded-2xl p-6 border border-[#374151] shadow-lg">
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-[#9146FF]/20 flex items-center justify-center flex-shrink-0"><Coins className="w-8 h-8 text-[#bf94ff]" /></div>
                        <div>
                            <p className="text-sm text-[#94a3b8]">{t('available')}</p>
                            <p className="text-4xl font-black text-white">{s.isUnlimited ? '∞' : fmt(s.totalAvailable)}</p>
                            <p className="text-sm text-[#94a3b8]">{t('credits')} · {t('plan')} <b className="text-white capitalize">{s.tier}</b></p>
                        </div>
                    </div>
                    <div className="flex-1 min-w-[260px] grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-[#94a3b8]">{t('monthly')}</p>
                            <p className="text-white font-bold">{s.isUnlimited ? '∞' : `${fmt(s.monthlyRemaining)} / ${fmt(s.monthlyGranted)}`}</p>
                            {!s.isUnlimited && <div className="h-1.5 mt-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-[#bf94ff]" style={{ width: `${100 - pct}%` }} /></div>}
                        </div>
                        <div>
                            <p className="text-[#94a3b8]">{t('purchased')}</p>
                            <p className="text-white font-bold">{fmt(s.purchasedBalance)}</p>
                            <p className="text-xs text-[#94a3b8] mt-1">{t('purchasedHint')}</p>
                        </div>
                    </div>
                    <div className="w-full sm:w-auto">
                        <a href="#buy" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#9146FF] hover:bg-[#7c3aed] text-white font-bold text-sm">{t('getMore')}</a>
                        <Link to="/supporters" className="block mt-2 text-xs text-[#94a3b8] hover:underline">{t('orPlan')}</Link>
                    </div>
                </div>
                {s.inTransitionWindow && s.transitionEndsAt && <p className="text-xs text-amber-300 mt-4">{t('transition', { date: new Date(s.transitionEndsAt).toLocaleDateString() })}</p>}
                {s.tierExpiresAt && <p className="text-xs text-[#94a3b8] mt-2">{t('expires', { date: new Date(s.tierExpiresAt).toLocaleDateString() })}</p>}
                {!s.isUnlimited && s.totalAvailable <= 0 && <p className="text-sm text-amber-300 mt-4">{t('empty')}</p>}
            </div>

            <BuyCreditsSection canBuy={permissions.isOwner} onPurchased={loadSummary} />

            <div className="grid md:grid-cols-2 gap-6">
                {/* Gasto del período por concepto */}
                <div className={card}>
                    <div className="flex items-center justify-between mb-1">
                        <h2 className={h2}>{t('spentTitle')}</h2>
                        <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{fmt(spentPeriod)} <span className={muted}>({usdPer(spentPeriod)})</span></span>
                    </div>
                    <p className={`${muted} mb-4`}>{t('spentHint', { date: new Date(s.monthlyPeriod).toLocaleDateString() })}</p>
                    {s.byFeature.length === 0 ? <p className={muted}>{t('nothingYet')}</p> : (
                        <ul className="space-y-3">
                            {s.byFeature.map(f => (
                                <li key={f.feature}>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 text-[#1e293b] dark:text-[#f8fafc]"><span className="text-[#9146FF]">{FEATURE_ICON[f.feature] ?? <Cpu className="w-4 h-4" />}</span>{featureName(f.feature)} <span className={muted}>· {f.entries}</span></span>
                                        <span className="font-mono font-semibold text-[#1e293b] dark:text-[#f8fafc]">{fmt(f.credits)}</span>
                                    </div>
                                    <div className="h-1.5 mt-1 rounded-full bg-[#f1f5f9] dark:bg-[#262626]"><div className="h-1.5 rounded-full bg-[#9146FF]" style={{ width: `${spentPeriod ? (f.credits / spentPeriod) * 100 : 0}%` }} /></div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Voz estándar (gratis) */}
                <div className={card}>
                    <h2 className={h2}>{t('standardTitle')}</h2>
                    <p className={`${muted} mb-4`}>{t('standardHint')}</p>
                    <div className="flex items-baseline justify-between text-sm mb-1">
                        <span className="text-[#1e293b] dark:text-[#f8fafc] font-bold">{s.isUnlimited ? '∞' : `${fmt(s.standardRemaining)} / ${fmt(s.standardGranted)}`}</span>
                        <span className={muted}>{t('standardUsed', { n: fmt(s.standardUsed) })}</span>
                    </div>
                    {!s.isUnlimited && <div className="h-1.5 rounded-full bg-[#f1f5f9] dark:bg-[#262626]"><div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${100 - stdPct}%` }} /></div>}
                    {s.standardByFeature.length > 0 && (
                        <ul className="mt-4 space-y-1 text-sm">
                            {s.standardByFeature.map(f => <li key={f.feature} className="flex justify-between"><span className="text-[#1e293b] dark:text-[#f8fafc]">{featureName(f.feature)}</span><span className={`font-mono ${muted}`}>{fmt(f.credits)}</span></li>)}
                        </ul>
                    )}
                </div>
            </div>

            {/* Tarifas */}
            <div className={card}>
                <div className="flex items-center gap-2 mb-1"><Info className="w-5 h-5 text-[#9146FF]" /><h2 className={h2}>{t('ratesTitle')}</h2></div>
                <p className={`${muted} mb-4`}>{t('ratesHint', { usd: (s.rates.creditUsd * 1_000_000).toFixed(0) })}</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    <Rate icon={<Mic className="w-4 h-4" />} label={t('rates.stt')} value={t('rates.perSecond', { n: s.rates.sttCreditsPerSecond })} sub={t('rates.perMinute', { n: fmt(s.rates.sttCreditsPerSecond * 60) })} />
                    <Rate icon={<Sparkles className="w-4 h-4" />} label={t('rates.premiumVoice')} value={t('rates.perChar', { n: `${s.rates.premiumVoicePerChar.fish}–${s.rates.premiumVoicePerChar.deepgram_aura}` })} sub={t('rates.premiumVoiceSub')} />
                    <Rate icon={<Cpu className="w-4 h-4" />} label={t('rates.standardVoice')} value={t('rates.free')} sub={t('rates.standardVoiceSub')} />
                    <Rate icon={<Bot className="w-4 h-4" />} label={t('rates.coach')} value={t('rates.perCall', { n: `~${s.rates.aiApproxPerCall.lol_coach_ai}` })} sub={t('rates.aiSub')} />
                    <Rate icon={<Sparkles className="w-4 h-4" />} label={t('rates.translationAi')} value={t('rates.perPhrase', { n: `~${s.rates.aiApproxPerCall.live_translation_ai}` })} sub={t('rates.aiSub')} />
                    <Rate icon={<MessageSquare className="w-4 h-4" />} label={t('rates.chatAi')} value={t('rates.perCall', { n: `~${s.rates.aiApproxPerCall.twitch_chat_ai}` })} sub={t('rates.aiSub')} />
                </div>
            </div>

            {/* Historial */}
            <div className={card}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h2 className={h2}>{t('historyTitle')} {history ? <span className={`${muted} font-normal`}>· {fmt(history.total)}</span> : null}</h2>
                    <select value={feature} onChange={e => { setFeature(e.target.value); setPage(1); }} className={select}>
                        <option value="">{t('allFeatures')}</option>
                        {history?.features.map(f => <option key={f} value={f}>{featureName(f)}</option>)}
                    </select>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="text-left text-[#64748b] dark:text-[#94a3b8]"><th className="py-1 font-medium">{t('col.when')}</th><th className="py-1 font-medium">{t('col.what')}</th><th className="py-1 font-medium">{t('col.detail')}</th><th className="py-1 font-medium text-right">{t('col.credits')}</th></tr></thead>
                        <tbody className="text-[#1e293b] dark:text-[#f8fafc]">
                            {history?.entries.map(e => (
                                <Fragment key={e.id}>
                                    <tr className="border-t border-[#f1f5f9] dark:border-[#26262c]">
                                        <td className="py-1.5 text-xs whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                                        <td className="text-xs">
                                            <span className="inline-flex items-center gap-1.5">{e.type === 'consume' ? <span className="text-[#9146FF]">{FEATURE_ICON[e.feature ?? ''] ?? <Cpu className="w-4 h-4" />}</span> : <Coins className="w-4 h-4 text-emerald-500" />}{e.type === 'consume' ? featureName(e.feature) : t(`types.${e.type}`, { defaultValue: e.type })}</span>
                                            {e.bucket === 'standard' && <span className="ml-1 text-[10px] uppercase text-emerald-600 dark:text-emerald-400">{t('standardTag')}</span>}
                                        </td>
                                        <td className="text-xs text-[#64748b] dark:text-[#94a3b8]">{[engineName(e.engine, e.voice), e.engine !== 'ai' && e.voice ? e.voice : null, e.language?.toUpperCase(), e.chars != null && e.engine !== 'ai' ? t('chars', { n: fmt(e.chars) }) : null, e.note].filter(Boolean).join(' · ')}</td>
                                        <td className={`text-right font-mono text-xs ${e.credits < 0 ? '' : 'text-emerald-500'}`}>{e.credits > 0 ? '+' : ''}{fmt(e.credits)}</td>
                                    </tr>
                                </Fragment>
                            ))}
                            {history && history.entries.length === 0 && <tr><td colSpan={4} className={`${muted} py-6 text-center`}>{t('nothingYet')}</td></tr>}
                        </tbody>
                    </table>
                </div>
                {history && history.totalPages > 1 && (
                    <div className="flex items-center justify-end gap-1 mt-4">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loadingHistory} className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-xs px-2">{history.page} / {history.totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(history.totalPages, p + 1))} disabled={page >= history.totalPages || loadingHistory} className="p-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                )}
            </div>
        </div>
    );
}

function Rate({ icon, label, value, sub }: { icon: JSX.Element; label: string; value: string; sub?: string }) {
    return (
        <div className="p-3 rounded-xl bg-[#f8fafc] dark:bg-[#111213] border border-[#e2e8f0] dark:border-[#26262c]">
            <div className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]"><span className="text-[#9146FF]">{icon}</span><span className="text-xs">{label}</span></div>
            <div className="font-bold text-[#1e293b] dark:text-[#f8fafc] mt-1">{value}</div>
            {sub && <div className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5">{sub}</div>}
        </div>
    );
}
