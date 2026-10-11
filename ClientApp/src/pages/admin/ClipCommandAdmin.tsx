import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clapperboard, HardDrive } from 'lucide-react';
import { Alert, Badge, Button, Input, Spinner } from '../../components/ds';
import { ConfigCard, ConfigHeader } from '../../components/dashboard/config';
import api from '../../services/api';

// Administración de !clip (.dev/plans/CLIP_COMANDO_PLAN.md): disco, uso por canal y tope mensual de descargas.

interface ChannelRow {
    userId: number; channel: string; enabled: boolean; downloadEnabled: boolean; downloadMonthlyCap: number | null;
    created: number; failed: number; downloaded: number; downloadedThisMonth: number; lastUsed: string | null;
}
interface Overview {
    settings: { enabled: boolean; minFreeDiskGb: number };
    disk: { freeGb: number | null; totalGb: number | null; belowThreshold: boolean };
    totals: { channels: number; enabled: number; created: number; failed: number; downloaded: number };
    channels: ChannelRow[];
}

export default function ClipCommandAdmin() {
    const { t, i18n } = useTranslation('clipcommand');
    const navigate = useNavigate();
    const [data, setData] = useState<Overview | null>(null);
    const [error, setError] = useState(false);
    const [caps, setCaps] = useState<Record<number, string>>({});
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/admin/clipcommand/overview');
            setData(res.data);
            const next: Record<number, string> = {};
            for (const c of res.data.channels as ChannelRow[]) next[c.userId] = c.downloadMonthlyCap?.toString() ?? '';
            setCaps(next);
            setError(false);
        } catch { setError(true); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const saveCap = async (c: ChannelRow) => {
        const raw = (caps[c.userId] ?? '').trim();
        try {
            await api.put(`/admin/clipcommand/channels/${c.userId}/download-cap`, { cap: raw === '' ? null : Number(raw) });
            setNote({ ok: true, text: t('admin.capSaved') });
            await load();
        } catch { setNote({ ok: false, text: t('admin.capFailed') }); }
    };

    if (error) return <div className="panel-scale"><Alert tone="danger">{t('admin.loadFailed')}</Alert></div>;
    if (!data) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

    const { disk, totals, settings } = data;
    const fmt = (iso: string) => new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleString(i18n.language);
    const stat = (label: string, value: number) => (
        <div className="p-4 rounded-lg bg-ds-bg border border-ds-border">
            <p className="text-xs uppercase tracking-wide text-ds-soft">{label}</p>
            <p className="text-2xl font-black text-ds-text">{value.toLocaleString(i18n.language)}</p>
        </div>
    );

    return (
        <div className="panel-scale space-y-6">
            <ConfigHeader onBack={() => navigate('/admin')} icon={<Clapperboard />} title={t('admin.title')} subtitle={t('admin.subtitle')} />

            {!settings.enabled && <Alert tone="warn">{t('admin.globalOff')}</Alert>}
            {note && <Alert tone={note.ok ? 'ok' : 'danger'}>{note.text}</Alert>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ConfigCard icon={<HardDrive />} title={t('admin.diskTitle')}
                    hint={t('admin.diskThreshold', { gb: settings.minFreeDiskGb })}>
                    <p className="text-lg font-black text-ds-text mb-3">
                        {disk.freeGb != null && disk.totalGb != null ? t('admin.diskFree', { free: disk.freeGb, total: disk.totalGb }) : '—'}
                    </p>
                    {disk.belowThreshold && <Alert tone="danger">{t('admin.diskLow')}</Alert>}
                </ConfigCard>

                <ConfigCard icon={<Clapperboard />} title={t('admin.totalsTitle')}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {stat(t('admin.channels'), totals.channels)}
                        {stat(t('admin.active'), totals.enabled)}
                        {stat(t('admin.created'), totals.created)}
                        {stat(t('admin.failed'), totals.failed)}
                        {stat(t('admin.downloaded'), totals.downloaded)}
                    </div>
                </ConfigCard>
            </div>

            <ConfigCard icon={<Clapperboard />} title={t('admin.channelsTitle')}>
                {data.channels.length === 0 ? (
                    <p className="text-sm text-ds-soft">{t('admin.empty')}</p>
                ) : (
                    <ul className="space-y-3">
                        {data.channels.map(c => (
                            <li key={c.userId} className="p-4 rounded-lg bg-ds-bg border border-ds-border">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-black text-ds-text truncate">{c.channel}</span>
                                        <Badge tone={c.enabled ? 'ok' : undefined}>{c.enabled ? t('admin.on') : t('admin.off')}</Badge>
                                        {c.downloadEnabled && <Badge tone="accent">{t('admin.download')}</Badge>}
                                    </div>
                                    <span className="text-xs text-ds-soft">{t('admin.lastUsed')}: {c.lastUsed ? fmt(c.lastUsed) : t('admin.never')}</span>
                                </div>
                                <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
                                    <span className="text-sm text-ds-soft">{t('admin.created')}: <b className="text-ds-text">{c.created}</b></span>
                                    <span className="text-sm text-ds-soft">{t('admin.failed')}: <b className="text-ds-text">{c.failed}</b></span>
                                    <span className="text-sm text-ds-soft">{t('admin.downloaded')}: <b className="text-ds-text">{c.downloaded}</b> ({t('admin.downloadMonth')}: {c.downloadedThisMonth})</span>
                                    <div className="flex items-end gap-2 ml-auto">
                                        <div className="w-40">
                                            <Input type="number" inputMode="numeric" min={1} aria-label={t('admin.cap')} placeholder={t('admin.capPlaceholder')}
                                                value={caps[c.userId] ?? ''} onChange={e => setCaps(prev => ({ ...prev, [c.userId]: e.target.value }))} />
                                        </div>
                                        <Button variant="secondary" size="sm" onClick={() => saveCap(c)}>{t('admin.capSave')}</Button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </ConfigCard>
        </div>
    );
}
