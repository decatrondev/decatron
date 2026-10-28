import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Card, Segmented, Spinner } from '../../../components/ds';
import api from '../../../services/api';
import { DayBars, type Metric } from './DayBars';
import { formatDay, formatDuration, formatNumber, type DayStat, type ItemStat } from './statsFormat';
import { pieceTitle, type OwnCard, type Piece } from './types';

interface ChannelStats { days: number; perDay: DayStat[]; pieces: ItemStat[]; cards: ItemStat[]; weekViews: number; weekSeconds: number; totalViews: number; totalSeconds: number }

/** Una fila de ranking: nombre, barra proporcional al máximo de la lista y las dos cifras. */
export function RankRow({ name, views, seconds, max, lang, extra }: { name: string; views: number; seconds: number; max: number; lang: string; extra?: string }) {
    return (
        <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-2.5 border-t border-ds-border first:border-t-0">
            <span className="text-sm text-ds-text truncate">{name}</span>
            <span className="text-sm text-ds-text tabular-nums text-right">{formatNumber(views, lang)} <span className="text-ds-soft">· {formatDuration(seconds)}</span></span>
            <span className="col-span-2 h-1.5 rounded-full bg-ds-border overflow-hidden" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${max ? Math.max((views / max) * 100, views ? 2 : 0) : 0}%`, background: 'var(--ds-accent)' }} />
            </span>
            {extra && <span className="col-span-2 text-xs text-ds-soft">{extra}</span>}
        </li>
    );
}

export function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="min-w-0">
            <p className="text-xs 3xl:text-sm text-ds-soft">{label}</p>
            <p className="text-2xl 3xl:text-3xl font-bold text-ds-text tabular-nums">{value}</p>
            {hint && <p className="text-xs text-ds-soft">{hint}</p>}
        </div>
    );
}

/** Tabla equivalente al gráfico, para quien no puede o no quiere leer barras. */
export function DayTable({ days, lang }: { days: DayStat[]; lang: string }) {
    const { t } = useTranslation('promo');
    return (
        <div className="max-h-72 overflow-auto rounded-md border border-ds-border">
            <table className="w-full text-sm tabular-nums">
                <thead className="sticky top-0 bg-ds-raised text-ds-soft"><tr>
                    <th className="text-left font-semibold px-3 py-2">{t('panel.stats.colDay')}</th><th className="text-right font-semibold px-3 py-2">{t('panel.stats.colViews')}</th><th className="text-right font-semibold px-3 py-2">{t('panel.stats.colTime')}</th>
                </tr></thead>
                <tbody>
                    {[...days].reverse().map(d => (
                        <tr key={d.day} className="border-t border-ds-border"><td className="px-3 py-1.5">{formatDay(d.day, lang)}</td>
                            <td className="px-3 py-1.5 text-right">{formatNumber(d.views, lang)}</td><td className="px-3 py-1.5 text-right">{formatDuration(d.seconds)}</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** Estadísticas del streamer: entregas por día, ranking de las piezas del bot y de sus tarjetas propias. Solo conteos agregados. */
export function StatsTab({ pieces, cards, lang }: { pieces: Piece[]; cards: OwnCard[]; lang: string }) {
    const { t } = useTranslation('promo');
    const [days, setDays] = useState('30');
    const [metric, setMetric] = useState<Metric>('views');
    const [table, setTable] = useState(false);
    const [stats, setStats] = useState<ChannelStats | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        setStats(null);
        api.get('/promo-panel/stats', { params: { days } })
            .then(r => { if (alive) { setStats(r.data.stats); setFailed(false); } })
            .catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, [days]);

    const ts = (k: string, o?: Record<string, string | number>) => t(`panel.stats.${k}`, o);
    if (failed) return <Alert tone="danger">{ts('loadFailed')}</Alert>;
    if (!stats) return <div className="flex justify-center py-10"><Spinner /></div>;

    const empty = stats.totalViews === 0;
    const maxP = Math.max(0, ...stats.pieces.map(p => p.views));
    const maxC = Math.max(0, ...stats.cards.map(p => p.views));

    return (
        <div className="space-y-6">
            <p className="text-sm 3xl:text-base text-ds-soft max-w-2xl">{ts('intro')}</p>
            <Card>
                <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                    <div className="flex flex-wrap gap-x-10 gap-y-3">
                        <Figure label={ts('week')} value={formatNumber(stats.weekViews, lang)} hint={`${ts('views')} · ${formatDuration(stats.weekSeconds)} ${ts('onScreen')}`} />
                        <Figure label={`${ts('period')} (${ts(`range.${days}`)})`} value={formatNumber(stats.totalViews, lang)} hint={`${ts('views')} · ${formatDuration(stats.totalSeconds)} ${ts('onScreen')}`} />
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Segmented items={[{ id: 'views', label: ts('metric.views') }, { id: 'seconds', label: ts('metric.seconds') }]} value={metric} onChange={v => setMetric(v as Metric)} />
                        <Segmented items={['7', '30', '90'].map(d => ({ id: d, label: ts(`range.${d}`) }))} value={days} onChange={setDays} />
                    </div>
                </div>
                {empty ? <Alert tone="info">{ts('emptyAll')}</Alert> : (
                    <>
                        {table ? <DayTable days={stats.perDay} lang={lang} />
                            : <DayBars days={stats.perDay} metric={metric} lang={lang} label={ts(metric === 'views' ? 'chartLabel' : 'chartLabelSeconds')} />}
                        <button type="button" onClick={() => setTable(v => !v)} className="mt-3 text-xs 3xl:text-sm text-ds-accent hover:underline bg-transparent border-0 p-0 cursor-pointer">{ts(table ? 'hideTable' : 'showTable')}</button>
                    </>
                )}
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card>
                    <h2 className="text-base 3xl:text-lg font-bold text-ds-text mb-2">{ts('pieces')}</h2>
                    {stats.pieces.length === 0 ? <p className="text-sm text-ds-soft">{ts('emptyList')}</p> : (
                        <ul className="list-none m-0 p-0">
                            {stats.pieces.map(p => {
                                const piece = pieces.find(x => x.id === p.id);
                                return <RankRow key={p.id} name={piece ? pieceTitle(piece, lang) : ts('removedPiece')} views={p.views} seconds={p.seconds} max={maxP} lang={lang} />;
                            })}
                        </ul>
                    )}
                </Card>
                <Card>
                    <h2 className="text-base 3xl:text-lg font-bold text-ds-text mb-2">{ts('cards')}</h2>
                    {stats.cards.length === 0 ? <p className="text-sm text-ds-soft">{ts('emptyList')}</p> : (
                        <ul className="list-none m-0 p-0">
                            {stats.cards.map(c => {
                                const card = cards.find(x => x.id === c.id);
                                return <RankRow key={c.id} name={card ? (card.title || card.body) : ts('removedCard')} views={c.views} seconds={c.seconds} max={maxC} lang={lang} />;
                            })}
                        </ul>
                    )}
                </Card>
            </div>
        </div>
    );
}
