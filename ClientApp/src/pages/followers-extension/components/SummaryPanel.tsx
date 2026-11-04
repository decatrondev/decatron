import { useTranslation } from 'react-i18next';
import { Ban, RefreshCw, UserMinus, UserPlus, Users } from 'lucide-react';
import { Badge } from '../../../components/ds';
import { Card } from '../../../components/overlay-editor/ui';
import type { AvailablePlatforms, FollowerStats, PlatformCounts, SyncStatus } from '../types';

interface Props {
    stats: FollowerStats;
    counts: PlatformCounts;
    available: AvailablePlatforms;
    syncStatus: SyncStatus | null;
    loading: boolean;
    relativeTime: (iso: string) => string;
    onSync: () => void;
}

const badgeTone = (r: SyncStatus['result']) => (r === 'ok' ? 'ok' : r === 'unfollows_skipped' ? 'warn' : r === 'fetch_failed' ? 'danger' : undefined);

/** Resumen siempre visible a la derecha (como la vista previa del SR): cifras, reparto por plataforma y estado de la sincronización. */
export default function SummaryPanel({ stats, counts, available, syncStatus, loading, relativeTime, onSync }: Props) {
    const { t, i18n } = useTranslation('followers');
    const nf = new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'es-ES');
    const both = available.twitch && available.kick;
    const tw = counts.twitch?.active ?? 0;
    const kk = counts.kick?.active ?? 0;
    const twShare = tw + kk > 0 ? Math.round((tw / (tw + kk)) * 100) : 0;

    const rows = [
        { icon: Users, label: t('stats.total'), value: stats.totalFollowers },
        { icon: UserMinus, label: t('common.unfollows'), value: stats.unfollowedCount },
        { icon: UserPlus, label: t('common.returned'), value: stats.returnedCount },
        { icon: Ban, label: t('common.blocked'), value: stats.blockedCount },
    ];

    return (
        <Card title={t('summary.title')}>
            <div className="space-y-5">
                <div>
                    <div className="text-4xl 3xl:text-5xl font-black text-ds-text leading-none">{nf.format(stats.activeFollowers)}</div>
                    <div className="text-sm 3xl:text-base text-ds-soft mt-1">{t('summary.activeLabel')}</div>
                </div>

                {both && (
                    <div className="space-y-2">
                        <div className="flex h-2 rounded-full overflow-hidden bg-ds-faint" role="img" aria-label={t('summary.splitAria', { twitch: tw, kick: kk })}>
                            <div className="bg-ds-accent" style={{ width: `${twShare}%` }} />
                        </div>
                        <div className="flex justify-between text-xs 3xl:text-sm text-ds-soft">
                            <span><span className="inline-block w-2 h-2 rounded-full bg-ds-accent mr-1.5" />Twitch {nf.format(tw)}</span>
                            <span><span className="inline-block w-2 h-2 rounded-full bg-ds-faint mr-1.5" />Kick {nf.format(kk)}</span>
                        </div>
                    </div>
                )}

                <dl className="divide-y divide-ds-border border-y border-ds-border">
                    {rows.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-center justify-between py-2.5 text-sm 3xl:text-base">
                            <dt className="flex items-center gap-2 text-ds-soft"><Icon className="w-4 h-4 shrink-0" aria-hidden />{label}</dt>
                            <dd className="font-bold text-ds-text">{nf.format(value)}</dd>
                        </div>
                    ))}
                </dl>

                {available.twitch && (
                    <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm 3xl:text-base font-bold text-ds-text">{t('status.title')}</p>
                                <p className="text-xs 3xl:text-sm text-ds-soft mt-0.5">
                                    {syncStatus
                                        ? t(syncStatus.result === 'fetch_failed' ? 'summary.syncFailed' : 'summary.syncLast', {
                                            when: relativeTime(syncStatus.result === 'fetch_failed' ? syncStatus.lastAttemptAt : (syncStatus.lastSuccessAt ?? syncStatus.lastAttemptAt)),
                                            source: t(`status.source.${syncStatus.source}`),
                                        })
                                        : t('summary.syncNever')}
                                </p>
                            </div>
                            {syncStatus && <span className="shrink-0 whitespace-nowrap"><Badge tone={badgeTone(syncStatus.result)}>{t(`status.badge.${syncStatus.result}`)}</Badge></span>}
                        </div>
                        <button onClick={onSync} disabled={loading} className="ds-btn ds-btn--secondary ds-btn--sm w-full justify-center">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            {available.kick ? t('sync.buttonTwitch') : t('sync.button')}
                        </button>
                    </div>
                )}
            </div>
        </Card>
    );
}
