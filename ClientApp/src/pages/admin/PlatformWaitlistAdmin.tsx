import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Download, ListChecks, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Spinner, Table } from '../../components/ds';
import ModalShell from '../../components/dashboard/ModalShell';
import { ConfigCard, ConfigHeader } from '../../components/dashboard/config';
import api from '../../services/api';
import PlatformApprovals, { type Approval } from './PlatformApprovals';

// Lista de espera de la plataforma (decatron.top). .dev/plans/plataforma/PLATAFORMA_PLAN.md, Fase L.
// Las altas llegan de la landing; aquí el dueño las revisa, exporta y borra. Los endpoints son solo del dueño.

interface Row {
    id: number; email: string; useCase: string; platform: string; locale: string;
    confirmed: boolean; confirmedAt: string | null; createdAt: string;
}
interface Listing {
    total: number; confirmed: number; byUse: { useCase: string; count: number }[];
    page: number; pageSize: number; items: Row[];
}

const PAGE_SIZE = 50;

export default function PlatformWaitlistAdmin() {
    const { t, i18n } = useTranslation('platform');
    const navigate = useNavigate();
    const [data, setData] = useState<Listing | null>(null);
    const [page, setPage] = useState(1);
    const [error, setError] = useState(false);
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
    const [toDelete, setToDelete] = useState<Row | null>(null);
    const [busy, setBusy] = useState(false);
    const [approvals, setApprovals] = useState<Approval[]>([]);
    const [mode, setMode] = useState('approval');

    const loadApprovals = useCallback(async () => {
        try { const res = await api.get('/admin/platform/approvals'); setApprovals(res.data.items); setMode(res.data.mode); } catch { /* la lista de espera sigue funcionando */ }
    }, []);
    useEffect(() => { loadApprovals(); }, [loadApprovals]);
    const approvedSet = new Set(approvals.map(a => a.email));
    const toggleApproval = async (r: Row) => {
        setBusy(true);
        try {
            if (approvedSet.has(r.email.toLowerCase())) await api.delete('/admin/platform/approvals', { params: { email: r.email } });
            else await api.post('/admin/platform/approvals', { email: r.email, note: t('admin.approvals.fromWaitlist') });
            await loadApprovals();
        } catch { setNote({ ok: false, text: t('admin.approvals.failed') }); }
        setBusy(false);
    };

    const load = useCallback(async (p: number) => {
        try {
            const res = await api.get('/admin/platform/waitlist', { params: { page: p, pageSize: PAGE_SIZE } });
            setData(res.data);
            setError(false);
        } catch { setError(true); }
    }, []);
    useEffect(() => { load(page); }, [load, page]);

    const fmt = (iso: string) => new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleString(i18n.language);

    const exportCsv = async (onlyConfirmed: boolean) => {
        try {
            const res = await api.get('/admin/platform/waitlist/export', { params: { onlyConfirmed }, responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url; a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
        } catch { setNote({ ok: false, text: t('admin.exportFailed') }); }
    };

    const confirmDelete = async () => {
        if (!toDelete) return;
        setBusy(true);
        try {
            await api.delete(`/admin/platform/waitlist/${toDelete.id}`);
            setNote({ ok: true, text: t('admin.deleted') });
            setToDelete(null);
            await load(page);
        } catch { setNote({ ok: false, text: t('admin.deleteFailed') }); }
        setBusy(false);
    };

    if (error) return <div className="panel-scale"><Alert tone="danger">{t('admin.loadFailed')}</Alert></div>;
    if (!data) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

    const pending = data.total - data.confirmed;
    const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
    const stat = (label: string, value: number) => (
        <div className="p-4 rounded-lg bg-ds-bg border border-ds-border">
            <p className="text-xs uppercase tracking-wide text-ds-soft">{label}</p>
            <p className="text-2xl font-black text-ds-text">{value.toLocaleString(i18n.language)}</p>
        </div>
    );
    const useLabel = (u: string) => t(`form.useCaseOptions.${u}`, { defaultValue: u });

    return (
        <div className="panel-scale space-y-6">
            <ConfigHeader onBack={() => navigate('/admin')} icon={<ListChecks />} title={t('admin.title')} subtitle={t('admin.subtitle')} />

            {note && <Alert tone={note.ok ? 'ok' : 'danger'}>{note.text}</Alert>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ConfigCard icon={<ListChecks />} title={t('admin.summary')}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {stat(t('admin.confirmed'), data.confirmed)}
                        {stat(t('admin.pending'), pending)}
                        {stat(t('admin.total'), data.total)}
                    </div>
                    <p className="text-sm text-ds-soft mt-3">{t('admin.pendingHint')}</p>
                </ConfigCard>

                <ConfigCard icon={<ListChecks />} title={t('admin.byUse')} hint={t('admin.byUseHint')}>
                    {data.byUse.length === 0 ? (
                        <p className="text-sm text-ds-soft">{t('admin.empty')}</p>
                    ) : (
                        <ul className="space-y-2">
                            {data.byUse.map(u => (
                                <li key={u.useCase} className="flex items-center justify-between text-sm">
                                    <span className="text-ds-text">{useLabel(u.useCase)}</span>
                                    <b className="text-ds-text">{u.count}</b>
                                </li>
                            ))}
                        </ul>
                    )}
                </ConfigCard>
            </div>

            <PlatformApprovals items={approvals} mode={mode} onChanged={loadApprovals} />

            <ConfigCard icon={<ListChecks />} title={t('admin.listTitle')}>
                <div className="flex flex-wrap gap-2 mb-4">
                    <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={() => exportCsv(true)}>{t('admin.exportConfirmed')}</Button>
                    <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />} onClick={() => exportCsv(false)}>{t('admin.exportAll')}</Button>
                </div>

                {data.items.length === 0 ? (
                    <p className="text-sm text-ds-soft">{t('admin.empty')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table
                            head={[t('admin.colEmail'), t('admin.colUse'), t('admin.colPlatform'), t('admin.colState'), t('admin.colDate'), t('admin.approvals.colSignup'), '']}
                            rows={data.items.map(r => [
                                <span className="font-bold text-ds-text break-all">{r.email}</span>,
                                useLabel(r.useCase),
                                r.platform ? t(`form.platformOptions.${r.platform}`, { defaultValue: r.platform }) : '—',
                                <Badge tone={r.confirmed ? 'ok' : undefined}>{r.confirmed ? t('admin.stateConfirmed') : t('admin.statePending')}</Badge>,
                                <span className="whitespace-nowrap">{fmt(r.confirmedAt ?? r.createdAt)}</span>,
                                approvedSet.has(r.email.toLowerCase())
                                    ? <Button variant="ghost" size="sm" disabled={busy} onClick={() => toggleApproval(r)}><Badge tone="ok">{t('admin.approvals.approved')}</Badge></Button>
                                    : <Button variant="secondary" size="sm" disabled={busy} icon={<Check className="w-4 h-4" />} onClick={() => toggleApproval(r)}>{t('admin.approvals.approve')}</Button>,
                                <Button variant="ghost" size="sm" aria-label={t('admin.delete')} title={t('admin.delete')} onClick={() => setToDelete(r)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>,
                            ])}
                        />
                    </div>
                )}

                {pages > 1 && (
                    <div className="flex items-center justify-between mt-4 text-sm text-ds-soft">
                        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('admin.prev')}</Button>
                        <span>{t('admin.pageOf', { page: data.page, pages })}</span>
                        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>{t('admin.next')}</Button>
                    </div>
                )}
            </ConfigCard>

            {toDelete && (
                <ModalShell
                    title={t('admin.deleteTitle')} size="md" onClose={() => !busy && setToDelete(null)}
                    actions={<>
                        <Button variant="ghost" onClick={() => setToDelete(null)} disabled={busy}>{t('admin.cancel')}</Button>
                        <Button variant="danger" onClick={confirmDelete} loading={busy}>{t('admin.delete')}</Button>
                    </>}
                >
                    <p className="text-ds-soft">{t('admin.deleteText', { email: toDelete.email })}</p>
                </ModalShell>
            )}
        </div>
    );
}
