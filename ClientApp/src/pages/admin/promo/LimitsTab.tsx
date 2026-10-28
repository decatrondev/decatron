import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gauge } from 'lucide-react';
import { Alert, Button, Field, Input } from '../../../components/ds';
import { ConfigCard } from '../../../components/dashboard/config';
import { errorCodes, promoAdminApi } from './api';
import { errorText } from './shared';
import type { PromoLimits } from './types';

export function LimitsTab({ limits, onChanged, notify }: { limits: PromoLimits; onChanged: () => Promise<void>; notify: (ok: boolean, text: string) => void }) {
    const { t } = useTranslation('promo');
    const [v, setV] = useState<PromoLimits>(limits);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setSaving(true); setError(null);
        try { await promoAdminApi.updateLimits(v); await onChanged(); notify(true, t('admin.toast.saved')); }
        catch (e) { setError(errorText(t, errorCodes(e))); }
        finally { setSaving(false); }
    };

    return (
        <ConfigCard icon={<Gauge />} title={t('admin.limits.title')} hint={t('admin.limits.hint')}>
            <div className="space-y-4 max-w-xl">
                {error && <Alert tone="danger">{error}</Alert>}
                <Field label={t('admin.limits.minGap')} hint={t('admin.limits.minGapHint')}>
                    <Input type="number" min={10} max={3600} value={v.minGapSeconds} onChange={e => setV({ ...v, minGapSeconds: Number(e.target.value) || 0 })} />
                </Field>
                <Field label={t('admin.limits.hourlyCap')} hint={t('admin.limits.hourlyCapHint')}>
                    <Input type="number" min={30} max={3600} value={v.hourlyCapSeconds} onChange={e => setV({ ...v, hourlyCapSeconds: Number(e.target.value) || 0 })} />
                </Field>
                <Field label={t('admin.limits.minDuration')} hint={t('admin.limits.minDurationHint')}>
                    <Input type="number" min={1} max={300} value={v.minDurationSeconds} onChange={e => setV({ ...v, minDurationSeconds: Number(e.target.value) || 0 })} />
                </Field>
                <Field label={t('admin.limits.maxDuration')} hint={t('admin.limits.maxDurationHint')}>
                    <Input type="number" min={1} max={300} value={v.maxDurationSeconds} onChange={e => setV({ ...v, maxDurationSeconds: Number(e.target.value) || 0 })} />
                </Field>
                <Field label={t('admin.limits.minScale')} hint={t('admin.limits.minScaleHint')}>
                    <Input type="number" min={20} max={300} value={v.minScalePercent} onChange={e => setV({ ...v, minScalePercent: Number(e.target.value) || 0 })} />
                </Field>
                <Field label={t('admin.limits.maxScale')} hint={t('admin.limits.maxScaleHint')}>
                    <Input type="number" min={20} max={300} value={v.maxScalePercent} onChange={e => setV({ ...v, maxScalePercent: Number(e.target.value) || 0 })} />
                </Field>
                <Field label={t('admin.limits.maxMargin')} hint={t('admin.limits.maxMarginHint')}>
                    <Input type="number" min={0} max={1000} value={v.maxZoneMargin} onChange={e => setV({ ...v, maxZoneMargin: Number(e.target.value) || 0 })} />
                </Field>
                <Field label={t('admin.limits.botPerOwn')} hint={t('admin.limits.botPerOwnHint')}>
                    <Input type="number" min={1} max={10} value={v.botPerOwn} onChange={e => setV({ ...v, botPerOwn: Number(e.target.value) || 1 })} />
                </Field>
                <Field label={t('admin.limits.ownInterval')} hint={t('admin.limits.ownIntervalHint')}>
                    <Input type="number" min={1} max={240} value={v.ownMinIntervalMinutes} onChange={e => setV({ ...v, ownMinIntervalMinutes: Number(e.target.value) || 1 })} />
                </Field>
                <Button loading={saving} onClick={save}>{t('admin.limits.save')}</Button>
            </div>
        </ConfigCard>
    );
}
