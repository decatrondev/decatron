import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Card, Segmented, Spinner } from '../../../components/ds';
import api from '../../../services/api';
import { DayBars, type Metric } from '../../features/promo-extension/DayBars';
import { DayTable, Figure, RankRow } from '../../features/promo-extension/StatsTab';
import { formatDuration, formatNumber, type DayStat } from '../../features/promo-extension/statsFormat';
import type { Lang } from './shared';
import type { PromoOverview } from './types';
import { AdvertiserReport } from './AdvertiserReport';
import { ThirdPartyChannels } from './ThirdPartyChannels';

interface GlobalStats { days: number; perDay: DayStat[]; pieces: { id: number; views: number; seconds: number; clicks: number; disabledIn: number }[]; totalViews: number; totalSeconds: number; totalClicks: number }

/** Estadísticas globales del dueño: entregas por día de todos los canales y ranking de piezas con cuántos canales las tienen apagadas. */
export function StatsTab({ data, lang }: { data: PromoOverview; lang: Lang }) {
    const { t } = useTranslation('promo');
    const [days, setDays] = useState('30');
    const [metric, setMetric] = useState<Metric>('views');
    const [table, setTable] = useState(false);
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        setStats(null);
        api.get('/admin/promo/stats', { params: { days } })
            .then(r => { if (alive) { setStats(r.data.stats); setFailed(false); } })
            .catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, [days]);

    const ts = (k: string, o?: Record<string, string | number>) => t(`admin.stats.${k}`, o);
    const tp = (k: string) => t(`panel.stats.${k}`) as string;
    if (failed) return <Alert tone="danger">{ts('loadFailed')}</Alert>;
    if (!stats) return <div className="flex justify-center py-10"><Spinner /></div>;

    const max = Math.max(0, ...stats.pieces.map(p => p.views));
    const name = (id: number) => { const p = data.pieces.find(x => x.id === id); return p ? ((lang === 'en' && p.titleEn) || p.titleEs || p.bodyEs || `#${id}`) : `#${id}`; };

    return (
        <div className="space-y-6">
            <p className="text-sm text-ds-soft max-w-2xl">{ts('intro')}</p>
            <Card>
                <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                    <Figure label={`${ts('period')} (${ts(`range.${days}`)})`} value={formatNumber(stats.totalViews, lang)} hint={`${tp('views')} · ${formatDuration(stats.totalSeconds)} ${tp('onScreen')} · ${formatNumber(stats.totalClicks, lang)} ${tp('clicks')}`} />
                    <div className="flex flex-wrap gap-3">
                        <Segmented items={[{ id: 'views', label: tp('metric.views') }, { id: 'seconds', label: tp('metric.seconds') }, { id: 'clicks', label: tp('metric.clicks') }]} value={metric} onChange={v => setMetric(v as Metric)} />
                        <Segmented items={['30', '90', '365'].map(d => ({ id: d, label: ts(`range.${d}`) }))} value={days} onChange={setDays} />
                    </div>
                </div>
                {stats.totalViews === 0 ? <Alert tone="info">{ts('emptyAll')}</Alert> : (
                    <>
                        {table ? <DayTable days={stats.perDay} lang={lang} /> : <DayBars days={stats.perDay} metric={metric} lang={lang} label={tp(metric === 'views' ? 'chartLabel' : metric === 'seconds' ? 'chartLabelSeconds' : 'chartLabelClicks')} />}
                        <button type="button" onClick={() => setTable(v => !v)} className="mt-3 text-xs text-ds-accent hover:underline bg-transparent border-0 p-0 cursor-pointer">{tp(table ? 'hideTable' : 'showTable')}</button>
                    </>
                )}
            </Card>
            <Card>
                <h2 className="text-base font-bold text-ds-text mb-2">{ts('pieces')}</h2>
                <ul className="list-none m-0 p-0 max-w-3xl">
                    {stats.pieces.map(p => (
                        <RankRow key={p.id} name={name(p.id)} views={p.views} seconds={p.seconds} clicks={p.clicks} max={max} lang={lang}
                            extra={`${ts('disabledIn')}: ${p.disabledIn ? ts('channels', { count: p.disabledIn }) : ts('none')}`} />
                    ))}
                </ul>
            </Card>
            <ThirdPartyChannels />
            <AdvertiserReport data={data} />
        </div>
    );
}
