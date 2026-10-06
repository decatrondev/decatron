import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import api from '../../../../services/api';
import type { TierLimits } from '../hooks/useChannelResources';
import { CARD } from '../ui';

/** Los topes de un plan tal como los devuelve `GET /api/wheel/plans`. -1 = sin tope. */
interface Plan {
    tier: string;
    maxWheels: number;
    maxSegments: number;
    historyDays: number;
    canHideWatermark: boolean;
}

const UNLIMITED = -1;

function Bar({ used, max }: { used: number; max: number }) {
    // Sin tope no hay nada que llenar: una barra vacia diria "no usas nada".
    if (max < 0) return null;
    const pct = max === 0 ? 100 : Math.min(100, Math.round((used / max) * 100));
    return (
        <div className="h-2 rounded-full bg-[#374151] overflow-hidden" role="progressbar" aria-valuenow={used} aria-valuemax={max}>
            <div
                className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

/**
 * Plan y limites: el tipo de cuenta del streamer, cuanto lleva usado de cada tope de la
 * Rueda y que cambia en el siguiente plan. Los planes amplian CANTIDADES, nunca bloquean
 * funciones: todo lo demas de la Rueda es igual en todos.
 *
 * La comparacion sale de `GET /api/wheel/plans`, que usa los mismos resolvers que el
 * backend aplica al crear ruedas y gajos: no hay una tabla copiada aqui que se quede vieja.
 */
export function PlanTab({ limits, segmentCount, showSegments, t }: {
    limits: TierLimits | null;
    /** Gajos de la rueda abierta. */
    segmentCount: number;
    /** Una rueda de Sorteo no tiene gajos que editar: sus gajos son la gente. */
    showSegments: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    const [plans, setPlans] = useState<Plan[] | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        api.get('/wheel/plans')
            .then(({ data }) => { if (alive && data?.success) setPlans(data.plans || []); else if (alive) setFailed(true); })
            .catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, []);

    const tierName = (tier: string) => t(`wheel.plan.tiers.${tier}`, { defaultValue: tier });
    const fmt = (n: number, unit: 'wheels' | 'segments' | 'days') =>
        n < 0 ? t('wheel.plan.unlimited') : t(`wheel.plan.units.${unit}`, { n });

    if (!limits) {
        return <section className={`${CARD} p-5 text-sm text-[#94a3b8]`}>{t('wheel.plan.noData')}</section>;
    }

    const current = limits.tier;
    const idx = plans ? plans.findIndex(p => p.tier === current) : -1;
    const next = plans && idx >= 0 ? plans[idx + 1] : undefined;

    // Solo se listan los topes que MEJORAN: decir "historial: 90 -> 90" es ruido.
    const improves = (a: number, b: number) => a >= 0 && (b < 0 || b > a);
    const gains: { key: string; from: string; to: string }[] = [];
    if (next) {
        if (improves(limits.maxWheels, next.maxWheels)) gains.push({ key: 'wheels', from: fmt(limits.maxWheels, 'wheels'), to: fmt(next.maxWheels, 'wheels') });
        if (improves(limits.maxSegments, next.maxSegments)) gains.push({ key: 'segments', from: fmt(limits.maxSegments, 'segments'), to: fmt(next.maxSegments, 'segments') });
        if (improves(limits.historyDays, next.historyDays)) gains.push({ key: 'history', from: fmt(limits.historyDays, 'days'), to: fmt(next.historyDays, 'days') });
        if (!limits.canHideWatermark && next.canHideWatermark) gains.push({ key: 'watermark', from: t('wheel.plan.no'), to: t('wheel.plan.yes') });
    }

    const usage = (label: string, used: number, max: number, unit: 'wheels' | 'segments', note?: string) => (
        <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm 3xl:text-base font-medium text-[#f8fafc]">{label}</span>
                <span className="text-sm 3xl:text-base tabular-nums text-[#cbd5e1]">
                    {max < 0
                        ? t('wheel.plan.usedUnlimited', { used })
                        : t('wheel.plan.usedOf', { used, max })}
                </span>
            </div>
            <Bar used={used} max={max} />
            {note && <p className="text-xs 3xl:text-sm text-[#94a3b8]">{note}</p>}
            {max >= 0 && used >= max && (
                <p className="text-xs 3xl:text-sm text-amber-300/90">{t(`wheel.plan.full.${unit}`)}</p>
            )}
        </div>
    );

    return (
        <div className="space-y-4">
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151] flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="font-bold text-[#f8fafc]">{t('wheel.plan.title')}</h2>
                        <p className="text-xs 3xl:text-sm text-[#94a3b8] mt-0.5">{t('wheel.plan.help')}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-blue-600/20 text-blue-300 text-sm 3xl:text-base font-black">
                        {t('wheel.plan.yourPlan', { plan: tierName(current) })}
                    </span>
                </div>

                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
                    {usage(t('wheel.plan.wheelsOn'), limits.wheels, limits.maxWheels, 'wheels',
                        limits.wheelsTotal > limits.wheels ? t('wheel.plan.wheelsOffNote', { n: limits.wheelsTotal - limits.wheels }) : undefined)}
                    {showSegments && usage(t('wheel.plan.segmentsThis'), segmentCount, limits.maxSegments, 'segments')}

                    <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm 3xl:text-base font-medium text-[#f8fafc]">{t('wheel.plan.history')}</span>
                        <span className="text-sm 3xl:text-base text-[#cbd5e1]">{fmt(limits.historyDays, 'days')}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm 3xl:text-base font-medium text-[#f8fafc]">{t('wheel.plan.watermark')}</span>
                        <span className="text-sm 3xl:text-base text-[#cbd5e1]">
                            {limits.canHideWatermark ? t('wheel.plan.canHide') : t('wheel.plan.alwaysShown')}
                        </span>
                    </div>
                </div>
            </section>

            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.plan.nextTitle')}</h2>
                </div>
                <div className="p-5 text-sm 3xl:text-base text-[#cbd5e1]">
                    {!plans && !failed && <p className="text-[#94a3b8]">{t('wheel.plan.loading')}</p>}
                    {failed && <p className="text-[#94a3b8]">{t('wheel.plan.loadFailed')}</p>}
                    {plans && !next && <p>{t('wheel.plan.topPlan')}</p>}
                    {plans && next && (
                        <div className="space-y-3">
                            <p>{t('wheel.plan.nextIntro', { plan: tierName(next.tier) })}</p>
                            <ul className="space-y-1.5">
                                {gains.map(g => (
                                    <li key={g.key} className="flex flex-wrap items-center gap-x-2">
                                        <span className="font-medium text-[#f8fafc]">{t(`wheel.plan.gain.${g.key}`)}:</span>
                                        <span className="text-[#94a3b8]">{g.from}</span>
                                        <span className="text-[#94a3b8]">→</span>
                                        <span className="font-bold text-green-300">{g.to}</span>
                                    </li>
                                ))}
                                {gains.length === 0 && <li className="text-[#94a3b8]">{t('wheel.plan.noGain')}</li>}
                            </ul>
                        </div>
                    )}
                </div>
            </section>

            {plans && (
                <section className={CARD}>
                    <div className="px-5 py-4 border-b border-[#374151]">
                        <h2 className="font-bold text-[#f8fafc]">{t('wheel.plan.compareTitle')}</h2>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3">
                        {plans.map(p => (
                            <div
                                key={p.tier}
                                className={`rounded-xl border p-4 space-y-2 ${
                                    p.tier === current ? 'border-blue-500 bg-blue-500/5' : 'border-[#374151] bg-[#262626]'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="font-black text-[#f8fafc]">{tierName(p.tier)}</h3>
                                    {p.tier === current && (
                                        <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase">{t('wheel.plan.current')}</span>
                                    )}
                                </div>
                                <dl className="text-sm 3xl:text-base space-y-1.5">
                                    {([
                                        ['wheels', fmt(p.maxWheels, 'wheels')],
                                        ['segments', fmt(p.maxSegments, 'segments')],
                                        ['history', fmt(p.historyDays, 'days')],
                                    ] as const).map(([k, v]) => (
                                        <div key={k} className="flex items-baseline justify-between gap-2">
                                            <dt className="text-[#94a3b8]">{t(`wheel.plan.gain.${k}`)}</dt>
                                            <dd className="font-medium text-[#f8fafc] text-right">{v}</dd>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between gap-2">
                                        <dt className="text-[#94a3b8]">{t('wheel.plan.gain.watermark')}</dt>
                                        <dd>
                                            {p.canHideWatermark
                                                ? <Check className="w-4 h-4 text-green-400" aria-label={t('wheel.plan.yes')} />
                                                : <X className="w-4 h-4 text-[#64748b]" aria-label={t('wheel.plan.no')} />}
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        ))}
                    </div>
                    <p className="px-5 pb-5 text-xs 3xl:text-sm text-[#94a3b8]">{t('wheel.plan.onlyQuantities')}</p>
                </section>
            )}
        </div>
    );
}
