import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Alert, Badge, Button, Card, Eyebrow, Segmented, Spinner } from '../../components/ds';
import PlatformShell, { wrap } from './PlatformShell';

// Página pública de planes (decatron.top/planes). Los precios vienen de GET /api/platform/plans (la misma base que usa el
// checkout): aquí no se escribe ningún precio a mano, salvo el «desde» del plan a medida, que no está en la base.

type Plan = { key: string; name: string; channels: number | null; admins: number | null; modules: string[]; prices: Record<string, number> };
type Addon = { key: string; includedIn: string | null; prices: Record<string, number> };
type Catalog = { penPerUsd: number; plans: Plan[]; addons: Addon[] };

const PERIODS = [1, 3, 6, 9, 12] as const;
const section = 'py-14 3xl:py-20 border-t border-ds-border-soft';
const sectionTitle = 'font-extrabold tracking-tight text-ds-text text-2xl 3xl:text-3xl leading-tight';

/** Etiqueta de un módulo: la clave de la base es «module.song_request»; el texto vive en los idiomas. */
const moduleId = (key: string) => key.replace(/^module\./, '');

export default function PlatformPlans() {
    const { t, i18n } = useTranslation('platform');
    const lang = i18n.language?.startsWith('en') ? 'en-US' : 'es-PE';
    const [data, setData] = useState<Catalog | null>(null);
    const [failed, setFailed] = useState(false);
    const navigate = useNavigate();
    const join = () => navigate('/#lista');
    const [months, setMonths] = useState<number>(12);

    const load = useCallback(() => {
        setFailed(false);
        fetch('/api/platform/plans', { headers: { Accept: 'application/json' } })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then(j => setData({ penPerUsd: j.penPerUsd, plans: j.plans, addons: j.addons }))
            .catch(() => setFailed(true));
    }, []);
    useEffect(load, [load]);

    const money = useMemo(() => new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [lang]);
    const usd = (v: number) => t('plans.usd', { amount: money.format(v) });

    // Descuento del periodo = lo que ahorra frente a pagar mes a mes, tomado del primer plan (el porcentaje es el mismo en todos)
    const discount = useCallback((m: number) => {
        const p = data?.plans[0];
        const one = p?.prices['1'], tot = p?.prices[String(m)];
        return one && tot && m > 1 ? Math.round((1 - tot / (one * m)) * 100) : 0;
    }, [data]);

    const available = PERIODS.filter(m => data?.plans.every(p => p.prices[String(m)] != null));

    return (
        <PlatformShell>
            <section className="pt-14 3xl:pt-20 pb-10">
                <div className={wrap}>
                    <Eyebrow>{t('plans.eyebrow')}</Eyebrow>
                    <h1 className="font-extrabold tracking-tight text-ds-text text-4xl 3xl:text-5xl 4xl:text-6xl leading-tight mt-2">{t('plans.title')}</h1>
                    <p className="text-lg 3xl:text-xl text-ds-soft max-w-2xl 3xl:max-w-3xl leading-relaxed mt-3">{t('plans.subtitle')}</p>
                </div>
            </section>

            {!data && !failed && <div className={`${wrap} py-16 flex items-center gap-3 text-ds-soft`}><Spinner />{t('plans.loading')}</div>}
            {failed && (
                <div className={`${wrap} pb-16`}>
                    <Alert tone="danger" title={t('plans.error')}><Button size="sm" variant="secondary" onClick={load}>{t('plans.retry')}</Button></Alert>
                </div>
            )}

            {data && (
                <>
                    <section className="pb-14">
                        <div className={wrap}>
                            <div className="flex flex-wrap items-center gap-3 mb-8 [&_button]:whitespace-nowrap" aria-label={t('plans.periodLabel')}>
                                <div className="max-w-full overflow-x-auto">
                                    <Segmented
                                        value={String(months)} onChange={id => setMonths(Number(id))}
                                        items={available.map(m => ({ id: String(m), label: t(`plans.period.${m}`) }))}
                                    />
                                </div>
                                {discount(months) > 0 && <Badge tone="accent">{t('plans.save', { pct: discount(months) })}</Badge>}
                            </div>

                            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 3xl:gap-6">
                                {data.plans.map((p, i) => {
                                    const total = p.prices[String(months)];
                                    const monthly = total / months;
                                    const prev = i > 0 ? data.plans[i - 1] : null;
                                    const mods = prev ? p.modules.filter(m => !prev.modules.includes(m)) : p.modules;
                                    return (
                                        <Card key={p.key} className="h-full">
                                            <div className="flex flex-col h-full gap-4">
                                                <h2 className="text-xl 3xl:text-2xl font-bold text-ds-text">{p.name}</h2>
                                                <div>
                                                    <p className="text-ds-text"><span className="text-3xl 3xl:text-4xl font-extrabold tracking-tight">{usd(monthly)}</span> <span className="text-ds-soft text-sm whitespace-nowrap">{t('plans.perMonth')}</span></p>
                                                    <p className="text-sm text-ds-faint mt-1">{months > 1 ? t('plans.billed', { amount: usd(total), months: t(`plans.period.${months}`) }) : t('plans.billedMonthly', { amount: usd(total) })}</p>
                                                    <p className="text-sm text-ds-faint">{t('plans.pen', { amount: money.format(monthly * data.penPerUsd) })}</p>
                                                </div>
                                                <p className="text-sm 3xl:text-base text-ds-soft">
                                                    {p.channels != null && t('plans.channels', { count: p.channels })}
                                                    {p.channels != null && p.admins != null && ' · '}
                                                    {p.admins != null && t('plans.admins', { count: p.admins })}
                                                </p>
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-ds-text mb-2">{prev ? t('plans.includesMore', { plan: prev.name }) : t('plans.includesBase')}</p>
                                                    <ul className="space-y-1.5">
                                                        {mods.map(m => (
                                                            <li key={m} className="flex items-start gap-2 text-sm 3xl:text-base text-ds-soft">
                                                                <Check className="w-4 h-4 mt-0.5 shrink-0 text-ds-accent-text" aria-hidden />{t(`plans.modules.${moduleId(m)}`, moduleId(m))}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <Button block variant={i === 1 ? 'primary' : 'secondary'} onClick={join}>{t('plans.cta')}</Button>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                            <p className="font-mono text-sm text-ds-faint mt-4">{t('plans.ctaNote')}</p>

                            <Card className="mt-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl 3xl:text-2xl font-bold text-ds-text">{t('plans.custom.name')}</h2>
                                        <p className="text-ds-soft mt-1">{t('plans.custom.text')}</p>
                                        <p className="font-mono text-sm text-ds-faint mt-1">{t('plans.custom.price')}</p>
                                    </div>
                                    <Button variant="secondary" onClick={join}>{t('plans.custom.cta')}</Button>
                                </div>
                            </Card>
                        </div>
                    </section>

                    {data.addons.some(a => a.key.startsWith('module.')) && (
                        <section className={section}>
                            <div className={wrap}>
                                <h2 className={sectionTitle}>{t('plans.addons.title')}</h2>
                                <p className="text-ds-soft mt-2 max-w-3xl 3xl:text-lg">{t('plans.addons.subtitle')}</p>
                                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 3xl:gap-4 mt-8">
                                    {data.addons.filter(a => a.key.startsWith('module.') && a.prices[String(months)] != null).map(a => {
                                        const incl = data.plans.find(p => p.key === a.includedIn);
                                        return (
                                            <Card key={a.key}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <h3 className="font-bold text-ds-text 3xl:text-lg">{t(`plans.modules.${moduleId(a.key)}`, moduleId(a.key))}</h3>
                                                        {incl && <p className="text-sm text-ds-faint mt-1">{t('plans.addons.from', { plan: incl.name })}</p>}
                                                    </div>
                                                    <p className="text-ds-text font-semibold whitespace-nowrap">{t('plans.addons.month', { amount: money.format(a.prices[String(months)] / months) })}</p>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    )}

                    <section className={section}>
                        <div className={wrap}>
                            <h2 className={sectionTitle}>{t('plans.notes.title')}</h2>
                            <ul className="mt-5 space-y-2 text-ds-soft 3xl:text-lg max-w-3xl">
                                <li>{t('plans.notes.igv')}</li>
                                <li>{t('plans.notes.pen', { rate: money.format(data.penPerUsd) })}</li>
                                <li>{t('plans.notes.trial')}</li>
                                <li>{t('plans.notes.refunds')}</li>
                            </ul>
                        </div>
                    </section>
                </>
            )}
        </PlatformShell>
    );
}
