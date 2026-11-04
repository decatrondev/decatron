import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Alert, Badge } from '../../../components/ds';
import { Card } from '../../../components/overlay-editor/ui';
import type { AvailablePlatforms, SyncStatus } from '../types';

interface Props {
    available: AvailablePlatforms;
    syncStatus: SyncStatus | null;
    loading: boolean;
    relativeTime: (iso: string) => string;
    onSync: () => void;
    autoSyncEnabled: boolean;
    setAutoSyncEnabled: (v: boolean) => void;
    autoSyncInterval: number;
    setAutoSyncInterval: (v: number) => void;
}

const badgeTone = (r: SyncStatus['result']) => (r === 'ok' ? 'ok' : r === 'unfollows_skipped' ? 'warn' : r === 'fetch_failed' ? 'danger' : undefined);

export default function SyncTab(p: Props) {
    const { t } = useTranslation('followers');
    const { syncStatus: s } = p;
    const failed = s && (s.result === 'fetch_failed' || s.result === 'skipped_large');

    if (!p.available.twitch) {
        return (
            <Card title={t('status.title')}>
                <Alert tone="info" title={t('sync.noTwitchTitle')}>{t('sync.noTwitchBody')}</Alert>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card
                title={t('status.title')}
                description={t('syncTab.description')}
                actions={s ? <span className="shrink-0 whitespace-nowrap"><Badge tone={badgeTone(s.result)}>{t(`status.badge.${s.result}`)}</Badge></span> : undefined}
            >
                <div className="space-y-4">
                    <p className="text-sm 3xl:text-base text-ds-soft">
                        {!s
                            ? t('status.never')
                            : failed
                                ? t(s.result === 'fetch_failed' ? 'status.failed' : 'status.skippedLarge', { when: p.relativeTime(s.lastAttemptAt) })
                                : t('status.line', { when: p.relativeTime(s.lastSuccessAt ?? s.lastAttemptAt), source: t(`status.source.${s.source}`) })}
                        {s?.lastSuccessAt && failed && <> {t('status.lastGood', { when: p.relativeTime(s.lastSuccessAt) })}</>}
                    </p>

                    {s && !failed && (
                        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {([
                                ['newFollowers', s.newFollowers],
                                ['returned', s.returned],
                                ['unfollowed', s.unfollowed],
                                ['renamed', s.renamed],
                            ] as const).map(([k, v]) => (
                                <li key={k} className="rounded-lg border border-ds-border p-3">
                                    <div className="text-2xl 3xl:text-3xl font-black text-ds-text">{v ?? 0}</div>
                                    <div className="text-xs 3xl:text-sm text-ds-soft">{t(`syncTab.last.${k}`)}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {s?.result === 'unfollows_skipped' && <Alert tone="warn" title={t('sync.skippedTitle')}>{t('sync.skippedHint')}</Alert>}

                    <button onClick={p.onSync} disabled={p.loading} className="ds-btn ds-btn--primary">
                        <RefreshCw className={`w-4 h-4 ${p.loading ? 'animate-spin' : ''}`} />
                        {p.available.kick ? t('sync.buttonTwitch') : t('sync.button')}
                    </button>
                </div>
            </Card>

            <Card title={t('autosync.browserTitle')} description={t('autosync.body')}>
                <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-3 cursor-pointer text-sm 3xl:text-base text-ds-text font-bold">
                        <input type="checkbox" checked={p.autoSyncEnabled} onChange={(e) => p.setAutoSyncEnabled(e.target.checked)} className="w-5 h-5 rounded border-ds-border" />
                        {t('syncTab.browserEnable')}
                    </label>
                    {p.autoSyncEnabled && (
                        <div className="flex items-center gap-2">
                            <label className="text-sm 3xl:text-base text-ds-soft">{t('autosync.every')}</label>
                            <select value={p.autoSyncInterval} onChange={(e) => p.setAutoSyncInterval(Number(e.target.value))} className="ds-input">
                                {[5, 10, 15, 30].map(m => <option key={m} value={m}>{t('autosync.minutes', { count: m })}</option>)}
                                <option value={60}>{t('autosync.hours', { count: 1 })}</option>
                                <option value={1440}>{t('autosync.hours', { count: 24 })}</option>
                            </select>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
