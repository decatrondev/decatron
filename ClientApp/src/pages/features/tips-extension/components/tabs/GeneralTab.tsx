/**
 * GeneralTab - Enable/disable, min/max amounts, currency, suggested amounts
 */

import React from 'react';
import { DollarSign, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TipsSettings } from '../../types/config';
import { CURRENCIES } from '../../types/config';

interface GeneralTabProps {
    settings: TipsSettings;
    updateSettings: (updates: Partial<TipsSettings>) => void;
    inputClass: string;
    labelClass: string;
    cardClass: string;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
    settings,
    updateSettings,
    inputClass,
    labelClass,
    cardClass,
}) => {
    const { t } = useTranslation('features');

    const getSuggestedAmountsArray = (): number[] => {
        return settings.suggestedAmounts
            .split(',')
            .map(s => parseFloat(s.trim()))
            .filter(n => !isNaN(n));
    };

    const setSuggestedAmountsArray = (amounts: number[]) => {
        updateSettings({ suggestedAmounts: amounts.join(',') });
    };

    return (
        <>
            <div className={cardClass}>
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    {t('tipsTabs.amountConfig')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label className={labelClass}>{t('tipsTabs.currency')}</label>
                        <select
                            value={settings.currency}
                            onChange={e => updateSettings({ currency: e.target.value })}
                            className={inputClass}
                        >
                            {CURRENCIES.map(c => (
                                <option key={c.code} value={c.code}>
                                    {c.symbol} {c.code} - {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>{t('tipsTabs.minAmount')}</label>
                        <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={settings.minAmount}
                            onChange={e => updateSettings({ minAmount: parseFloat(e.target.value) || 1 })}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>{t('tipsTabs.maxAmount')}</label>
                        <input
                            type="number"
                            min="1"
                            value={settings.maxAmount}
                            onChange={e => updateSettings({ maxAmount: parseFloat(e.target.value) || 500 })}
                            className={inputClass}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>{t('tipsTabs.suggestedAmounts')}</label>
                    <div className="flex gap-2 flex-wrap">
                        {getSuggestedAmountsArray().map((amount, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                                <input
                                    type="number"
                                    min="1"
                                    value={amount}
                                    onChange={e => {
                                        const newAmounts = [...getSuggestedAmountsArray()];
                                        newAmounts[idx] = parseFloat(e.target.value) || 0;
                                        setSuggestedAmountsArray(newAmounts);
                                    }}
                                    className="w-20 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-center"
                                />
                                <button
                                    onClick={() => {
                                        const newAmounts = getSuggestedAmountsArray().filter((_, i) => i !== idx);
                                        setSuggestedAmountsArray(newAmounts);
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {getSuggestedAmountsArray().length < 6 && (
                            <button
                                onClick={() => setSuggestedAmountsArray([...getSuggestedAmountsArray(), 10])}
                                className="px-4 py-2 border-2 border-dashed border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#64748b] hover:border-purple-400 hover:text-purple-500 transition-all"
                            >
                                {t('tipsTabs.addAmount')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Enable/Disable */}
            <div className={cardClass}>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {t('tipsTabs.enableTips')}
                        </h3>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {t('tipsTabs.enableTipsDesc')}
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.isEnabled}
                            onChange={e => updateSettings({ isEnabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-green-500 peer-checked:to-emerald-500"></div>
                    </label>
                </div>
            </div>
        </>
    );
};
