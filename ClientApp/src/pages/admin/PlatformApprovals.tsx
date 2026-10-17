import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Field, Input, Table } from '../../components/ds';
import { ConfigCard } from '../../components/dashboard/config';
import api from '../../services/api';

// Correos aprobados para registrarse como comprador (Platform:SignupMode = approval). Aprobar no envía correo ni crea nada:
// solo deja que esa persona pida su enlace de alta. Se aprueba desde la lista de espera (botón por fila) o a mano aquí.

export interface Approval { email: string; approvedAt: string; approvedBy: string; note: string | null }

export default function PlatformApprovals({ items, mode, onChanged }: { items: Approval[]; mode: string; onChanged: () => void }) {
    const { t, i18n } = useTranslation('platform');
    const [email, setEmail] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const fmt = (iso: string) => new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleString(i18n.language);

    const add = async (e: FormEvent) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true); setMsg(null);
        try {
            await api.post('/admin/platform/approvals', { email: email.trim(), note: note.trim() });
            setEmail(''); setNote(''); setMsg({ ok: true, text: t('admin.approvals.added') }); onChanged();
        } catch (err: any) {
            setMsg({ ok: false, text: err?.response?.data?.code === 'invalid_email' ? t('signup.errorEmail') : t('admin.approvals.failed') });
        }
        setBusy(false);
    };

    const revoke = async (target: string) => {
        setBusy(true); setMsg(null);
        try { await api.delete('/admin/platform/approvals', { params: { email: target } }); setMsg({ ok: true, text: t('admin.approvals.revoked') }); onChanged(); }
        catch { setMsg({ ok: false, text: t('admin.approvals.failed') }); }
        setBusy(false);
    };

    return (
        <ConfigCard icon={<ShieldCheck />} title={t('admin.approvals.title')} hint={t('admin.approvals.hint')}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge tone={mode === 'open' ? 'warn' : 'ok'}>{mode === 'open' ? t('admin.approvals.modeOpen') : t('admin.approvals.modeApproval')}</Badge>
                <span className="text-sm text-ds-soft">{mode === 'open' ? t('admin.approvals.modeOpenText') : t('admin.approvals.modeApprovalText')}</span>
            </div>
            {msg && <div className="mb-3"><Alert tone={msg.ok ? 'ok' : 'danger'}>{msg.text}</Alert></div>}

            <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end mb-4">
                <Field label={t('admin.approvals.email')}><Input type="email" value={email} autoComplete="off" onChange={e => setEmail(e.target.value)} placeholder={t('form.emailPlaceholder')} /></Field>
                <Field label={t('admin.approvals.note')}><Input value={note} maxLength={200} onChange={e => setNote(e.target.value)} /></Field>
                <Button type="submit" loading={busy} disabled={!email.trim()}>{t('admin.approvals.add')}</Button>
            </form>

            {items.length === 0 ? <p className="text-sm text-ds-soft">{t('admin.approvals.empty')}</p> : (
                <div className="overflow-x-auto">
                    <Table
                        head={[t('admin.colEmail'), t('admin.approvals.note'), t('admin.approvals.by'), t('admin.colDate'), '']}
                        rows={items.map(a => [
                            <span className="font-bold text-ds-text break-all">{a.email}</span>,
                            a.note ?? '—',
                            a.approvedBy || '—',
                            <span className="whitespace-nowrap">{fmt(a.approvedAt)}</span>,
                            <Button variant="ghost" size="sm" disabled={busy} aria-label={t('admin.approvals.revoke')} title={t('admin.approvals.revoke')} onClick={() => revoke(a.email)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>,
                        ])}
                    />
                </div>
            )}
        </ConfigCard>
    );
}
