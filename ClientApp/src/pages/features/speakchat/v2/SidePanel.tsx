// Panel derecho fijo (como en Song Request): vista previa, estado de OBS, saldo y prueba rápida. Se ve en todas las pestañas.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TestTube2 } from 'lucide-react';
import { Card } from '../../../../components/overlay-editor/ui';
import BubblePreview from './BubblePreview';
import type { SpeakChatState } from './useSpeakChatConfig';

export default function SidePanel({ sc, fishFallback }: { sc: SpeakChatState; fishFallback: string }) {
    const { t } = useTranslation('speakchat');
    const { config, status, statusLoaded, usage, testing } = sc;
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

    const quickTest = async () => {
        setResult(null);
        const r = await sc.sendTest(t('v2.tests.defaultMessage'), fishFallback);
        setResult(r.ok ? { ok: true, message: t('v2.tests.sent') } : { ok: false, message: r.message ?? t('v2.tests.failed') });
    };

    const connected = status.total > 0;
    const pct = usage && !usage.isUnlimited && usage.monthlyGranted > 0 ? Math.min(usage.percentage, 100) : null;
    const tone = usage && usage.percentage > 90 ? 'bg-ds-danger-solid' : usage && usage.percentage > 70 ? 'bg-ds-warn' : 'bg-ds-accent';

    return (
        <div className="space-y-4 xl:sticky xl:top-6">
            <Card title={t('v2.side.preview')}>
                <BubblePreview overlay={config.overlay} />
            </Card>

            <Card title={t('v2.side.status')}>
                <dl className="space-y-3 text-sm 3xl:text-base">
                    <div className="flex items-center justify-between gap-3">
                        <dt className="text-ds-soft">{t('v2.side.speakChat')}</dt>
                        <dd className={`font-bold ${config.global.enabled ? 'text-ds-ok' : 'text-ds-soft'}`}>{config.global.enabled ? t('v2.side.on') : t('v2.side.off')}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <dt className="text-ds-soft">{t('v2.side.obs')}</dt>
                        <dd className={`font-bold ${!statusLoaded ? 'text-ds-soft' : connected ? 'text-ds-ok' : 'text-ds-warn'}`}>
                            {!statusLoaded ? '…' : connected ? t('v2.side.connected', { count: status.total }) : t('v2.side.notConnected')}
                        </dd>
                    </div>
                    <div>
                        <div className="flex items-center justify-between gap-3">
                            <dt className="text-ds-soft">{t('v2.side.balance')}</dt>
                            <dd className="font-bold text-ds-text">{!usage ? '…' : usage.isUnlimited ? t('v2.side.unlimited') : usage.totalAvailable.toLocaleString()}</dd>
                        </div>
                        {pct !== null && (
                            <div className="mt-2 h-2 bg-ds-raised rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                                <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
                            </div>
                        )}
                    </div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" disabled={testing} onClick={quickTest}>
                        <TestTube2 className="w-4 h-4" /> {testing ? t('v2.tests.sending') : t('v2.side.test')}
                    </button>
                    {result && <span role="status" className={`text-xs 3xl:text-sm font-bold ${result.ok ? 'text-ds-ok' : 'text-ds-danger'}`}>{result.message}</span>}
                </div>
            </Card>
        </div>
    );
}
