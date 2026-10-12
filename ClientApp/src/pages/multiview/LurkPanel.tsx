import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { clearLurkLog, type LurkLogEntry, type LurkState } from './lurk';
import type { Slot } from './types';

interface Props {
    slots: Slot[];
    state: LurkState | null;
    ext: string | null;
    supported: boolean;
    onClose: () => void;
}

type Tab = 'now' | 'log' | 'guide';
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const STATUS_TONE: Record<string, string> = { open: 'text-ds-ok', done: 'text-ds-ok', queued: 'text-ds-warn', timeout: 'text-ds-warn' };
const HEALTH_TONE: Record<string, string> = { playing: 'text-ds-ok', starting: 'text-ds-warn', paused: 'text-ds-warn', stalled: 'text-ds-danger', nosession: 'text-ds-danger' };

/** Modo lurk: qué pasa ahora con cada canal, el historial de lo que hizo la extensión y la guía de uso. */
export default function LurkPanel({ slots, state, ext, supported, onClose }: Props) {
    const { t } = useTranslation('multiview');
    const ready = !!ext && supported && !!state;
    const [tab, setTab] = useState<Tab>(ready ? 'now' : 'guide');
    const [, setNow] = useState(0);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const id = window.setInterval(() => setNow(n => n + 1), 30_000); // «hace N min» se actualiza solo
        return () => { document.removeEventListener('keydown', onKey); window.clearInterval(id); };
    }, [onClose]);

    const twitch = slots.filter(s => s.platform === 'twitch');
    const max = state?.maxMinutes ?? 30;
    const tabBtn = (on: boolean) => `rounded px-2.5 py-1 text-sm font-semibold ${on ? 'bg-pub-accent text-white' : 'text-[#a1a1aa] hover:text-white'}`;

    const logText = (e: LurkLogEntry) => {
        const p = e.p || {};
        const st = p.streak && typeof p.streak === 'object' ? `${p.streak.have}/${p.streak.need}` : '—';
        return t(`lurk.log.${e.code}`, {
            defaultValue: e.code,
            minutes: p.minutes ?? 0, have: p.have ?? '', need: p.need ?? '', from: p.from ?? '', streak: st,
            mode: p.mode ? t(`lurk.${p.mode}`) : '', reason: p.reason ?? '', height: p.height ? `${p.height}p` : '?',
            muted: p.muted ? t('lurk.panel.mutedVideo') : '', seconds: p.seconds ?? '',
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose}>
            <div role="dialog" aria-modal="true" aria-label={t('lurk.panel.title')} onMouseDown={e => e.stopPropagation()}
                className="flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-lg border border-pub-border bg-pub-raised shadow-2xl 3xl:max-w-3xl">
                <div className="flex items-center justify-between gap-2 border-b border-pub-border p-3">
                    <h2 className="text-base font-bold text-white">{t('lurk.panel.title')}</h2>
                    <div className="flex items-center gap-1" role="tablist">
                        <button role="tab" aria-selected={tab === 'now'} className={tabBtn(tab === 'now')} onClick={() => setTab('now')}>{t('lurk.panel.now')}</button>
                        <button role="tab" aria-selected={tab === 'log'} className={tabBtn(tab === 'log')} onClick={() => setTab('log')}>{t('lurk.panel.log')}</button>
                        <button role="tab" aria-selected={tab === 'guide'} className={tabBtn(tab === 'guide')} onClick={() => setTab('guide')}>{t('lurk.panel.guide')}</button>
                        <button type="button" onClick={onClose} aria-label={t('shortcuts.close')} className="ml-1 rounded p-1 text-[#a1a1aa] hover:text-white"><X className="h-4 w-4" /></button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-[#d4d4d8]">
                    {tab !== 'guide' && !ready && (
                        <p className="text-ds-warn">{!ext ? t('lurk.tip.noExt') : !supported ? t('lurk.tip.oldExt') : t('lurk.panel.waiting')}</p>
                    )}

                    {tab === 'now' && ready && state && (
                        <>
                            <p className="mb-3 text-[#a1a1aa]">{state.enabled ? t('lurk.panel.modeIs', { mode: t(`lurk.${state.mode}`) }) : t('lurk.panel.isOff')}</p>
                            {twitch.length === 0 ? <p className="text-[#a1a1aa]">{t('lurk.panel.noTwitch')}</p> : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[13px]">
                                        <thead className="text-[#71717a]">
                                            <tr><th className="py-1 pr-3 font-semibold">{t('lurk.panel.col.channel')}</th><th className="py-1 pr-3 font-semibold">{t('lurk.panel.col.status')}</th><th className="py-1 pr-3 font-semibold">{t('lurk.panel.col.video')}</th><th className="py-1 pr-3 font-semibold">{t('lurk.panel.col.streak')}</th><th className="py-1 font-semibold">{t('lurk.panel.col.time')}</th></tr>
                                        </thead>
                                        <tbody>
                                            {twitch.map(s => {
                                                const c = state.channels[s.channel];
                                                const mins = c?.openedAt ? Math.max(0, Math.round((Date.now() - c.openedAt) / 60000)) : null;
                                                return (
                                                    <tr key={s.id} className="border-t border-pub-border">
                                                        <td className="py-1.5 pr-3 font-semibold text-white">{s.channel}</td>
                                                        <td className={`py-1.5 pr-3 ${STATUS_TONE[c?.status ?? ''] ?? ''}`}>{t(`lurk.status.${c?.status ?? 'queued'}`)}</td>
                                                        <td className={`py-1.5 pr-3 ${HEALTH_TONE[c?.health ?? ''] ?? 'text-[#71717a]'}`}>{c?.health ? t(`lurk.health.${c.health}`) : '—'}</td>
                                                        <td className="py-1.5 pr-3 tabular-nums">{c?.streak ? `${c.streak.have}/${c.streak.need}` : '—'}</td>
                                                        <td className="py-1.5 tabular-nums text-[#a1a1aa]">{mins != null ? t('lurk.panel.minutes', { n: mins }) : '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p className="mt-3 text-xs text-[#71717a]">{t('lurk.panel.nowNote', { max })}</p>
                        </>
                    )}

                    {tab === 'log' && ready && state && (
                        <>
                            {(state.log ?? []).length === 0 ? <p className="text-[#a1a1aa]">{t('lurk.panel.logEmpty')}</p> : (
                                <ol className="space-y-1.5">
                                    {[...(state.log ?? [])].reverse().map((e, i) => (
                                        <li key={`${e.at}-${i}`} className="flex gap-2">
                                            <span className="flex-none font-mono text-xs leading-5 text-[#71717a]">{fmtTime(e.at)}</span>
                                            <span className="flex-none font-semibold text-white">{e.login}</span>
                                            <span className="min-w-0">
                                                {logText(e)}{Number(e.p?.n) > 1 && <span className="ml-1 text-[#71717a]">(×{String(e.p.n)})</span>}
                                                {typeof e.p?.raw === 'string' && e.p.raw && <span className="block break-words text-xs text-[#71717a]">«{e.p.raw}»</span>}
                                                {typeof e.p?.menu === 'string' && e.p.menu && <span className="block break-words text-xs text-[#71717a]">{t('lurk.panel.menuText')}: «{e.p.menu}»</span>}
                                                {e.p?.hidden === true && <span className="block text-xs text-[#71717a]">{t('lurk.panel.wasHidden')}</span>}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                            {(state.log ?? []).length > 0 && (
                                <button type="button" onClick={clearLurkLog} className="mt-3 text-xs text-[#a1a1aa] underline hover:text-white">{t('lurk.panel.clearLog')}</button>
                            )}
                        </>
                    )}

                    {tab === 'guide' && (
                        <>
                            <ol className="list-decimal space-y-1.5 pl-5">
                                {[1, 2, 3, 4, 5].map(n => <li key={n}>{t(`lurk.guide.step${n}`)}</li>)}
                            </ol>
                            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[#a1a1aa]">
                                {['streak', 'full', 'nosession', 'paused', 'chat', 'close'].map(k => <li key={k}>{t(`lurk.guide.${k}`, { max })}</li>)}
                            </ul>
                            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                                {!ext && <Link to="/translate" className="font-semibold text-pub-accent-hi underline">{t('lurk.install')}</Link>}
                                <Link to="/docs/multiview" className="font-semibold text-pub-accent-hi underline">{t('lurk.panel.docs')}</Link>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
