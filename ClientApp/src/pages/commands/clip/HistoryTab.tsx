import { useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Empty, Input, Segmented, Spinner } from '../../../components/ds';
import { ConfigCard } from '../../../components/dashboard/config';
import api from '../../../services/api';

interface Row {
    id: number; status: 'created' | 'failed'; clipId: string | null; clipUrl: string | null; errorCode: string | null;
    title: string | null; duration: number | null; requestedBy: string; requestedByRole: string; downloaded: boolean; createdAt: string;
}

const PAGE_SIZE = 25;

export default function HistoryTab() {
    const { t, i18n } = useTranslation('clipcommand');
    const [rows, setRows] = useState<Row[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState<'all' | 'created' | 'failed'>('all');
    const [user, setUser] = useState('');
    const [userQuery, setUserQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/clipcommand/history', {
                params: { page, pageSize: PAGE_SIZE, status: status === 'all' ? undefined : status, user: userQuery || undefined },
            });
            setRows(res.data?.items ?? []);
            setTotal(res.data?.total ?? 0);
        } catch {
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [page, status, userQuery]);
    useEffect(() => { load(); }, [load]);

    const remove = async (row: Row) => {
        if (!window.confirm(t('history.deleteConfirm'))) return;
        const withFile = row.downloaded && window.confirm(t('history.deleteFileConfirm'));
        try {
            await api.delete(`/clipcommand/history/${row.id}`, { params: { deleteFile: withFile } });
            await load();
        } catch { /* queda igual */ }
    };

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const fmt = (iso: string) => new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleString(i18n.language);

    return (
        <ConfigCard icon={<History />} title={t('history.title')} hint={t('history.total', { n: total })}>
            <div className="flex flex-wrap items-end gap-3 mb-4">
                <Segmented value={status} onChange={v => { setPage(1); setStatus(v as typeof status); }}
                    items={[{ id: 'all', label: t('history.all') }, { id: 'created', label: t('history.created') }, { id: 'failed', label: t('history.failed') }]} />
                <div className="flex gap-2 min-w-0">
                    <Input value={user} placeholder={t('history.filterUser')} aria-label={t('history.filterUser')}
                        onChange={e => setUser(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); setUserQuery(user.trim()); } }} />
                    <Button variant="secondary" onClick={() => { setPage(1); setUserQuery(user.trim()); }}>{t('history.apply')}</Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
            ) : rows.length === 0 ? (
                <Empty icon={<History />} title={t('history.empty')} />
            ) : (
                <>
                    {/* En móvil cada registro es una tarjeta; desde md, una tabla */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-ds-soft border-b border-ds-border">
                                    <th className="py-2 pr-3">{t('history.date')}</th>
                                    <th className="py-2 pr-3">{t('history.user')}</th>
                                    <th className="py-2 pr-3">{t('history.clipTitle')}</th>
                                    <th className="py-2 pr-3">{t('history.duration')}</th>
                                    <th className="py-2 pr-3">{t('history.status')}</th>
                                    <th className="py-2 text-right">{t('history.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.id} className="border-b border-ds-border/60 align-top">
                                        <td className="py-2 pr-3 whitespace-nowrap text-ds-soft">{fmt(r.createdAt)}</td>
                                        <td className="py-2 pr-3 text-ds-text">{r.requestedBy}</td>
                                        <td className="py-2 pr-3 text-ds-text break-words max-w-xs">{r.title || <span className="text-ds-faint">{t('history.untitled')}</span>}</td>
                                        <td className="py-2 pr-3 text-ds-soft">{r.duration != null ? `${r.duration} s` : '—'}</td>
                                        <td className="py-2 pr-3"><StatusBadge row={r} /></td>
                                        <td className="py-2 text-right whitespace-nowrap">
                                            <RowActions row={r} onRemove={remove} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <ul className="md:hidden space-y-3">
                        {rows.map(r => (
                            <li key={r.id} className="p-3 rounded-lg bg-ds-bg border border-ds-border space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-ds-text">{r.requestedBy}</span>
                                    <StatusBadge row={r} />
                                </div>
                                <p className="text-sm text-ds-text break-words">{r.title || <span className="text-ds-faint">{t('history.untitled')}</span>}</p>
                                <p className="text-xs text-ds-soft">{fmt(r.createdAt)}{r.duration != null ? ` · ${r.duration} s` : ''}</p>
                                <div className="flex justify-end"><RowActions row={r} onRemove={remove} /></div>
                            </li>
                        ))}
                    </ul>

                    <div className="flex items-center justify-between gap-3 mt-4">
                        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>{t('history.previous')}</Button>
                        <span className="text-xs text-ds-soft">{t('history.page', { page, pages })}</span>
                        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>{t('history.next')}</Button>
                    </div>
                </>
            )}
        </ConfigCard>
    );
}

function StatusBadge({ row }: { row: Row }) {
    const { t } = useTranslation('clipcommand');
    if (row.status === 'created') {
        return <span className="inline-flex items-center gap-1"><Badge tone="ok">{t('history.statusCreated')}</Badge>{row.downloaded && <span title={t('history.downloaded')} aria-label={t('history.downloaded')}>⬇</span>}</span>;
    }
    const code = row.errorCode ?? 'unknown';
    return <Badge tone="danger">{t(`history.errors.${code}`, { defaultValue: t('history.errors.unknown') })}</Badge>;
}

function RowActions({ row, onRemove }: { row: Row; onRemove: (r: Row) => void }) {
    const { t } = useTranslation('clipcommand');
    return (
        <span className="inline-flex items-center gap-2">
            {row.clipUrl && <a href={row.clipUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-ds-accent-text underline">{t('history.open')}</a>}
            <Button variant="secondary" size="sm" onClick={() => onRemove(row)}>{t('history.delete')}</Button>
        </span>
    );
}
