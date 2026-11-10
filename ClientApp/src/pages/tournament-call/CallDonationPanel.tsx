import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Checkbox, DsRoot, Field, Input } from '../../components/ds';
import api from '../../services/api';
import { cobrarConCulqi, openCulqiWithKey } from '../../services/culqi';
import { currentLoginReturn, loginUrlFor } from '../../utils/loginReturn';
import { CALL_ME_API, CALL_PATH, type CallMe } from './content';
import { DONATIONS_API, type DonationReceipt } from './contributions';
import './call.css';

interface Quote { receiptKey: string; reference: string; amountUsd: number; amountPen: number; publicKey: string; isTest: boolean }
const STORAGE = 'tournament-call-donation-receipt-v1';
function storedQuote(): Quote | null {
    try {
        const value = JSON.parse(sessionStorage.getItem(STORAGE) ?? 'null');
        return /^[A-F0-9]{64}$/.test(value?.receiptKey) && typeof value.reference === 'string' && typeof value.publicKey === 'string' &&
            typeof value.amountUsd === 'number' && Number.isFinite(value.amountUsd) && value.amountUsd > 0 &&
            typeof value.amountPen === 'number' && Number.isFinite(value.amountPen) && value.amountPen > 0 ? value : null;
    }
    catch { return null; }
}

interface Props {
    target: string;
    /** Dentro del modal «Colaborar»: sin cabecera de pagina ni enlace de regreso. */
    embedded?: boolean;
    /** Avisa a la pagina que el estado del aporte cambio (para refrescar «Mis aportes»). */
    onChanged?: () => void;
}

/**
 * Aporte de dinero a la convocatoria. Un solo boton «Pagar»: prepara el intento (con la sesion, si la hay) y abre el
 * checkout de Culqi. El intento queda guardado antes de abrir la pasarela, asi que recargar recupera el mismo recibo
 * en lugar de crear otro. Sin sesion el aporte es anonimo; con sesion se puede aparecer con el canal propio.
 */
