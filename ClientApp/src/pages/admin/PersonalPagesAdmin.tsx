import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import { Card, Field, inputClass } from '../../components/overlay-editor/ui';
import { errorOf } from '../personal-page/usePersonalPage';
import { useErrorText } from '../personal-page/PersonalPageTabs';

// Administración de las páginas personales: denuncias y dominios (subfase 5.2), apelaciones por nombres, páginas (ocultar,
// +18 forzado) y nombres reservados (5.1).

type Tab = 'reports' | 'appeals' | 'pages' | 'domains' | 'reserved';

interface AdminReport {
    id: number; reason: string; detail: string; linkUrl: string; linkHost: string; status: string; resolution: string; reviewNote: string;
    createdAt: string; pageId: number; handle: string; pageStatus: string; forcedAdult: boolean; reporter: string; owner: string | null; canBlockDomain: boolean;
}
interface AdminDomain { domain: string; kind: 'adult' | 'blocked'; note: string; createdAt: string }

interface AdminAppeal { id: number; handle: string; message: string; status: string; reviewNote: string; createdAt: string; requester: string; owner: string | null; ownerSince: string | null }
interface AdminPage { id: number; handle: string; channel: string; displayName: string; status: string; hiddenReason: string; published: boolean; updatedAt: string; needsNewHandle: boolean; forcedAdult: boolean; adult: boolean; openReports: number }
interface Reserved { handle: string; note: string; createdAt: string }

