/**
 * SecurityTab - Max message length, cooldown, bad words, require message
 */

import React from 'react';
import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TipsSettings } from '../../types/config';

interface SecurityTabProps {
    settings: TipsSettings;
    updateSettings: (updates: Partial<TipsSettings>) => void;
    inputClass: string;
    labelClass: string;
    cardClass: string;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({
    settings,
    updateSettings,
    inputClass,
    labelClass,
    cardClass,
}) => {
    const { t } = useTranslation('features');
    return (
        <div className={cardClass}>
            <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t('tipsTabs.securityAntiSpam')}
            </h3>

            <div className="space-y-4">
                <div>
                    <label className={labelClass}>{t('tipsTabs.maxMessageLength')}</label>
                    <input
                        type="number"
                        min="1"
                        max="500"
                        value={settings.maxMessageLength}
                        onChange={e => updateSettings({ maxMessageLength: parseInt(e.target.value) || 255 })}
                        className={inputClass}
                    />
                </div>

                <div>
                    <label className={labelClass}>{t('tipsTabs.cooldownBetweenDonations')}</label>
                    <input
                        type="number"
                        min="0"
                        value={settings.cooldownSeconds}
                        onChange={e => updateSettings({ cooldownSeconds: parseInt(e.target.value) || 0 })}
                        className={inputClass}
                    />
                    <p className="text-xs text-[#94a3b8] mt-1">
                        {t('tipsTabs.noCooldown')}
                    </p>
                </div>

                <label className="flex items-center gap-3 p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.badWordsFilter}
                        onChange={e => updateSettings({ badWordsFilter: e.target.checked })}
                        className="w-5 h-5 rounded text-purple-500"
                    />
                    <div>
                        <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {t('tipsTabs.blockBadWords')}
                        </span>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {t('tipsTabs.blockBadWordsDesc')}
                        </p>
                    </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.requireMessage}
                        onChange={e => updateSettings({ requireMessage: e.target.checked })}
                        className="w-5 h-5 rounded text-purple-500"
                    />
                    <div>
                        <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {t('tipsTabs.requireMessage')}
                        </span>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {t('tipsTabs.requireMessageDesc')}
                        </p>
                    </div>
                </label>
            </div>
        </div>
    );
};
