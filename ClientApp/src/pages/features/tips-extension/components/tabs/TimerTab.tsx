/**
 * TimerTab - Timer integration toggle, seconds per currency, time unit
 */

import React from 'react';
import { Clock, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TipsSettings } from '../../types/config';
import { CURRENCIES } from '../../types/config';

interface TimerTabProps {
    settings: TipsSettings;
    updateSettings: (updates: Partial<TipsSettings>) => void;
    inputClass: string;
    labelClass: string;
    cardClass: string;
}

export const TimerTab: React.FC<TimerTabProps> = ({
    settings,
    updateSettings,
    inputClass,
    labelClass,
    cardClass,
}) => {
    const { t } = useTranslation('features');

    const formatCurrency = (amount: number) => {
        const curr = CURRENCIES.find(c => c.code === settings.currency);
        return `${curr?.symbol || '$'}${amount.toFixed(2)}`;
    };

    return (
        <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        {t('tipsTabs.timerIntegration')}
                    </h3>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                        {t('tipsTabs.timerIntegrationDesc')}
                    </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.timerIntegrationEnabled}
                        onChange={e => updateSettings({ timerIntegrationEnabled: e.target.checked })}
                        className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-gray-300 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-green-500 peer-checked:to-emerald-500"></div>
                </label>
            </div>

            {settings.timerIntegrationEnabled && (() => {
                const unit = settings.timeUnit || 'seconds';
                const unitToSeconds: Record<string, number> = {
                    seconds: 1,
                    minutes: 60,
                    hours: 3600,
                    days: 86400,
                };
                const unitLabels: Record<string, string> = {
                    seconds: t('tipsTabs.unitSeconds').toLowerCase(),
                    minutes: t('tipsTabs.unitMinutes').toLowerCase(),
                    hours: t('tipsTabs.unitHours').toLowerCase(),
                    days: t('tipsTabs.unitDays').toLowerCase(),
                };
                const multiplier = unitToSeconds[unit] ?? 1;
                const exampleAmount = 5;
                const totalSeconds = settings.secondsPerCurrency * exampleAmount * multiplier;
                const formatPreview = (s: number) => {
                    if (s >= 86400) return `${(s / 86400).toFixed(1)} ${unitLabels['days']}`;
                    if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
                    if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
                    return `${s}s`;
                };

                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>
                                    {t('tipsTabs.timePerCurrency', { currency: settings.currency })}
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={settings.secondsPerCurrency}
                                    onChange={e => updateSettings({ secondsPerCurrency: parseInt(e.target.value) || 1 })}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>{t('tipsTabs.timeUnit')}</label>
                                <select
                                    value={unit}
                                    onChange={e => updateSettings({ timeUnit: e.target.value as any })}
                                    className={inputClass}
                                >
                                    <option value="seconds">{t('tipsTabs.unitSeconds')}</option>
                                    <option value="minutes">{t('tipsTabs.unitMinutes')}</option>
                                    <option value="hours">{t('tipsTabs.unitHours')}</option>
                                    <option value="days">{t('tipsTabs.unitDays')}</option>
                                </select>
                            </div>
                        </div>

                        <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('tipsTabs.example')}</span>
                                {t('tipsTabs.donationAddsTime', { amount: formatCurrency(exampleAmount) })}{' '}
                                <span className="font-bold text-purple-600 dark:text-purple-400">
                                    {formatPreview(totalSeconds)}
                                </span>
                                {' '}{t('tipsTabs.toTheTimer')}
                                {' '}({settings.secondsPerCurrency} {unitLabels[unit]} × {exampleAmount} {settings.currency})
                            </p>
                        </div>

                        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Zap className="w-6 h-6 text-green-500" />
                                <div>
                                    <p className="font-bold text-green-700 dark:text-green-300">
                                        {t('tipsTabs.donationMoreTime')}
                                    </p>
                                    <p className="text-sm text-green-600 dark:text-green-400">
                                        {t('tipsTabs.autoAddTime')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};
