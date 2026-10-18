import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Alert, Badge, Button, Card, Checkbox, Empty, Field, Input, Segmented, Select, Spinner, Switch, Table } from '../../../components/ds';
import buyerApi from '../../../services/buyerApi';
import { openCulqiWithKey } from '../../../services/culqi';

// Plan y facturación del comprador (Fase 7.7). El servidor calcula todo (precio, IGV, soles, fechas): aquí solo se elige, se muestra el presupuesto y se pide pagar.
// El dueño compra; el administrador solo ve. Mientras `checkoutEnabled` sea falso el botón de pago no se puede usar.

export type Phase = 'none' | 'internal' | 'sandbox' | 'suspended' | 'active' | 'grace' | 'expired';
export interface BillingState {
    phase: Phase;
    subscription: { plan: string; planName: string; status: string; periodMonths: number | null; startsAt: string; endsAt: string | null; graceUntil: string | null;
        sandboxEndsAt: string | null; daysLeft: number | null; graceDaysLeft: number | null } | null;
    addons: { key: string; endsAt: string | null }[];
    profile: { legalName: string | null; country: string | null; docType: string | null; docNumber: string | null; email: string | null; payMode: string; hasSavedCard: boolean } | null;
    billable: boolean; checkoutEnabled: boolean; autoAvailable: boolean; penPerUsd: number;
}
interface Plan { key: string; name: string; modules: string[]; prices: Record<string, number> }
interface Addon { key: string; includedIn: string | null; prices: Record<string, number> }
interface Quote {
    kind: 'new' | 'renew' | 'upgrade' | 'addons'; plan: string; months: number; planUsd: number; addons: { key: string; usd: number }[]; addonsUsd: number; capped: boolean;
    totalUsd: number; taxTreatment: 'igv' | 'export'; baseUsd: number; igvUsd: number; totalPen: number; penPerUsd: number; startsAt: string; endsAt: string;
    proration?: { newPeriodUsd: number; currentPeriodUsd: number; remainingDays: number; periodDays: number } | null;
}
interface Payment {
    id: number; purpose: string; plan: string | null; periodMonths: number; amountUsd: number; amountPen: number | null; status: string; isTest: boolean;
    createdAt: string; paidAt: string | null; periodEnds: string | null; addons: string[]; invoiceType: string | null; invoiceNumber: string | null; canDownload: boolean;
}

