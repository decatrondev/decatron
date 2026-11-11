import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import { Card, Field, inputClass } from '../../components/overlay-editor/ui';
import { errorOf } from '../personal-page/usePersonalPage';
import { useErrorText } from '../personal-page/PersonalPageTabs';

// Administración de las páginas personales (subfase 5.1): apelaciones por nombres, páginas (ocultar) y nombres reservados.

type Tab = 'appeals' | 'pages' | 'reserved';

interface AdminAppeal { id: number; handle: string; message: string; status: string; reviewNote: string; createdAt: string; requester: string; owner: string | null; ownerSince: string | null }
interface AdminPage { id: number; handle: string; channel: string; displayName: string; status: string; hiddenReason: string; published: boolean; updatedAt: string; needsNewHandle: boolean }
interface Reserved { handle: string; note: string; createdAt: string }

export default function PersonalPagesAdmin() {
    const { t, i18n } = useTranslation('personal-page');
    const errorText = useErrorText();
    const [tab, setTab] = useState<Tab>('appeals');
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
                {(['appeals', 'pages', 'reserved'] as Tab[]).map(id => (
                    <button key={id} type="button" onClick={() => setTab(id)} className={tab === id ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>{t(`admin.tabs.${id}`)}</button>
                ))}
            </div>

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
                                            </td>
                                            <td className="py-2 pr-3 whitespace-nowrap">{fmt(p.updatedAt)}</td>
                                            <td className="py-2 text-right">
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
