import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { Card } from '../../components/overlay-editor/ui';
import { PLATFORM_NAMES, VIDEO_PLATFORM, parseVideo } from './shared';
import type { PersonalPageState } from './usePersonalPage';
import { errorOf } from './usePersonalPage';
import { useErrorText } from './PersonalPageTabs';

// Pestaña «Estadísticas» del panel (subfase 5.5): visitas por día y clics por destino. Sin datos personales: el servidor
// solo guarda contadores por día. Una sola serie, un solo tono (el acento del panel), sin leyenda; tabla a un toque.

interface StatsResponse {
    days: { day: string; visits: number }[];
    totalVisits: number;
    clicks: { target: string; clicks: number }[];
    totalClicks: number;
    publicOpen: boolean;
}

export default function StatsTab({ s }: { s: PersonalPageState }) {
    const { t, i18n } = useTranslation('personal-page');
    const errorText = useErrorText();
    const [range, setRange] = useState<7 | 30>(30);
    const [data, setData] = useState<StatsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hover, setHover] = useState<number | null>(null);
    const [asTable, setAsTable] = useState(false);
    const draft = s.draft!;

    useEffect(() => {
        let alive = true;
        setError(null);
        api.get('/personal-page/stats', { params: { days: range } })
            .then(res => { if (alive) setData(res.data); })
            .catch(err => { if (alive) setError(errorText(errorOf(err).code)); });
        return () => { alive = false; };
        // errorText cambia en cada render: solo importa el rango
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range]);

    const fmtDay = (iso: string, long = false) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(i18n.language, long ? { weekday: 'short', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' });
    const nameOf = (target: string) => {
        if (target.startsWith('bot:')) return t(`botLinks.${target.slice(4)}`);
        if (target.startsWith('video:')) {
            const v = (draft.videos ?? []).find(x => `video:${x.id}` === target);
            if (!v) return t('stats.removed');
            const ref = parseVideo(v.url);
            return v.title || (ref ? t('public.videoOf', { platform: VIDEO_PLATFORM[ref.kind] }) : t('stats.removed'));
        }
        const l = (draft.links ?? []).find(x => x.id === target);
        return l ? (l.title || PLATFORM_NAMES[l.kind] || l.kind) : t('stats.removed');
    };

    const max = Math.max(1, ...(data?.days.map(d => d.visits) ?? [0]));
    const maxClicks = Math.max(1, ...(data?.clicks.map(c => c.clicks) ?? [0]));

    return (
        <div className="space-y-6">
            {data && !data.publicOpen && (
                <div className="p-4 rounded-lg border border-ds-warn/40 bg-ds-warn/10 text-sm 3xl:text-base text-ds-text">{t('stats.notOpen')}</div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1" role="group" aria-label={t('stats.range')}>
                    {([7, 30] as const).map(r => (
                        <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r}
                            className={range === r ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>{t('stats.lastDays', { count: r })}</button>
                    ))}
                </div>
                <p className="text-xs 3xl:text-sm text-ds-soft">{t('stats.privacy')}</p>
            </div>
            {error && <p className="text-sm 3xl:text-base text-ds-danger">{error}</p>}

            {data && (<>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                        <p className="text-3xl 3xl:text-4xl font-black text-ds-text tabular-nums">{data.totalVisits.toLocaleString(i18n.language)}</p>
                        <p className="text-sm 3xl:text-base text-ds-soft">{t('stats.visits', { count: range })}</p>
                    </div>
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                        <p className="text-3xl 3xl:text-4xl font-black text-ds-text tabular-nums">{data.totalClicks.toLocaleString(i18n.language)}</p>
                        <p className="text-sm 3xl:text-base text-ds-soft">{t('stats.clicksTotal', { count: range })}</p>
                    </div>
                </div>

                <Card title={t('stats.visitsTitle')} actions={<button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => setAsTable(v => !v)}>{asTable ? t('stats.showChart') : t('stats.showTable')}</button>}>
                    {asTable ? (
                        <div className="max-h-80 overflow-y-auto">
                            <table className="w-full text-sm 3xl:text-base">
                                <thead><tr className="text-left text-ds-soft"><th className="py-1.5 pr-3 font-semibold">{t('stats.day')}</th><th className="py-1.5 text-right font-semibold">{t('stats.visitsCol')}</th></tr></thead>
                                <tbody className="divide-y divide-ds-border">
                                    {[...data.days].reverse().map(d => (
                                        <tr key={d.day} className="text-ds-text"><td className="py-1.5 pr-3">{fmtDay(d.day, true)}</td><td className="py-1.5 text-right tabular-nums">{d.visits}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div>
                            <div className="relative h-48 3xl:h-64 flex">
                                <div className="flex flex-col justify-between text-[11px] 3xl:text-xs text-ds-soft pr-2 tabular-nums" aria-hidden="true">
                                    <span>{max}</span><span>0</span>
                                </div>
                                <div className="relative flex-1 flex items-end gap-[2px] border-b border-ds-border" onMouseLeave={() => setHover(null)}>
                                    <div className="absolute inset-x-0 top-0 border-t border-dashed border-ds-border/60 pointer-events-none" aria-hidden="true" />
                                    {data.days.map((d, i) => (
                                        <div key={d.day} className="relative flex-1 h-full flex items-end justify-center outline-none focus-visible:ring-2 focus-visible:ring-ds-accent/50 rounded-sm"
                                            tabIndex={0} role="img" aria-label={`${fmtDay(d.day, true)}: ${t('stats.visitsCount', { count: d.visits })}`}
                                            onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                                            {d.visits > 0 && (
                                                <div className={`w-full max-w-[24px] rounded-t ${hover === i ? 'bg-ds-accent-hover' : 'bg-ds-accent'}`} style={{ height: `${(d.visits / max) * 100}%`, minHeight: 2 }} />
                                            )}
                                            {hover === i && (
                                                <div className={`absolute bottom-full mb-2 z-10 whitespace-nowrap rounded-md border border-ds-border bg-ds-surface px-2.5 py-1.5 text-xs 3xl:text-sm shadow-lg pointer-events-none ${i < data.days.length / 2 ? 'left-0' : 'right-0'}`}>
                                                    <span className="block text-ds-soft">{fmtDay(d.day, true)}</span>
                                                    <span className="block font-bold text-ds-text">{t('stats.visitsCount', { count: d.visits })}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-between pl-6 mt-1.5 text-[11px] 3xl:text-xs text-ds-soft" aria-hidden="true">
                                <span>{fmtDay(data.days[0].day)}</span>
                                <span>{fmtDay(data.days[data.days.length - 1].day)}</span>
                            </div>
                            {data.totalVisits === 0 && <p className="mt-3 text-sm 3xl:text-base text-ds-soft">{t('stats.noVisits')}</p>}
                        </div>
                    )}
                </Card>

                <Card title={t('stats.clicksTitle')} description={t('stats.clicksHint')}>
                    {data.clicks.length === 0 ? <p className="text-sm 3xl:text-base text-ds-soft">{t('stats.noClicks')}</p> : (
                        <table className="w-full text-sm 3xl:text-base">
                            <thead><tr className="text-left text-ds-soft"><th className="py-1.5 pr-3 font-semibold">{t('stats.target')}</th><th className="py-1.5 pr-3 font-semibold w-1/3 hidden sm:table-cell" /><th className="py-1.5 text-right font-semibold">{t('stats.clicksCol')}</th></tr></thead>
                            <tbody className="divide-y divide-ds-border">
                                {data.clicks.map(c => (
                                    <tr key={c.target} className="text-ds-text">
                                        <td className="py-2 pr-3 break-words">{nameOf(c.target)}</td>
                                        <td className="py-2 pr-3 hidden sm:table-cell" aria-hidden="true">
                                            <div className="h-2 rounded-r bg-ds-accent" style={{ width: `${Math.max(2, (c.clicks / maxClicks) * 100)}%` }} />
                                        </td>
                                        <td className="py-2 text-right tabular-nums">{c.clicks}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            </>)}
        </div>
    );
}
