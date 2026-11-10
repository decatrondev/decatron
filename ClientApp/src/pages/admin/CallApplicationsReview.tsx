import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Field, Segmented, Textarea } from '../../components/ds';
import api from '../../services/api';
import { CALL_API, type ApplicationKind, type CallApplication } from '../tournament-call/content';

interface ApplicationPage { items: CallApplication[]; total: number; page: number; pageSize: number }
export default function CallApplicationsReview({ kind }: { kind: ApplicationKind }) {
    const { t, i18n } = useTranslation('tournament-call');
    const [status, setStatus] = useState('pending');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<ApplicationPage | null>(null);
    const [notes, setNotes] = useState<Record<number, string>>({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const load = async () => {
        setBusy(true); setError('');
        try {
            const response = await api.get<ApplicationPage>(`${CALL_API}/applications`, { params: { kind, status, page } });
            if (!response.data.items.length && page > 1) { setPage(page - 1); return; }
            setData(response.data); setNotes(Object.fromEntries(response.data.items.map(row => [row.id, row.reviewNote])));
        } catch { setError(t('reviewLoadError')); }
        finally { setBusy(false); }
    };
    useEffect(() => { void load(); }, [kind, status, page]);
    const review = async (application: CallApplication, target: string) => {
        if (busy || !window.confirm(t('confirmReview', { status: t(`applicationStatus.${target}`) }))) return;
        setBusy(true); setError('');
        try {
            await api.put(`${CALL_API}/applications/${application.id}`, { status: target, note: notes[application.id] ?? '', revision: application.revision });
            await load();
        } catch { setError(t('applicationConflictHelp')); }
        finally { setBusy(false); }
    };
    return <section className="call-review">
        <h2 className="text-xl font-bold text-ds-text">{t(kind === 'participant' ? 'participantApplications' : 'collaboratorApplications')}</h2>
        <Alert>{t('approvalMeaning')}</Alert>
        <Segmented items={['pending', 'approved', 'rejected', 'withdrawn', 'all'].map(id => ({ id, label: t(`applicationStatus.${id}`) }))} value={status} onChange={value => { setStatus(value); setPage(1); }} />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button variant="ghost" loading={busy} onClick={load}>{t('reload')}</Button>
        {data && <><p className="text-ds-soft">{t('applicationCount', { count: data.total })}</p>
            {!data.items.length && <p className="text-ds-soft">{t('noApplications')}</p>}
            <div className="call-review-list">{data.items.map(application => <Card key={application.id}>
                <div className="call-review-heading"><div><h3>{application.displayName}</h3><a href={application.channelUrl} target="_blank" rel="noopener noreferrer">{application.channelUrl}</a></div><strong>{t(`applicationStatus.${application.status}`)}{application.origin === 'payment' ? ` · ${t('origin.payment')}` : ''}</strong></div>
                <dl className="call-review-details"><div><dt>{t('contact')}</dt><dd>{application.contact}</dd></div><div><dt>{t('submittedAt')}</dt><dd>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(application.createdAt))}</dd></div><div><dt>{t('publicListing')}</dt><dd>{t(application.publicListing ? 'consentYes' : 'consentNo')}</dd></div>
                    {kind === 'participant' ? <div><dt>{t('usesBotDeclaration')}</dt><dd>{t(application.usesBot ? 'declaredNotVerified' : 'consentNo')}</dd></div> : <div><dt>{t('proposedContribution')}</dt><dd>{application.amount} {application.contributionType === 'vbucks' ? t('contributionTypes.vbucks') : application.currency} · {t(`contributionTypes.${application.contributionType}`)}</dd></div>}
                    {kind === 'participant' && <div><dt>{t('botStatus.label')}</dt><dd>{t(application.botEnabled == null ? 'botStatus.unknown' : application.botEnabled ? 'botStatus.on' : 'botStatus.off')}<br /><span className="call-small">{t('botStatus.help')}</span></dd></div>}
                </dl>
                {application.origin === 'payment' && <Alert>{t('origin.adminHelp')}</Alert>}
                {kind === 'collaborator' && ['vbucks', 'giftcard'].includes(application.contributionType) && <dl className="call-review-details"><div><dt>{t('custody.adminAccepted')}</dt><dd>{t(application.custodyAccepted ? 'consentYes' : 'consentNo')}</dd></div><div><dt>{t('custody.adminPublicOffer')}</dt><dd>{t(application.publicOffer ? 'consentYes' : 'consentNo')}</dd></div></dl>}
                {kind === 'collaborator' && !!application.contributions?.length && <div className="call-linked-contributions"><strong>{t('origin.linkedContributions')}</strong><ul>{application.contributions.map(item => <li key={item.id}>{item.reference} · {t(`funding.status.${item.status}`)} · {item.grossAmount ?? '—'} {item.currency}{item.isTest ? ` · ${t('mine.test')}` : ''}</li>)}</ul></div>}
                {application.notes && <p className="call-preserve">{application.notes}</p>}
                <Field label={t('reviewNote')} hint={t(kind === 'collaborator' ? 'collaborationNext.reviewHelp' : 'reviewNoteHelp')}><Textarea disabled={busy || application.status === 'withdrawn'} maxLength={1000} rows={2} value={notes[application.id] ?? ''} onChange={event => setNotes({ ...notes, [application.id]: event.target.value })} /></Field>
                {application.status !== 'withdrawn' && <div className="call-editor-actions">{['approved', 'rejected', 'pending'].map(target => <Button key={target} variant={target === 'approved' ? 'primary' : target === 'rejected' ? 'danger' : 'secondary'} disabled={busy} onClick={() => review(application, target)}>{t(`reviewActions.${target}`)}</Button>)}</div>}
            </Card>)}</div>
            <div className="call-editor-actions"><Button variant="secondary" disabled={busy || page === 1} onClick={() => setPage(page - 1)}>{t('previousPage')}</Button><span>{t('applicationPage', { page })}</span><Button variant="secondary" disabled={busy || page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>{t('nextPage')}</Button></div>
        </>}
    </section>;
}
