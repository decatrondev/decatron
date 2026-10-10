/**
 * AlertsTab - Alert mode selector, TipsAlertSection delegation
 */

import React from 'react';
import { Bell, Check, Settings, ExternalLink, Zap, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TipsAlertSection } from '../TipsAlertSection';
import type { TipsSettings } from '../../types/config';
import type { TipsAlertConfig } from '../../types/index';
import { DEFAULT_TIPS_ALERT_CONFIG, DEFAULT_TIPS_BASE_ALERT } from '../../constants/defaults';

interface AlertsTabProps {
    settings: TipsSettings;
    updateSettings: (updates: Partial<TipsSettings>) => void;
    cardClass: string;
    testTip: () => void;
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
    settings,
    updateSettings,
    cardClass,
    testTip,
}) => {
    const { t } = useTranslation('features');
    return (
        <div className="space-y-6">
            <div className={cardClass}>
                <h3 className="text-lg font-bold text-ds-text mb-4 flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    {t('tipsTabs.alertSystem')}
                </h3>

                <p className="text-sm text-ds-soft mb-6">
                    {t('tipsTabs.alertModeDesc')}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Independent Alerts Option */}
                    <button
                        onClick={() => updateSettings({ alertMode: 'basic' })}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                            settings.alertMode === 'basic'
                                ? 'border-ds-accent bg-ds-accent/10 '
                                : 'border-ds-border hover:border-ds-accent'
                        }`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                settings.alertMode === 'basic'
                                    ? 'border-ds-accent bg-ds-accent'
                                    : 'border-ds-border'
                            }`}>
                                {settings.alertMode === 'basic' && <Check className="w-3 h-3 text-ds-text" />}
                            </div>
                            <span className="font-bold text-ds-text">
                                {t('tipsTabs.independentAlerts')}
                            </span>
                        </div>
                        <p className="text-sm text-ds-soft ml-8">
                            {t('tipsTabs.independentAlertsDesc')}
                        </p>
                    </button>

                    {/* Timer Option */}
                    <button
                        onClick={() => updateSettings({ alertMode: 'timer' })}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                            settings.alertMode === 'timer'
                                ? 'border-ds-accent bg-ds-accent/10 '
                                : 'border-ds-border hover:border-ds-accent'
                        }`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                settings.alertMode === 'timer'
                                    ? 'border-ds-accent bg-ds-accent'
                                    : 'border-ds-border'
                            }`}>
                                {settings.alertMode === 'timer' && <Check className="w-3 h-3 text-ds-text" />}
                            </div>
                            <span className="font-bold text-ds-text">
                                {t('tipsTabs.timerSystem')}
                            </span>
                        </div>
                        <p className="text-sm text-ds-soft ml-8">
                            {t('tipsTabs.timerSystemDesc')}
                        </p>
                    </button>
                </div>
            </div>

            {/* Configuration based on mode */}
            {settings.alertMode === 'timer' ? (
                <div className={cardClass}>
                    <div className="p-4 bg-ds-accent/10 border border-ds-accent rounded-lg">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-ds-accent/10 rounded-lg">
                                <Zap className="w-6 h-6 text-ds-accent-text" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-ds-accent-text mb-1">
                                    {t('tipsTabs.configureDonationAlerts')}
                                </h4>
                                <p className="text-sm text-ds-accent-text mb-3">
                                    {t('tipsTabs.donationAlertsInTimer')}
                                </p>
                                <a
                                    href="/features/timer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg font-bold transition-all"
                                >
                                    <Settings className="w-4 h-4" />
                                    {t('tipsTabs.goToTimerConfig')}
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-ds-warn/10 border border-ds-warn/40 rounded-lg">
                        <p className="text-sm text-ds-warn flex items-center gap-2">
                            <Info className="w-4 h-4 flex-shrink-0" />
                            <span dangerouslySetInnerHTML={{ __html: t('tipsTabs.alertsTabHint') }} />
                        </p>
                    </div>

                    <div className="mt-4 text-sm text-ds-soft">
                        <p className="font-semibold mb-2">{t('tipsTabs.timerCapabilities')}</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>{t('tipsTabs.timerCap1')}</li>
                            <li>{t('tipsTabs.timerCap2')}</li>
                            <li>{t('tipsTabs.timerCap3')}</li>
                            <li>{t('tipsTabs.timerCap4')}</li>
                            <li>{t('tipsTabs.timerCap5')}</li>
                            <li>{t('tipsTabs.timerCap6')}</li>
                        </ul>
                    </div>
                </div>
            ) : (
                <TipsAlertSection
                    enabled={settings.tipsAlertConfig?.enabled ?? true}
                    onEnabledChange={(v) => updateSettings({
                        tipsAlertConfig: {
                            ...settings.tipsAlertConfig || DEFAULT_TIPS_ALERT_CONFIG,
                            enabled: v
                        }
                    })}
                    baseAlert={settings.tipsAlertConfig?.baseAlert || DEFAULT_TIPS_BASE_ALERT}
                    onBaseAlertChange={(updates) => updateSettings({
                        tipsAlertConfig: {
                            ...settings.tipsAlertConfig || DEFAULT_TIPS_ALERT_CONFIG,
                            baseAlert: {
                                ...(settings.tipsAlertConfig?.baseAlert || DEFAULT_TIPS_BASE_ALERT),
                                ...updates
                            }
                        }
                    })}
                    tiers={settings.tipsAlertConfig?.tiers || []}
                    onTiersChange={(tiers) => updateSettings({
                        tipsAlertConfig: {
                            ...settings.tipsAlertConfig || DEFAULT_TIPS_ALERT_CONFIG,
                            tiers
                        }
                    })}
                    cooldown={settings.tipsAlertConfig?.cooldown || 0}
                    onCooldownChange={(cooldown) => updateSettings({
                        tipsAlertConfig: {
                            ...settings.tipsAlertConfig || DEFAULT_TIPS_ALERT_CONFIG,
                            cooldown
                        }
                    })}
                    currency={settings.currency}
                    onTest={testTip}
                    userTier="free"
                />
            )}
        </div>
    );
};
