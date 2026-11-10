import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Checkbox, Field, Input, Textarea } from '../../components/ds';
import api from '../../services/api';
import CallCollaborationNextStep from './CallCollaborationNextStep';
import { currentLoginReturn, loginUrlFor } from '../../utils/loginReturn';
import { CALL_ME_API, type ApplicationKind, type CallMe } from './content';

interface ApplicationFormProps { kind: ApplicationKind; open: boolean; pageVersion: string; donationsOpen?: boolean; custodyNoticeVersion?: string }

export function SignedInCallApplication({ kind, open, pageVersion, donationsOpen = false, custodyNoticeVersion = '' }: ApplicationFormProps) {
    const { t } = useTranslation('tournament-call');
    const [me, setMe] = useState<CallMe | null>(null);
    const [channelId, setChannelId] = useState(0);
    const [contact, setContact] = useState('');
    const [notes, setNotes] = useState('');
    const [contributionType, setContributionType] = useState('vbucks');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [publicListing, setPublicListing] = useState(false);
    const [acceptedRules, setAcceptedRules] = useState(false);
    const [acceptedCustody, setAcceptedCustody] = useState(false);
    const [publicOffer, setPublicOffer] = useState(false);
    const [usesBot, setUsesBot] = useState(false);
    const [willStream, setWillStream] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const existing = me?.applications.find(application => application.kind === kind);
    // El dinero se aporta pagando, sin esperar aprobacion: solo se conserva si la solicitud ya era de dinero.
    const types = existing?.contributionType === 'money' ? ['money', 'vbucks', 'giftcard'] : ['vbucks', 'giftcard'];
    const custody = kind === 'collaborator' && contributionType !== 'money';
    const load = async () => {
        setBusy(true); setError('');
        try {
            const { data } = await api.get<CallMe>(CALL_ME_API);
            const previous = data.applications.find(application => application.kind === kind);
            setMe(data); setChannelId(previous?.channelUserId ?? data.channels[0]?.id ?? 0);
            setContact(previous?.contact || data.contact || ''); setNotes(previous?.notes ?? '');
            setContributionType(previous?.contributionType || 'vbucks'); setPublicOffer(previous?.publicOffer ?? false); setAcceptedCustody(false); setAmount(previous?.amount?.toString() ?? '');
            setCurrency(previous?.currency || 'USD'); setPublicListing(previous?.publicListing ?? false);
            setUsesBot(previous?.usesBot ?? false); setWillStream(previous?.willStream ?? false); setAcceptedRules(false);
        } catch { setError(t('applicationLoadError')); }
        finally { setBusy(false); }
    };
    useEffect(() => { void load(); }, [kind]);
    const submit = async (event: FormEvent) => {
        event.preventDefault(); if (!me || busy) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const response = await api.put(CALL_ME_API, { kind, channelUserId: channelId, contact, notes, contributionType,
                amount: kind === 'collaborator' ? Number(amount) : null, currency: contributionType === 'vbucks' ? '' : currency.trim().toUpperCase(),
                publicListing, acceptedRules, usesBot, willStream, pageVersion, revision: existing?.revision ?? 0,
                acceptedCustody: custody && acceptedCustody, publicOffer: custody && publicListing && publicOffer, custodyNoticeVersion: custody ? custodyNoticeVersion : '' });
            setMe({ ...me, applications: [...me.applications.filter(application => application.kind !== kind), response.data] });
            setAcceptedRules(false); setNotice(t('applicationSaved'));
        } catch (e: any) {
            const code = e.response?.data?.code;
            setError(t(['rules_changed', 'stale_revision', 'applications_closed', 'channel_not_owned', 'invalid_contribution', 'invalid_currency', 'notice_changed', 'custody_required', 'public_offer_requires_listing', 'money_via_payment'].includes(code) ? `applicationErrors.${code}` : 'applicationSaveError'));
        } finally { setBusy(false); }
    };
    const withdraw = async () => {
        if (!existing || !me || busy || !window.confirm(t('confirmWithdraw'))) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const response = await api.post(`${CALL_ME_API}/${kind}/withdraw`, { revision: existing.revision });
            setMe({ ...me, applications: [...me.applications.filter(application => application.kind !== kind), response.data] });
            setPublicListing(false); setNotice(t('applicationWithdrawn'));
        } catch { setError(t('applicationConflictHelp')); }
        finally { setBusy(false); }
    };
    return <div className="call-application">
        {error && <Alert tone="danger">{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
        {!me ? <Button loading={busy} onClick={load}>{t('retry')}</Button> : <>
            {existing && <div className="call-application-status"><strong>{t(`applicationStatus.${existing.status}`)}</strong>{existing.reviewNote && <p>{existing.reviewNote}</p>}<p>{t('approvalMeaning')}</p>{existing.status !== 'withdrawn' && <Button variant="ghost" disabled={busy} onClick={withdraw}>{t('withdraw')}</Button>}</div>}
            {existing && <CallCollaborationNextStep application={existing} donationsOpen={donationsOpen} />}
            {!open ? <Alert>{t('applicationsClosed')}</Alert> : !me.channels.length ? <Alert>{t('linkChannelHelp')} <Link to="/settings">{t('openSettings')}</Link></Alert> : <form onSubmit={submit}>
                <fieldset disabled={busy} className="call-application-fields">
                    <fieldset><legend className="ds-label">{t('yourChannel')}</legend><p className="ds-hint">{t('ownChannelHelp')}</p><div className="call-channel-options">{me.channels.map(channel => <Checkbox key={channel.id} radio name={`channel-${kind}`} checked={channelId === channel.id} onChange={() => setChannelId(channel.id)} label={<span>{channel.name} <span className="call-small">{channel.url}</span></span>} />)}</div></fieldset>
                    <div className="call-form-contact"><Field label={t('contact')} hint={t('contactPrivate')}><Input value={contact} required maxLength={254} autoComplete="email" onChange={event => setContact(event.target.value)} /></Field></div>
                    {kind === 'collaborator' && <>
                        <fieldset><legend className="ds-label">{t('contributionType')}</legend><div className="call-contribution-options">{types.map(id => <Checkbox key={id} radio name={`contribution-${kind}`} checked={contributionType === id} onChange={() => setContributionType(id)} label={t(`contributionTypes.${id}`)} />)}</div></fieldset>
                        <div className="call-offer-fields"><Field label={t('offerAmount')}><Input type="number" min={contributionType === 'vbucks' ? 1 : 0.01} step={contributionType === 'vbucks' ? 1 : 0.01} required value={amount} onChange={event => setAmount(event.target.value)} /></Field>{contributionType !== 'vbucks' && <Field label={t('offerCurrency')} hint={t('currencyHelp')}><Input value={currency} minLength={3} maxLength={3} required pattern="[A-Za-z]{3}" onChange={event => setCurrency(event.target.value.toUpperCase())} /></Field>}</div>
                        {existing?.origin === 'payment' && <Alert>{t('origin.paymentFormHelp')}</Alert>}
                        <Alert>{t(custody ? 'custody.offerHelp' : 'offerIsNotPayment')}</Alert>
                        {custody && contributionType === 'vbucks' && <Alert tone="warn">{t('custody.vbucksNote')}</Alert>}
                        {custody && <>
                            <Alert tone="warn" title={t('custody.title')}>{t('custody.notice')}</Alert>
                            <div className="call-form-consent"><Checkbox checked={acceptedCustody} required onChange={event => setAcceptedCustody(event.target.checked)} label={t('custody.accept')} /></div>
                            <div className="call-form-consent"><Checkbox checked={publicOffer && publicListing} disabled={!publicListing} onChange={event => setPublicOffer(event.target.checked)} label={t('custody.publicOffer')} /><p className="call-small">{t(publicListing ? 'custody.publicOfferHelp' : 'custody.publicOfferNeedsListing')}</p></div>
                        </>}
                    </>}
                    <div className="call-form-notes"><Field label={t(kind === 'collaborator' ? 'promotionNotes' : 'participantNotes')}><Textarea rows={3} maxLength={1500} value={notes} onChange={event => setNotes(event.target.value)} /></Field></div>
                    {kind === 'participant' && <><Checkbox checked={usesBot} required onChange={event => setUsesBot(event.target.checked)} label={t('usesBotDeclaration')} /><Checkbox checked={willStream} required onChange={event => setWillStream(event.target.checked)} label={t('willStreamDeclaration')} /></>}
                    <div className="call-form-consent"><Checkbox checked={publicListing} onChange={event => setPublicListing(event.target.checked)} label={t('publicListingConsent')} /></div>
                    <div className="call-form-consent"><Checkbox checked={acceptedRules} required onChange={event => setAcceptedRules(event.target.checked)} label={t('acceptPublishedRules')} /></div>
                    {existing && <p className="call-small">{t('editingResetsReview')}</p>}
                    <Button type="submit" loading={busy}>{t(existing ? 'updateApplication' : 'sendApplication')}</Button>
                </fieldset>
            </form>}
            <Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm(t('reloadApplicationConfirm'))) void load(); }}>{t('reloadApplication')}</Button>
        </>}
    </div>;
}

export default function CallApplicationForm(props: ApplicationFormProps) {
    const { t } = useTranslation('tournament-call');
    if (!localStorage.getItem('token')) return <div className="call-application"><p>{t(props.open ? 'applicationLoginHelp' : 'applicationsClosed')}</p>{props.open && <Link className="ds-btn ds-btn--primary" to={loginUrlFor(currentLoginReturn())}>{t('applicationLogin')}</Link>}</div>;
    return <SignedInCallApplication {...props} />;
}