export default function CallDonationPanel({ target, embedded = false, onChanged }: Props) {
    const { t, i18n } = useTranslation('tournament-call');
    const loggedIn = !!localStorage.getItem('token');
    const [amount, setAmount] = useState(''); const [publicIdentity, setPublicIdentity] = useState(false); const [displayName, setDisplayName] = useState('');
    const [open, setOpen] = useState<boolean | null>(null); const [quote, setQuote] = useState<Quote | null>(storedQuote);
    const [destinationError, setDestinationError] = useState(false);
    const [receipt, setReceipt] = useState<DonationReceipt | null>(null);
    const [busy, setBusy] = useState(false); const [error, setError] = useState('');
    const [checked, setChecked] = useState(false);
    const [me, setMe] = useState<CallMe | null>(null); const [channelId, setChannelId] = useState(0);
    const activeKey = useRef(quote?.receiptKey);
    activeKey.current = quote?.receiptKey;
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (embedded || window.location.hash !== '#donar') return;
        const frame = requestAnimationFrame(() => document.getElementById('donar')?.scrollIntoView({ block: 'start' }));
        return () => cancelAnimationFrame(frame);
    }, [target, embedded]);
    useEffect(() => {
        if (!loggedIn) return;
        let alive = true;
        api.get<CallMe>(CALL_ME_API).then(({ data }) => { if (alive) { setMe(data); setChannelId(data.channels[0]?.id ?? 0); } }).catch(() => { });
        return () => { alive = false; };
    }, [loggedIn]);
    const channel = me?.channels.find(c => c.id === channelId);
    const readReceipt = async (q: Quote | null = quote) => {
        if (!q || target !== 'fortnite-streamers') return;
        try {
            const response = await api.post(DONATIONS_API + '/receipt', { receiptKey: q.receiptKey });
            if (activeKey.current === q.receiptKey) { setReceipt(response.data); setChecked(true); onChanged?.(); }
        }
        catch { if (activeKey.current === q.receiptKey) { setError(t('funding.receiptError')); setChecked(false); } }
    };
    useEffect(() => {
        const controller = new AbortController(); setOpen(null); setDestinationError(false);
        if (target !== 'fortnite-streamers') { setOpen(false); return; }
        fetch('/api' + CALL_PATH, { signal: controller.signal, cache: 'no-store' }).then(async r => {
            if (r.status === 404) { setOpen(false); return; }
            if (!r.ok) throw new Error(); const data = await r.json(); setOpen(data.donationsOpen === true);
        }).catch(e => { if (e.name !== 'AbortError') { setOpen(false); setDestinationError(true); } });
        return () => controller.abort();
    }, [target, attempt]);
    useEffect(() => { void readReceipt(); }, [quote?.receiptKey, target]);

    /** Abre Culqi y cobra. Nunca repite un cobro: el servidor decide con el estado guardado del intento. */
    const runPayment = async (q: Quote) => {
        try {
            const token = await openCulqiWithKey(q.publicKey, Math.round(q.amountPen * 100), t('funding.checkoutTitle'), i18n.language.startsWith('en') ? 'en' : 'es');
            await cobrarConCulqi({ ...token, enviar: extra => api.post(DONATIONS_API + '/charge', {
                receiptKey: q.receiptKey, culqiToken: token.token, culqiEmail: token.email,
                firstName: token.firstName, lastName: token.lastName, ...extra,
            }) });
        } catch (e: any) {
            if (activeKey.current === q.receiptKey) setError(t(`funding.errors.${e.response?.data?.code ?? 'payment_review_required'}`, { defaultValue: t('funding.paymentHelp') }));
        }
        finally { if (activeKey.current === q.receiptKey) { setBusy(false); await readReceipt(q); } }
    };
    const submit = async (event: FormEvent) => {
        event.preventDefault(); if (busy || quote || !open) return;
        setBusy(true); setError('');
        let prepared: Quote;
        try {
            const response = await api.post<Quote>(DONATIONS_API + '/prepare', { amountUsd: Number(amount), publicIdentity: loggedIn && publicIdentity,
                displayName: loggedIn && publicIdentity ? displayName : '', channelUserId: loggedIn && channelId ? channelId : null });
            prepared = response.data;
            // Guardar antes de abrir la pasarela: una recarga debe recuperar este intento y no crear otro.
            sessionStorage.setItem(STORAGE, JSON.stringify(prepared)); activeKey.current = prepared.receiptKey; setChecked(false); setQuote(prepared);
        } catch (e: any) { setError(t(`funding.errors.${e.response?.data?.code ?? 'save_failed'}`, { defaultValue: t('funding.prepareError') })); setBusy(false); return; }
        await readReceipt(prepared);
        await runPayment(prepared);
    };
    const pay = async () => {
        if (!quote || busy || !checked || receipt?.state !== 'prepared' || !open) return;
        setBusy(true); setError(''); await runPayment(quote);
    };
    const cancel = async () => {
        if (!quote) return; setError('');
        try {
            const response = await api.post(DONATIONS_API + '/cancel', { receiptKey: quote.receiptKey });
            setReceipt(response.data); setBusy(false);
        } catch { setError(t('funding.paymentHelp')); await readReceipt(); }
    };
    const withdraw = async () => {
        if (!quote || busy) return; setBusy(true); setError('');
        try { setReceipt((await api.post(DONATIONS_API + '/withdraw-identity', { receiptKey: quote.receiptKey })).data); onChanged?.(); }
        catch { setError(t('funding.receiptError')); } finally { setBusy(false); }
    };
    const charged = receipt?.state === 'charged';
    const body = <>
        {!embedded && <Link className="ds-btn ds-btn--ghost" to={CALL_PATH}>{t('backCall')}</Link>}
        <p className="call-kicker">{t('funding.destination')}</p><h2>{t('funding.donateTitle')}</h2>
        <p className="call-body">{t('funding.donationHelp')}</p><p className="call-small">{t('funding.feeHelp')}</p>
        <p className="call-small">{t('funding.noApprovalNeeded')}</p>
        {error && <Alert tone="danger">{error}</Alert>}
        {open === null ? <p>{t('loading')}</p> : !open && <Alert tone={destinationError ? 'danger' : 'info'}>{t(destinationError ? 'funding.destinationUnavailable' : 'funding.closed')} <Button variant="ghost" onClick={() => setAttempt(attempt + 1)}>{t('retry')}</Button></Alert>}
        {quote ? <>
            <dl className="call-review-details"><div><dt>{t('funding.reference')}</dt><dd>{quote.reference}</dd></div><div><dt>{t('funding.quote')}</dt><dd>US${quote.amountUsd.toFixed(2)} → PEN {quote.amountPen.toFixed(2)}</dd></div></dl>
            {quote.isTest && !receipt && <Alert>{t('funding.testPayment')}</Alert>}
            {receipt && <Alert tone={charged && receipt.reviewStatus === 'confirmed' ? 'ok' : 'info'}><strong>{t(`funding.paymentStates.${receipt.state}`)}</strong><p>{t(receipt.state === 'failed' ? 'funding.failedHelp' : receipt.isTest ? 'funding.testPayment' : receipt.reviewStatus === 'confirmed' ? 'funding.receivedConfirmed' : receipt.reviewStatus === 'reversed' ? 'funding.reversedHelp' : charged ? 'funding.awaitingReview' : 'funding.paymentHelp')}</p>
                {charged && loggedIn && !receipt.isTest && receipt.reviewStatus === 'pending' && <p>{t('funding.linkedProfileHelp')}</p>}</Alert>}
            {receipt?.reviewStatus === 'confirmed' && <dl className="call-review-details"><div><dt>{t('funding.received')}</dt><dd>{receipt.receivedAmount} {receipt.currency}</dd></div><div><dt>{t('funding.allocated')}</dt><dd>{receipt.prizeAmount} {receipt.currency}</dd></div></dl>}
            <div className="call-editor-actions">
                {checked && receipt?.state === 'prepared' && <Button loading={busy} disabled={!open} onClick={pay}>{t('funding.pay')}</Button>}
                <Button variant="secondary" onClick={() => readReceipt()}>{t('funding.checkReceipt')}</Button>
                {receipt?.publicIdentity && <Button variant="ghost" disabled={busy} onClick={withdraw}>{t('funding.withdrawIdentity')}</Button>}
                {busy && receipt?.state === 'prepared' && <Button variant="ghost" onClick={() => setBusy(false)}>{t('funding.windowClosed')}</Button>}
                {['prepared', 'authenticating'].includes(receipt?.state ?? '') && <Button variant="ghost" onClick={cancel}>{t('funding.cancelAttempt')}</Button>}
                {(receipt?.state === 'failed' || charged) && <Button variant="secondary" disabled={busy} onClick={() => { sessionStorage.removeItem(STORAGE); setQuote(null); setReceipt(null); setChecked(false); setAmount(''); }}>{t(charged ? 'funding.contributeAgain' : 'funding.startAgain')}</Button>}
            </div><p className="call-small">{t('funding.keepReference')}</p>
        </> : open && <form onSubmit={submit} className="call-application-fields mt-6">
            <Field label={t('funding.amountUsd')}><Input type="number" required min={1} max={10000} step={.01} value={amount} disabled={busy} onChange={e => setAmount(e.target.value)} /></Field>
            {loggedIn ? <>
                {(me?.channels.length ?? 0) > 1 && <fieldset><legend className="ds-label">{t('funding.channelChoice')}</legend><div className="call-channel-options">{me!.channels.map(c => <Checkbox key={c.id} radio name="donation-channel" checked={channelId === c.id} disabled={busy}
                    onChange={() => { setChannelId(c.id); if (publicIdentity) setDisplayName(c.name); }} label={<span>{c.name} <span className="call-small">{c.url}</span></span>} />)}</div></fieldset>}
                <Checkbox label={t('funding.profileConsent')} checked={publicIdentity} disabled={busy} onChange={e => { setPublicIdentity(e.target.checked); if (e.target.checked && !displayName) setDisplayName(channel?.name ?? ''); }} />
                <p className="call-small">{t(publicIdentity ? 'funding.profileConsentHelp' : 'funding.privateProfileHelp')}</p>
                {publicIdentity && <Field label={t('funding.publicName')}><Input required maxLength={100} disabled={busy} value={displayName} onChange={e => setDisplayName(e.target.value)} /></Field>}
            </> : <Alert>{t('funding.anonymousNoSession')} <Link className="ds-btn ds-btn--secondary mt-4" to={loginUrlFor(currentLoginReturn())}>{t('applicationLogin')}</Link></Alert>}
            <Button type="submit" loading={busy} disabled={busy || (loggedIn && publicIdentity && !displayName.trim())}>{t('funding.payAction')}</Button>
        </form>}
    </>;
    // Contenedor elegido en el render (no un componente interno): un componente nuevo en cada render haria perder el foco al escribir.
    return embedded
        ? <div id="donar" className="call-donation-panel call-funding-controls call-donation-embedded">{body}</div>
        : <DsRoot theme="dark" className="call-page call-donation-root"><section id="donar" className="call-wrap call-section call-donation-panel call-funding-controls">{body}</section></DsRoot>;
}
