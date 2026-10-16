import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Field, Input, Select, Spinner } from '../../components/ds';
import ModalShell from '../../components/dashboard/ModalShell';
import api from '../../services/api';

// Plan, complementos y ajustes de un tenant (Fase 5.7). Todo son filas: .dev/plans/plataforma/FASE5_DISENO.md §3.

interface Plan { key: string; name: string; isInternal: boolean }
interface Cap { key: string; kind: string; unit: string | null; group: string }
interface Sub { planKey: string; planName: string; status: string; periodMonths: number | null; endsAt: string | null; sandboxEndsAt: string | null; suspendedReason: string | null }
interface Override { key: string; value: number | null; reason: string | null; expiresAt: string | null }
interface Addon { id: number; key: string; value: number | null; endsAt: string | null; source: string }
interface Usage { key: string; periodStart: string; used: number }
interface Detail { subscription: Sub | null; overrides: Override[]; addons: Addon[]; usage: Usage[]; operational: boolean; channels: { used: number; limit: number | null }; admins: { used: number; limit: number | null } }

const STATUSES = ['sandbox', 'active', 'past_due', 'suspended', 'cancelled'];
const PERIODS = ['', '1', '3', '6', '9', '12'];

export default function PlatformPlanModal({ tenantId, tenantName, onClose, onChanged }: { tenantId: number; tenantName: string; onClose: () => void; onChanged: () => void }) {
    const { t, i18n } = useTranslation('platform');
    const [plans, setPlans] = useState<Plan[]>([]);
    const [caps, setCaps] = useState<Cap[]>([]);
    const [d, setD] = useState<Detail | null>(null);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
    const [planKey, setPlanKey] = useState('');
    const [status, setStatus] = useState('active');
    const [period, setPeriod] = useState('');
    const [endsAt, setEndsAt] = useState('');
    const [reason, setReason] = useState('');
    const [ovKey, setOvKey] = useState('');
    const [ovValue, setOvValue] = useState('');
    const [ovReason, setOvReason] = useState('');
    const [adKey, setAdKey] = useState('');
    const [adValue, setAdValue] = useState('');
    const [adSource, setAdSource] = useState('purchase');

    const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.language) : '—');
    const capLabel = (k: string) => t(`tenants.plan.caps.${k}`, { defaultValue: k });
    const errText = (code?: string) => t(`tenants.plan.errors.${code}`, { defaultValue: t('tenants.errors.generic') });
    const valueText = (v: number | null) => (v === null ? t('tenants.plan.unlimited') : String(v));
    const isFlag = (k: string) => caps.find(c => c.key === k)?.kind === 'flag';

    const load = useCallback(async () => {
        try {
            const [cat, det] = await Promise.all([api.get('/admin/platform/plans/catalog'), api.get(`/admin/platform/tenants/${tenantId}/plan`)]);
            setPlans(cat.data.plans.filter((p: Plan) => !p.isInternal));
            setCaps(cat.data.capabilities);
            const detail: Detail = det.data;
            setD(detail);
            if (detail.subscription) {
                setPlanKey(detail.subscription.planKey);
                setStatus(detail.subscription.status);
                setPeriod(detail.subscription.periodMonths ? String(detail.subscription.periodMonths) : '');
                setEndsAt(detail.subscription.endsAt ? detail.subscription.endsAt.slice(0, 10) : '');
                setReason(detail.subscription.suspendedReason ?? '');
            }
        } catch { setNote({ ok: false, text: t('tenants.loadFailed') }); }
    }, [tenantId, t]);
    useEffect(() => { load(); }, [load]);

    const run = async (fn: () => Promise<unknown>, okText: string) => {
        setBusy(true);
        try { await fn(); setNote({ ok: true, text: okText }); await load(); onChanged(); }
        catch (e: any) { setNote({ ok: false, text: errText(e?.response?.data?.code) }); }
        setBusy(false);
    };

    const savePlan = () => run(() => api.put(`/admin/platform/tenants/${tenantId}/plan`, {
        planKey, status, periodMonths: period ? Number(period) : null, endsAt: endsAt ? new Date(endsAt).toISOString() : null, suspendedReason: reason || null,
    }), t('tenants.plan.saved'));

    const saveOverride = () => run(async () => {
        await api.put(`/admin/platform/tenants/${tenantId}/overrides/${encodeURIComponent(ovKey)}`, { value: ovValue === '' ? null : Number(ovValue), reason: ovReason || null });
        setOvKey(''); setOvValue(''); setOvReason('');
    }, t('tenants.plan.saved'));

    const saveAddon = () => run(async () => {
        await api.post(`/admin/platform/tenants/${tenantId}/addons`, { capabilityKey: adKey, value: adValue === '' ? null : Number(adValue), source: adSource });
        setAdKey(''); setAdValue('');
    }, t('tenants.plan.saved'));

    return (
        <ModalShell title={t('tenants.plan.title', { name: tenantName })} size="xl" onClose={() => !busy && onClose()}
            actions={<Button variant="ghost" onClick={onClose} disabled={busy}>{t('tenants.close')}</Button>}>
            {!d ? <div className="flex justify-center py-8"><Spinner /></div> : (
                <div className="space-y-6">
                    {note && <Alert tone={note.ok ? 'ok' : 'danger'}>{note.text}</Alert>}

                    <section className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-ds-text">{t('tenants.plan.current')}</span>
                            <Badge tone={d.operational ? 'ok' : 'danger'}>{d.operational ? t('tenants.plan.operational') : t('tenants.plan.paused')}</Badge>
                            {d.subscription && <Badge tone="accent">{d.subscription.planName}</Badge>}
                        </div>
                        <p className="text-sm text-ds-soft">
                            {t('tenants.plan.usageLine', { channels: d.channels.used, channelsLimit: d.channels.limit ?? '∞', admins: d.admins.used, adminsLimit: d.admins.limit ?? '∞' })}
                        </p>
                        {d.subscription?.sandboxEndsAt && d.subscription.status === 'sandbox' && <p className="text-sm text-ds-soft">{t('tenants.plan.sandboxEnds', { date: fmtDate(d.subscription.sandboxEndsAt) })}</p>}
                    </section>

                    <section className="space-y-3 pt-3 border-t border-ds-border">
                        <h3 className="text-sm font-bold text-ds-text">{t('tenants.plan.assign')}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label={t('tenants.plan.plan')}>
                                <Select value={planKey} onChange={e => setPlanKey(e.target.value)}>
                                    <option value="">—</option>
                                    {plans.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                                </Select>
                            </Field>
                            <Field label={t('tenants.plan.status')}>
                                <Select value={status} onChange={e => setStatus(e.target.value)}>
                                    {STATUSES.map(s => <option key={s} value={s}>{t(`tenants.plan.statuses.${s}`)}</option>)}
                                </Select>
                            </Field>
                            <Field label={t('tenants.plan.period')}>
                                <Select value={period} onChange={e => setPeriod(e.target.value)}>
                                    {PERIODS.map(p => <option key={p} value={p}>{p ? t('tenants.plan.months', { n: p }) : '—'}</option>)}
                                </Select>
                            </Field>
                            <Field label={t('tenants.plan.endsAt')} hint={t('tenants.plan.endsAtHint')}>
                                <Input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
                            </Field>
                        </div>
                        {status === 'suspended' && <Field label={t('tenants.plan.reason')}><Input value={reason} maxLength={200} onChange={e => setReason(e.target.value)} /></Field>}
                        {status === 'sandbox' && <p className="text-sm text-ds-soft">{t('tenants.plan.sandboxHelp')}</p>}
                        <Button onClick={savePlan} loading={busy} disabled={!planKey}>{t('tenants.plan.save')}</Button>
                    </section>

                    <section className="space-y-3 pt-3 border-t border-ds-border">
                        <h3 className="text-sm font-bold text-ds-text">{t('tenants.plan.overridesTitle')}</h3>
                        <p className="text-sm text-ds-soft">{t('tenants.plan.overridesHelp')}</p>
                        {d.overrides.length === 0 ? <p className="text-sm text-ds-soft">{t('tenants.plan.none')}</p> : (
                            <ul className="space-y-1">
                                {d.overrides.map(o => (
                                    <li key={o.key} className="flex flex-wrap items-center gap-2 text-sm">
                                        <span className="text-ds-text">{capLabel(o.key)}</span><Badge>{valueText(o.value)}</Badge>
                                        {o.reason && <span className="text-ds-soft">{o.reason}</span>}
                                        <Button size="sm" variant="ghost" icon={<Trash2 className="w-4 h-4" />} disabled={busy}
                                            onClick={() => run(() => api.delete(`/admin/platform/tenants/${tenantId}/overrides/${encodeURIComponent(o.key)}`), t('tenants.plan.removed'))}>{t('tenants.remove')}</Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_1fr_auto] gap-2 items-end">
                            <Field label={t('tenants.plan.capability')}>
                                <Select value={ovKey} onChange={e => { setOvKey(e.target.value); if (isFlag(e.target.value)) setOvValue('1'); }}>
                                    <option value="">—</option>
                                    {caps.map(c => <option key={c.key} value={c.key}>{capLabel(c.key)}</option>)}
                                </Select>
                            </Field>
                            <Field label={t('tenants.plan.value')} hint={isFlag(ovKey) ? t('tenants.plan.flagHint') : t('tenants.plan.valueHint')}>
                                <Input type="number" min={0} value={ovValue} onChange={e => setOvValue(e.target.value)} />
                            </Field>
                            <Field label={t('tenants.plan.reason')}><Input value={ovReason} maxLength={200} onChange={e => setOvReason(e.target.value)} /></Field>
                            <Button variant="secondary" onClick={saveOverride} loading={busy} disabled={!ovKey}>{t('tenants.plan.add')}</Button>
                        </div>
                    </section>

                    <section className="space-y-3 pt-3 border-t border-ds-border">
                        <h3 className="text-sm font-bold text-ds-text">{t('tenants.plan.addonsTitle')}</h3>
                        <p className="text-sm text-ds-soft">{t('tenants.plan.addonsHelp')}</p>
                        {d.addons.length === 0 ? <p className="text-sm text-ds-soft">{t('tenants.plan.none')}</p> : (
                            <ul className="space-y-1">
                                {d.addons.map(a => (
                                    <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                                        <span className="text-ds-text">{capLabel(a.key)}</span><Badge>{valueText(a.value)}</Badge>
                                        <span className="text-ds-soft">{t(`tenants.plan.sources.${a.source}`)} · {t('tenants.plan.until', { date: fmtDate(a.endsAt) })}</span>
                                        <Button size="sm" variant="ghost" icon={<Trash2 className="w-4 h-4" />} disabled={busy}
                                            onClick={() => run(() => api.delete(`/admin/platform/tenants/${tenantId}/addons/${a.id}`), t('tenants.plan.removed'))}>{t('tenants.remove')}</Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_9rem_auto] gap-2 items-end">
                            <Field label={t('tenants.plan.capability')}>
                                <Select value={adKey} onChange={e => { setAdKey(e.target.value); if (isFlag(e.target.value)) setAdValue('1'); }}>
                                    <option value="">—</option>
                                    {caps.map(c => <option key={c.key} value={c.key}>{capLabel(c.key)}</option>)}
                                </Select>
                            </Field>
                            <Field label={t('tenants.plan.value')} hint={isFlag(adKey) ? t('tenants.plan.flagHint') : t('tenants.plan.valueHint')}>
                                <Input type="number" min={0} value={adValue} onChange={e => setAdValue(e.target.value)} />
                            </Field>
                            <Field label={t('tenants.plan.source')}>
                                <Select value={adSource} onChange={e => setAdSource(e.target.value)}>
                                    {['purchase', 'gift', 'pilot'].map(s => <option key={s} value={s}>{t(`tenants.plan.sources.${s}`)}</option>)}
                                </Select>
                            </Field>
                            <Button variant="secondary" onClick={saveAddon} loading={busy} disabled={!adKey}>{t('tenants.plan.add')}</Button>
                        </div>
                    </section>

                    <section className="space-y-2 pt-3 border-t border-ds-border">
                        <h3 className="text-sm font-bold text-ds-text">{t('tenants.plan.usageTitle')}</h3>
                        {d.usage.length === 0 ? <p className="text-sm text-ds-soft">{t('tenants.plan.noUsage')}</p> : (
                            <ul className="text-sm space-y-1">
                                {d.usage.map(u => <li key={u.key + u.periodStart} className="flex gap-2"><span className="text-ds-text">{capLabel(u.key)}</span><span className="text-ds-soft">{u.periodStart}</span><Badge>{u.used}</Badge></li>)}
                            </ul>
                        )}
                    </section>
                </div>
            )}
        </ModalShell>
    );
}