const PERIODS = [1, 3, 6, 9, 12];
const COUNTRIES = ['PE', 'AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'EC', 'SV', 'ES', 'US', 'GT', 'HN', 'MX', 'NI', 'PA', 'PY', 'DO', 'UY', 'VE'];
const DOC_TYPES = ['DNI', 'RUC', 'CE', 'PASAPORTE', 'OTRO'];
const modId = (k: string) => k.replace(/^module\./, '');
const PHASE_TONE: Record<Phase, 'ok' | 'warn' | 'danger' | 'accent' | undefined> = { none: undefined, internal: undefined, sandbox: 'accent', suspended: 'danger', active: 'ok', grace: 'warn', expired: 'danger' };

/** Aviso fijo de gracia o vencimiento: va arriba de todo el panel, en cualquier pestaña. */
export function GraceBanner({ state, owner, onRenew }: { state: BillingState | null; owner: boolean; onRenew: () => void }) {
    const { t, i18n } = useTranslation('platform');
    if (!state || (state.phase !== 'grace' && state.phase !== 'expired')) return null;
    const sub = state.subscription!;
    const date = (s: string | null) => (s ? new Date(s).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' }) : '');
    return state.phase === 'grace'
        ? (
            <Alert tone="warn" title={t('billing.grace.title')}>
                <p>{t('billing.grace.text', { ends: date(sub.endsAt), until: date(sub.graceUntil), count: sub.graceDaysLeft ?? 0 })}</p>
                {owner && <Button size="sm" className="mt-3" onClick={onRenew}>{t('billing.grace.renew')}</Button>}
            </Alert>
        )
        : (
            <Alert tone="danger" title={t('billing.expired.title')}>
                <p>{t('billing.expired.text', { ends: date(sub.endsAt) })}</p>
                {owner && <Button size="sm" className="mt-3" onClick={onRenew}>{t('billing.expired.renew')}</Button>}
            </Alert>
        );
}

export default function BuyerPlan({ state, owner, reload }: { state: BillingState | null; owner: boolean; reload: () => void }) {
    const { t, i18n } = useTranslation('platform');
    const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
    const money = useMemo(() => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [lang]);
    const date = (s: string | null) => (s ? new Date(s).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
    const countryName = useMemo(() => { try { return new Intl.DisplayNames([lang], { type: 'region' }); } catch { return null; } }, [lang]);

    const [catalog, setCatalog] = useState<{ plans: Plan[]; addons: Addon[] } | null>(null);
    const [payments, setPayments] = useState<Payment[] | null>(null);
    const [paymentsFailed, setPaymentsFailed] = useState(false);

    const [planKey, setPlanKey] = useState('');
    const [months, setMonths] = useState(1);
    const [picked, setPicked] = useState<string[]>([]);
    const [country, setCountry] = useState('PE');
    const [legalName, setLegalName] = useState('');
    const [docType, setDocType] = useState('DNI');
    const [docNumber, setDocNumber] = useState('');
    const [email, setEmail] = useState('');
    const [factura, setFactura] = useState(false);

    const [quote, setQuote] = useState<Quote | null>(null);
    const [quoteErr, setQuoteErr] = useState('');
    const [key, setKey] = useState<{ publicKey: string; testMode: boolean } | null>(null);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
    const seeded = useRef(false);

    const loadPayments = useCallback(async () => {
        try { const r = await buyerApi.get('/platform/buyer/billing/payments'); setPayments(r.data.payments); setPaymentsFailed(false); }
        catch { setPaymentsFailed(true); }
    }, []);
    useEffect(() => { loadPayments(); }, [loadPayments]);
    useEffect(() => {
        fetch('/api/platform/plans').then(r => (r.ok ? r.json() : Promise.reject())).then(j => setCatalog({ plans: j.plans, addons: j.addons })).catch(() => setCatalog(null));
    }, []);
    useEffect(() => {
        if (!owner) return;
        buyerApi.get('/platform/buyer/billing/culqi-key').then(r => setKey({ publicKey: r.data.publicKey, testMode: !!r.data.testMode })).catch(() => setKey(null));
    }, [owner]);

    // Primera carga: parte del plan y el periodo vigentes y del perfil guardado
    useEffect(() => {
        if (seeded.current || !state || !catalog) return;
        seeded.current = true;
        const cur = state.subscription?.plan;
        setPlanKey(catalog.plans.some(p => p.key === cur) ? cur! : catalog.plans[0]?.key ?? '');
        if (state.subscription?.periodMonths && PERIODS.includes(state.subscription.periodMonths)) setMonths(state.subscription.periodMonths);
        const p = state.profile;
        if (p) {
            setCountry(p.country || 'PE'); setLegalName(p.legalName ?? ''); setDocType(p.docType || 'DNI'); setDocNumber(p.docNumber ?? ''); setEmail(p.email ?? '');
        }
    }, [state, catalog]);

    // Plan vigente y a mitad de periodo: solo se puede subir de plan o sumar módulos, y el periodo se mantiene (salvo al renovar, en los 7 días previos al vencimiento).
    const curKey = state?.subscription?.plan ?? '';
    const midPeriod = state?.phase === 'active' && !!state.subscription?.endsAt && (catalog?.plans.some(p => p.key === curKey) ?? false);
    const inRenewWindow = midPeriod && (state!.subscription!.daysLeft ?? 99) <= 7;
    const curIdx = catalog?.plans.findIndex(p => p.key === curKey) ?? -1;
    const plans = catalog ? (midPeriod ? catalog.plans.filter((_, i) => i >= curIdx) : catalog.plans) : [];
    const monthsLocked = midPeriod && !(planKey === curKey && inRenewWindow);
    const lockedMonths = state?.subscription?.periodMonths ?? 1;
    const owned = state?.addons.map(a => a.key) ?? [];
    const plan = catalog?.plans.find(p => p.key === planKey);
    useEffect(() => { if (monthsLocked) setMonths(lockedMonths); }, [monthsLocked, lockedMonths]);
    const offered = useMemo(() => (catalog?.addons ?? []).filter(a => a.key.startsWith('module.') && plan && !plan.modules.includes(a.key) && a.prices[String(months)] != null), [catalog, plan, months]);
    useEffect(() => { setPicked(p => p.filter(k => offered.some(a => a.key === k))); }, [offered]);

    // Presupuesto (el servidor es la única fuente del precio)
    useEffect(() => {
        if (!owner || !planKey) return;
        let live = true;
        const timer = setTimeout(async () => {
            try {
                const r = await buyerApi.post('/platform/buyer/billing/quote', { planKey, months, addons: picked, country });
                if (live) { setQuote(r.data); setQuoteErr(''); }
            } catch (e: any) { if (live) { setQuote(null); setQuoteErr(e?.response?.data?.code || 'generic'); } }
        }, 250);
        return () => { live = false; clearTimeout(timer); };
    }, [owner, planKey, months, picked, country]);

    const err = (code?: string) => t(`billing.errors.${code}`, { defaultValue: t('billing.errors.generic') });
    const modName = (k: string) => t(`plans.modules.${modId(k)}`, modId(k));

    const pay = async () => {
        if (!quote || !key || busy) return;
        setNote(null);
        if (!legalName.trim()) { setNote({ ok: false, text: err('name_required') }); return; }
        if (factura && docType !== 'RUC') { setNote({ ok: false, text: err('factura_needs_ruc') }); return; }
        setBusy(true);
        try {
            await buyerApi.put('/platform/buyer/billing/profile', { legalName, country, docType, docNumber, email });
            const c = await openCulqiWithKey(key.publicKey, Math.round(quote.totalPen * 100), `Decatron — ${plan?.name ?? ''}`, lang);
            const r = await buyerApi.post('/platform/buyer/billing/checkout', {
                planKey, months, addons: picked, country, token: c.token, email: email.trim(), firstName: c.firstName, lastName: c.lastName,
                legalName, docType, docNumber, preferFactura: factura,
            });
            setNote({ ok: true, text: t('billing.paid', { date: date(r.data.endsAt) }) });
            reload(); await loadPayments();
        } catch (e: any) {
            const code = e?.response?.data?.code;
            setNote({ ok: false, text: code === 'charge_failed' && e.response.data.message ? e.response.data.message : code ? err(code) : (e?.message && !e.response ? e.message : err('generic')) });
        }
        setBusy(false);
    };

    const download = async (p: Payment, fmt: 'pdf' | 'xml') => {
        try {
            const r = await buyerApi.get(`/platform/buyer/billing/payments/${p.id}/download/${fmt}`, { responseType: 'blob' });
            const url = URL.createObjectURL(r.data);
            const a = document.createElement('a'); a.href = url; a.download = `${p.invoiceNumber ?? `pago-${p.id}`}.${fmt}`; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch { setNote({ ok: false, text: err('file_unavailable') }); }
    };

    if (!state) return <div className="text-center"><Spinner /></div>;
    const sub = state.subscription;
    const canBuy = owner && state.billable;
    const payDisabled = !state.checkoutEnabled || !quote || !key || busy;

    return (
        <div className="space-y-6">
            <Card>
                <div className="p-5 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold text-ds-text">{t('billing.current')}</h2>
                        <Badge tone={PHASE_TONE[state.phase]}>{t(`billing.phase.${state.phase}`)}</Badge>
                    </div>
                    {sub ? (
                        <dl className="grid sm:grid-cols-2 gap-4">
                            <div><dt className="text-sm text-ds-faint">{t('buyer.plan')}</dt><dd className="text-ds-text font-semibold">{sub.planName}</dd></div>
                            <div><dt className="text-sm text-ds-faint">{state.phase === 'sandbox' ? t('billing.trialEnds') : t('billing.renewsOn')}</dt>
                                <dd className="text-ds-text font-semibold">{state.phase === 'internal' ? '—' : state.phase === 'active' && !sub.endsAt ? t('billing.noExpiry') : date(state.phase === 'sandbox' ? sub.sandboxEndsAt : sub.endsAt)}</dd></div>
                            {sub.periodMonths && <div><dt className="text-sm text-ds-faint">{t('billing.period')}</dt><dd className="text-ds-text font-semibold">{t(`plans.period.${sub.periodMonths}`)}</dd></div>}
                            {state.addons.length > 0 && <div><dt className="text-sm text-ds-faint">{t('billing.addons')}</dt><dd className="text-ds-text font-semibold">{state.addons.map(a => modName(a.key)).join(', ')}</dd></div>}
                        </dl>
                    ) : <p className="text-ds-soft">{t('billing.noPlan')}</p>}
                    {state.phase === 'internal' && <p className="text-sm text-ds-soft">{t('billing.internal')}</p>}
                </div>
            </Card>

            {note && <Alert tone={note.ok ? 'ok' : 'danger'}>{note.text}</Alert>}

            {!owner && <Alert tone="info">{t('billing.readOnly')}</Alert>}

            {canBuy && (
                <Card>
                    <div className="p-5 space-y-5">
                        <h2 className="text-xl font-bold text-ds-text">{midPeriod && !inRenewWindow ? t('billing.changeTitle') : sub && state.phase === 'active' ? t('billing.renewTitle') : t('billing.buyTitle')}</h2>
                        {!state.checkoutEnabled && <Alert tone="info">{t('billing.disabled')}</Alert>}
                        {key?.testMode && <Alert tone="warn">{t('billing.testMode')}</Alert>}
                        {!catalog ? <div className="text-center"><Spinner /></div> : <>
                            <Field label={t('billing.choosePlan')}>
                                <Segmented value={planKey} onChange={setPlanKey} items={plans.map(p => ({ id: p.key, label: p.name }))} />
                            </Field>
                            <Field label={t('plans.periodLabel')} hint={monthsLocked ? t('billing.periodLocked') : undefined}>
                                <div className="max-w-full overflow-x-auto [&_button]:whitespace-nowrap">
                                    <Segmented value={String(months)} onChange={id => { if (!monthsLocked) setMonths(Number(id)); }}
                                        items={(monthsLocked ? [lockedMonths] : PERIODS.filter(m => catalog.plans.every(p => p.prices[String(m)] != null))).map(m => ({ id: String(m), label: t(`plans.period.${m}`) }))} />
                                </div>
                            </Field>
                            {offered.length > 0 && (
                                <Field label={t('billing.chooseAddons')} hint={t('billing.addonsHint')}>
                                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
                                        {offered.map(a => owned.includes(a.key) ? (
                                            <Checkbox key={a.key} checked disabled label={`${modName(a.key)} · ${t('billing.owned')}`} />
                                        ) : (
                                            <Checkbox key={a.key} checked={picked.includes(a.key)} onChange={e => setPicked(p => (e.target.checked ? [...p, a.key] : p.filter(k => k !== a.key)))}
                                                label={`${modName(a.key)} · ${t('plans.usd', { amount: money.format(a.prices[String(months)]) })}`} />
                                        ))}
                                    </div>
                                </Field>
                            )}

                            <div className="grid sm:grid-cols-2 gap-4">
                                <Field label={t('billing.legalName')}><Input value={legalName} maxLength={200} onChange={e => setLegalName(e.target.value)} /></Field>
                                <Field label={t('billing.email')}><Input type="email" value={email} maxLength={254} onChange={e => setEmail(e.target.value)} /></Field>
                                <Field label={t('billing.country')}>
                                    <Select value={country} onChange={e => setCountry(e.target.value)}>
                                        {COUNTRIES.map(c => <option key={c} value={c}>{countryName?.of(c) ?? c}</option>)}
                                    </Select>
                                </Field>
                                <div className="grid grid-cols-[8rem_1fr] gap-3">
                                    <Field label={t('billing.docType')}>
                                        <Select value={docType} onChange={e => setDocType(e.target.value)}>{DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}</Select>
                                    </Field>
                                    <Field label={t('billing.docNumber')}><Input value={docNumber} maxLength={30} onChange={e => setDocNumber(e.target.value)} /></Field>
                                </div>
                            </div>
                            <Checkbox checked={factura} onChange={e => setFactura(e.target.checked)} label={t('billing.factura')} />

                            {quoteErr && <Alert tone="warn">{err(quoteErr)}</Alert>}
                            {quote && (
                                <div className="rounded-xl border border-ds-border-soft p-4 space-y-1.5 text-sm">
                                    {quote.proration ? <>
                                        <div className="flex justify-between"><span className="text-ds-soft">{t('billing.prorationNew', { plan: plan?.name })}</span><span className="text-ds-text">{t('plans.usd', { amount: money.format(quote.proration.newPeriodUsd) })}</span></div>
                                        <div className="flex justify-between"><span className="text-ds-soft">{t('billing.prorationPaid')}</span><span className="text-ds-text">− {t('plans.usd', { amount: money.format(quote.proration.currentPeriodUsd) })}</span></div>
                                        <p className="text-ds-faint">{t('billing.prorationDays', { days: quote.proration.remainingDays, period: quote.proration.periodDays })}</p>
                                    </> : <div className="flex justify-between"><span className="text-ds-soft">{plan?.name} · {t(`plans.period.${quote.months}`)}</span><span className="text-ds-text">{t('plans.usd', { amount: money.format(quote.planUsd) })}</span></div>}
                                    {!quote.proration && quote.addons.map(a => <div key={a.key} className="flex justify-between"><span className="text-ds-soft">{modName(a.key)}</span><span className="text-ds-text">{t('plans.usd', { amount: money.format(a.usd) })}</span></div>)}
                                    {quote.capped && <p className="text-ds-faint">{t('billing.capped')}</p>}
                                    {quote.proration && quote.addons.length > 0 && <p className="text-ds-faint">{t('billing.prorationAdds', { modules: quote.addons.map(a => modName(a.key)).join(', ') })}</p>}
                                    <div className="flex justify-between"><span className="text-ds-soft">{quote.taxTreatment === 'igv' ? t('billing.taxBase') : t('billing.taxExport')}</span><span className="text-ds-text">{t('plans.usd', { amount: money.format(quote.baseUsd) })}</span></div>
                                    {quote.taxTreatment === 'igv' && <div className="flex justify-between"><span className="text-ds-soft">{t('billing.igv')}</span><span className="text-ds-text">{t('plans.usd', { amount: money.format(quote.igvUsd) })}</span></div>}
                                    <div className="flex justify-between border-t border-ds-border-soft pt-2 font-semibold text-base"><span className="text-ds-text">{quote.proration ? t('billing.toPayToday') : t('billing.total')}</span><span className="text-ds-text">{t('plans.usd', { amount: money.format(quote.totalUsd) })}</span></div>
                                    <div className="flex justify-between"><span className="text-ds-soft">{t('billing.chargedPen', { rate: money.format(quote.penPerUsd) })}</span><span className="text-ds-text">S/ {money.format(quote.totalPen)}</span></div>
                                    <p className="text-ds-faint pt-1">{t('billing.validUntil', { date: date(quote.endsAt) })}</p>
                                </div>
                            )}
                            <p className="text-sm text-ds-faint">{t('billing.finePrint')}</p>
                            <Button loading={busy} disabled={payDisabled} onClick={pay}>
                                {quote ? t('billing.pay', { usd: money.format(quote.totalUsd), pen: money.format(quote.totalPen) }) : t('billing.payShort')}
                            </Button>
                        </>}
                    </div>
                </Card>
            )}

            {owner && (
                <Card>
                    <div className="p-5 space-y-3">
                        <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold text-ds-text">{t('billing.auto.title')}</h2><Badge>{t('billing.auto.soon')}</Badge></div>
                        <p className="text-sm text-ds-soft">{t('billing.auto.text')}</p>
                        <Switch checked={false} disabled label={t('billing.auto.label')} />
                    </div>
                </Card>
            )}

            <Card>
                <div className="p-5 space-y-4">
                    <h2 className="text-xl font-bold text-ds-text">{t('billing.history')}</h2>
                    {paymentsFailed && <Alert tone="danger">{t('buyer.errorLoad')}</Alert>}
                    {!payments && !paymentsFailed && <div className="text-center"><Spinner /></div>}
                    {payments && payments.length === 0 && <Empty icon={<Download className="w-6 h-6" />} title={t('billing.noPayments')} />}
                    {payments && payments.length > 0 && (
                        <Table
                            head={[t('billing.colDate'), t('billing.colConcept'), t('billing.colAmount'), t('billing.colStatus'), t('billing.colInvoice')]}
                            rows={payments.map(p => [
                                date(p.paidAt ?? p.createdAt),
                                <>{catalog?.plans.find(x => x.key === p.plan)?.name ?? p.plan ?? '—'} · {t(`plans.period.${p.periodMonths}`)}{p.addons.length > 0 && <span className="block text-ds-faint text-xs">{p.addons.map(modName).join(', ')}</span>}</>,
                                <span className="whitespace-nowrap">{t('plans.usd', { amount: money.format(p.amountUsd) })}{p.amountPen != null && <span className="block text-ds-faint text-xs">S/ {money.format(p.amountPen)}</span>}</span>,
                                <span className="inline-flex flex-wrap gap-1.5"><Badge tone={p.status === 'paid' ? 'ok' : p.status === 'failed' ? 'danger' : 'warn'}>{t(`billing.status.${p.status}`)}</Badge>{p.isTest && <Badge>{t('billing.test')}</Badge>}</span>,
                                p.invoiceNumber
                                    ? <span className="inline-flex flex-wrap items-center gap-2">{p.invoiceNumber}{owner && p.canDownload && <>
                                        <Button size="sm" variant="ghost" onClick={() => download(p, 'pdf')}>PDF</Button>
                                        <Button size="sm" variant="ghost" onClick={() => download(p, 'xml')}>XML</Button></>}</span>
                                    : <span className="text-ds-faint">{p.status === 'paid' ? t('billing.invoicePending') : '—'}</span>,
                            ])}
                        />
                    )}
                </div>
            </Card>
        </div>
    );
}
