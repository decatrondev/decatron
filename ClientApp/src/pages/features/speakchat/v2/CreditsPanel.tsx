// Saldo de voz del canal: lo que queda, de dónde sale y qué pasa si se acaba.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card } from '../../../../components/overlay-editor/ui';
import { usageDateLabels } from '../shared';
import type { CreditUsage } from '../types';

export default function CreditsPanel({ usage }: { usage: CreditUsage | null }) {
    const { t } = useTranslation('speakchat');
    const { transitionEndsLabel, tierExpiryLabel } = usageDateLabels(usage);

    if (!usage) {
        return <Card title={t('v2.credits.title')}><p className="text-sm text-ds-soft">{t('v2.credits.loading')}</p></Card>;
    }

    const exhausted = !usage.isUnlimited && usage.totalAvailable === 0;
    const low = !usage.isUnlimited && !exhausted && usage.monthlyGranted > 0 && usage.percentage >= 85 && usage.purchasedBalance === 0;
    const tone = usage.percentage > 90 ? 'bg-ds-danger-solid' : usage.percentage > 70 ? 'bg-ds-warn' : 'bg-ds-accent';

    return (
        <Card
            title={t('v2.credits.title')}
            description={usage.isUnlimited ? t('v2.credits.unlimited', { tier: usage.tier }) : t('v2.credits.available', { amount: usage.totalAvailable.toLocaleString() })}
            actions={<Link to="/credits" className="ds-btn ds-btn--secondary ds-btn--sm whitespace-nowrap">{t('v2.credits.buy')}</Link>}
        >
            {!usage.isUnlimited && (
                <div className="space-y-4">
                    {usage.monthlyGranted > 0 && (
                        <div className="h-2.5 bg-ds-raised rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(usage.percentage)} aria-valuemin={0} aria-valuemax={100}>
                            <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${Math.min(usage.percentage, 100)}%` }} />
                        </div>
                    )}
                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm 3xl:text-base">
                        <div className="rounded-lg bg-ds-bg p-3">
                            <dt className="text-xs 3xl:text-sm text-ds-soft">{t('v2.credits.monthly')}</dt>
                            <dd className="font-bold text-ds-text">{usage.monthlyRemaining.toLocaleString()} / {usage.monthlyGranted.toLocaleString()}</dd>
                            <dd className="text-xs 3xl:text-sm text-ds-soft">{t('v2.credits.monthlyHint')}</dd>
                        </div>
                        <div className="rounded-lg bg-ds-bg p-3">
                            <dt className="text-xs 3xl:text-sm text-ds-soft">{t('v2.credits.purchased')}</dt>
                            <dd className="font-bold text-ds-text">{usage.purchasedBalance.toLocaleString()}</dd>
                            <dd className="text-xs 3xl:text-sm text-ds-soft">{t('v2.credits.purchasedHint')}</dd>
                        </div>
                        {usage.standardGranted > 0 && (
                            <div className="rounded-lg bg-ds-bg p-3">
                                <dt className="text-xs 3xl:text-sm text-ds-soft">{t('v2.credits.standard')}</dt>
                                <dd className="font-bold text-ds-text">{usage.standardRemaining.toLocaleString()} / {usage.standardGranted.toLocaleString()}</dd>
                                <dd className="text-xs 3xl:text-sm text-ds-soft">{t('v2.credits.standardHint')}</dd>
                            </div>
                        )}
                    </dl>
                </div>
            )}
            <div className="mt-4 space-y-1.5 text-sm 3xl:text-base">
                {tierExpiryLabel && <p className="text-ds-warn">{t('v2.credits.tierExpires', { date: tierExpiryLabel })}</p>}
                {usage.inTransitionWindow && usage.tier === 'free' && transitionEndsLabel && (
                    <p className="text-ds-soft">{t('v2.credits.transition', { date: transitionEndsLabel })}</p>
                )}
                {low && <p className="font-bold text-ds-warn">{t('v2.credits.low')}</p>}
                {exhausted && <p className="font-bold text-ds-danger">{t('v2.credits.exhausted')}</p>}
                {!usage.isUnlimited && <p className="text-ds-soft">{t('v2.credits.noBalanceRule')}</p>}
            </div>
        </Card>
    );
}
