import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Checkbox, Field, Input, Select, Textarea } from '../../components/ds';
import api from '../../services/api';
import { CONTRIBUTIONS_API, DONATIONS_API, blankContribution, type Contribution } from '../tournament-call/contributions';

interface Recovery { id: string; reference: string; state: string; amountPen: number; createdAt: string }
interface History { id: number; action: string; actorId: number | null; createdAt: string; snapshot: string }
export default function CallContributions() {
    const { t, i18n } = useTranslation('tournament-call');
    const [items, setItems] = useState<Contribution[]>([]);
    const [page, setPage] = useState(1); const [total, setTotal] = useState(0);
    const [editing, setEditing] = useState<Contribution | null>(null);
    const [recovery, setRecovery] = useState<Recovery[]>([]);
    const [chargeIds, setChargeIds] = useState<Record<string, string>>({});
    const [history, setHistory] = useState<History[] | null>(null);
    const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
    const load = async () => {
        setBusy(true); setError('');
        try {
            const [list, attempts] = await Promise.all([api.get(CONTRIBUTIONS_API, { params: { page } }), api.get(`${CONTRIBUTIONS_API}/recovery`)]);
            setItems(list.data.items); setTotal(list.data.total); setRecovery(attempts.data);
        } catch { setError(t('funding.loadError')); }
        finally { setBusy(false); }
    };
    useEffect(() => { void load(); }, [page]);
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => { if (editing) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
    }, [editing]);
    const change = (patch: Partial<Contribution>) => editing && setEditing({ ...editing, ...patch });
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (!editing || busy) return;
        if (editing.status !== 'pending' && !window.confirm(t(`funding.confirm.${editing.status}`))) return;
        setBusy(true); setError(''); setNotice('');
        try {
            if (editing.id) await api.put(`${CONTRIBUTIONS_API}/${editing.id}`, editing); else await api.post(CONTRIBUTIONS_API, editing);
            setEditing(null); setNotice(t('funding.saved')); await load();
        } catch (e: any) { setError(t(`funding.errors.${e.response?.data?.code ?? 'save_failed'}`, { defaultValue: t('funding.saveError') })); }
        finally { setBusy(false); }
    };
    const reconcile = async (attempt: Recovery) => {
        setBusy(true); setError(''); setNotice('');
        try {
            await api.post(`${DONATIONS_API}/reconcile/${attempt.id}`, { chargeId: chargeIds[attempt.id] ?? '' });
            setNotice(t('funding.reconciled')); await load();
        } catch { setError(t('funding.reconcileError')); }
        finally { setBusy(false); }
    };
    const showHistory = async (id: number) => {
        setBusy(true); setError('');
        try { setHistory((await api.get(`${CONTRIBUTIONS_API}/${id}/history`)).data); }
        catch { setError(t('funding.loadError')); } finally { setBusy(false); }
    };
    return <section className="call-review call-funding-controls">
        <h2 className="text-xl font-bold">{t('funding.adminTitle')}</h2><p className="text-ds-soft mt-3">{t('funding.adminHelp')}</p>
        <div className="call-editor-actions"><Button disabled={busy || !!editing} onClick={() => { setEditing(blankContribution()); setHistory(null); setNotice(''); }}>{t('funding.add')}</Button><Button variant="ghost" disabled={busy} onClick={load}>{t('reload')}</Button></div>
        {error && <Alert tone="danger">{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
        {editing && <Card><form onSubmit={save} className="call-funding-form">
            <h3 className="text-lg font-bold">{t(editing.id ? 'funding.edit' : 'funding.add')}</h3>
            {editing.isTest && <Alert tone="warn">{t('funding.testPayment')}</Alert>}
            <div className="call-editor-fields">
                <Field label={t('funding.reference')} hint={t('funding.referenceHelp')}><Input required maxLength={150} disabled={busy || editing.isOnlineDonation} value={editing.reference} onChange={e => change({ reference: e.target.value })} /></Field>
                <Field label={t('funding.donor')}><Input required maxLength={100} disabled={busy || editing.isOnlineDonation} value={editing.donorName} onChange={e => change({ donorName: e.target.value })} /></Field>
                <Field label={t('funding.paymentId')}><Input type="number" min={1} step={1} disabled={busy || !!editing.id && !!editing.paymentId} value={editing.paymentId ?? ''} onChange={e => change({ paymentId: e.target.value ? Number(e.target.value) : null })} /></Field>
                <Field label={t('funding.applicationId')}><Input type="number" min={1} step={1} disabled={busy} value={editing.applicationId ?? ''} onChange={e => change({ applicationId: e.target.value ? Number(e.target.value) : null })} /></Field>
                <Field label={t('funding.descriptionEs')}><Textarea required maxLength={600} disabled={busy} value={editing.descriptionEs} onChange={e => change({ descriptionEs: e.target.value })} /></Field>
                <Field label={t('funding.descriptionEn')}><Textarea required maxLength={600} disabled={busy} value={editing.descriptionEn} onChange={e => change({ descriptionEn: e.target.value })} /></Field>
                <Field label={t('funding.kindLabel')}><Select disabled={busy || !!editing.paymentId} value={editing.kind} onChange={e => change({ kind: e.target.value as Contribution['kind'], currency: e.target.value === 'item' ? '' : 'USD', receivedAmount: null, prizeAmount: null })}>{['money', 'giftcard', 'item'].map(kind => <option key={kind} value={kind}>{t(`funding.kinds.${kind}`)}</option>)}</Select></Field>
                {editing.kind !== 'item' && <Field label={t('offerCurrency')}><Input required pattern="[A-Z]{3}" maxLength={3} disabled={busy || !!editing.paymentId} value={editing.currency} onChange={e => change({ currency: e.target.value.toUpperCase() })} /></Field>}
                <Field label={t('funding.received')} hint={t('funding.receivedHelp')}><Input type="number" min={editing.kind === 'item' ? 1 : .01} step={editing.kind === 'item' ? 1 : .01} disabled={busy} value={editing.receivedAmount ?? ''} onChange={e => change({ receivedAmount: e.target.value ? Number(e.target.value) : null })} /></Field>
                <Field label={t('funding.allocated')}><Input type="number" min={editing.kind === 'item' ? 1 : .01} step={editing.kind === 'item' ? 1 : .01} max={editing.receivedAmount ?? undefined} disabled={busy} value={editing.prizeAmount ?? ''} onChange={e => change({ prizeAmount: e.target.value ? Number(e.target.value) : null })} /></Field>
                <Field label={t('funding.custodian')}><Input maxLength={150} disabled={busy} value={editing.custodian} onChange={e => change({ custodian: e.target.value })} /></Field>
                <Field label={t('funding.deliveredBy')}><Input maxLength={150} disabled={busy} value={editing.deliveredBy} onChange={e => change({ deliveredBy: e.target.value })} /></Field>
                <Field label={t('funding.evidence')}><Textarea maxLength={1500} disabled={busy} value={editing.evidence} onChange={e => change({ evidence: e.target.value })} /></Field>
                <Field label={t('funding.channel')}><Input type="url" disabled={busy || editing.isOnlineDonation} value={editing.channelUrl} onChange={e => change({ channelUrl: e.target.value })} /></Field>
                <div><Checkbox disabled={busy || editing.isOnlineDonation} checked={editing.publicIdentity} onChange={e => change({ publicIdentity: e.target.checked })} label={t('funding.identityConsent')} /><p className="text-ds-soft mt-2">{t(editing.isOnlineDonation ? 'funding.onlineConsent' : 'funding.anonymousHelp')}</p></div>
                <Field label={t('funding.consentEvidence')}><Textarea maxLength={1000} disabled={busy || editing.isOnlineDonation} value={editing.consentEvidence} onChange={e => change({ consentEvidence: e.target.value })} /></Field>
                <Field label={t('funding.statusLabel')}><Select disabled={busy} value={editing.status} onChange={e => change({ status: e.target.value as Contribution['status'] })}>{['pending', 'confirmed', 'reversed'].map(status => <option key={status} value={status}>{t(`funding.status.${status}`)}</option>)}</Select></Field>
            </div>
            <Alert>{t('funding.confirmationHelp')}</Alert>
            <div className="call-editor-actions"><Button type="submit" loading={busy} disabled={busy}>{t('funding.save')}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { if (window.confirm(t('discard'))) setEditing(null); }}>{t('funding.cancel')}</Button></div>
        </form></Card>}
        <div className="call-review-list">{items.map(item => <Card key={item.id}>
            <div className="call-review-heading"><h3>{item.reference}</h3><strong>{t(`funding.status.${item.status}`)}</strong></div>
            {item.isTest && <Alert tone="warn">{t('funding.testPayment')}</Alert>}
            <p>{item.donorName} · {i18n.language.startsWith('en') ? item.descriptionEn : item.descriptionEs}</p>
            {item.payerName && <p>{t('funding.payer')}: <strong>{item.payerName}</strong>{item.payerChannelUrl && <> · <a href={item.payerChannelUrl} target="_blank" rel="noopener noreferrer">{item.payerChannelUrl}</a></>}</p>}
            {item.applicationId ? <p className="text-ds-soft">{t('funding.linkedApplication', { id: item.applicationId })}</p> : item.isOnlineDonation && <p className="text-ds-soft">{t('funding.notLinked')}</p>}
            <dl className="call-review-details"><div><dt>{t('funding.gross')}</dt><dd>{item.grossAmount ?? '—'} {item.currency}</dd></div><div><dt>{t('funding.received')}</dt><dd>{item.receivedAmount ?? '—'} {item.currency}</dd></div><div><dt>{t('funding.allocated')}</dt><dd>{item.prizeAmount ?? '—'} {item.currency}</dd></div><div><dt>{t('funding.publicIdentity')}</dt><dd>{t(item.publicIdentity ? 'consentYes' : 'funding.anonymous')}</dd></div></dl>
            <div className="call-editor-actions"><Button variant="secondary" disabled={busy || !!editing} onClick={() => { setEditing({ ...item }); setHistory(null); }}>{t('funding.edit')}</Button><Button variant="ghost" disabled={busy} onClick={() => showHistory(item.id)}>{t('funding.history')}</Button></div>
        </Card>)}</div>
        {!items.length && <p>{t('funding.emptyAdmin')}</p>}
        <div className="call-editor-actions"><Button variant="secondary" disabled={busy || !!editing || page <= 1} onClick={() => setPage(page - 1)}>{t('previousPage')}</Button><span>{t('applicationPage', { page })}</span><Button variant="secondary" disabled={busy || !!editing || page * 25 >= total} onClick={() => setPage(page + 1)}>{t('nextPage')}</Button></div>
        {history && <Card><h3>{t('funding.history')}</h3>{history.map(event => <details key={event.id}><summary>{new Date(event.createdAt).toLocaleString(i18n.language)} · {t(`funding.actions.${event.action}`)} · {t('funding.actor', { actor: event.actorId ?? '—' })}</summary><pre className="call-audit">{JSON.stringify(JSON.parse(event.snapshot), null, 2)}</pre></details>)}</Card>}
        {recovery.length > 0 && <section className="mt-8"><h3 className="text-xl font-bold">{t('funding.recoveryTitle')}</h3><p>{t('funding.recoveryHelp')}</p><div className="call-review-list">{recovery.map(attempt => <Card key={attempt.id}><strong>{attempt.reference}</strong><p>{t(`funding.paymentStates.${attempt.state}`)} · PEN {attempt.amountPen}</p><Field label={t('funding.chargeId')}><Input disabled={busy} value={chargeIds[attempt.id] ?? ''} onChange={e => setChargeIds({ ...chargeIds, [attempt.id]: e.target.value })} /></Field><Button variant="secondary" disabled={busy || !chargeIds[attempt.id]} onClick={() => reconcile(attempt)}>{t('funding.reconcile')}</Button></Card>)}</div></section>}
    </section>;
}
