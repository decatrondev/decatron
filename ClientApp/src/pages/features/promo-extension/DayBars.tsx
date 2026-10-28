import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDay, formatDuration, formatNumber, type DayStat } from './statsFormat';

export type Metric = 'views' | 'seconds' | 'clicks';

/** Cifra «redonda» por encima del máximo para que la última línea de la cuadrícula quede cerca de la barra más alta. */
function niceMax(v: number): number {
    if (v <= 4) return 4;
    const pow = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
    return 10 * pow;
}

const axisLabel = (v: number, metric: Metric, lang: string) => (metric === 'seconds' ? formatDuration(v) : formatNumber(v, lang));

/**
 * Barras por día de una sola serie (entregas o tiempo en pantalla). La cifra exacta sale al pasar el cursor o al enfocar la barra con el teclado;
 * cada barra tiene una zona de toque de la altura completa para que los días con poco no sean difíciles de apuntar.
 */
export function DayBars({ days, metric, lang, label }: { days: DayStat[]; metric: Metric; lang: string; label: string }) {
    const { t } = useTranslation('promo');
    const [active, setActive] = useState<number | null>(null);
    const values = days.map(d => (metric === 'seconds' ? d.seconds : metric === 'clicks' ? d.clicks : d.views));
    const top = niceMax(Math.max(0, ...values));
    const ticks = [top, top / 2, 0];
    const labelEvery = days.length > 60 ? 14 : days.length > 14 ? 7 : 1;
    const act = active == null ? null : days[active];
    // La burbuja se ancla al lado contrario del borde para no salirse del gráfico.
    const side = active != null && active > days.length / 2 ? 'right' : 'left';

    return (
        <figure className="m-0" aria-label={label}>
            <div className="flex gap-3">
                <div className="flex flex-col justify-between text-right text-[11px] text-ds-soft tabular-nums pb-6 pt-0.5 shrink-0" aria-hidden="true">
                    {ticks.map(t => <span key={t}>{axisLabel(t, metric, lang)}</span>)}
                </div>
                <div className="relative flex-1 min-w-0">
                    <div className="relative h-44 3xl:h-56" onMouseLeave={() => setActive(null)}>
                        {[0, 50, 100].map(p => <div key={p} className="absolute inset-x-0 border-t border-ds-border/60" style={{ top: `${p}%` }} aria-hidden="true" />)}
                        <div className="absolute inset-0 flex items-stretch gap-[2px]">
                            {days.map((d, i) => {
                                const v = values[i];
                                const h = top ? (v / top) * 100 : 0;
                                return (
                                    <button key={d.day} type="button" onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                                        aria-label={`${formatDay(d.day, lang)}: ${formatNumber(d.views, lang)} ${t('panel.stats.views')} · ${formatDuration(d.seconds)} · ${formatNumber(d.clicks, lang)} ${t('panel.stats.clicks')}`}
                                        className="relative flex-1 min-w-0 bg-transparent border-0 p-0 cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-accent rounded-sm">
                                        {v > 0 && <span className="absolute inset-x-0 bottom-0 rounded-t-[4px] transition-opacity"
                                            style={{ height: `max(${h}%, 2px)`, background: 'var(--ds-accent)', opacity: active == null || active === i ? 1 : 0.45 }} />}
                                    </button>
                                );
                            })}
                        </div>
                        {act && (
                            <div role="tooltip" className={`pointer-events-none absolute z-10 top-1 ${side === 'right' ? 'right-1' : 'left-1'} rounded-md border border-ds-border bg-ds-raised px-3 py-2 text-xs shadow-lg`}>
                                <div className="font-semibold text-ds-text">{formatDay(act.day, lang)}</div>
                                <div className="text-ds-soft tabular-nums">{formatNumber(act.views, lang)} {t('panel.stats.views')} · {formatDuration(act.seconds)} · {formatNumber(act.clicks, lang)} {t('panel.stats.clicks')}</div>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-[2px] mt-1.5 h-4 text-[11px] text-ds-soft" aria-hidden="true">
                        {days.map((d, i) => (
                            <span key={d.day} className="flex-1 min-w-0 relative">
                                {(days.length - 1 - i) % labelEvery === 0 && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{formatDay(d.day, lang, false)}</span>}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </figure>
    );
}
