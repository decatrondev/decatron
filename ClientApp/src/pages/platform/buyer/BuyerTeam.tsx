import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Card, Empty, Field, Input, Spinner, Tabs } from '../../../components/ds';
import { Users } from 'lucide-react';
import buyerApi from '../../../services/buyerApi';

// Equipo del tenant (solo el dueño): administradores con invitación por correo y, aparte, los streamers que entraron por Twitch (solo lectura).
// Todo lo decide el servidor (cuota, topes, rol vigente); aquí solo se muestra y se piden las acciones. Las horas llegan como segundos Unix.
interface Member { userId: number; email: string; role: 'owner' | 'admin'; since: number }
interface Invitation { id: number; email: string; createdAt: number; expiresAt: number }
interface Viewer { login: string; displayName: string; since: number }
interface Data {
    members: Member[]; invitations: Invitation[]; viewers: Viewer[];
    seats: { used: number; pending: number; limit: number | null };
    included: boolean; canInvite: boolean; inviteDays: number;
}
type Note = { ok: boolean; text: string } | null;
const BASE = '/platform/buyer/team';

export default function BuyerTeam() {
    const { t, i18n } = useTranslation('platform');
    const [data, setData] = useState<Data | null>(null);
    const [failed, setFailed] = useState(false);
    const [tab, setTab] = useState('admins');
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<Note>(null);
    const [confirm, setConfirm] = useState<number | null>(null);

    const load = useCallback(async () => {
        try { const r = await buyerApi.get(BASE); setData(r.data); setFailed(false); }
        catch { setFailed(true); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const errText = (code?: string) => t(`buyer.team.errors.${code}`, { defaultValue: t('tenants.errors.generic') });
    const run = async (fn: () => Promise<unknown>, okText: string, after?: () => void) => {
        setBusy(true); setNote(null);
        try { await fn(); setNote({ ok: true, text: okText }); after?.(); }
        catch (e: any) { setNote({ ok: false, text: errText(e?.response?.data?.code) }); }
        await load();
        setBusy(false);
    };

    const invite = (e: FormEvent) => {
        e.preventDefault();
        const clean = email.trim();
        if (busy) return;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(clean)) { setNote({ ok: false, text: errText('invalid_email') }); return; }
        run(() => buyerApi.post(`${BASE}/invite`, { email: clean, locale: i18n.language?.startsWith('en') ? 'en' : 'es' }), t('buyer.team.invited', { email: clean }), () => setEmail(''));
    };

    if (failed) return <Alert tone="danger">{t('buyer.errorLoad')}</Alert>;
    if (!data) return <div className="text-center"><Spinner /></div>;

    const date = (s: number) => new Date(s * 1000).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' });
    const { seats } = data;
    const taken = seats.used + seats.pending;
    const full = seats.limit != null && taken >= seats.limit;

    return (
        <div className="space-y-5">
            <Tabs value={tab} onChange={setTab} items={[
                { id: 'admins', label: t('buyer.team.tabAdmins') },
                { id: 'streamers', label: t('buyer.team.tabStreamers', { count: data.viewers.length }) },
            ]} />
            {note && <Alert tone={note.ok ? 'ok' : 'danger'}>{note.text}</Alert>}

            {tab === 'admins' && <>
                <Card><div className="p-5 space-y-4">
                    <div>
                        <h2 className="text-lg font-bold text-ds-text">{t('buyer.team.inviteTitle')}</h2>
                        <p className="text-sm text-ds-soft mt-1 leading-relaxed">{t('buyer.team.inviteHelp', { days: data.inviteDays })}</p>
                    </div>
                    <p className="text-sm text-ds-soft">
                        {seats.limit == null
                            ? t('buyer.team.seatsUnlimited', { count: taken })
                            : t('buyer.team.seats', { used: taken, limit: seats.limit })}
                        {seats.pending > 0 && <span className="text-ds-faint"> · {t('buyer.team.seatsPending', { count: seats.pending })}</span>}
                    </p>
                    {!data.included && <Alert tone="info">{t('buyer.team.notIncluded')}</Alert>}
                    {data.included && full && <Alert tone="info">{t('buyer.team.full')}</Alert>}
                    <form onSubmit={invite} noValidate className="flex flex-col sm:flex-row sm:items-end gap-3">
                        <div className="flex-1 min-w-0">
                            <Field label={t('buyer.team.emailLabel')}>
                                <Input type="email" inputMode="email" autoComplete="off" value={email} disabled={!data.canInvite}
                                    onChange={e => setEmail(e.target.value)} placeholder={t('form.emailPlaceholder')} />
                            </Field>
                        </div>
                        <Button type="submit" loading={busy} disabled={!data.canInvite || email.trim().length < 5}>{t('buyer.team.send')}</Button>
                    </form>
                </div></Card>

                <Card><div className="p-5 space-y-3">
                    <h2 className="text-lg font-bold text-ds-text">{t('buyer.team.membersTitle')}</h2>
                    <ul className="divide-y divide-ds-border">
                        {data.members.map(m => (
                            <li key={m.userId} className="py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                                <div className="min-w-0">
                                    <p className="text-ds-text font-semibold break-all">{m.email || '—'}</p>
                                    <p className="text-xs text-ds-faint">{t('buyer.team.since', { date: date(m.since) })}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge tone={m.role === 'owner' ? 'accent' : undefined}>{t(`buyer.team.role.${m.role}`)}</Badge>
                                    {m.role === 'admin' && (confirm === m.userId
                                        ? <>
                                            <Button size="sm" variant="danger" loading={busy} onClick={() => run(() => buyerApi.delete(`${BASE}/members/${m.userId}`), t('buyer.team.removed'), () => setConfirm(null))}>{t('buyer.team.confirmRemove')}</Button>
                                            <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>{t('tenants.close')}</Button>
                                        </>
                                        : <Button size="sm" variant="ghost" onClick={() => setConfirm(m.userId)}>{t('buyer.team.remove')}</Button>)}
                                </div>
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-ds-faint leading-relaxed">{t('buyer.team.adminCan')}</p>
                </div></Card>

                {data.invitations.length > 0 && (
                    <Card><div className="p-5 space-y-3">
                        <h2 className="text-lg font-bold text-ds-text">{t('buyer.team.pendingTitle')}</h2>
                        <ul className="divide-y divide-ds-border">
                            {data.invitations.map(i => (
                                <li key={i.id} className="py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                                    <div className="min-w-0">
                                        <p className="text-ds-text font-semibold break-all">{i.email}</p>
                                        <p className="text-xs text-ds-faint">{t('buyer.team.expires', { date: date(i.expiresAt) })}</p>
                                    </div>
                                    <Button size="sm" variant="ghost" loading={busy} onClick={() => run(() => buyerApi.delete(`${BASE}/invitations/${i.id}`), t('buyer.team.cancelled'))}>{t('buyer.team.cancel')}</Button>
                                </li>
                            ))}
                        </ul>
                    </div></Card>
                )}
            </>}

            {tab === 'streamers' && (
                <Card><div className="p-5 space-y-3">
                    <div>
                        <h2 className="text-lg font-bold text-ds-text">{t('buyer.team.streamersTitle')}</h2>
                        <p className="text-sm text-ds-soft mt-1 leading-relaxed">{t('buyer.team.streamersHelp')}</p>
                    </div>
                    {data.viewers.length === 0
                        ? <Empty icon={<Users className="w-8 h-8" aria-hidden />} title={t('buyer.team.streamersEmptyTitle')}>{t('buyer.team.streamersEmpty')}</Empty>
                        : <ul className="divide-y divide-ds-border">
                            {data.viewers.map(v => (
                                <li key={v.login} className="py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                                    <p className="text-ds-text font-semibold break-all">{v.displayName}</p>
                                    <p className="text-xs text-ds-faint">{t('buyer.team.since', { date: date(v.since) })}</p>
                                </li>
                            ))}
                        </ul>}
                </div></Card>
            )}
        </div>
    );
}