export default function PersonalPagesAdmin() {
    const { t, i18n } = useTranslation('personal-page');
    const errorText = useErrorText();
    const [tab, setTab] = useState<Tab>('reports');
    const [reports, setReports] = useState<AdminReport[]>([]);
    const [reportStatus, setReportStatus] = useState('open');
    const [reportNotes, setReportNotes] = useState<Record<number, string>>({});
    const [domains, setDomains] = useState<AdminDomain[]>([]);
    const [builtInAdult, setBuiltInAdult] = useState<string[]>([]);
    const [shorteners, setShorteners] = useState<string[]>([]);
    const [newDomain, setNewDomain] = useState<{ domain: string; kind: 'adult' | 'blocked'; note: string }>({ domain: '', kind: 'blocked', note: '' });
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [appeals, setAppeals] = useState<AdminAppeal[]>([]);
    const [appealStatus, setAppealStatus] = useState('pending');
    const [pages, setPages] = useState<AdminPage[]>([]);
    const [query, setQuery] = useState('');
    const [reserved, setReserved] = useState<Reserved[]>([]);
    const [builtIn, setBuiltIn] = useState<string[]>([]);
    const [newReserved, setNewReserved] = useState({ handle: '', note: '' });
    const [notes, setNotes] = useState<Record<number, string>>({});

    const fail = (err: unknown) => setMessage({ ok: false, text: errorText(errorOf(err).code) });
    const fmt = (d: string) => new Date(d).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

    const loadAppeals = useCallback(async () => {
        try { setAppeals((await api.get('/admin/personal-pages/appeals', { params: { status: appealStatus } })).data.appeals); } catch (err) { fail(err); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appealStatus]);
    const loadPages = useCallback(async () => {
        try { setPages((await api.get('/admin/personal-pages', { params: { q: query } })).data.pages); } catch (err) { fail(err); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);
    const loadReserved = useCallback(async () => {
        try { const res = await api.get('/admin/personal-pages/reserved'); setReserved(res.data.reserved); setBuiltIn(res.data.builtIn); } catch (err) { fail(err); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadReports = useCallback(async () => {
        try { setReports((await api.get('/admin/personal-pages/reports', { params: { status: reportStatus } })).data.reports); } catch (err) { fail(err); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportStatus]);
    const loadDomains = useCallback(async () => {
        try {
            const res = await api.get('/admin/personal-pages/domains');
            setDomains(res.data.domains); setBuiltInAdult(res.data.builtInAdult); setShorteners(res.data.shorteners);
        } catch (err) { fail(err); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { if (tab === 'reports') loadReports(); }, [tab, loadReports]);
    useEffect(() => { if (tab === 'domains') loadDomains(); }, [tab, loadDomains]);
    useEffect(() => { if (tab === 'appeals') loadAppeals(); }, [tab, loadAppeals]);
    useEffect(() => { if (tab === 'pages') { const id = window.setTimeout(loadPages, 300); return () => window.clearTimeout(id); } }, [tab, loadPages]);
    useEffect(() => { if (tab === 'reserved') loadReserved(); }, [tab, loadReserved]);

    const act = async (fn: () => Promise<unknown>, ok: string, reload: () => void) => {
        try { await fn(); setMessage({ ok: true, text: ok }); reload(); } catch (err) { fail(err); }
    };

    return (
        <div className="panel-scale max-w-[1600px] mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/admin" className="ds-btn ds-btn--secondary ds-icon-btn" aria-label={t('admin.back')}><ArrowLeft className="w-5 h-5" /></Link>
                <div>
                    <h1 className="text-3xl 3xl:text-4xl font-black text-ds-text">{t('admin.title')}</h1>
                    <p className="text-sm 3xl:text-base text-ds-soft mt-1">{t('admin.subtitle')}</p>
                </div>
            </div>

            {message && <div role="status" className={`p-4 rounded-lg border ${message.ok ? 'bg-ds-ok/10 border-ds-ok/40 text-ds-ok' : 'bg-ds-danger/10 border-ds-danger/40 text-ds-danger'}`}>{message.text}</div>}

            <div className="bg-ds-surface rounded-lg border border-ds-border p-4 flex flex-wrap gap-2">
                {(['reports', 'appeals', 'pages', 'domains', 'reserved'] as Tab[]).map(id => (
                    <button key={id} type="button" onClick={() => setTab(id)} className={tab === id ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>{t(`admin.tabs.${id}`)}</button>
                ))}
            </div>

            {tab === 'reports' && (
                <Card title={t('admin.reports.title')} description={t('admin.reports.hint')}
                    actions={<div className="w-44 shrink-0"><select className={inputClass} value={reportStatus} onChange={e => setReportStatus(e.target.value)} aria-label={t('admin.reports.filter')}>
                        {['open', 'resolved', 'dismissed', 'all'].map(st => <option key={st} value={st}>{t(`admin.reports.statuses.${st}`)}</option>)}
                    </select></div>}>
                    {reports.length === 0 ? <p className="text-sm 3xl:text-base text-ds-soft">{t('admin.reports.empty')}</p> : (
                        <ul className="divide-y divide-ds-border">
                            {reports.map(r => {
                                const resolve = (action: string, confirmText?: string) => {
                                    if (confirmText && !window.confirm(confirmText)) return;
                                    act(() => api.post(`/admin/personal-pages/reports/${r.id}/resolve`, { action, note: reportNotes[r.id] ?? '' }), t(`admin.reports.done.${action}`), loadReports);
                                };
                                return (
                                    <li key={r.id} className="py-4 space-y-2">
                                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                            <a href={`/@${r.handle}`} target="_blank" rel="noopener noreferrer" className="font-bold text-ds-text hover:underline">@{r.handle}</a>
                                            <span className="text-sm font-semibold text-ds-warn">{t(`report.reasons.${r.reason}`)}</span>
                                            {r.pageStatus === 'hidden' && <span className="text-xs font-semibold text-ds-danger">{t('admin.pages.hidden')}</span>}
                                            {r.forcedAdult && <span className="text-xs font-semibold text-ds-soft">{t('admin.pages.forcedAdult')}</span>}
                                            {r.status !== 'open' && <span className="text-xs font-semibold text-ds-soft">{t(`admin.reports.statuses.${r.status}`)}{r.resolution ? ` · ${t(`admin.reports.resolutions.${r.resolution}`)}` : ''}</span>}
                                        </div>
                                        <p className="text-sm 3xl:text-base text-ds-soft">{t('admin.reports.who', { reporter: r.reporter, owner: r.owner ?? '—', date: fmt(r.createdAt) })}</p>
                                        {r.linkUrl && <p className="text-sm 3xl:text-base text-ds-text break-all">{t('admin.reports.link')}: <span className="font-mono text-xs 3xl:text-sm">{r.linkUrl}</span></p>}
                                        {r.detail && <p className="text-sm 3xl:text-base text-ds-text whitespace-pre-line bg-ds-bg border border-ds-border rounded-lg p-3">{r.detail}</p>}
                                        {r.reviewNote && <p className="text-xs 3xl:text-sm text-ds-soft">{t('admin.appeals.note')}: {r.reviewNote}</p>}
                                        {r.status === 'open' && (
                                            <div className="space-y-2">
                                                <Field label={t('admin.reports.noteLabel')} hint={t('admin.reports.noteHint')}>
                                                    <input className={inputClass} value={reportNotes[r.id] ?? ''} maxLength={1000} onChange={e => setReportNotes(n => ({ ...n, [r.id]: e.target.value }))} />
                                                </Field>
                                                <div className="flex flex-wrap gap-2">
                                                    <button type="button" className="ds-btn ds-btn--danger ds-btn--sm" disabled={r.pageStatus === 'hidden'} onClick={() => resolve('hide', t('admin.reports.hideConfirm', { handle: r.handle }))}>{t('admin.reports.actions.hide')}</button>
                                                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" disabled={r.forcedAdult} onClick={() => resolve('force_adult')}>{t('admin.reports.actions.force_adult')}</button>
                                                    {r.canBlockDomain && <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => resolve('block_domain', t('admin.reports.blockConfirm', { host: r.linkHost }))}>{t('admin.reports.actions.block_domain', { host: r.linkHost })}</button>}
                                                    <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => resolve('dismiss')}>{t('admin.reports.actions.dismiss')}</button>
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>
            )}

            {tab === 'appeals' && (
                <Card title={t('admin.appeals.title')} description={t('admin.appeals.hint')}
                    actions={<div className="w-44 shrink-0"><select className={inputClass} value={appealStatus} onChange={e => setAppealStatus(e.target.value)} aria-label={t('admin.appeals.filter')}>
                        {['pending', 'transferred', 'rejected', 'withdrawn', 'all'].map(st => <option key={st} value={st}>{t(`admin.appeals.statuses.${st}`)}</option>)}
                    </select></div>}>
                    {appeals.length === 0 ? <p className="text-sm 3xl:text-base text-ds-soft">{t('admin.appeals.empty')}</p> : (
                        <ul className="divide-y divide-ds-border">
                            {appeals.map(a => (
                                <li key={a.id} className="py-4 space-y-2">
                                    <p className="font-bold text-ds-text">@{a.handle} <span className="ml-2 text-xs font-semibold text-ds-soft">{t(`appeal.status.${a.status}`)}</span></p>
                                    <p className="text-sm 3xl:text-base text-ds-soft">{t('admin.appeals.who', { requester: a.requester, owner: a.owner ?? '—', date: fmt(a.createdAt) })}</p>
                                    <p className="text-sm 3xl:text-base text-ds-text whitespace-pre-line bg-ds-bg border border-ds-border rounded-lg p-3">{a.message}</p>
                                    {a.reviewNote && <p className="text-xs 3xl:text-sm text-ds-soft">{t('admin.appeals.note')}: {a.reviewNote}</p>}
                                    {a.status === 'pending' && (
                                        <div className="flex flex-col md:flex-row gap-2 md:items-end">
                                            <div className="flex-1"><Field label={t('admin.appeals.noteLabel')}>
                                                <input className={inputClass} value={notes[a.id] ?? ''} maxLength={1000} onChange={e => setNotes(n => ({ ...n, [a.id]: e.target.value }))} />
                                            </Field></div>
                                            <button type="button" className="ds-btn ds-btn--primary" onClick={() => window.confirm(t('admin.appeals.transferConfirm', { handle: a.handle, requester: a.requester })) &&
                                                act(() => api.post(`/admin/personal-pages/appeals/${a.id}/transfer`, { note: notes[a.id] ?? '' }), t('admin.appeals.transferred'), loadAppeals)}>{t('admin.appeals.transfer')}</button>
                                            <button type="button" className="ds-btn ds-btn--secondary" onClick={() => act(() => api.post(`/admin/personal-pages/appeals/${a.id}/reject`, { note: notes[a.id] ?? '' }), t('admin.appeals.rejected'), loadAppeals)}>{t('admin.appeals.reject')}</button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            )}

            {tab === 'pages' && (
                <Card title={t('admin.pages.title')} description={t('admin.pages.hint')}
                    actions={<div className="w-56 shrink-0"><input className={inputClass} value={query} placeholder={t('admin.pages.search')} onChange={e => setQuery(e.target.value)} aria-label={t('admin.pages.search')} /></div>}>
                    {pages.length === 0 ? <p className="text-sm 3xl:text-base text-ds-soft">{t('admin.pages.empty')}</p> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm 3xl:text-base">
                                <thead><tr className="text-left text-ds-soft">
                                    <th className="py-2 pr-3">{t('admin.pages.handle')}</th><th className="py-2 pr-3">{t('admin.pages.channel')}</th>
                                    <th className="py-2 pr-3">{t('admin.pages.state')}</th><th className="py-2 pr-3">{t('admin.pages.updated')}</th><th className="py-2" />
                                </tr></thead>
                                <tbody className="divide-y divide-ds-border">
                                    {pages.map(p => (
                                        <tr key={p.id} className="text-ds-text">
                                            <td className="py-2 pr-3 font-semibold"><a href={`/@${p.handle}`} target="_blank" rel="noopener noreferrer" className="hover:underline">@{p.handle}</a></td>
                                            <td className="py-2 pr-3">{p.channel}</td>
                                            <td className="py-2 pr-3">
                                                <span className={p.status === 'hidden' ? 'text-ds-danger font-semibold' : p.published ? 'text-ds-ok' : 'text-ds-soft'}>
                                                    {p.status === 'hidden' ? t('admin.pages.hidden') : p.published ? t('admin.pages.published') : t('admin.pages.draftOnly')}
                                                </span>
                                                {p.hiddenReason && <span className="block text-xs text-ds-soft">{p.hiddenReason}</span>}
                                                {p.adult && <span className="block text-xs font-semibold text-ds-warn">{p.forcedAdult ? t('admin.pages.forcedAdult') : t('admin.pages.adult')}</span>}
                                                {p.openReports > 0 && <button type="button" className="block text-xs font-semibold text-ds-danger hover:underline" onClick={() => { setReportStatus('open'); setTab('reports'); }}>{t('admin.pages.openReports', { count: p.openReports })}</button>}
                                            </td>
                                            <td className="py-2 pr-3 whitespace-nowrap">{fmt(p.updatedAt)}</td>
                                            <td className="py-2 text-right whitespace-nowrap space-x-2">
                                                <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => act(() => api.post(`/admin/personal-pages/${p.id}/forced-adult`, { forced: !p.forcedAdult }), p.forcedAdult ? t('admin.pages.unforcedOk') : t('admin.pages.forcedOk'), loadPages)}>
                                                    {p.forcedAdult ? t('admin.pages.unforceAdult') : t('admin.pages.forceAdult')}</button>
                                                {p.status === 'hidden'
                                                    ? <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => act(() => api.post(`/admin/personal-pages/${p.id}/visibility`, { hidden: false }), t('admin.pages.shown'), loadPages)}>{t('admin.pages.show')}</button>
                                                    : <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => {
                                                        const reason = window.prompt(t('admin.pages.hideReason'));
                                                        if (reason !== null) act(() => api.post(`/admin/personal-pages/${p.id}/visibility`, { hidden: true, reason }), t('admin.pages.hiddenOk'), loadPages);
                                                    }}>{t('admin.pages.hide')}</button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {tab === 'domains' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card title={t('admin.domains.title')} description={t('admin.domains.hint')}>
                        <div className="flex flex-col gap-2 mb-4">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input className={inputClass} value={newDomain.domain} maxLength={260} placeholder={t('admin.domains.domain')} onChange={e => setNewDomain(d => ({ ...d, domain: e.target.value }))} aria-label={t('admin.domains.domain')} />
                                <div className="sm:w-44 shrink-0"><select className={inputClass} value={newDomain.kind} onChange={e => setNewDomain(d => ({ ...d, kind: e.target.value as 'adult' | 'blocked' }))} aria-label={t('admin.domains.kind')}>
                                    {(['blocked', 'adult'] as const).map(k => <option key={k} value={k}>{t(`admin.domains.kinds.${k}`)}</option>)}
                                </select></div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input className={inputClass} value={newDomain.note} maxLength={300} placeholder={t('admin.domains.note')} onChange={e => setNewDomain(d => ({ ...d, note: e.target.value }))} aria-label={t('admin.domains.note')} />
                                <button type="button" className="ds-btn ds-btn--primary shrink-0" disabled={!newDomain.domain.trim()} onClick={() => act(() => api.post('/admin/personal-pages/domains', newDomain), t('admin.domains.added'), () => { setNewDomain({ domain: '', kind: newDomain.kind, note: '' }); loadDomains(); })}>{t('admin.domains.add')}</button>
                            </div>
                            <p className="text-xs 3xl:text-sm text-ds-soft">{t('admin.domains.kindsHelp')}</p>
                        </div>
                        {domains.length === 0 ? <p className="text-sm 3xl:text-base text-ds-soft">{t('admin.domains.empty')}</p> : (
                            <ul className="divide-y divide-ds-border">
                                {domains.map(d => (
                                    <li key={d.domain} className="py-2 flex items-center justify-between gap-2">
                                        <span className="min-w-0">
                                            <span className="font-semibold text-ds-text break-all">{d.domain}</span>
                                            <span className={`ml-2 text-xs font-bold ${d.kind === 'blocked' ? 'text-ds-danger' : 'text-ds-warn'}`}>{t(`admin.domains.kinds.${d.kind}`)}</span>
                                            {d.note && <span className="block text-xs 3xl:text-sm text-ds-soft">{d.note}</span>}
                                        </span>
                                        <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm shrink-0" onClick={() => act(() => api.delete(`/admin/personal-pages/domains/${encodeURIComponent(d.domain)}`), t('admin.domains.removed'), loadDomains)}>{t('admin.domains.remove')}</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                    <div className="space-y-6">
                        <Card title={t('admin.domains.builtInAdultTitle')} description={t('admin.domains.builtInAdultHint')}>
                            <p className="text-sm 3xl:text-base text-ds-soft leading-relaxed break-words">{builtInAdult.join('  ')}</p>
                        </Card>
                        <Card title={t('admin.domains.shortenersTitle')} description={t('admin.domains.shortenersHint')}>
                            <p className="text-sm 3xl:text-base text-ds-soft leading-relaxed break-words">{shorteners.join('  ')}</p>
                        </Card>
                    </div>
                </div>
            )}

            {tab === 'reserved' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card title={t('admin.reserved.title')} description={t('admin.reserved.hint')}>
                        <div className="flex flex-col sm:flex-row gap-2 mb-4">
                            <input className={inputClass} value={newReserved.handle} maxLength={25} placeholder={t('admin.reserved.handle')} onChange={e => setNewReserved(r => ({ ...r, handle: e.target.value.toLowerCase() }))} aria-label={t('admin.reserved.handle')} />
                            <input className={inputClass} value={newReserved.note} maxLength={300} placeholder={t('admin.reserved.note')} onChange={e => setNewReserved(r => ({ ...r, note: e.target.value }))} aria-label={t('admin.reserved.note')} />
                            <button type="button" className="ds-btn ds-btn--primary shrink-0" disabled={!newReserved.handle} onClick={() => act(() => api.post('/admin/personal-pages/reserved', newReserved), t('admin.reserved.added'), () => { setNewReserved({ handle: '', note: '' }); loadReserved(); })}>{t('admin.reserved.add')}</button>
                        </div>
                        {reserved.length === 0 ? <p className="text-sm 3xl:text-base text-ds-soft">{t('admin.reserved.empty')}</p> : (
                            <ul className="divide-y divide-ds-border">
                                {reserved.map(r => (
                                    <li key={r.handle} className="py-2 flex items-center justify-between gap-2">
                                        <span className="min-w-0"><span className="font-semibold text-ds-text">@{r.handle}</span>{r.note && <span className="block text-xs 3xl:text-sm text-ds-soft">{r.note}</span>}</span>
                                        <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => act(() => api.delete(`/admin/personal-pages/reserved/${encodeURIComponent(r.handle)}`), t('admin.reserved.removed'), loadReserved)}>{t('admin.reserved.remove')}</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                    <Card title={t('admin.reserved.builtInTitle')} description={t('admin.reserved.builtInHint')}>
                        <p className="text-sm 3xl:text-base text-ds-soft leading-relaxed break-words">{builtIn.map(h => `@${h}`).join('  ')}</p>
                    </Card>
                </div>
            )}
        </div>
    );
}
