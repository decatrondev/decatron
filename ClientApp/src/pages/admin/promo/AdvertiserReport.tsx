import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Alert, Button, Card, Field, Input, Select } from '../../../components/ds';
import api from '../../../services/api';
import type { PromoOverview } from './types';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Informe CSV de publicidad de terceros: por anunciante (o todos) y rango de fechas. Solo aparece si ya hay piezas de terceros. */
export function AdvertiserReport({ data }: { data: PromoOverview }) {
    const { t } = useTranslation('promo');
    const advertisers = useMemo(
        () => [...new Set(data.pieces.filter(p => p.origin === 'tercero' && p.advertiserName).map(p => p.advertiserName as string))].sort((a, b) => a.localeCompare(b)),
        [data.pieces]);
    const [advertiser, setAdvertiser] = useState('');
    const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 29 * 86400000)));
    const [to, setTo] = useState(() => isoDay(new Date()));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    if (advertisers.length === 0) return null;

    const download = async () => {
        setBusy(true); setError(null);
        try {
            const r = await api.get('/admin/promo/report', { params: { advertiser: advertiser || undefined, from, to }, responseType: 'blob' });
            const url = URL.createObjectURL(r.data as Blob);
            const a = document.createElement('a');
            a.href = url; a.download = `promociones-informe-${from.replace(/-/g, '')}-${to.replace(/-/g, '')}.csv`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            const code = (e as { response?: { status?: number } })?.response?.status === 400 ? 'rangeInvalid' : 'failed';
            setError(t(`admin.report.${code}`));
        } finally { setBusy(false); }
    };

    return (
        <Card>
            <h2 className="text-base font-bold text-ds-text mb-1">{t('admin.report.title')}</h2>
            <p className="text-sm text-ds-soft max-w-2xl mb-4">{t('admin.report.description')}</p>
            {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
                <Field label={t('admin.report.advertiser')}>
                    <Select value={advertiser} onChange={e => setAdvertiser(e.target.value)}>
                        <option value="">{t('admin.report.all')}</option>
                        {advertisers.map(a => <option key={a} value={a}>{a}</option>)}
                    </Select>
                </Field>
                <Field label={t('admin.report.from')}><Input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></Field>
                <Field label={t('admin.report.to')}><Input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></Field>
            </div>
            <div className="mt-4"><Button icon={<Download />} loading={busy} onClick={download}>{t('admin.report.download')}</Button></div>
        </Card>
    );
}
