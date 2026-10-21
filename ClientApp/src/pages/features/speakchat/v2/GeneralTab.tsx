// General: encender Speak Chat y elegir las plataformas de las que lee.
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Card, Toggle } from '../../../../components/overlay-editor/ui';
import PlatformsCard from './PlatformsCard';
import type { SpeakChatState } from './useSpeakChatConfig';

export default function GeneralTab({ sc }: { sc: SpeakChatState }) {
    const { t } = useTranslation('speakchat');
    const { config, setConfig, status, statusLoaded } = sc;
    const noOverlay = statusLoaded && config.global.enabled && status.total === 0;
    return (
        <div className="space-y-6">
            <Card title={t('v2.general.title')} description={t('v2.general.description')}>
                <Toggle
                    checked={config.global.enabled}
                    onChange={v => setConfig(c => ({ ...c, global: { ...c.global, enabled: v } }))}
                    label={t('v2.summary.enabled')}
                    hint={config.global.enabled ? t('v2.summary.enabledOn') : t('v2.summary.enabledOff')}
                />
                {noOverlay && (
                    <div role="alert" className="mt-4 flex items-start gap-3 rounded-lg border border-ds-warn/40 bg-ds-warn/10 px-4 py-3 text-sm 3xl:text-base text-ds-warn">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <span>{t('v2.summary.noOverlay')}</span>
                    </div>
                )}
            </Card>
            <PlatformsCard sc={sc} />
        </div>
    );
}
